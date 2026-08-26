import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail } from '../src/lib/auth.js';

test('email dinormalisasi agar pemeriksaan unik dan login konsisten', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
  assert.equal(normalizeEmail(undefined), null);
  assert.equal(normalizeEmail(''), null);
});
