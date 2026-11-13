import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicStaffRole, PUBLIC_STAFF_ROLES } from '../src/lib/staffRegistration.js';

test('registrasi publik hanya menerima peran pegawai yang diizinkan', () => {
  assert.deepEqual([...PUBLIC_STAFF_ROLES], ['Kasir', 'Koki', 'Support']);
  for (const role of PUBLIC_STAFF_ROLES) assert.equal(isPublicStaffRole(role), true);
});

test('peran pelanggan dan admin tidak boleh didaftarkan sendiri', () => {
  assert.equal(isPublicStaffRole('Pelanggan'), false);
  assert.equal(isPublicStaffRole('Super Admin'), false);
  assert.equal(isPublicStaffRole('Admin'), false);
  assert.equal(isPublicStaffRole('kasir'), false);
  assert.equal(isPublicStaffRole(''), false);
  assert.equal(isPublicStaffRole(undefined), false);
  assert.equal(isPublicStaffRole(null), false);
});
