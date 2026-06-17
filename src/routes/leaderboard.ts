import { Router, Request, Response } from "express";
import { db } from "../db/db.js";

const router = Router();

// GET /api/leaderboard — Ambil peringkat koin mahasiswa
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      "SELECT nama as name, coin_balance as points, avatar_url as avatar FROM users ORDER BY coin_balance DESC LIMIT 50"
    );

    const leaderboard = rows.map((row: any, index: number) => ({
      rank: index + 1,
      name: row.name,
      points: row.points,
      avatar: row.avatar || `https://picsum.photos/seed/${row.name.replace(/\s+/g, '')}/100/100`
    }));

    res.json(leaderboard);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil leaderboard", error: err.message });
  }
});

export default router;
