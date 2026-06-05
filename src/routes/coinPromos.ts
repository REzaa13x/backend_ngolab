import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { db, addAuditLog } from "../db/db.js";

const router = Router();

// ─── Upload Directory ────────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "public", "uploads", "promos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ─── Multer Config ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `promo-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF."));
  },
});

// GET /api/coin-promos
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [promos]: any = await db.query("SELECT * FROM coin_promos ORDER BY created_at DESC");
    res.json(promos);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil promo koin", error: err.message });
  }
});

// POST /api/coin-promos
router.post("/", async (req: Request, res: Response) => {
  try {
    const { title, description, coin_cost, discount_type, discount_value, free_item_name, required_item_name, min_order, max_usage, valid_until, image_url, category, product_id, category_id, promo_code, limit_per_user } = req.body;
    
    if (!title || coin_cost === undefined || coin_cost === null || coin_cost === "") {
      return res.status(400).json({ message: "Judul dan biaya koin wajib diisi" });
    }

    const id = `cp-${Date.now()}`;
    const untilDate = valid_until ? new Date(valid_until) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const validUntilMysql = untilDate.toISOString().slice(0, 19).replace('T', ' ');

    await db.query(
      `INSERT INTO coin_promos 
       (id, title, description, coin_cost, discount_type, discount_value, free_item_name, required_item_name, min_order, max_usage, valid_until, is_active, image_url, category, product_id, category_id, promo_code, limit_per_user) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, title, description || "", parseInt(coin_cost) || 0, discount_type || "fixed", 
        parseInt(discount_value) || 0, free_item_name || null, required_item_name || null,
        parseInt(min_order) || 0, parseInt(max_usage) || 100, 
        validUntilMysql, 1, image_url || "", category || "Semua", product_id || null, category_id || null,
        promo_code ? promo_code.trim() : null, parseInt(limit_per_user) || 1
      ]
    );

    const [newPromo]: any = await db.query("SELECT * FROM coin_promos WHERE id = ?", [id]);
    const actor = (req.headers["x-user-name"] as string) || "Admin";
    await addAuditLog(actor, "Buat Promo Koin", `${title} (${coin_cost} koin)`);
    res.status(201).json(newPromo[0]);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal membuat promo koin", error: err.message });
  }
});

// POST /api/coin-promos/upload
router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Tidak ada file yang diunggah" });
    const fileUrl = `/uploads/promos/${req.file.filename}`;
    res.status(201).json({ message: "Gambar berhasil diupload", file_url: fileUrl });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal upload gambar", error: err.message });
  }
});

// PUT /api/coin-promos/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { title, description, coin_cost, discount_type, discount_value, free_item_name, required_item_name, min_order, max_usage, valid_until, is_active, image_url, category, product_id, category_id, promo_code, limit_per_user } = req.body;
    const { id } = req.params;

    const updates = [];
    const params = [];
    
    if (title !== undefined) { updates.push("title = ?"); params.push(title); }
    if (description !== undefined) { updates.push("description = ?"); params.push(description); }
    if (coin_cost !== undefined) { updates.push("coin_cost = ?"); params.push(parseInt(coin_cost) || 0); }
    if (discount_type !== undefined) { updates.push("discount_type = ?"); params.push(discount_type); }
    if (discount_value !== undefined) { updates.push("discount_value = ?"); params.push(parseInt(discount_value) || 0); }
    if (free_item_name !== undefined) { updates.push("free_item_name = ?"); params.push(free_item_name); }
    if (required_item_name !== undefined) { updates.push("required_item_name = ?"); params.push(required_item_name); }
    if (min_order !== undefined) { updates.push("min_order = ?"); params.push(parseInt(min_order) || 0); }
    if (max_usage !== undefined) { updates.push("max_usage = ?"); params.push(parseInt(max_usage) || 100); }
    if (valid_until !== undefined) { 
      updates.push("valid_until = ?"); 
      params.push(new Date(valid_until).toISOString().slice(0, 19).replace('T', ' ')); 
    }
    if (is_active !== undefined) { updates.push("is_active = ?"); params.push(is_active ? 1 : 0); }
    if (image_url !== undefined) { updates.push("image_url = ?"); params.push(image_url); }
    if (category !== undefined) { updates.push("category = ?"); params.push(category); }
    if (product_id !== undefined) { updates.push("product_id = ?"); params.push(product_id); }
    if (category_id !== undefined) { updates.push("category_id = ?"); params.push(category_id); }
    if (promo_code !== undefined) { updates.push("promo_code = ?"); params.push(promo_code ? promo_code.trim() : null); }
    if (limit_per_user !== undefined) { updates.push("limit_per_user = ?"); params.push(parseInt(limit_per_user) || 1); }

    if (updates.length > 0) {
      params.push(id);
      await db.query(`UPDATE coin_promos SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [updatedPromo]: any = await db.query("SELECT * FROM coin_promos WHERE id = ?", [id]);
    res.json(updatedPromo[0]);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal update promo", error: err.message });
  }
});

// DELETE /api/coin-promos/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const actor = (req.headers["x-user-name"] as string) || "Admin";
    const [promos]: any = await db.query("SELECT title FROM coin_promos WHERE id = ?", [req.params.id]);
    const title = promos.length ? promos[0].title : req.params.id;
    await db.query("DELETE FROM coin_promos WHERE id = ?", [req.params.id]);
    await addAuditLog(actor, "Hapus Promo Koin", title, "warning");
    res.json({ message: "Promo dihapus" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menghapus promo", error: err.message });
  }
});

