import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregatePreorderItems,
  canCancelPreorder,
  canUseGenericOrderStatus,
  canMarkPreorderPickedUp,
  canMarkPreorderNoShow,
  getPreorderStatus
} from '../src/lib/preorderRules.js';

const campaign = {
  is_active: 1,
  order_start_at: '2026-09-01T08:00:00+07:00',
  order_deadline_at: '2026-09-03T18:00:00+07:00',
  service_at: '2026-09-05T10:00:00+07:00'
};

test('status PO mengikuti periode pemesanan dan waktu penyajian', () => {
  assert.equal(getPreorderStatus(campaign, new Date('2026-08-31T10:00:00+07:00')), 'upcoming');
  assert.equal(getPreorderStatus(campaign, new Date('2026-09-01T08:00:00+07:00')), 'open');
  assert.equal(getPreorderStatus(campaign, new Date('2026-09-03T18:00:00+07:00')), 'closed');
  assert.equal(getPreorderStatus(campaign, new Date('2026-09-05T10:00:00+07:00')), 'service_day');
});

test('campaign nonaktif selalu draft', () => {
  assert.equal(getPreorderStatus({ ...campaign, is_active: 0 }, new Date('2026-09-02T10:00:00+07:00')), 'draft');
});

test('pembatalan PO hanya diperbolehkan sebelum deadline dan sebelum terminal', () => {
  const beforeDeadline = new Date('2026-09-03T17:59:59+07:00');
  assert.equal(canCancelPreorder({ ...campaign, preorder_status: 'reserved' }, beforeDeadline), true);
  assert.equal(canCancelPreorder({ ...campaign, preorder_status: 'picked_up' }, beforeDeadline), false);
  assert.equal(canCancelPreorder({ ...campaign, preorder_status: 'no_show' }, beforeDeadline), false);
  assert.equal(canCancelPreorder({ ...campaign, preorder_status: 'cancelled' }, beforeDeadline), false);
  assert.equal(canCancelPreorder(campaign, new Date('2026-09-03T18:00:00+07:00')), false);
});

test('endpoint status umum tidak dapat membatalkan atau menghidupkan kembali PO terminal', () => {
  assert.equal(canUseGenericOrderStatus({ order_type: 'regular' }, 'selesai'), true);
  assert.equal(canUseGenericOrderStatus({ order_type: 'preorder', preorder_status: 'reserved' }, 'sedang_diproses'), true);
  assert.equal(canUseGenericOrderStatus({ order_type: 'preorder', preorder_status: 'reserved' }, 'dibatalkan'), false);
  assert.equal(canUseGenericOrderStatus({ order_type: 'preorder', preorder_status: 'cancelled' }, 'menunggu'), false);
  assert.equal(canUseGenericOrderStatus({ order_type: 'preorder', preorder_status: 'picked_up' }, 'siap'), false);
  assert.equal(canUseGenericOrderStatus({ order_type: 'preorder', preorder_status: 'no_show' }, 'selesai'), false);
});

test('pesanan hanya dapat ditandai diambil setelah lunas', () => {
  assert.equal(canMarkPreorderPickedUp({ payment_status: 'lunas', preorder_status: 'reserved' }), true);
  assert.equal(canMarkPreorderPickedUp({ payment_status: 'belum_bayar', preorder_status: 'reserved' }), false);
  assert.equal(canMarkPreorderPickedUp({ payment_status: 'lunas', preorder_status: 'cancelled' }), false);
});

test('no-show hanya dapat ditandai setelah waktu pengambilan', () => {
  const order = { fulfillment_at: '2026-09-05T10:00:00+07:00', preorder_status: 'reserved' };
  assert.equal(canMarkPreorderNoShow(order, new Date('2026-09-05T09:59:59+07:00')), false);
  assert.equal(canMarkPreorderNoShow(order, new Date('2026-09-05T10:00:00+07:00')), true);
  assert.equal(canMarkPreorderNoShow({ ...order, preorder_status: 'picked_up' }, new Date('2026-09-05T11:00:00+07:00')), false);
});

test('item PO duplikat digabung sebelum pemeriksaan kuota', () => {
  assert.deepEqual(
    aggregatePreorderItems([
      { id: 'menu-b', quantity: 2 },
      { id: 'menu-a', quantity: 1 },
      { id: 'menu-b', quantity: 3 }
    ]),
    [
      { id: 'menu-a', quantity: 1 },
      { id: 'menu-b', quantity: 5 }
    ]
  );
});

test('item PO dengan id atau jumlah tidak valid ditolak', () => {
  assert.throws(() => aggregatePreorderItems([{ id: '', quantity: 1 }]), /tidak valid/);
  assert.throws(() => aggregatePreorderItems([{ id: 'menu-a', quantity: 0 }]), /tidak valid/);
  assert.throws(() => aggregatePreorderItems([{ id: 'menu-a', quantity: 1.5 }]), /tidak valid/);
});
