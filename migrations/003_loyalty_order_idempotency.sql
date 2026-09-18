-- Make cashback issuance idempotent per order.
-- Run once after taking a database backup.

SET @has_order_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coin_transactions' AND COLUMN_NAME = 'order_id'
);
SET @sql := IF(@has_order_id = 0,
  'ALTER TABLE coin_transactions ADD COLUMN order_id VARCHAR(50) DEFAULT NULL AFTER id',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_reward_index := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coin_transactions'
    AND INDEX_NAME = 'uq_coin_transactions_order_reward'
);
SET @sql := IF(@has_reward_index = 0,
  'ALTER TABLE coin_transactions ADD UNIQUE KEY uq_coin_transactions_order_reward (order_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
