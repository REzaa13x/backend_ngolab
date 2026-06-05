-- ============================================================
-- ORDER & PAYMENT SYSTEM — MySQL Schema
-- Database: gesture_eats
-- ============================================================

-- ----------------------------------------
-- 1. users
--    Tabel untuk pelanggan yang memiliki koin
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`             VARCHAR(50)   NOT NULL,
  `nama`           VARCHAR(100)  NOT NULL,
  `nim`            VARCHAR(50)   DEFAULT NULL,
  `coin_balance`   INT           NOT NULL DEFAULT 0,
  `avatar_url`     VARCHAR(500)  DEFAULT NULL,
  `rfid_tag_id`    VARCHAR(100)  UNIQUE DEFAULT NULL,
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 2. orders
--    Tabel untuk transaksi / pesanan utama
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id`               VARCHAR(50)   NOT NULL,
  `user_id`          VARCHAR(50)   DEFAULT NULL COMMENT 'NULL jika tamu/offline',
  `customer_name`    VARCHAR(100)  NOT NULL,
  `invoice_number`   VARCHAR(50)   NOT NULL,
  `total_price`      INT           NOT NULL DEFAULT 0,
  `status`           ENUM('menunggu', 'sedang_diproses', 'siap', 'selesai', 'dibatalkan') NOT NULL DEFAULT 'menunggu',
  `payment_status`   ENUM('belum_bayar', 'pending_verifikasi', 'lunas', 'ditolak') NOT NULL DEFAULT 'belum_bayar',
  `payment_method`   VARCHAR(100)  DEFAULT NULL,
  `external_id`      VARCHAR(100)  DEFAULT NULL COMMENT 'ID dari payment gateway atau resi',
  `source`           VARCHAR(50)   NOT NULL DEFAULT 'ngolab' COMMENT 'Sumber pesanan: ngolab, coworking, smart_tag_qr',
  `amount_paid`      INT           NOT NULL DEFAULT 0,
  `payment_proof`    VARCHAR(500)  DEFAULT NULL COMMENT 'Path file bukti transfer',
  `created_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 3. order_items
--    Tabel rincian item yang dibeli
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `order_id`    VARCHAR(50)   NOT NULL,
  `menu_id`     VARCHAR(50)   DEFAULT NULL COMMENT 'ID menu dari external API teman (opsional)',
  `item_name`   VARCHAR(200)  NOT NULL COMMENT 'Snapshot nama menu saat dibeli',
  `quantity`    INT           NOT NULL DEFAULT 1,
  `price`       INT           NOT NULL DEFAULT 0 COMMENT 'Snapshot harga satuan saat dibeli',
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 4. coin_promos
--    Tabel diskon / penukaran promo koin
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `coin_promos` (
  `id`              VARCHAR(50)   NOT NULL,
  `title`           VARCHAR(200)  NOT NULL,
  `description`     TEXT          DEFAULT NULL,
  `coin_cost`       INT           NOT NULL,
  `discount_type`   ENUM('fixed', 'percentage', 'free_item') NOT NULL DEFAULT 'fixed',
  `discount_value`  INT           NOT NULL DEFAULT 0,
  `free_item_name`  VARCHAR(200)  DEFAULT NULL,
  `required_item_name` VARCHAR(200) DEFAULT NULL,
  `min_order`       INT           NOT NULL DEFAULT 0,
  `max_usage`       INT           NOT NULL DEFAULT 100,
  `used_count`      INT           NOT NULL DEFAULT 0,
  `valid_until`     DATETIME      NOT NULL,
  `is_active`       TINYINT(1)    NOT NULL DEFAULT 1,
  `image_url`       VARCHAR(500)  DEFAULT NULL,
  `category`        VARCHAR(100)  DEFAULT 'Semua',
  `product_id`      VARCHAR(50)   DEFAULT NULL,
  `category_id`     VARCHAR(50)   DEFAULT NULL,
  `created_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 5. coin_transactions
--    Tabel history koin (penambahan / penukaran)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `coin_transactions` (
  `id`             VARCHAR(50)   NOT NULL,
  `user_id`        VARCHAR(50)   NOT NULL,
  `user_name`      VARCHAR(100)  NOT NULL COMMENT 'Snapshot nama user',
  `type`           ENUM('earn', 'redeem') NOT NULL,
  `amount`         INT           NOT NULL,
  `description`    TEXT          DEFAULT NULL,
  `promo_id`       VARCHAR(50)   DEFAULT NULL,
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`promo_id`) REFERENCES `coin_promos`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------
-- 6. user_vouchers
--    Tabel untuk menyimpan voucher penukaran koin
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `user_vouchers` (
  `id`             VARCHAR(50)   NOT NULL,
  `user_id`        VARCHAR(50)   NOT NULL,
  `promo_id`       VARCHAR(50)   NOT NULL,
  `voucher_code`   VARCHAR(100)  NOT NULL UNIQUE,
  `status`         ENUM('unused', 'used') NOT NULL DEFAULT 'unused',
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`promo_id`) REFERENCES `coin_promos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- INITIAL SEED DATA
-- ============================================================

-- Data dumy telah dihapus.

