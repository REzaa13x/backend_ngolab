import test from 'node:test';
import assert from 'node:assert/strict';
import { loyaltySchemaChanges, processLoyaltyPoints } from '../src/lib/loyaltyHelper.js';

test('migrasi loyalty menambah order_id dan indeks unik hanya saat belum tersedia', () => {
  assert.deepEqual(loyaltySchemaChanges([], []), [
    'ALTER TABLE coin_transactions ADD COLUMN order_id VARCHAR(50) DEFAULT NULL AFTER id',
    'ALTER TABLE coin_transactions ADD UNIQUE KEY uq_coin_transactions_order_reward (order_id)',
  ]);
  assert.deepEqual(
    loyaltySchemaChanges([{ Field: 'order_id' }], [{ Key_name: 'uq_coin_transactions_order_reward' }]),
    [],
  );
});

test('cashback tidak diberikan lagi bila ledger order sudah ada', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const connection: any = {
    query: async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (/FROM coin_transactions/i.test(sql)) return [[{ id: 'existing' }]];
      throw new Error('query lain tidak boleh dipanggil');
    },
  };

  const earned = await processLoyaltyPoints(connection, 'order-1', 'user-1', 'Budi', 'INV-1', 10000);
  assert.equal(earned, 0);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /FROM coin_transactions/i);
});

test('ledger cashback ditulis dengan order_id sebelum saldo pengguna ditambah', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const connection: any = {
    query: async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (/FROM coin_transactions/i.test(sql)) return [[]];
      if (/FROM app_settings/i.test(sql)) return [[{ value: '0.001' }]];
      return [{ affectedRows: 1 }];
    },
  };

  const earned = await processLoyaltyPoints(connection, 'order-2', 'user-2', 'Siti', 'INV-2', 10000);
  assert.equal(earned, 10);
  const ledgerIndex = queries.findIndex(entry => /INSERT INTO coin_transactions/i.test(entry.sql));
  const balanceIndex = queries.findIndex(entry => /UPDATE users SET coin_balance/i.test(entry.sql));
  assert.ok(ledgerIndex >= 0 && balanceIndex > ledgerIndex);
  assert.ok(queries[ledgerIndex].sql.includes('order_id'));
  assert.ok(queries[ledgerIndex].params?.includes('order-2'));
});
