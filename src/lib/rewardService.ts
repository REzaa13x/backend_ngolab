import crypto from "crypto";
import { db, addAuditLog } from "../db/db.js";
import { debitPoints } from "./membershipService.js";

export interface RewardItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  pointsRequired: number;
  pointsCost: number; // API field compatibility
  stock: number | null;
  isUnlimited: boolean;
  validFrom: string | null;
  validUntil: string | null;
  status: string;
  category: string;
  imageUrl: string | null;
  discountType: string | null;
  discountValue: number | null;
}

export function generateRedemptionCode(): string {
  const bytes = crypto.randomBytes(4);
  const code = bytes.toString("hex").toUpperCase();
  return `NGLB-${code}`;
}

/**
 * Mengambil daftar reward aktif untuk member-facing catalog.
 */
export async function getActiveRewardsCatalog(): Promise<RewardItem[]> {
  const query = `
    SELECT id, code, name, description, points_required, stock, is_unlimited,
           valid_from, valid_until, status, category, image_url, discount_type, discount_value
    FROM rewards
    WHERE status = 'ACTIVE'
      AND (valid_from IS NULL OR valid_from <= NOW())
      AND (valid_until IS NULL OR valid_until >= NOW())
      AND (is_unlimited = 1 OR (stock IS NOT NULL AND stock > 0))
    ORDER BY points_required ASC, name ASC
  `;
  const [rows]: any = await db.query(query);

  return rows.map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    pointsRequired: Number(r.points_required),
    pointsCost: Number(r.points_required), // Aliased for PointLab/GAMI
    stock: r.is_unlimited ? null : Number(r.stock),
    isUnlimited: Boolean(r.is_unlimited),
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    status: r.status,
    category: r.category || "Food",
    imageUrl: r.image_url,
    discountType: r.discount_type,
    discountValue: r.discount_value !== null ? Number(r.discount_value) : null,
  }));
}

/**
 * Operasi Atomic Penukaran Reward (Redemption).
 * Satu transaksi DB: validasi status, lock row, check idempotency, deduct points, decrement stock, insert redemption.
 */
