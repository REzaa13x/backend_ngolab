import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMemberTier } from '../src/lib/membershipService.js';

test('evaluateMemberTier menghitung eligible spending hanya dari order berstatus lunas dalam active period', async () => {
  const queries: Array<{ sql: string; params?: any[] }> = [];
  const connection: any = {
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (/SELECT id, user_id, current_tier_id FROM members/i.test(sql)) {
        return [[{ id: 'mem-1', user_id: 'usr-1', current_tier_id: 'tier-classmate' }]];
      }
      if (/SELECT \* FROM loyalty_periods WHERE status = 'ACTIVE'/i.test(sql)) {
        return [[{ id: 'lp-1', code: 'PERIOD-2026', start_date: '2026-01-01', end_date: '2026-12-31' }]];
      }
      if (/FROM orders/i.test(sql)) {
        // Simulasi total spending Rp 350.000 (mencapai tier Campus Star)
        return [[{ total_spending: 350000 }]];
      }
      if (/FROM member_tiers WHERE status = 'ACTIVE'/i.test(sql)) {
        return [[
          { id: 'tier-hall-of-fame', code: 'HALL_OF_FAME', name: 'Hall of Fame', min_spending: 750000 },
          { id: 'tier-campus-star', code: 'CAMPUS_STAR', name: 'Campus Star', min_spending: 300000 },
          { id: 'tier-study-buddy', code: 'STUDY_BUDDY', name: 'Study Buddy', min_spending: 100000 },
          { id: 'tier-classmate', code: 'CLASSMATE', name: 'Classmate', min_spending: 0 },
        ]];
      }
      if (/UPDATE members SET current_tier_id/i.test(sql)) {
        return [{ affectedRows: 1 }];
      }
      if (/INSERT INTO member_tier_histories/i.test(sql)) {
        return [{ affectedRows: 1 }];
      }
      return [[]];
    },
  };

  const targetTier = await evaluateMemberTier(connection, 'mem-1');
  assert.equal(targetTier.code, 'CAMPUS_STAR');

  // Pastikan query spending memfilter orders yang lunas
  const spendingQuery = queries.find(q => /FROM orders/i.test(q.sql));
  assert.ok(spendingQuery);
  assert.match(spendingQuery.sql, /payment_status = 'lunas'/i);
  assert.match(spendingQuery.sql, /status NOT IN \('Dibatalkan'/i);

  // Pastikan members diupdate dan riwayat tier dicatat
  const updateMember = queries.find(q => /UPDATE members SET current_tier_id/i.test(q.sql));
  const insertHistory = queries.find(q => /INSERT INTO member_tier_histories/i.test(q.sql));
  assert.ok(updateMember);
  assert.ok(insertHistory);
  assert.equal(updateMember.params?.[0], 'tier-campus-star');
});
