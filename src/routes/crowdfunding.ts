import { Router, Request, Response } from "express";
import { db } from "../db/db.js";
import { requireAuthenticated } from "../middleware/authSession.js";
import { ensureMemberForUser, debitPoints, creditPoints } from "../lib/membershipService.js";

const router = Router();

// GET /api/patungan-rooms — Ambil daftar patungan aktif beserta kontributor
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rooms]: any = await db.query("SELECT * FROM patungan_rooms ORDER BY created_at DESC");
    const [contribs]: any = await db.query(`
      SELECT pc.room_id, pc.user_id, pc.amount, u.nama, u.avatar_url
      FROM patungan_contributions pc
      LEFT JOIN users u ON u.id = pc.user_id
      ORDER BY pc.id ASC
    `).catch(() => [[]]);

    const contribMap = new Map<string, Array<{ name: string; amount: number; img: string }>>();
    for (const c of contribs) {
      const roomId = String(c.room_id);
      if (!contribMap.has(roomId)) contribMap.set(roomId, []);
      contribMap.get(roomId)!.push({
        name: c.nama || String(c.user_id),
        amount: Number(c.amount || 0),
        img: c.avatar_url || `https://i.pravatar.cc/150?u=${encodeURIComponent(String(c.user_id))}`,
      });
    }

    const enriched = rooms.map((r: any) => {
      const members = contribMap.get(String(r.id));
      return {
        ...r,
        ...(members && members.length > 0
          ? { members, membersCount: members.length }
          : {}),
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil daftar patungan", error: err.message });
  }
});

