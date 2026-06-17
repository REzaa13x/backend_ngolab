import { Router, Request, Response } from "express";
import { db } from "../db/db.js";
import crypto from "crypto";

const router = Router();

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password, phone_number } = req.body;

    // Hybrid Check: Jika menggunakan phone_number, asumsikan ini Customer (Pelanggan)
    if (phone_number) {
      const [customers]: any = await db.query(
        "SELECT id, nama, nim, coin_balance, avatar_url, phone, role FROM users WHERE phone = ?",
        [phone_number]
      );

      if (customers.length === 0) {
        return res.status(404).json({ message: "Nomor telepon belum terdaftar sebagai pelanggan" });
      }

      const customer = customers[0];
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

    const hashedPassword = hashPassword(password);

    const [users]: any = await db.query(
      "SELECT id, name, role, email, status FROM staff WHERE email = ? AND password_hash = ?",
      [email, hashedPassword]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    const user = users[0];

    if (user.status !== "active") {
      return res.status(403).json({ message: "Akun Anda tidak aktif" });
    }

    // Untuk sementara kita tidak pakai JWT kompleks, cukup kembalikan data user
    // Di frontend kita akan menyimpannya di localStorage.
    res.json({
      message: "Login berhasil",
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email
      }
    });
  } catch (err: any) {
    res.status(500).json({ message: "Terjadi kesalahan server", error: err.message });
  }
});

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, phone, phone_number } = req.body;

    // Hybrid Check: Jika menggunakan phone_number dan name, asumsikan ini Customer (Pelanggan)
    if (phone_number && name) {
      // Cek apakah nomor telepon sudah terdaftar
      const [existing]: any = await db.query("SELECT id FROM users WHERE phone = ?", [phone_number]);
      if (existing.length > 0) {
        return res.status(400).json({ message: "Nomor telepon sudah terdaftar" });
      }

      const newId = `u-${Date.now()}`;
      const initialCoin = 100; // Bonus pendaftaran 100 koin gratis
      const avatar = `https://picsum.photos/seed/${newId}/100/100`;

      await db.query(
        "INSERT INTO users (id, nama, nim, coin_balance, avatar_url, phone, role) VALUES (?, ?, ?, ?, ?, ?, 'Pelanggan')",
        [newId, name, phone_number, initialCoin, avatar, phone_number]
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

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Nama, email, dan password wajib diisi" });
    }

    // Cek apakah email sudah terdaftar
    const [existing]: any = await db.query("SELECT id FROM staff WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    const newId = `S${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
    const hashedPassword = hashPassword(password);
    const assignedRole = role || 'Kasir';

    await db.query(
      "INSERT INTO staff (id, name, role, email, phone, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
      [newId, name, assignedRole, email, phone || null, hashedPassword]
    );

    res.status(201).json({
      message: "Registrasi berhasil",
      user: { id: newId, name, role: assignedRole, email }
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mendaftar akun", error: err.message });
  }
});

export default router;
