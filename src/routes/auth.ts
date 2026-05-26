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
    const { email, password } = req.body;

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
    const { name, email, password, role, phone } = req.body;

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
