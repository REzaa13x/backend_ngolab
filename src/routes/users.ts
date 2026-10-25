import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { db } from "../db/db.js";
import { hashPassword, needsPasswordUpgrade, verifyPassword } from "../lib/password.js";
import { normalizeEmail } from "../lib/auth.js";
import { upgradeLegacyPassword } from "../lib/passwordUpgrade.js";
import { isRoleAllowed } from "../lib/authToken.js";
import { requireAuthenticated, requireRoles } from '../middleware/authSession.js';
import { creditPoints, ensureMemberForUser, getMemberProfile } from "../lib/membershipService.js";

const router = Router();
const requireUserAdmin = requireRoles('Super Admin', 'Kasir', 'Support');

// ─── Multer Config Avatar ───────────────────────────────────────────────────
const avatarUploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF."));
  },
});

function extractUploadedFile(req: Request): Express.Multer.File | undefined {
  const anyReq = req as any;
  if (anyReq.file) return anyReq.file;
  if (Array.isArray(anyReq.files) && anyReq.files.length > 0) return anyReq.files[0];
  return undefined;
}

function persistAvatarInput(rawAvatar: unknown): string {
  const value = String(rawAvatar ?? "").trim();
  const match = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/i.exec(value);
  if (!match) return value;
  const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  const filename = `avatar-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;
  const targetPath = path.join(avatarUploadDir, filename);
  fs.writeFileSync(targetPath, Buffer.from(match[2], "base64"));
  return `/uploads/avatars/${filename}`;
}

// GET /api/users
router.get("/", requireUserAdmin, async (_req: Request, res: Response) => {
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
        COALESCE(u.password_plain, '') AS password_plain,
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

// GET /api/users/profile — Mengambil profil user & saldo koin saat ini
router.get("/profile", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const [rows]: any = await db.query(
      "SELECT id, nama, nim, phone, avatar_url, coin_balance, rfid_tag_id, email, role FROM users WHERE id = ?",
      [auth.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    const user = rows[0];
    const member = await ensureMemberForUser(db, user.id, {
      nama: user.nama,
      phone: user.phone,
      nim: user.nim,
      email: user.email,
    });
    const profile = await getMemberProfile(user.id);
    const currentPoints = Math.max(
      Number(user.coin_balance || 0),
      Number(profile?.loyalty.currentPoints ?? 0)
    );
    const lifetimePoints = Math.max(
      currentPoints,
      Number(profile?.loyalty.lifetimeEarnedPoints ?? 0)
    );

    const userPayload = {
      id: user.id,
      nama: user.nama,
      nim: user.nim || "",
      email: user.email || "",
      phone: user.phone || "",
      telp: user.phone || "",
      role: user.role || "Pelanggan",
      avatar_url: user.avatar_url || "",
      avatar: user.avatar_url || "",
      coin_balance: currentPoints,
      poin: currentPoints,
      totalPoin: lifetimePoints,
      rfid_tag_id: user.rfid_tag_id || "",
      memberId: member.id,
      memberCode: member.member_code,
      currentPoints,
      tier: profile?.tier?.name || "Classmate",
    };

    res.json({
      ...userPayload,
      user: userPayload,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil profil", error: err.message });
  }
});

// PUT /api/users/profile — Update nama lengkap, email, NIM, nomor telepon & foto profil
router.put("/profile", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const { nama, phone, telp, avatar_url, avatar, email, nim } = req.body;
    const resolvedPhone = phone !== undefined ? phone : telp;
    const resolvedAvatar = avatar_url !== undefined ? avatar_url : avatar;
    const normalizedUpdateEmail = email === undefined ? undefined : normalizeEmail(email);

    const updates: string[] = [];
    const params: any[] = [];

    if (nama !== undefined) {
      const trimmedNama = String(nama).trim();
      if (!trimmedNama) {
        return res.status(400).json({ success: false, message: "Nama tidak boleh kosong" });
      }
      updates.push("nama = ?");
      params.push(trimmedNama);
    }
    if (resolvedPhone !== undefined) {
      const trimmedPhone = String(resolvedPhone).trim();
      if (trimmedPhone) {
        const [phoneOwner]: any = await db.query(
          "SELECT id FROM users WHERE phone = ? AND id != ?",
          [trimmedPhone, auth.id]
        );
        if (phoneOwner.length > 0) {
          return res.status(400).json({ success: false, message: "Nomor telepon sudah digunakan akun lain" });
        }
      }
      updates.push("phone = ?");
      params.push(trimmedPhone || null);
    }
    if (resolvedAvatar !== undefined) {
      updates.push("avatar_url = ?");
      params.push(persistAvatarInput(resolvedAvatar));
    }
    if (email !== undefined) {
      if (normalizedUpdateEmail) {
        const [emailOwner]: any = await db.query(
          "SELECT id FROM users WHERE email = ? AND id != ?",
          [normalizedUpdateEmail, auth.id]
        );
        if (emailOwner.length > 0) {
          return res.status(400).json({ success: false, message: "Email sudah digunakan pengguna lain" });
        }
        const [staffEmailOwner]: any = await db.query(
          "SELECT id FROM staff WHERE email = ?",
          [normalizedUpdateEmail]
        );
        if (staffEmailOwner.length > 0) {
          return res.status(400).json({ success: false, message: "Email sudah digunakan oleh akun staf" });
        }
      }
      updates.push("email = ?");
      params.push(normalizedUpdateEmail || null);
    }
    if (nim !== undefined) {
      const trimmedNim = String(nim).trim();
      if (trimmedNim) {
        const [nimOwner]: any = await db.query(
          "SELECT id FROM users WHERE nim = ? AND id != ?",
          [trimmedNim, auth.id]
        );
        if (nimOwner.length > 0) {
          return res.status(400).json({ success: false, message: "NIM sudah terdaftar pada akun lain" });
        }
      }
      updates.push("nim = ?");
      params.push(trimmedNim || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "Tidak ada data yang diperbarui" });
    }
    params.push(auth.id);
    await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    const [updatedRows]: any = await db.query(
      "SELECT id, nama, nim, phone, avatar_url, coin_balance, rfid_tag_id, email, role FROM users WHERE id = ?",
      [auth.id]
    );
    const updated = updatedRows[0];
    if (updated) {
      const member = await ensureMemberForUser(db, updated.id, {
        nama: updated.nama,
        phone: updated.phone,
        nim: updated.nim,
        email: updated.email,
      });
      // Sinkronkan identifier member yang diperbarui
      if (updated.nim) {
        await db.query(
          `INSERT INTO member_identifiers (id, member_id, identifier_type, identifier_value, is_primary, is_verified, verified_at)
           VALUES (?, ?, 'STUDENT_NIM', ?, 1, 1, NOW())
           ON DUPLICATE KEY UPDATE identifier_value = VALUES(identifier_value), updated_at = NOW()`,
          [`mi-nim-${member.id}`.slice(0, 50), member.id, updated.nim]
        ).catch(() => {});
      }
    }

    res.json({
      success: true,
      message: "Profil berhasil diperbarui",
      user: updated ? {
        id: updated.id,
        nama: updated.nama,
        nim: updated.nim || "",
        email: updated.email || "",
        phone: updated.phone || "",
        telp: updated.phone || "",
        role: updated.role || "Pelanggan",
        avatar_url: updated.avatar_url || "",
        avatar: updated.avatar_url || "",
        coin_balance: Number(updated.coin_balance || 0),
        poin: Number(updated.coin_balance || 0),
      } : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal memperbarui profil", error: err.message });
  }
});

// PUT /api/users/password — Ganti password akun di modal Edit Profile
router.put("/password", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const { password, new_password, newPassword } = req.body;
    const targetPassword = new_password || newPassword || password;
    if (!targetPassword || String(targetPassword).length < 6) {
      return res.status(400).json({ success: false, message: "Password minimal 6 karakter" });
    }
    const hashed = await hashPassword(targetPassword);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashed, auth.id]);
    res.json({ success: true, message: "Password berhasil diperbarui" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal memperbarui password", error: err.message });
  }
});

// POST /api/users/avatar — Upload & ganti foto profil (mendukung field 'file' maupun 'avatar')
router.post("/avatar", requireAuthenticated, uploadAvatar.any(), async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const uploadedFile = extractUploadedFile(req);
    let avatarUrl = "";
    if (uploadedFile) {
      avatarUrl = `/uploads/avatars/${uploadedFile.filename}`;
    } else if (req.body?.avatar_url) {
      avatarUrl = req.body.avatar_url;
    } else {
      return res.status(400).json({ success: false, message: "File gambar atau avatar_url wajib disertakan" });
    }

    await db.query("UPDATE users SET avatar_url = ? WHERE id = ?", [avatarUrl, auth.id]);
    res.json({
      success: true,
      message: "Foto profil berhasil diperbarui",
      avatar_url: avatarUrl,
      avatar: avatarUrl,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengunggah foto profil", error: err.message });
  }
});

// GET /api/users/:id/recommendations
router.get("/:id/recommendations", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentAuth = (req as any).auth;
    if (currentAuth?.role === 'Pelanggan' && String(currentAuth.id) !== String(id)) {
      return res.status(403).json({ message: 'Anda hanya dapat melihat data akun sendiri' });
    }
    
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

    const member = await ensureMemberForUser(db, user.id, {
      nama: user.nama,
      phone: user.phone,
      nim: user.nim,
      email: user.email,
    });
    const profile = await getMemberProfile(user.id);
    const currentPoints = Math.max(
      Number(user.coin_balance || 0),
      Number(profile?.loyalty.currentPoints ?? 0)
    );

    res.json({
      user: {
        id: user.id,
        nama: user.nama,
        nim: user.nim || "",
        email: user.email || "",
        phone: user.phone || "",
        avatar_url: user.avatar_url || "",
        role: user.role || "Pelanggan",
        coin_balance: currentPoints,
        currentPoints,
        memberId: member.id,
        memberCode: member.member_code,
        tier: profile?.tier?.name || "Classmate",
      },
      recommendations
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil rekomendasi", error: err.message });
  }
});

// GET /api/coin-transactions
router.get("/transactions", requireUserAdmin, async (req: Request, res: Response) => {
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
    const { id, nama, nim, avatar_url, email, phone, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!id || !nama) {
      return res.status(400).json({ message: "ID dan Nama wajib diisi" });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: "Password wajib diisi dan minimal 6 karakter" });
    }

    // Cek apakah user sudah terdaftar
    const [existing]: any = await db.query("SELECT id FROM users WHERE id = ?", [id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "User ID / NIM sudah terdaftar" });
    }
    const [staffIdOwner]: any = await db.query("SELECT id FROM staff WHERE id = ?", [id]);
    if (staffIdOwner.length > 0) {
      return res.status(400).json({ message: "User ID tidak dapat menggunakan ID staf" });
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
    const userRole = 'Pelanggan';
    const hashedPassword = await hashPassword(password);

    // Keamanan: Kolom password_plain tidak lagi menyimpan plaintext baru (diisi NULL)
    await db.query(
      "INSERT INTO users (id, nama, nim, coin_balance, avatar_url, email, phone, role, password_hash, password_plain) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, nama, nim || id, initialCoin, avatar, normalizedEmail, phone || null, userRole, hashedPassword, null]
    );

    // Catat riwayat bonus pendaftaran
    const txId = `ct-${Date.now()}`;
    await db.query(
      "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, 'Bonus Pendaftaran')",
      [txId, id, nama, initialCoin]
    );

    // Otomatis buat profil keanggotaan dan loyalty account
    const member = await ensureMemberForUser(db, id, {
      nama,
      email: normalizedEmail,
      phone: phone || null,
      nim: nim || id,
    });

    res.status(201).json({
      message: "User berhasil terdaftar",
      user: {
        id,
        nama,
        nim: nim || id,
        coin_balance: initialCoin,
        currentPoints: initialCoin,
        avatar_url: avatar,
        email: normalizedEmail,
        phone: phone || null,
        role: userRole,
        active_vouchers_count: 0,
        memberId: member.id,
        memberCode: member.member_code,
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
    if (!user.password_hash) {
      return res.status(401).json({
        message: "Akun ini memerlukan pengaturan password sebelum dapat masuk. Silakan hubungi admin atau lakukan reset password.",
        code: "PASSWORD_SETUP_REQUIRED",
      });
    }

    if (!password || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ message: "User ID / NIM atau password salah" });
    }
    if (needsPasswordUpgrade(user.password_hash)) {
      await upgradeLegacyPassword('users', user.id, password);
    }

    const member = await ensureMemberForUser(db, user.id, {
      nama: user.nama,
      email: user.email,
      phone: user.phone,
      nim: user.nim,
    });
    const profile = await getMemberProfile(user.id);
    const currentPoints = Math.max(
      Number(user.coin_balance || 0),
      Number(profile?.loyalty.currentPoints ?? 0)
    );

    res.json({
      message: "Login berhasil",
      user: {
        id: user.id,
        nama: user.nama,
        nim: user.nim,
        coin_balance: currentPoints,
        avatar_url: user.avatar_url,
        memberId: member.id,
        memberCode: member.member_code,
        currentPoints,
        tier: profile?.tier?.name || "Classmate",
      }
    });
  } catch (err: any) {
    res.status(500).json({ message: "Terjadi kesalahan server saat login", error: err.message });
  }
});

// POST /api/users/:id/earn-coins — Tambah Koin (dari game atau aktivitas Kiosk)
router.post("/:id/earn-coins", requireUserAdmin, async (req: Request, res: Response) => {
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
    const desc = description || "Hadiah koin dari aktivitas game/kiosk";

    const member = await ensureMemberForUser(connection, user.id, {
      nama: user.nama,
      phone: user.phone,
      nim: user.nim,
      email: user.email,
    });

    // Tambah poin via loyalty ledger (otomatis menyinkronkan users.coin_balance)
    const creditResult = await creditPoints({
      connection,
      memberId: member.id,
      points: parsedAmount,
      transactionType: "GAMIFICATION",
      referenceType: "LEGACY_COIN_EARN",
      description: desc,
    });

    // Catat transaksi koin masuk
    const txId = `ct-${Date.now()}`;
    await connection.query(
      "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, ?)",
      [txId, id, user.nama, parsedAmount, desc]
    );

    await connection.commit();

    res.json({
      message: "Koin berhasil ditambahkan",
      new_balance: creditResult.newBalance,
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
router.get("/:user_id/study-sessions", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const currentAuth = (req as any).auth;
    if (currentAuth?.role === 'Pelanggan' && String(currentAuth.id) !== String(user_id)) {
      return res.status(403).json({ message: 'Anda hanya dapat melihat data akun sendiri' });
    }
    const [rows]: any = await db.query(
      "SELECT * FROM study_sessions WHERE user_id = ? ORDER BY created_at DESC",
      [user_id]
    );
    const enriched = rows.map((row: any) => ({
      ...row,
      task_title: row.subject,
      taskTitle: row.subject,
      duration: Number(row.duration_minutes || 0),
      durationMinutes: Number(row.duration_minutes || 0),
      points: Number(row.points_earned || 0),
      coins: Number(row.points_earned || 0),
    }));
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil riwayat sesi belajar", error: err.message });
  }
});

// POST /api/users/:user_id/study-sessions — Simpan sesi belajar baru & tambah koin
router.post("/:user_id/study-sessions", requireAuthenticated, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { user_id } = req.params;
    const currentAuth = (req as any).auth;
    if (currentAuth?.role === 'Pelanggan' && String(currentAuth.id) !== String(user_id)) {
      await connection.rollback();
      return res.status(403).json({ message: 'Anda hanya dapat menambah aktivitas akun sendiri' });
    }
    const {
      subject,
      task_title,
      notes,
      duration_minutes,
      duration,
      planned_duration,
      points_earned,
      points,
      coins,
      session_id,
      skip_credit,
    } = req.body;

    const resolvedSubject = String(subject || task_title || notes || "").trim();
    const rawDuration = duration_minutes !== undefined ? duration_minutes : (duration ?? planned_duration);
    const rawPoints = points_earned !== undefined ? points_earned : (points ?? coins);

    if (!resolvedSubject || rawDuration === undefined || rawPoints === undefined) {
      await connection.rollback();
      return res.status(400).json({ message: "Subject/task_title, duration_minutes/duration, dan points_earned/points wajib diisi" });
    }

    const parsedDuration = Math.max(0, parseInt(String(rawDuration), 10) || 0);
    const parsedPoints = Math.max(0, parseInt(String(rawPoints), 10) || 0);

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
      [user_id, resolvedSubject, parsedDuration, parsedPoints]
    );

    let newBalance = Number(user.coin_balance || 0);

    // Bila dipanggil dari NGOLAB-GAMI MobileStudyTracker (menyertakan session_id), kredit poin
    // dilakukan melalui endpoint kanonik /api/members/:id/points/earn ber-idempotency-key
    // tepat setelah request ini agar tidak terjadi kredit ganda.
    if (!session_id && !skip_credit && parsedPoints > 0) {
      const member = await ensureMemberForUser(connection, user.id, {
        nama: user.nama,
        phone: user.phone,
        nim: user.nim,
        email: user.email,
      });
      const creditResult = await creditPoints({
        connection,
        memberId: member.id,
        points: parsedPoints,
        transactionType: "GAMIFICATION",
        referenceType: "STUDY_SESSION_LEGACY",
        description: `Belajar: ${resolvedSubject} (${parsedDuration} Menit)`,
      });
      newBalance = creditResult.newBalance;

      // Catat transaksi koin masuk
      const txId = `ct-${Date.now()}`;
      await connection.query(
        "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, ?)",
        [txId, user_id, user.nama, parsedPoints, `Belajar: ${resolvedSubject} (${parsedDuration} Menit)`]
      );
    }

    await connection.commit();

    const io = req.app.get('io');
    if (io) {
      io.emit("stats_updated");
    }

    res.status(201).json({
      message: "Sesi belajar berhasil disimpan",
      points_earned: parsedPoints,
      new_balance: newBalance,
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal menyimpan sesi belajar", error: err.message });
  } finally {
    connection.release();
  }
});

// PUT /api/users/:id — Update Profile User (Nama & Avatar secara permanen)
router.put("/:id", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const isOwner = String(auth?.id) === String(id);
    const isAdmin = isRoleAllowed(auth, ['Super Admin', 'Admin', 'Kasir', 'Support']);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki izin untuk mengedit profil ini" });
    }

    const { nama, avatar_url, avatar, nim, email, phone, telp, password } = req.body;
    const resolvedPhone = phone !== undefined ? phone : telp;
    const resolvedAvatar = avatar_url !== undefined ? avatar_url : avatar;
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
      params.push(String(nama).trim());
    }
    if (resolvedAvatar !== undefined) {
      updates.push("avatar_url = ?");
      params.push(persistAvatarInput(resolvedAvatar));
    }
    if (nim !== undefined) {
      updates.push("nim = ?");
      params.push(String(nim).trim() || null);
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
    if (resolvedPhone !== undefined) {
      updates.push("phone = ?");
      params.push(String(resolvedPhone).trim());
    }
    if (password !== undefined && password !== '') {
      updates.push("password_hash = ?");
      params.push(await hashPassword(password));
      updates.push("password_plain = ?");
      params.push(isAdmin ? password : null);
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
    const updatedRow = updatedUser[0];
    let enrichedUser = updatedRow;
    if (updatedRow) {
      const member = await ensureMemberForUser(db, updatedRow.id, {
        nama: updatedRow.nama,
        phone: updatedRow.phone,
        nim: updatedRow.nim,
        email: updatedRow.email,
      });
      const profile = await getMemberProfile(updatedRow.id);
      const currentPoints = Math.max(
        Number(updatedRow.coin_balance || 0),
        Number(profile?.loyalty.currentPoints ?? 0)
      );
      enrichedUser = {
        ...updatedRow,
        coin_balance: currentPoints,
        currentPoints,
        memberId: member.id,
        memberCode: member.member_code,
      };
    }

    res.json({
      success: true,
      message: "Profil berhasil diperbarui secara permanen di database",
      user: enrichedUser
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal memperbarui profil", error: err.message });
  }
});

// POST /api/users/:id/avatar — Upload & ganti foto profil user (mendukung field 'file' maupun 'avatar')
router.post("/:id/avatar", requireAuthenticated, uploadAvatar.any(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const isOwner = String(auth?.id) === String(id);
    const isAdmin = isRoleAllowed(auth, ['Super Admin', 'Admin', 'Kasir', 'Support']);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki izin untuk mengedit avatar akun ini" });
    }
    const uploadedFile = extractUploadedFile(req);
    let avatarUrl = "";
    if (uploadedFile) {
      avatarUrl = `/uploads/avatars/${uploadedFile.filename}`;
    } else if (req.body?.avatar_url) {
      avatarUrl = req.body.avatar_url;
    } else {
      return res.status(400).json({ success: false, message: "File gambar atau avatar_url wajib disertakan" });
    }

    await db.query("UPDATE users SET avatar_url = ? WHERE id = ?", [avatarUrl, id]);
    res.json({
      success: true,
      message: "Foto profil berhasil diperbarui",
      avatar_url: avatarUrl,
      avatar: avatarUrl,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mengunggah foto profil", error: err.message });
  }
});

export default router;
