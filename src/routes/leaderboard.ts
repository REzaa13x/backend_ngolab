import { Router, Request, Response } from "express";
import { db } from "../db/db.js";

const router = Router();

// GET /api/leaderboard — Ambil peringkat koin & poin loyalitas mahasiswa secara terpadu
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      `SELECT
         u.id,
         u.nama AS name,
         GREATEST(COALESCE(u.coin_balance, 0), COALESCE(la.current_points, 0)) AS points,
         COALESCE(la.lifetime_earned_points, u.coin_balance, 0) AS lifetime_points,
         COALESCE(mt.name, 'Classmate') AS tier,
         u.avatar_url AS avatar
       FROM users u
       LEFT JOIN members m ON m.user_id = u.id
       LEFT JOIN loyalty_accounts la ON la.member_id = m.id
       LEFT JOIN member_tiers mt ON mt.id = m.current_tier_id
       ORDER BY points DESC, lifetime_points DESC, u.nama ASC
       LIMIT 50`
    );

    const leaderboard = rows.map((row: any, index: number) => ({
      id: row.id,
      rank: index + 1,
      name: row.name,
      points: Number(row.points || 0),
      lifetimePoints: Number(row.lifetime_points || 0),
      tier: row.tier || "Classmate",
      avatar: row.avatar || `https://picsum.photos/seed/${String(row.name || "user").replace(/\s+/g, "")}/100/100`,
    }));

    res.json(leaderboard);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil leaderboard", error: err.message });
  }
});

export default router;
