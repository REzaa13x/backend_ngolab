import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_SALES_AXIS_TICK,
  buildMonthlyData,
  buildSalesAxisScale,
  calculateReportSummary,
  formatRupiah,
} from '../src/lib/reporting.js';

test('laporan bulanan selalu mencakup 12 bulan', () => {
  const data = buildMonthlyData([{ month_num: 7, sales: 50000, orders: 2, verified: 1 }]);
  assert.equal(data.length, 12);
  assert.deepEqual(data.map(item => item.name), ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']);
  assert.equal(data[6].sales, 50000);
});

test('rata-rata order hanya membagi penjualan dengan order lunas', () => {
  const summary = calculateReportSummary([
    { total_price: 40000, payment_status: 'lunas' },
    { total_price: 20000, payment_status: 'lunas' },
    { total_price: 10000, payment_status: 'belum_bayar' },
  ]);
  assert.equal(summary.totalSales, 60000);
  assert.equal(summary.totalOrders, 3);
  assert.equal(summary.averageOrderValue, 30000);
});

test('formatRupiah menampilkan angka rupiah utuh dengan pemisah ribuan Indonesia', () => {
  assert.equal(formatRupiah(0), 'Rp 0');
  assert.equal(formatRupiah(50000), 'Rp 50.000');
  assert.equal(formatRupiah(1250000), 'Rp 1.250.000');
});

test('skala sumbu Y grafik mulai dari Rp 50.000 bahkan saat penjualan masih 0', () => {
  const zeroScale = buildSalesAxisScale([0, 0, 0, 0, 0, 0, 0]);
  assert.equal(zeroScale.ticks[0], MIN_SALES_AXIS_TICK);
  assert.equal(formatRupiah(zeroScale.ticks[0]), 'Rp 50.000');
  assert.deepEqual(zeroScale.ticks, [50_000, 100_000, 150_000, 200_000]);
  assert.deepEqual(zeroScale.domain, [0, 200_000]);
});

test('skala sumbu Y grafik menyesuaikan hingga penjualan tertinggi mulai dari Rp 50.000', () => {
  const midScale = buildSalesAxisScale([0, 45_000, 185_000, 250_000, 120_000]);
  assert.equal(midScale.ticks[0], 50_000);
  assert.equal(midScale.ticks[midScale.ticks.length - 1], 250_000);
  assert.deepEqual(midScale.ticks, [50_000, 100_000, 150_000, 200_000, 250_000]);

  const highScale = buildSalesAxisScale([75_000, 1_320_000, 450_000]);
  assert.equal(highScale.ticks[0], 50_000);
  assert.ok(highScale.domain[1] >= 1_320_000);
  assert.equal(highScale.ticks[highScale.ticks.length - 1], highScale.domain[1]);
});
