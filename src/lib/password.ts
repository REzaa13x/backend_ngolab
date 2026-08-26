import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_ROUNDS = 12;
const BCRYPT_PREFIX = /^\$2[aby]\$/;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) return false;
  if (BCRYPT_PREFIX.test(storedHash)) return bcrypt.compare(password, storedHash);

  // Kompatibilitas akun lama yang masih memakai SHA-256.
  const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
  const expected = Buffer.from(storedHash, 'utf8');
  const actual = Buffer.from(legacyHash, 'utf8');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function needsPasswordUpgrade(storedHash: string | null | undefined): boolean {
  return Boolean(storedHash && !BCRYPT_PREFIX.test(storedHash));
}
