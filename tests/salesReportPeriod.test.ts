import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesReportPeriod, reportPeriodLabel } from '../src/lib/salesReportPeriod.js';

test('periode tanggal, bulan dan tahun mengikuti pilihan WIB, bukan waktu sekarang', () => {
  const date = '2025-12-31T17:30:00Z';
  assert.equal(matchesReportPeriod(date, 'day', '2026-01-01'), true);
  assert.equal(matchesReportPeriod(date, 'month', '2026-01'), true);
  assert.equal(matchesReportPeriod(date, 'year', '2026'), true);
  assert.equal(matchesReportPeriod(date, 'month', '2025-12'), false);
  assert.equal(matchesReportPeriod(date, 'year', '2025'), false);
  assert.equal(reportPeriodLabel('month', '2026-01'), 'Bulan 2026-01 WIB');
  assert.equal(reportPeriodLabel('year', '2026'), 'Tahun 2026 WIB');
});
