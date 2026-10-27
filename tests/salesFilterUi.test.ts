import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const history = readFileSync('src/components/SalesHistory.tsx', 'utf8');
const report = readFileSync('src/components/SalesReport.tsx', 'utf8');

test('riwayat menjelaskan filter global dan pilihan periode', () => {
  assert.match(history, /Filter transaksi/);
  assert.match(history, /Sumber transaksi/);
  assert.match(history, /Status pembayaran/);
  assert.match(history, /aria-pressed=\{filterSource === s\}/);
  assert.match(history, /aria-pressed=\{period === value\}/);
  assert.match(history, /Tanggal acuan \(WIB\)/);
});

test('analisis menyajikan sumber sebagai filter global dan minggu sebagai 7 hari terakhir', () => {
  assert.match(report, /Filter transaksi/);
  assert.match(report, /7 hari terakhir/);
  assert.match(report, /aria-pressed=\{period === p.id\}/);
  assert.match(report, /aria-pressed=\{sourceFilter === s.id\}/);
  assert.ok(report.indexOf("setSourceFilter(s.id as any)") < report.indexOf('{/* Metrics Grid */}'));
  assert.match(report, /Transaksi lunas, ditolak, atau dibatalkan/);
});
