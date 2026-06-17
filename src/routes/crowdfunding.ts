import { Router, Request, Response } from "express";
import { db } from "../db/db.js";

const router = Router();

// GET /api/patungan-rooms — Ambil daftar patungan aktif
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rooms]: any = await db.query("SELECT * FROM patungan_rooms ORDER BY created_at DESC");
    res.json(rooms);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil daftar patungan", error: err.message });
  }
});

// POST /api/patungan-rooms/:room_id/contribute — Urunan Poin ke Ruangan Patungan
router.post("/:room_id/contribute", async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { room_id } = req.params;
    const { user_id, amount } = req.body;

    const parsedAmount = parseInt(amount);
    if (!user_id || isNaN(parsedAmount) || parsedAmount <= 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Data input kontribusi tidak valid" });
    }

    // 1. Cek apakah ruangan patungan ada
    const [rooms]: any = await connection.query("SELECT * FROM patungan_rooms WHERE id = ? FOR UPDATE", [room_id]);
    if (rooms.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Ruangan patungan tidak ditemukan" });
    }
    const room = rooms[0];

    // 2. Cek apakah user ada dan memiliki koin yang cukup
    const [users]: any = await connection.query("SELECT * FROM users WHERE id = ? FOR UPDATE", [user_id]);
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    const user = users[0];

    if (user.coin_balance < parsedAmount) {
      await connection.rollback();
      return res.status(400).json({ message: `Koin tidak cukup. Saldo Anda: ${user.coin_balance} koin` });
    }

    // 3. Potong koin user
    await connection.query("UPDATE users SET coin_balance = coin_balance - ? WHERE id = ?", [parsedAmount, user_id]);

    // 4. Tambah koin terkumpul di ruangan patungan
    await connection.query("UPDATE patungan_rooms SET current_amount = current_amount + ? WHERE id = ?", [parsedAmount, room_id]);

    // 5. Catat kontribusi patungan
    await connection.query(
      "INSERT INTO patungan_contributions (room_id, user_id, amount) VALUES (?, ?, ?)",
      [room_id, user_id, parsedAmount]
    );

    // 6. Catat transaksi koin keluar (redeem)
    const txId = `ct-${Date.now()}`;
    await connection.query(
      "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'redeem', ?, ?)",
      [txId, user_id, user.nama, parsedAmount, `Urunan Poin: ${room.title}`]
    );

    await connection.commit();

    const io = req.app.get('io');
    if (io) {
      io.emit("stats_updated");
    }

    res.json({
      message: "Kontribusi berhasil! Terima kasih atas partisipasi Anda.",
      contributed_amount: parsedAmount,
      new_user_balance: user.coin_balance - parsedAmount,
      room_current_amount: room.current_amount + parsedAmount
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal memproses kontribusi patungan", error: err.message });
  } finally {
    connection.release();
  }
});

export default router;
