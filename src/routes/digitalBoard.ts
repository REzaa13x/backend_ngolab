import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../db/db.js";

const router = Router();

// ─── Upload Directory ────────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "public", "uploads", "digital-board");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ─── Multer Config ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `media-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Format file tidak didukung. Gunakan JPG, PNG, WEBP, MP4, atau WEBM."));
  },
});

// ─── Helper ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ============================================================
// MEDIA FILES
// ============================================================

// GET /api/digital-board/media — List semua media (aktif & non-aktif)
router.get("/media", async (req: Request, res: Response) => {
  try {
    const { status } = req.query; // 'active' | 'inactive' | undefined (semua)
    let sql = "SELECT * FROM media_files";
    const params: any[] = [];
    if (status === "active") { sql += " WHERE is_active = 1"; }
    else if (status === "inactive") { sql += " WHERE is_active = 0"; }
    // Tanpa filter = tampilkan semua (aktif & non-aktif)
    sql += " ORDER BY is_active DESC, created_at DESC";
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil data media", error: err.message });
  }
});

// PATCH /api/digital-board/media/:id/toggle — Toggle aktif/nonaktif
router.patch("/media/:id/toggle", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query("SELECT * FROM media_files WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Media tidak ditemukan" });
    const newStatus = rows[0].is_active === 1 ? 0 : 1;
    await db.query("UPDATE media_files SET is_active = ? WHERE id = ?", [newStatus, req.params.id]);
    const [updated]: any = await db.query("SELECT * FROM media_files WHERE id = ?", [req.params.id]);
    res.json({
      message: newStatus === 1 ? "Media diaktifkan" : "Media dinonaktifkan",
      media: updated[0],
      is_active: newStatus,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal toggle status media", error: err.message });
  }
});

// GET /api/digital-board/media/:id — Detail media
router.get("/media/:id", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM media_files WHERE id = ? AND is_active = 1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Media tidak ditemukan" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil data", error: err.message });
  }
});