// PATCH /api/coin-promos/:id/toggle
router.patch("/:id/toggle", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [promos]: any = await db.query("SELECT is_active FROM coin_promos WHERE id = ?", [id]);
    if (!promos.length) return res.status(404).json({ message: "Promo tidak ditemukan" });

    const newStatus = promos[0].is_active ? 0 : 1;
    await db.query("UPDATE coin_promos SET is_active = ? WHERE id = ?", [newStatus, id]);
    
    const [updated]: any = await db.query("SELECT * FROM coin_promos WHERE id = ?", [id]);
    res.json(updated[0]);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal toggle promo", error: err.message });
  }
});

// POST /api/coin-promos/:id/redeem
router.post("/:id/redeem", async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { user_id } = req.body;

    const [promos]: any = await connection.query("SELECT * FROM coin_promos WHERE id = ? FOR UPDATE", [id]);
    if (!promos.length) return res.status(404).json({ message: "Promo tidak ditemukan" });
    const promo = promos[0];

    if (!promo.is_active) return res.status(400).json({ message: "Promo tidak aktif" });
    if (promo.used_count >= promo.max_usage) return res.status(400).json({ message: "Kuota promo habis" });
    if (new Date() > new Date(promo.valid_until)) return res.status(400).json({ message: "Promo sudah kadaluarsa" });

    // Verify target product stock if promo.product_id is set
    if (promo.product_id) {
      const [menus]: any = await connection.query(
        "SELECT in_stock, stock, name FROM menus WHERE id = ? FOR UPDATE",
        [promo.product_id]
      );
      if (menus.length > 0) {
        const menu = menus[0];
        if (!menu.in_stock || menu.stock <= 0) {
          await connection.rollback();
          return res.status(400).json({ message: `Produk '${menu.name}' untuk promo ini sedang habis` });
        }
      }
    }

    const [users]: any = await connection.query("SELECT * FROM users WHERE id = ? FOR UPDATE", [user_id]);
    if (!users.length) return res.status(404).json({ message: "User tidak ditemukan" });
    const user = users[0];

    if (user.coin_balance < promo.coin_cost) {
      return res.status(400).json({ message: `Koin tidak cukup. Butuh ${promo.coin_cost}, saldo ${user.coin_balance}` });
    }

    // Deduct coins & increment usage
    await connection.query("UPDATE users SET coin_balance = coin_balance - ? WHERE id = ?", [promo.coin_cost, user_id]);
    await connection.query("UPDATE coin_promos SET used_count = used_count + 1 WHERE id = ?", [id]);

    // Record transaction
    const txId = `ct-${Date.now()}`;
    await connection.query(
      "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description, promo_id) VALUES (?, ?, ?, 'redeem', ?, ?, ?)",
      [txId, user_id, user.nama, promo.coin_cost, `Tukar: ${promo.title}`, id]
    );

    await connection.commit();

    const [updatedUser]: any = await db.query("SELECT coin_balance FROM users WHERE id = ?", [user_id]);
    
    // Log to security audit
    await addAuditLog("Sistem", "Penukaran Promo Koin", `${user.nama} → ${promo.title} (${promo.coin_cost} koin)`);

    // Simulate real-time io.emit (Will be handled by caller or by exporting IO)
    // Actually, we should probably return something that lets server.ts emit it
    res.json({ 
      message: "Promo berhasil ditukar!", 
      transaction: { id: txId, amount: promo.coin_cost, type: 'redeem' }, 
      new_balance: updatedUser[0].coin_balance 
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal tukar promo", error: err.message });
  } finally {
    connection.release();
  }
});

