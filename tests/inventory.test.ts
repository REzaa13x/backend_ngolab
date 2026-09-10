import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateRecipeNeeds,
  calculateMovement,
  getStockLevel,
  normalizeBarcode
} from '../src/lib/inventory.js';

test('status stok membedakan habis, kritis, menipis, dan aman', () => {
  assert.equal(getStockLevel(0, 10, 3), 'out');
  assert.equal(getStockLevel(2, 10, 3), 'critical');
  assert.equal(getStockLevel(8, 10, 3), 'low');
  assert.equal(getStockLevel(11, 10, 3), 'safe');
});

test('restock mengonversi satuan pembelian ke satuan dasar', () => {
  assert.deepEqual(calculateMovement('purchase', 2, 12, 10), { delta: 24, after: 34 });
});

test('barang rusak mengurangi stok dan tidak boleh membuat stok negatif', () => {
  assert.deepEqual(calculateMovement('waste', 3, 1, 10), { delta: -3, after: 7 });
  assert.throws(() => calculateMovement('waste', 11, 1, 10), /tidak mencukupi/i);
});

test('stock opname memakai hasil hitung fisik sebagai stok baru', () => {
  assert.deepEqual(calculateMovement('stock_opname', 7, 1, 10), { delta: -3, after: 7 });
});

test('kebutuhan resep digabung berdasarkan bahan untuk seluruh item pesanan', () => {
  const needs = aggregateRecipeNeeds(
    [
      { name: 'Mi Yamin Bakso', quantity: 2 },
      { name: 'Teh Botol', quantity: 3 }
    ],
    [
      { menu_name: 'Mi Yamin Bakso', ingredient_id: 'mie', amount: 1 },
      { menu_name: 'Mi Yamin Bakso', ingredient_id: 'bakso', amount: 3 },
      { menu_name: 'Teh Botol', ingredient_id: 'teh-botol', amount: 1 }
    ]
  );
  assert.deepEqual(needs, [
    { ingredientId: 'bakso', quantity: 6 },
    { ingredientId: 'mie', quantity: 2 },
    { ingredientId: 'teh-botol', quantity: 3 }
  ]);
});

test('barcode dinormalisasi tanpa spasi tetapi mempertahankan angka nol awal', () => {
  assert.equal(normalizeBarcode(' 001234567890 '), '001234567890');
  assert.throws(() => normalizeBarcode(''), /barcode/i);
});