// POST /api/digital-board/media/upload — Upload file baru
router.post("/media/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Tidak ada file yang diunggah" });

    const { title, description, duration, uploaded_by } = req.body;
    const isVideo = req.file.mimetype.startsWith("video/");
    const fileUrl = `/uploads/digital-board/${req.file.filename}`;

    const [result]: any = await db.query(
      `INSERT INTO media_files 
        (title, description, file_name, file_path, file_url, file_size, file_type, mime_type, duration, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title || req.file.originalname,
        description || null,
        req.file.filename,
        req.file.path,
        fileUrl,
        req.file.size,
        isVideo ? "video" : "image",
        req.file.mimetype,
        parseInt(duration) || (isVideo ? 30 : 10),
        uploaded_by || "Admin",
      ]
    );

    const [rows]: any = await db.query("SELECT * FROM media_files WHERE id = ?", [result.insertId]);

    res.status(201).json({
      message: "File berhasil diupload",
      media: { ...rows[0], file_size_formatted: formatBytes(rows[0].file_size) },
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal upload file", error: err.message });
  }
});

// PUT /api/digital-board/media/:id — Update info media
router.put("/media/:id", async (req: Request, res: Response) => {
  try {
    const { title, description, duration } = req.body;
    await db.query(
      "UPDATE media_files SET title = ?, description = ?, duration = ? WHERE id = ?",
      [title, description, duration, req.params.id]
    );
    const [rows]: any = await db.query("SELECT * FROM media_files WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Media tidak ditemukan" });
    res.json({ message: "Media diperbarui", media: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal update media", error: err.message });
  }
});

// DELETE /api/digital-board/media/:id — Hapus media (soft delete)
router.delete("/media/:id", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query("SELECT * FROM media_files WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Media tidak ditemukan" });

    // Soft delete
    await db.query("UPDATE media_files SET is_active = 0 WHERE id = ?", [req.params.id]);
    
    // Hapus file fisik dari disk
    if (fs.existsSync(rows[0].file_path)) {
      fs.unlinkSync(rows[0].file_path);
    }

    res.json({ message: "Media berhasil dihapus" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menghapus media", error: err.message });
  }
});

// ============================================================
// PLAYLISTS
// ============================================================

// GET /api/digital-board/playlists — List semua playlist
router.get("/playlists", async (_req: Request, res: Response) => {
  try {
    const [playlists]: any = await db.query(
      "SELECT * FROM playlists WHERE is_active = 1 ORDER BY is_default DESC, created_at DESC"
    );
    // Tambahkan jumlah item untuk tiap playlist
    for (const pl of playlists) {
      const [count]: any = await db.query(
        "SELECT COUNT(*) as total FROM playlist_items WHERE playlist_id = ?",
        [pl.id]
      );
      pl.item_count = count[0].total;
    }
    res.json(playlists);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil playlist", error: err.message });
  }
});

// POST /api/digital-board/playlists — Buat playlist baru
router.post("/playlists", async (req: Request, res: Response) => {
  try {
    const { name, description, is_default, loop_mode } = req.body;
    if (!name) return res.status(400).json({ message: "Nama playlist wajib diisi" });

    // Jika is_default = true, reset playlist lain
    if (is_default) {
      await db.query("UPDATE playlists SET is_default = 0");
    }

    const [result]: any = await db.query(
      "INSERT INTO playlists (name, description, is_default, loop_mode) VALUES (?, ?, ?, ?)",
      [name, description || null, is_default ? 1 : 0, loop_mode !== false ? 1 : 0]
    );
    const [rows]: any = await db.query("SELECT * FROM playlists WHERE id = ?", [result.insertId]);
    res.status(201).json({ message: "Playlist dibuat", playlist: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal membuat playlist", error: err.message });
  }
});

// GET /api/digital-board/playlists/:id — Detail playlist + items
router.get("/playlists/:id", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM playlists WHERE id = ? AND is_active = 1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Playlist tidak ditemukan" });

    const [items]: any = await db.query(
      `SELECT pi.*, m.title, m.file_url, m.file_type, m.mime_type, m.duration as media_duration,
              m.thumbnail_url, m.file_size
       FROM playlist_items pi
       JOIN media_files m ON pi.media_id = m.id
       WHERE pi.playlist_id = ?
       ORDER BY pi.order_index ASC`,
      [req.params.id]
    );

    res.json({ ...rows[0], items });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil detail playlist", error: err.message });
  }
});

// PUT /api/digital-board/playlists/:id — Update playlist
router.put("/playlists/:id", async (req: Request, res: Response) => {
  try {
    const { name, description, is_default, loop_mode } = req.body;
    if (is_default) {
      await db.query("UPDATE playlists SET is_default = 0 WHERE id != ?", [req.params.id]);
    }
    await db.query(
      "UPDATE playlists SET name = ?, description = ?, is_default = ?, loop_mode = ? WHERE id = ?",
      [name, description, is_default ? 1 : 0, loop_mode ? 1 : 0, req.params.id]
    );
    const [rows]: any = await db.query("SELECT * FROM playlists WHERE id = ?", [req.params.id]);
    res.json({ message: "Playlist diperbarui", playlist: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal update playlist", error: err.message });
  }
});

// DELETE /api/digital-board/playlists/:id — Hapus playlist
router.delete("/playlists/:id", async (req: Request, res: Response) => {
  try {
    await db.query("UPDATE playlists SET is_active = 0 WHERE id = ?", [req.params.id]);
    res.json({ message: "Playlist dihapus" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menghapus playlist", error: err.message });
  }
});

// POST /api/digital-board/playlists/:id/items — Tambah media ke playlist
router.post("/playlists/:id/items", async (req: Request, res: Response) => {
  try {
    const { media_id, duration_override, transition } = req.body;
    if (!media_id) return res.status(400).json({ message: "media_id wajib diisi" });

    // Dapatkan order_index berikutnya
    const [maxOrder]: any = await db.query(
      "SELECT COALESCE(MAX(order_index), -1) as max_order FROM playlist_items WHERE playlist_id = ?",
      [req.params.id]
    );
    const nextOrder = maxOrder[0].max_order + 1;

    const [result]: any = await db.query(
      "INSERT INTO playlist_items (playlist_id, media_id, order_index, duration_override, transition) VALUES (?, ?, ?, ?, ?)",
      [req.params.id, media_id, nextOrder, duration_override || null, transition || "fade"]
    );

    // Update total_duration di playlist
    await updatePlaylistDuration(parseInt(req.params.id));

    const [rows]: any = await db.query(
      `SELECT pi.*, m.title, m.file_url, m.file_type FROM playlist_items pi
       JOIN media_files m ON pi.media_id = m.id WHERE pi.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ message: "Item ditambahkan ke playlist", item: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menambah item", error: err.message });
  }
});

