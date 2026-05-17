# 📺 Papan Digital — Database & API Design

## Deskripsi

Fitur **Papan Digital** adalah sistem *digital signage* yang menampilkan konten promosi (video/gambar) saat layar kiosk sedang idle. Sistem ini akan dikelola oleh admin (upload, atur jadwal, playlist) dan dapat diakses oleh layar papan digital dari project lain via REST API.

---

## Arsitektur Fitur

```
Admin Dashboard ──[upload/manage]──► MySQL DB
                                        │
Digital Board Client ◄──[REST API]──────┘
(Project Lain)              ↑
                     Scheduler & Playlist Engine
```

---

## 🗃️ Database MySQL — Daftar Tabel

### 1. `digital_screens`
Menyimpan data layar/display papan digital yang terdaftar.

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | INT PK AUTO_INCREMENT | ID layar |
| `name` | VARCHAR(100) | Nama layar (mis: "Kiosk Lantai 1") |
| `location` | VARCHAR(200) | Lokasi fisik layar |
| `status` | ENUM('online','offline','maintenance') | Status layar |
| `last_ping` | TIMESTAMP | Terakhir kali layar aktif |
| `created_at` | TIMESTAMP | Waktu registrasi |
| `updated_at` | TIMESTAMP | Waktu update |

---

### 2. `media_files`
Menyimpan file media (video & gambar) yang diupload untuk promo.

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | INT PK AUTO_INCREMENT | ID media |
| `title` | VARCHAR(200) | Judul/nama konten |
| `description` | TEXT | Deskripsi opsional |
| `file_name` | VARCHAR(255) | Nama file tersimpan |
| `file_path` | VARCHAR(500) | Path file di server |
| `file_url` | VARCHAR(500) | URL publik akses file |
| `file_size` | BIGINT | Ukuran file (bytes) |
| `file_type` | ENUM('image','video') | Jenis file |
| `mime_type` | VARCHAR(100) | MIME type (video/mp4, image/webp) |
| `duration` | INT | Durasi tampil dalam detik |
| `thumbnail_url` | VARCHAR(500) | URL thumbnail (untuk video) |
| `width` | INT | Resolusi lebar |
| `height` | INT | Resolusi tinggi |
| `uploaded_by` | VARCHAR(100) | Nama uploader |
| `is_active` | TINYINT(1) DEFAULT 1 | Status aktif |
| `created_at` | TIMESTAMP | Waktu upload |
| `updated_at` | TIMESTAMP | Waktu update |

---

### 3. `playlists`
Kumpulan media yang diputar berurutan sebagai playlist.

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | INT PK AUTO_INCREMENT | ID playlist |
| `name` | VARCHAR(200) | Nama playlist |
| `description` | TEXT | Deskripsi |
| `is_default` | TINYINT(1) DEFAULT 0 | Playlist default saat idle |
| `loop_mode` | TINYINT(1) DEFAULT 1 | Putar berulang |
| `total_duration` | INT | Total durasi semua item (detik) |
| `is_active` | TINYINT(1) DEFAULT 1 | Status aktif |
| `created_at` | TIMESTAMP | Waktu dibuat |
| `updated_at` | TIMESTAMP | Waktu update |

---

### 4. `playlist_items`
Detail item dalam playlist (media + urutan).

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | INT PK AUTO_INCREMENT | ID item |
| `playlist_id` | INT FK → playlists.id | Playlist induk |
| `media_id` | INT FK → media_files.id | Media yang diputar |
| `order_index` | INT | Urutan pemutaran |
| `duration_override` | INT NULL | Override durasi (null = pakai media.duration) |
| `transition` | ENUM('fade','slide','zoom','none') DEFAULT 'fade' | Efek transisi |
| `created_at` | TIMESTAMP | Waktu ditambahkan |

---

### 5. `schedules`
Jadwal kapan suatu playlist akan ditampilkan.

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | INT PK AUTO_INCREMENT | ID jadwal |
| `name` | VARCHAR(200) | Nama jadwal |
| `playlist_id` | INT FK → playlists.id | Playlist yang dijadwalkan |
| `start_time` | TIME | Jam mulai |
| `end_time` | TIME | Jam selesai |
| `days_of_week` | VARCHAR(50) | Hari berlaku (JSON: ["Mon","Tue"]) |
| `start_date` | DATE NULL | Tanggal mulai berlaku |
| `end_date` | DATE NULL | Tanggal akhir berlaku |
| `priority` | INT DEFAULT 1 | Prioritas (lebih tinggi = menang) |
| `is_active` | TINYINT(1) DEFAULT 1 | Status aktif |
| `created_at` | TIMESTAMP | Waktu dibuat |
| `updated_at` | TIMESTAMP | Waktu update |

