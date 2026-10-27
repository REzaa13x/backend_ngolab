-- ==============================================================================
-- DATABASE CREATION & SCHEMA DEFINITION SCRIPT: sql_create.sql
-- Application: backend_ngolab (Gesture Eats / Ngolab Membership & Loyalty)
-- Target Database: MariaDB 10.4+ / MySQL 8.0+
-- Storage Engine: InnoDB
-- Default Charset: utf8mb4
-- Default Collation: utf8mb4_unicode_ci
-- ==============================================================================
--
-- USAGE INSTRUCTIONS & SAFETY WARNINGS:
-- 1. This script is intended strictly for setting up a FRESH, EMPTY database.
-- 2. DO NOT run this script as an update or migration mechanism on existing
--    installations. For existing databases, execute the incremental migration
--    scripts located under `backend_ngolab/migrations/` in sequential order.
-- 3. All CREATE TABLE statements use `CREATE TABLE IF NOT EXISTS` and do NOT
--    drop tables or delete existing data. Because `IF NOT EXISTS` skips execution
--    when a table is present, re-running this script will NOT apply schema
--    modifications or add newly added columns to already-existing tables.
-- 4. Passwords and credentials: No plaintext passwords or production user
--    accounts are seeded in this file. Initial administrative staff accounts
--    must be initialized using the authorized application bootstrap scripts.
-- ==============================================================================

-- ==============================================================================
-- 1. SESSION & DATABASE SETTINGS
-- ==============================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+07:00';

-- ==============================================================================
-- 2. DATABASE INITIALIZATION
-- Configurable database name (default: gesture_eats)
-- ==============================================================================
CREATE DATABASE IF NOT EXISTS `gesture_eats`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `gesture_eats`;

-- ==============================================================================
-- 3. CORE IDENTITY & AUTHENTICATION TABLES
-- ==============================================================================

-- 3.1 users (Customer / Student / General account identity)
-- Note: users.id is the canonical identity referenced across orders and membership.
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL,
  `nama` VARCHAR(100) NOT NULL,
  `nim` VARCHAR(50) DEFAULT NULL,
  `coin_balance` INT NOT NULL DEFAULT 0 COMMENT 'Legacy coin balance; authoritative points balance is stored in loyalty_accounts',
  `avatar_url` VARCHAR(500) DEFAULT NULL,
  `rfid_tag_id` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'Pelanggan',
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `password_plain` VARCHAR(100) DEFAULT NULL COMMENT 'DEPRECATED legacy plaintext field; no new writes, retained for read sanitization',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_rfid_tag_id` (`rfid_tag_id`),
  KEY `idx_users_nim` (`nim`),
  KEY `idx_users_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.2 staff (Operational roles: Super Admin, Admin, Kasir, Koki, Support)
CREATE TABLE IF NOT EXISTS `staff` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `role` ENUM('Super Admin', 'Admin', 'Kasir', 'Koki', 'Support') NOT NULL DEFAULT 'Kasir',
  `email` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `password_plain` VARCHAR(100) DEFAULT NULL COMMENT 'DEPRECATED legacy plaintext field; managed via authorized staff routes only',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_staff_email` (`email`),
  KEY `idx_staff_role` (`role`),
  KEY `idx_staff_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.3 shifts (Staff duty schedules)
