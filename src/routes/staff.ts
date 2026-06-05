import { Router, Request, Response } from "express";
import { db, addAuditLog } from "../db/db.js";

const router = Router();

// GET /api/staff
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [staff]: any = await db.query(
      "SELECT id, name, role, email, phone, status, created_at FROM staff ORDER BY created_at DESC"
    );
    res.json(staff);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil data staf", error: err.message });
  }
});

// POST /api/staff (Admin adding staff manually)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, role, email, phone } = req.body;
    
    const [existing]: any = await db.query("SELECT id FROM staff WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    const newId = `S${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    // Default password 'password' for manually added staff
    const { createHash } = await import('crypto');
    const hashedPassword = createHash("sha256").update("password").digest("hex");

    await db.query(
      "INSERT INTO staff (id, name, role, email, phone, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
      [newId, name, role, email, phone, hashedPassword]
    );

    const [newStaff]: any = await db.query("SELECT id, name, role, email, phone, status FROM staff WHERE id = ?", [newId]);
    const actor = (req.headers["x-user-name"] as string) || "Admin";
    await addAuditLog(actor, "Registrasi Pegawai", `${name} (${role})`);
    res.status(201).json(newStaff[0]);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menambah staf", error: err.message });
  }
});

// PATCH /api/staff/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role, name, email, phone, status } = req.body;

    const updates = [];
    const params = [];
    
    if (role !== undefined) { updates.push("role = ?"); params.push(role); }
    if (name !== undefined) { updates.push("name = ?"); params.push(name); }
    if (email !== undefined) { updates.push("email = ?"); params.push(email); }
    if (phone !== undefined) { updates.push("phone = ?"); params.push(phone); }
    if (status !== undefined) { updates.push("status = ?"); params.push(status); }

    const [oldStaff]: any = await db.query("SELECT name, role FROM staff WHERE id = ?", [id]);

    if (updates.length > 0) {
      params.push(id);
      await db.query(`UPDATE staff SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [updatedStaff]: any = await db.query("SELECT id, name, role, email, phone, status FROM staff WHERE id = ?", [id]);
    if (!updatedStaff.length) return res.status(404).json({ message: "Staf tidak ditemukan" });
    
    const actor = (req.headers["x-user-name"] as string) || "Admin";
    const oldRole = oldStaff.length ? oldStaff[0].role : "";
    const newRole = updatedStaff[0].role;
    const roleChange = (role !== undefined && oldRole !== newRole) ? ` -> ${newRole}` : "";
    await addAuditLog(actor, "Update Data Pegawai", `${updatedStaff[0].name} (${role !== undefined ? `Role: ${oldRole}${roleChange}` : "Info Kontak"})`);

    res.json(updatedStaff[0]);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal update staf", error: err.message });
  }
});

// DELETE /api/staff/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = (req.headers["x-user-name"] as string) || "Admin";
    const [staffToDelete]: any = await db.query("SELECT name FROM staff WHERE id = ?", [id]);
    const deletedName = staffToDelete.length ? staffToDelete[0].name : id;

    await db.query("DELETE FROM staff WHERE id = ?", [id]);
    await addAuditLog(actor, "Hapus Pegawai", deletedName, "warning");
    res.json({ message: "Staf berhasil dihapus" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menghapus staf", error: err.message });
  }
});

export default router;