// ─── NEW USER-FACING VOUCHER ENDPOINTS (Fore Coffee inspired) ──────────────────

// 1. GET /api/coin-promos/user-vouchers/:user_id - Ambil semua voucher aktif milik seorang user yang belum digunakan (unused)
router.get("/user-vouchers/:user_id", async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const query = `
      SELECT uv.id AS voucher_id, uv.voucher_code, uv.status, uv.created_at AS claimed_at,
             cp.id AS promo_id, cp.title, cp.description, cp.discount_type, cp.discount_value,
             cp.coin_cost, cp.min_order, cp.valid_until, cp.image_url, cp.category, 
             cp.product_id, cp.category_id, cp.promo_code
      FROM user_vouchers uv
      JOIN coin_promos cp ON uv.promo_id = cp.id
      WHERE uv.user_id = ? AND uv.status = 'unused' AND cp.is_active = 1 AND cp.valid_until > NOW()
      ORDER BY uv.created_at DESC
    `;
    const [vouchers]: any = await db.query(query, [user_id]);
    res.json(vouchers);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil voucher user", error: err.message });
  }
});

// 2. POST /api/coin-promos/claim-code - Mengklaim voucher menggunakan kode promo
router.post("/claim-code", async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { user_id, promo_code } = req.body;

    if (!user_id || !promo_code) {
      await connection.rollback();
      return res.status(400).json({ message: "User ID dan Kode Promo wajib diisi" });
    }

    // Cari promo dengan promo_code yang dicari
    const [promos]: any = await connection.query(
      "SELECT * FROM coin_promos WHERE promo_code = ? AND is_active = 1 FOR UPDATE",
      [promo_code.trim()]
    );

    if (promos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Kode promo tidak valid atau promo sudah tidak aktif" });
    }

    const promo = promos[0];

    // Cek kuota umum promo
    if (promo.used_count >= promo.max_usage) {
      await connection.rollback();
      return res.status(400).json({ message: "Kuota penggunaan promo ini sudah habis" });
    }

    // Cek tanggal kedaluwarsa
    if (new Date() > new Date(promo.valid_until)) {
      await connection.rollback();
      return res.status(400).json({ message: "Promo ini sudah kedaluwarsa" });
    }

    // Cek berapa kali user ini sudah mengklaim promo ini
    const [existingClaims]: any = await connection.query(
      "SELECT COUNT(*) AS count FROM user_vouchers WHERE user_id = ? AND promo_id = ?",
      [user_id, promo.id]
    );

    if (existingClaims[0].count >= promo.limit_per_user) {
      await connection.rollback();
      return res.status(400).json({ message: `Anda telah mencapai batas maksimum klaim (${promo.limit_per_user} kali) untuk promo ini` });
    }

    // Generate kode voucher unik untuk user
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const voucherCode = `CODE-${randomHex}`;
    const voucherId = `uv-${Date.now()}`;

    // Simpan ke user_vouchers
    await connection.query(
      "INSERT INTO user_vouchers (id, user_id, promo_id, voucher_code, status) VALUES (?, ?, ?, ?, 'unused')",
      [voucherId, user_id, promo.id, voucherCode]
    );

    // Update used_count
    await connection.query(
      "UPDATE coin_promos SET used_count = used_count + 1 WHERE id = ?",
      [promo.id]
    );

    await connection.commit();

    // Trigger update real-time via Socket.io jika ada
    const io = req.app.get('io');
    if (io) {
      io.emit("stats_updated");
    }

    res.status(201).json({
      message: "Voucher berhasil diklaim!",
      voucher: {
        id: voucherId,
        voucher_code: voucherCode,
        promo_id: promo.id,
        title: promo.title,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value
      }
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal mengklaim kode promo", error: err.message });
  } finally {
    connection.release();
  }
});

