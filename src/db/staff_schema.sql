-- ============================================================
-- STAFF & AUTHENTICATION — MySQL Schema
-- Database: gesture_eats
-- ============================================================

CREATE TABLE IF NOT EXISTS `staff` (
  `id`             VARCHAR(50)   NOT NULL,
  `name`           VARCHAR(100)  NOT NULL,
  `role`           ENUM('Super Admin', 'Admin', 'Kasir', 'Koki', 'Support') NOT NULL DEFAULT 'Kasir',
  `email`          VARCHAR(150)  NOT NULL UNIQUE,
  `phone`          VARCHAR(50)   DEFAULT NULL,
  `password_hash`  VARCHAR(255)  NOT NULL,
  `status`         ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shifts` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `staff_id`    VARCHAR(50)   NOT NULL,
  `shift_type`  VARCHAR(50)   NOT NULL,
  `time`        VARCHAR(100)  NOT NULL,
  `date`        DATE          NOT NULL,
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `user`        VARCHAR(100)  NOT NULL,
  `action`      VARCHAR(100)  NOT NULL,
  `target`      VARCHAR(255)  NOT NULL,
  `timestamp`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status`      ENUM('success', 'warning', 'info') NOT NULL DEFAULT 'success',
  `ip`          VARCHAR(50)   DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Data (Password default untuk testing adalah 'password' yang di-hash dengan bcrypt, atau kita gunakan plain text sementara jika bcrypt belum diinstall. Tapi disarankan bcrypt)
-- Untuk simulasi awal karena belum tentu bcrypt terinstall di project user, mari gunakan hash SHA256 biasa atau simpan sebagai plain text SEMENTARA (nanti akan dikelola oleh endpoint backend).
-- Kita biarkan kosong, dan akan di-seed melalui script JS agar bisa menggunakan module 'crypto' Node.js.