export async function atomicRedeemReward({
  memberId,
  rewardId,
  idempotencyKey,
}: {
  memberId: string;
  rewardId: string;
  idempotencyKey?: string | null;
}): Promise<{
  redemptionId: string;
  redemptionCode: string;
  rewardId: string;
  rewardName: string;
  pointsUsed: number;
  remainingPoints: number;
  status: string;
  redeemedAt: string;
  expiresAt: string | null;
  isIdempotentReplay?: boolean;
}> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Validasi Status Member
    const [members]: any = await conn.query(
      "SELECT id, user_id, status FROM members WHERE id = ? FOR UPDATE",
      [memberId]
    );
    if (members.length === 0) {
      const err: any = new Error("Member tidak ditemukan");
      err.code = "MEMBER_NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }
    if (members[0].status !== "ACTIVE") {
      const err: any = new Error("Status keanggotaan tidak aktif");
      err.code = "MEMBER_INACTIVE";
      err.statusCode = 403;
      throw err;
    }

    // 2. Cek Idempotency Key terhadap Redemptions
    if (idempotencyKey) {
      const [existingRedemptions]: any = await conn.query(
        `SELECT r.id, r.redemption_code, r.member_id, r.reward_id, r.points_used, r.status,
                r.redeemed_at, r.expires_at, rw.name AS reward_name, la.current_points
         FROM redemptions r
         JOIN rewards rw ON rw.id = r.reward_id
         JOIN loyalty_accounts la ON la.member_id = r.member_id
         WHERE r.idempotency_key = ? FOR UPDATE`,
        [idempotencyKey]
      );

      if (existingRedemptions.length > 0) {
        const existing = existingRedemptions[0];
        // Jika request identik (memberId dan rewardId sama), kembalikan response pertama (idempotent replay)
        if (existing.member_id === memberId && existing.reward_id === rewardId) {
          await conn.commit();
          return {
            redemptionId: existing.id,
            redemptionCode: existing.redemption_code,
            rewardId: existing.reward_id,
            rewardName: existing.reward_name,
            pointsUsed: Number(existing.points_used),
            remainingPoints: Number(existing.current_points),
            status: existing.status,
            redeemedAt: existing.redeemed_at,
            expiresAt: existing.expires_at,
            isIdempotentReplay: true,
          };
        } else {
          // Idempotency key dipakai ulang dengan payload berbeda
          const err: any = new Error("Idempotency-Key sudah digunakan untuk transaksi yang berbeda");
          err.code = "IDEMPOTENCY_CONFLICT";
          err.statusCode = 409;
          throw err;
        }
      }
    }

    // 3. Lock dan Validasi Reward
    const [rewards]: any = await conn.query(
      "SELECT * FROM rewards WHERE id = ? FOR UPDATE",
      [rewardId]
    );
    if (rewards.length === 0) {
      const err: any = new Error("Reward tidak ditemukan");
      err.code = "REWARD_NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }
    const reward = rewards[0];

    if (reward.status !== "ACTIVE") {
      const err: any = new Error("Reward sedang tidak aktif");
      err.code = "REWARD_INACTIVE";
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    if (reward.valid_from && new Date(reward.valid_from) > now) {
      const err: any = new Error("Reward belum berlaku");
      err.code = "REWARD_NOT_YET_VALID";
      err.statusCode = 400;
      throw err;
    }
    if (reward.valid_until && new Date(reward.valid_until) < now) {
      const err: any = new Error("Reward sudah kedaluwarsa");
      err.code = "REWARD_EXPIRED";
      err.statusCode = 400;
      throw err;
    }

    if (!reward.is_unlimited) {
      if (reward.stock === null || reward.stock < 1) {
        const err: any = new Error("Stok reward habis");
        err.code = "REWARD_OUT_OF_STOCK";
        err.statusCode = 409;
        throw err;
      }
    }

    const pointsRequired = Number(reward.points_required);

    // 4. Potong Poin lewat Points Service (Atomic di dalam connection yang sama)
    const ledgerKey = idempotencyKey ? `red-tx:${idempotencyKey}` : `red-tx:${crypto.randomUUID()}`;
    const debitResult = await debitPoints({
      connection: conn,
      memberId,
      points: pointsRequired,
      transactionType: "REDEMPTION",
      referenceType: "REWARD",
      referenceId: reward.id,
      idempotencyKey: ledgerKey,
      description: `Penukaran reward: ${reward.name}`,
    });

    // 5. Kurangi stok reward bila limited
    if (!reward.is_unlimited) {
      await conn.query(
        "UPDATE rewards SET stock = stock - 1, updated_at = NOW() WHERE id = ? AND stock > 0",
        [reward.id]
      );
    }

    // 6. Buat kode penukaran unik
    let redemptionCode = generateRedemptionCode();
    const redemptionId = `red-${crypto.randomUUID()}`;

    // Menentukan expiry voucher (misal 30 hari dari penukaran atau mengikuti valid_until reward)
    let expiresAt: string | null = null;
    if (reward.valid_until) {
      expiresAt = new Date(reward.valid_until).toISOString().slice(0, 19).replace("T", " ");
    } else {
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      expiresAt = expiry.toISOString().slice(0, 19).replace("T", " ");
    }

    // 7. Simpan record redemption
    await conn.query(
      `INSERT INTO redemptions 
       (id, member_id, reward_id, points_used, redemption_code, status, idempotency_key, redeemed_at, expires_at)
       VALUES (?, ?, ?, ?, ?, 'REDEEMED', ?, NOW(), ?)`,
      [
        redemptionId,
        memberId,
        reward.id,
        pointsRequired,
        redemptionCode,
        idempotencyKey || null,
        expiresAt,
      ]
    );

    // 8. Log ke audit logs
    const [userRow]: any = await conn.query("SELECT nama FROM users WHERE id = ?", [members[0].user_id]);
    const userName = userRow[0]?.nama || "Member";
    await addAuditLog(
      userName,
      "Penukaran Reward",
      `${reward.name} (${pointsRequired} pts) -> Kode: ${redemptionCode}`
    );

    await conn.commit();

    return {
      redemptionId,
      redemptionCode,
      rewardId: reward.id,
      rewardName: reward.name,
      pointsUsed: pointsRequired,
      remainingPoints: debitResult.newBalance,
      status: "REDEEMED",
      redeemedAt: new Date().toISOString(),
      expiresAt,
      isIdempotentReplay: false,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Validasi kode penukaran voucher untuk kasir/staff.
 */
export async function validateRedemptionCode(code: string) {
  const [rows]: any = await db.query(
    `SELECT r.id, r.redemption_code, r.status, r.points_used, r.redeemed_at, r.expires_at, r.fulfilled_at,
            rw.id AS reward_id, rw.name AS reward_name, rw.description, rw.discount_type, rw.discount_value,
            m.id AS member_id, m.member_code, u.nama AS member_name, u.phone AS member_phone
     FROM redemptions r
     JOIN rewards rw ON rw.id = r.reward_id
     JOIN members m ON m.id = r.member_id
     JOIN users u ON u.id = m.user_id
     WHERE r.redemption_code = ?`,
    [code.trim().toUpperCase()]
  );

  if (rows.length === 0) {
    const err: any = new Error("Kode penukaran tidak ditemukan");
    err.code = "REDEMPTION_NOT_FOUND";
    err.statusCode = 404;
    throw err;
  }

  const r = rows[0];
  let isExpired = false;
  if (r.expires_at && new Date(r.expires_at) < new Date()) {
    isExpired = true;
  }

  return {
    redemptionId: r.id,
    redemptionCode: r.redemption_code,
    status: isExpired && r.status === "REDEEMED" ? "EXPIRED" : r.status,
    pointsUsed: Number(r.points_used),
    redeemedAt: r.redeemed_at,
    expiresAt: r.expires_at,
    fulfilledAt: r.fulfilled_at,
    isExpired,
    reward: {
      id: r.reward_id,
      name: r.reward_name,
      description: r.description,
      discountType: r.discount_type,
      discountValue: r.discount_value !== null ? Number(r.discount_value) : null,
    },
    member: {
      id: r.member_id,
      memberCode: r.member_code,
      name: r.member_name,
      phone: r.member_phone,
    },
  };
}

/**
 * Pemenuhan/Penggunaan voucher (Fulfill) oleh kasir/admin.
 */
export async function fulfillRedemption({
  code,
  staffId,
  staffName,
}: {
  code: string;
  staffId: string;
  staffName: string;
}) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query(
      `SELECT r.id, r.redemption_code, r.status, r.expires_at, rw.name AS reward_name,
              m.member_code, u.nama AS member_name
       FROM redemptions r
       JOIN rewards rw ON rw.id = r.reward_id
       JOIN members m ON m.id = r.member_id
       JOIN users u ON u.id = m.user_id
       WHERE r.redemption_code = ? FOR UPDATE`,
      [code.trim().toUpperCase()]
    );

    if (rows.length === 0) {
      const err: any = new Error("Kode penukaran tidak ditemukan");
      err.code = "REDEMPTION_NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    const r = rows[0];

    if (r.status === "FULFILLED") {
      const err: any = new Error("Voucher sudah pernah digunakan sebelumnya");
      err.code = "REDEMPTION_ALREADY_FULFILLED";
      err.statusCode = 409;
      throw err;
    }

    if (r.status === "CANCELLED") {
      const err: any = new Error("Voucher telah dibatalkan");
      err.code = "REDEMPTION_CANCELLED";
      err.statusCode = 400;
      throw err;
    }

    if (r.expires_at && new Date(r.expires_at) < new Date()) {
      await conn.query("UPDATE redemptions SET status = 'EXPIRED' WHERE id = ?", [r.id]);
      await conn.commit();
      const err: any = new Error("Voucher sudah kedaluwarsa");
      err.code = "REDEMPTION_EXPIRED";
      err.statusCode = 400;
      throw err;
    }

    await conn.query(
      `UPDATE redemptions 
       SET status = 'FULFILLED', fulfilled_at = NOW(), fulfilled_by_staff_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [staffId, r.id]
    );

    await addAuditLog(
      staffName,
      "Fulfillment Voucher",
      `Voucher ${r.redemption_code} (${r.reward_name}) diselesaikan oleh ${staffName} untuk ${r.member_name}`
    );

    await conn.commit();

    return {
      success: true,
      redemptionCode: r.redemption_code,
      status: "FULFILLED",
      fulfilledAt: new Date().toISOString(),
      fulfilledBy: { id: staffId, name: staffName },
      rewardName: r.reward_name,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
