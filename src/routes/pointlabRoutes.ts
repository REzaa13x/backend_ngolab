import { Router, Request, Response } from "express";
import crypto from "crypto";
import { db, addAuditLog } from "../db/db.js";
import { requireAuthenticated } from "../middleware/authSession.js";
import { getMemberProfile } from "../lib/membershipService.js";

// ==============================================================================
// 1. COINS ROUTER (/api/coins)
// ==============================================================================
export const coinsRouter = Router();

// GET /api/coins/balance — Mengambil saldo poin & riwayat akumulasi untuk kalkulasi Tier
coinsRouter.get("/balance", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const [users]: any = await db.query(
      "SELECT id, coin_balance FROM users WHERE id = ?",
      [auth.id]
    );
    if (!users.length) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan" });
    }
    const profile = await getMemberProfile(auth.id);

    // Hitung akumulasi koin masuk
    const [txRows]: any = await db.query(
      "SELECT COALESCE(SUM(amount), 0) AS total_earned FROM coin_transactions WHERE user_id = ? AND type = 'earn'",
      [auth.id]
    );

    const lifetimeEarned = Math.max(
      Number(txRows[0]?.total_earned || 0),
      Number(profile?.loyalty.lifetimeEarnedPoints || 0),
      Number(users[0].coin_balance || 0)
    );

    res.json({
      coin_balance: users[0].coin_balance,
      total_earned_lifetime: lifetimeEarned,
      current_points: profile?.loyalty.currentPoints ?? users[0].coin_balance,
      tier: profile?.tier?.name || "Classmate",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil saldo koin", error: err.message });
  }
});

// GET /api/coins/history — Riwayat perolehan & penukaran koin (Halaman Riwayat)
coinsRouter.get("/history", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const [rows]: any = await db.query(
      "SELECT id, type, amount, description, created_at FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [auth.id]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil riwayat koin", error: err.message });
  }
});

// ==============================================================================
// 2. PROMOS ROUTER (/api/promos)
// ==============================================================================
export const promosRouter = Router();

// GET /api/promos — Katalog promo/voucher yang dapat ditukarkan di menu Redeem
promosRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const [promos]: any = await db.query(
      `SELECT id, title, description, coin_cost, discount_value, image_url, valid_until, category 
       FROM coin_promos 
       WHERE is_active = 1 AND valid_until > NOW()
       ORDER BY coin_cost ASC`
    );
    res.json(promos);
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil daftar promo", error: err.message });
  }
});

// POST /api/promos/redeem — Menukarkan koin dengan voucher
promosRouter.post("/redeem", requireAuthenticated, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const auth = (req as any).auth;
    const { promo_id } = req.body;

    if (!promo_id) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "promo_id wajib diisi" });
    }

    const [promos]: any = await connection.query("SELECT * FROM coin_promos WHERE id = ? FOR UPDATE", [promo_id]);
    if (!promos.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Promo tidak ditemukan" });
    }
    const promo = promos[0];

    if (!promo.is_active || new Date(promo.valid_until) < new Date()) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Promo sudah tidak aktif atau kedaluwarsa" });
    }

    const [users]: any = await connection.query("SELECT * FROM users WHERE id = ? FOR UPDATE", [auth.id]);
    if (!users.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "User tidak ditemukan" });
    }
    const user = users[0];

    if (user.coin_balance < promo.coin_cost) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Koin tidak mencukupi. Dibutuhkan ${promo.coin_cost} koin, saldo Anda ${user.coin_balance} koin`
      });
    }

    // Kurangi saldo koin & tambahkan hitungan penggunaan promo
    await connection.query("UPDATE users SET coin_balance = coin_balance - ? WHERE id = ?", [promo.coin_cost, auth.id]);
    await connection.query("UPDATE coin_promos SET used_count = used_count + 1 WHERE id = ?", [promo.id]);

    // Catat mutasi transaksi koin
    const txId = `ct-${Date.now()}`;
    await connection.query(
      "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description, promo_id) VALUES (?, ?, ?, 'redeem', ?, ?, ?)",
      [txId, auth.id, user.nama, promo.coin_cost, `Tukar: ${promo.title}`, promo.id]
    );

    // Simpan voucher unik ke user_vouchers
    const voucherId = `uv-${Date.now()}`;
    const voucherCode = `VCH-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await connection.query(
      "INSERT INTO user_vouchers (id, user_id, promo_id, voucher_code, status) VALUES (?, ?, ?, ?, 'unused')",
      [voucherId, auth.id, promo.id, voucherCode]
    );

    await connection.commit();

    const [updatedUser]: any = await db.query("SELECT coin_balance FROM users WHERE id = ?", [auth.id]);
    await addAuditLog("Sistem", "Penukaran Promo Koin", `${user.nama} → ${promo.title} (${promo.coin_cost} koin)`);

    res.json({
      success: true,
      voucher_code: voucherCode,
      remaining_coins: updatedUser[0].coin_balance,
      voucher: {
        id: voucherId,
        voucher_code: voucherCode,
        status: "unused",
        title: promo.title,
        discount_value: promo.discount_value,
      }
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ success: false, message: "Gagal menukarkan voucher", error: err.message });
  } finally {
    connection.release();
  }
});

