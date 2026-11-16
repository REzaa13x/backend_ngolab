import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { makeHistoryWorkbook, makeHistoryPdf } from '../src/lib/salesHistoryExport.js';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

const jan5 = {
  invoice_number: 'INV-001', customer_name: 'Ani', source: 'ngolab', total_price: 50000,
  payment_status: 'lunas', payment_method: 'Tunai', status: 'selesai', created_at: '2026-01-05T02:00:00Z',
  items: [{ name: 'Nasi Goreng', quantity: 2, price: 20000 }, { name: 'Es Teh', quantity: 1, price: 10000 }],
};
const jan6 = {
  invoice_number: 'INV-002', customer_name: 'Budi', source: 'ngolab', total_price: 30000,
  payment_status: 'lunas', payment_method: 'Tunai', status: 'selesai', created_at: '2026-01-06T03:00:00Z',
  items: [{ name: 'Mie', quantity: 2, price: 15000 }],
};
const jan12 = {
  invoice_number: 'INV-003', customer_name: 'Citra', source: 'ngolab', total_price: 40000,
  payment_status: 'lunas', payment_method: 'QRIS', status: 'selesai', created_at: '2026-01-12T02:00:00Z',
  items: [{ name: 'Nasi Goreng', quantity: 1, price: 40000 }],
};

const orders = [jan5, jan6, jan12];
const options = { period: 'bulan' as const, range: { start: '2026-01-01', end: '2026-01-31' } };

test('Excel bulanan memuat sheet Ringkasan, Rekap Harian, Menu per Hari, Rekap Mingguan, Rincian Harian per Minggu, Bulanan, Tahunan', async () => {
  const book = await makeHistoryWorkbook(orders, 'Periode: Bulanan (Jan 2026)', options);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  const names = restored.worksheets.map(sheet => sheet.name);
  for (const expected of ['Ringkasan', 'Rekap Harian', 'Menu per Hari', 'Rekap Mingguan', 'Rincian Harian per Minggu', 'Rekap Bulanan', 'Rekap Tahunan']) {
    assert.ok(names.includes(expected), `sheet ${expected} harus ada, dapat: ${names.join(', ')}`);
  }
});

test('sheet Rekap Harian menulis tanggal, hari, dan pendapatan per hari', async () => {
  const book = await makeHistoryWorkbook(orders, 'Periode: Bulanan (Jan 2026)', options);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  const sheet = restored.getWorksheet('Rekap Harian')!;
  assert.equal(sheet.getCell('A5').value, '2026-01-05');
  assert.equal(sheet.getCell('B5').value, 'Senin');
  assert.equal(sheet.getCell('E5').value, 50000);
  assert.equal(sheet.getCell('F5').value, 'Nasi Goreng');
  assert.equal(sheet.getCell('A6').value, '2026-01-06');
  assert.equal(sheet.getCell('B6').value, 'Selasa');
});

test('sheet Rekap Mingguan menyebut minggu ke-1 sampai berapa tanggal', async () => {
  const book = await makeHistoryWorkbook(orders, 'Periode: Bulanan (Jan 2026)', options);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  const sheet = restored.getWorksheet('Rekap Mingguan')!;
  assert.equal(sheet.getCell('A5').value, 'Minggu ke-1');
  // 01 Jan 2026 hari Kamis → minggu ke-1 mulai Senin 29 Des 2025.
  assert.equal(sheet.getCell('B5').value, '29 Des 2025 – 04 Jan 2026');
  assert.equal(sheet.getCell('C5').value, '2025-12-29');
  assert.equal(sheet.getCell('D5').value, '2026-01-04');
  // Minggu ke-2 memuat 05–11 Jan dengan tiga transaksi.
  assert.equal(sheet.getCell('A6').value, 'Minggu ke-2');
  assert.equal(sheet.getCell('B6').value, '05 Jan 2026 – 11 Jan 2026');
  assert.equal(sheet.getCell('E6').value, 2);
  assert.equal(sheet.getCell('G6').value, 80000);
});

test('sheet Menu per Hari menjawab makanan yang laku hari Senin–Jumat', async () => {
  const book = await makeHistoryWorkbook(orders, 'Periode: Bulanan (Jan 2026)', options);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  const sheet = restored.getWorksheet('Menu per Hari')!;
  const rows: string[][] = [];
  sheet.eachRow((row, index) => {
    if (index < 5) return;
    rows.push([String(row.getCell(1).value), String(row.getCell(2).value), String(row.getCell(3).value)]);
  });
  assert.ok(rows.some(row => row[0] === 'Senin' && row[1] === 'Nasi Goreng' && row[2] === '3'));
  assert.ok(rows.some(row => row[0] === 'Selasa' && row[1] === 'Mie' && row[2] === '2'));
  assert.ok(rows.some(row => row[0] === 'Rabu' && row[1] === '(tidak ada transaksi)'));
});

