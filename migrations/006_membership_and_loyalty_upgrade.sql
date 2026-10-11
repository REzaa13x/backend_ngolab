-- ==============================================================================
-- Migration 006: Membership, Loyalty Points, Tier, Rewards, and Redemptions
-- Target Database: MariaDB 10.4+ / MySQL 8.0+
-- Storage Engine: InnoDB
-- Charset: utf8mb4 / utf8mb4_unicode_ci
-- ==============================================================================

-- 1. LOYALTY PERIODS
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

-- 2. MEMBER TIERS
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

-- 3. MEMBERS
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

-- 4. MEMBER IDENTIFIERS
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

-- 5. LOYALTY ACCOUNTS
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

-- 6. LOYALTY TRANSACTIONS (LEDGER)
CREATE TABLE IF NOT EXISTS `loyalty_transactions` (
  `id` VARCHAR(50) NOT NULL,
  `loyalty_account_id` VARCHAR(50) NOT NULL,
  `period_id` VARCHAR(50) DEFAULT NULL,
  `transaction_type` ENUM('PURCHASE', 'GAMIFICATION', 'EVENT', 'BONUS', 'REDEMPTION', 'EXPIRATION', 'ADJUSTMENT', 'REVERSAL') NOT NULL,
  `points` INT NOT NULL,
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

-- 7. MEMBER TIER HISTORIES
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

-- 8. REWARDS
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

-- 9. REDEMPTIONS
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

-- 10. INITIAL SEEDS (TIERS & CURRENT PERIOD IF EMPTY)
INSERT IGNORE INTO `loyalty_periods` (`id`, `code`, `name`, `start_date`, `end_date`, `status`)
VALUES ('lp-default-2026', 'PERIOD-2026', 'Tahun Akademik 2026/2027', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'ACTIVE');

INSERT IGNORE INTO `member_tiers` (`id`, `code`, `name`, `min_spending`, `max_spending`, `benefit_description`, `multiplier`, `status`)
VALUES 
('tier-classmate', 'CLASSMATE', 'Classmate', 0.00, 100000.00, 'Dapat 1x poin tiap transaksi, akses promo bulanan', 1.00, 'ACTIVE'),
('tier-study-buddy', 'STUDY_BUDDY', 'Study Buddy', 100000.00, 300000.00, 'Dapat 1.2x poin tiap transaksi, upsize minuman 1x/minggu', 1.20, 'ACTIVE'),
('tier-campus-star', 'CAMPUS_STAR', 'Campus Star', 300000.00, 750000.00, 'Dapat 1.5x poin tiap transaksi, potongan 5% di semua menu', 1.50, 'ACTIVE'),
('tier-hall-of-fame', 'HALL_OF_FAME', 'Hall of Fame', 750000.00, NULL, 'Dapat 2x poin tiap transaksi, diskon khusus 30% bulanan', 2.00, 'ACTIVE');
