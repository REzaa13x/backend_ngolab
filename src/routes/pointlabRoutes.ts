import { Router, Request, Response } from "express";
import crypto from "crypto";
import { db, addAuditLog } from "../db/db.js";
import { requireAuthenticated } from "../middleware/authSession.js";
import { debitPoints, ensureMemberForUser, getMemberProfile } from "../lib/membershipService.js";

// ==============================================================================
// 1. COINS ROUTER (/api/coins)
// ==============================================================================
export const coinsRouter = Router();

// GET /api/coins/balance — Mengambil saldo poin & riwayat akumulasi untuk kalkulasi Tier
coinsRouter.get("/balance", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const [users]: any = await db.query(
      "SELECT id, nama, nim, phone, email, coin_balance FROM users WHERE id = ?",
      [auth.id]
    );
    if (!users.length) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan" });
    }
    const user = users[0];
    await ensureMemberForUser(db, user.id, {
      nama: user.nama,
      phone: user.phone,
      nim: user.nim,
      email: user.email,
    });
    const profile = await getMemberProfile(auth.id);

    // Hitung akumulasi koin masuk
    const [txRows]: any = await db.query(
      "SELECT COALESCE(SUM(amount), 0) AS total_earned FROM coin_transactions WHERE user_id = ? AND type = 'earn'",
      [auth.id]
    );

    const currentPoints = Math.max(
      Number(user.coin_balance || 0),
      Number(profile?.loyalty.currentPoints ?? 0)
    );

    const lifetimeEarned = Math.max(
      Number(txRows[0]?.total_earned || 0),
      Number(profile?.loyalty.lifetimeEarnedPoints || 0),
      currentPoints
    );

    res.json({
      coin_balance: currentPoints,
      total_earned_lifetime: lifetimeEarned,
      current_points: currentPoints,
      tier: profile?.tier?.name || "Classmate",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil saldo koin", error: err.message });
  }
});

// GET /api/coins/history — Riwayat perolehan & penukaran koin terpadu (PointLab + NGOLAB-GAMI + POS)
coinsRouter.get("/history", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const [coinRows]: any = await db.query(
      "SELECT id, type, amount, description, created_at FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [auth.id]
    );

    const [loyaltyRows]: any = await db.query(
      `SELECT
         lt.id,
         CASE WHEN lt.points >= 0 THEN 'earn' ELSE 'redeem' END AS type,
         ABS(lt.points) AS amount,
         COALESCE(lt.description, CONCAT(lt.transaction_type, COALESCE(CONCAT(' (', lt.reference_type, ')'), ''))) AS description,
         lt.created_at
       FROM loyalty_transactions lt
       JOIN loyalty_accounts la ON la.id = lt.loyalty_account_id
       JOIN members m ON m.id = la.member_id
       WHERE m.user_id = ?
         AND COALESCE(lt.reference_type, '') NOT IN ('WELCOME', 'PROMO_REDEEM', 'PATUNGAN', 'LEGACY_COIN_EARN', 'STUDY_SESSION_LEGACY')
         AND NOT (COALESCE(lt.reference_type, '') = 'ORDER' AND EXISTS (SELECT 1 FROM coin_transactions ct WHERE ct.order_id = lt.reference_id AND ct.user_id = m.user_id))
       ORDER BY lt.created_at DESC
       LIMIT 50`,
      [auth.id]
    );

    const combined = [...coinRows, ...loyaltyRows]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 60);

    res.json(combined);
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
      `SELECT id, title, description, coin_cost, discount_value, promo_code, image_url, valid_until, category 
       FROM coin_promos 
       WHERE is_active = 1 AND valid_until > NOW()
       ORDER BY coin_cost ASC`
    );
    res.json(promos);
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil daftar promo", error: err.message });
  }
});