// POST /api/promos/claim-code — Klaim voucher via kode promo langsung
promosRouter.post("/claim-code", requireAuthenticated, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const auth = (req as any).auth;
    const { promo_code } = req.body;

    if (!promo_code || !String(promo_code).trim()) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Kode promo wajib diisi" });
    }

    const code = String(promo_code).trim();
    const [promos]: any = await connection.query(
      "SELECT * FROM coin_promos WHERE promo_code = ? AND is_active = 1 FOR UPDATE",
      [code]
    );

    if (promos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Kode promo tidak valid atau promo sudah tidak aktif" });
    }
    const promo = promos[0];

    if (promo.used_count >= promo.max_usage) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Kuota penggunaan promo ini sudah habis" });
    }

    if (new Date() > new Date(promo.valid_until)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Promo ini sudah kedaluwarsa" });
    }

    const [existingClaims]: any = await connection.query(
      "SELECT COUNT(*) AS count FROM user_vouchers WHERE user_id = ? AND promo_id = ?",
      [auth.id, promo.id]
    );

    if (existingClaims[0].count >= promo.limit_per_user) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Batas klaim maksimum (${promo.limit_per_user}x) telah tercapai` });
    }

    const voucherId = `uv-${Date.now()}`;
    const voucherCode = `VCH-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await connection.query(
      "INSERT INTO user_vouchers (id, user_id, promo_id, voucher_code, status) VALUES (?, ?, ?, ?, 'unused')",
      [voucherId, auth.id, promo.id, voucherCode]
    );

    await connection.query("UPDATE coin_promos SET used_count = used_count + 1 WHERE id = ?", [promo.id]);
    await connection.commit();

    res.json({
      success: true,
      message: "Voucher berhasil diklaim",
      voucher: {
        id: voucherId,
        voucher_code: voucherCode,
        title: promo.title,
        discount_value: promo.discount_value,
        status: "unused",
        valid_until: promo.valid_until,
      }
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ success: false, message: "Gagal mengklaim kode promo", error: err.message });
  } finally {
    connection.release();
  }
});

// ==============================================================================
// 3. VOUCHERS ROUTER (/api/vouchers)
// ==============================================================================
export const vouchersRouter = Router();

// GET /api/vouchers/my-vouchers — Daftar voucher milik user di tab Promo Saya
vouchersRouter.get("/my-vouchers", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const query = `
      SELECT uv.id, uv.voucher_code, uv.status, cp.title, cp.discount_value, uv.created_at, cp.image_url, cp.valid_until, cp.description
      FROM user_vouchers uv
      JOIN coin_promos cp ON cp.id = uv.promo_id
      WHERE uv.user_id = ?
      ORDER BY uv.created_at DESC
    `;
    const [rows]: any = await db.query(query, [auth.id]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil daftar voucher", error: err.message });
  }
});

// GET /api/vouchers/:id — Detail voucher & barcode/QR code
vouchersRouter.get("/:id", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const query = `
      SELECT uv.id, uv.voucher_code, uv.status, uv.created_at,
             cp.id AS promo_id, cp.title, cp.description, cp.discount_value, cp.valid_until, cp.image_url
      FROM user_vouchers uv
      JOIN coin_promos cp ON cp.id = uv.promo_id
      WHERE (uv.id = ? OR uv.voucher_code = ?) AND uv.user_id = ?
      LIMIT 1
    `;
    const [rows]: any = await db.query(query, [id, id, auth.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Voucher tidak ditemukan" });
    }
    const v = rows[0];
    res.json({
      voucher_code: v.voucher_code,
      status: v.status,
      qr_payload: `${v.voucher_code}|${auth.id}|${v.valid_until}`,
      promo_details: {
        id: v.promo_id,
        title: v.title,
        description: v.description,
        discount_value: v.discount_value,
        valid_until: v.valid_until,
        image_url: v.image_url,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil detail voucher", error: err.message });
  }
});

// ==============================================================================
// 4. MENUS ROUTER (/api/menus)
// ==============================================================================
export const menusRouter = Router();

// GET /api/menus — Daftar menu makanan/minuman WarmingUp
menusRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const [menus]: any = await db.query(
      "SELECT id, name, category, price, stock, image_url, in_stock FROM menus WHERE is_active = 1 ORDER BY category ASC, name ASC"
    );
    res.json(menus.map((m: any) => ({
      id: String(m.id),
      name: m.name,
      category: m.category || "General",
      price: Number(m.price),
      stock: Number(m.stock || 0),
      image_url: m.image_url || "",
      in_stock: Boolean(m.in_stock),
    })));
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil menu", error: err.message });
  }
});

// ==============================================================================
// 5. USER ORDERS ROUTER (/api/orders/my-orders)
// ==============================================================================
export const userOrdersRouter = Router();

// GET /api/orders/my-orders — Riwayat pesanan makanan user (Halaman Riwayat)
userOrdersRouter.get("/my-orders", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const [orders]: any = await db.query(
      `SELECT id, invoice_number, total_price, status, payment_status, created_at 
       FROM orders 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 30`,
      [auth.id]
    );

    const result = [];
    for (const ord of orders) {
      const [items]: any = await db.query(
        `SELECT COALESCE(menu_name, item_name, 'Menu Item') AS menu_name, quantity, price 
         FROM order_items 
         WHERE order_id = ?`,
        [ord.id]
      );
      result.push({
        invoice_number: ord.invoice_number || ord.id,
        total_price: Number(ord.total_price),
        status: ord.status,
        payment_status: ord.payment_status,
        created_at: ord.created_at,
        items: items.map((i: any) => ({
          menu_name: i.menu_name,
          quantity: Number(i.quantity),
          price: Number(i.price),
        })),
      });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil riwayat pesanan", error: err.message });
  }
});
