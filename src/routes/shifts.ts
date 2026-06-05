import { Router, Request, Response } from "express";
import { db, addAuditLog } from "../db/db.js";

const router = Router();

// GET /api/shifts
router.get("/", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      `SELECT s.id, s.staff_id, st.name, st.role, s.shift_type, s.time, DATE_FORMAT(s.date, '%Y-%m-%d') as date
       FROM shifts s
       JOIN staff st ON s.staff_id = st.id
       ORDER BY s.id DESC`
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil data shift", error: err.message });
  }
});

// POST /api/shifts
router.post("/", async (req: Request, res: Response) => {
  try {
    const { staff_id, shift_type, time } = req.body;
    const actor = (req.headers["x-user-name"] as string) || "Sistem";

    if (!staff_id || !shift_type || !time) {
      return res.status(400).json({ message: "Data shift tidak lengkap" });
    }

    // Cek apakah staf ada
    const [staff]: any = await db.query("SELECT name, role FROM staff WHERE id = ?", [staff_id]);
    if (staff.length === 0) {
      return res.status(404).json({ message: "Staf tidak ditemukan" });
    }

    const dateStr = new Date().toISOString().split("T")[0];

    // Masukkan shift baru
    const [result]: any = await db.query(
      "INSERT INTO shifts (staff_id, shift_type, time, date) VALUES (?, ?, ?, ?)",
      [staff_id, shift_type, time, dateStr]
    );

    // Ambil data shift yang baru dimasukkan
    const newShift = {
      id: result.insertId,
      staff_id,
      name: staff[0].name,
      role: staff[0].role,
      shift_type,
      time,
      date: dateStr
    };

    // Log ke audit
    await addAuditLog(actor, "Penetapan Shift", `${staff[0].name} (${shift_type})`);

    res.status(201).json(newShift);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menetapkan shift", error: err.message });
  }
});

export default router;
