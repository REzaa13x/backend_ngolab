import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, startClock } from '../src/lib/liveClock';

test('jam dan tanggal mengikuti waktu Jakarta termasuk pergantian hari', () => {
  assert.deepEqual(formatClock(new Date('2026-10-27T16:59:59Z')), { date: 'Selasa, 27 Oktober 2026', time: '23.59.59' });
  assert.deepEqual(formatClock(new Date('2026-10-27T17:00:00Z')), { date: 'Rabu, 28 Oktober 2026', time: '00.00.00' });
});

test('jam membaca waktu aktual pada setiap tick dan membersihkan timer', () => {
  let callback = () => {};
  let cancelled = false;
  const values: number[] = [];
  let now = 1000;
  const stop = startClock(value => values.push(value.getTime()), {
    now: () => new Date(now),
    setInterval: fn => { callback = fn; return 1; },
    clearInterval: id => { assert.equal(id, 1); cancelled = true; },
  });
  now = 5100; callback();
  assert.deepEqual(values, [1000, 5100]);
  stop();
  assert.equal(cancelled, true);
});
