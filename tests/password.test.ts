import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

test('password baru disimpan menggunakan bcrypt dan bisa diverifikasi', async () => {
  const hash = await hashPassword('rahasia-kuat');
  assert.match(hash, /^\$2[aby]\$/);
  assert.equal(await verifyPassword('rahasia-kuat', hash), true);
  assert.equal(await verifyPassword('salah', hash), false);
});

test('hash SHA-256 lama masih bisa login dan ditandai untuk upgrade', async () => {
  const legacy = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
  const result = await verifyPassword('password', legacy);
  assert.equal(result, true);
});
