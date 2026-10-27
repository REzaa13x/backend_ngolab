import { Router, Request, Response } from "express";
import { db } from "../db/db.js";
import { hashPassword, needsPasswordUpgrade, verifyPassword } from "../lib/password.js";
import { normalizeEmail } from "../lib/auth.js";
import { upgradeLegacyPassword } from "../lib/passwordUpgrade.js";
import { getAuthTokenSecret, issueAuthToken, isRoleAllowed } from "../lib/authToken.js";
import { requireAuthenticated } from "../middleware/authSession.js";
import { ensureMemberForUser, getMemberProfile } from "../lib/membershipService.js";

const router = Router();

function authenticatedUser(user: any) {
  const token = issueAuthToken(
    { id: String(user.id), name: String(user.name || user.nama || 'Pengguna'), role: String(user.role) },
    { secret: getAuthTokenSecret() }
  );
  return { user, token };
}

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password, phone_number, phone, identifier } = req.body;
    const loginIdentifier = (identifier || email || phone_number || phone || '').toString().trim();
    const candidatePhone = phone_number || phone || (loginIdentifier && !loginIdentifier.includes('@') ? loginIdentifier : null);
    const normalizedEmail = normalizeEmail(loginIdentifier.includes('@') ? loginIdentifier : email);

    // 1. Cek di tabel users (Pelanggan / Member)
    let customer: any = null;
    if (candidatePhone || normalizedEmail || loginIdentifier) {
      const [customers]: any = await db.query(
        `SELECT id, nama, nim, coin_balance, avatar_url, phone, role, email, rfid_tag_id, password_hash 
         FROM users 
         WHERE phone = ? OR nim = ? OR email = ? OR id = ? 
         LIMIT 1`,
        [candidatePhone || loginIdentifier, loginIdentifier, normalizedEmail || loginIdentifier, loginIdentifier]
      );
      if (customers.length > 0) {
        customer = customers[0];
      }
    }

    if (customer) {
      // Verifikasi password: Jika tidak ada password_hash, tolak passwordless login untuk keamanan
      if (!customer.password_hash) {
        return res.status(401).json({
          success: false,
          message: "Akun ini memerlukan pengaturan password sebelum dapat masuk. Silakan hubungi admin atau lakukan reset password.",
          code: "PASSWORD_SETUP_REQUIRED",
        });
      }

      if (!password) {
        return res.status(400).json({ success: false, message: "Password wajib diisi untuk akun ini" });
      }

      if (!(await verifyPassword(password, customer.password_hash))) {
        return res.status(401).json({ success: false, message: "Password salah" });
      }

      if (needsPasswordUpgrade(customer.password_hash)) {
        await upgradeLegacyPassword('users', customer.id, password);
      }

      // Pastikan akun membership dan loyalty tersedia
      const member = await ensureMemberForUser(db, customer.id, {
        nama: customer.nama,
        email: customer.email,
        phone: customer.phone,
        nim: customer.nim,
      });
      const profile = await getMemberProfile(customer.id);

      const user = {
        id: customer.id,
        nama: customer.nama,
        nim: customer.nim || "",
        coin_balance: customer.coin_balance || 0,
        avatar_url: customer.avatar_url,
        phone: customer.phone || "",
        email: customer.email || "",
        role: customer.role || "Pelanggan",
        rfid_tag_id: customer.rfid_tag_id || "",
        memberId: member.id,
        memberCode: member.member_code,
        currentPoints: profile?.loyalty.currentPoints ?? 0,
        tier: profile?.tier?.name || "Classmate",
      };
      return res.json({
        success: true,
        message: "Login berhasil",
        ...authenticatedUser(user),
      });
    }

    // 2. Cek di tabel staff (Super Admin, Kasir, Koki, Support)
    if (normalizedEmail || loginIdentifier) {
      const [staffUsers]: any = await db.query(
        "SELECT id, name, role, email, status, password_hash FROM staff WHERE email = ? OR id = ?",
        [normalizedEmail || loginIdentifier, loginIdentifier]
      );

      if (staffUsers.length > 0) {
        const staff = staffUsers[0];

        if (!password) {
          return res.status(400).json({ success: false, message: "Email dan password wajib diisi" });
        }

        if (!(await verifyPassword(password, staff.password_hash))) {
          return res.status(401).json({ success: false, message: "Email atau password salah" });
        }

        if (staff.status !== "active") {
          return res.status(403).json({ success: false, message: "Akun Anda tidak aktif" });
        }

        if (needsPasswordUpgrade(staff.password_hash)) {
          await upgradeLegacyPassword('staff', staff.id, password);
        }

        const authenticatedStaff = {
          id: staff.id,
          name: staff.name,
          role: staff.role,
          email: staff.email,
        };
        return res.json({
          success: true,
          message: "Login berhasil",
          ...authenticatedUser(authenticatedStaff),
        });
      }
    }

    return res.status(401).json({ success: false, message: "Email atau password salah" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan server", error: err.message });
  }
});

