import { Router, Request, Response } from "express";
import crypto from "crypto";
import { db, addAuditLog } from "../db/db.js";
import { requireAuthenticated, requireRoles, getVerifiedActor } from "../middleware/authSession.js";
import {
  ensureMemberForUser,
  getMemberProfile,
  getLoyaltyBalance,
  getLoyaltyTransactions,
  creditPoints,
  manualAdjustPoints,
  evaluateMemberTier,
  LoyaltyTxType,
} from "../lib/membershipService.js";
import {
  getActiveRewardsCatalog,
  atomicRedeemReward,
  validateRedemptionCode,
  fulfillRedemption,
} from "../lib/rewardService.js";

const router = Router();

const requireStaff = requireRoles("Super Admin", "Admin", "Kasir");
const requireAdmin = requireRoles("Super Admin", "Admin");
const requireSuperAdmin = requireRoles("Super Admin");

// Helper: ambil atau pastikan member untuk token yang terautentikasi
async function resolveAuthMember(req: Request) {
  const auth = (req as any).auth;
  if (!auth?.id) return null;
  return await ensureMemberForUser(db, String(auth.id));
}

// ==============================================================================
// 1. MEMBER SELF-SERVICE ENDPOINTS
// ==============================================================================

// GET /api/members/me — Profil lengkap member saat ini
router.get("/me", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const member = await resolveAuthMember(req);
    if (!member) {
      return res.status(404).json({ code: "MEMBER_NOT_FOUND", message: "Profil member tidak ditemukan" });
    }

    const profile = await getMemberProfile(member.id);
    if (!profile) {
      return res.status(404).json({ code: "MEMBER_NOT_FOUND", message: "Profil member tidak ditemukan" });
    }

    res.json({
      status: "success",
      data: profile,
    });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat profil member", error: err.message });
  }
});

// GET /api/members/me/loyalty/balance — Saldo poin member
router.get("/me/loyalty/balance", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const member = await resolveAuthMember(req);
    if (!member) {
      return res.status(404).json({ code: "MEMBER_NOT_FOUND", message: "Member tidak ditemukan" });
    }

    const balance = await getLoyaltyBalance(member.id);
    res.json({
      status: "success",
      data: balance,
    });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat saldo poin", error: err.message });
  }
});

// GET /api/members/me/loyalty/transactions — Riwayat transaksi ledger poin
router.get("/me/loyalty/transactions", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const member = await resolveAuthMember(req);
    if (!member) {
      return res.status(404).json({ code: "MEMBER_NOT_FOUND", message: "Member tidak ditemukan" });
    }

    const limit = parseInt(String(req.query.limit || "20"), 10);
    const offset = parseInt(String(req.query.offset || "0"), 10);
    const periodId = req.query.period_id ? String(req.query.period_id) : undefined;

    const result = await getLoyaltyTransactions(member.id, { limit, offset, periodId });
    res.json({
      status: "success",
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat riwayat poin", error: err.message });
  }
});

// GET /api/members/me/redemptions — Riwayat penukaran reward member
router.get("/me/redemptions", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const member = await resolveAuthMember(req);
    if (!member) {
      return res.status(404).json({ code: "MEMBER_NOT_FOUND", message: "Member tidak ditemukan" });
    }

    const [rows]: any = await db.query(
      `SELECT r.id AS redemptionId, r.redemption_code AS redemptionCode, r.status,
              r.points_used AS pointsUsed, r.redeemed_at AS redeemedAt, r.expires_at AS expiresAt,
              r.fulfilled_at AS fulfilledAt, rw.id AS rewardId, rw.name AS rewardName,
              rw.description, rw.discount_type AS discountType, rw.discount_value AS discountValue,
              rw.image_url AS image, rw.category
       FROM redemptions r
       JOIN rewards rw ON rw.id = r.reward_id
       WHERE r.member_id = ?
       ORDER BY r.redeemed_at DESC`,
      [member.id]
    );

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat voucher", error: err.message });
  }
});

