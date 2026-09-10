import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderBellDeduper, getOrderBellType, subscribeToOrderEvents } from '../src/lib/orderEvents.js';

test('pesanan reguler langsung membunyikan bell meski kapitalisasi status pembayaran berbeda', () => {
  assert.equal(
    getOrderBellType('new_order', { id: '1', payment_status: 'lunas', status: 'Menunggu' }),
    'new_order'
  );
  assert.equal(
    getOrderBellType('new_order', { id: '2', payment_status: 'BELUM_BAYAR', status: 'MENUNGGU' }),
    'new_order'
  );
});

test('pesanan belum dibayar tetap membunyikan bell dan langsung masuk dapur', () => {
  assert.equal(
    getOrderBellType('new_order', { id: '3', payment_status: 'belum_bayar', status: 'Menunggu' }),
    'new_order'
  );
});

test('verifikasi pembayaran tidak membunyikan bell kedua untuk pesanan yang sudah masuk dapur', () => {
  assert.equal(
    getOrderBellType('order_updated', { id: '3', payment_status: 'lunas', status: 'Menunggu' }),
    null
  );
});

test('pesanan siap membunyikan chime siap diambil', () => {
  assert.equal(
    getOrderBellType('order_updated', { id: '4', payment_status: 'lunas', status: 'Siap' }),
    'ready'
  );
});

test('pelunasan PO sebelum waktu penyajian tidak membunyikan bell dapur', () => {
  assert.equal(
    getOrderBellType('order_updated', {
      id: 'po-1', payment_status: 'lunas', status: 'Menunggu',
      order_type: 'preorder', fulfillment_at: '2099-01-01T10:00:00+07:00'
    }),
    null
  );
});

test('bell global hanya berbunyi sekali per pesanan dan jenis suara', () => {
  const deduper = createOrderBellDeduper();
  assert.equal(deduper.shouldRing('new_order', 'order-1'), true);
  assert.equal(deduper.shouldRing('new_order', 'order-1'), false);
  assert.equal(deduper.shouldRing('ready', 'order-1'), true);
  assert.equal(deduper.shouldRing('ready', 'order-1'), false);
  assert.equal(deduper.shouldRing('new_order', 'order-2'), true);
});

test('cleanup listener pesanan hanya melepas handler milik subscriber', () => {
  const calls: Array<{ method: 'on' | 'off'; event: string; handler: (payload: unknown) => void }> = [];
  const socket = {
    on(event: string, handler: (payload: unknown) => void) {
      calls.push({ method: 'on', event, handler });
      return socket;
    },
    off(event: string, handler: (payload: unknown) => void) {
      calls.push({ method: 'off', event, handler });
      return socket;
    }
  };

  const onNewOrder = () => undefined;
  const onOrderUpdated = () => undefined;
  const cleanup = subscribeToOrderEvents(socket, { onNewOrder, onOrderUpdated });

  cleanup();

  assert.deepEqual(
    calls.map(call => ({ method: call.method, event: call.event, sameNew: call.handler === onNewOrder, sameUpdated: call.handler === onOrderUpdated })),
    [
      { method: 'on', event: 'new_order', sameNew: true, sameUpdated: false },
      { method: 'on', event: 'order_updated', sameNew: false, sameUpdated: true },
      { method: 'off', event: 'new_order', sameNew: true, sameUpdated: false },
      { method: 'off', event: 'order_updated', sameNew: false, sameUpdated: true }
    ]
  );
});
