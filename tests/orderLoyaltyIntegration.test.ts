import test from 'node:test';
import assert from 'node:assert/strict';
import { awardOrderPoints } from '../src/lib/loyaltyHelper.js';

test('awardOrderPoints tidak memberikan poin untuk guest order (userId bernilai null)', async () => {
  const connection: any = {
    query: async () => {
      throw new Error('Tidak boleh ada query yang dijalankan untuk guest order');
    },
  };

  const res = await awardOrderPoints(connection, {
    orderId: 'ord-guest',
    userId: null,
    userName: 'Guest',
    invoiceNumber: 'INV-GUEST',
    totalPrice: 50000,
  });

  assert.equal(res.earnedPoints, 0);
  assert.equal(res.repeated, false);
});

test('awardOrderPoints memberikan poin untuk member terdaftar dan mengevaluasi tier', async () => {
  const queries: Array<{ sql: string; params?: any[] }> = [];
  const connection: any = {
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (/FROM members WHERE/i.test(sql)) {
        return [[{ id: 'mem-1', user_id: 'usr-1', status: 'ACTIVE', current_tier_id: 'tier-1' }]];
      }
      if (/FROM loyalty_accounts WHERE member_id/i.test(sql)) {
        return [[{ id: 'la-1', current_period_id: 'lp-1', current_points: 0, lifetime_earned_points: 0 }]];
      }
      if (/FROM app_settings WHERE `key` = 'coin_reward_rate'/i.test(sql)) {
        return [[{ value: '0.001' }]]; // 1 poin per Rp 1.000
      }
      if (/FROM member_tiers WHERE id =/i.test(sql)) {
        return [[{ multiplier: 1.0 }]];
      }
      if (/FROM loyalty_transactions WHERE idempotency_key/i.test(sql)) {
        return [[]]; // belum ada transaksi
      }
      if (/FROM loyalty_transactions WHERE reference_type/i.test(sql)) {
        return [[]];
      }
      if (/SELECT \* FROM loyalty_periods WHERE status = 'ACTIVE'/i.test(sql)) {
        return [[{ id: 'lp-1', code: 'PERIOD-2026', start_date: '2026-01-01', end_date: '2026-12-31' }]];
      }
      if (/FROM orders/i.test(sql)) {
        return [[{ total_spending: 50000 }]];
      }
      if (/FROM member_tiers WHERE status = 'ACTIVE'/i.test(sql)) {
        return [[{ id: 'tier-1', code: 'CLASSMATE', min_spending: 0 }]];
      }
      return [{ affectedRows: 1 }];
    },
  };

  const res = await awardOrderPoints(connection, {
    orderId: 'ord-100',
    userId: 'usr-1',
    userName: 'Ahmad',
    invoiceNumber: 'INV-100',
    totalPrice: 50000,
  });

  // 50.000 * 0.001 = 50 poin
  assert.equal(res.earnedPoints, 50);
  assert.equal(res.repeated, false);

  // Pastikan ledger menyimpan reference_type ORDER dan orderId
  const insertTx = queries.find(q => /INSERT INTO loyalty_transactions/i.test(q.sql));
  assert.ok(insertTx);
  assert.equal(insertTx.params?.[5], 'ORDER');
  assert.equal(insertTx.params?.[6], 'ord-100');
  assert.equal(insertTx.params?.[7], 'order-points:ord-100');
});
