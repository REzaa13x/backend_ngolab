import { randomUUID } from 'crypto';
import { PoolConnection } from "mysql2/promise";
import { ensureMemberForUser, creditPoints, evaluateMemberTier } from "./membershipService.js";

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
 * (Fungsi legacy/kompatibilitas POS/KDS)
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

/**
 * Canonical Order-to-Points Function:
 * Menghitung dan memberikan Points ke akun loyalty_accounts dan mencatatnya di loyalty_transactions.
 * Idempoten per orderId (reference_type = 'ORDER', reference_id = orderId, idempotency_key = 'order-points:' + orderId).
 * Mengevaluasi Tier member berdasarkan eligible spending secara otomatis.
 */
export async function awardOrderPoints(
  connection: PoolConnection,
  {
    orderId,
    userId,
    userName,
    invoiceNumber,
    totalPrice,
  }: {
    orderId: string;
    userId: string | null;
    userName: string;
    invoiceNumber: string;
    totalPrice: number;
  }
): Promise<{ earnedPoints: number; repeated: boolean }> {
  if (!userId) return { earnedPoints: 0, repeated: false };

  try {
    // 1. Dapatkan profil member
    const member = await ensureMemberForUser(connection, userId, { nama: userName });
    if (!member || member.status !== 'ACTIVE') return { earnedPoints: 0, repeated: false };

    // 2. Dapatkan reward rate dari app_settings
    const [settingsRows]: any = await connection.query(
      "SELECT value FROM app_settings WHERE `key` = 'coin_reward_rate' LIMIT 1"
    );
    let rate = 0.001;
    if (settingsRows.length > 0 && settingsRows[0].value !== null && settingsRows[0].value !== '') {
      const parsed = Number.parseFloat(settingsRows[0].value);
      if (Number.isFinite(parsed) && parsed >= 0) rate = parsed;
    }

    // 3. Multiplier tier jika berlaku
    let multiplier = 1.0;
    if (member.current_tier_id) {
      const [tiers]: any = await connection.query(
        "SELECT multiplier FROM member_tiers WHERE id = ?",
        [member.current_tier_id]
      );
      if (tiers.length > 0 && Number(tiers[0].multiplier) > 0) {
        multiplier = Number(tiers[0].multiplier);
      }
    }

    const basePoints = Math.floor(Number(totalPrice) * rate);
    const totalEarnedPoints = Math.floor(basePoints * multiplier);
    if (totalEarnedPoints <= 0) return { earnedPoints: 0, repeated: false };

    const description = `Reward transaksi ${invoiceNumber}`;
    const idempotencyKey = `order-points:${orderId}`;

    // 4. Kredit poin secara atomik dan idempoten
    const result = await creditPoints({
      connection,
      memberId: member.id,
      points: totalEarnedPoints,
      transactionType: "PURCHASE",
      referenceType: "ORDER",
      referenceId: orderId,
      idempotencyKey,
      description,
    });

    // 5. Evaluasi kenaikan tier
    await evaluateMemberTier(connection, member.id);

    return { earnedPoints: result.credited, repeated: Boolean(result.repeated) };
  } catch (err) {
    console.error("Gagal memproses awardOrderPoints:", err);
    return { earnedPoints: 0, repeated: false };
  }
}
