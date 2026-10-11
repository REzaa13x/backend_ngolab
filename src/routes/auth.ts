import { Router, Request, Response } from "express";
import { db } from "../db/db.js";
import { hashPassword, needsPasswordUpgrade, verifyPassword } from "../lib/password.js";
import { normalizeEmail } from "../lib/auth.js";
import { upgradeLegacyPassword } from "../lib/passwordUpgrade.js";
import { getAuthTokenSecret, issueAuthToken } from "../lib/authToken.js";
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
    const { email, password, phone_number } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Hybrid Check: Jika menggunakan phone_number, asumsikan ini Customer (Pelanggan)
    if (phone_number) {
      const [customers]: any = await db.query(
        "SELECT id, nama, nim, coin_balance, avatar_url, phone, role, password_hash FROM users WHERE phone = ?",
        [phone_number]
      );

      if (customers.length === 0) {
        return res.status(404).json({ message: "Nomor telepon belum terdaftar sebagai pelanggan" });
      }

      const customer = customers[0];

      // Verifikasi password: Jika tidak ada password_hash, tolak passwordless login untuk keamanan
      if (!customer.password_hash) {
        return res.status(401).json({
          message: "Akun ini memerlukan pengaturan password sebelum dapat masuk. Silakan hubungi admin atau lakukan reset password.",
          code: "PASSWORD_SETUP_REQUIRED",
        });
      }

      if (!password) {
        return res.status(400).json({ message: "Password wajib diisi untuk akun ini" });
      }

      if (!(await verifyPassword(password, customer.password_hash))) {
        return res.status(401).json({ message: "Password salah" });
      }

      if (needsPasswordUpgrade(customer.password_hash)) {
        await upgradeLegacyPassword('users', customer.id, password);
      }

      // Pastikan akun membership dan loyalty tersedia
      const member = await ensureMemberForUser(db, customer.id, {
        nama: customer.nama,
        phone: customer.phone,
        nim: customer.nim,
      });
      const profile = await getMemberProfile(customer.id);

      const user = {
        id: customer.id,
        nama: customer.nama,
        nim: customer.nim,
        coin_balance: customer.coin_balance,
        avatar_url: customer.avatar_url,
        phone: customer.phone,
        role: customer.role || "Pelanggan",
        memberId: member.id,
        memberCode: member.member_code,
        currentPoints: profile?.loyalty.currentPoints ?? 0,
        tier: profile?.tier?.name || "Classmate",
      };
      return res.json({ message: "Login berhasil", ...authenticatedUser(user) });
    }

    if (!email || !password) {
      return res.status(400).json({ message: "Email dan password wajib diisi" });
    }

    // Cek di tabel staff (Super Admin, Kasir, Koki, Support)
    const [staffUsers]: any = await db.query(
      "SELECT id, name, role, email, status, password_hash FROM staff WHERE email = ?",
      [normalizedEmail]
    );

    if (staffUsers.length > 0) {
      const user = staffUsers[0];

      if (!(await verifyPassword(password, user.password_hash))) {
        return res.status(401).json({ message: "Email atau password salah" });
      }

      if (user.status !== "active") {
        return res.status(403).json({ message: "Akun Anda tidak aktif" });
      }

      if (needsPasswordUpgrade(user.password_hash)) {
        await upgradeLegacyPassword('staff', user.id, password);
      }

      const authenticatedStaff = {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
      };
      return res.json({ message: "Login berhasil", ...authenticatedUser(authenticatedStaff) });
    }

    // Cek di tabel users (Pelanggan) jika tidak ditemukan di staff
    const [customers]: any = await db.query(
      "SELECT id, nama, nim, coin_balance, avatar_url, phone, role, email, password_hash FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (customers.length > 0) {
      const customer = customers[0];

      if (!customer.password_hash) {
        return res.status(401).json({
          message: "Akun ini memerlukan pengaturan password sebelum dapat masuk. Silakan hubungi admin atau lakukan reset password.",
          code: "PASSWORD_SETUP_REQUIRED",
        });
      }

      if (!(await verifyPassword(password, customer.password_hash))) {
        return res.status(401).json({ message: "Email atau password salah" });
      }
      if (needsPasswordUpgrade(customer.password_hash)) {
        await upgradeLegacyPassword('users', customer.id, password);
      }

      const member = await ensureMemberForUser(db, customer.id, {
        nama: customer.nama,
        email: customer.email,
        phone: customer.phone,
        nim: customer.nim,
      });
      const profile = await getMemberProfile(customer.id);

      const authenticatedCustomer = {
        id: customer.id,
        nama: customer.nama,
        nim: customer.nim,
        coin_balance: customer.coin_balance,
        avatar_url: customer.avatar_url,
        phone: customer.phone,
        role: customer.role || "Pelanggan",
        email: customer.email,
        memberId: member.id,
        memberCode: member.member_code,
        currentPoints: profile?.loyalty.currentPoints ?? 0,
        tier: profile?.tier?.name || "Classmate",
      };
      return res.json({ message: "Login berhasil", ...authenticatedUser(authenticatedCustomer) });
    }

    return res.status(401).json({ message: "Email atau password salah" });
  } catch (err: any) {
    res.status(500).json({ message: "Terjadi kesalahan server", error: err.message });
  }
});

