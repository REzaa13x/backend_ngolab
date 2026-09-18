import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderItemInsert,
  externalOrderPaymentState,
  normalizeExternalOrderItems,
  orderItemSchemaChanges,
} from '../src/lib/orderItems.js';

test('insert order item mengisi item_name dan menu_name ketika kedua kolom tersedia', () => {
  const insert = buildOrderItemInsert(
    ['id', 'order_id', 'menu_id', 'item_name', 'menu_name', 'quantity', 'price'],
    { orderId: 'order-1', menuId: 'menu-1', name: 'Kopi Susu', quantity: 2, price: 12000 },
  );

  assert.match(insert.sql, /item_name, menu_name/);
  assert.deepEqual(insert.params, ['order-1', 'menu-1', 'Kopi Susu', 'Kopi Susu', 2, 12000]);
});

test('insert order item tetap kompatibel dengan skema yang hanya punya salah satu kolom nama', () => {
  const legacy = buildOrderItemInsert(
    ['order_id', 'menu_id', 'menu_name', 'quantity', 'price'],
    { orderId: 'order-1', menuId: null, name: 'Teh', quantity: 1, price: 5000 },
  );
  assert.match(legacy.sql, /menu_name/);
  assert.doesNotMatch(legacy.sql, /item_name/);
  assert.deepEqual(legacy.params, ['order-1', null, 'Teh', 1, 5000]);

  const current = buildOrderItemInsert(
    ['order_id', 'menu_id', 'item_name', 'quantity', 'price'],
    { orderId: 'order-2', menuId: null, name: 'Roti', quantity: 1, price: 8000 },
  );
  assert.match(current.sql, /item_name/);
  assert.doesNotMatch(current.sql, /menu_name/);
});

test('insert PO menyertakan preorder_item_id bila diminta dan tersedia', () => {
  const insert = buildOrderItemInsert(
    ['order_id', 'menu_id', 'preorder_item_id', 'item_name', 'menu_name', 'quantity', 'price'],
    { orderId: 'po-1', menuId: null, preorderItemId: 'item-po', name: 'Lunch Box', quantity: 3, price: 25000 },
  );

  assert.match(insert.sql, /preorder_item_id/);
  assert.deepEqual(insert.params, ['po-1', null, 'item-po', 'Lunch Box', 'Lunch Box', 3, 25000]);
});

test('payload pesanan eksternal menolak nama, quantity, dan price yang tidak valid', () => {
  assert.throws(() => normalizeExternalOrderItems([{ quantity: 1, price: 1000 }]), /nama item/i);
  assert.throws(() => normalizeExternalOrderItems([{ name: 'Kopi', quantity: 0, price: 1000 }]), /quantity/i);
  assert.throws(() => normalizeExternalOrderItems([{ name: 'Kopi', quantity: 1.5, price: 1000 }]), /quantity/i);
  assert.throws(() => normalizeExternalOrderItems([{ name: 'Kopi', quantity: 1, price: -1 }]), /price/i);
});

test('payload pesanan eksternal dinormalisasi sebelum ditulis', () => {
  assert.deepEqual(
    normalizeExternalOrderItems([{ id: 7, name: '  Kopi Susu  ', quantity: '2', price: '12000' }]),
    [{ menuId: '7', name: 'Kopi Susu', quantity: 2, price: 12000 }],
  );
});

test('pesanan eksternal selalu menunggu verifikasi dan tidak mengklaim member dari payload', () => {
  assert.deepEqual(externalOrderPaymentState(), {
    userId: null,
    paymentStatus: 'belum_bayar',
    orderStatus: 'menunggu',
    amountPaid: 0,
  });
});

test('migrasi menambah kolom kompatibilitas dan melonggarkan kolom NOT NULL tanpa default', () => {
  const changes = orderItemSchemaChanges([
    { Field: 'order_id', Null: 'NO', Default: null },
    { Field: 'menu_name', Null: 'NO', Default: null },
  ]);

  assert.ok(changes.some(sql => /ADD COLUMN item_name/i.test(sql)));
  // menu_name NOT NULL DEFAULT NULL must be relaxed, otherwise the cashier app cannot INSERT
  // when it only supplies item_name.
  assert.ok(changes.some(sql => /MODIFY COLUMN menu_name VARCHAR\(200\) NULL DEFAULT NULL/i.test(sql)));
  assert.ok(changes.some(sql => /UPDATE order_items SET item_name = menu_name/i.test(sql)));
});

test('migrasi tidak menyentuh kolom bersama yang sudah nullable dan punya default', () => {
  const changes = orderItemSchemaChanges([
    { Field: 'item_name', Null: 'YES', Default: null },
    { Field: 'menu_name', Null: 'YES', Default: 'x' },
  ]);

  assert.equal(changes.some(sql => /MODIFY COLUMN/i.test(sql)), false);
  assert.equal(changes.some(sql => /ADD COLUMN/i.test(sql)), false);
});
