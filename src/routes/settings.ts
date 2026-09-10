import { Router, Request, Response } from "express";
import { db, addAuditLog } from "../db/db.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from 'crypto';
import { detectAudioExtension } from '../lib/kdsSound.js';
import { getVerifiedActor, requireAuthenticated, requireRoles } from '../middleware/authSession.js';

const router = Router();
const requireSettingsAdmin = requireRoles('Super Admin');
const soundUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

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
router.get("/", requireAuthenticated, async (req: Request, res: Response) => {
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
router.post("/", requireSettingsAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const actor = getVerifiedActor(req);

    // Loop through each key and update
    for (const [key, value] of Object.entries(body)) {
      if (key === 'coin_reward_rate') {
        const rate = Number(value);
        if (!Number.isFinite(rate) || rate < 0 || rate > 0.1) {
          return res.status(400).json({ message: 'Rate poin harus berupa angka antara 0 dan 0.1.' });
        }
      }
      await db.query(
        "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
        [key, String(value), String(value)]
      );
    }

    await addAuditLog(actor, "Update Pengaturan Aplikasi", `Konfigurasi diperbarui: ${Object.keys(body).join(", ")}`);
    req.app.get('io')?.emit('settings_updated', body);
    res.json({ message: "Pengaturan berhasil diperbarui" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menyimpan pengaturan", error: err.message });
  }
});

// POST /api/settings/upload-logo — Unggah Logo Brand
router.post("/upload-logo", requireSettingsAdmin, upload.single("logo"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file logo yang diunggah" });
    }

    const publicUrl = `/uploads/brand/${req.file.filename}`;
    const actor = getVerifiedActor(req);

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

// POST /api/settings/upload-kds-sound — Upload audio KDS tervalidasi.
router.post('/upload-kds-sound', requireSettingsAdmin, soundUpload.single('sound'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File suara wajib dipilih.' });
    const soundType = req.body.type === 'ready' ? 'ready' : req.body.type === 'new_order' ? 'new_order' : null;
    if (!soundType) return res.status(400).json({ message: 'Jenis suara KDS tidak valid.' });
    const extension = detectAudioExtension(req.file.buffer);
    if (!extension) return res.status(400).json({ message: 'File harus berupa audio MP3, WAV, OGG, M4A, atau WebM yang valid.' });

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'sounds');
    fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `kds-${soundType}-${randomUUID()}.${extension}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    const publicUrl = `/uploads/sounds/${filename}`;
    const settingKey = soundType === 'new_order' ? 'kds_new_order_sound_url' : 'kds_ready_sound_url';

    const [oldRows]: any = await db.query('SELECT value FROM app_settings WHERE `key` = ? LIMIT 1', [settingKey]);
    await db.query(
      "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
      [settingKey, publicUrl, publicUrl]
    );
    const oldUrl = String(oldRows[0]?.value || '');
    if (oldUrl.startsWith('/uploads/sounds/')) {
      const oldPath = path.join(process.cwd(), 'public', oldUrl.replace(/^\//, ''));
      if (oldPath !== filePath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const actor = getVerifiedActor(req);
    await addAuditLog(actor, 'Upload Suara KDS', `${soundType}: ${filename}`);
    req.app.get('io')?.emit('settings_updated', { [settingKey]: publicUrl });
    res.json({ message: 'Suara KDS berhasil diunggah.', type: soundType, url: publicUrl });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengunggah suara KDS', error: error.message });
  }
});

router.delete('/kds-sound/:type', requireSettingsAdmin, async (req: Request, res: Response) => {
  try {
    const soundType = req.params.type === 'ready' ? 'ready' : req.params.type === 'new_order' ? 'new_order' : null;
    if (!soundType) return res.status(400).json({ message: 'Jenis suara KDS tidak valid.' });
    const settingKey = soundType === 'new_order' ? 'kds_new_order_sound_url' : 'kds_ready_sound_url';
    const [rows]: any = await db.query('SELECT value FROM app_settings WHERE `key` = ? LIMIT 1', [settingKey]);
    const oldUrl = String(rows[0]?.value || '');
    await db.query(
      "INSERT INTO app_settings (`key`, `value`) VALUES (?, '') ON DUPLICATE KEY UPDATE `value` = ''",
      [settingKey]
    );
    if (oldUrl.startsWith('/uploads/sounds/')) {
      const oldPath = path.join(process.cwd(), 'public', oldUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await addAuditLog(getVerifiedActor(req), 'Reset Suara KDS', soundType);
    req.app.get('io')?.emit('settings_updated', { [settingKey]: '' });
    res.json({ message: 'Suara KDS dikembalikan ke bell bawaan.' });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mereset suara KDS', error: error.message });
  }
});

export default router;
