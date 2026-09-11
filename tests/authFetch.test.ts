import test from 'node:test';
import assert from 'node:assert/strict';
import { withAuthHeaders } from '../src/lib/authFetch.js';

test('header autentikasi mempertahankan header lama dan menambah Bearer token', () => {
  const headers = withAuthHeaders({ 'Content-Type': 'application/json' }, 'abc123');
  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.equal(headers.get('Authorization'), 'Bearer abc123');
});

test('header autentikasi tidak membuat Bearer kosong', () => {
  const headers = withAuthHeaders(undefined, '');
  assert.equal(headers.has('Authorization'), false);
});
