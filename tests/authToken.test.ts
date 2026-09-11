import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateAuthorization, getAuthTokenSecret, issueAuthToken, verifyAuthToken, isRoleAllowed } from '../src/lib/authToken.js';

const secret = 'test-secret-that-is-long-enough';
const user = { id: 'staff-1', name: 'Admin', role: 'Super Admin' };

test('token autentikasi valid membawa identitas terverifikasi', () => {
  const token = issueAuthToken(user, { secret, nowMs: 1_000, ttlSeconds: 60 });
  assert.deepEqual(verifyAuthToken(token, { secret, nowMs: 30_000 }), user);
});

test('token yang dimodifikasi ditolak', () => {
  const token = issueAuthToken(user, { secret, nowMs: 1_000, ttlSeconds: 60 });
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  assert.equal(verifyAuthToken(tampered, { secret, nowMs: 30_000 }), null);
});

test('token kedaluwarsa ditolak', () => {
  const token = issueAuthToken(user, { secret, nowMs: 1_000, ttlSeconds: 60 });
  assert.equal(verifyAuthToken(token, { secret, nowMs: 61_001 }), null);
});

test('otorisasi role hanya menerima role yang diizinkan', () => {
  assert.equal(isRoleAllowed(user, ['Super Admin', 'Kasir']), true);
  assert.equal(isRoleAllowed({ ...user, role: 'Pelanggan' }, ['Super Admin', 'Kasir']), false);
});

test('header Bearer diautentikasi dan skema lain ditolak', () => {
  const token = issueAuthToken(user, { secret, nowMs: 1_000, ttlSeconds: 60 });
  assert.deepEqual(authenticateAuthorization(`Bearer ${token}`, { secret, nowMs: 30_000 }), user);
  assert.equal(authenticateAuthorization(token, { secret, nowMs: 30_000 }), null);
  assert.equal(authenticateAuthorization(undefined, { secret, nowMs: 30_000 }), null);
});

test('production menolak AUTH_TOKEN_SECRET yang terlalu pendek', () => {
  const previousEnv = { nodeEnv: process.env.NODE_ENV, secret: process.env.AUTH_TOKEN_SECRET };
  process.env.NODE_ENV = 'production';
  process.env.AUTH_TOKEN_SECRET = 'terlalu-pendek';
  try {
    assert.throws(() => getAuthTokenSecret(), /minimal 32 byte/);
  } finally {
    if (previousEnv.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv.nodeEnv;
    if (previousEnv.secret === undefined) delete process.env.AUTH_TOKEN_SECRET;
    else process.env.AUTH_TOKEN_SECRET = previousEnv.secret;
  }
});