// POST /api/auth/register
// CATATAN KEAMANAN: Registrasi publik HANYA membuat akun Pelanggan/Member.
// Pembuatan staf (Kasir, Koki, Support, Admin) hanya diperbolehkan melalui rute terproteksi /api/staff oleh Super Admin.
router.post("/register", async (req: Request, res: Response) => {
  try {
    const rawName = req.body.nama || req.body.name;
    const name = rawName ? String(rawName).trim() : '';
    const nim = req.body.nim ? String(req.body.nim).trim() : null;
    const contactPhone = req.body.phone_number || req.body.phone || null;
    const normalizedEmail = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!name || (!normalizedEmail && !contactPhone && !nim)) {
      return res.status(400).json({ success: false, message: "Nama dan setidaknya email atau nomor telepon wajib diisi" });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password wajib diisi dan minimal 6 karakter" });
    }

    // Cek duplikasi nomor telepon jika disertakan
    if (contactPhone) {
      const [existingPhone]: any = await db.query("SELECT id FROM users WHERE phone = ?", [contactPhone]);
      if (existingPhone.length > 0) {
        return res.status(400).json({ success: false, message: "Nomor telepon sudah terdaftar" });
      }
    }

    // Cek duplikasi NIM jika disertakan
    if (nim) {
      const [existingNim]: any = await db.query("SELECT id FROM users WHERE nim = ?", [nim]);
      if (existingNim.length > 0) {
        return res.status(400).json({ success: false, message: "NIM sudah terdaftar" });
      }
    }

    // Cek duplikasi email jika disertakan
    if (normalizedEmail) {
      const [existingEmail]: any = await db.query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
      if (existingEmail.length > 0) {
        return res.status(400).json({ success: false, message: "Email sudah terdaftar sebagai pelanggan" });
      }
      const [existingStaffEmail]: any = await db.query("SELECT id FROM staff WHERE email = ?", [normalizedEmail]);
      if (existingStaffEmail.length > 0) {
        return res.status(400).json({ success: false, message: "Email sudah terdaftar sebagai staf" });
      }
    }

    const newId = `u-${Date.now()}`;
    const initialCoin = 100; // Bonus pendaftaran legacy
    const avatar = req.body.avatar_url || `https://picsum.photos/seed/${newId}/100/100`;
    const hashedPassword = await hashPassword(password);

    // Simpan akun customer: role strictly 'Pelanggan', TIDAK MENULIS password_plain baru
    await db.query(
      "INSERT INTO users (id, nama, nim, coin_balance, avatar_url, phone, role, email, password_hash, password_plain) VALUES (?, ?, ?, ?, ?, ?, 'Pelanggan', ?, ?, NULL)",
      [newId, name, nim || contactPhone || newId, initialCoin, avatar, contactPhone, normalizedEmail, hashedPassword]
    );

    // Catat riwayat bonus pendaftaran koin legacy
    const txId = `ct-${Date.now()}`;
    try {
      await db.query(
        "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, 'Bonus Pendaftaran')",
        [txId, newId, name, initialCoin]
      );
    } catch (_) {}

    // Buat profil membership dan loyalty account baru secara otomatis
    const member = await ensureMemberForUser(db, newId, {
      nama: name,
      email: normalizedEmail,
      phone: contactPhone,
      nim: nim || contactPhone || null,
    });
    const profile = await getMemberProfile(newId);

    const registeredCustomer = {
      id: newId,
      nama: name,
      nim: nim || contactPhone || newId,
      coin_balance: initialCoin,
      avatar_url: avatar,
      phone: contactPhone,
      role: "Pelanggan",
      email: normalizedEmail,
      memberId: member.id,
      memberCode: member.member_code,
      currentPoints: profile?.loyalty.currentPoints ?? 0,
      tier: profile?.tier?.name || "Classmate",
    };

    return res.status(201).json({
      success: true,
      message: "Registrasi berhasil",
      ...authenticatedUser(registeredCustomer),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal mendaftar akun", error: err.message });
  }
});

// POST /api/auth/change-password
router.post("/change-password", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    if (!auth?.id) {
      return res.status(401).json({ success: false, message: "Sesi tidak valid" });
    }

    const { current_password, new_password, password } = req.body;
    const targetPassword = new_password || password;

    if (!targetPassword || String(targetPassword).length < 6) {
      return res.status(400).json({ success: false, message: "Password baru wajib diisi dan minimal 6 karakter" });
    }

    const isStaff = isRoleAllowed(auth, ['Super Admin', 'Admin', 'Kasir', 'Koki', 'Support']);
    const table = isStaff ? 'staff' : 'users';

    const [rows]: any = await db.query(`SELECT id, password_hash FROM ${table} WHERE id = ?`, [auth.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan" });
    }

    if (current_password) {
      const match = await verifyPassword(current_password, rows[0].password_hash);
      if (!match) {
        return res.status(400).json({ success: false, message: "Password saat ini tidak sesuai" });
      }
    }

    const hashed = await hashPassword(targetPassword);
    await db.query(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [hashed, auth.id]);

    res.json({ success: true, message: "Password berhasil diperbarui" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal memperbarui password", error: err.message });
  }
});

export default router;