CREATE TABLE IF NOT EXISTS `shifts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` VARCHAR(50) NOT NULL,
  `shift_type` VARCHAR(50) NOT NULL,
  `time` VARCHAR(100) NOT NULL,
  `date` DATE NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_shifts_staff_id` (`staff_id`),
  CONSTRAINT `fk_shifts_staff_id` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.4 api_keys (Hashed external partner credentials)
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `key_prefix` VARCHAR(32) NOT NULL,
  `key_hash` CHAR(64) NOT NULL,
  `scopes` JSON NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` DATETIME DEFAULT NULL,
  `revoked_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_api_keys_hash` (`key_hash`),
  KEY `idx_api_keys_active` (`is_active`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 4. PRODUCT, MENU, CATEGORY & INVENTORY TABLES
-- ==============================================================================

-- 4.1 menus (Main item catalog for outlets and kiosk)
CREATE TABLE IF NOT EXISTS `menus` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'Semua',
  `price` INT NOT NULL DEFAULT 0,
  `in_stock` TINYINT(1) NOT NULL DEFAULT 1,
  `stock` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `inventory_available` TINYINT(1) NOT NULL DEFAULT 1,
  `availability_override` VARCHAR(20) NOT NULL DEFAULT 'auto',
  `availability_reason` VARCHAR(255) DEFAULT NULL,
  `availability_updated_by` VARCHAR(100) DEFAULT NULL,
  `availability_updated_at` DATETIME DEFAULT NULL,
  `outlet` VARCHAR(50) NOT NULL DEFAULT 'ngolab' COMMENT 'ngolab, coworking, smart_tag_qr',
  `image_url` VARCHAR(500) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_menus_outlet_category` (`outlet`, `category`),
  KEY `idx_menus_availability` (`is_active`, `in_stock`, `outlet`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.2 ingredients (Raw materials & inventory tracking)
CREATE TABLE IF NOT EXISTS `ingredients` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `inventory_type` VARCHAR(30) NOT NULL DEFAULT 'raw_material',
  `sku` VARCHAR(100) DEFAULT NULL,
  `barcode` VARCHAR(100) DEFAULT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'Bahan Baku',
  `unit` VARCHAR(50) NOT NULL,
  `purchase_unit` VARCHAR(50) DEFAULT NULL,
  `purchase_conversion` DECIMAL(12,3) NOT NULL DEFAULT 1.000,
  `stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `min_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `critical_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cost_price` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `supplier` VARCHAR(150) DEFAULT NULL,
  `outlet` VARCHAR(50) NOT NULL DEFAULT 'ngolab',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_barcode_outlet` (`barcode`, `outlet`),
  UNIQUE KEY `uq_inventory_sku_outlet` (`sku`, `outlet`),
  KEY `idx_ingredients_outlet` (`outlet`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.3 inventory_movements (Audit ledger of inventory adjustments & consumption)
CREATE TABLE IF NOT EXISTS `inventory_movements` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `ingredient_id` VARCHAR(50) NOT NULL,
  `outlet` VARCHAR(50) NOT NULL DEFAULT 'ngolab',
  `movement_type` VARCHAR(30) NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `stock_before` DECIMAL(12,2) NOT NULL,
  `stock_after` DECIMAL(12,2) NOT NULL,
  `input_method` VARCHAR(30) NOT NULL DEFAULT 'manual',
  `reference_type` VARCHAR(50) DEFAULT NULL,
  `reference_id` VARCHAR(100) DEFAULT NULL,
  `purchase_unit` VARCHAR(50) DEFAULT NULL,
  `purchase_quantity` DECIMAL(12,2) DEFAULT NULL,
  `unit_cost` DECIMAL(14,2) DEFAULT NULL,
  `supplier` VARCHAR(150) DEFAULT NULL,
  `batch_number` VARCHAR(100) DEFAULT NULL,
  `expires_at` DATE DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `actor_id` VARCHAR(50) DEFAULT NULL,
  `actor_name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_movements_item` (`ingredient_id`, `created_at`),
  KEY `idx_inventory_movements_reference` (`reference_type`, `reference_id`),
  KEY `idx_inventory_movements_outlet` (`outlet`, `created_at`),
  CONSTRAINT `fk_inventory_movements_item` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.4 recipe_ingredients (BOM / Recipe mapping menu item to ingredients)
CREATE TABLE IF NOT EXISTS `recipe_ingredients` (
  `menu_name` VARCHAR(200) NOT NULL,
  `outlet` VARCHAR(50) NOT NULL DEFAULT 'ngolab',
  `ingredient_id` VARCHAR(50) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`menu_name`, `outlet`, `ingredient_id`),
  KEY `idx_recipe_ingredient_id` (`ingredient_id`),
  CONSTRAINT `fk_recipe_ingredients_item` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 5. PREORDER TABLES
-- ==============================================================================

-- 5.1 preorder_campaigns (Pre-order time windows and batches)
CREATE TABLE IF NOT EXISTS `preorder_campaigns` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `outlet` ENUM('ngolab', 'coworking') NOT NULL,
  `order_start_at` DATETIME NOT NULL,
  `order_deadline_at` DATETIME NOT NULL,
  `service_at` DATETIME NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `kds_released_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_preorder_window` (`outlet`, `is_active`, `order_start_at`, `order_deadline_at`),
  KEY `idx_preorder_service` (`service_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.2 preorder_items (Campaign-specific preorder menu offerings)
CREATE TABLE IF NOT EXISTS `preorder_items` (
  `id` VARCHAR(50) NOT NULL,
  `campaign_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'PO',
  `price` INT NOT NULL,
  `quota_total` INT NOT NULL,
  `quota_sold` INT NOT NULL DEFAULT 0,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_preorder_items_campaign` (`campaign_id`, `is_active`),
  CONSTRAINT `fk_preorder_items_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `preorder_campaigns` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 6. ORDER, PAYMENT & OPERATIONAL TABLES
-- ==============================================================================

-- 6.1 orders (Primary source of truth for POS, KDS, online, and pre-orders)
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(50) NOT NULL,
  `destination_label` VARCHAR(100) DEFAULT NULL,
  `user_id` VARCHAR(50) DEFAULT NULL COMMENT 'References users.id; NULL for guest / anonymous orders',
  `customer_name` VARCHAR(100) NOT NULL,
  `customer_phone` VARCHAR(50) DEFAULT NULL,
  `invoice_number` VARCHAR(50) NOT NULL,
  `total_price` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(30) NOT NULL DEFAULT 'Menunggu' COMMENT 'Menunggu, Sedang Diproses, Siap, Selesai, Dibatalkan',
  `payment_status` ENUM('belum_bayar', 'pending_verifikasi', 'lunas', 'ditolak') NOT NULL DEFAULT 'belum_bayar',
  `payment_method` VARCHAR(100) DEFAULT NULL,
  `external_id` VARCHAR(100) DEFAULT NULL,
  `source` VARCHAR(50) NOT NULL DEFAULT 'ngolab' COMMENT 'ngolab, coworking, smart_tag_qr, external_api',
  `external_api_client_id` VARCHAR(100) DEFAULT NULL,
  `outlet` VARCHAR(50) NOT NULL DEFAULT 'ngolab',
  `amount_paid` INT NOT NULL DEFAULT 0,
  `change_amount` INT NOT NULL DEFAULT 0,
  `order_type` VARCHAR(30) NOT NULL DEFAULT 'regular',
  `preorder_campaign_id` VARCHAR(50) DEFAULT NULL,
  `payment_timing` VARCHAR(30) DEFAULT NULL,
  `fulfillment_at` DATETIME DEFAULT NULL,
  `preorder_status` VARCHAR(30) DEFAULT NULL,
  `picked_up_at` DATETIME DEFAULT NULL,
  `payment_proof` VARCHAR(500) DEFAULT NULL,
  `payment_proof_url` VARCHAR(500) DEFAULT NULL,
  `payment_proof_uploaded_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_user_id` (`user_id`),
  KEY `idx_orders_invoice` (`invoice_number`),
  KEY `idx_orders_status_payment` (`status`, `payment_status`),
  KEY `idx_orders_created_at` (`created_at`),
  KEY `idx_orders_outlet_created` (`outlet`, `created_at`),
  KEY `idx_orders_payment_proof_url` (`payment_proof_url`),
  KEY `idx_orders_payment_proof` (`payment_proof`),
  KEY `idx_orders_external_api_client` (`external_api_client_id`),
  CONSTRAINT `fk_orders_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.2 order_items (Detailed line items for orders)
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(50) NOT NULL,
  `menu_id` VARCHAR(50) DEFAULT NULL,
  `menu_name` VARCHAR(200) DEFAULT NULL COMMENT 'Cashier-compatible item name snapshot',
  `item_name` VARCHAR(200) DEFAULT NULL COMMENT 'Admin/coworking item name snapshot',
  `quantity` INT NOT NULL DEFAULT 1,
  `note` VARCHAR(255) DEFAULT NULL,
  `price` INT NOT NULL DEFAULT 0,
  `preorder_item_id` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order_id` (`order_id`),
  KEY `idx_order_items_menu_id` (`menu_id`),
  CONSTRAINT `fk_order_items_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 7. POS, KDS & DIGITAL SIGNAGE SUPPORTING TABLES
-- ==============================================================================

-- 7.1 digital_screens (Digital board screen displays)
CREATE TABLE IF NOT EXISTS `digital_screens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `location` VARCHAR(200) DEFAULT NULL,
  `status` ENUM('online', 'offline', 'maintenance') NOT NULL DEFAULT 'offline',
  `last_ping` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.2 media_files (Uploaded assets for digital signage and promotions)
CREATE TABLE IF NOT EXISTS `media_files` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_url` VARCHAR(500) NOT NULL,
  `file_size` BIGINT NOT NULL DEFAULT 0,
  `file_type` ENUM('image', 'video') NOT NULL DEFAULT 'image',
  `mime_type` VARCHAR(100) NOT NULL,
  `duration` INT NOT NULL DEFAULT 10,
  `thumbnail_url` VARCHAR(500) DEFAULT NULL,
  `width` INT DEFAULT NULL,
  `height` INT DEFAULT NULL,
  `uploaded_by` VARCHAR(100) NOT NULL DEFAULT 'Admin',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.3 playlists (Signage playlists)
CREATE TABLE IF NOT EXISTS `playlists` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `loop_mode` TINYINT(1) NOT NULL DEFAULT 1,
  `total_duration` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.4 playlist_items (Playlist items & display sequence)
CREATE TABLE IF NOT EXISTS `playlist_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `playlist_id` INT NOT NULL,
  `media_id` INT NOT NULL,
  `order_index` INT NOT NULL DEFAULT 0,
  `duration_override` INT DEFAULT NULL,
  `transition` ENUM('fade', 'slide', 'zoom', 'none') NOT NULL DEFAULT 'fade',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_playlist_items_playlist` (`playlist_id`),
  KEY `idx_playlist_items_media` (`media_id`),
  CONSTRAINT `fk_playlist_items_playlist` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_playlist_items_media` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.5 schedules (Signage broadcasting schedule)
CREATE TABLE IF NOT EXISTS `schedules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `playlist_id` INT NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `days_of_week` VARCHAR(100) NOT NULL DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]',
  `start_date` DATE DEFAULT NULL,
  `end_date` DATE DEFAULT NULL,
  `priority` INT NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_schedules_playlist` (`playlist_id`),
  CONSTRAINT `fk_schedules_playlist` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.6 screen_playlists (Mapping screens to active playlists/schedules)
CREATE TABLE IF NOT EXISTS `screen_playlists` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `screen_id` INT NOT NULL,
  `playlist_id` INT NOT NULL,
  `schedule_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_screen_playlists_screen` (`screen_id`),
  KEY `idx_screen_playlists_playlist` (`playlist_id`),
  KEY `idx_screen_playlists_schedule` (`schedule_id`),
  CONSTRAINT `fk_screen_playlists_screen` FOREIGN KEY (`screen_id`) REFERENCES `digital_screens` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_screen_playlists_playlist` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_screen_playlists_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.7 display_logs (Play/impression audit logs)
CREATE TABLE IF NOT EXISTS `display_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `screen_id` INT NOT NULL,
  `media_id` INT NOT NULL,
  `playlist_id` INT NOT NULL,
  `displayed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `duration_shown` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_display_logs_screen` (`screen_id`),
  KEY `idx_display_logs_media` (`media_id`),
  CONSTRAINT `fk_display_logs_screen` FOREIGN KEY (`screen_id`) REFERENCES `digital_screens` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_display_logs_media` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_display_logs_playlist` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 8. STUDY SESSIONS & CROWDFUNDING (PATUNGAN) TABLES
-- ==============================================================================

-- 8.1 study_sessions (Gamified study tracking)
CREATE TABLE IF NOT EXISTS `study_sessions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(50) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `duration_minutes` INT NOT NULL,
  `points_earned` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_study_sessions_user_id` (`user_id`),
  CONSTRAINT `fk_study_sessions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.2 patungan_rooms (Crowdfunding campaigns/rooms)
CREATE TABLE IF NOT EXISTS `patungan_rooms` (
  `id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `target_amount` INT NOT NULL,
  `current_amount` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.3 patungan_contributions (User contributions to crowdfunding rooms)
CREATE TABLE IF NOT EXISTS `patungan_contributions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `room_id` VARCHAR(50) NOT NULL,
  `user_id` VARCHAR(50) NOT NULL,
  `amount` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_patungan_contrib_room` (`room_id`),
  KEY `idx_patungan_contrib_user` (`user_id`),
  CONSTRAINT `fk_patungan_contrib_room` FOREIGN KEY (`room_id`) REFERENCES `patungan_rooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_patungan_contrib_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 9. LEGACY COIN COMPATIBILITY TABLES
-- ==============================================================================
-- NOTE: Retained for backward-compatibility with older kiosk, POS, and prototype
-- endpoints. Authoritative membership loyalty ledger resides in `loyalty_accounts`
-- and `loyalty_transactions`. Do not introduce silent dual-write DB triggers.

-- 9.1 coin_promos (Legacy coin voucher promo templates)
CREATE TABLE IF NOT EXISTS `coin_promos` (
  `id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `coin_cost` INT NOT NULL,
  `discount_type` ENUM('fixed', 'percentage', 'free_item') NOT NULL DEFAULT 'fixed',
  `discount_value` INT NOT NULL DEFAULT 0,
  `min_order` INT NOT NULL DEFAULT 0,
  `max_usage` INT NOT NULL DEFAULT 100,
  `used_count` INT NOT NULL DEFAULT 0,
  `valid_until` DATETIME NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `category` VARCHAR(100) DEFAULT 'Semua',
  `free_item_name` VARCHAR(200) DEFAULT NULL,
  `required_item_name` VARCHAR(200) DEFAULT NULL,
  `product_id` VARCHAR(50) DEFAULT NULL,
  `category_id` VARCHAR(50) DEFAULT NULL,
  `promo_code` VARCHAR(100) DEFAULT NULL,
  `limit_per_user` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coin_promos_promo_code` (`promo_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9.2 coin_transactions (Legacy coin earn & redeem ledger)
CREATE TABLE IF NOT EXISTS `coin_transactions` (
  `id` VARCHAR(50) NOT NULL,
  `order_id` VARCHAR(50) DEFAULT NULL COMMENT 'Unique order reward idempotency key',
  `user_id` VARCHAR(50) NOT NULL,
  `user_name` VARCHAR(100) NOT NULL COMMENT 'User snapshot name',
  `type` ENUM('earn', 'redeem') NOT NULL,
  `amount` INT NOT NULL,
  `description` TEXT DEFAULT NULL,
  `promo_id` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coin_transactions_order_reward` (`order_id`),
  KEY `idx_coin_transactions_user_id` (`user_id`),
  KEY `idx_coin_transactions_promo_id` (`promo_id`),
  CONSTRAINT `fk_coin_transactions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_coin_transactions_promo_id` FOREIGN KEY (`promo_id`) REFERENCES `coin_promos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9.3 user_vouchers (Legacy coin-redeemed voucher instances)
CREATE TABLE IF NOT EXISTS `user_vouchers` (
  `id` VARCHAR(50) NOT NULL,
  `user_id` VARCHAR(50) NOT NULL,
  `promo_id` VARCHAR(50) NOT NULL,
  `voucher_code` VARCHAR(100) NOT NULL,
  `status` ENUM('unused', 'used') NOT NULL DEFAULT 'unused',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_vouchers_code` (`voucher_code`),
  KEY `idx_user_vouchers_user` (`user_id`),
  KEY `idx_user_vouchers_promo` (`promo_id`),
  CONSTRAINT `fk_user_vouchers_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_vouchers_promo_id` FOREIGN KEY (`promo_id`) REFERENCES `coin_promos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 10. LOYALTY PERIOD & TIER TABLES
-- ==============================================================================

-- 10.1 loyalty_periods (Academic/fiscal periods for qualifying spending & tier status)
CREATE TABLE IF NOT EXISTS `loyalty_periods` (
  `id` VARCHAR(50) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME NOT NULL,
  `status` ENUM('UPCOMING', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'UPCOMING',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_loyalty_periods_code` (`code`),
  KEY `idx_loyalty_periods_status` (`status`),
  KEY `idx_loyalty_periods_dates` (`start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10.2 member_tiers (Tier definitions based on qualifying spending thresholds)
CREATE TABLE IF NOT EXISTS `member_tiers` (
  `id` VARCHAR(50) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `min_spending` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `max_spending` DECIMAL(12,2) DEFAULT NULL,
  `benefit_description` TEXT DEFAULT NULL,
  `multiplier` DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_tiers_code` (`code`),
  KEY `idx_member_tiers_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 11. MEMBERSHIP TABLES
-- ==============================================================================

-- 11.1 members (1-to-0..1 extension of users identity for loyalty & privileges)
CREATE TABLE IF NOT EXISTS `members` (
  `id` VARCHAR(50) NOT NULL,
  `user_id` VARCHAR(50) NOT NULL,
  `member_code` VARCHAR(50) NOT NULL,
  `member_type` ENUM('STUDENT', 'LECTURER', 'GENERAL') NOT NULL DEFAULT 'GENERAL',
  `current_tier_id` VARCHAR(50) DEFAULT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_members_user_id` (`user_id`),
  UNIQUE KEY `uq_members_member_code` (`member_code`),
  KEY `idx_members_current_tier_id` (`current_tier_id`),
  KEY `idx_members_status` (`status`),
  CONSTRAINT `fk_members_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_members_tier_id` FOREIGN KEY (`current_tier_id`) REFERENCES `member_tiers` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11.2 member_identifiers (Verified identification attributes: NIM, NIP, Email, Phone)
CREATE TABLE IF NOT EXISTS `member_identifiers` (
  `id` VARCHAR(50) NOT NULL,
  `member_id` VARCHAR(50) NOT NULL,
  `identifier_type` ENUM('STUDENT_NIM', 'LECTURER_NIP', 'EMAIL', 'PHONE') NOT NULL,
  `identifier_value` VARCHAR(150) NOT NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 1,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `verified_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_identifiers_type_value` (`identifier_type`, `identifier_value`),
  KEY `idx_member_identifiers_member_id` (`member_id`),
  CONSTRAINT `fk_member_identifiers_member_id` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11.3 member_tier_histories (Audit trail of member tier changes & evaluations)
CREATE TABLE IF NOT EXISTS `member_tier_histories` (
  `id` VARCHAR(50) NOT NULL,
  `member_id` VARCHAR(50) NOT NULL,
  `tier_id` VARCHAR(50) NOT NULL,
  `previous_tier_id` VARCHAR(50) DEFAULT NULL,
  `period_id` VARCHAR(50) DEFAULT NULL,
  `eligible_spending` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `change_reason` VARCHAR(255) NOT NULL,
  `effective_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tier_histories_member_effective` (`member_id`, `effective_at`),
  KEY `idx_tier_histories_period_id` (`period_id`),
  KEY `idx_tier_histories_tier_id` (`tier_id`),
  KEY `idx_tier_histories_previous_tier_id` (`previous_tier_id`),
  CONSTRAINT `fk_tier_histories_member_id` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_tier_histories_tier_id` FOREIGN KEY (`tier_id`) REFERENCES `member_tiers` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_tier_histories_prev_tier_id` FOREIGN KEY (`previous_tier_id`) REFERENCES `member_tiers` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_tier_histories_period_id` FOREIGN KEY (`period_id`) REFERENCES `loyalty_periods` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 12. POINTS ACCOUNT & LEDGER TABLES
-- ==============================================================================

-- 12.1 loyalty_accounts (Authoritative Points balance and lifetime totals)
CREATE TABLE IF NOT EXISTS `loyalty_accounts` (
  `id` VARCHAR(50) NOT NULL,
  `member_id` VARCHAR(50) NOT NULL,
  `current_period_id` VARCHAR(50) DEFAULT NULL,
  `current_points` INT NOT NULL DEFAULT 0,
  `lifetime_earned_points` INT NOT NULL DEFAULT 0,
  `lifetime_redeemed_points` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_loyalty_accounts_member_id` (`member_id`),
  KEY `idx_loyalty_accounts_current_period_id` (`current_period_id`),
  CONSTRAINT `fk_loyalty_accounts_member_id` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_loyalty_accounts_period_id` FOREIGN KEY (`current_period_id`) REFERENCES `loyalty_periods` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12.2 loyalty_transactions (Double-entry / immutable Points transaction ledger)
CREATE TABLE IF NOT EXISTS `loyalty_transactions` (
  `id` VARCHAR(50) NOT NULL,
  `loyalty_account_id` VARCHAR(50) NOT NULL,
  `period_id` VARCHAR(50) DEFAULT NULL,
  `transaction_type` ENUM('PURCHASE', 'GAMIFICATION', 'EVENT', 'BONUS', 'REDEMPTION', 'EXPIRATION', 'ADJUSTMENT', 'REVERSAL') NOT NULL,
  `points` INT NOT NULL COMMENT 'Signed integer: positive credits, negative debits',
  `reference_type` VARCHAR(50) DEFAULT NULL,
  `reference_id` VARCHAR(100) DEFAULT NULL,
  `idempotency_key` VARCHAR(100) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_loyalty_tx_idempotency_key` (`idempotency_key`),
  KEY `idx_loyalty_tx_account_created` (`loyalty_account_id`, `created_at`),
  KEY `idx_loyalty_tx_reference` (`reference_type`, `reference_id`),
  KEY `idx_loyalty_tx_type_created` (`transaction_type`, `created_at`),
  KEY `idx_loyalty_tx_period_id` (`period_id`),
  CONSTRAINT `fk_loyalty_tx_account_id` FOREIGN KEY (`loyalty_account_id`) REFERENCES `loyalty_accounts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_loyalty_tx_period_id` FOREIGN KEY (`period_id`) REFERENCES `loyalty_periods` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 13. REWARD & REDEMPTION TABLES
-- ==============================================================================

-- 13.1 rewards (Target clean rewards catalog)
CREATE TABLE IF NOT EXISTS `rewards` (
  `id` VARCHAR(50) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `points_required` INT NOT NULL DEFAULT 0,
  `stock` INT DEFAULT NULL,
  `is_unlimited` TINYINT(1) NOT NULL DEFAULT 1,
  `valid_from` DATETIME DEFAULT NULL,
  `valid_until` DATETIME DEFAULT NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `reward_type` VARCHAR(50) NOT NULL DEFAULT 'VOUCHER',
  `discount_type` VARCHAR(50) DEFAULT NULL,
  `discount_value` INT DEFAULT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `category` VARCHAR(100) DEFAULT 'Food',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rewards_code` (`code`),
  KEY `idx_rewards_status_validity` (`status`, `valid_from`, `valid_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13.2 redemptions (Atomic claim records, cryptographic verification codes, and cashier fulfillment)
CREATE TABLE IF NOT EXISTS `redemptions` (
  `id` VARCHAR(50) NOT NULL,
  `member_id` VARCHAR(50) NOT NULL,
  `reward_id` VARCHAR(50) NOT NULL,
  `points_used` INT NOT NULL,
  `redemption_code` VARCHAR(50) NOT NULL,
  `status` ENUM('REDEEMED', 'FULFILLED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'REDEEMED',
  `idempotency_key` VARCHAR(100) DEFAULT NULL,
  `redeemed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME DEFAULT NULL,
  `fulfilled_at` DATETIME DEFAULT NULL,
  `fulfilled_by_staff_id` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_redemptions_code` (`redemption_code`),
  UNIQUE KEY `uq_redemptions_idempotency_key` (`idempotency_key`),
  KEY `idx_redemptions_member_redeemed` (`member_id`, `redeemed_at`),
  KEY `idx_redemptions_reward_id` (`reward_id`),
  KEY `idx_redemptions_status` (`status`),
  KEY `idx_redemptions_expires_at` (`expires_at`),
  KEY `idx_redemptions_fulfilled_staff` (`fulfilled_by_staff_id`),
  CONSTRAINT `fk_redemptions_member_id` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_redemptions_reward_id` FOREIGN KEY (`reward_id`) REFERENCES `rewards` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_redemptions_staff_id` FOREIGN KEY (`fulfilled_by_staff_id`) REFERENCES `staff` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 14. AUDIT & APPLICATION SETTING TABLES
-- ==============================================================================

-- 14.1 audit_logs (System audit logs)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user` VARCHAR(100) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target` VARCHAR(255) NOT NULL,
  `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('success', 'warning', 'info') NOT NULL DEFAULT 'success',
  `ip` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_timestamp` (`timestamp`),
  KEY `idx_audit_logs_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14.2 app_settings (Key-value system configuration)
CREATE TABLE IF NOT EXISTS `app_settings` (
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT DEFAULT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 15. MINIMAL SAFE CONFIGURATION SEEDS (Default Startup Config)
-- ==============================================================================

-- 15.1 Default Application Settings
INSERT INTO `app_settings` (`key`, `value`) VALUES
('brand_name', 'GeastEats'),
('brand_subtitle', 'Admin Panel'),
('brand_logo_url', ''),
('active_zone', '60'),
('dwell_time', '1.5'),
('kiosk_idle_timeout', '60'),
('kiosk_mode', 'gesture'),
('kds_sound_enabled', '1'),
('kds_sound_volume', '100'),
('kds_new_order_sound_url', ''),
('kds_ready_sound_url', ''),
('receipt_footer', 'Terima kasih atas kunjungan Anda!'),
('maintenance_mode', '0'),
('theme_color', '#4f46e5'),
('theme_mode', 'light'),
('sidebar_bg_color', '#ffffff'),
('sidebar_text_color', '#64748b'),
('sidebar_active_bg_color', '#f0f2fe'),
('sidebar_active_text_color', '#4f46e5'),
('sidebar_border_color', '#f1f5f9'),
('sidebar_hover_bg_color', '#f8fafc'),
('sidebar_hover_text_color', '#0f172a'),
('sidebar_logo_text_color', '#0f172a'),
('sidebar_section_text_color', '#94a3b8'),
('coin_reward_rate', '0.001')
ON DUPLICATE KEY UPDATE `key` = `key`;

-- 15.2 Default Loyalty Period
INSERT IGNORE INTO `loyalty_periods` (`id`, `code`, `name`, `start_date`, `end_date`, `status`)
VALUES ('lp-default-2026', 'PERIOD-2026', 'Tahun Akademik 2026/2027', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'ACTIVE');

-- 15.3 Default Member Tiers
INSERT IGNORE INTO `member_tiers` (`id`, `code`, `name`, `min_spending`, `max_spending`, `benefit_description`, `multiplier`, `status`)
VALUES 
('tier-classmate', 'CLASSMATE', 'Classmate', 0.00, 100000.00, 'Dapat 1x poin tiap transaksi, akses promo bulanan', 1.00, 'ACTIVE'),
('tier-study-buddy', 'STUDY_BUDDY', 'Study Buddy', 100000.00, 300000.00, 'Dapat 1.2x poin tiap transaksi, upsize minuman 1x/minggu', 1.20, 'ACTIVE'),
('tier-campus-star', 'CAMPUS_STAR', 'Campus Star', 300000.00, 750000.00, 'Dapat 1.5x poin tiap transaksi, potongan 5% di semua menu', 1.50, 'ACTIVE'),
('tier-hall-of-fame', 'HALL_OF_FAME', 'Hall of Fame', 750000.00, NULL, 'Dapat 2x poin tiap transaksi, diskon khusus 30% bulanan', 2.00, 'ACTIVE');

-- 15.4 Default Digital Screens & Playlist Templates
INSERT IGNORE INTO `digital_screens` (`id`, `name`, `location`, `status`) VALUES
(1, 'Kiosk Utama', 'Lantai 1 - Dekat Kasir', 'offline'),
(2, 'Display Tunggu', 'Area Tunggu Pelanggan', 'offline');

INSERT IGNORE INTO `playlists` (`id`, `name`, `description`, `is_default`, `loop_mode`) VALUES
(1, 'Playlist Promosi Utama', 'Playlist default saat layar idle', 1, 1);

-- ==============================================================================
-- 16. OPTIONAL DEVELOPMENT SEED SECTION (DISABLED BY DEFAULT)
-- ==============================================================================
-- To activate for development testing, manually uncomment statements below:
--
-- -- Sample Crowdfunding Rooms:
-- INSERT IGNORE INTO `patungan_rooms` (`id`, `title`, `target_amount`, `current_amount`) VALUES 
-- ('room-1', 'Patungan Buku Perpustakaan Baru', 50000, 0),
-- ('room-2', 'Sumbangan Wi-Fi Coworking Space', 100000, 0),
-- ('room-3', 'Donasi Event Himpunan Mahasiswa', 150000, 0);
--
-- -- Sample Reward Items:
-- INSERT IGNORE INTO `rewards` (`id`, `code`, `name`, `description`, `points_required`, `stock`, `is_unlimited`, `status`, `reward_type`) VALUES
-- ('rew-test-1', 'REW-KOPI-5K', 'Diskon Kopi Rp 5.000', 'Potongan harga Rp 5.000 untuk pembelian varian kopi', 50, 100, 0, 'ACTIVE', 'VOUCHER'),
-- ('rew-test-2', 'REW-FREE-PAST', 'Free Pastry Croissant', 'Gratis 1 Croissant pada pembelian minimal Rp 25.000', 100, NULL, 1, 'ACTIVE', 'VOUCHER');

-- ==============================================================================
-- 17. POST-INSTALL CHECK & VALIDATION
-- ==============================================================================
SET FOREIGN_KEY_CHECKS = 1;

-- Verification summary:
SELECT 'gesture_eats database schema setup complete.' AS `status`;
