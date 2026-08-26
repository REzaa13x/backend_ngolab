import { Router, Request, Response } from "express";
import { db } from "../db/db.js";
import { hashPassword, needsPasswordUpgrade, verifyPassword } from "../lib/password.js";
import { normalizeEmail } from "../lib/auth.js";
import { upgradeLegacyPassword } from "../lib/passwordUpgrade.js";

const router = Router();

// GET /api/users
router.get("/", async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u.nama, 
        u.nim, 
        u.coin_balance, 
        u.avatar_url, 
        u.rfid_tag_id, 
        u.email, 
        u.phone, 
        u.role, 
        u.created_at, 
        u.updated_at,
        COALESCE(v.active_vouchers_count, 0) AS active_vouchers_count
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS active_vouchers_count
        FROM user_vouchers
        WHERE status = 'unused'
        GROUP BY user_id
      ) v ON u.id = v.user_id
      ORDER BY u.created_at DESC
    `;
    const [users]: any = await db.query(query);
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil data pelanggan", error: err.message });
  }
});

// GET /api/users/:id/recommendations
router.get("/:id/recommendations", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 1. Get user
    const [users]: any = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    if (!users.length) return res.status(404).json({ message: "User tidak ditemukan" });
    const user = users[0];

    // 2. Get active promos
    const now = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format MySQL Datetime
    const [promos]: any = await db.query(
      "SELECT * FROM coin_promos WHERE is_active = 1 AND used_count < max_usage AND valid_until > ?",
      [now]
    );

    // 2.5 Get menus stock status
    const [menus]: any = await db.query("SELECT id, in_stock, stock FROM menus");
    const menuStockMap = new Map();
    menus.forEach((m: any) => {
      menuStockMap.set(m.id.toString(), { in_stock: Boolean(m.in_stock), stock: m.stock });
    });

    // 3. Map recommendations
    const recommendations = promos.map((p: any) => {
      let isProductInStock = true;
      if (p.product_id) {
        const stockInfo = menuStockMap.get(p.product_id.toString());
        if (stockInfo) {
          isProductInStock = stockInfo.in_stock && stockInfo.stock > 0;
        }
      }

      const hasCoins = user.coin_balance >= p.coin_cost;

      return {
        ...p,
        can_redeem: hasCoins && isProductInStock,
        coins_needed: Math.max(0, p.coin_cost - user.coin_balance),
        progress: Math.min(100, Math.round((user.coin_balance / p.coin_cost) * 100)),
        is_out_of_stock: !isProductInStock,
      };
    }).sort((a: any, b: any) => {
      if (a.is_out_of_stock !== b.is_out_of_stock) {
        return a.is_out_of_stock ? 1 : -1;
      }
      return a.can_redeem === b.can_redeem ? a.coin_cost - b.coin_cost : a.can_redeem ? -1 : 1;
    });

    res.json({
      user: { id: user.id, nama: user.nama, coin_balance: user.coin_balance },
      recommendations
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil rekomendasi", error: err.message });
  }
});

// GET /api/coin-transactions
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    let sql = "SELECT * FROM coin_transactions";
    const params = [];
    if (user_id) {
      sql += " WHERE user_id = ?";
      params.push(user_id);
    }
    sql += " ORDER BY created_at DESC";

    const [transactions]: any = await db.query(sql, params);
    res.json(transactions);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil transaksi koin", error: err.message });
  }
});
// POST /api/users/register — Registrasi User / Pelanggan Baru
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { id, nama, nim, avatar_url, email, phone, role, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!id || !nama) {
      return res.status(400).json({ message: "ID dan Nama wajib diisi" });
    }

    // Cek apakah user sudah terdaftar
    const [existing]: any = await db.query("SELECT id FROM users WHERE id = ?", [id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "User ID / NIM sudah terdaftar" });
    }
    if (normalizedEmail) {
      const [emailOwner]: any = await db.query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
      if (emailOwner.length > 0) return res.status(400).json({ message: "Email sudah terdaftar" });
      const [staffEmailOwner]: any = await db.query("SELECT id FROM staff WHERE email = ?", [normalizedEmail]);
      if (staffEmailOwner.length > 0) return res.status(400).json({ message: "Email sudah terdaftar sebagai staf" });
    }
    if (phone) {
      const [phoneOwner]: any = await db.query("SELECT id FROM users WHERE phone = ?", [phone]);
      if (phoneOwner.length > 0) return res.status(400).json({ message: "Nomor telepon sudah terdaftar" });
    }

    const initialCoin = 100; // Bonus pendaftaran 100 koin gratis
    const avatar = avatar_url || `https://picsum.photos/seed/${id}/100/100`;
    const userRole = role || 'Pelanggan';
    const hashedPassword = password ? await hashPassword(password) : null;

    await db.query(
      "INSERT INTO users (id, nama, nim, coin_balance, avatar_url, email, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, nama, nim || id, initialCoin, avatar, normalizedEmail, phone || null, userRole, hashedPassword]
    );

    // Catat riwayat bonus pendaftaran
    const txId = `ct-${Date.now()}`;
    await db.query(
      "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, 'Bonus Pendaftaran')",
      [txId, id, nama, initialCoin]
    );

    res.status(201).json({
      message: "User berhasil terdaftar",
      user: {
        id,
        nama,
        nim: nim || id,
        coin_balance: initialCoin,
        avatar_url: avatar,
        email: normalizedEmail,
        phone: phone || null,
        role: userRole,
        active_vouchers_count: 0
      }
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mendaftarkan user", error: err.message });
  }
});

