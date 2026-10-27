import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyData, calculateReportSummary, buildDailyReport, reportDateInJakarta } from '../src/lib/reporting.js';

test('laporan harian mengelompokkan tanggal WIB dan hanya menghitung pendapatan lunas', () => {
  const rows = [
    { created_at: '2026-10-26T17:30:00Z', total_price: '25000', payment_status: 'lunas' },
    { created_at: '2026-10-27T03:00:00Z', total_price: 10000, payment_status: 'ditolak' },
    { created_at: '2026-10-26T16:59:00Z', total_price: 5000, payment_status: 'lunas' },
  ];
  assert.equal(reportDateInJakarta(rows[0].created_at), '2026-10-27');
  assert.deepEqual(buildDailyReport(rows), [
    { date: '2026-10-27', revenue: 25000, paid: 1, failed: 1 },
    { date: '2026-10-26', revenue: 5000, paid: 1, failed: 0 },
  ]);
});

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
