import crypto from 'crypto';

export const API_KEY_SCOPES = ['orders:read', 'orders:write', 'menu:read'] as const;
export type ApiKeyScope = typeof API_KEY_SCOPES[number];

export interface ApiClientIdentity {
  id: number | 'legacy';
  name: string;
  scopes: string[];
}

export function createApiKeySecret(): string {
  return `ngl_live_${crypto.randomBytes(32).toString('hex')}`;
}

export function hashApiKey(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function apiKeyPrefix(secret: string): string {
  return secret.slice(0, 17);
}

export function normalizeApiKeyScopes(scopes: unknown): ApiKeyScope[] {
  if (!Array.isArray(scopes)) return [...API_KEY_SCOPES];
  const allowed = new Set<string>(API_KEY_SCOPES);
  return [...new Set(scopes.filter((scope): scope is ApiKeyScope => typeof scope === 'string' && allowed.has(scope)))];
}

export function prepareApiKeyCredential(name: unknown, scopes: unknown) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (normalizedName.length < 2 || normalizedName.length > 100) {
    throw new Error('Nama integrasi harus terdiri dari 2-100 karakter.');
  }
  const normalizedScopes = normalizeApiKeyScopes(scopes);
  if (normalizedScopes.length === 0) {
    throw new Error('Pilih minimal satu izin API.');
  }
  const secret = createApiKeySecret();
  return {
    secret,
    record: {
      name: normalizedName,
      keyHash: hashApiKey(secret),
      keyPrefix: apiKeyPrefix(secret),
      scopes: JSON.stringify(normalizedScopes)
    }
  };
}

export function parseStoredScopes(value: unknown): ApiKeyScope[] {
  if (Array.isArray(value)) return normalizeApiKeyScopes(value);
  if (typeof value !== 'string') return [];
  try {
    return normalizeApiKeyScopes(JSON.parse(value));
  } catch {
    return [];
  }
}

export function safeSecretEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
