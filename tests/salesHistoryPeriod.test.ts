import test from 'node:test';
import assert from 'node:assert/strict';
import { historyPeriodLabel, historyPeriodRange, matchesHistoryPeriod, parseHistoryTimestamp, shiftDateKey } from '../src/lib/salesHistoryPeriod.js';

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

test('rentang mingguan selalu 7 hari Senin sampai Minggu', () => {
  assert.deepEqual(historyPeriodRange('minggu', '2026-01-07'), { start: '2026-01-05', end: '2026-01-11' });
  // Minggu tetap milik minggu yang sama, bukan minggu berikutnya.
  assert.deepEqual(historyPeriodRange('minggu', '2026-01-11'), { start: '2026-01-05', end: '2026-01-11' });
  assert.equal(matchesHistoryPeriod('2026-01-05T00:00:00+07:00', 'minggu', '2026-01-11'), true);
  assert.equal(matchesHistoryPeriod('2026-01-12T00:00:00+07:00', 'minggu', '2026-01-11'), false);
});

test('rentang bulanan dan tahunan memakai batas bulan/tahun WIB yang benar', () => {
  assert.deepEqual(historyPeriodRange('bulan', '2026-02-14'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(historyPeriodRange('bulan', '2024-02-14'), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(historyPeriodRange('tahun', '2026-07-01'), { start: '2026-01-01', end: '2026-12-31' });
  assert.equal(matchesHistoryPeriod('2026-12-31T23:59:00+07:00', 'tahun', '2026-06-01'), true);
  assert.equal(matchesHistoryPeriod('2027-01-01T00:00:00+07:00', 'tahun', '2026-06-01'), false);
});

test('periode rentang bebas memakai kedua tanggal dan menerima urutan terbalik', () => {
  assert.deepEqual(historyPeriodRange('rentang', '2026-01-10', '2026-01-03'), { start: '2026-01-03', end: '2026-01-10' });
  assert.equal(matchesHistoryPeriod('2026-01-03T00:00:00+07:00', 'rentang', '2026-01-10', '2026-01-03'), true);
  assert.equal(matchesHistoryPeriod('2026-01-11T00:00:00+07:00', 'rentang', '2026-01-10', '2026-01-03'), false);
  // Rentang tanpa tanggal akhir tidak valid, bukan diam-diam jadi "semua".
  assert.equal(historyPeriodRange('rentang', '2026-01-10'), null);
  assert.equal(matchesHistoryPeriod('2026-01-05T00:00:00+07:00', 'rentang', '2026-01-10'), false);
});

test('label periode menyebut tanggal sebenarnya agar tidak ambigu', () => {
  assert.equal(historyPeriodLabel('minggu', '2026-01-07'), 'Mingguan (05 Jan 2026 – 11 Jan 2026)');
  assert.equal(historyPeriodLabel('hari', '2026-01-07'), 'Harian (07 Jan 2026)');
  assert.equal(historyPeriodLabel('semua', '2026-01-07'), 'Semua Periode');
  assert.equal(historyPeriodLabel('tahun', '2026-01-07'), 'Tahunan (01 Jan 2026 – 31 Des 2026)');
});

test('shiftDateKey tidak menghasilkan tanggal rusak', () => {
  assert.equal(shiftDateKey('2026-01-31', 1), '2026-02-01');
  assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDateKey('bukan-tanggal', 1), '');
});
