import { Router, Request, Response } from "express";
import { db } from "../db/db.js";
import { hashPassword, needsPasswordUpgrade, verifyPassword } from "../lib/password.js";
import { normalizeEmail } from "../lib/auth.js";
import { upgradeLegacyPassword } from "../lib/passwordUpgrade.js";

const router = Router();


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

      // Verifikasi password jika akun memiliki password_hash
      if (customer.password_hash) {
        if (!password) {
          return res.status(400).json({ message: "Password wajib diisi untuk akun ini" });
        }
        if (!(await verifyPassword(password, customer.password_hash))) {
          return res.status(401).json({ message: "Password salah" });
        }
        if (needsPasswordUpgrade(customer.password_hash)) {
          await upgradeLegacyPassword('users', customer.id, password);
        }
      }

      return res.json({
        message: "Login berhasil",
        user: {
          id: customer.id,
          nama: customer.nama,
          nim: customer.nim,
          coin_balance: customer.coin_balance,
          avatar_url: customer.avatar_url,
          phone: customer.phone,
          role: customer.role
        }
      });
    }

    if (!email || !password) {
      return res.status(400).json({ message: "Email dan password wajib diisi" });
    }

    // Cek di tabel staff (Super Admin, Kasir, Koki, dll.)
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

      return res.json({
        message: "Login berhasil",
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email
        }
      });
    }

    // Cek di tabel users (Pelanggan) jika tidak ditemukan di staff
    const [customers]: any = await db.query(
      "SELECT id, nama, nim, coin_balance, avatar_url, phone, role, email, password_hash FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (customers.length > 0) {
      const customer = customers[0];
      if (!(await verifyPassword(password, customer.password_hash))) {
        return res.status(401).json({ message: "Email atau password salah" });
      }
      if (needsPasswordUpgrade(customer.password_hash)) {
        await upgradeLegacyPassword('users', customer.id, password);
      }
      return res.json({
        message: "Login berhasil",
        user: {
          id: customer.id,
          nama: customer.nama,
          nim: customer.nim,
          coin_balance: customer.coin_balance,
          avatar_url: customer.avatar_url,
          phone: customer.phone,
          role: customer.role,
          email: customer.email
        }
      });
    }

    return res.status(401).json({ message: "Email atau password salah" });
  } catch (err: any) {
    res.status(500).json({ message: "Terjadi kesalahan server", error: err.message });
  }
});

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, phone, phone_number } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Hybrid Check: Jika menggunakan phone_number dan name, asumsikan ini Customer (Pelanggan)
    if (phone_number && name) {
      // Cek apakah nomor telepon sudah terdaftar
      const [existing]: any = await db.query("SELECT id FROM users WHERE phone = ?", [phone_number]);
      if (existing.length > 0) {
        return res.status(400).json({ message: "Nomor telepon sudah terdaftar" });
      }
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
      const initialCoin = 100; // Bonus pendaftaran 100 koin gratis
      const avatar = `https://picsum.photos/seed/${newId}/100/100`;
      const hashedPassword = password ? await hashPassword(password) : null;
      const userEmail = normalizedEmail;

      await db.query(
        "INSERT INTO users (id, nama, nim, coin_balance, avatar_url, phone, role, email, password_hash) VALUES (?, ?, ?, ?, ?, ?, 'Pelanggan', ?, ?)",
        [newId, name, phone_number, initialCoin, avatar, phone_number, userEmail, hashedPassword]
      );

      // Catat riwayat bonus pendaftaran
      const txId = `ct-${Date.now()}`;
      await db.query(
        "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, 'Bonus Pendaftaran')",
        [txId, newId, name, initialCoin]
      );

      return res.status(201).json({
        message: "Registrasi berhasil",
        user: {
          id: newId,
          nama: name,
          nim: phone_number,
          coin_balance: initialCoin,
          avatar_url: avatar,
          phone: phone_number,
          role: "Pelanggan"
        }
      });
    }

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Nama, email, dan password wajib diisi" });
    }

    // Cek apakah email sudah terdaftar di staff
    const [existingStaff]: any = await db.query("SELECT id FROM staff WHERE email = ?", [normalizedEmail]);
    if (existingStaff.length > 0) {
      return res.status(400).json({ message: "Email sudah terdaftar sebagai staf" });
    }

    // Cek apakah email sudah terdaftar di users
    const [existingUser]: any = await db.query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Email sudah terdaftar sebagai pelanggan" });
    }

    const newId = `S${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
    const hashedPassword = await hashPassword(password);
    // Registrasi publik tidak boleh memilih role istimewa (mencegah self-escalation).
    const assignedRole = 'Kasir';

    await db.query(
      "INSERT INTO staff (id, name, role, email, phone, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
      [newId, name, assignedRole, normalizedEmail, phone || null, hashedPassword]
    );

    res.status(201).json({
      message: "Registrasi berhasil",
      user: { id: newId, name, role: assignedRole, email: normalizedEmail }
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mendaftar akun", error: err.message });
  }
});

export default router;