// 3. POST /api/coin-promos/validate-voucher - Memvalidasi voucher untuk transaksi & menghitung diskon
router.post("/validate-voucher", async (req: Request, res: Response) => {
  try {
    const { user_id, voucher_code, items, total_price } = req.body;

    if (!user_id || !voucher_code) {
      return res.status(400).json({ message: "User ID dan Kode Voucher wajib diisi" });
    }

    // Cari voucher
    const query = `
      SELECT uv.id AS voucher_id, uv.status, uv.user_id,
             cp.id AS promo_id, cp.title, cp.is_active, cp.valid_until, cp.min_order,
             cp.discount_type, cp.discount_value, cp.product_id, cp.category_id, cp.category
      FROM user_vouchers uv
      JOIN coin_promos cp ON uv.promo_id = cp.id
      WHERE uv.voucher_code = ?
    `;
    const [vouchers]: any = await db.query(query, [voucher_code]);

    if (vouchers.length === 0) {
      return res.status(404).json({ valid: false, message: "Voucher tidak ditemukan" });
    }

    const v = vouchers[0];

    // Cek kepemilikan
    if (v.user_id !== user_id) {
      return res.status(403).json({ valid: false, message: "Voucher ini bukan milik Anda" });
    }

    // Cek status
    if (v.status !== 'unused') {
      return res.status(400).json({ valid: false, message: "Voucher ini sudah pernah digunakan" });
    }

    // Cek aktif
    if (!v.is_active) {
      return res.status(400).json({ valid: false, message: "Promo terkait voucher ini sedang dinonaktifkan" });
    }

    // Cek kedaluwarsa
    if (new Date() > new Date(v.valid_until)) {
      return res.status(400).json({ valid: false, message: "Voucher ini sudah kedaluwarsa" });
    }

    // Cek min order
    const orderAmt = parseInt(total_price) || 0;
    if (orderAmt < v.min_order) {
      return res.status(400).json({ 
        valid: false, 
        message: `Minimal pembelian untuk menggunakan voucher ini adalah Rp ${v.min_order.toLocaleString('id-ID')}` 
      });
    }

    // Cek kecocokan target product_id atau category_id jika dibatasi
    if (v.product_id || (v.category && v.category !== 'Semua' && v.category !== '')) {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ 
          valid: false, 
          message: "Voucher ini hanya berlaku untuk menu tertentu, tetapi keranjang belanja Anda kosong" 
        });
      }

      // Check product_id
      if (v.product_id) {
        const hasProduct = items.some((item: any) => item.id?.toString() === v.product_id?.toString() || item.menu_id?.toString() === v.product_id?.toString());
        if (!hasProduct) {
          return res.status(400).json({ 
            valid: false, 
            message: "Keranjang Anda tidak berisi produk yang sesuai untuk voucher ini" 
          });
        }
      }

      // Check category (jika tidak "Semua")
      if (v.category && v.category !== 'Semua' && v.category !== '') {
        const hasMatchingCategory = items.some((item: any) => {
          return item.category?.toLowerCase() === v.category?.toLowerCase();
        });
        const itemsHaveCategory = items.every((item: any) => item.category !== undefined);
        if (itemsHaveCategory && !hasMatchingCategory) {
          return res.status(400).json({ 
            valid: false, 
            message: `Voucher ini hanya berlaku untuk kategori '${v.category}'` 
          });
        }
      }
    }

    // Hitung potongan diskon
    let discount = 0;
    if (v.discount_type === 'percentage') {
      discount = Math.round(orderAmt * (v.discount_value / 100));
    } else if (v.discount_type === 'fixed') {
      discount = v.discount_value;
    }

    // Diskon tidak boleh melebihi total_price
    discount = Math.min(orderAmt, discount);

    res.json({
      valid: true,
      promo_title: v.title,
      discount_amount: discount,
      final_price: orderAmt - discount
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal memproses validasi voucher", error: err.message });
  }
});

// 4. POST /api/coin-promos/use-voucher - Gunakan voucher (ubah status menjadi used)
router.post("/use-voucher", async (req: Request, res: Response) => {
  try {
    const { user_id, voucher_code } = req.body;

    if (!user_id || !voucher_code) {
      return res.status(400).json({ message: "User ID dan Kode Voucher wajib diisi" });
    }

    // Cari voucher
    const [vouchers]: any = await db.query(
      "SELECT * FROM user_vouchers WHERE voucher_code = ? AND user_id = ?",
      [voucher_code, user_id]
    );

    if (vouchers.length === 0) {
      return res.status(404).json({ message: "Voucher tidak ditemukan" });
    }

    const v = vouchers[0];

    if (v.status === 'used') {
      return res.status(400).json({ message: "Voucher sudah digunakan sebelumnya" });
    }

    // Update status
    await db.query(
      "UPDATE user_vouchers SET status = 'used' WHERE id = ?",
      [v.id]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit("stats_updated");
    }

    res.json({
      message: "Voucher berhasil digunakan!",
      voucher_code: v.voucher_code
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menggunakan voucher", error: err.message });
  }
});

export default router;
