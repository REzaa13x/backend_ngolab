import { Router, Request, Response } from "express";
import { db } from "../db/db.js";

const router = Router();

// GET /api/audit-logs
router.get("/", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      "SELECT id, user, action, target, timestamp, status, ip FROM audit_logs ORDER BY timestamp DESC LIMIT 50"
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil data log audit", error: err.message });
  }
});

export default router;