// GET /api/members/:memberId/redemptions — Kompatibilitas route GAMI
router.get("/:memberId/redemptions", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const targetMemberId = req.params.memberId;
    const currentAuth = (req as any).auth;

    // Jika pemanggil adalah pelanggan, hanya boleh melihat datanya sendiri
    if (currentAuth?.role === "Pelanggan") {
      const ownMember = await resolveAuthMember(req);
      if (!ownMember || String(ownMember.id) !== String(targetMemberId)) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Anda hanya dapat melihat data akun sendiri" });
      }
    }

    const [rows]: any = await db.query(
      `SELECT r.id AS redemptionId, r.redemption_code AS redemptionCode, r.status,
              r.points_used AS pointsUsed, r.redeemed_at AS redeemedAt, r.expires_at AS expiresAt,
              r.fulfilled_at AS fulfilledAt, rw.id AS rewardId, rw.name AS rewardName,
              rw.description, rw.discount_type AS discountType, rw.discount_value AS discountValue,
              rw.image_url AS image, rw.category
       FROM redemptions r
       JOIN rewards rw ON rw.id = r.reward_id
       WHERE r.member_id = ?
       ORDER BY r.redeemed_at DESC`,
      [targetMemberId]
    );

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat voucher", error: err.message });
  }
});

// POST /api/members/:memberId/rewards/:rewardId/redeem — Kompatibilitas route GAMI
router.post("/:memberId/rewards/:rewardId/redeem", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const { memberId, rewardId } = req.params;
    const currentAuth = (req as any).auth;

    // Strict Authorization: Caller must own the member record
    if (currentAuth?.role === "Pelanggan") {
      const ownMember = await resolveAuthMember(req);
      if (!ownMember || String(ownMember.id) !== String(memberId)) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Anda hanya dapat menukarkan poin milik akun sendiri" });
      }
    }

    const idempotencyKey = (req.headers["idempotency-key"] as string) || (req.body?.idempotencyKey as string) || null;

    const result = await atomicRedeemReward({
      memberId,
      rewardId,
      idempotencyKey,
    });

    const statusCode = result.isIdempotentReplay ? 200 : 201;
    res.status(statusCode).json(result);
  } catch (err: any) {
    const status = err.statusCode || 500;
    const code = err.code || "INTERNAL_ERROR";
    res.status(status).json({ code, message: err.message });
  }
});

// GET /api/members/:memberId/loyalty/balance — Saldo poin member
router.get("/:memberId/loyalty/balance", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const targetMemberId = req.params.memberId;
    const currentAuth = (req as any).auth;

    if (currentAuth?.role === "Pelanggan") {
      const ownMember = await resolveAuthMember(req);
      if (!ownMember || String(ownMember.id) !== String(targetMemberId)) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Anda hanya dapat melihat data akun sendiri" });
      }
    }

    const balance = await getLoyaltyBalance(targetMemberId);
    const profile = await getMemberProfile(targetMemberId);

    const data = {
      memberId: targetMemberId,
      currentPoints: balance.currentPoints,
      pointsBalance: balance.currentPoints,
      lifetimeEarned: balance.lifetimeEarnedPoints,
      lifetimeRedeemed: balance.lifetimeRedeemedPoints,
      currentTier: profile?.tier?.name || "Classmate",
    };

    res.json({
      status: "success",
      success: true,
      data,
      ...data,
    });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat saldo poin", error: err.message });
  }
});

