import crypto from "crypto";
import { PoolConnection } from "mysql2/promise";
import { db, addAuditLog } from "../db/db.js";

export type MemberType = "STUDENT" | "LECTURER" | "GENERAL";
export type MemberStatus = "ACTIVE" | "INACTIVE";
export type LoyaltyTxType =
  | "PURCHASE"
  | "GAMIFICATION"
  | "EVENT"
  | "BONUS"
  | "REDEMPTION"
  | "EXPIRATION"
  | "ADJUSTMENT"
  | "REVERSAL";

export interface MemberProfile {
  user: {
    id: string;
    nama: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    role: string;
  };
  member: {
    id: string;
    memberCode: string;
    memberType: MemberType;
    status: MemberStatus;
    joinedAt: string;
  };
  loyalty: {
    accountId: string;
    currentPoints: number;
    lifetimeEarnedPoints: number;
    lifetimeRedeemedPoints: number;
  };
  tier: {
    id: string;
    code: string;
    name: string;
    minSpending: number;
    maxSpending: number | null;
    multiplier: number;
    benefitDescription: string | null;
  } | null;
  period: {
    id: string;
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
}

export function generateMemberCode(): string {
  const bytes = crypto.randomBytes(4);
  const code = bytes.toString("hex").toUpperCase().slice(0, 6);
  return `PL-${code}`;
}

export async function getActiveLoyaltyPeriod(executor: any = db) {
  const [periods]: any = await executor.query(
    "SELECT * FROM loyalty_periods WHERE status = 'ACTIVE' ORDER BY start_date DESC LIMIT 1"
  );
  if (periods.length > 0) return periods[0];
  const [fallback]: any = await executor.query(
    "SELECT * FROM loyalty_periods ORDER BY created_at DESC LIMIT 1"
  );
  return fallback.length > 0 ? fallback[0] : null;
}

export async function getDefaultTier(executor: any = db) {
  const [tiers]: any = await executor.query(
    "SELECT * FROM member_tiers WHERE status = 'ACTIVE' ORDER BY min_spending ASC LIMIT 1"
  );
  return tiers.length > 0 ? tiers[0] : null;
}

/**
 * Mendapatkan atau membuat profil membership dan loyalty account untuk user.
 * Idempoten dan aman terhadap balapan (race conditions).
 */
export async function ensureMemberForUser(
  executor: any,
  userId: string,
  userProfile?: { nama?: string; email?: string | null; phone?: string | null; nim?: string | null }
): Promise<any> {
  const [existing]: any = await executor.query(
    "SELECT * FROM members WHERE user_id = ?",
    [userId]
  );
  if (existing.length > 0) {
    const member = existing[0];
    // Pastikan loyalty account ada
    const [accs]: any = await executor.query(
      "SELECT * FROM loyalty_accounts WHERE member_id = ?",
      [member.id]
    );
    if (accs.length === 0) {
      const activePeriod = await getActiveLoyaltyPeriod(executor);
      const [uRows]: any = await executor.query("SELECT coin_balance FROM users WHERE id = ?", [userId]);
      const initPts = Math.max(0, Number(uRows?.[0]?.coin_balance || 0));
      const accId = `la-${crypto.randomUUID()}`;
      await executor.query(
        "INSERT INTO loyalty_accounts (id, member_id, current_period_id, current_points, lifetime_earned_points, lifetime_redeemed_points) VALUES (?, ?, ?, ?, ?, 0)",
        [accId, member.id, activePeriod ? activePeriod.id : null, initPts, initPts]
      );
    }
    return member;
  }

  // Buat member baru
  let memberType: MemberType = "GENERAL";
  if (userProfile?.nim && userProfile.nim.trim().length > 0) {
    memberType = "STUDENT";
  }

  const defaultTier = await getDefaultTier(executor);
  const activePeriod = await getActiveLoyaltyPeriod(executor);
  const memberId = `mem-${crypto.randomUUID()}`;
  let memberCode = generateMemberCode();

  // Retry jika ada collision pada member_code
  let inserted = false;
  let attempts = 0;
  while (!inserted && attempts < 5) {
    try {
      attempts++;
      await executor.query(
        "INSERT INTO members (id, user_id, member_code, member_type, current_tier_id, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
        [memberId, userId, memberCode, memberType, defaultTier ? defaultTier.id : null]
      );
      inserted = true;
    } catch (err: any) {
      if (err?.code === "ER_DUP_ENTRY" && err.message?.includes("uq_members_member_code")) {
        memberCode = generateMemberCode();
      } else if (err?.code === "ER_DUP_ENTRY" && err.message?.includes("uq_members_user_id")) {
        // Balapan: user lain sudah meng-insert
        const [recheck]: any = await executor.query("SELECT * FROM members WHERE user_id = ?", [userId]);
        return recheck[0];
      } else {
        throw err;
      }
    }
  }

  // Buat loyalty account (sinkronkan saldo awal dari users.coin_balance bila ada, mis. bonus daftar 100 poin)
  const [uRows]: any = await executor.query("SELECT coin_balance FROM users WHERE id = ?", [userId]);
  const initialPoints = Math.max(0, Number(uRows?.[0]?.coin_balance || 0));
  const accId = `la-${crypto.randomUUID()}`;
  await executor.query(
    "INSERT INTO loyalty_accounts (id, member_id, current_period_id, current_points, lifetime_earned_points, lifetime_redeemed_points) VALUES (?, ?, ?, ?, ?, 0)",
    [accId, memberId, activePeriod ? activePeriod.id : null, initialPoints, initialPoints]
  );
  if (initialPoints > 0) {
    try {
      await executor.query(
        `INSERT INTO loyalty_transactions (id, loyalty_account_id, period_id, transaction_type, points, reference_type, reference_id, idempotency_key, description)
         VALUES (?, ?, ?, 'BONUS', ?, 'WELCOME', ?, ?, 'Bonus Pendaftaran Member')`,
        [`lt-${crypto.randomUUID()}`, accId, activePeriod ? activePeriod.id : null, initialPoints, userId, `welcome:${userId}`]
      );
    } catch (_) {}
  }

  // Buat member identifiers jika ada
  if (userProfile) {
    if (userProfile.nim) {
      try {
        await executor.query(
          "INSERT IGNORE INTO member_identifiers (id, member_id, identifier_type, identifier_value, is_primary, is_verified) VALUES (?, ?, 'STUDENT_NIM', ?, 1, 0)",
          [`mi-${crypto.randomUUID()}`, memberId, userProfile.nim.trim()]
        );
      } catch (_) {}
    }
    if (userProfile.email) {
      try {
        await executor.query(
          "INSERT IGNORE INTO member_identifiers (id, member_id, identifier_type, identifier_value, is_primary, is_verified) VALUES (?, ?, 'EMAIL', ?, 1, 0)",
          [`mi-${crypto.randomUUID()}`, memberId, userProfile.email.trim().toLowerCase()]
        );
      } catch (_) {}
    }
    if (userProfile.phone) {
      try {
        await executor.query(
          "INSERT IGNORE INTO member_identifiers (id, member_id, identifier_type, identifier_value, is_primary, is_verified) VALUES (?, ?, 'PHONE', ?, 1, 0)",
          [`mi-${crypto.randomUUID()}`, memberId, userProfile.phone.trim()]
        );
      } catch (_) {}
    }
  }

  const [created]: any = await executor.query("SELECT * FROM members WHERE id = ?", [memberId]);
  return created[0];
}

export async function getMemberProfile(userIdOrMemberId: string): Promise<MemberProfile | null> {
  const [rows]: any = await db.query(
    `SELECT 
      u.id AS user_id, u.nama, u.email, u.phone, u.avatar_url, u.role,
      m.id AS member_id, m.member_code, m.member_type, m.status AS member_status, m.joined_at,
      la.id AS account_id, la.current_points, la.lifetime_earned_points, la.lifetime_redeemed_points,
      mt.id AS tier_id, mt.code AS tier_code, mt.name AS tier_name, mt.min_spending, mt.max_spending, mt.multiplier, mt.benefit_description,
      lp.id AS period_id, lp.code AS period_code, lp.name AS period_name, lp.start_date, lp.end_date, lp.status AS period_status
     FROM users u
     JOIN members m ON m.user_id = u.id
     LEFT JOIN loyalty_accounts la ON la.member_id = m.id
     LEFT JOIN member_tiers mt ON mt.id = m.current_tier_id
     LEFT JOIN loyalty_periods lp ON lp.id = la.current_period_id
     WHERE u.id = ? OR m.id = ?
     LIMIT 1`,
    [userIdOrMemberId, userIdOrMemberId]
  );

  if (rows.length === 0) return null;
  const r = rows[0];

  return {
    user: {
      id: r.user_id,
      nama: r.nama,
      email: r.email,
      phone: r.phone,
      avatar_url: r.avatar_url,
      role: r.role,
    },
    member: {
      id: r.member_id,
      memberCode: r.member_code,
      memberType: r.member_type,
      status: r.member_status,
      joinedAt: r.joined_at,
    },
    loyalty: {
      accountId: r.account_id || "",
      currentPoints: Number(r.current_points || 0),
      lifetimeEarnedPoints: Number(r.lifetime_earned_points || 0),
      lifetimeRedeemedPoints: Number(r.lifetime_redeemed_points || 0),
    },
    tier: r.tier_id
      ? {
          id: r.tier_id,
          code: r.tier_code,
          name: r.tier_name,
          minSpending: Number(r.min_spending || 0),
          maxSpending: r.max_spending !== null ? Number(r.max_spending) : null,
          multiplier: Number(r.multiplier || 1),
          benefitDescription: r.benefit_description,
        }
      : null,
    period: r.period_id
      ? {
          id: r.period_id,
          code: r.period_code,
          name: r.period_name,
          startDate: r.start_date,
          endDate: r.end_date,
          status: r.period_status,
        }
      : null,
  };
}

export async function getLoyaltyBalance(memberId: string): Promise<{
  currentPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
}> {
  const [rows]: any = await db.query(
    "SELECT current_points, lifetime_earned_points, lifetime_redeemed_points FROM loyalty_accounts WHERE member_id = ?",
    [memberId]
  );
  if (rows.length === 0) {
    return { currentPoints: 0, lifetimeEarnedPoints: 0, lifetimeRedeemedPoints: 0 };
  }
  return {
    currentPoints: Number(rows[0].current_points || 0),
    lifetimeEarnedPoints: Number(rows[0].lifetime_earned_points || 0),
    lifetimeRedeemedPoints: Number(rows[0].lifetime_redeemed_points || 0),
  };
}

export async function getLoyaltyTransactions(
  memberId: string,
  options: { limit?: number; offset?: number; periodId?: string } = {}
) {
  const limit = Math.max(1, Math.min(100, options.limit || 20));
  const offset = Math.max(0, options.offset || 0);

  const [acc]: any = await db.query(
    "SELECT id FROM loyalty_accounts WHERE member_id = ?",
    [memberId]
  );
  if (acc.length === 0) return { total: 0, transactions: [] };
  const accountId = acc[0].id;

  let countSql = "SELECT COUNT(*) as total FROM loyalty_transactions WHERE loyalty_account_id = ?";
  let dataSql = `
    SELECT id, period_id, transaction_type, points, reference_type, reference_id,
           idempotency_key, description, created_at
    FROM loyalty_transactions
    WHERE loyalty_account_id = ?
  `;
  const params: any[] = [accountId];

  if (options.periodId) {
    countSql += " AND period_id = ?";
    dataSql += " AND period_id = ?";
    params.push(options.periodId);
  }

  const [countRows]: any = await db.query(countSql, params);
  const total = countRows[0]?.total || 0;

  dataSql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  const dataParams = [...params, limit, offset];
  const [rows]: any = await db.query(dataSql, dataParams);

  return {
    total,
    limit,
    offset,
    transactions: rows.map((r: any) => ({
      id: r.id,
      periodId: r.period_id,
      transactionType: r.transaction_type,
      points: Number(r.points),
      referenceType: r.reference_type,
      referenceId: r.reference_id,
      idempotencyKey: r.idempotency_key,
      description: r.description,
      createdAt: r.created_at,
    })),
  };
}

/**
 * Menambahkan poin ke loyalty account secara atomik dengan SELECT FOR UPDATE.
 * Menjamin idempoten berdasarkan idempotency_key atau (reference_type, reference_id).
 */
export async function creditPoints({
  connection,
  memberId,
  points,
  transactionType = "PURCHASE",
  referenceType = null,
  referenceId = null,
  idempotencyKey = null,
  description = null,
}: {
  connection: PoolConnection;
  memberId: string;
  points: number;
  transactionType?: LoyaltyTxType;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  description?: string | null;
}): Promise<{ credited: number; newBalance: number; repeated?: boolean }> {
  const pointsToCredit = Math.floor(Number(points));
  if (pointsToCredit <= 0) {
    const bal = await getLoyaltyBalance(memberId);
    return { credited: 0, newBalance: bal.currentPoints };
  }

  // 1. Cek Idempotency Key
  if (idempotencyKey) {
    const [existingTx]: any = await connection.query(
      "SELECT id, points FROM loyalty_transactions WHERE idempotency_key = ? FOR UPDATE",
      [idempotencyKey]
    );
    if (existingTx.length > 0) {
      const [acc]: any = await connection.query(
        "SELECT current_points FROM loyalty_accounts WHERE member_id = ?",
        [memberId]
      );
      return {
        credited: Number(existingTx[0].points),
        newBalance: Number(acc[0]?.current_points || 0),
        repeated: true,
      };
    }
  }

  // 2. Cek Order Reference Deduplication
  if (referenceType === "ORDER" && referenceId) {
    const [existingOrderTx]: any = await connection.query(
      "SELECT id, points FROM loyalty_transactions WHERE reference_type = 'ORDER' AND reference_id = ? FOR UPDATE",
      [referenceId]
    );
    if (existingOrderTx.length > 0) {
      const [acc]: any = await connection.query(
        "SELECT current_points FROM loyalty_accounts WHERE member_id = ?",
        [memberId]
      );
      return {
        credited: 0,
        newBalance: Number(acc[0]?.current_points || 0),
        repeated: true,
      };
    }
  }

  // 3. Lock Loyalty Account
  const [accRows]: any = await connection.query(
    "SELECT id, current_period_id, current_points, lifetime_earned_points FROM loyalty_accounts WHERE member_id = ? FOR UPDATE",
    [memberId]
  );
  if (accRows.length === 0) {
    throw new Error("Loyalty account tidak ditemukan untuk member");
  }
  const acc = accRows[0];

  const newBalance = Number(acc.current_points) + pointsToCredit;
  const newLifetime = Number(acc.lifetime_earned_points) + pointsToCredit;

  // 4. Update saldo akun
  await connection.query(
    "UPDATE loyalty_accounts SET current_points = ?, lifetime_earned_points = ?, updated_at = NOW() WHERE id = ?",
    [newBalance, newLifetime, acc.id]
  );

  // 5. Insert ledger transaksi
  const txId = `lt-${crypto.randomUUID()}`;
  await connection.query(
    `INSERT INTO loyalty_transactions 
     (id, loyalty_account_id, period_id, transaction_type, points, reference_type, reference_id, idempotency_key, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      txId,
      acc.id,
      acc.current_period_id,
      transactionType,
      pointsToCredit,
      referenceType,
      referenceId,
      idempotencyKey,
      description,
    ]
  );

  // 6. Sinkronkan users.coin_balance agar selalu identik dengan loyalty_accounts.current_points
  await connection.query(
    "UPDATE users u JOIN members m ON m.user_id = u.id SET u.coin_balance = ? WHERE m.id = ?",
    [newBalance, memberId]
  );

  return { credited: pointsToCredit, newBalance, repeated: false };
}

/**
 * Mengurangi poin dari loyalty account secara atomik.
 * Menolak jika saldo tidak cukup (saldo tidak boleh menjadi negatif).
 */
export async function debitPoints({
  connection,
  memberId,
  points,
  transactionType = "REDEMPTION",
  referenceType = null,
  referenceId = null,
  idempotencyKey = null,
  description = null,
}: {
  connection: PoolConnection;
  memberId: string;
  points: number;
  transactionType?: LoyaltyTxType;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  description?: string | null;
}): Promise<{ debited: number; newBalance: number; repeated?: boolean }> {
  const pointsToDebit = Math.floor(Number(points));
  if (pointsToDebit <= 0) {
    throw new Error("Jumlah poin untuk didebit harus lebih besar dari 0");
  }

  // 1. Cek Idempotency Key
  if (idempotencyKey) {
    const [existingTx]: any = await connection.query(
      "SELECT id, points FROM loyalty_transactions WHERE idempotency_key = ? FOR UPDATE",
      [idempotencyKey]
    );
    if (existingTx.length > 0) {
      const [acc]: any = await connection.query(
        "SELECT current_points FROM loyalty_accounts WHERE member_id = ?",
        [memberId]
      );
      return {
        debited: Math.abs(Number(existingTx[0].points)),
        newBalance: Number(acc[0]?.current_points || 0),
        repeated: true,
      };
    }
  }

  // 2. Lock Loyalty Account
  const [accRows]: any = await connection.query(
    "SELECT id, current_period_id, current_points, lifetime_redeemed_points FROM loyalty_accounts WHERE member_id = ? FOR UPDATE",
    [memberId]
  );
  if (accRows.length === 0) {
    throw new Error("Loyalty account tidak ditemukan untuk member");
  }
  const acc = accRows[0];

  const currentPoints = Number(acc.current_points);
  if (currentPoints < pointsToDebit) {
    const err: any = new Error(`Poin tidak mencukupi. Butuh ${pointsToDebit}, saldo saat ini ${currentPoints}`);
    err.code = "INSUFFICIENT_POINTS";
    throw err;
  }

  const newBalance = currentPoints - pointsToDebit;
  const newLifetimeRedeemed = Number(acc.lifetime_redeemed_points) + pointsToDebit;

  // 3. Update saldo akun
  await connection.query(
    "UPDATE loyalty_accounts SET current_points = ?, lifetime_redeemed_points = ?, updated_at = NOW() WHERE id = ?",
    [newBalance, newLifetimeRedeemed, acc.id]
  );

  // 4. Insert ledger transaksi (Points bernilai negatif untuk debit)
  const txId = `lt-${crypto.randomUUID()}`;
  await connection.query(
    `INSERT INTO loyalty_transactions 
     (id, loyalty_account_id, period_id, transaction_type, points, reference_type, reference_id, idempotency_key, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      txId,
      acc.id,
      acc.current_period_id,
      transactionType,
      -pointsToDebit,
      referenceType,
      referenceId,
      idempotencyKey,
      description,
    ]
  );

  // 5. Sinkronkan users.coin_balance agar selalu identik dengan loyalty_accounts.current_points
  await connection.query(
    "UPDATE users u JOIN members m ON m.user_id = u.id SET u.coin_balance = ? WHERE m.id = ?",
    [newBalance, memberId]
  );

  return { debited: pointsToDebit, newBalance, repeated: false };
}

/**
 * Manual adjustment poin oleh staff/admin dengan alasan wajib.
 */
export async function manualAdjustPoints({
  memberId,
  points,
  reason,
  staffActor,
}: {
  memberId: string;
  points: number;
  reason: string;
  staffActor: string;
}): Promise<{ adjusted: number; newBalance: number }> {
  if (!reason || reason.trim().length === 0) {
    const err: any = new Error("Alasan penyesuaian poin wajib diisi");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const intPoints = Math.trunc(Number(points));
  if (intPoints === 0 || !Number.isFinite(intPoints)) {
    const err: any = new Error("Jumlah poin penyesuaian tidak boleh nol");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let res;
    const desc = `Penyesuaian Manual oleh ${staffActor}: ${reason.trim()}`;
    const key = `adj-${crypto.randomUUID()}`;

    if (intPoints > 0) {
      res = await creditPoints({
        connection: conn,
        memberId,
        points: intPoints,
        transactionType: "ADJUSTMENT",
        idempotencyKey: key,
        description: desc,
      });
    } else {
      res = await debitPoints({
        connection: conn,
        memberId,
        points: Math.abs(intPoints),
        transactionType: "ADJUSTMENT",
        idempotencyKey: key,
        description: desc,
      });
    }

    await conn.commit();
    await addAuditLog(staffActor, "Penyesuaian Poin", `Member ${memberId} (${intPoints > 0 ? "+" : ""}${intPoints} pts) - ${reason}`);
    return { adjusted: intPoints, newBalance: res.newBalance };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Evaluasi Tier berdasarkan total eligible spending dalam active period.
 */
export async function evaluateMemberTier(connection: PoolConnection, memberId: string): Promise<any> {
  const [memberRows]: any = await connection.query(
    "SELECT id, user_id, current_tier_id FROM members WHERE id = ? FOR UPDATE",
    [memberId]
  );
  if (memberRows.length === 0) return null;
  const member = memberRows[0];

  const activePeriod = await getActiveLoyaltyPeriod(connection);
  if (!activePeriod) return null;

  // Hitung eligible spending dari orders lunas di active period
  const [spendingRows]: any = await connection.query(
    `SELECT COALESCE(SUM(total_price), 0) AS total_spending
     FROM orders
     WHERE user_id = ?
       AND payment_status = 'lunas'
       AND status NOT IN ('Dibatalkan', 'ditolak')
       AND created_at >= ? AND created_at <= ?`,
    [member.user_id, activePeriod.start_date, activePeriod.end_date]
  );
  const eligibleSpending = Number(spendingRows[0]?.total_spending || 0);

  // Ambil semua tiers urut min_spending DESC
  const [tiers]: any = await connection.query(
    "SELECT * FROM member_tiers WHERE status = 'ACTIVE' ORDER BY min_spending DESC"
  );
  if (tiers.length === 0) return null;

  const targetTier = tiers.find((t: any) => eligibleSpending >= Number(t.min_spending)) || tiers[tiers.length - 1];

  if (member.current_tier_id !== targetTier.id) {
    const prevTierId = member.current_tier_id;
    await connection.query(
      "UPDATE members SET current_tier_id = ?, updated_at = NOW() WHERE id = ?",
      [targetTier.id, memberId]
    );

    const historyId = `mth-${crypto.randomUUID()}`;
    await connection.query(
      `INSERT INTO member_tier_histories 
       (id, member_id, tier_id, previous_tier_id, period_id, eligible_spending, change_reason, effective_at)
       VALUES (?, ?, ?, ?, ?, ?, 'SPENDING_THRESHOLD_REACHED', NOW())`,
      [historyId, memberId, targetTier.id, prevTierId, activePeriod.id, eligibleSpending]
    );
  }

  return targetTier;
}