// POST /api/users/login — Login / Verifikasi User
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { id, password } = req.body;

    if (!id) {
      return res.status(400).json({ message: "User ID / NIM wajib diisi" });
    }

    const [users]: any = await db.query("SELECT * FROM users WHERE id = ? OR nim = ?", [id, id]);
    if (users.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const user = users[0];
    if (user.password_hash) {
      if (!password || !(await verifyPassword(password, user.password_hash))) {
        return res.status(401).json({ message: "User ID / NIM atau password salah" });
      }
      if (needsPasswordUpgrade(user.password_hash)) {
        await upgradeLegacyPassword('users', user.id, password);
      }
    }
    res.json({
      message: "Login berhasil",
      user: {
        id: user.id,
        nama: user.nama,
        nim: user.nim,
        coin_balance: user.coin_balance,
        avatar_url: user.avatar_url
      }
    });
  } catch (err: any) {
    res.status(500).json({ message: "Terjadi kesalahan server saat login", error: err.message });
  }
});

// POST /api/users/:id/earn-coins — Tambah Koin (dari game atau aktivitas Kiosk)
router.post("/:id/earn-coins", async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { amount, description } = req.body;

    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Jumlah koin tidak valid" });
    }

    // Cek apakah user ada
    const [users]: any = await connection.query("SELECT * FROM users WHERE id = ? FOR UPDATE", [id]);
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const user = users[0];

    // Tambah saldo koin
    await connection.query("UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?", [parsedAmount, id]);

    // Catat transaksi koin masuk
    const txId = `ct-${Date.now()}`;
    const desc = description || "Hadiah koin dari aktivitas game/kiosk";
    await connection.query(
      "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, ?)",
      [txId, id, user.nama, parsedAmount, desc]
    );

    await connection.commit();

    const [updatedUser]: any = await db.query("SELECT coin_balance FROM users WHERE id = ?", [id]);

    res.json({
      message: "Koin berhasil ditambahkan",
      new_balance: updatedUser[0].coin_balance,
      transaction: {
        id: txId,
        amount: parsedAmount,
        type: "earn",
        description: desc
      }
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal menambahkan koin", error: err.message });
  } finally {
    connection.release();
  }
});

// GET /api/users/:user_id/study-sessions — Ambil riwayat belajar mahasiswa
router.get("/:user_id/study-sessions", async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const [rows]: any = await db.query(
      "SELECT * FROM study_sessions WHERE user_id = ? ORDER BY created_at DESC",
      [user_id]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil riwayat sesi belajar", error: err.message });
  }
});

// POST /api/users/:user_id/study-sessions — Simpan sesi belajar baru & tambah koin
router.post("/:user_id/study-sessions", async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { user_id } = req.params;
    const { subject, duration_minutes, points_earned } = req.body;

    if (!subject || duration_minutes === undefined || points_earned === undefined) {
      await connection.rollback();
      return res.status(400).json({ message: "Subject, duration_minutes, dan points_earned wajib diisi" });
    }

    // Cek apakah user ada
    const [users]: any = await connection.query("SELECT * FROM users WHERE id = ? FOR UPDATE", [user_id]);
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    const user = users[0];

    // Simpan sesi belajar
    await connection.query(
      "INSERT INTO study_sessions (user_id, subject, duration_minutes, points_earned) VALUES (?, ?, ?, ?)",
      [user_id, subject, parseInt(duration_minutes), parseInt(points_earned)]
    );

    // Tambah saldo koin user
    await connection.query(
      "UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?",
      [parseInt(points_earned), user_id]
    );

    // Catat transaksi koin masuk
    const txId = `ct-${Date.now()}`;
    await connection.query(
      "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, ?)",
      [txId, user_id, user.nama, parseInt(points_earned), `Belajar: ${subject} (${duration_minutes} Menit)`]
    );

    await connection.commit();

    const io = req.app.get('io');
    if (io) {
      io.emit("stats_updated");
    }

    res.status(201).json({
      message: "Sesi belajar berhasil disimpan dan koin ditambahkan",
      points_earned: parseInt(points_earned),
      new_balance: user.coin_balance + parseInt(points_earned)
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal menyimpan sesi belajar", error: err.message });
  } finally {
    connection.release();
  }
});

// PUT /api/users/:id — Update Profile User (Nama & Avatar secara permanen)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nama, avatar_url, nim, email, phone } = req.body;
    const normalizedUpdateEmail = email === undefined ? undefined : normalizeEmail(email);

    // Pastikan user ada
    const [existing]: any = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (nama !== undefined) {
      updates.push("nama = ?");
      params.push(nama);
    }
    if (avatar_url !== undefined) {
      updates.push("avatar_url = ?");
      params.push(avatar_url);
    }
    if (nim !== undefined) {
      updates.push("nim = ?");
      params.push(nim);
    }
    if (email !== undefined) {
      if (normalizedUpdateEmail) {
        const [emailOwner]: any = await db.query("SELECT id FROM users WHERE email = ? AND id != ?", [normalizedUpdateEmail, id]);
        if (emailOwner.length > 0) return res.status(400).json({ message: "Email sudah digunakan pengguna lain" });
        const [staffEmailOwner]: any = await db.query("SELECT id FROM staff WHERE email = ?", [normalizedUpdateEmail]);
        if (staffEmailOwner.length > 0) return res.status(400).json({ message: "Email sudah digunakan staf" });
      }
      updates.push("email = ?");
      params.push(normalizedUpdateEmail);
    }
    if (phone !== undefined) {
      updates.push("phone = ?");
      params.push(phone);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Tidak ada data yang diupdate" });
    }

    params.push(id);
    await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    const [updatedUser]: any = await db.query(
      "SELECT id, nama, nim, coin_balance, avatar_url, rfid_tag_id, email, phone, role, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );

    res.json({
      message: "Profil berhasil diperbarui secara permanen di database",
      user: updatedUser[0]
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal memperbarui profil", error: err.message });
  }
});

export default router;