// POST /api/members/:memberId/loyalty/points/earn — Tambah poin game atau belajar (Idempoten)
router.post("/:memberId/loyalty/points/earn", requireAuthenticated, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { memberId } = req.params;
    const currentAuth = (req as any).auth;

    if (currentAuth?.role === "Pelanggan") {
      const ownMember = await resolveAuthMember(req);
      if (!ownMember || String(ownMember.id) !== String(memberId)) {
        await connection.rollback();
        return res.status(403).json({ code: "FORBIDDEN", message: "Anda hanya dapat menambahkan poin untuk akun sendiri" });
      }
    }

    const { points, source, referenceType, referenceId, description } = req.body;
    const idempotencyKey = (req.headers["idempotency-key"] as string) || (req.body?.idempotencyKey as string) || null;
    const pointsNum = Math.floor(Number(points));

    if (isNaN(pointsNum) || pointsNum <= 0) {
      await connection.rollback();
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Jumlah poin wajib angka lebih dari 0" });
    }

    const txType: LoyaltyTxType = (source === "GAME" ? "GAMIFICATION" : (source === "STUDY" ? "BONUS" : "GAMIFICATION"));

    const creditResult = await creditPoints({
      connection,
      memberId,
      points: pointsNum,
      transactionType: txType,
      referenceType: referenceType || (source === "GAME" ? "GAME_PLAY" : "STUDY_SESSION"),
      referenceId: referenceId || null,
      idempotencyKey,
      description: description || `Perolehan poin dari ${source || 'aktivitas'}`,
    });

    // Sinkronkan juga ke saldo koin legacy users.coin_balance jika belum pernah tercatat
    if (!creditResult.repeated) {
      const [members]: any = await connection.query("SELECT user_id FROM members WHERE id = ?", [memberId]);
      if (members.length > 0) {
        await connection.query("UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?", [creditResult.credited, members[0].user_id]);
      }
    }

    await connection.commit();

    const txId = `ltx-${Date.now()}`;
    const resultData = {
      transactionId: txId,
      memberId,
      transactionType: "EARN",
      points: creditResult.credited,
      currentPoints: creditResult.newBalance,
      referenceType: referenceType || "GAME_PLAY",
      referenceId: referenceId || null,
    };

    const statusCode = creditResult.repeated ? 200 : 201;
    res.status(statusCode).json({
      status: "success",
      success: true,
      data: resultData,
      ...resultData,
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal menambahkan poin loyalty", error: err.message });
  } finally {
    connection.release();
  }
});

// ==============================================================================
// 2. REWARDS CATALOG & REDEEM
// ==============================================================================

// GET /api/rewards — Katalog reward aktif
export const rewardsCatalogRouter = Router();

rewardsCatalogRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const catalog = await getActiveRewardsCatalog();
    res.json(catalog);
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat katalog reward", error: err.message });
  }
});

// POST /api/rewards/:rewardId/redeem — Tukar reward untuk authenticated member
rewardsCatalogRouter.post("/:rewardId/redeem", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const { rewardId } = req.params;
    const member = await resolveAuthMember(req);
    if (!member) {
      return res.status(404).json({ code: "MEMBER_NOT_FOUND", message: "Member tidak ditemukan" });
    }

    const idempotencyKey = (req.headers["idempotency-key"] as string) || (req.body?.idempotencyKey as string) || null;

    const result = await atomicRedeemReward({
      memberId: member.id,
      rewardId,
      idempotencyKey,
    });

    const statusCode = result.isIdempotentReplay ? 200 : 201;
    res.status(statusCode).json({
      status: "success",
      data: result,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    const code = err.code || "INTERNAL_ERROR";
    res.status(status).json({ code, message: err.message });
  }
});

// ==============================================================================
// 3. STAFF DESK & FULFILLMENT ENDPOINTS
// ==============================================================================

export const loyaltyStaffRouter = Router();

