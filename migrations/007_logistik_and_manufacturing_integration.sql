-- Migration 007: Integrasi Modul Logistik, Manajemen Stok & Forecasting Manufaktur
-- Database: ngola_geasture_adm (Collation: utf8mb4_general_ci)

USE `ngola_geasture_adm`;

-- 1. Tabel categories (Kategori Logistik & Bahan Baku)
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nama` VARCHAR(100) NOT NULL,
  `tipe` ENUM('Retail', 'Bahan Resep', 'Makanan', 'Minuman') NOT NULL DEFAULT 'Retail',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Tabel warehouses (Master Gudang Penyimpanan)
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode` VARCHAR(20) NOT NULL UNIQUE,
  `nama` VARCHAR(100) NOT NULL,
  `lokasi` VARCHAR(255) NOT NULL,
  `keterangan` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Tabel suppliers (Master Supplier Rekanan)
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode` VARCHAR(20) NOT NULL UNIQUE,
  `nama` VARCHAR(100) NOT NULL,
  `kontak` VARCHAR(100) NULL,
  `telepon` VARCHAR(30) NULL,
  `alamat` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Tabel items (Master Barang & Inventori Terpadu)
CREATE TABLE IF NOT EXISTS `items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sku` VARCHAR(50) NOT NULL UNIQUE,
  `barcode` VARCHAR(100) NULL UNIQUE,
  `nama` VARCHAR(150) NOT NULL,
  `category_id` INT NOT NULL,
  `satuan` VARCHAR(30) NOT NULL,
  `stok` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `min_stok` DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  `batas_kritis` DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
  `status` ENUM('aktif', 'nonaktif') DEFAULT 'aktif',
  `warehouse_id` INT NULL,
  `supplier_id` INT NULL,
  `foto` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_item_nama` (`nama`),
  INDEX `idx_item_sku` (`sku`),
  INDEX `idx_item_barcode` (`barcode`),
  CONSTRAINT `fk_items_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_items_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_items_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Tabel stock_movements (Audit Mutasi Stok Atomik)
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode_transaksi` VARCHAR(50) NOT NULL UNIQUE,
  `item_id` INT NOT NULL,
  `jenis` ENUM('Barang Masuk', 'Barang Keluar', 'Penyesuaian', 'Transfer Gudang') NOT NULL,
  `jumlah` DECIMAL(10, 2) NOT NULL,
  `stok_sebelum` DECIMAL(10, 2) NOT NULL,
  `stok_sesudah` DECIMAL(10, 2) NOT NULL,
  `warehouse_asal_id` INT NULL,
  `warehouse_tujuan_id` INT NULL,
  `metode` VARCHAR(50) DEFAULT 'Manual',
  `petugas` VARCHAR(100) NOT NULL,
  `catatan` TEXT NULL,
  `lampiran_foto` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_movements_waktu` (`created_at`),
  INDEX `idx_movements_jenis` (`jenis`),
  CONSTRAINT `fk_movement_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_movement_wh_asal` FOREIGN KEY (`warehouse_asal_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_movement_wh_tujuan` FOREIGN KEY (`warehouse_tujuan_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. Tabel logistik_menus (Katalog Menu Khusus Resep & Manufaktur Ko+Lab)
