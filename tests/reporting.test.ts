import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyData, calculateReportSummary } from '../src/lib/reporting.js';

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
