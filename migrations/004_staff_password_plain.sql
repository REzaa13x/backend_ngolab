-- Tambah kolom password_plain untuk kredensial pegawai yang bisa dibaca Super Admin.
-- Jalankan sekali setelah backup database; idempotent (aman dijalankan berulang).
SET @has_plain := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'password_plain'
);
SET @sql := IF(@has_plain = 0,
  'ALTER TABLE staff ADD COLUMN password_plain VARCHAR(100) DEFAULT NULL AFTER password_hash',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