---

### 6. `screen_playlists`
Mapping layar ke playlist (layar mana putar playlist apa).

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | INT PK AUTO_INCREMENT | ID |
| `screen_id` | INT FK → digital_screens.id | Layar |
| `playlist_id` | INT FK → playlists.id | Playlist |
| `schedule_id` | INT FK → schedules.id NULL | Jadwal terkait |
| `created_at` | TIMESTAMP | Waktu assign |

---

### 7. `display_logs`
Log history konten yang pernah ditampilkan (analytics).

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | BIGINT PK AUTO_INCREMENT | ID log |
| `screen_id` | INT FK → digital_screens.id | Layar yang menampilkan |
| `media_id` | INT FK → media_files.id | Media yang ditampilkan |
| `playlist_id` | INT FK → playlists.id | Dari playlist mana |
| `displayed_at` | TIMESTAMP | Waktu tampil |
| `duration_shown` | INT | Berapa detik ditampilkan |

---

## 📡 REST API Endpoints

### Media Files
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/digital-board/media` | List semua media |
| `POST` | `/api/digital-board/media/upload` | Upload file baru (video/gambar) |
| `GET` | `/api/digital-board/media/:id` | Detail media |
| `PUT` | `/api/digital-board/media/:id` | Update info media |
| `DELETE` | `/api/digital-board/media/:id` | Hapus media |

### Playlists
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/digital-board/playlists` | List semua playlist |
| `POST` | `/api/digital-board/playlists` | Buat playlist baru |
| `GET` | `/api/digital-board/playlists/:id` | Detail playlist + items |
| `PUT` | `/api/digital-board/playlists/:id` | Update playlist |
| `DELETE` | `/api/digital-board/playlists/:id` | Hapus playlist |
| `POST` | `/api/digital-board/playlists/:id/items` | Tambah item ke playlist |
| `PUT` | `/api/digital-board/playlists/:id/items/reorder` | Atur ulang urutan |
| `DELETE` | `/api/digital-board/playlists/:id/items/:itemId` | Hapus item dari playlist |

### Schedules
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/digital-board/schedules` | List semua jadwal |
| `POST` | `/api/digital-board/schedules` | Buat jadwal baru |
| `PUT` | `/api/digital-board/schedules/:id` | Update jadwal |
| `DELETE` | `/api/digital-board/schedules/:id` | Hapus jadwal |

### Screens
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/digital-board/screens` | List semua layar |
| `POST` | `/api/digital-board/screens` | Daftarkan layar baru |
| `PATCH` | `/api/digital-board/screens/:id/ping` | Update status online layar |

### Playback (untuk project lain)
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/digital-board/now-playing/:screenId` | Ambil konten yang harus dimainkan sekarang |
| `POST` | `/api/digital-board/log` | Kirim log tampilan dari layar |

---

## 📁 File yang Akan Dibuat/Diubah

### [NEW] `src/db/digital_board_schema.sql`
Script SQL lengkap untuk membuat semua tabel.

### [NEW] `src/db/db.ts`
Koneksi MySQL pool menggunakan `mysql2`.

### [NEW] `src/routes/digitalBoard.ts`
Semua route Express untuk Papan Digital.

### [MODIFY] `server.ts`
Import dan mount route `digitalBoard.ts`.

### [MODIFY] `package.json`
Tambah dependency `mysql2`.

---

## Verification Plan

- Jalankan `src/db/digital_board_schema.sql` di MySQL
- Test setiap endpoint menggunakan Postman/Thunder Client
- Pastikan upload video berfungsi & tersimpan di `public/uploads/digital-board/`
- Test endpoint `GET /api/digital-board/now-playing/:screenId` dari project lain

---

## ❓ Open Questions

> [!IMPORTANT]
> Apakah ada nama database MySQL yang sudah ada dan ingin digunakan? Atau buat database baru bernama `gesture_eats_db`?

> [!IMPORTANT]
> Apakah credential MySQL sudah ada di `.env`? Jika belum, saya akan tambahkan template di `.env.example`.

> [!NOTE]
> Untuk upload **video**, apakah ada batasan ukuran file? Default akan di-set ke **100MB**. Video disimpan langsung di server (`public/uploads/digital-board/`), bukan di cloud storage.

