import { Router, Request, Response } from "express";
import { db, addAuditLog } from "../db/db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// Multer Storage Configuration for Brand Logo Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "public", "uploads", "brand");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// GET /api/settings — Mengambil seluruh konfigurasi aplikasi
router.get("/", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query("SELECT * FROM app_settings");
    const settings: Record<string, string> = {};
    rows.forEach((r: any) => {
      settings[r.key] = r.value;
    });
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil pengaturan aplikasi", error: err.message });
  }
});

// POST /api/settings — Menyimpan/memperbarui konfigurasi aplikasi
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const actor = (req.headers["x-user-name"] as string) || "Admin";

    // Loop through each key and update
    for (const [key, value] of Object.entries(body)) {
      await db.query(
        "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
        [key, String(value), String(value)]
      );
    }

    await addAuditLog(actor, "Update Pengaturan Aplikasi", `Konfigurasi diperbarui: ${Object.keys(body).join(", ")}`);
    res.json({ message: "Pengaturan berhasil diperbarui" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menyimpan pengaturan", error: err.message });
  }
});

// POST /api/settings/upload-logo — Unggah Logo Brand
router.post("/upload-logo", upload.single("logo"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file logo yang diunggah" });
    }

    const publicUrl = `/uploads/brand/${req.file.filename}`;
    const actor = (req.headers["x-user-name"] as string) || "Admin";

    // Update di database
    await db.query(
      "INSERT INTO app_settings (`key`, `value`) VALUES ('brand_logo_url', ?) ON DUPLICATE KEY UPDATE `value` = ?",
      [publicUrl, publicUrl]
    );

    await addAuditLog(actor, "Upload Logo Brand", `Logo diperbarui: ${publicUrl}`);

    res.json({
      message: "Logo berhasil diunggah",
      brand_logo_url: publicUrl
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengunggah logo", error: err.message });
  }
});

export default router;