// PUT /api/digital-board/playlists/:id/items/reorder — Atur ulang urutan
router.put("/playlists/:id/items/reorder", async (req: Request, res: Response) => {
  try {
    const { order } = req.body; // Array of { id, order_index }
    if (!Array.isArray(order)) return res.status(400).json({ message: "Format order tidak valid" });

    for (const item of order) {
      await db.query("UPDATE playlist_items SET order_index = ? WHERE id = ? AND playlist_id = ?", [
        item.order_index,
        item.id,
        req.params.id,
      ]);
    }
    res.json({ message: "Urutan playlist diperbarui" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengatur urutan", error: err.message });
  }
});

// DELETE /api/digital-board/playlists/:id/items/:itemId — Hapus item dari playlist
router.delete("/playlists/:id/items/:itemId", async (req: Request, res: Response) => {
  try {
    await db.query("DELETE FROM playlist_items WHERE id = ? AND playlist_id = ?", [
      req.params.itemId,
      req.params.id,
    ]);
    await updatePlaylistDuration(parseInt(req.params.id));
    res.json({ message: "Item dihapus dari playlist" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menghapus item", error: err.message });
  }
});

async function updatePlaylistDuration(playlistId: number) {
  const [result]: any = await db.query(
    `SELECT SUM(COALESCE(pi.duration_override, m.duration)) as total
     FROM playlist_items pi
     JOIN media_files m ON pi.media_id = m.id
     WHERE pi.playlist_id = ?`,
    [playlistId]
  );
  const total = result[0].total || 0;
  await db.query("UPDATE playlists SET total_duration = ? WHERE id = ?", [total, playlistId]);
}

// ============================================================
// SCHEDULES
// ============================================================

// GET /api/digital-board/schedules — List semua jadwal
router.get("/schedules", async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      `SELECT s.*, p.name as playlist_name 
       FROM schedules s
       JOIN playlists p ON s.playlist_id = p.id
       WHERE s.is_active = 1
       ORDER BY s.priority DESC, s.start_time ASC`
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil jadwal", error: err.message });
  }
});

// POST /api/digital-board/schedules — Buat jadwal baru
router.post("/schedules", async (req: Request, res: Response) => {
  try {
    const { name, playlist_id, start_time, end_time, days_of_week, start_date, end_date, priority } = req.body;
    if (!name || !playlist_id || !start_time || !end_time) {
      return res.status(400).json({ message: "name, playlist_id, start_time, dan end_time wajib diisi" });
    }

    const [result]: any = await db.query(
      `INSERT INTO schedules (name, playlist_id, start_time, end_time, days_of_week, start_date, end_date, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, playlist_id, start_time, end_time,
        JSON.stringify(days_of_week || ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]),
        start_date || null, end_date || null, priority || 1,
      ]
    );
    const [rows]: any = await db.query("SELECT * FROM schedules WHERE id = ?", [result.insertId]);
    res.status(201).json({ message: "Jadwal dibuat", schedule: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal membuat jadwal", error: err.message });
  }
});

// PUT /api/digital-board/schedules/:id — Update jadwal
router.put("/schedules/:id", async (req: Request, res: Response) => {
  try {
    const { name, playlist_id, start_time, end_time, days_of_week, start_date, end_date, priority, is_active } = req.body;
    await db.query(
      `UPDATE schedules SET name=?, playlist_id=?, start_time=?, end_time=?, days_of_week=?,
       start_date=?, end_date=?, priority=?, is_active=? WHERE id=?`,
      [
        name, playlist_id, start_time, end_time,
        JSON.stringify(days_of_week || ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]),
        start_date || null, end_date || null, priority || 1,
        is_active !== false ? 1 : 0, req.params.id,
      ]
    );
    const [rows]: any = await db.query("SELECT * FROM schedules WHERE id = ?", [req.params.id]);
    res.json({ message: "Jadwal diperbarui", schedule: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal update jadwal", error: err.message });
  }
});

// DELETE /api/digital-board/schedules/:id — Hapus jadwal
router.delete("/schedules/:id", async (req: Request, res: Response) => {
  try {
    await db.query("UPDATE schedules SET is_active = 0 WHERE id = ?", [req.params.id]);
    res.json({ message: "Jadwal dihapus" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menghapus jadwal", error: err.message });
  }
});

// ============================================================
// SCREENS (Manajemen Layar)
// ============================================================

// GET /api/digital-board/screens — List semua layar
router.get("/screens", async (_req: Request, res: Response) => {
  try {
    const [rows] = await db.query("SELECT * FROM digital_screens ORDER BY created_at ASC");
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil data layar", error: err.message });
  }
});

// POST /api/digital-board/screens — Daftarkan layar baru
router.post("/screens", async (req: Request, res: Response) => {
  try {
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ message: "Nama layar wajib diisi" });

    const [result]: any = await db.query(
      "INSERT INTO digital_screens (name, location) VALUES (?, ?)",
      [name, location || null]
    );
    const [rows]: any = await db.query("SELECT * FROM digital_screens WHERE id = ?", [result.insertId]);
    res.status(201).json({ message: "Layar berhasil didaftarkan", screen: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mendaftarkan layar", error: err.message });
  }
});

// PATCH /api/digital-board/screens/:id/ping — Update status online layar
router.patch("/screens/:id/ping", async (req: Request, res: Response) => {
  try {
    await db.query(
      "UPDATE digital_screens SET status = 'online', last_ping = CURRENT_TIMESTAMP WHERE id = ?",
      [req.params.id]
    );
    res.json({ message: "Ping diterima", screen_id: req.params.id, status: "online" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal update status layar", error: err.message });
  }
});

// ============================================================
// PLAYBACK — Endpoint untuk Project Lain
// ============================================================

/**
 * GET /api/digital-board/now-playing/:screenId
 * Menentukan konten apa yang harus diputar sekarang berdasarkan:
 * 1. Jadwal aktif (schedule) dengan prioritas tertinggi
 * 2. Fallback ke playlist default jika tidak ada jadwal yang cocok
 */
router.get("/now-playing/:screenId", async (req: Request, res: Response) => {
  try {
    const screenId = req.params.screenId;

    // Update last_ping layar
    await db.query(
      "UPDATE digital_screens SET status = 'online', last_ping = CURRENT_TIMESTAMP WHERE id = ?",
      [screenId]
    );

    // Cari jadwal yang berlaku sekarang
    const now = new Date();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDay = dayNames[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
    const currentDate = now.toISOString().split("T")[0];

    const [schedules]: any = await db.query(
      `SELECT s.*, p.name as playlist_name, p.loop_mode
       FROM schedules s
       JOIN playlists p ON s.playlist_id = p.id
       WHERE s.is_active = 1
         AND p.is_active = 1
         AND ? BETWEEN s.start_time AND s.end_time
         AND (s.start_date IS NULL OR s.start_date <= ?)
         AND (s.end_date IS NULL OR s.end_date >= ?)
         AND s.days_of_week LIKE ?
       ORDER BY s.priority DESC
       LIMIT 1`,
      [currentTime, currentDate, currentDate, `%"${currentDay}"%`]
    );

    let playlistId: number | null = null;

    if (schedules.length > 0) {
      playlistId = schedules[0].playlist_id;
    } else {
      // Fallback ke playlist default
      const [defaults]: any = await db.query(
        "SELECT id FROM playlists WHERE is_default = 1 AND is_active = 1 LIMIT 1"
      );
      if (defaults.length > 0) playlistId = defaults[0].id;
    }

    if (!playlistId) {
      return res.json({ message: "Tidak ada konten untuk diputar", items: [] });
    }

    // Ambil semua item dalam playlist
    const [items]: any = await db.query(
      `SELECT pi.id as item_id, pi.order_index, pi.transition,
              COALESCE(pi.duration_override, m.duration) as duration,
              m.id as media_id, m.title, m.file_url, m.file_type, m.mime_type, m.thumbnail_url
       FROM playlist_items pi
       JOIN media_files m ON pi.media_id = m.id
       WHERE pi.playlist_id = ? AND m.is_active = 1
       ORDER BY pi.order_index ASC`,
      [playlistId]
    );

    const [playlistInfo]: any = await db.query("SELECT * FROM playlists WHERE id = ?", [playlistId]);

    res.json({
      playlist: playlistInfo[0] || null,
      schedule: schedules[0] || null,
      items,
      server_time: now.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil konten now-playing", error: err.message });
  }
});

// ============================================================
// DISPLAY LOGS — Analitik
// ============================================================

// POST /api/digital-board/log — Kirim log tampilan dari layar
router.post("/log", async (req: Request, res: Response) => {
  try {
    const { screen_id, media_id, playlist_id, duration_shown } = req.body;
    if (!screen_id || !media_id || !playlist_id) {
      return res.status(400).json({ message: "screen_id, media_id, playlist_id wajib diisi" });
    }
    await db.query(
      "INSERT INTO display_logs (screen_id, media_id, playlist_id, duration_shown) VALUES (?, ?, ?, ?)",
      [screen_id, media_id, playlist_id, duration_shown || 0]
    );
    res.status(201).json({ message: "Log berhasil dicatat" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mencatat log", error: err.message });
  }
});

// GET /api/digital-board/log/stats — Statistik tampilan
router.get("/log/stats", async (_req: Request, res: Response) => {
  try {
    const [topMedia]: any = await db.query(
      `SELECT m.title, m.file_type, COUNT(dl.id) as play_count, SUM(dl.duration_shown) as total_seconds
       FROM display_logs dl
       JOIN media_files m ON dl.media_id = m.id
       GROUP BY dl.media_id
       ORDER BY play_count DESC
       LIMIT 10`
    );

    const [screenStats]: any = await db.query(
      `SELECT ds.name, ds.location, ds.status, COUNT(dl.id) as total_plays
       FROM digital_screens ds
       LEFT JOIN display_logs dl ON ds.id = dl.screen_id
       GROUP BY ds.id
       ORDER BY total_plays DESC`
    );

    const [totalLogs]: any = await db.query("SELECT COUNT(*) as total FROM display_logs");

    res.json({
      total_plays: totalLogs[0].total,
      top_media: topMedia,
      screen_stats: screenStats,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil statistik", error: err.message });
  }
});

export default router;