// POST /api/auth/register
// CATATAN KEAMANAN: Registrasi publik HANYA membuat akun Pelanggan/Member.
// Pembuatan staf (Kasir, Koki, Support, Admin) hanya diperbolehkan melalui rute terproteksi /api/staff oleh Super Admin.
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, phone_number } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const contactPhone = phone_number || phone || null;

    if (!name || (!normalizedEmail && !contactPhone)) {
      return res.status(400).json({ message: "Nama dan setidaknya email atau nomor telepon wajib diisi" });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: "Password wajib diisi dan minimal 6 karakter" });
    }

    // Cek duplikasi nomor telepon jika disertakan
    if (contactPhone) {
      const [existingPhone]: any = await db.query("SELECT id FROM users WHERE phone = ?", [contactPhone]);
      if (existingPhone.length > 0) {
        return res.status(400).json({ message: "Nomor telepon sudah terdaftar" });
      }
    }

    // Cek duplikasi email jika disertakan
    if (normalizedEmail) {
      const [existingEmail]: any = await db.query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
      if (existingEmail.length > 0) {
        return res.status(400).json({ message: "Email sudah terdaftar sebagai pelanggan" });
      }
      const [existingStaffEmail]: any = await db.query("SELECT id FROM staff WHERE email = ?", [normalizedEmail]);
      if (existingStaffEmail.length > 0) {
        return res.status(400).json({ message: "Email sudah terdaftar sebagai staf" });
      }
    }

    const newId = `u-${Date.now()}`;
    const initialCoin = 100; // Bonus pendaftaran legacy
    const avatar = `https://picsum.photos/seed/${newId}/100/100`;
    const hashedPassword = await hashPassword(password);

    // Simpan akun customer: role strictly 'Pelanggan', TIDAK MENULIS password_plain baru
    await db.query(
      "INSERT INTO users (id, nama, nim, coin_balance, avatar_url, phone, role, email, password_hash, password_plain) VALUES (?, ?, ?, ?, ?, ?, 'Pelanggan', ?, ?, NULL)",
      [newId, name, contactPhone || newId, initialCoin, avatar, contactPhone, normalizedEmail, hashedPassword]
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
      nim: contactPhone || null,
    });
    const profile = await getMemberProfile(newId);

    const registeredCustomer = {
      id: newId,
      nama: name,
      nim: contactPhone || newId,
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

    return res.status(201).json({ message: "Registrasi berhasil", ...authenticatedUser(registeredCustomer) });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mendaftar akun", error: err.message });
  }
});

export default router;
