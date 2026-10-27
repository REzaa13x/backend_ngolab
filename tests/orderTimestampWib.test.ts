import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderCreatedAt } from '../src/lib/orderTimestamp';
import { formatWibTimestamp } from '../src/lib/salesHistoryPeriod';
import { reportDateInJakarta } from '../src/lib/reporting';

test('order epoch preserves stored instant regardless of mysql2 timezone parsing', () => {
  const row = { created_at: new Date('2026-10-27T02:28:00Z'), created_at_epoch: '1793093280', fulfillment_at: 'unchanged' };
  const result = normalizeOrderCreatedAt(row);
  assert.equal(result.created_at, '2026-10-27T09:28:00.000Z');
  assert.equal(result.fulfillment_at, 'unchanged');
  assert.equal('created_at_epoch' in result, false);
});

test('naive Smart Tag timestamps and explicit instants render and group in WIB', () => {
  assert.match(formatWibTimestamp('2026-10-28 00:15:00'), /00\.15/);
  assert.equal(reportDateInJakarta('2026-10-27T17:15:00Z'), '2026-10-28');
  assert.equal(reportDateInJakarta('2026-10-28 00:15:00'), '2026-10-28');
  assert.equal(formatWibTimestamp('invalid'), 'Tanggal tidak valid');
});
