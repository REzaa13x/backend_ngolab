-- Make order_items compatible with both Geasture-admin (item_name)
-- and the cashier application (menu_name).
-- Run once after taking a database backup.

SET @has_item_name := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'item_name'
);
SET @sql := IF(@has_item_name = 0,
  'ALTER TABLE order_items ADD COLUMN item_name VARCHAR(200) NULL DEFAULT NULL AFTER menu_id',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_menu_name := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'menu_name'
);
SET @sql := IF(@has_menu_name = 0,
  'ALTER TABLE order_items ADD COLUMN menu_name VARCHAR(200) NULL DEFAULT NULL AFTER item_name',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Both columns must be nullable with a default. A NOT NULL column without a default makes the
-- cashier app fail its INSERT whenever it supplies only the other naming column.
ALTER TABLE order_items MODIFY COLUMN item_name VARCHAR(200) NULL DEFAULT NULL;
ALTER TABLE order_items MODIFY COLUMN menu_name VARCHAR(200) NULL DEFAULT NULL;

SET @missing_item := (
  SELECT COUNT(*) FROM order_items
  WHERE (item_name IS NULL OR item_name = '') AND menu_name IS NOT NULL
);
SET @sql := IF(@missing_item > 0,
  'UPDATE order_items SET item_name = menu_name WHERE (item_name IS NULL OR item_name = '''') AND menu_name IS NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @missing_menu := (
  SELECT COUNT(*) FROM order_items
  WHERE (menu_name IS NULL OR menu_name = '') AND item_name IS NOT NULL
);
SET @sql := IF(@missing_menu > 0,
  'UPDATE order_items SET menu_name = item_name WHERE (menu_name IS NULL OR menu_name = '''') AND item_name IS NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Payment-proof reference lookup runs on every proof image request; without these indexes the
-- two-column query scans the whole orders table.
SET @has_proof_url_index := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
    AND INDEX_NAME = 'idx_orders_payment_proof_url'
);
SET @sql := IF(@has_proof_url_index = 0,
  'ALTER TABLE orders ADD INDEX idx_orders_payment_proof_url (payment_proof_url)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_proof_index := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
    AND INDEX_NAME = 'idx_orders_payment_proof'
);
SET @sql := IF(@has_proof_index = 0,
  'ALTER TABLE orders ADD INDEX idx_orders_payment_proof (payment_proof)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_client_index := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
    AND INDEX_NAME = 'idx_orders_external_api_client'
);
SET @sql := IF(@has_client_index = 0,
  'ALTER TABLE orders ADD INDEX idx_orders_external_api_client (external_api_client_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
