import { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import { db } from '../db/db.js';
import {
  ApiClientIdentity,
  ApiKeyScope,
  hashApiKey,
  parseStoredScopes,
  safeSecretEquals
} from '../lib/apiKeys.js';

dotenv.config();

export interface ApiKeyRequest extends Request {
  apiClient?: ApiClientIdentity;
}

export type ApiKeyLookup = (keyHash: string) => Promise<ApiClientIdentity | null>;

export async function lookupActiveApiKey(keyHash: string): Promise<ApiClientIdentity | null> {
  const [rows]: any = await db.query(
    `SELECT id, name, scopes
     FROM api_keys
     WHERE key_hash = ? AND is_active = 1
     LIMIT 1`,
    [keyHash]
  );
  if (!rows.length) return null;

  await db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [rows[0].id]);
  return {
    id: Number(rows[0].id),
    name: String(rows[0].name),
    scopes: parseStoredScopes(rows[0].scopes)
  };
}

export function createAuthApiKey(
  lookupApiKey: ApiKeyLookup,
  requiredScope?: ApiKeyScope,
  legacyApiKey = ''
) {
  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    const apiKey = req.header('x-api-key');
    if (!apiKey) {
      res.status(401).json({ message: 'Akses ditolak. API Key tidak ditemukan.' });
      return;
    }

    try {
      let client: ApiClientIdentity | null = null;
      if (legacyApiKey && safeSecretEquals(apiKey, legacyApiKey)) {
        client = { id: 'legacy', name: 'Legacy environment key', scopes: ['orders:read', 'orders:write', 'menu:read'] };
      } else {
        client = await lookupApiKey(hashApiKey(apiKey));
      }

      if (!client) {
        res.status(403).json({ message: 'Akses ditolak. API Key tidak valid atau sudah dinonaktifkan.' });
        return;
      }
      if (requiredScope && !client.scopes.includes(requiredScope)) {
        res.status(403).json({ message: `API Key tidak memiliki izin ${requiredScope}.` });
        return;
      }

      req.apiClient = client;
      next();
    } catch {
      res.status(503).json({ message: 'Layanan autentikasi API Key tidak tersedia.' });
    }
  };
}

const legacyApiKey = process.env.EXTERNAL_API_KEY || '';
export const authApiKey = createAuthApiKey(lookupActiveApiKey, undefined, legacyApiKey);
export const requireApiKeyScope = (scope: ApiKeyScope) => createAuthApiKey(lookupActiveApiKey, scope, legacyApiKey);
