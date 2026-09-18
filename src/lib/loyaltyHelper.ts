import { randomUUID } from 'crypto';
import { PoolConnection } from "mysql2/promise";

export function loyaltySchemaChanges(
  columns: Array<{ Field: string }>,
  indexes: Array<{ Key_name: string }>,
): string[] {
  const changes: string[] = [];
  if (!columns.some(column => column.Field === 'order_id')) {
    changes.push('ALTER TABLE coin_transactions ADD COLUMN order_id VARCHAR(50) DEFAULT NULL AFTER id');
  }
  if (!indexes.some(index => index.Key_name === 'uq_coin_transactions_order_reward')) {
    changes.push('ALTER TABLE coin_transactions ADD UNIQUE KEY uq_coin_transactions_order_reward (order_id)');
  }
  return changes;
}

/**
 * Memproses pemberian koin berdasarkan total harga dan coin_reward_rate di app_settings.
 * Satu order hanya boleh menghasilkan satu ledger reward.
 */
export async function processLoyaltyPoints(
  connection: PoolConnection,
  orderId: string,
  userId: string | null,
  userName: string,
  invoiceNumber: string,
  totalPrice: number
): Promise<number> {
  if (!userId) return 0;

  const description = `Reward dari transaksi ${invoiceNumber}`;
  const [existingRows]: any = await connection.query(
    `SELECT id FROM coin_transactions
     WHERE order_id = ? OR (order_id IS NULL AND type = 'earn' AND description = ?)
     LIMIT 1 FOR UPDATE`,
    [orderId, description]
  );
  if (existingRows.length) return 0;

  const [settingsRows]: any = await connection.query(
    "SELECT value FROM app_settings WHERE `key` = 'coin_reward_rate' LIMIT 1"
  );

  let rate = 0.001;
  if (settingsRows.length > 0 && settingsRows[0].value !== null && settingsRows[0].value !== '') {
    const parsed = Number.parseFloat(settingsRows[0].value);
    if (Number.isFinite(parsed) && parsed >= 0) rate = parsed;
  }

  const earnedCoins = Math.floor(Number(totalPrice) * rate);
  if (earnedCoins <= 0) return 0;

  try {
    await connection.query(
      `INSERT INTO coin_transactions
       (id, order_id, user_id, user_name, type, amount, description)
       VALUES (?, ?, ?, ?, 'earn', ?, ?)`,
      [`ct-${randomUUID()}`, orderId, userId, userName, earnedCoins, description]
    );
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') return 0;
    throw error;
  }

  await connection.query(
    "UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?",
    [earnedCoins, userId]
  );
  return earnedCoins;
}
