import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSoldMenus, orderItemsSubtotal, reconcileOrderTotal, soldMenusTotals, summarizeTotalValidation } from '../src/lib/menuSales.js';

const order = (id: string, total: number, items: { name: string; quantity: number; price: number }[]) => ({
  invoice_number: `INV-${id}`, total_price: total, items,
});

test('rekap menu terjual menjumlahkan qty dan pendapatan per nama menu', () => {
  const rows = aggregateSoldMenus([
    order('1', 50000, [{ name: 'Nasi Goreng', quantity: 2, price: 20000 }, { name: 'Es Teh', quantity: 1, price: 10000 }]),
    order('2', 20000, [{ name: 'nasi goreng', quantity: 1, price: 20000 }]),
  ]);
  const nasi = rows.find(row => row.name.toLowerCase() === 'nasi goreng')!;
  assert.equal(nasi.quantity, 3);
  assert.equal(nasi.revenue, 60000);
  assert.equal(nasi.orders, 2);
  assert.deepEqual(soldMenusTotals(rows), { quantity: 4, revenue: 70000 });
});

test('rekap menu diurutkan dari yang paling laku', () => {
  const rows = aggregateSoldMenus([
    order('1', 30000, [{ name: 'A', quantity: 1, price: 10000 }, { name: 'B', quantity: 3, price: 6666 }]),
  ]);
  assert.deepEqual(rows.map(row => row.name), ['B', 'A']);
});

test('total pesanan yang cocok dengan rincian item ditandai cocok', () => {
  const check = reconcileOrderTotal(order('1', 50000, [{ name: 'A', quantity: 2, price: 20000 }, { name: 'B', quantity: 1, price: 10000 }]))!;
  assert.equal(orderItemsSubtotal(order('1', 0, [{ name: 'A', quantity: 2, price: 20000 }])), 40000);
  assert.equal(check.itemSubtotal, 50000);
  assert.equal(check.difference, 0);
  assert.equal(check.matches, true);
  assert.equal(check.itemCount, 3);
});

test('selisih total pesanan dilaporkan apa adanya, bukan dibulatkan diam-diam', () => {
  const check = reconcileOrderTotal(order('9', 45000, [{ name: 'A', quantity: 2, price: 20000 }]))!;
  assert.equal(check.matches, false);
  assert.equal(check.difference, 5000);

  const summary = summarizeTotalValidation([
    order('1', 40000, [{ name: 'A', quantity: 2, price: 20000 }]),
    order('2', 45000, [{ name: 'B', quantity: 2, price: 20000 }]),
    { invoice_number: 'INV-3', total_price: 15000, items: [] },
  ]);
  assert.equal(summary.checked, 2);
  assert.equal(summary.matched, 1);
  assert.equal(summary.mismatched, 1);
  assert.equal(summary.withoutItems, 1);
  assert.equal(summary.orderTotal, 85000);
  assert.equal(summary.itemSubtotal, 80000);
  assert.equal(summary.difference, 5000);
});

test('pesanan tanpa rincian item tidak dianggap cocok', () => {
  assert.equal(reconcileOrderTotal({ invoice_number: 'INV-X', total_price: 10000 }), null);
  const summary = summarizeTotalValidation([{ invoice_number: 'INV-X', total_price: 10000 }]);
  assert.equal(summary.checked, 0);
  assert.equal(summary.withoutItems, 1);
});
