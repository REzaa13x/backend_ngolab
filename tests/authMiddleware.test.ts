import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthIdentity, issueAuthToken } from '../src/lib/authToken.js';
import { createRequireAuthenticated, createRequireRoles } from '../src/middleware/authSession.js';

const secret = 'test-secret-that-is-long-enough';
process.env.AUTH_TOKEN_SECRET = secret;
const keepIdentity = async (identity: AuthIdentity) => identity;

function fakeResponse() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; }
  };
}

test('middleware menolak request tanpa Bearer token', async () => {
  const req: any = { headers: {} };
  const res = fakeResponse();
  let nextCalled = false;
  await createRequireAuthenticated(keepIdentity)(req, res as any, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('middleware role menolak pelanggan dari endpoint staf', async () => {
  const token = issueAuthToken({ id: 'u-1', name: 'User', role: 'Pelanggan' }, { secret });
  const req: any = { headers: { authorization: `Bearer ${token}` } };
  const res = fakeResponse();
  let nextCalled = false;
  await createRequireRoles(keepIdentity, 'Super Admin', 'Kasir')(req, res as any, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('middleware role meneruskan identitas staf yang masih aktif', async () => {
  const identity = { id: 's-1', name: 'Kasir A', role: 'Kasir' };
  const token = issueAuthToken(identity, { secret });
  const req: any = { headers: { authorization: `Bearer ${token}` } };
  const res = fakeResponse();
  let nextCalled = false;
  await createRequireRoles(keepIdentity, 'Super Admin', 'Kasir')(req, res as any, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.auth, identity);
});

test('middleware menolak token staf yang akun aktifnya sudah hilang', async () => {
  const token = issueAuthToken({ id: 's-1', name: 'Admin Lama', role: 'Super Admin' }, { secret });
  const req: any = { headers: { authorization: `Bearer ${token}` } };
  const res = fakeResponse();
  let nextCalled = false;
  await createRequireRoles(async () => null, 'Super Admin')(req, res as any, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('middleware memakai role terbaru dari database, bukan role lama dalam token', async () => {
  const token = issueAuthToken({ id: 's-1', name: 'Admin Lama', role: 'Super Admin' }, { secret });
  const req: any = { headers: { authorization: `Bearer ${token}` } };
  const res = fakeResponse();
  let nextCalled = false;
  const demotedLookup = async () => ({ id: 's-1', name: 'Admin Lama', role: 'Support' });
  await createRequireRoles(demotedLookup, 'Super Admin')(req, res as any, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});
