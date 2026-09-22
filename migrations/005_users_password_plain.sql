-- Tambah kolom password_plain pada tabel pelanggan (users) untuk halaman Database Pengguna.
-- Hanya dibaca endpoint ber-requireUserAdmin (Super Admin / Kasir / Support).
-- Jalankan sekali setelah backup database; idempotent (aman dijalankan berulang).
SET @has_plain := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_plain'
);
SET @sql := IF(@has_plain = 0,
  'ALTER TABLE users ADD COLUMN password_plain VARCHAR(100) DEFAULT NULL AFTER password_hash',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
