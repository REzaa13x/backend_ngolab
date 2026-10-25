import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export interface AuthIdentity {
  id: string;
  name: string;
  role: string;
}

interface TokenOptions {
  secret: string;
  nowMs?: number;
  ttlSeconds?: number;
}

let developmentSecret: string | null = null;

export function getAuthTokenSecret() {
  const configured = process.env.AUTH_TOKEN_SECRET?.trim();
  if (configured) {
    if (process.env.NODE_ENV === 'production' && Buffer.byteLength(configured, 'utf8') < 32) {
      throw new Error('AUTH_TOKEN_SECRET production harus memiliki minimal 32 byte');
    }
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_TOKEN_SECRET wajib dikonfigurasi pada production');
  }
  if (!developmentSecret) {
    developmentSecret = randomBytes(32).toString('hex');
    console.warn('⚠️ AUTH_TOKEN_SECRET belum diatur; token development akan tidak valid setelah server restart');
  }
  return developmentSecret;
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueAuthToken(identity: AuthIdentity, options: TokenOptions) {
  const nowMs = options.nowMs ?? Date.now();
  const ttlSeconds = options.ttlSeconds ?? 86_400;
  const payload = Buffer.from(JSON.stringify({
    id: identity.id,
    name: identity.name,
    role: identity.role,
    expMs: nowMs + (ttlSeconds * 1_000)
  })).toString('base64url');
  return `${payload}.${sign(payload, options.secret)}`;
}

export function verifyAuthToken(token: string, options: Pick<TokenOptions, 'secret' | 'nowMs'>): AuthIdentity | null {
  try {
    const parts = token.split('.');
    const nowMs = options.nowMs ?? Date.now();

    // Format 1: 2-part Ngolab HMAC token (payload.signature)
    if (parts.length === 2) {
      const [payload, signature] = parts;
      if (!payload || !signature) return null;
      const expected = sign(payload, options.secret);
      const actualBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expected);
      if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (!parsed || typeof parsed.id !== 'string' || typeof parsed.name !== 'string' || typeof parsed.role !== 'string') return null;
      if (!Number.isFinite(parsed.expMs) || nowMs > parsed.expMs) return null;
      return { id: parsed.id, name: parsed.name, role: parsed.role };
    }

    // Format 2: 3-part HS256 JWT interoperability (PointLab SSO / JWT)
    if (parts.length === 3) {
      const [headerB64, payloadB64, signature] = parts;
      if (!headerB64 || !payloadB64 || !signature) return null;
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
      if (!header || header.alg !== 'HS256') return null;
      const signingInput = `${headerB64}.${payloadB64}`;
      const expected = sign(signingInput, options.secret);
      const actualBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expected);
      if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
      const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      const rawId = parsed?.id ?? parsed?.userId;
      if (rawId === undefined || rawId === null || String(rawId).trim() === '') return null;
      if (parsed.exp !== undefined) {
        if (!Number.isFinite(parsed.exp) || nowMs > Number(parsed.exp) * 1000) return null;
      }
      const rawRole = String(parsed.role || 'Pelanggan');
      const normalizedRole = ['Mahasiswa', 'member', 'MEMBER', 'Pelanggan'].includes(rawRole) ? 'Pelanggan' : rawRole;
      const name = String(parsed.name || parsed.nama || parsed.nim || 'Member');
      return { id: String(rawId), name, role: normalizedRole };
    }

    return null;
  } catch {
    return null;
  }
}

export function authenticateAuthorization(
  authorization: string | undefined,
  options: Pick<TokenOptions, 'secret' | 'nowMs'>
) {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token ? verifyAuthToken(token, options) : null;
}

export function isRoleAllowed(identity: AuthIdentity, allowedRoles: readonly string[]) {
  return allowedRoles.includes(identity.role);
}
