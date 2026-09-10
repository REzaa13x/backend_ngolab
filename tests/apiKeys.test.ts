import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_KEY_SCOPES,
  createApiKeySecret,
  hashApiKey,
  normalizeApiKeyScopes,
  prepareApiKeyCredential
} from '../src/lib/apiKeys.js';
import { createAuthApiKey } from '../src/middleware/authApiKey.js';

function fakeResponse() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; }
  };
}

test('API key baru memiliki prefix aman dan hanya hash yang perlu disimpan', () => {
  const secret = createApiKeySecret();
  assert.match(secret, /^ngl_live_[a-f0-9]{64}$/);
  assert.equal(hashApiKey(secret).length, 64);
  assert.notEqual(hashApiKey(secret), secret);
  assert.equal(hashApiKey(secret), hashApiKey(secret));
});

test('scope API key dibatasi pada daftar izin yang didukung', () => {
  assert.deepEqual(
    normalizeApiKeyScopes(['orders:read', 'unknown', 'orders:read', 'menu:read']),
    ['orders:read', 'menu:read']
  );
  assert.deepEqual(normalizeApiKeyScopes(undefined), [...API_KEY_SCOPES]);
});

test('credential baru hanya mengembalikan secret sekali dan record tanpa secret mentah', () => {
  const credential = prepareApiKeyCredential('Smart Tag', ['orders:read']);
  assert.equal(credential.record.name, 'Smart Tag');
  assert.deepEqual(JSON.parse(credential.record.scopes), ['orders:read']);
  assert.equal(credential.record.keyHash, hashApiKey(credential.secret));
  assert.ok(credential.record.keyPrefix.startsWith('ngl_live_'));
  assert.equal(JSON.stringify(credential.record).includes(credential.secret), false);
});

test('nama integrasi wajib valid saat membuat credential', () => {
  assert.throws(() => prepareApiKeyCredential('  ', ['orders:read']), /nama integrasi/i);
  assert.throws(() => prepareApiKeyCredential('AB', []), /izin/i);
});

test('middleware API key menolak request tanpa key', async () => {
  const req: any = { headers: {}, header: () => undefined };
  const res = fakeResponse();
  let nextCalled = false;
  const middleware = createAuthApiKey(async () => null);
  await middleware(req, res as any, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('middleware API key menolak key yang tidak dikenal', async () => {
  const req: any = { headers: {}, header: () => 'ngl_live_invalid' };
  const res = fakeResponse();
  let nextCalled = false;
  const middleware = createAuthApiKey(async () => null);
  await middleware(req, res as any, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('middleware API key meneruskan identitas integrasi aktif', async () => {
  const client = { id: 7, name: 'Smart Tag', scopes: ['orders:read'] };
  const req: any = { headers: {}, header: () => 'ngl_live_valid' };
  const res = fakeResponse();
  let nextCalled = false;
  const middleware = createAuthApiKey(async (hash) => {
    assert.equal(hash, hashApiKey('ngl_live_valid'));
    return client;
  }, 'orders:read');
  await middleware(req, res as any, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.apiClient, client);
});

test('middleware API key menolak integrasi tanpa scope endpoint', async () => {
  const req: any = { headers: {}, header: () => 'ngl_live_valid' };
  const res = fakeResponse();
  let nextCalled = false;
  const middleware = createAuthApiKey(
    async () => ({ id: 7, name: 'Read Only', scopes: ['orders:read'] }),
    'orders:write'
  );
  await middleware(req, res as any, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /izin/i);
  assert.equal(nextCalled, false);
});