// POST /api/loyalty/redemptions/validate — Kasir memvalidasi kode voucher
loyaltyStaffRouter.post("/redemptions/validate", requireStaff, async (req: Request, res: Response) => {
  try {
    const code = req.body?.code || req.body?.redemption_code || req.body?.voucher_code;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Kode penukaran wajib diisi" });
    }

    const result = await validateRedemptionCode(code);
    res.json({
      status: "success",
      data: result,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    const code = err.code || "INTERNAL_ERROR";
    res.status(status).json({ code, message: err.message });
  }
});

// POST /api/loyalty/redemptions/:code/fulfill — Kasir menyelesaikan/menggunakan voucher
loyaltyStaffRouter.post("/redemptions/:code/fulfill", requireStaff, async (req: Request, res: Response) => {
  try {
    const code = req.params.code;
    const auth = (req as any).auth;
    const staffId = auth?.id || "S000";
    const staffName = auth?.name || getVerifiedActor(req);

    const result = await fulfillRedemption({
      code,
      staffId,
      staffName,
    });

    res.json({
      status: "success",
      data: result,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    const code = err.code || "INTERNAL_ERROR";
    res.status(status).json({ code, message: err.message });
  }
});

// ==============================================================================
// 4. ADMIN & SUPER ADMIN MANAGEMENT ENDPOINTS
// ==============================================================================

// GET /api/loyalty/members — Pencarian dan daftar member
loyaltyStaffRouter.get("/members", requireStaff, async (req: Request, res: Response) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : "";
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || "20"), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10));

    let countSql = `
      SELECT COUNT(*) AS total
      FROM members m
      JOIN users u ON u.id = m.user_id
    `;
    let dataSql = `
      SELECT m.id AS member_id, m.member_code, m.member_type, m.status, m.joined_at,
             u.id AS user_id, u.nama, u.email, u.phone, u.avatar_url,
             COALESCE(la.current_points, 0) AS current_points,
             mt.name AS tier_name
      FROM members m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN loyalty_accounts la ON la.member_id = m.id
      LEFT JOIN member_tiers mt ON mt.id = m.current_tier_id
    `;
    const params: any[] = [];

    if (search) {
      const condition = ` WHERE u.nama LIKE ? OR m.member_code LIKE ? OR u.phone LIKE ? OR u.email LIKE ?`;
      countSql += condition;
      dataSql += condition;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const [countRows]: any = await db.query(countSql, params);
    const total = countRows[0]?.total || 0;

    dataSql += ` ORDER BY m.joined_at DESC LIMIT ? OFFSET ?`;
    const [rows]: any = await db.query(dataSql, [...params, limit, offset]);

    res.json({
      status: "success",
      data: {
        total,
        limit,
        offset,
        members: rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat daftar member", error: err.message });
  }
});

// GET /api/loyalty/members/:id — Detail akun member
loyaltyStaffRouter.get("/members/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await getMemberProfile(id);
    if (!profile) {
      return res.status(404).json({ code: "MEMBER_NOT_FOUND", message: "Member tidak ditemukan" });
    }

    // Ambil riwayat tier
    const [tierHistories]: any = await db.query(
      `SELECT mth.id, mth.eligible_spending, mth.change_reason, mth.effective_at,
              mt.name AS tier_name, prev.name AS prev_tier_name, lp.name AS period_name
       FROM member_tier_histories mth
       JOIN member_tiers mt ON mt.id = mth.tier_id
       LEFT JOIN member_tiers prev ON prev.id = mth.previous_tier_id
       LEFT JOIN loyalty_periods lp ON lp.id = mth.period_id
       WHERE mth.member_id = ?
       ORDER BY mth.effective_at DESC LIMIT 10`,
      [profile.member.id]
    );

    res.json({
      status: "success",
      data: {
        ...profile,
        tierHistories,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat profil member", error: err.message });
  }
});

// POST /api/loyalty/adjust — Penyesuaian manual poin oleh Admin
loyaltyStaffRouter.post("/adjust", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { memberId, points, reason } = req.body;
    if (!memberId || points === undefined || !reason) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "memberId, points, dan reason wajib diisi" });
    }

    const staffActor = getVerifiedActor(req);
    const result = await manualAdjustPoints({
      memberId,
      points: Number(points),
      reason: String(reason),
      staffActor,
    });

    res.json({
      status: "success",
      message: `Poin berhasil disesuaikan (${result.adjusted > 0 ? "+" : ""}${result.adjusted} poin)`,
      data: result,
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    const code = err.code || "ADJUSTMENT_FAILED";
    res.status(status).json({ code, message: err.message });
  }
});

// GET /api/loyalty/rewards — Admin Rewards List
loyaltyStaffRouter.get("/rewards", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [rewards]: any = await db.query("SELECT * FROM rewards ORDER BY created_at DESC");
    res.json({ status: "success", data: rewards });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat data reward", error: err.message });
  }
});

// POST /api/loyalty/rewards — Buat reward baru
loyaltyStaffRouter.post("/rewards", requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      points_required,
      stock,
      is_unlimited,
      valid_from,
      valid_until,
      category,
      discount_type,
      discount_value,
      image_url,
    } = req.body;

    if (!name || points_required === undefined) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Nama dan points_required wajib diisi" });
    }

    const rewardId = `rew-${crypto.randomUUID()}`;
    const code = `REW-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const pointsNum = Math.max(0, parseInt(String(points_required), 10));
    const unlimited = is_unlimited !== undefined ? (is_unlimited ? 1 : 0) : stock === null || stock === undefined ? 1 : 0;
    const stockNum = unlimited ? null : Math.max(0, parseInt(String(stock || "0"), 10));

    await db.query(
      `INSERT INTO rewards 
       (id, code, name, description, points_required, stock, is_unlimited, valid_from, valid_until, status, category, discount_type, discount_value, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
      [
        rewardId,
        code,
        name.trim(),
        description || null,
        pointsNum,
        stockNum,
        unlimited,
        valid_from || null,
        valid_until || null,
        category || "Food",
        discount_type || null,
        discount_value !== undefined ? Number(discount_value) : null,
        image_url || null,
      ]
    );

    const [created]: any = await db.query("SELECT * FROM rewards WHERE id = ?", [rewardId]);
    await addAuditLog(getVerifiedActor(req), "Buat Reward", `${name} (${pointsNum} poin)`);

    res.status(201).json({ status: "success", data: created[0] });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal membuat reward", error: err.message });
  }
});

