-- ============================================================
-- STAFF & AUTHENTICATION — MySQL Schema
-- Database: gesture_eats
-- ============================================================

CREATE TABLE IF NOT EXISTS `staff` (
  `id`             VARCHAR(50)   NOT NULL,
  `name`           VARCHAR(100)  NOT NULL,
  `role`           ENUM('Admin', 'Kasir', 'Koki', 'Support') NOT NULL DEFAULT 'Kasir',
  `email`          VARCHAR(150)  NOT NULL UNIQUE,
  `phone`          VARCHAR(50)   DEFAULT NULL,
  `password_hash`  VARCHAR(255)  NOT NULL,
  `status`         ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Data (Password default untuk testing adalah 'password' yang di-hash dengan bcrypt, atau kita gunakan plain text sementara jika bcrypt belum diinstall. Tapi disarankan bcrypt)
-- Untuk simulasi awal karena belum tentu bcrypt terinstall di project user, mari gunakan hash SHA256 biasa atau simpan sebagai plain text SEMENTARA (nanti akan dikelola oleh endpoint backend).
-- Kita biarkan kosong, dan akan di-seed melalui script JS agar bisa menggunakan module 'crypto' Node.js.
