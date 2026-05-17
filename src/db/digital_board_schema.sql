-- ============================================================
-- PAPAN DIGITAL (Digital Signage) — MySQL Schema
-- Database: gesture_eats
-- ============================================================

-- ----------------------------------------
-- 1. digital_screens
--    Layar/display papan digital terdaftar
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `digital_screens` (
  `id`         INT             NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100)    NOT NULL,
  `location`   VARCHAR(200)    DEFAULT NULL,
  `status`     ENUM('online','offline','maintenance') NOT NULL DEFAULT 'offline',
  `last_ping`  TIMESTAMP       NULL DEFAULT NULL,
  `created_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 2. media_files
--    File video & gambar promo yang diupload
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `media_files` (
  `id`              INT             NOT NULL AUTO_INCREMENT,
  `title`           VARCHAR(200)    NOT NULL,
  `description`     TEXT            DEFAULT NULL,
  `file_name`       VARCHAR(255)    NOT NULL,
  `file_path`       VARCHAR(500)    NOT NULL,
  `file_url`        VARCHAR(500)    NOT NULL,
  `file_size`       BIGINT          NOT NULL DEFAULT 0,
  `file_type`       ENUM('image','video') NOT NULL DEFAULT 'image',
  `mime_type`       VARCHAR(100)    NOT NULL,
  `duration`        INT             NOT NULL DEFAULT 10 COMMENT 'Durasi tampil dalam detik',
  `thumbnail_url`   VARCHAR(500)    DEFAULT NULL,
  `width`           INT             DEFAULT NULL,
  `height`          INT             DEFAULT NULL,
  `uploaded_by`     VARCHAR(100)    NOT NULL DEFAULT 'Admin',
  `is_active`       TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 3. playlists
--    Kumpulan media dalam satu playlist
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `playlists` (
  `id`              INT             NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(200)    NOT NULL,
  `description`     TEXT            DEFAULT NULL,
  `is_default`      TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1 = diputar saat idle jika tidak ada jadwal',
  `loop_mode`       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '1 = putar ulang terus',
  `total_duration`  INT             NOT NULL DEFAULT 0 COMMENT 'Total durasi semua item (detik)',
  `is_active`       TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 4. playlist_items
--    Item dalam playlist beserta urutan
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `playlist_items` (
  `id`                INT             NOT NULL AUTO_INCREMENT,
  `playlist_id`       INT             NOT NULL,
  `media_id`          INT             NOT NULL,
  `order_index`       INT             NOT NULL DEFAULT 0,
  `duration_override` INT             DEFAULT NULL COMMENT 'NULL = pakai durasi dari media_files',
  `transition`        ENUM('fade','slide','zoom','none') NOT NULL DEFAULT 'fade',
  `created_at`        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`media_id`)    REFERENCES `media_files`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 5. schedules
--    Jadwal kapan playlist ditampilkan
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `schedules` (
  `id`            INT             NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(200)    NOT NULL,
  `playlist_id`   INT             NOT NULL,
  `start_time`    TIME            NOT NULL,
  `end_time`      TIME            NOT NULL,
  `days_of_week`  VARCHAR(100)    NOT NULL DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]'
                                  COMMENT 'JSON array hari berlaku',
  `start_date`    DATE            DEFAULT NULL,
  `end_date`      DATE            DEFAULT NULL,
  `priority`      INT             NOT NULL DEFAULT 1 COMMENT 'Lebih tinggi = menang konflik',
  `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 6. screen_playlists
--    Mapping layar ke playlist/jadwal
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `screen_playlists` (
  `id`          INT             NOT NULL AUTO_INCREMENT,
  `screen_id`   INT             NOT NULL,
  `playlist_id` INT             NOT NULL,
  `schedule_id` INT             DEFAULT NULL,
  `created_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`screen_id`)   REFERENCES `digital_screens`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 7. display_logs
--    Log history konten yang ditampilkan
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `display_logs` (
  `id`              BIGINT          NOT NULL AUTO_INCREMENT,
  `screen_id`       INT             NOT NULL,
  `media_id`        INT             NOT NULL,
  `playlist_id`     INT             NOT NULL,
  `displayed_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `duration_shown`  INT             NOT NULL DEFAULT 0 COMMENT 'Detik konten ditampilkan',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`screen_id`)   REFERENCES `digital_screens`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`media_id`)    REFERENCES `media_files`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- DATA AWAL (Seed Data)
-- ============================================================

-- Layar default
INSERT IGNORE INTO `digital_screens` (`id`, `name`, `location`, `status`) VALUES
(1, 'Kiosk Utama', 'Lantai 1 - Dekat Kasir', 'offline'),
(2, 'Display Tunggu', 'Area Tunggu Pelanggan', 'offline');

-- Playlist default untuk idle
INSERT IGNORE INTO `playlists` (`id`, `name`, `description`, `is_default`, `loop_mode`) VALUES
(1, 'Playlist Promosi Utama', 'Playlist default saat layar idle', 1, 1);