// PATCH /api/loyalty/rewards/:id — Update / toggle status reward
loyaltyStaffRouter.patch("/rewards/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, points_required, stock, is_unlimited, valid_from, valid_until, status, category } = req.body;

    const [existing]: any = await db.query("SELECT * FROM rewards WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ code: "REWARD_NOT_FOUND", message: "Reward tidak ditemukan" });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push("name = ?"); params.push(name.trim()); }
    if (description !== undefined) { updates.push("description = ?"); params.push(description); }
    if (points_required !== undefined) { updates.push("points_required = ?"); params.push(Math.max(0, Number(points_required))); }
    if (stock !== undefined) { updates.push("stock = ?"); params.push(stock !== null ? Number(stock) : null); }
    if (is_unlimited !== undefined) { updates.push("is_unlimited = ?"); params.push(is_unlimited ? 1 : 0); }
    if (valid_from !== undefined) { updates.push("valid_from = ?"); params.push(valid_from || null); }
    if (valid_until !== undefined) { updates.push("valid_until = ?"); params.push(valid_until || null); }
    if (status !== undefined) { updates.push("status = ?"); params.push(status); }
    if (category !== undefined) { updates.push("category = ?"); params.push(category); }

    if (updates.length > 0) {
      params.push(id);
      await db.query(`UPDATE rewards SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);
    }

    const [updated]: any = await db.query("SELECT * FROM rewards WHERE id = ?", [id]);
    await addAuditLog(getVerifiedActor(req), "Update Reward", `Reward ${id} (${status || "updated"})`);

    res.json({ status: "success", data: updated[0] });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memperbarui reward", error: err.message });
  }
});

// GET /api/loyalty/redemptions — Riwayat penukaran global untuk Admin
loyaltyStaffRouter.get("/redemptions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || "50"), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10));

    const [rows]: any = await db.query(
      `SELECT r.id, r.redemption_code, r.points_used, r.status, r.redeemed_at, r.expires_at, r.fulfilled_at,
              rw.name AS reward_name, m.member_code, u.nama AS member_name, s.name AS fulfilled_by_staff_name
       FROM redemptions r
       JOIN rewards rw ON rw.id = r.reward_id
       JOIN members m ON m.id = r.member_id
       JOIN users u ON u.id = m.user_id
       LEFT JOIN staff s ON s.id = r.fulfilled_by_staff_id
       ORDER BY r.redeemed_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({ status: "success", data: rows });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat daftar redemption", error: err.message });
  }
});

// GET /api/loyalty/transactions — Log transaksi poin global
loyaltyStaffRouter.get("/transactions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || "50"), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10));

    const [rows]: any = await db.query(
      `SELECT lt.id, lt.transaction_type, lt.points, lt.reference_type, lt.reference_id,
              lt.idempotency_key, lt.description, lt.created_at,
              m.member_code, u.nama AS user_name, lp.name AS period_name
       FROM loyalty_transactions lt
       JOIN loyalty_accounts la ON la.id = lt.loyalty_account_id
       JOIN members m ON m.id = la.member_id
       JOIN users u ON u.id = m.user_id
       LEFT JOIN loyalty_periods lp ON lp.id = lt.period_id
       ORDER BY lt.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({ status: "success", data: rows });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat log transaksi", error: err.message });
  }
});

// GET /api/loyalty/periods — Daftar periode loyalty
loyaltyStaffRouter.get("/periods", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const [periods]: any = await db.query("SELECT * FROM loyalty_periods ORDER BY start_date DESC");
    res.json({ status: "success", data: periods });
  } catch (err: any) {
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Gagal memuat periode", error: err.message });
  }
});

export default router;
