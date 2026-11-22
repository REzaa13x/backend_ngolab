-- ==============================================================================
-- Migrasi 008: Ekosistem Ngolab — Modul Finansial, HPP 3-Tier, & Pricing Engine
-- Database: ngola_geasture_adm
-- Target Eksekusi: Fase 2 Rencana Pengembangan hpp_ngolab
-- ==============================================================================

USE `ngola_geasture_adm`;

-- 1. Master Bahan Baku & Konversi Satuan (48 Item dari Dataset Riil)
CREATE TABLE IF NOT EXISTS `hpp_master_ingredients` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `item_id` VARCHAR(64) NULL,
  `name` VARCHAR(150) NOT NULL,
  `purchase_unit` VARCHAR(50) NOT NULL,
  `purchase_price` DECIMAL(12,2) NOT NULL,
  `usage_unit` VARCHAR(50) NOT NULL,
  `conversion_ratio` DECIMAL(12,4) NOT NULL,
  `cost_per_usage_unit` DECIMAL(12,4) NOT NULL,
  `avco_price` DECIMAL(12,4) NOT NULL,
  `yield_percentage` DECIMAL(5,2) DEFAULT 100.00,
  `category` ENUM('bahan_baku', 'bumbu', 'kemasan', 'operasional') NOT NULL DEFAULT 'bahan_baku',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_hpp_ingredients_cat` (`category`),
  KEY `idx_hpp_ingredients_item` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Master Resep & Struktur Biaya 3-Tier
CREATE TABLE IF NOT EXISTS `hpp_recipes` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `menu_id` VARCHAR(64) NULL,
  `name` VARCHAR(150) NOT NULL,
  `category` ENUM('makanan_berat', 'camilan', 'minuman', 'bakso_mie', 'subassembly') NOT NULL DEFAULT 'makanan_berat',
  `portion_yield` DECIMAL(8,2) DEFAULT 1.00,
  `packaging_cost` DECIMAL(10,2) DEFAULT 0,
  `cooking_gas_cost` DECIMAL(10,2) DEFAULT 0,
  `labor_cost` DECIMAL(10,2) DEFAULT 0,
  `is_subassembly` TINYINT(1) DEFAULT 0,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_hpp_recipes_menu` (`menu_id`),
  KEY `idx_hpp_recipes_cat` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Detail Komposisi Bahan Resep
CREATE TABLE IF NOT EXISTS `hpp_recipe_ingredients` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `recipe_id` VARCHAR(64) NOT NULL,
  `ingredient_id` VARCHAR(64) NULL,
  `subassembly_recipe_id` VARCHAR(64) NULL,
  `quantity` DECIMAL(10,4) NOT NULL,
  `unit` VARCHAR(50) NOT NULL,
  `notes` VARCHAR(100) NULL,
  CONSTRAINT `fk_recipe_ing_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `hpp_recipes`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recipe_ing_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `hpp_master_ingredients`(`id`) ON DELETE SET NULL,
  KEY `idx_recipe_ing_sub` (`subassembly_recipe_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Buku Kas Harian & Pembelian Bahan (Cashbook)