CREATE TABLE IF NOT EXISTS `logistik_menus` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode_menu` VARCHAR(50) NOT NULL UNIQUE,
  `nama_menu` VARCHAR(150) NOT NULL,
  `kategori` VARCHAR(50) NOT NULL DEFAULT 'Makanan',
  `foto` VARCHAR(255) NULL,
  `status_manual` ENUM('aktif', 'nonaktif') DEFAULT 'aktif',
  `deskripsi` TEXT NULL,
  `harga` DECIMAL(12, 2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_logistik_menu_nama` (`nama_menu`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 7. Tabel menu_ingredients (Komposisi Resep Per 1 Porsi)
CREATE TABLE IF NOT EXISTS `menu_ingredients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `menu_id` INT NOT NULL,
  `item_id` INT NOT NULL,
  `jumlah_per_porsi` DECIMAL(10, 2) NOT NULL,
  `satuan` VARCHAR(30) NOT NULL,
  CONSTRAINT `fk_recipe_menu_logistik` FOREIGN KEY (`menu_id`) REFERENCES `logistik_menus` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_recipe_item_logistik` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================================
-- SEED DATA AWAL (Idempotent: INSERT IGNORE / ON DUPLICATE KEY UPDATE)
-- ============================================================================

-- Kategori
INSERT INTO `categories` (`id`, `nama`, `tipe`) VALUES
(1, 'Bahan Resep', 'Bahan Resep'),
(2, 'Retail', 'Retail'),
(3, 'Makanan', 'Makanan'),
(4, 'Minuman', 'Minuman')
ON DUPLICATE KEY UPDATE `nama` = VALUES(`nama`);

-- Gudang
INSERT INTO `warehouses` (`id`, `kode`, `nama`, `lokasi`, `keterangan`) VALUES
(1, 'GDG-UTM', 'Gudang Utama Ko+Lab', 'Lt. 1 Gedung Logistik Pusat', 'Penyimpanan stok utama & buffer'),
(2, 'GDG-FNB', 'Dapur & Cold Storage F&B', 'Area Kitchen & Bar', 'Penyimpanan bahan segar dan olahan'),
(3, 'GDG-RTL', 'Gudang Display Retail', 'Area Retail Store', 'Penyimpanan produk display dan kemasan')
ON DUPLICATE KEY UPDATE `nama` = VALUES(`nama`);

-- Supplier
INSERT INTO `suppliers` (`id`, `kode`, `nama`, `kontak`, `telepon`, `alamat`) VALUES
(1, 'SPL-001', 'PT Berkah Segar Nusantara', 'Budi Santoso', '081234567890', 'Sentra Pasar Induk Blok A2'),
(2, 'SPL-002', 'CV Rasa Bumbu Alami', 'Dewi Lestari', '081398765432', 'Kawasan Industri Kuliner No. 12'),
(3, 'SPL-003', 'PT Retail Pack Sejahtera', 'Ahmad Ridwan', '085712344321', 'Ruko Niaga Harapan No. 8')
ON DUPLICATE KEY UPDATE `nama` = VALUES(`nama`);

-- Items (Stok Riil Bahan Baku & Retail)
INSERT INTO `items` (`id`, `sku`, `barcode`, `nama`, `category_id`, `satuan`, `stok`, `min_stok`, `batas_kritis`, `status`, `warehouse_id`, `supplier_id`) VALUES
(1, 'BRG-FNB-001', '899100100001', 'Ayam Cincang', 1, 'porsi', 80.00, 30.00, 15.00, 'aktif', 2, 1),
(2, 'BRG-FNB-002', '899100100002', 'Bakso Halus', 1, 'biji', 250.00, 80.00, 30.00, 'aktif', 2, 1),
(3, 'BRG-FNB-003', '899100100003', 'Bakso Urat', 1, 'biji', 100.00, 50.00, 20.00, 'aktif', 2, 1),
(4, 'BRG-FNB-004', '899100100004', 'Bumbu Rahasia', 1, 'gram', 5000.00, 1500.00, 500.00, 'aktif', 2, 2),
(5, 'BRG-FNB-005', '899100100005', 'Mie Basah', 1, 'porsi', 100.00, 40.00, 20.00, 'aktif', 2, 1),
(6, 'BRG-FNB-006', '899100100006', 'Pangsit Goreng', 1, 'biji', 150.00, 60.00, 25.00, 'aktif', 2, 1),
(7, 'BRG-RTL-001', '899200200001', 'Tumbler Ko+Lab Stainless 500ml', 2, 'pcs', 35.00, 15.00, 5.00, 'aktif', 3, 3),
(8, 'BRG-RTL-002', '899200200002', 'Kaos Polo Merchandise Ko+Lab (L)', 2, 'pcs', 18.00, 10.00, 4.00, 'aktif', 3, 3),
(9, 'BRG-BEV-001', '899300300001', 'Kopi Susu Gula Aren Botol 250ml', 4, 'botol', 45.00, 20.00, 10.00, 'aktif', 2, 2)
ON DUPLICATE KEY UPDATE `stok` = VALUES(`stok`);

-- Mutasi Awal
INSERT INTO `stock_movements` (`id`, `kode_transaksi`, `item_id`, `jenis`, `jumlah`, `stok_sebelum`, `stok_sesudah`, `warehouse_asal_id`, `warehouse_tujuan_id`, `metode`, `petugas`, `catatan`, `created_at`) VALUES
(1, 'TRX-INIT-001', 1, 'Barang Masuk', 80.00, 0.00, 80.00, NULL, 2, 'Scan Barcode', 'Admin Ko+Lab', 'Stok awal batch penerimaan segar', NOW() - INTERVAL 2 DAY),
(2, 'TRX-INIT-002', 2, 'Barang Masuk', 250.00, 0.00, 250.00, NULL, 2, 'Manual', 'Admin Ko+Lab', 'Penerimaan supplier PT Berkah', NOW() - INTERVAL 2 DAY),
(3, 'TRX-INIT-003', 4, 'Barang Masuk', 5000.00, 0.00, 5000.00, NULL, 2, 'Manual', 'Staff Logistik', 'Restock bumbu dapur pusat', NOW() - INTERVAL 1 DAY),
(4, 'TRX-INIT-004', 5, 'Barang Masuk', 100.00, 0.00, 100.00, NULL, 2, 'Scan Barcode', 'Staff Logistik', 'Penerimaan mie basah harian', NOW() - INTERVAL 1 DAY)
ON DUPLICATE KEY UPDATE `kode_transaksi` = VALUES(`kode_transaksi`);

-- Menu Resep Manufaktur
INSERT INTO `logistik_menus` (`id`, `kode_menu`, `nama_menu`, `kategori`, `status_manual`, `deskripsi`, `harga`) VALUES
(1, 'MN-001', 'Mie Ayam Ko+Lab Komplit', 'Makanan', 'aktif', 'Mie basah kenyal dengan topping ayam cincang gurih, 2 bakso halus, 1 bakso urat, dan pangsit goreng renyah.', 32000.00),
(2, 'MN-002', 'Bakso Kuah Spesial Ko+Lab', 'Makanan', 'aktif', 'Semangkuk bakso kuah lezat berisi 4 bakso halus dan 2 bakso urat pilihan disiram kuah bumbu rahasia.', 28000.00),
(3, 'MN-003', 'Kopi Susu Aren Ko+Lab', 'Minuman', 'aktif', 'Kopi susu segar dingin siap minum kemasan botol higienis.', 18000.00)
ON DUPLICATE KEY UPDATE `nama_menu` = VALUES(`nama_menu`);

-- Resep Komposisi Per 1 Porsi:
-- Mie Ayam Ko+Lab Komplit:
-- Mie Basah 1 porsi, Ayam Cincang 1 porsi, Bakso Halus 2 biji, Bakso Urat 1 biji, Bumbu Rahasia 25 gram, Pangsit Goreng 1 biji
INSERT INTO `menu_ingredients` (`id`, `menu_id`, `item_id`, `jumlah_per_porsi`, `satuan`) VALUES
(1, 1, 5, 1.00, 'porsi'),
(2, 1, 1, 1.00, 'porsi'),
(3, 1, 2, 2.00, 'biji'),
(4, 1, 3, 1.00, 'biji'),
(5, 1, 4, 25.00, 'gram'),
(6, 1, 6, 1.00, 'biji'),
-- Bakso Kuah Spesial Ko+Lab:
-- Bakso Halus 4 biji, Bakso Urat 2 biji, Bumbu Rahasia 30 gram
(7, 2, 2, 4.00, 'biji'),
(8, 2, 3, 2.00, 'biji'),
(9, 2, 4, 30.00, 'gram'),
-- Kopi Susu Aren Ko+Lab:
(10, 3, 9, 1.00, 'botol')
ON DUPLICATE KEY UPDATE `jumlah_per_porsi` = VALUES(`jumlah_per_porsi`);
