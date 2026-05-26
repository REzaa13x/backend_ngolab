import { Router, Request, Response } from "express";
import { db } from "../db/db.js";

const router = Router();

// GET /api/users
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [users]: any = await db.query("SELECT * FROM users ORDER BY created_at DESC");
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

    // 3. Map recommendations
    const recommendations = promos.map((p: any) => ({
      ...p,
      can_redeem: user.coin_balance >= p.coin_cost,
      coins_needed: Math.max(0, p.coin_cost - user.coin_balance),
      progress: Math.min(100, Math.round((user.coin_balance / p.coin_cost) * 100)),
    })).sort((a: any, b: any) => (a.can_redeem === b.can_redeem ? a.coin_cost - b.coin_cost : a.can_redeem ? -1 : 1));

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

export default router;