// POST /api/patungan-rooms — Buat ruangan patungan baru di database
router.post("/", requireAuthenticated, async (req: Request, res: Response) => {
  try {
    const title = String(req.body.title || "").trim();
    const targetAmount = parseInt(String(req.body.target_amount ?? req.body.targetAmount ?? "0"), 10);
    if (!title || isNaN(targetAmount) || targetAmount <= 0) {
      return res.status(400).json({ message: "Judul patungan dan target poin wajib diisi dengan benar" });
    }
    const id = String(req.body.id || `room-${Date.now()}`).slice(0, 50);
    await db.query(
      "INSERT INTO patungan_rooms (id, title, target_amount, current_amount) VALUES (?, ?, ?, 0)",
      [id, title, targetAmount]
    );
    res.status(201).json({
      success: true,
      message: "Ruangan patungan berhasil dibuat",
      room: {
        id,
        title,
        target_amount: targetAmount,
        current_amount: 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal membuat ruangan patungan", error: err.message });
  }
});

// POST /api/patungan-rooms/transfer — Transfer poin instan P2P antar member secara atomik
router.post("/transfer", requireAuthenticated, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const currentAuth = (req as any).auth;
    const senderId = String(currentAuth?.id || "");
    const recipientQuery = String(req.body.recipient || "").trim();
    const parsedAmount = parseInt(String(req.body.amount ?? "0"), 10);

    if (!senderId || !recipientQuery || isNaN(parsedAmount) || parsedAmount <= 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Penerima dan nominal poin wajib diisi dengan benar" });
    }

    const [senderRows]: any = await connection.query("SELECT * FROM users WHERE id = ? FOR UPDATE", [senderId]);
    if (senderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Akun pengirim tidak ditemukan" });
    }
    const sender = senderRows[0];

    const [recipientRows]: any = await connection.query(
      `SELECT * FROM users
       WHERE id = ? OR nim = ? OR LOWER(email) = LOWER(?) OR phone = ? OR LOWER(nama) = LOWER(?)
       LIMIT 1 FOR UPDATE`,
      [recipientQuery, recipientQuery, recipientQuery, recipientQuery, recipientQuery]
    );
    if (recipientRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Penerima tidak ditemukan! Pastikan NIM, Email, No HP, atau Nama sudah terdaftar." });
    }
    const recipient = recipientRows[0];
    if (String(recipient.id) === String(sender.id)) {
      await connection.rollback();
      return res.status(400).json({ message: "Tidak dapat mengirim poin ke akun sendiri" });
    }

    const senderMember = await ensureMemberForUser(connection, sender.id, {
      nama: sender.nama,
      email: sender.email,
      phone: sender.phone,
      nim: sender.nim,
    });
    const recipientMember = await ensureMemberForUser(connection, recipient.id, {
      nama: recipient.nama,
      email: recipient.email,
      phone: recipient.phone,
      nim: recipient.nim,
    });

    let senderNewBalance = 0;
    try {
      const debitRes = await debitPoints({
        connection,
        memberId: senderMember.id,
        points: parsedAmount,
        transactionType: "REDEMPTION",
        referenceType: "P2P_TRANSFER_OUT",
        referenceId: String(recipient.id),
        description: `Transfer poin ke ${recipient.nama}`,
      });
      senderNewBalance = debitRes.newBalance;
    } catch (debitErr: any) {
      if (debitErr?.code === "INSUFFICIENT_POINTS") {
        await connection.rollback();
        return res.status(400).json({ message: "Saldo poin Anda tidak cukup untuk transfer ini" });
      }
      throw debitErr;
    }

    const creditRes = await creditPoints({
      connection,
      memberId: recipientMember.id,
      points: parsedAmount,
      transactionType: "GAMIFICATION",
      referenceType: "P2P_TRANSFER_IN",
      referenceId: String(sender.id),
      description: `Terima poin dari ${sender.nama}`,
    });

    const nowTs = Date.now();
    await connection.query(
      "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'redeem', ?, ?), (?, ?, ?, 'earn', ?, ?)",
      [
        `ct-out-${nowTs}`, sender.id, sender.nama, parsedAmount, `Transfer poin ke ${recipient.nama}`,
        `ct-in-${nowTs}`, recipient.id, recipient.nama, parsedAmount, `Terima poin dari ${sender.nama}`,
      ]
    );

    await connection.commit();
    res.json({
      success: true,
      message: `Transfer instan sebesar ${parsedAmount} PT ke ${recipient.nama} berhasil!`,
      amount: parsedAmount,
      recipient: { id: recipient.id, nama: recipient.nama },
      new_balance: senderNewBalance,
      recipient_balance: creditRes.newBalance,
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal memproses transfer poin", error: err.message });
  } finally {
    connection.release();
  }
});

// POST /api/patungan-rooms/:room_id/contribute — Urunan Poin ke Ruangan Patungan
router.post("/:room_id/contribute", requireAuthenticated, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { room_id } = req.params;
    const currentAuth = (req as any).auth;
    const user_id = req.body.user_id || currentAuth?.id;
    const { amount } = req.body;

    if (currentAuth?.role === 'Pelanggan' && String(currentAuth.id) !== String(user_id)) {
      await connection.rollback();
      return res.status(403).json({ message: "Anda hanya dapat berkontribusi menggunakan koin akun sendiri" });
    }

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

    // 2. Cek apakah user ada dan pastikan loyalty_accounts tersinkron
    const [users]: any = await connection.query("SELECT * FROM users WHERE id = ? FOR UPDATE", [user_id]);
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    const user = users[0];
    const member = await ensureMemberForUser(connection, user.id, {
      nama: user.nama,
      email: user.email,
      phone: user.phone,
      nim: user.nim,
    });

    let newBalance = 0;
    try {
      const debitRes = await debitPoints({
        connection,
        memberId: member.id,
        points: parsedAmount,
        transactionType: "REDEMPTION",
        referenceType: "PATUNGAN",
        referenceId: String(room_id),
        description: `Urunan Poin: ${room.title}`,
      });
      newBalance = debitRes.newBalance;
    } catch (debitErr: any) {
      if (debitErr?.code === "INSUFFICIENT_POINTS") {
        await connection.rollback();
        return res.status(400).json({ message: debitErr.message });
      }
      throw debitErr;
    }

    // 4. Tambah koin terkumpul di ruangan patungan
    await connection.query("UPDATE patungan_rooms SET current_amount = current_amount + ? WHERE id = ?", [parsedAmount, room_id]);

    // 5. Catat kontribusi patungan
    await connection.query(
      "INSERT INTO patungan_contributions (room_id, user_id, amount) VALUES (?, ?, ?)",
      [room_id, user_id, parsedAmount]
    );

    // 6. Catat transaksi koin keluar (legacy coin_transactions)
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
      new_user_balance: newBalance,
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
