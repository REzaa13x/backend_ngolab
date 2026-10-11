import test from 'node:test';
import assert from 'node:assert/strict';
import { creditPoints, debitPoints } from '../src/lib/membershipService.js';

test('creditPoints menambah saldo poin dan mencatat ledger transaksi secara atomik', async () => {
  const queries: Array<{ sql: string; params?: any[] }> = [];
  const connection: any = {
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (/FROM loyalty_transactions WHERE idempotency_key/i.test(sql)) {
        return [[]]; // belum ada transaksi dengan idempotency key ini
      }
      if (/FROM loyalty_accounts WHERE member_id/i.test(sql)) {
        return [[{ id: 'acc-1', current_period_id: 'lp-1', current_points: 100, lifetime_earned_points: 200 }]];
      }
      if (/UPDATE loyalty_accounts/i.test(sql)) {
        return [{ affectedRows: 1 }];
      }
      if (/INSERT INTO loyalty_transactions/i.test(sql)) {
        return [{ affectedRows: 1 }];
      }
      return [[]];
    },
  };

  const res = await creditPoints({
    connection,
    memberId: 'mem-1',
    points: 50,
    transactionType: 'PURCHASE',
    idempotencyKey: 'idemp-123',
    description: 'Beli Kopi',
  });

  assert.equal(res.credited, 50);
  assert.equal(res.newBalance, 150);
  assert.equal(res.repeated, false);

  const updateIdx = queries.findIndex(q => /UPDATE loyalty_accounts/i.test(q.sql));
  const insertIdx = queries.findIndex(q => /INSERT INTO loyalty_transactions/i.test(q.sql));
  assert.ok(updateIdx >= 0 && insertIdx >= 0);
  assert.equal(queries[updateIdx].params?.[0], 150); // newBalance
});

test('creditPoints dengan idempotency_key yang sama mengembalikan hasil yang ada tanpa double-credit', async () => {
  const queries: Array<{ sql: string; params?: any[] }> = [];
  const connection: any = {
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (/FROM loyalty_transactions WHERE idempotency_key/i.test(sql)) {
        return [[{ id: 'tx-existing', points: 50 }]]; // transaksi sudah pernah dicatat
      }
      if (/SELECT current_points FROM loyalty_accounts/i.test(sql)) {
        return [[{ current_points: 150 }]];
      }
      throw new Error(`Query tidak boleh dipanggil saat idempotency hit: ${sql}`);
    },
  };

  const res = await creditPoints({
    connection,
    memberId: 'mem-1',
    points: 50,
    transactionType: 'PURCHASE',
    idempotencyKey: 'idemp-123',
  });

  assert.equal(res.credited, 50);
  assert.equal(res.newBalance, 150);
  assert.equal(res.repeated, true);
  // Tidak ada UPDATE loyalty_accounts
  assert.ok(!queries.some(q => /UPDATE loyalty_accounts/i.test(q.sql)));
});

test('debitPoints menolak jika saldo tidak cukup (saldo tidak boleh negatif)', async () => {
  const connection: any = {
    query: async (sql: string) => {
      if (/FROM loyalty_transactions WHERE idempotency_key/i.test(sql)) return [[]];
      if (/FROM loyalty_accounts WHERE member_id/i.test(sql)) {
        return [[{ id: 'acc-1', current_period_id: 'lp-1', current_points: 30, lifetime_redeemed_points: 0 }]];
      }
      return [[]];
    },
  };

  await assert.rejects(
    async () => {
      await debitPoints({
        connection,
        memberId: 'mem-1',
        points: 50, // Saldo hanya 30
        transactionType: 'REDEMPTION',
      });
    },
    (err: any) => {
      assert.equal(err.code, 'INSUFFICIENT_POINTS');
      return true;
    }
  );
});

test('debitPoints berhasil memotong saldo dan menyimpan poin negatif di ledger', async () => {
  const queries: Array<{ sql: string; params?: any[] }> = [];
  const connection: any = {
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (/FROM loyalty_transactions WHERE idempotency_key/i.test(sql)) return [[]];
      if (/FROM loyalty_accounts WHERE member_id/i.test(sql)) {
        return [[{ id: 'acc-1', current_period_id: 'lp-1', current_points: 100, lifetime_redeemed_points: 20 }]];
      }
      return [{ affectedRows: 1 }];
    },
  };

  const res = await debitPoints({
    connection,
    memberId: 'mem-1',
    points: 40,
    transactionType: 'REDEMPTION',
  });

  assert.equal(res.debited, 40);
  assert.equal(res.newBalance, 60);

  const insertTx = queries.find(q => /INSERT INTO loyalty_transactions/i.test(q.sql));
  assert.ok(insertTx);
  // Points disimpan sebagai bilangan negatif (-40)
  assert.equal(insertTx.params?.[4], -40);
});
