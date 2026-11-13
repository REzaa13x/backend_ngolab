import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { historyExportRows, makeHistoryWorkbook, makeHistoryPdf } from '../src/lib/salesHistoryExport.js';

const withItems = {
  invoice_number: 'INV-001', customer_name: 'Ani', source: 'ngolab', total_price: 50000,
  payment_status: 'lunas', payment_method: 'Tunai', status: 'selesai', created_at: '2026-01-04T17:00:00Z',
  items: [{ name: 'Nasi Goreng', quantity: 2, price: 20000 }, { name: 'Es Teh', quantity: 1, price: 10000 }],
};

test('Excel memuat data terfilter, angka, waktu WIB dan peringatan sumber', async () => {
  const orders = [{ invoice_number: '=1+1', customer_name: 'Ani', source: 'ngolab', total_price: 50000, payment_status: 'lunas', payment_method: 'Tunai', status: 'selesai', created_at: '2026-01-04T17:00:00Z' }];
  assert.match(historyExportRows(orders)[0][3], /05\/01\/26.*WIB/);
  const book = await makeHistoryWorkbook(orders, 'DATA TIDAK LENGKAP: Smart Tag tidak tersedia');
  const bytes = await book.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(bytes);
  const sheet = restored.getWorksheet('Riwayat Transaksi')!;
  assert.match(String(sheet.getCell('A2').value), /DATA TIDAK LENGKAP/);
  assert.equal(sheet.getCell('A5').value, '=1+1');
  assert.equal(sheet.getCell('H5').value, 50000);
  assert.equal(sheet.getCell('A5').type, ExcelJS.ValueType.String);
});

test('PDF terbentuk dengan baris transaksi dan peringatan sumber', () => {
  const doc = makeHistoryPdf([{ invoice_number: 'INV-123', customer_name: 'Ani', source: 'ngolab', total_price: 50000, payment_status: 'lunas', payment_method: 'Tunai', status: 'selesai', created_at: '2026-01-04T17:00:00Z' }], 'DATA TIDAK LENGKAP: Smart Tag tidak tersedia');
  const pdf = doc.output();
  assert.ok(pdf.startsWith('%PDF-'));
  assert.match(pdf, /INV-123/);
  assert.match(pdf, /DATA TIDAK LENGKAP/);
});

test('Excel menambahkan sheet Menu Terjual, Rincian Item, dan Validasi Total', async () => {
  const book = await makeHistoryWorkbook([withItems], 'Periode: Harian (05 Jan 2026)');
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());

  const sold = restored.getWorksheet('Menu Terjual')!;
  assert.ok(sold, 'sheet Menu Terjual harus ada');
  // Baris 1 judul, 2 deskripsi, 3 ringkasan, 4 header, 5+ data.
  assert.equal(sold.getCell('A5').value, 'Nasi Goreng');
  assert.equal(sold.getCell('B5').value, 2);
  assert.equal(sold.getCell('C5').value, 40000);
  assert.equal(sold.getCell('A6').value, 'Es Teh');
  assert.equal(sold.getCell('A7').value, 'TOTAL');
  assert.equal(sold.getCell('B7').value, 3);
  assert.equal(sold.getCell('C7').value, 50000);

  const detail = restored.getWorksheet('Rincian Item')!;
  assert.ok(detail, 'sheet Rincian Item harus ada');
  assert.equal(detail.getCell('A5').value, 'INV-001');
  assert.equal(detail.getCell('D5').value, 'Nasi Goreng');
  assert.equal(detail.getCell('G5').value, 40000);
  assert.equal(detail.getCell('D6').value, 'Es Teh');
  assert.equal(detail.getCell('G6').value, 10000);

  const check = restored.getWorksheet('Validasi Total')!;
  assert.ok(check, 'sheet Validasi Total harus ada');
  assert.equal(check.getCell('A5').value, 'INV-001');
  assert.equal(check.getCell('B5').value, 50000);
  assert.equal(check.getCell('C5').value, 50000);
  assert.equal(check.getCell('D5').value, 0);
  assert.equal(check.getCell('E5').value, 'Cocok');
});

test('PDF memuat halaman menu terjual, rincian item, dan validasi total', () => {
  const doc = makeHistoryPdf([withItems], 'Periode: Harian (05 Jan 2026)');
  const pdf = doc.output();
  assert.match(pdf, /MENU TERJUAL/);
  assert.match(pdf, /RINCIAN ITEM PER TRANSAKSI/);
  assert.match(pdf, /VALIDASI TOTAL PESANAN/);
  assert.match(pdf, /Nasi Goreng/);
  assert.ok(doc.getNumberOfPages() >= 4);
});
