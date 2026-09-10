-- Add outlet isolation to recipe definitions and phone contact for PO orders.
-- Existing recipes are assigned to Ngolab because that was the previous behavior.
-- Run once after taking a database backup.

SET @has_outlet := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recipe_ingredients' AND COLUMN_NAME = 'outlet'
);
SET @sql := IF(@has_outlet = 0,
  'ALTER TABLE recipe_ingredients ADD COLUMN outlet VARCHAR(50) NOT NULL DEFAULT ''ngolab'' AFTER menu_name',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_composite_pk := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recipe_ingredients'
    AND INDEX_NAME = 'PRIMARY' AND COLUMN_NAME = 'outlet'
);
SET @sql := IF(@has_composite_pk = 0,
  'ALTER TABLE recipe_ingredients DROP PRIMARY KEY, ADD PRIMARY KEY (menu_name, outlet, ingredient_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_customer_phone := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'customer_phone'
);
SET @sql := IF(@has_customer_phone = 0,
  'ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(50) DEFAULT NULL AFTER customer_name',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
