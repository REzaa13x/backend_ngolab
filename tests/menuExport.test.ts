import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { makeMenuWorkbook } from '../src/lib/menuExport.js';

test('separates selected outlet items by category in serialized sheets', async () => {
  const base = { outlet: 'coworking' as const, price: 100, description: '=literal', isActive: true, inStock: true };
  const book = await makeMenuWorkbook([
    { ...base, name: 'Snack', category: 'Retail' },
    { ...base, name: 'Rice', category: 'Makanan Berat' },
    { ...base, name: 'Other outlet', outlet: 'ngolab', category: 'Retail' },
  ], 'coworking');
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  const retail = restored.getWorksheet('Retail')!;
  const food = restored.getWorksheet('Makanan Berat')!;
  assert.ok(retail);
  assert.ok(food);
  assert.equal(retail.getCell('A4').value, 'Snack');
  assert.equal(retail.getCell('A5').value, null);
  assert.equal(food.getCell('A4').value, 'Rice');
  assert.equal(food.getCell('A5').value, null);
  assert.equal(retail.getCell('F4').type, ExcelJS.ValueType.String);
  assert.equal(retail.getCell('A2').value, 'Outlet: Coworking | 1 menu');
});

test('sanitizes and disambiguates category sheet names without losing categories', async () => {
  const categories = ['Menu', 'menu', 'History', 'A/B', 'A?B', 'x'.repeat(40) + '1', 'x'.repeat(40) + '2', '', "'Quoted'"];
  const items = categories.map((category, i) => ({ outlet: 'ngolab' as const, name: `Item ${i}`, category, price: 1, description: '', isActive: true, inStock: true }));
  const book = await makeMenuWorkbook(items, 'ngolab');
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  assert.equal(restored.worksheets.length, categories.length + 1);
  const names = restored.worksheets.map(sheet => sheet.name);
  assert.equal(new Set(names.map(name => name.toLowerCase())).size, names.length);
  for (const name of names) {
    assert.ok(name.length > 0 && name.length <= 31);
    assert.doesNotMatch(name, /[\\/*?:\[\]\x00-\x1f]/);
    assert.doesNotMatch(name, /^'|'$/);
  }
  for (const [i, sheet] of restored.worksheets.slice(1).entries()) {
    assert.equal(sheet.getCell('A4').value, `Item ${i}`);
    assert.equal(sheet.getCell('A5').value, null);
  }
});

test('XLSX exports only selected outlet with numeric prices and literal untrusted text', async () => {
  const items = [
    { id: '1', outlet: 'ngolab' as const, name: '=1+1', category: '+Makanan', price: 25000, description: '@test', isActive: true, inStock: true },
    { id: '2', outlet: 'coworking' as const, name: 'Secret', category: 'Retail', price: 10, description: '', isActive: false, inStock: false },
  ];
  const book = await makeMenuWorkbook(items, 'ngolab');
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  const sheet = restored.getWorksheet('Menu')!;
  assert.equal(sheet.getCell('A4').value, '=1+1');
  assert.equal(sheet.getCell('A4').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('B4').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('C4').value, 25000);
  assert.equal(sheet.getCell('F4').value, '@test');
  assert.equal(sheet.getCell('A5').value, null);
  assert.equal(sheet.getCell('A2').value, 'Outlet: Ngolab | 1 menu');
  assert.equal(sheet.views[0].state, 'frozen');
  assert.ok(sheet.autoFilter);
});