// POST /api/promos/redeem — Menukarkan koin dengan voucher (sinkron dengan loyalty_accounts & users.coin_balance)
export async function handlePromoRedeem(req: Request, res: Response) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const auth = (req as any).auth;
    const promo_id = req.body?.promo_id ?? req.body?.promoId ?? req.body?.reward_id ?? req.body?.rewardId;

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

    const member = await ensureMemberForUser(connection, user.id, {
      nama: user.nama,
      phone: user.phone,
      nim: user.nim,
      email: user.email,
    });

    const [laRows]: any = await connection.query(
      "SELECT current_points FROM loyalty_accounts WHERE member_id = ? FOR UPDATE",
      [member.id]
    );
    const availableBalance = Math.max(
      Number(user.coin_balance || 0),
      Number(laRows[0]?.current_points ?? 0)
    );

    if (availableBalance < promo.coin_cost) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Koin tidak mencukupi. Dibutuhkan ${promo.coin_cost} koin, saldo Anda ${availableBalance} koin`
      });
    }

    // Pastikan loyalty_accounts tersinkronisasi jika sebelumnya lebih kecil dari coin_balance
    if (laRows.length && Number(laRows[0].current_points) < availableBalance) {
      await connection.query(
        "UPDATE loyalty_accounts SET current_points = ? WHERE member_id = ?",
        [availableBalance, member.id]
      );
    }

    // Kurangi poin secara atomik melalui debitPoints (yang juga menyinkronkan users.coin_balance)
    const debitResult = await debitPoints({
      connection,
      memberId: member.id,
      points: Number(promo.coin_cost),
      transactionType: "REDEMPTION",
      referenceType: "PROMO_REDEEM",
      referenceId: String(promo.id),
      description: `Tukar Promo: ${promo.title}`,
    });

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

    await addAuditLog("Sistem", "Penukaran Promo Koin", `${user.nama} → ${promo.title} (${promo.coin_cost} koin)`);

    return res.json({
      success: true,
      voucher_code: voucherCode,
      redemptionCode: voucherCode,
      rewardName: promo.title,
      remaining_coins: debitResult.newBalance,
      remainingPoints: debitResult.newBalance,
      current_balance: debitResult.newBalance,
      voucher: {
        id: voucherId,
        voucher_code: voucherCode,
        code: voucherCode,
        status: "unused",
        title: promo.title,
        description: promo.description,
        discount_value: promo.discount_value,
        valid_until: promo.valid_until,
      }
    });
  } catch (err: any) {
    await connection.rollback();
    return res.status(500).json({ success: false, message: "Gagal menukarkan voucher", error: err.message });
  } finally {
    connection.release();
  }
}

promosRouter.post("/redeem", requireAuthenticated, handlePromoRedeem);

// POST /api/promos/claim-code — Klaim voucher via kode promo langsung (menerima promo_code maupun code)
promosRouter.post("/claim-code", requireAuthenticated, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const auth = (req as any).auth;
    const rawCode = req.body?.promo_code ?? req.body?.code;

    if (!rawCode || !String(rawCode).trim()) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Kode promo wajib diisi" });
    }

    const code = String(rawCode).trim();
    const [promos]: any = await connection.query(
      "SELECT * FROM coin_promos WHERE LOWER(promo_code) = LOWER(?) AND is_active = 1 FOR UPDATE",
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
        code: voucherCode,
        title: promo.title,
        description: promo.description,
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

function mapRedemptionStatusToVoucherStatus(status: string): string {
  const upper = String(status || "").toUpperCase();
  if (upper === "FULFILLED") return "used";
  if (upper === "EXPIRED" || upper === "CANCELLED" || upper === "REJECTED") return "expired";
  return "unused";
}

// GET /api/vouchers/my-vouchers — Daftar voucher terpadu milik user (PointLab user_vouchers + NGOLAB-GAMI redemptions)
vouchersRouter.get("/my-vouchers", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const uvQuery = `
      SELECT uv.id, uv.voucher_code, uv.status, cp.title, cp.discount_value, uv.created_at, cp.image_url, cp.valid_until, cp.description
      FROM user_vouchers uv
      JOIN coin_promos cp ON cp.id = uv.promo_id
      WHERE uv.user_id = ?
      ORDER BY uv.created_at DESC
    `;
    const [uvRows]: any = await db.query(uvQuery, [auth.id]);

    const redemptionQuery = `
      SELECT
        r.id,
        r.redemption_code AS voucher_code,
        r.status AS raw_status,
        rw.name AS title,
        r.points_used AS points_spent,
        r.redeemed_at AS created_at,
        rw.image_url,
        r.expires_at AS valid_until,
        rw.description,
        COALESCE(rw.discount_value, 0) AS discount_value
      FROM redemptions r
      JOIN rewards rw ON rw.id = r.reward_id
      JOIN members m ON m.id = r.member_id
      WHERE m.user_id = ?
      ORDER BY r.redeemed_at DESC
    `;
    const [redRows]: any = await db.query(redemptionQuery, [auth.id]);

    const mappedUv = uvRows.map((row: any) => ({
      ...row,
      code: row.voucher_code,
      source: "pointlab",
    }));

    const mappedRedemptions = redRows.map((row: any) => ({
      id: row.id,
      voucher_code: row.voucher_code,
      code: row.voucher_code,
      status: mapRedemptionStatusToVoucherStatus(row.raw_status),
      raw_status: row.raw_status,
      title: row.title,
      discount_value: Number(row.discount_value || 0),
      points_spent: Number(row.points_spent || 0),
      created_at: row.created_at,
      image_url: row.image_url || "",
      valid_until: row.valid_until,
      description: row.description || "Reward katalog NGOLAB-GAMI — tunjukkan kode di kasir WarmingUp.",
      source: "gami_reward",
    }));

    const combined = [...mappedUv, ...mappedRedemptions].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json(combined);
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil daftar voucher", error: err.message });
  }
});

// GET /api/vouchers/:id — Detail voucher & barcode/QR code (mendukung user_vouchers maupun redemptions)
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
    if (rows.length > 0) {
      const v = rows[0];
      return res.json({
        id: v.id,
        voucher_code: v.voucher_code,
        code: v.voucher_code,
        status: v.status,
        title: v.title,
        description: v.description,
        discount_value: v.discount_value,
        valid_until: v.valid_until,
        image_url: v.image_url,
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
    }

    const [redRows]: any = await db.query(
      `SELECT r.id, r.redemption_code AS voucher_code, r.status AS raw_status, r.redeemed_at AS created_at,
              r.expires_at AS valid_until, rw.id AS reward_id, rw.name AS title, rw.description, rw.image_url,
              COALESCE(rw.discount_value, 0) AS discount_value
       FROM redemptions r
       JOIN rewards rw ON rw.id = r.reward_id
       JOIN members m ON m.id = r.member_id
       WHERE (r.id = ? OR r.redemption_code = ?) AND m.user_id = ?
       LIMIT 1`,
      [id, id, auth.id]
    );

    if (!redRows.length) {
      return res.status(404).json({ success: false, message: "Voucher tidak ditemukan" });
    }

    const r = redRows[0];
    const mappedStatus = mapRedemptionStatusToVoucherStatus(r.raw_status);
    return res.json({
      id: r.id,
      voucher_code: r.voucher_code,
      code: r.voucher_code,
      status: mappedStatus,
      title: r.title,
      description: r.description,
      discount_value: Number(r.discount_value || 0),
      valid_until: r.valid_until,
      image_url: r.image_url || "",
      qr_payload: `${r.voucher_code}|${auth.id}|${r.valid_until}`,
      promo_details: {
        id: r.reward_id,
        title: r.title,
        description: r.description,
        discount_value: Number(r.discount_value || 0),
        valid_until: r.valid_until,
        image_url: r.image_url || "",
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
        `SELECT id, COALESCE(menu_name, item_name, 'Menu Item') AS menu_name, quantity, price 
         FROM order_items 
         WHERE order_id = ?`,
        [ord.id]
      );
      const totalAmount = Number(ord.total_price || 0);
      result.push({
        id: ord.id,
        order_number: ord.invoice_number || ord.id,
        invoice_number: ord.invoice_number || ord.id,
        total_price: totalAmount,
        total_amount: totalAmount,
        status: ord.status,
        payment_status: ord.payment_status,
        created_at: ord.created_at,
        items: items.map((i: any) => ({
          id: i.id,
          name: i.menu_name,
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

// ==============================================================================
// 6. AI CHAT RAG ROUTER (/api/chat)
// ==============================================================================
export const chatRouter = Router();

const WARMINGUP_KNOWLEDGE_ITEMS = [
  {
    topic: "lokasi",
    keywords: ["lokasi", "tempat", "lantai", "dimana", "alamat"],
    answer: "Kantin modern WarmingUp (Ngolab) berlokasi di Lantai 4 Gedung Fakultas Ilmu Terapan (FIT), Telkom University, Bandung, Jawa Barat.",
  },
  {
    topic: "jam_operasional",
    keywords: ["jam", "buka", "tutup", "operasional", "jadwal", "hari"],
    answer: "WarmingUp buka Senin sampai Jumat pukul 08.00 – 17.00 WIB (Tutup pada hari Sabtu, Minggu, dan hari libur nasional).",
  },
  {
    topic: "fasilitas_coworking",
    keywords: ["fasilitas", "coworking", "wifi", "colokan", "listrik", "belajar", "nugas", "meja", "lounge"],
    answer: "Area WarmingUp Lantai 4 FIT dilengkapi meja belajar nyaman untuk nugas/diskusi kelompok, colokan listrik di area tempat duduk untuk laptop dan handphone, akses internet WiFi kampus yang cepat, serta sirkulasi ruangan terbuka yang sejuk dan nyaman.",
  },
  {
    topic: "menu_makanan",
    keywords: ["menu", "makan", "makanan", "harga", "ayam", "nasi goreng", "es teh", "minum", "daftar menu"],
    answer: "Daftar Menu Resmi WarmingUp FIT:\n• Ayam Bakar: Rp 23.000 (Daging empuk rempah khas)\n• Nasi Goreng Gila: Rp 14.000 (Pedas favorit, sosis, bakso, telur)\n• Nasi Goreng Reguler: Rp 15.000 (Gurih mantap)\n• Es Teh Manis: Rp 7.000 (Melati dingin segar)\n• Mie Dok Dok (Pre-Order): Rp 17.000\n• Nasi Padang (PO Jum'at Berkah): Rp 15.000",
  },
  {
    topic: "menu_preorder",
    keywords: ["preorder", "pre-order", "po", "dok dok", "padang", "jumat", "jum'at"],
    answer: "Menu Spesial Pre-Order (PO) WarmingUp:\n1. Mie Dok Dok (PO): Rp 17.000 (Kuah kental gurih hangat)\n2. Nasi Padang (PO Jum'at Berkah): Rp 15.000 (Paket lengkap spesial Jumat)\nPemesanan menu Pre-Order dapat dikoordinasikan langsung sebelum batas waktu harian di kasir.",
  },
  {
    topic: "pembayaran",
    keywords: ["bayar", "pembayaran", "qris", "tunai", "cash", "gopay", "ovo", "dana", "shopeepay"],
    answer: "Metode pembayaran di WarmingUp FIT mendukung QRIS (semua e-wallet dan m-Banking) serta Tunai (Cash di meja kasir). Jangan lupa tunjukkan QR Member PointLab Anda sebelum membayar agar transaksi otomatis mendapatkan poin!",
  },
  {
    topic: "poin_dan_cara_dapat",
    keywords: ["poin", "point", "dapat poin", "koin", "cara dapat", "bonus", "reward"],
    answer: "Cara Mendapatkan Poin PointLab:\n1. Transaksi F&B: Setiap Rp 1.000 belanja di WarmingUp FIT = 1 poin.\n2. Bonus Akun Baru: 100 poin gratis saat pertama kali mendaftar.\n3. Play & Earn: Mainkan mini-game harian di aplikasi NGOLAB-GAMI.\n4. Study Session: Catat sesi belajar di coworking space melalui Gami-Study.\n5. Multiplier Tier: Tier lebih tinggi melipatgandakan perolehan poin hingga 2x lipat.",
  },
  {
    topic: "tier_membership",
    keywords: ["tier", "level", "classmate", "study buddy", "campus star", "hall of fame", "tingkatan", "keuntungan"],
    answer: "Tingkatan Tier Membership PointLab:\n1. Classmate (0 - 5.000 poin): 1x poin, akses promo bulanan.\n2. Study Buddy (5.001 - 15.000 poin): 1.2x poin, upsize 1x/minggu, diskon Selasa.\n3. Campus Star (15.001 - 35.000 poin): 1.5x poin, diskon tetap 5% all menu, antrian dapur prioritas.\n4. Hall of Fame (> 35.000 poin): 2x poin, diskon tetap 15%, bebas upsize, meja VVIP.",
  },
  {
    topic: "rfid_member_card",
    keywords: ["rfid", "kartu", "tap", "kartu fisik", "sensor kartu"],
    answer: "Setiap member PointLab memiliki ID RFID digital dan dapat ditautkan dengan kartu fisik RFID. Cukup tempelkan (tap) kartu atau scan QR Member Anda pada mesin pembaca kasir/kiosk untuk login instan dan akumulasi poin.",
  },
  {
    topic: "study_session",
    keywords: ["study session", "sesi belajar", "timer", "belajar mandiri", "gami-study"],
    answer: "Fitur Study Session (Gami-Study) memungkinkan Anda mencatat waktu belajar mandiri atau kelompok di area coworking WarmingUp. Mulai sesi fokus di NGOLAB-GAMI dan poin loyalitas otomatis masuk ke PointLab!",
  },
  {
    topic: "game_play_earn",
    keywords: ["game", "play", "earn", "ngolab catch", "burger", "boba", "koin game"],
    answer: "Anda dapat memainkan game interaktif (Ngolab Smash, Flappy Cup, Catch Food, Memory Card, Spin Wheel) di aplikasi NGOLAB-GAMI. Skor kemenangan langsung menjadi poin loyalitas di PointLab!",
  },
  {
    topic: "lupa_password",
    keywords: ["lupa password", "reset password", "ganti password", "ubah sandi", "kata sandi"],
    answer: "Untuk reset atau ganti password:\n1. Jika belum login: Klik 'Lupa Password?' di halaman Login, masukkan email atau username terdaftar.\n2. Jika sudah login: Buka menu Akun / Profile -> Pengaturan Profil -> Ganti Password.",
  },
  {
    topic: "kerja_sama_dan_cashback",
    keywords: ["kerja sama", "kerjasama", "rapat", "event", "gathering", "katering", "cashback cash", "organisasi", "komunitas"],
    answer: "WarmingUp FIT membuka kerja sama untuk organisasi & komunitas mahasiswa sebagai tempat rapat, gathering, atau pemesanan katering/konsumsi dengan keuntungan Cashback langsung dalam bentuk UANG TUNAI (Cash)!",
  },
  {
    topic: "kiosk_sensor",
    keywords: ["kiosk", "sensor", "gestur", "gesture", "gesture-eats", "tanpa sentuh"],
    answer: "Pemesanan mandiri dapat dilakukan di mesin Kiosk depan outlet tanpa menyentuh layar menggunakan sensor gestur tangan (Gesture-Eats).",
  },
  {
    topic: "kontak_cs",
    keywords: ["kontak", "cs", "customer service", "wa", "whatsapp", "bantuan", "instagram", "admin"],
    answer: "Pusat Bantuan Resmi PointLab & WarmingUp FIT:\n• WhatsApp Support: +62 813-7488-1250\n• Instagram: @ngolabcafe\n• Layanan Langsung: Meja Kasir WarmingUp Lantai 4 Gedung FIT Telkom University.",
  },
];

function findLocalKnowledge(query: string): string | null {
  if (!query) return null;
  const lower = query.toLowerCase();
  for (const item of WARMINGUP_KNOWLEDGE_ITEMS) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      return item.answer;
    }
  }
  return null;
}

chatRouter.post("/query", async (req: Request, res: Response) => {
  try {
    const userText = String(req.body?.message ?? req.body?.query ?? "").trim();
    if (!userText) {
      return res.status(400).json({ message: "Pesan tidak boleh kosong.", code: "CHAT_EMPTY" });
    }

    const localAnswer = findLocalKnowledge(userText);
    if (localAnswer) {
      return res.status(200).json({ source: "rag_local", answer: localAnswer });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const sysPrompt =
          "Anda adalah AI Assistant resmi PointLab (Ngolab / WarmingUp) di Lantai 4 Fakultas Ilmu Terapan (FIT), Telkom University. Jawab secara ramah, singkat, dan informatif mengenai PointLab, poin loyalitas, dan kantin FIT.";
        const geminiResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: `${sysPrompt}\n\nPertanyaan: ${userText}` }] }],
            }),
          }
        );
        const geminiData: any = await geminiResp.json();
        const geminiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (geminiText) {
          return res.status(200).json({ source: "gemini", answer: geminiText });
        }
      } catch {
        // Fallback ke asisten lokal bila koneksi eksternal tidak tersedia
      }
    }

    return res.status(200).json({
      source: "assistant",
      answer: `Halo! Saya asisten resmi WarmingUp (Ngolab) Lantai 4 FIT Telkom University. Untuk informasi menu, promo voucher, poin loyalitas, jam buka (Senin–Jumat 08.00–17.00 WIB), fasilitas coworking, atau kerja sama komunitas, silakan tanyakan kata kunci terkait kepada saya!`,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Gagal memproses chat", code: "CHAT_ERROR" });
  }
});

chatRouter.get("/knowledge", (_req: Request, res: Response) => {
  res.status(200).json({ knowledgeBase: WARMINGUP_KNOWLEDGE_ITEMS });
});
