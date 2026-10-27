import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { historyExportRows, makeHistoryWorkbook, makeHistoryPdf } from '../src/lib/salesHistoryExport.js';

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
