-- Migrasi Kompatibilitas Database Logistik Terpusat
-- Memastikan jika ada konfigurasi hosting/Kroombox yang merujuk database 'ngola_logistik',
-- tabel/view otomatis terhubung ke database utama 'ngola_geasture_adm'

CREATE DATABASE IF NOT EXISTS `ngola_logistik` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW `ngola_logistik`.`staff` AS 
SELECT * FROM `ngola_geasture_adm`.`staff`;

CREATE OR REPLACE VIEW `ngola_logistik`.`users` AS 
SELECT * FROM `ngola_geasture_adm`.`users`;

CREATE OR REPLACE VIEW `ngola_logistik`.`items` AS 
SELECT * FROM `ngola_geasture_adm`.`items`;

CREATE OR REPLACE VIEW `ngola_logistik`.`categories` AS 
SELECT * FROM `ngola_geasture_adm`.`categories`;

CREATE OR REPLACE VIEW `ngola_logistik`.`warehouses` AS 
SELECT * FROM `ngola_geasture_adm`.`warehouses`;

CREATE OR REPLACE VIEW `ngola_logistik`.`suppliers` AS 
SELECT * FROM `ngola_geasture_adm`.`suppliers`;

CREATE OR REPLACE VIEW `ngola_logistik`.`stock_movements` AS 
SELECT * FROM `ngola_geasture_adm`.`stock_movements`;

CREATE OR REPLACE VIEW `ngola_logistik`.`menus` AS 
SELECT * FROM `ngola_geasture_adm`.`logistik_menus`;

CREATE OR REPLACE VIEW `ngola_logistik`.`menu_ingredients` AS 
SELECT * FROM `ngola_geasture_adm`.`menu_ingredients`;
