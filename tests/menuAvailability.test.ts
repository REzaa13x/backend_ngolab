import test from 'node:test';
import assert from 'node:assert/strict';
import { getEffectiveMenuAvailability, getMenuAvailabilityReason } from '../src/lib/menuAvailability.js';

test('menu tersedia hanya jika aktif, tidak dinonaktifkan manual, dan inventori tersedia', () => {
  assert.equal(getEffectiveMenuAvailability(true, 'auto', true), true);
  assert.equal(getEffectiveMenuAvailability(false, 'auto', true), false);
  assert.equal(getEffectiveMenuAvailability(true, 'force_off', true), false);
  assert.equal(getEffectiveMenuAvailability(true, 'auto', false), false);
});

test('menu tidak pernah dapat dipaksa aktif saat inventori habis', () => {
  assert.equal(getEffectiveMenuAvailability(true, 'force_on' as any, false), false);
});

test('alasan status membedakan arsip, nonaktif manual, dan stok habis', () => {
  assert.equal(getMenuAvailabilityReason({ isActive: false, override: 'auto', inventoryAvailable: true }), 'archived');
  assert.equal(getMenuAvailabilityReason({ isActive: true, override: 'force_off', inventoryAvailable: true }), 'manual');
  assert.equal(getMenuAvailabilityReason({ isActive: true, override: 'auto', inventoryAvailable: false }), 'inventory');
  assert.equal(getMenuAvailabilityReason({ isActive: true, override: 'auto', inventoryAvailable: true }), 'available');
});
