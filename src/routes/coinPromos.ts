import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../db/db.js";

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
    const { title, description, coin_cost, discount_type, discount_value, free_item_name, required_item_name, min_order, max_usage, valid_until, image_url, category } = req.body;
    
    if (!title || !coin_cost) {
      return res.status(400).json({ message: "Judul dan biaya koin wajib diisi" });
    }

    const id = `cp-${Date.now()}`;
    const untilDate = valid_until ? new Date(valid_until) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const validUntilMysql = untilDate.toISOString().slice(0, 19).replace('T', ' ');

    await db.query(
      `INSERT INTO coin_promos 
       (id, title, description, coin_cost, discount_type, discount_value, free_item_name, required_item_name, min_order, max_usage, valid_until, is_active, image_url, category) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, title, description || "", parseInt(coin_cost), discount_type || "fixed", 
        parseInt(discount_value) || 0, free_item_name || null, required_item_name || null,
        parseInt(min_order) || 0, parseInt(max_usage) || 100, 
        validUntilMysql, 1, image_url || "", category || "Semua"
      ]
    );

    const [newPromo]: any = await db.query("SELECT * FROM coin_promos WHERE id = ?", [id]);
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
    const { title, description, coin_cost, discount_type, discount_value, free_item_name, required_item_name, min_order, max_usage, valid_until, is_active, image_url, category } = req.body;
    const { id } = req.params;

    const updates = [];
    const params = [];
    
    if (title !== undefined) { updates.push("title = ?"); params.push(title); }
    if (description !== undefined) { updates.push("description = ?"); params.push(description); }
    if (coin_cost !== undefined) { updates.push("coin_cost = ?"); params.push(parseInt(coin_cost)); }
    if (discount_type !== undefined) { updates.push("discount_type = ?"); params.push(discount_type); }
    if (discount_value !== undefined) { updates.push("discount_value = ?"); params.push(parseInt(discount_value)); }
    if (free_item_name !== undefined) { updates.push("free_item_name = ?"); params.push(free_item_name); }
    if (required_item_name !== undefined) { updates.push("required_item_name = ?"); params.push(required_item_name); }
    if (min_order !== undefined) { updates.push("min_order = ?"); params.push(parseInt(min_order)); }
    if (max_usage !== undefined) { updates.push("max_usage = ?"); params.push(parseInt(max_usage)); }
    if (valid_until !== undefined) { 
      updates.push("valid_until = ?"); 
      params.push(new Date(valid_until).toISOString().slice(0, 19).replace('T', ' ')); 
    }
    if (is_active !== undefined) { updates.push("is_active = ?"); params.push(is_active ? 1 : 0); }
    if (image_url !== undefined) { updates.push("image_url = ?"); params.push(image_url); }
    if (category !== undefined) { updates.push("category = ?"); params.push(category); }

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
    await db.query("DELETE FROM coin_promos WHERE id = ?", [req.params.id]);
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

export default router;