test('sheet Rincian Harian per Minggu menautkan tiap tanggal ke minggunya', async () => {
  const book = await makeHistoryWorkbook(orders, 'Periode: Bulanan (Jan 2026)', options);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  const sheet = restored.getWorksheet('Rincian Harian per Minggu')!;
  const rows: string[][] = [];
  sheet.eachRow((row, index) => {
    if (index < 5) return;
    rows.push([String(row.getCell(1).value), String(row.getCell(3).value), String(row.getCell(4).value)]);
  });
  assert.ok(rows.some(row => row[0] === 'Minggu ke-2' && row[1] === '2026-01-05' && row[2] === 'Senin'));
  assert.ok(rows.some(row => row[0] === 'Minggu ke-3' && row[1] === '2026-01-12' && row[2] === 'Senin'));
});

test('sheet Ringkasan memuat rata-rata harian, hari terbaik, dan menu terlaris', async () => {
  const book = await makeHistoryWorkbook(orders, 'Periode: Bulanan (Jan 2026)', options);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  const sheet = restored.getWorksheet('Ringkasan')!;
  const labels = new Map<string, unknown>();
  sheet.eachRow(row => {
    const key = String(row.getCell(1).value ?? '');
    if (key) labels.set(key, row.getCell(2).value);
  });
  assert.equal(labels.get('Transaksi lunas'), 3);
  assert.equal(labels.get('Pendapatan lunas (Rp)'), 120000);
  assert.equal(labels.get('Jumlah hari ada transaksi'), 3);
  assert.equal(labels.get('Rata-rata pendapatan per hari (Rp)'), 40000);
  assert.match(String(labels.get('Hari terbaik')), /05 Jan 2026.*Senin/);
  assert.match(String(labels.get('Menu terlaris')), /Nasi Goreng \(3 item\)/);
});

test('PDF memuat halaman rekap harian, mingguan, menu per hari, dan bulanan/tahunan', () => {
  const doc = makeHistoryPdf(orders, 'Periode: Bulanan (Jan 2026)', options);
  const pdf = doc.output();
  assert.match(pdf, /RINGKASAN PENJUALAN/);
  assert.match(pdf, /REKAP HARIAN/);
  assert.match(pdf, /MENU TERJUAL PER HARI/);
  assert.match(pdf, /REKAP MINGGUAN/);
  assert.match(pdf, /RINCIAN HARIAN PER MINGGU/);
  assert.match(pdf, /REKAP BULANAN & TAHUNAN/);
  assert.match(pdf, /Minggu ke-1/);
  assert.match(pdf, /Nasi Goreng/);
  assert.ok(doc.getNumberOfPages() >= 10, `halaman PDF minimal 10, dapat ${doc.getNumberOfPages()}`);
});

test('ekspor tetap memakai transaksi belum lunas hanya di daftar transaksi, bukan rekap', async () => {
  const pending = { ...jan6, invoice_number: 'INV-004', payment_status: 'belum_bayar', total_price: 99000, created_at: '2026-01-07T03:00:00Z' };
  const book = await makeHistoryWorkbook([...orders, pending], 'Periode: Bulanan (Jan 2026)', options);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer());
  const ringkasan = restored.getWorksheet('Ringkasan')!;
  const labels = new Map<string, unknown>();
  ringkasan.eachRow(row => {
    const key = String(row.getCell(1).value ?? '');
    if (key) labels.set(key, row.getCell(2).value);
  });
  assert.equal(labels.get('Transaksi lunas'), 3);
  assert.equal(labels.get('Pendapatan lunas (Rp)'), 120000);
  const daily = restored.getWorksheet('Rekap Harian')!;
  const dates: string[] = [];
  daily.eachRow((row, index) => { if (index >= 5) dates.push(String(row.getCell(1).value)); });
  assert.ok(!dates.includes('2026-01-07'), 'tanggal belum lunas tidak boleh muncul di rekap harian');
});

test('KDS punya tombol Selesaikan Semua yang mengirim status terbatas', async () => {
  const kds = await read('../src/components/KDS.tsx');
  assert.match(kds, /const completeAll = async/, 'harus ada handler selesaikan semua di dapur');
  assert.match(kds, /statuses/, 'harus mengirim daftar status terbatas');
  assert.match(kds, /\['sedang_diproses', 'siap'\]/, 'default hanya sedang dimasak + siap diambil');
  assert.match(kds, /Selesaikan Semua/, 'tombol terlihat oleh koki');
  assert.match(kds, /Ikut antrean masuk/, 'antrean hanya ikut bila dicentang');
});
