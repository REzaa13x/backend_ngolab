import { NextFunction, Request, Response } from 'express';
import { db } from '../db/db.js';
import {
  AuthIdentity,
  authenticateAuthorization,
  getAuthTokenSecret,
  isRoleAllowed
} from '../lib/authToken.js';

export interface AuthenticatedRequest extends Request {
  auth?: AuthIdentity;
}

export type IdentityLookup = (tokenIdentity: AuthIdentity) => Promise<AuthIdentity | null>;

export async function lookupCurrentIdentity(tokenIdentity: AuthIdentity): Promise<AuthIdentity | null> {
  const [userRows]: any = await db.query(
    'SELECT id, nama AS name FROM users WHERE id = ? LIMIT 1',
    [tokenIdentity.id]
  );
  if (tokenIdentity.role === 'Pelanggan') {
    return userRows[0] ? { ...userRows[0], role: 'Pelanggan' } : null;
  }
  // Fail closed on legacy cross-table ID collisions instead of trusting a role from the token.
  if (userRows.length) return null;
  const [rows]: any = await db.query(
    "SELECT id, name, role FROM staff WHERE id = ? AND status = 'active' LIMIT 1",
    [tokenIdentity.id]
  );
  return rows[0] || null;
}

async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  lookupIdentity: IdentityLookup
): Promise<AuthIdentity | null> {
  try {
    const rawHeader = req.headers.authorization;
    const authorization = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const tokenIdentity = authenticateAuthorization(authorization, { secret: getAuthTokenSecret() });
    if (!tokenIdentity) {
      res.status(401).json({ message: 'Sesi tidak valid atau sudah kedaluwarsa' });
      return null;
    }
    const currentIdentity = await lookupIdentity(tokenIdentity);
    if (!currentIdentity) {
      res.status(401).json({ message: 'Akun tidak aktif atau sudah tidak tersedia' });
      return null;
    }
    req.auth = currentIdentity;
    return currentIdentity;
  } catch {
    res.status(503).json({ message: 'Autentikasi server tidak tersedia' });
    return null;
  }
}

export function createRequireAuthenticated(lookupIdentity: IdentityLookup) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (await authenticate(req, res, lookupIdentity)) next();
  };
}

export function createRequireRoles(lookupIdentity: IdentityLookup, ...allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identity = await authenticate(req, res, lookupIdentity);
    if (!identity) return;
    if (!isRoleAllowed(identity, allowedRoles)) {
      res.status(403).json({ message: 'Anda tidak memiliki izin untuk aksi ini' });
      return;
    }
    next();
  };
}

export const requireAuthenticated = createRequireAuthenticated(lookupCurrentIdentity);

export function requireRoles(...allowedRoles: string[]) {
  return createRequireRoles(lookupCurrentIdentity, ...allowedRoles);
}

export function getVerifiedActor(req: AuthenticatedRequest) {
  return req.auth?.name || 'Pengguna terverifikasi';
}
