import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesHistoryPeriod, parseHistoryTimestamp } from '../src/lib/salesHistoryPeriod.js';

test('filter harian dan mingguan memakai tanggal WIB dan minggu Senin sampai Minggu', () => {
  assert.equal(matchesHistoryPeriod('2026-01-04T17:00:00Z', 'hari', '2026-01-05'), true);
  assert.equal(matchesHistoryPeriod('2026-01-04T16:59:59Z', 'hari', '2026-01-05'), false);
  assert.equal(matchesHistoryPeriod('2026-01-11T16:59:59Z', 'minggu', '2026-01-05'), true);
  assert.equal(matchesHistoryPeriod('2026-01-11T17:00:00Z', 'minggu', '2026-01-05'), false);
});

test('filter bulanan lintas tahun dan semua periode', () => {
  assert.equal(matchesHistoryPeriod('2025-12-31T17:00:00Z', 'bulan', '2026-01-15'), true);
  assert.equal(matchesHistoryPeriod('2025-12-31T16:59:59Z', 'bulan', '2026-01-15'), false);
  assert.equal(matchesHistoryPeriod('2024-01-01T00:00:00Z', 'semua', '2026-01-15'), true);
});

test('timestamp tanpa zona diasumsikan WIB, timestamp tidak valid ditolak', () => {
  assert.equal(parseHistoryTimestamp('2026-01-05 00:00:00')?.toISOString(), '2026-01-04T17:00:00.000Z');
  assert.equal(parseHistoryTimestamp('2026-01-05T00:00:00+08:00')?.toISOString(), '2026-01-04T16:00:00.000Z');
  assert.equal(parseHistoryTimestamp('tidak-valid'), null);
  assert.equal(parseHistoryTimestamp('2026-02-30 00:00:00'), null);
});