CREATE TABLE IF NOT EXISTS `hpp_cashflow` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `entry_date` DATE NOT NULL,
  `type` ENUM('cash_in', 'cash_out') NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `ingredient_id` VARCHAR(64) NULL,
  `quantity` DECIMAL(10,3) NULL,
  `unit_price` DECIMAL(12,2) NULL,
  `total_amount` DECIMAL(12,2) NOT NULL,
  `receipt_url` VARCHAR(255) NULL,
  `created_by` VARCHAR(100) NOT NULL DEFAULT 'Admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_cashflow_date` (`entry_date`),
  KEY `idx_cashflow_type` (`type`),
  KEY `idx_cashflow_ingredient` (`ingredient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Riwayat Perubahan & Audit Penyesuaian Harga POS
CREATE TABLE IF NOT EXISTS `hpp_price_sync_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `menu_id` VARCHAR(64) NOT NULL,
  `menu_name` VARCHAR(150) NOT NULL,
  `old_price` DECIMAL(10,2) NOT NULL,
  `new_price` DECIMAL(10,2) NOT NULL,
  `applied_margin_percent` DECIMAL(5,2) NOT NULL,
  `synced_by` VARCHAR(100) NOT NULL,
  `synced_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_sync_menu` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ==============================================================================
-- SEEDING DATA MASTER BAHAN BAKU (48 ITEM DARI DATASET RIIL)
-- ==============================================================================
INSERT INTO `hpp_master_ingredients` 
(`id`, `name`, `purchase_unit`, `purchase_price`, `usage_unit`, `conversion_ratio`, `cost_per_usage_unit`, `avco_price`, `yield_percentage`, `category`) 
VALUES
('ing-beras', 'Beras', 'kg', 15500.00, 'gr', 968.7500, 16.0000, 16.0000, 100.00, 'bahan_baku'),
('ing-telur', 'Telur Ayam', 'kg', 26277.78, 'butir', 16.0000, 1642.0000, 1642.0000, 100.00, 'bahan_baku'),
('ing-ayam-fillet', 'Daging Ayam (Dada Fillet)', 'kg', 46000.00, 'gr', 1000.0000, 46.0000, 46.0000, 95.00, 'bahan_baku'),
('ing-ayam-wings', 'Sayap Ayam (Wings)', 'kg', 38300.00, 'gr', 1000.0000, 38.3000, 38.3000, 100.00, 'bahan_baku'),
('ing-ayam-karkas', 'Ayam Utuh (Karkas)', 'Ekor (1 kg)', 36000.00, 'potong', 4.0000, 9000.0000, 9000.0000, 100.00, 'bahan_baku'),
('ing-ayam-frozen', 'Ayam Frozen', 'Bungkus (1 kg)', 35700.00, 'potong', 8.0000, 4463.0000, 4463.0000, 100.00, 'bahan_baku'),
('ing-dada-utuh', 'Dada Ayam Utuh', 'Bungkus (1 kg)', 46000.00, 'bungkus', 1.0000, 46000.0000, 46000.0000, 100.00, 'bahan_baku'),
('ing-bakso-sapi', 'Bakso Sapi Super', 'Pack (36 pcs)', 35656.25, 'butir', 36.0000, 990.0000, 990.0000, 100.00, 'bahan_baku'),
('ing-sosis-ayam', 'Sosis Ayam', 'Pack (15 pcs)', 17500.00, 'pcs', 15.0000, 1167.0000, 1167.0000, 100.00, 'bahan_baku'),
('ing-indomie', 'Indomie / Mie Instan', 'Bungkus', 3290.00, 'bks', 1.0000, 3290.0000, 3290.0000, 100.00, 'bahan_baku'),
('ing-mie-yamien', 'Mie Basah / Yamien', 'kg', 22000.00, 'porsi', 6.6667, 3300.0000, 3300.0000, 100.00, 'bahan_baku'),
('ing-kentang-ff', 'Kentang Goreng (Shoestring)', 'kg', 29000.00, 'gr', 1000.0000, 29.0000, 29.0000, 100.00, 'bahan_baku'),
('ing-minyak-goreng', 'Minyak Goreng', 'Pouch (2 Liter)', 41200.00, 'ml', 2000.0000, 20.6000, 20.6000, 100.00, 'bahan_baku'),
('ing-daging-rendang', 'Daging Sapi (Rendang)', 'kg', 149000.00, 'gr', 1000.0000, 149.0000, 149.0000, 90.00, 'bahan_baku'),
('ing-daging-teriyaki', 'Daging Sapi Slice (Teriyaki)', 'kg', 136000.00, 'gr', 1000.0000, 136.0000, 136.0000, 95.00, 'bahan_baku'),
('ing-daging-dendeng', 'Daging Sapi (Dendeng)', 'kg', 149000.00, 'gr', 1000.0000, 149.0000, 149.0000, 90.00, 'bahan_baku'),
('ing-shrimp-roll', 'Shrimp Roll', 'Pack (10 pcs)', 27500.00, 'porsi', 5.0000, 5500.0000, 5500.0000, 100.00, 'bahan_baku'),
('ing-udang-keju', 'Udang Keju', 'Pack (10 pcs)', 30000.00, 'porsi', 5.0000, 6000.0000, 6000.0000, 100.00, 'bahan_baku'),
('ing-chicken-katsu', 'Chicken Katsu (Homemade)', 'Pcs (Produksi)', 4125.00, 'pcs', 1.0000, 4125.0000, 4125.0000, 100.00, 'bahan_baku'),
('ing-teri-medan', 'Ikan Teri Medan', 'kg', 66275.00, 'gr', 1000.0000, 66.2800, 66.2800, 95.00, 'bahan_baku'),
('ing-bawang-merah', 'Bawang Merah', 'kg', 30941.18, 'gr', 1000.0000, 30.9400, 30.9400, 85.00, 'bumbu'),
('ing-bawang-putih', 'Bawang Putih', 'kg', 35703.70, 'gr', 1000.0000, 35.7000, 35.7000, 85.00, 'bumbu'),
('ing-cabe-keriting', 'Cabe Merah Keriting', 'kg', 52022.73, 'gr', 1000.0000, 52.0200, 52.0200, 90.00, 'bumbu'),
('ing-kopi-espresso', 'Kopi Bubuk / Espresso', 'kg', 125000.00, 'shot', 55.5556, 2250.0000, 2250.0000, 100.00, 'bahan_baku'),
('ing-susu-uht', 'Susu UHT Full Cream', 'Kotak (946 ml)', 23000.00, 'ml', 946.0000, 24.3100, 24.3100, 100.00, 'bahan_baku'),
('ing-gula-aren', 'Gula Aren Cair', 'Liter (1000 ml)', 35000.00, 'ml', 1000.0000, 35.0000, 35.0000, 100.00, 'bahan_baku'),
('ing-coklat-bubuk', 'Bubuk Coklat Premium', 'kg', 75000.00, 'porsi', 33.3333, 2250.0000, 2250.0000, 100.00, 'bahan_baku'),
('ing-teh-celup', 'Teh Celup / Melati', 'Pack (25 pcs)', 10000.00, 'kantong', 25.0000, 400.0000, 400.0000, 100.00, 'bahan_baku'),
('ing-jeruk-peras', 'Jeruk Peras Segar', 'kg', 20000.00, 'porsi', 6.6667, 3000.0000, 3000.0000, 80.00, 'bahan_baku'),
('ing-strawberry', 'Strawberry Segar', 'Pack (500 gr)', 22500.00, 'porsi', 5.0000, 4500.0000, 4500.0000, 90.00, 'bahan_baku'),
('ing-sayur-campur', 'Sayuran Kol & Wortel', 'kg', 10394.12, 'gr', 1000.0000, 10.3900, 10.3900, 85.00, 'bumbu'),
('ing-kecap-manis', 'Kecap Manis', 'Pouch (520 ml)', 24475.00, 'ml', 520.0000, 47.0700, 47.0700, 100.00, 'bumbu'),
('ing-garam', 'Garam Dapur', 'Bungkus (250 gr)', 2000.00, 'gr', 250.0000, 8.0000, 8.0000, 100.00, 'bumbu'),
('ing-royco', 'Masako / Royco (Penyedap)', 'Bungkus (250 gr)', 9550.00, 'gr', 250.0000, 38.2000, 38.2000, 100.00, 'bumbu'),
('ing-racik-nasgor', 'Bumbu Racik Nasi Goreng', 'Sachet (20 gr)', 2167.00, 'sachet', 1.0000, 2167.0000, 2167.0000, 100.00, 'bumbu'),
('ing-santan-kara', 'Santan Kelapa (Kara)', 'Kotak (200 ml)', 18480.00, 'ml', 200.0000, 92.4000, 92.4000, 100.00, 'bumbu'),
('ing-tepung-kentucky', 'Tepung Bumbu Kentucky', 'Bungkus (210 gr)', 7500.00, 'gr', 210.0000, 35.7100, 35.7100, 100.00, 'bahan_baku'),
('ing-gula-pasir', 'Gula Pasir / Kemasan', 'kg', 27750.00, 'gr', 1000.0000, 27.7500, 27.7500, 100.00, 'bumbu'),
('ing-saus-sambal', 'Saus Sambal / Cabai', 'Pouch (1 kg)', 26100.00, 'gr', 1000.0000, 26.1000, 26.1000, 100.00, 'bumbu'),
('ing-mayones', 'Mayones', 'Pouch (1 kg)', 27916.67, 'gr', 1000.0000, 27.9200, 27.9200, 100.00, 'bumbu'),
('ing-terigu', 'Tepung Terigu Segitiga', 'kg', 15600.00, 'gr', 1000.0000, 15.6000, 15.6000, 100.00, 'bahan_baku'),
('ing-tepung-roti', 'Tepung Roti (Breadcrumbs)', 'Pack (250 gr)', 11875.00, 'gr', 250.0000, 47.5000, 47.5000, 100.00, 'bahan_baku'),
('ing-kerupuk', 'Kerupuk Kaleng / Blek', 'Bungkus', 13333.33, 'porsi', 20.0000, 667.0000, 667.0000, 100.00, 'bahan_baku'),
('ing-lalapan', 'Lalapan (Timun & Selada)', 'Porsi', 870.00, 'porsi', 1.0000, 870.0000, 870.0000, 100.00, 'bahan_baku'),
('ing-bumbu-padang', 'Bumbu Bakar Padang', 'Bungkus (250 gr)', 30949.00, 'gr', 250.0000, 123.8000, 123.8000, 100.00, 'bumbu'),
('ing-sambal-balado', 'Sambal Balado Indofood', 'Bungkus (200 gr)', 17500.00, 'gr', 200.0000, 87.5000, 87.5000, 100.00, 'bumbu'),
('ing-kelapa-parut', 'Kelapa Parut Segar', 'Butir', 5000.00, 'butir', 1.0000, 5000.0000, 5000.0000, 100.00, 'bahan_baku'),
('ing-rempah-dapur', 'Paket Rempah Dapur', 'Paket', 3000.00, 'paket', 1.0000, 3000.0000, 3000.0000, 100.00, 'bumbu')
ON DUPLICATE KEY UPDATE 
  `purchase_price` = VALUES(`purchase_price`),
  `cost_per_usage_unit` = VALUES(`cost_per_usage_unit`),
  `avco_price` = VALUES(`avco_price`);

-- ==============================================================================
-- SEEDING RESEP & STRUKTUR 3-TIER MENU (41 RESEP DENGAN MAPPING POS MENUS.ID)
-- ==============================================================================
INSERT INTO `hpp_recipes` 
(`id`, `menu_id`, `name`, `category`, `portion_yield`, `packaging_cost`, `cooking_gas_cost`, `labor_cost`, `is_subassembly`, `notes`) 
VALUES
('rec-sub-katsu', NULL, 'Chicken Katsu (Produksi 1 Batch 24 Pcs)', 'subassembly', 24.00, 500.00, 500.00, 0, 1, 'Produk antara untuk Nasi Bento Katsu & Nasi Goreng Katsu'),
('rec-nasgor-polos', '1781626170670', 'Nasi Goreng Tanpa Telur', 'makanan_berat', 1.00, 500.00, 500.00, 0, 0, 'Menu pokok hemat'),
('rec-nasi-omelet', '1791166530765', 'Nasi Omelet', 'makanan_berat', 1.00, 500.00, 500.00, 0, 0, 'Nasi dengan telur dadar gurih'),
('rec-omelet', '1791166373638', 'Omelet (Telur 2 Butir)', 'camilan', 1.00, 500.00, 500.00, 0, 0, 'Camilan telur dadar'),
('rec-shrimp-roll', NULL, 'Shrimp Roll', 'camilan', 1.00, 500.00, 500.00, 0, 0, 'Gorengan olahan udang'),
('rec-udang-keju', NULL, 'Udang Keju', 'camilan', 1.00, 500.00, 500.00, 0, 0, 'Gorengan udang isi keju lumer'),
('rec-kentang-sosis', NULL, 'Kentang + Sosis', 'camilan', 1.00, 500.00, 500.00, 0, 0, 'French fries shoestring dengan sosis ayam'),
('rec-mie-double-telur', NULL, 'Mie Double + Telur', 'makanan_berat', 1.00, 500.00, 500.00, 0, 0, 'Indomie double porsi + 1 telur'),
('rec-nasgor-ketumbar', '1790563222672', 'Nasi Goreng Ayam Ketumbar', 'makanan_berat', 1.00, 500.00, 500.00, 0, 0, 'Nasi goreng dengan potongan ayam marinasi ketumbar'),
('rec-bento-katsu', '1791292326396', 'Nasi Bento Katsu', 'makanan_berat', 1.00, 1500.00, 800.00, 0, 0, 'Menu signature box bento ayam katsu'),
('rec-bento-shrimp', '1791292258358', 'Nasi Bento Shrimp Roll', 'makanan_berat', 1.00, 1500.00, 800.00, 0, 0, 'Menu signature box bento shrimp roll'),
('rec-nasgor-katsu', '1791292066383', 'Nasi Goreng Katsu', 'makanan_berat', 1.00, 800.00, 700.00, 0, 0, 'Nasi goreng spesial dengan topping chicken katsu'),
('rec-mie-kentang', NULL, 'Mie Goreng Kentang', 'makanan_berat', 1.00, 500.00, 500.00, 0, 0, 'Indomie goreng dipadu kentang'),
('rec-omelet-1telur', '1790747916190', 'Omelet Dadar (1 Telur)', 'camilan', 1.00, 300.00, 300.00, 0, 0, 'Telur dadar 1 butir'),
('rec-telur-ceplok', NULL, 'Telur Ceplok', 'camilan', 1.00, 200.00, 300.00, 0, 0, 'Sunny side up'),
('rec-wings-hotlava', '1790732941390', 'Chicken Wing Hot Lava', 'makanan_berat', 1.00, 800.00, 800.00, 0, 0, 'Sayap ayam crispy bersaus pedas hot lava'),
('rec-nasi-ayam-baput', '1790732889297', 'Nasi Ayam Goreng Bawang Putih', 'makanan_berat', 1.00, 800.00, 800.00, 0, 0, 'Ayam goreng harum bawang putih'),
('rec-indomie-tektek', '1790732769532', 'Indomie Tek-Tek', 'bakso_mie', 1.00, 800.00, 600.00, 0, 0, 'Indomie kuah nyemek khas gerobak'),
('rec-indomie-dokdok', '1790732719604', 'Indomie Dokdok', 'bakso_mie', 1.00, 800.00, 600.00, 0, 0, 'Indomie kuah kental telur dokdok'),
('rec-indomie-telur', '1791516556400', 'Indomie Goreng + Telur', 'bakso_mie', 1.00, 500.00, 500.00, 0, 0, 'Indomie goreng klasik dengan telur'),
('rec-nasgor-teri', '1790732636733', 'Nasi Goreng Teri Medan', 'makanan_berat', 1.00, 600.00, 600.00, 0, 0, 'Nasi goreng gurih asin teri medan'),
('rec-nasi-ayam-ketumbar', '1790561002026', 'Nasi Ayam Ketumbar', 'makanan_berat', 1.00, 800.00, 800.00, 0, 0, 'Nasi dengan ayam ungkep bumbu ketumbar'),
('rec-nasgor-telur', '1790560348054', 'Nasi Goreng Telur', 'makanan_berat', 1.00, 600.00, 600.00, 0, 0, 'Nasi goreng spesial dengan telur orak-arik'),
('rec-kopi-aren', NULL, 'Kopi Gula Aren', 'minuman', 1.00, 800.00, 300.00, 0, 0, 'Espresso susu segar dengan sirup aren murni'),
('rec-americano', NULL, 'Americano', 'minuman', 1.00, 800.00, 200.00, 0, 0, 'Double shot espresso dengan air dingin/panas'),
('rec-hot-coklat', '1790733117217', 'Hot Coklat', 'minuman', 1.00, 800.00, 300.00, 0, 0, 'Coklat panas premium kental'),
('rec-es-coklat', '1790733077540', 'Es Coklat', 'minuman', 1.00, 800.00, 300.00, 0, 0, 'Coklat premium dingin dengan susu UHT'),
('rec-hot-tea', '1790733030819', 'Hot Tea', 'minuman', 1.00, 500.00, 0, 0, 0, 'Teh celup hangat'),
('rec-es-teh', '1790732988763', 'Es Teh Manis', 'minuman', 1.00, 700.00, 0, 0, 0, 'Teh melati wangi dingin porsi jumbo'),
('rec-bakso-kuah', NULL, 'Bakso Kuah (5 Butir)', 'bakso_mie', 1.00, 1000.00, 700.00, 0, 0, 'Bakso sapi super kuah kaldu rempah'),
('rec-mie-bakso', NULL, 'Mie Bakso Kuah', 'bakso_mie', 1.00, 1000.00, 700.00, 0, 0, 'Mie basah kenyal dengan bakso sapi kuah'),
('rec-bakso-malang', NULL, 'Bakso Malang Kuah', 'bakso_mie', 1.00, 1000.00, 800.00, 0, 0, 'Bakso malang komplit kuah sedap'),
('rec-bakso-malang-spesial', NULL, 'Bakso Malang Spesial Kuah', 'bakso_mie', 1.00, 1000.00, 800.00, 0, 0, 'Bakso malang dengan ekstra pangsit dan tahu'),
('rec-mie-yamien', NULL, 'Mie Yamien Manis/Asin', 'bakso_mie', 1.00, 1000.00, 700.00, 0, 0, 'Yamien khas dengan daging ayam cincang'),
('rec-yamien-bakso', NULL, 'Yamien Bakso', 'bakso_mie', 1.00, 1200.00, 700.00, 0, 0, 'Yamien manis dengan semangkuk bakso kuah'),
('rec-es-jeruk', NULL, 'Es Jeruk Peras', 'minuman', 1.00, 800.00, 0, 0, 0, 'Jeruk peras murni dengan es batu'),
('rec-jus-strawberry', NULL, 'Jus Strawberry Segar', 'minuman', 1.00, 800.00, 0, 0, 0, 'Jus buah strawberry segar'),
('rec-rendang-sapi', NULL, 'Rendang Sapi', 'makanan_berat', 1.00, 0, 1500.00, 0, 0, 'Daging rendang santan gurih meresap'),
('rec-ayam-bakar', '1779568926193', 'Ayam Bakar', 'makanan_berat', 1.00, 800.00, 1000.00, 0, 0, 'Ayam bakar bumbu kecap gurih'),
('rec-dendeng-sapi', NULL, 'Dendeng Sapi', 'makanan_berat', 1.00, 0, 1000.00, 0, 0, 'Dendeng sapi balado renyah'),
('rec-beef-teriyaki', NULL, 'Nasi Beef Teriyaki', 'makanan_berat', 1.00, 0, 900.00, 0, 0, 'Daging slice saus teriyaki gurih')
ON DUPLICATE KEY UPDATE 
  `menu_id` = VALUES(`menu_id`),
  `packaging_cost` = VALUES(`packaging_cost`),
  `cooking_gas_cost` = VALUES(`cooking_gas_cost`),
  `portion_yield` = VALUES(`portion_yield`);

-- ==============================================================================
-- SEEDING KOMPOSISI BAHAN RESEP (BILL OF MATERIALS)
-- ==============================================================================
INSERT INTO `hpp_recipe_ingredients` (`recipe_id`, `ingredient_id`, `subassembly_recipe_id`, `quantity`, `unit`, `notes`) VALUES
-- 1. Chicken Katsu Sub-Assembly
('rec-sub-katsu', 'ing-dada-utuh', NULL, 0.0417, 'bungkus', '1 bungkus dibagi 24 potong'),
('rec-sub-katsu', 'ing-terigu', NULL, 8.3333, 'gr', 'Tepung pelapis'),
('rec-sub-katsu', 'ing-tepung-roti', NULL, 10.4167, 'gr', 'Breadcrumbs'),
('rec-sub-katsu', 'ing-telur', NULL, 0.0417, 'butir', 'Perekat'),
('rec-sub-katsu', 'ing-minyak-goreng', NULL, 25.0000, 'ml', 'Minyak penggorengan'),

-- 2. Nasi Goreng Tanpa Telur
('rec-nasgor-polos', 'ing-beras', NULL, 200.0000, 'gr', 'Nasi matang porsi'),
('rec-nasgor-polos', 'ing-minyak-goreng', NULL, 20.0000, 'ml', 'Minyak menumis'),
('rec-nasgor-polos', 'ing-bawang-merah', NULL, 15.0000, 'gr', 'Bumbu dasar'),
('rec-nasgor-polos', 'ing-bawang-putih', NULL, 10.0000, 'gr', 'Bumbu dasar'),
('rec-nasgor-polos', 'ing-kecap-manis', NULL, 15.0000, 'ml', 'Pewarna dan perasa'),
('rec-nasgor-polos', 'ing-kerupuk', NULL, 1.0000, 'porsi', 'Pelengkap'),
('rec-nasgor-polos', 'ing-lalapan', NULL, 1.0000, 'porsi', 'Timun'),

-- 10. Nasi Bento Katsu (Memakai Katsu sebagai Sub-Assembly)
('rec-bento-katsu', 'ing-beras', NULL, 200.0000, 'gr', 'Porsi nasi'),
('rec-bento-katsu', 'ing-chicken-katsu', 'rec-sub-katsu', 1.0000, 'pcs', 'Lauk utama chicken katsu'),
('rec-bento-katsu', 'ing-sayur-campur', NULL, 50.0000, 'gr', 'Salad kol & wortel'),
('rec-bento-katsu', 'ing-mayones', NULL, 20.0000, 'gr', 'Dressing salad'),
('rec-bento-katsu', 'ing-saus-sambal', NULL, 15.0000, 'gr', 'Saus cocolan'),
('rec-bento-katsu', 'ing-minyak-goreng', NULL, 25.0000, 'ml', 'Minyak penggorengan'),

-- 12. Nasi Goreng Katsu
('rec-nasgor-katsu', 'ing-beras', NULL, 200.0000, 'gr', 'Porsi nasi'),
('rec-nasgor-katsu', 'ing-chicken-katsu', 'rec-sub-katsu', 1.0000, 'pcs', 'Topping katsu'),
('rec-nasgor-katsu', 'ing-minyak-goreng', NULL, 25.0000, 'ml', 'Minyak'),
('rec-nasgor-katsu', 'ing-bawang-merah', NULL, 15.0000, 'gr', 'Bumbu'),
('rec-nasgor-katsu', 'ing-bawang-putih', NULL, 10.0000, 'gr', 'Bumbu'),
('rec-nasgor-katsu', 'ing-kecap-manis', NULL, 15.0000, 'ml', 'Kecap'),
('rec-nasgor-katsu', 'ing-kerupuk', NULL, 1.0000, 'porsi', 'Kerupuk'),
('rec-nasgor-katsu', 'ing-lalapan', NULL, 1.0000, 'porsi', 'Lalapan'),

-- 21. Nasi Goreng Teri Medan
('rec-nasgor-teri', 'ing-beras', NULL, 200.0000, 'gr', 'Nasi'),
('rec-nasgor-teri', 'ing-teri-medan', NULL, 25.0000, 'gr', 'Teri medan goreng garing'),
('rec-nasgor-teri', 'ing-minyak-goreng', NULL, 20.0000, 'ml', 'Minyak'),
('rec-nasgor-teri', 'ing-cabe-keriting', NULL, 15.0000, 'gr', 'Cabe iris'),
('rec-nasgor-teri', 'ing-bawang-merah', NULL, 15.0000, 'gr', 'Bawang'),
('rec-nasgor-teri', 'ing-bawang-putih', NULL, 10.0000, 'gr', 'Bawang'),
('rec-nasgor-teri', 'ing-kerupuk', NULL, 1.0000, 'porsi', 'Kerupuk'),
('rec-nasgor-teri', 'ing-lalapan', NULL, 1.0000, 'porsi', 'Lalapan'),

-- 23. Nasi Goreng Telur
('rec-nasgor-telur', 'ing-beras', NULL, 200.0000, 'gr', 'Nasi'),
('rec-nasgor-telur', 'ing-telur', NULL, 1.0000, 'butir', 'Telur ayam'),
('rec-nasgor-telur', 'ing-minyak-goreng', NULL, 20.0000, 'ml', 'Minyak'),
('rec-nasgor-telur', 'ing-bawang-merah', NULL, 15.0000, 'gr', 'Bumbu'),
('rec-nasgor-telur', 'ing-bawang-putih', NULL, 10.0000, 'gr', 'Bumbu'),
('rec-nasgor-telur', 'ing-kecap-manis', NULL, 15.0000, 'ml', 'Kecap'),
('rec-nasgor-telur', 'ing-kerupuk', NULL, 1.0000, 'porsi', 'Kerupuk'),
('rec-nasgor-telur', 'ing-lalapan', NULL, 1.0000, 'porsi', 'Lalapan'),

-- 24. Kopi Gula Aren
('rec-kopi-aren', 'ing-kopi-espresso', NULL, 1.0000, 'shot', 'Espresso double extraction (18 gr)'),
('rec-kopi-aren', 'ing-susu-uht', NULL, 134.0000, 'ml', 'Fresh milk UHT'),
('rec-kopi-aren', 'ing-gula-aren', NULL, 25.0000, 'ml', 'Gula aren cair asli'),

-- 25. Americano
('rec-americano', 'ing-kopi-espresso', NULL, 1.0000, 'shot', 'Espresso double extraction'),

-- 27. Es Coklat
('rec-es-coklat', 'ing-coklat-bubuk', NULL, 1.0000, 'porsi', 'Bubuk coklat premium 30 gr'),
('rec-es-coklat', 'ing-susu-uht', NULL, 120.0000, 'ml', 'Susu UHT'),

-- 29. Es Teh Manis
('rec-es-teh', 'ing-teh-celup', NULL, 1.0000, 'kantong', 'Teh melati wangi'),
('rec-es-teh', 'ing-gula-pasir', NULL, 25.0000, 'gr', 'Gula pasir'),

-- 39. Ayam Bakar
('rec-ayam-bakar', 'ing-ayam-karkas', NULL, 1.0000, 'potong', '1/4 potong ayam karkas'),
('rec-ayam-bakar', 'ing-bumbu-padang', NULL, 15.0000, 'gr', 'Bumbu olesan bakar'),
('rec-ayam-bakar', 'ing-kecap-manis', NULL, 20.0000, 'ml', 'Kecap manis bakar'),
('rec-ayam-bakar', 'ing-lalapan', NULL, 1.0000, 'porsi', 'Lalapan timun selada');

-- ==============================================================================
-- SEEDING AWAL SALDO BUKU KAS (CASHFLOW)
-- ==============================================================================
INSERT INTO `hpp_cashflow` (`id`, `entry_date`, `type`, `description`, `total_amount`, `created_by`) VALUES
('cf-seed-modal-1', '2026-07-10', 'cash_in', 'Modal Awal Kasir & Dapur Ngolab', 500000.00, 'Owner'),
('cf-seed-modal-2', '2026-07-14', 'cash_in', 'Penambahan Modal Operasional Shift', 1000000.00, 'Owner'),
('cf-seed-belanja-1', '2026-07-10', 'cash_out', 'Belanja Bawang & Cabe Pasar', 65000.00, 'Kasir'),
('cf-seed-belanja-2', '2026-07-10', 'cash_out', 'Dada Ayam Utuh 4 Pack', 192000.00, 'Kasir'),
('cf-seed-belanja-3', '2026-07-13', 'cash_out', 'Beras RE 10kg', 155000.00, 'Kasir'),
('cf-seed-belanja-4', '2026-11-20', 'cash_out', 'Restock Fresh Milk Diamond Pasteurisasi 12L', 234000.00, 'Barista'),
('cf-seed-belanja-5', '2026-11-21', 'cash_out', 'Restock Biji Kopi House Blend 70:30 (5 kg)', 825000.00, 'Admin Ngolab'),
('cf-seed-belanja-6', '2026-11-21', 'cash_out', 'Beli Cup PP 16oz Sablon & Lid 20 Slop', 1050000.00, 'Logistik HQ')
ON DUPLICATE KEY UPDATE `total_amount` = VALUES(`total_amount`);
