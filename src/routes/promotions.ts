import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { db } from '../db/db.js';
import { detectMediaFile } from '../lib/mediaFile.js';

const router = Router();
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'promotions');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, os.tmpdir()),
    filename: (_req, _file, callback) => callback(null, `tangolab-${crypto.randomBytes(12).toString('hex')}.upload`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

function toLegacyPromotion(row: any) {
  return {
    id: String(row.id),
    title: row.title,
    url: row.file_url,
    type: row.file_type,
    duration: Number(row.duration),
    order_index: Number(row.id),
    created_at: row.created_at,
  };
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query('SELECT * FROM media_files WHERE is_active = 1 ORDER BY created_at DESC');
    res.json(rows.map(toLegacyPromotion));
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mengambil promosi', error: err.message });
  }
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  let finalPath: string | null = null;
  try {
    if (!req.file) return res.status(400).json({ message: 'Tidak ada file yang diunggah' });

    let descriptor: number | null = null;
    const header = Buffer.alloc(16);
    let bytesRead = 0;
    try {
      descriptor = fs.openSync(req.file.path, 'r');
      bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
    } finally {
      if (descriptor !== null) fs.closeSync(descriptor);
    }
    const detected = detectMediaFile(header.subarray(0, bytesRead));
    if (!detected) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Isi file bukan format media yang didukung' });
    }

    const finalName = `promo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${detected.extension}`;
    finalPath = path.join(uploadDir, finalName);
    fs.copyFileSync(req.file.path, finalPath, fs.constants.COPYFILE_EXCL);
    fs.unlinkSync(req.file.path);
    const fileUrl = `/uploads/promotions/${finalName}`;
    const [result]: any = await db.query(
      `INSERT INTO media_files
       (title, file_name, file_path, file_url, file_size, file_type, mime_type, duration, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Legacy Promotions API')`,
      [req.body.title || req.file.originalname, finalName, finalPath, fileUrl, req.file.size, detected.fileType, detected.mimeType, Number(req.body.duration) || (detected.fileType === 'video' ? 30 : 10)]
    );
    const [rows]: any = await db.query('SELECT * FROM media_files WHERE id = ?', [result.insertId]);
    res.status(201).json(toLegacyPromotion(rows[0]));
  } catch (err: any) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (finalPath && fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    res.status(500).json({ message: 'Gagal mengunggah promosi', error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result]: any = await db.query('UPDATE media_files SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Promosi tidak ditemukan' });
    res.json({ message: 'Dihapus' });
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal menghapus promosi', error: err.message });
  }
});

export default router;
