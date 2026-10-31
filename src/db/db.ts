import 'dotenv/config';
import mysql from "mysql2/promise";
import { loyaltySchemaChanges } from "../lib/loyaltyHelper.js";
import { orderItemSchemaChanges } from "../lib/orderItems.js";

// MySQL Connection Pool untuk Papan Digital
export const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ngola_geasture_adm",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+07:00", // WIB
});

// Test koneksi saat startup
export async function testDbConnection() {
  let connection: any;
  try {
    connection = await db.getConnection();
    console.log("✅ MySQL terhubung ke database:", process.env.DB_NAME || "ngola_geasture_adm");
    
    // Migration: Add columns to coin_promos if they don't exist
    try {
      const [columns]: any = await connection.query("SHOW COLUMNS FROM coin_promos");
      const hasPromoCode = columns.some((c: any) => c.Field === "promo_code");
      const hasLimitPerUser = columns.some((c: any) => c.Field === "limit_per_user");
      
      if (!hasPromoCode) {
        await connection.query("ALTER TABLE coin_promos ADD COLUMN promo_code VARCHAR(100) UNIQUE DEFAULT NULL");
        console.log("✅ Added column 'promo_code' to 'coin_promos'");
      }
      if (!hasLimitPerUser) {
        await connection.query("ALTER TABLE coin_promos ADD COLUMN limit_per_user INT NOT NULL DEFAULT 1");
        console.log("✅ Added column 'limit_per_user' to 'coin_promos'");
      }
    } catch (migErr: any) {
      console.warn("⚠️ Migration warning:", migErr.message);
    }

    // Migration: Add columns to users if they don't exist
    try {
      const [columns]: any = await connection.query("SHOW COLUMNS FROM users");
      const hasEmail = columns.some((c: any) => c.Field === "email");
      const hasPhone = columns.some((c: any) => c.Field === "phone");
      const hasRole = columns.some((c: any) => c.Field === "role");
      const hasPasswordHash = columns.some((c: any) => c.Field === "password_hash");

      if (!hasEmail) {
        await connection.query("ALTER TABLE users ADD COLUMN email VARCHAR(150) DEFAULT NULL");
        console.log("✅ Added column 'email' to 'users'");
      }
      if (!hasPhone) {
        await connection.query("ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT NULL");
        console.log("✅ Added column 'phone' to 'users'");
      }
      if (!hasRole) {
        await connection.query("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'Pelanggan'");
        console.log("✅ Added column 'role' to 'users'");
      }
      if (!hasPasswordHash) {
        await connection.query("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL");
        console.log("✅ Added column 'password_hash' to 'users'");
      }
      const [duplicateEmails]: any = await connection.query(`
        SELECT LOWER(TRIM(email)) AS normalized_email, COUNT(*) AS total
        FROM users
        WHERE email IS NOT NULL AND TRIM(email) != ''
        GROUP BY LOWER(TRIM(email))
        HAVING COUNT(*) > 1
      `);
      if (duplicateEmails.length > 0) {
        throw new Error(`Duplicate customer emails must be resolved before migration: ${duplicateEmails.map((row: any) => row.normalized_email).join(', ')}`);
      }
      await connection.query("UPDATE users SET email = NULL WHERE email IS NOT NULL AND TRIM(email) = ''");
      await connection.query("UPDATE users SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL");

      const [invalidStaffEmails]: any = await connection.query("SELECT id FROM staff WHERE email IS NULL OR TRIM(email) = '' LIMIT 1");
      if (invalidStaffEmails.length > 0) {
        throw new Error('Staff with an empty email must be resolved before migration');
      }
      const [duplicateStaffEmails]: any = await connection.query(`
        SELECT LOWER(TRIM(email)) AS normalized_email, COUNT(*) AS total
        FROM staff
        GROUP BY LOWER(TRIM(email))
        HAVING COUNT(*) > 1
      `);
      if (duplicateStaffEmails.length > 0) {
        throw new Error(`Duplicate staff emails must be resolved before migration: ${duplicateStaffEmails.map((row: any) => row.normalized_email).join(', ')}`);
      }
      await connection.query("UPDATE staff SET email = LOWER(TRIM(email))");

      const [crossTableCollisions]: any = await connection.query(`
        SELECT u.email
        FROM users u
        JOIN staff s ON s.email = u.email
        WHERE u.email IS NOT NULL
        LIMIT 1
      `);
      if (crossTableCollisions.length > 0) {
        throw new Error(`Email is shared by customer and staff: ${crossTableCollisions[0].email}`);
      }

      const [emailIndexes]: any = await connection.query("SHOW INDEX FROM users WHERE Column_name = 'email' AND Non_unique = 0");
      if (emailIndexes.length === 0) {
        await connection.query("ALTER TABLE users ADD UNIQUE INDEX uniq_users_email (email)");
        console.log("✅ Added unique index 'uniq_users_email' to 'users'");
      }
    } catch (migErr: any) {
      console.warn("⚠️ Users Migration warning:", migErr.message);
      throw migErr;
    }

    // Migration: Pre-order campaigns, items, and order snapshots
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS preorder_campaigns (
          id VARCHAR(50) NOT NULL,
          name VARCHAR(200) NOT NULL,
          description TEXT DEFAULT NULL,
          outlet ENUM('ngolab', 'coworking') NOT NULL,
          order_start_at DATETIME NOT NULL,
          order_deadline_at DATETIME NOT NULL,
          service_at DATETIME NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_preorder_window (outlet, is_active, order_start_at, order_deadline_at),
          INDEX idx_preorder_service (service_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS preorder_items (
          id VARCHAR(50) NOT NULL,
          campaign_id VARCHAR(50) NOT NULL,
          name VARCHAR(200) NOT NULL,
          category VARCHAR(100) NOT NULL DEFAULT 'PO',
          price INT NOT NULL,
          quota_total INT NOT NULL,
          quota_sold INT NOT NULL DEFAULT 0,
          image_url VARCHAR(500) DEFAULT NULL,
          description TEXT DEFAULT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_preorder_items_campaign (campaign_id, is_active),
          CONSTRAINT fk_preorder_items_campaign FOREIGN KEY (campaign_id) REFERENCES preorder_campaigns(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      const [campaignColumns]: any = await connection.query("SHOW COLUMNS FROM preorder_campaigns");
      if (!campaignColumns.some((column: any) => column.Field === 'kds_released_at')) {
        await connection.query("ALTER TABLE preorder_campaigns ADD COLUMN kds_released_at DATETIME DEFAULT NULL AFTER is_active");
      }

      const [orderColumns]: any = await connection.query("SHOW COLUMNS FROM orders");
      const orderFields = new Set(orderColumns.map((column: any) => column.Field));
      const statusColumn = orderColumns.find((column: any) => column.Field === 'status');
      if (String(statusColumn?.Type || '').toLowerCase().startsWith('enum(')) {
        // Legacy schema contains case-insensitive duplicate ENUM values such as
        // 'Menunggu' and 'menunggu'. MySQL rejects every later ALTER TABLE until
        // the status column is normalized to a regular string column.
        await connection.query("ALTER TABLE orders MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'Menunggu'");
      }
      if (!orderFields.has('outlet')) await connection.query("ALTER TABLE orders ADD COLUMN outlet VARCHAR(50) NOT NULL DEFAULT 'ngolab' AFTER source");
      if (!orderFields.has('order_type')) {
        await connection.query("ALTER TABLE orders ADD COLUMN order_type VARCHAR(30) NOT NULL DEFAULT 'regular' AFTER outlet");
      } else {
        await connection.query("UPDATE orders SET order_type = 'regular' WHERE order_type IS NULL OR LOWER(order_type) NOT IN ('regular', 'preorder')");
        const orderTypeColumn = orderColumns.find((column: any) => column.Field === 'order_type');
        if (orderTypeColumn.Null !== 'NO' || orderTypeColumn.Default !== 'regular') {
          await connection.query("ALTER TABLE orders MODIFY COLUMN order_type VARCHAR(30) NOT NULL DEFAULT 'regular'");
        }
      }
      if (!orderFields.has('preorder_campaign_id')) await connection.query("ALTER TABLE orders ADD COLUMN preorder_campaign_id VARCHAR(50) DEFAULT NULL AFTER order_type");
      if (!orderFields.has('payment_timing')) await connection.query("ALTER TABLE orders ADD COLUMN payment_timing VARCHAR(30) DEFAULT NULL AFTER preorder_campaign_id");
      if (!orderFields.has('fulfillment_at')) await connection.query("ALTER TABLE orders ADD COLUMN fulfillment_at DATETIME DEFAULT NULL AFTER payment_timing");
      if (!orderFields.has('preorder_status')) await connection.query("ALTER TABLE orders ADD COLUMN preorder_status VARCHAR(30) DEFAULT NULL AFTER fulfillment_at");
      if (!orderFields.has('picked_up_at')) await connection.query("ALTER TABLE orders ADD COLUMN picked_up_at DATETIME DEFAULT NULL AFTER preorder_status");
      if (!orderFields.has('customer_phone')) await connection.query("ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(50) DEFAULT NULL AFTER customer_name");
      if (!orderFields.has('external_api_client_id')) await connection.query("ALTER TABLE orders ADD COLUMN external_api_client_id VARCHAR(100) DEFAULT NULL AFTER source");
      if (!orderFields.has('payment_proof')) await connection.query("ALTER TABLE orders ADD COLUMN payment_proof VARCHAR(500) DEFAULT NULL AFTER payment_method");
      if (!orderFields.has('payment_proof_url')) await connection.query("ALTER TABLE orders ADD COLUMN payment_proof_url VARCHAR(500) DEFAULT NULL AFTER payment_proof");
      if (!orderFields.has('payment_proof_uploaded_at')) await connection.query("ALTER TABLE orders ADD COLUMN payment_proof_uploaded_at DATETIME DEFAULT NULL AFTER payment_proof_url");
      // Pencarian referensi bukti pembayaran terjadi pada setiap permintaan gambar; tanpa indeks
      // kueri dua-kolom selalu memindai seluruh tabel orders.
      const [orderIndexes]: any = await connection.query("SHOW INDEX FROM orders");
      const orderIndexNames = new Set(orderIndexes.map((index: any) => String(index.Key_name)));
      if (!orderIndexNames.has('idx_orders_payment_proof_url')) {
        await connection.query("ALTER TABLE orders ADD INDEX idx_orders_payment_proof_url (payment_proof_url)");
      }
      if (!orderIndexNames.has('idx_orders_payment_proof')) {
        await connection.query("ALTER TABLE orders ADD INDEX idx_orders_payment_proof (payment_proof)");
      }
      if (!orderIndexNames.has('idx_orders_external_api_client')) {
        await connection.query("ALTER TABLE orders ADD INDEX idx_orders_external_api_client (external_api_client_id)");
      }
      await connection.query("UPDATE orders SET preorder_status = 'reserved' WHERE order_type = 'preorder' AND preorder_status IS NULL");
      await connection.query("UPDATE orders SET outlet = 'coworking' WHERE source = 'coworking'");

      const [itemColumns]: any = await connection.query("SHOW COLUMNS FROM order_items");
      for (const statement of orderItemSchemaChanges(itemColumns)) {
        await connection.query(statement);
      }
      if (!itemColumns.some((column: any) => column.Field === 'preorder_item_id')) {
        await connection.query("ALTER TABLE order_items ADD COLUMN preorder_item_id VARCHAR(50) DEFAULT NULL");
      }

      const [coinColumns]: any = await connection.query("SHOW COLUMNS FROM coin_transactions");
      const [coinIndexes]: any = await connection.query("SHOW INDEX FROM coin_transactions");
      for (const statement of loyaltySchemaChanges(coinColumns, coinIndexes)) {
        await connection.query(statement);
      }
      console.log("✅ Order item compatibility, loyalty idempotency, and pre-order schema verified/created");
    } catch (preorderErr: any) {
      console.warn("⚠️ Pre-order migration failed:", preorderErr.message);
      throw preorderErr;
    }

    // Migration: Separate menu master, manual override, and inventory availability.
    try {
      const [menuColumns]: any = await connection.query("SHOW COLUMNS FROM menus");
      const menuFields = new Set(menuColumns.map((column: any) => column.Field));
      if (!menuFields.has('is_active')) await connection.query("ALTER TABLE menus ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER in_stock");
      if (!menuFields.has('inventory_available')) await connection.query("ALTER TABLE menus ADD COLUMN inventory_available TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active");
      if (!menuFields.has('availability_override')) await connection.query("ALTER TABLE menus ADD COLUMN availability_override VARCHAR(20) NOT NULL DEFAULT 'auto' AFTER inventory_available");
      if (!menuFields.has('availability_reason')) await connection.query("ALTER TABLE menus ADD COLUMN availability_reason VARCHAR(255) DEFAULT NULL AFTER availability_override");
      if (!menuFields.has('availability_updated_by')) await connection.query("ALTER TABLE menus ADD COLUMN availability_updated_by VARCHAR(100) DEFAULT NULL AFTER availability_reason");
      if (!menuFields.has('availability_updated_at')) await connection.query("ALTER TABLE menus ADD COLUMN availability_updated_at DATETIME DEFAULT NULL AFTER availability_updated_by");
      if (!menuFields.has('inventory_available')) await connection.query('UPDATE menus SET inventory_available = in_stock');
      await connection.query("UPDATE menus SET availability_override = 'auto' WHERE availability_override NOT IN ('auto', 'force_off') OR availability_override IS NULL");
      await connection.query("UPDATE menus SET in_stock = IF(is_active = 1 AND availability_override = 'auto' AND inventory_available = 1, 1, 0)");
      await connection.query("UPDATE menus SET category = 'Menu Coworking' WHERE outlet = 'coworking' AND category = 'Makanan Ringan'");
      console.log("✅ Menu availability schema verified/created");
    } catch (menuAvailabilityError: any) {
      console.warn("⚠️ Menu availability migration failed:", menuAvailabilityError.message);
      throw menuAvailabilityError;
    }

    // Migration: Persistent ingredient inventory and recipe requirements
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS ingredients (
          id VARCHAR(50) NOT NULL,
          name VARCHAR(150) NOT NULL,
          unit VARCHAR(50) NOT NULL,
          stock DECIMAL(12,2) NOT NULL DEFAULT 0,
          min_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      const [inventoryColumns]: any = await connection.query("SHOW COLUMNS FROM ingredients");
      const inventoryFields = new Set(inventoryColumns.map((column: any) => column.Field));
      const inventoryMigrations = [
        ['inventory_type', "ALTER TABLE ingredients ADD COLUMN inventory_type VARCHAR(30) NOT NULL DEFAULT 'raw_material' AFTER name"],
        ['sku', "ALTER TABLE ingredients ADD COLUMN sku VARCHAR(100) DEFAULT NULL AFTER inventory_type"],
        ['barcode', "ALTER TABLE ingredients ADD COLUMN barcode VARCHAR(100) DEFAULT NULL AFTER sku"],
        ['category', "ALTER TABLE ingredients ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'Bahan Baku' AFTER barcode"],
        ['purchase_unit', "ALTER TABLE ingredients ADD COLUMN purchase_unit VARCHAR(50) DEFAULT NULL AFTER unit"],
        ['purchase_conversion', "ALTER TABLE ingredients ADD COLUMN purchase_conversion DECIMAL(12,3) NOT NULL DEFAULT 1 AFTER purchase_unit"],
        ['critical_stock', "ALTER TABLE ingredients ADD COLUMN critical_stock DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER min_stock"],
        ['cost_price', "ALTER TABLE ingredients ADD COLUMN cost_price DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER critical_stock"],
        ['supplier', "ALTER TABLE ingredients ADD COLUMN supplier VARCHAR(150) DEFAULT NULL AFTER cost_price"],
        ['outlet', "ALTER TABLE ingredients ADD COLUMN outlet VARCHAR(50) NOT NULL DEFAULT 'ngolab' AFTER supplier"],
        ['is_active', "ALTER TABLE ingredients ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER outlet"]
      ];
      for (const [field, sql] of inventoryMigrations) {
        if (!inventoryFields.has(field)) await connection.query(sql);
      }
      await connection.query("UPDATE ingredients SET critical_stock = GREATEST(1, FLOOR(min_stock * 0.3)) WHERE critical_stock = 0 AND min_stock > 0");
      const [barcodeIndexes]: any = await connection.query("SHOW INDEX FROM ingredients WHERE Key_name = 'uniq_inventory_barcode_outlet'");
      if (!barcodeIndexes.length) {
        await connection.query("ALTER TABLE ingredients ADD UNIQUE INDEX uniq_inventory_barcode_outlet (barcode, outlet)");
      }
      const [skuIndexes]: any = await connection.query("SHOW INDEX FROM ingredients WHERE Key_name = 'uniq_inventory_sku_outlet'");
      if (!skuIndexes.length) {
        await connection.query("ALTER TABLE ingredients ADD UNIQUE INDEX uniq_inventory_sku_outlet (sku, outlet)");
      }

      await connection.query(`
        CREATE TABLE IF NOT EXISTS inventory_movements (
          id BIGINT NOT NULL AUTO_INCREMENT,
          ingredient_id VARCHAR(50) NOT NULL,
          outlet VARCHAR(50) NOT NULL DEFAULT 'ngolab',
          movement_type VARCHAR(30) NOT NULL,
          quantity DECIMAL(12,2) NOT NULL,
          stock_before DECIMAL(12,2) NOT NULL,
          stock_after DECIMAL(12,2) NOT NULL,
          input_method VARCHAR(30) NOT NULL DEFAULT 'manual',
          reference_type VARCHAR(50) DEFAULT NULL,
          reference_id VARCHAR(100) DEFAULT NULL,
          purchase_unit VARCHAR(50) DEFAULT NULL,
          purchase_quantity DECIMAL(12,2) DEFAULT NULL,
          unit_cost DECIMAL(14,2) DEFAULT NULL,
          supplier VARCHAR(150) DEFAULT NULL,
          batch_number VARCHAR(100) DEFAULT NULL,
          expires_at DATE DEFAULT NULL,
          notes VARCHAR(500) DEFAULT NULL,
          actor_id VARCHAR(50) DEFAULT NULL,
          actor_name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_inventory_movements_item (ingredient_id, created_at),
          INDEX idx_inventory_movements_reference (reference_type, reference_id),
          INDEX idx_inventory_movements_outlet (outlet, created_at),
          CONSTRAINT fk_inventory_movements_item FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
          menu_name VARCHAR(200) NOT NULL,
          outlet VARCHAR(50) NOT NULL DEFAULT 'ngolab',
          ingredient_id VARCHAR(50) NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          PRIMARY KEY (menu_name, outlet, ingredient_id),
          FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      const [recipeColumns]: any = await connection.query('SHOW COLUMNS FROM recipe_ingredients');
      if (!recipeColumns.some((column: any) => column.Field === 'outlet')) {
        await connection.query("ALTER TABLE recipe_ingredients ADD COLUMN outlet VARCHAR(50) NOT NULL DEFAULT 'ngolab' AFTER menu_name");
        await connection.query("ALTER TABLE recipe_ingredients DROP PRIMARY KEY, ADD PRIMARY KEY (menu_name, outlet, ingredient_id)");
      }

      const ingredientSeeds = [
        ['ing-1', 'Mie Basah', 'Porsi', 100, 20],
        ['ing-2', 'Ayam Cincang', 'Porsi', 80, 15],
        ['ing-3', 'Bakso Halus', 'Biji', 250, 50],
        ['ing-4', 'Bakso Urat', 'Biji', 100, 20],
        ['ing-5', 'Pangsit Goreng', 'Biji', 150, 30],
        ['ing-6', 'Siomay', 'Biji', 120, 20],
        ['ing-7', 'Sawi Hijau', 'Porsi', 100, 15],
        ['ing-8', 'Bumbu Rahasia', 'Gram', 5000, 500],
      ];
      for (const seed of ingredientSeeds) {
        await connection.query(
          "INSERT IGNORE INTO ingredients (id, name, unit, stock, min_stock) VALUES (?, ?, ?, ?, ?)",
          seed
        );
      }

      const recipeSeeds = [
        ['Mie Yamin Spesial Ayam', 'ing-1', 1], ['Mie Yamin Spesial Ayam', 'ing-2', 1],
        ['Mie Yamin Spesial Ayam', 'ing-7', 1], ['Mie Yamin Spesial Ayam', 'ing-8', 50],
        ['Mie Bakso Urat Super', 'ing-1', 1], ['Mie Bakso Urat Super', 'ing-3', 2],
        ['Mie Bakso Urat Super', 'ing-4', 1], ['Mie Bakso Urat Super', 'ing-7', 1],
        ['Mie Bakso Urat Super', 'ing-8', 40], ['Bakso Malang Komplit Ibu Sri', 'ing-3', 3],
        ['Bakso Malang Komplit Ibu Sri', 'ing-5', 2], ['Bakso Malang Komplit Ibu Sri', 'ing-6', 1],
        ['Bakso Malang Komplit Ibu Sri', 'ing-1', 0.5], ['Bakso Malang Komplit Ibu Sri', 'ing-8', 30],
        ['Nasi Ayam Geprek Level 3', 'ing-8', 20], ['Siomay Bandung Asli', 'ing-6', 5],
        ['Batagor Ikan Bandung', 'ing-6', 3], ['Batagor Ikan Bandung', 'ing-5', 2],
      ];
      for (const seed of recipeSeeds) {
        await connection.query(
          "INSERT IGNORE INTO recipe_ingredients (menu_name, outlet, ingredient_id, amount) VALUES (?, 'ngolab', ?, ?)",
          seed
        );
      }
      console.log("✅ Ingredient inventory verified/seeded");
    } catch (ingredientErr: any) {
      console.warn("⚠️ Ingredient migration warning:", ingredientErr.message);
      throw ingredientErr;
    }

    // Migration: Create shifts table
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`shifts\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`staff_id\` VARCHAR(50) NOT NULL,
          \`shift_type\` VARCHAR(50) NOT NULL,
          \`time\` VARCHAR(100) NOT NULL,
          \`date\` DATE NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          FOREIGN KEY (\`staff_id\`) REFERENCES \`staff\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("✅ Table 'shifts' verified/created");
    } catch (shiftErr: any) {
      console.warn("⚠️ Shifts Table migration warning:", shiftErr.message);
    }

    // Migration: Create audit_logs table
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`audit_logs\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`user\` VARCHAR(100) NOT NULL,
          \`action\` VARCHAR(100) NOT NULL,
          \`target\` VARCHAR(255) NOT NULL,
          \`timestamp\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`status\` ENUM('success', 'warning', 'info') NOT NULL DEFAULT 'success',
          \`ip\` VARCHAR(50) DEFAULT NULL,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("✅ Table 'audit_logs' verified/created");
    } catch (auditErr: any) {
      console.warn("⚠️ Audit Logs Table migration warning:", auditErr.message);
    }

    // Migration: API keys for external integrations. Raw secrets are never stored.
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id BIGINT NOT NULL AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL,
          key_prefix VARCHAR(32) NOT NULL,
          key_hash CHAR(64) NOT NULL,
          scopes JSON NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_by VARCHAR(50) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_used_at DATETIME DEFAULT NULL,
          revoked_at DATETIME DEFAULT NULL,
          PRIMARY KEY (id),
          UNIQUE INDEX uniq_api_keys_hash (key_hash),
          INDEX idx_api_keys_active (is_active, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log("✅ API key schema verified/created");
    } catch (apiKeyErr: any) {
      console.warn("⚠️ API Key migration failed:", apiKeyErr.message);
      throw apiKeyErr;
    }

    // Migration: Create staff table extras (kolom password_plain untuk Super Admin)
    try {
      const [plainColumn]: any = await connection.query(
        "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'password_plain'"
      );
      if (Number(plainColumn[0]?.total || 0) === 0) {
        await connection.query("ALTER TABLE staff ADD COLUMN password_plain VARCHAR(100) DEFAULT NULL AFTER password_hash");
      }
      console.log("✅ Staff password_plain column verified/created");
    } catch (staffColumnErr: any) {
      console.warn("⚠️ Staff password_plain migration warning:", staffColumnErr.message);
    }

    // Migration: kolom password_plain untuk pelanggan (users), dibaca hanya oleh
    // requireUserAdmin (Super Admin/Kasir/Support) di halaman Database Pengguna.
    try {
      const [customerPlainColumn]: any = await connection.query(
        "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_plain'"
      );
      if (Number(customerPlainColumn[0]?.total || 0) === 0) {
        await connection.query("ALTER TABLE users ADD COLUMN password_plain VARCHAR(100) DEFAULT NULL AFTER password_hash");
      }
      console.log("✅ Users password_plain column verified/created");
    } catch (customerColumnErr: any) {
      console.warn("⚠️ Users password_plain migration warning:", customerColumnErr.message);
    }

    // Migration: Create app_settings table
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`app_settings\` (
          \`key\` VARCHAR(100) NOT NULL,
          \`value\` TEXT DEFAULT NULL,
          PRIMARY KEY (\`key\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("✅ Table 'app_settings' verified/created");

      // Seed default/missing values
      const defaults = [
        ['brand_name', 'GeastEats'],
        ['brand_subtitle', 'Admin Panel'],
        ['brand_logo_url', ''],
        ['active_zone', '60'],
        ['dwell_time', '1.5'],
        ['kiosk_idle_timeout', '60'],
        ['kiosk_mode', 'gesture'],
        ['kds_sound_enabled', '1'],
        ['kds_sound_volume', '100'],
        ['kds_new_order_sound_url', ''],
        ['kds_ready_sound_url', ''],
        ['receipt_footer', 'Terima kasih atas kunjungan Anda!'],
        ['maintenance_mode', '0'],
        ['theme_color', '#4f46e5'],
        ['theme_mode', 'light'],
        ['sidebar_bg_color', '#ffffff'],
        ['sidebar_text_color', '#64748b'],
        ['sidebar_active_bg_color', '#f0f2fe'],
        ['sidebar_active_text_color', '#4f46e5'],
        ['sidebar_border_color', '#f1f5f9'],
        ['sidebar_hover_bg_color', '#f8fafc'],
        ['sidebar_hover_text_color', '#0f172a'],
        ['sidebar_logo_text_color', '#0f172a'],
        ['sidebar_section_text_color', '#94a3b8'],
        ['coin_reward_rate', '0.001']
      ];
      for (const [k, v] of defaults) {
        await connection.query(
          "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `key` = `key`",
          [k, v]
        );
      }
      console.log("✅ Seeded default/missing settings to 'app_settings'");
    } catch (settingErr: any) {
      console.warn("⚠️ App Settings Table migration warning:", settingErr.message);
    }

    // Migration: Create study_sessions table
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`study_sessions\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\` VARCHAR(50) NOT NULL,
          \`subject\` VARCHAR(255) NOT NULL,
          \`duration_minutes\` INT NOT NULL,
          \`points_earned\` INT NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("✅ Table 'study_sessions' verified/created");
    } catch (err: any) {
      console.warn("⚠️ Study Sessions Table migration warning:", err.message);
    }

    // Migration: Create patungan_rooms table
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`patungan_rooms\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`title\` VARCHAR(255) NOT NULL,
          \`target_amount\` INT NOT NULL,
          \`current_amount\` INT NOT NULL DEFAULT 0,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("✅ Table 'patungan_rooms' verified/created");

      // Seed default rooms if empty
      const [rooms]: any = await connection.query("SELECT COUNT(*) as count FROM patungan_rooms");
      if (rooms[0].count === 0) {
        await connection.query(`
          INSERT INTO patungan_rooms (id, title, target_amount, current_amount) VALUES 
          ('room-1', 'Patungan Buku Perpustakaan Baru', 50000, 0),
          ('room-2', 'Sumbangan Wi-Fi Coworking Space', 100000, 0),
          ('room-3', 'Donasi Event Himpunan Mahasiswa', 150000, 0)
        `);
        console.log("✅ Seeded default crowdfunding rooms");
      }
    } catch (err: any) {
      console.warn("⚠️ Patungan Rooms Table migration warning:", err.message);
    }

    // Migration: Create patungan_contributions table
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`patungan_contributions\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`room_id\` VARCHAR(50) NOT NULL,
          \`user_id\` VARCHAR(50) NOT NULL,
          \`amount\` INT NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (\`room_id\`) REFERENCES \`patungan_rooms\`(\`id\`) ON DELETE CASCADE,
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("✅ Table 'patungan_contributions' verified/created");
    } catch (err: any) {
      console.warn("⚠️ Patungan Contributions Table migration warning:", err.message);
    }

    // Migration: Membership & Loyalty Upgrade (Periods, Tiers, Members, Identifiers, Accounts, Transactions, Histories, Rewards, Redemptions)
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`loyalty_periods\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`code\` VARCHAR(50) NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`start_date\` DATETIME NOT NULL,
          \`end_date\` DATETIME NOT NULL,
          \`status\` ENUM('UPCOMING', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'UPCOMING',
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_loyalty_periods_code\` (\`code\`),
          KEY \`idx_loyalty_periods_status\` (\`status\`),
          KEY \`idx_loyalty_periods_dates\` (\`start_date\`, \`end_date\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`member_tiers\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`code\` VARCHAR(50) NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`min_spending\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          \`max_spending\` DECIMAL(12,2) DEFAULT NULL,
          \`benefit_description\` TEXT DEFAULT NULL,
          \`multiplier\` DECIMAL(4,2) NOT NULL DEFAULT 1.00,
          \`status\` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_member_tiers_code\` (\`code\`),
          KEY \`idx_member_tiers_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`members\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`user_id\` VARCHAR(50) NOT NULL,
          \`member_code\` VARCHAR(50) NOT NULL,
          \`member_type\` ENUM('STUDENT', 'LECTURER', 'GENERAL') NOT NULL DEFAULT 'GENERAL',
          \`current_tier_id\` VARCHAR(50) DEFAULT NULL,
          \`status\` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
          \`joined_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_members_user_id\` (\`user_id\`),
          UNIQUE KEY \`uq_members_member_code\` (\`member_code\`),
          KEY \`idx_members_current_tier_id\` (\`current_tier_id\`),
          KEY \`idx_members_status\` (\`status\`),
          CONSTRAINT \`fk_members_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT,
          CONSTRAINT \`fk_members_tier_id\` FOREIGN KEY (\`current_tier_id\`) REFERENCES \`member_tiers\` (\`id\`) ON UPDATE CASCADE ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`member_identifiers\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`member_id\` VARCHAR(50) NOT NULL,
          \`identifier_type\` ENUM('STUDENT_NIM', 'LECTURER_NIP', 'EMAIL', 'PHONE') NOT NULL,
          \`identifier_value\` VARCHAR(150) NOT NULL,
          \`is_primary\` TINYINT(1) NOT NULL DEFAULT 1,
          \`is_verified\` TINYINT(1) NOT NULL DEFAULT 0,
          \`verified_at\` DATETIME DEFAULT NULL,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_member_identifiers_type_value\` (\`identifier_type\`, \`identifier_value\`),
          KEY \`idx_member_identifiers_member_id\` (\`member_id\`),
          CONSTRAINT \`fk_member_identifiers_member_id\` FOREIGN KEY (\`member_id\`) REFERENCES \`members\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`loyalty_accounts\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`member_id\` VARCHAR(50) NOT NULL,
          \`current_period_id\` VARCHAR(50) DEFAULT NULL,
          \`current_points\` INT NOT NULL DEFAULT 0,
          \`lifetime_earned_points\` INT NOT NULL DEFAULT 0,
          \`lifetime_redeemed_points\` INT NOT NULL DEFAULT 0,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_loyalty_accounts_member_id\` (\`member_id\`),
          KEY \`idx_loyalty_accounts_current_period_id\` (\`current_period_id\`),
          CONSTRAINT \`fk_loyalty_accounts_member_id\` FOREIGN KEY (\`member_id\`) REFERENCES \`members\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT,
          CONSTRAINT \`fk_loyalty_accounts_period_id\` FOREIGN KEY (\`current_period_id\`) REFERENCES \`loyalty_periods\` (\`id\`) ON UPDATE CASCADE ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`loyalty_transactions\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`loyalty_account_id\` VARCHAR(50) NOT NULL,
          \`period_id\` VARCHAR(50) DEFAULT NULL,
          \`transaction_type\` ENUM('PURCHASE', 'GAMIFICATION', 'EVENT', 'BONUS', 'REDEMPTION', 'EXPIRATION', 'ADJUSTMENT', 'REVERSAL') NOT NULL,
          \`points\` INT NOT NULL,
          \`reference_type\` VARCHAR(50) DEFAULT NULL,
          \`reference_id\` VARCHAR(100) DEFAULT NULL,
          \`idempotency_key\` VARCHAR(100) DEFAULT NULL,
          \`description\` TEXT DEFAULT NULL,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_loyalty_tx_idempotency_key\` (\`idempotency_key\`),
          KEY \`idx_loyalty_tx_account_created\` (\`loyalty_account_id\`, \`created_at\`),
          KEY \`idx_loyalty_tx_reference\` (\`reference_type\`, \`reference_id\`),
          KEY \`idx_loyalty_tx_type_created\` (\`transaction_type\`, \`created_at\`),
          KEY \`idx_loyalty_tx_period_id\` (\`period_id\`),
          CONSTRAINT \`fk_loyalty_tx_account_id\` FOREIGN KEY (\`loyalty_account_id\`) REFERENCES \`loyalty_accounts\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT,
          CONSTRAINT \`fk_loyalty_tx_period_id\` FOREIGN KEY (\`period_id\`) REFERENCES \`loyalty_periods\` (\`id\`) ON UPDATE CASCADE ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`member_tier_histories\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`member_id\` VARCHAR(50) NOT NULL,
          \`tier_id\` VARCHAR(50) NOT NULL,
          \`previous_tier_id\` VARCHAR(50) DEFAULT NULL,
          \`period_id\` VARCHAR(50) DEFAULT NULL,
          \`eligible_spending\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          \`change_reason\` VARCHAR(255) NOT NULL,
          \`effective_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_tier_histories_member_effective\` (\`member_id\`, \`effective_at\`),
          KEY \`idx_tier_histories_period_id\` (\`period_id\`),
          KEY \`idx_tier_histories_tier_id\` (\`tier_id\`),
          KEY \`idx_tier_histories_previous_tier_id\` (\`previous_tier_id\`),
          CONSTRAINT \`fk_tier_histories_member_id\` FOREIGN KEY (\`member_id\`) REFERENCES \`members\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT,
          CONSTRAINT \`fk_tier_histories_tier_id\` FOREIGN KEY (\`tier_id\`) REFERENCES \`member_tiers\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT,
          CONSTRAINT \`fk_tier_histories_prev_tier_id\` FOREIGN KEY (\`previous_tier_id\`) REFERENCES \`member_tiers\` (\`id\`) ON UPDATE CASCADE ON DELETE SET NULL,
          CONSTRAINT \`fk_tier_histories_period_id\` FOREIGN KEY (\`period_id\`) REFERENCES \`loyalty_periods\` (\`id\`) ON UPDATE CASCADE ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`rewards\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`code\` VARCHAR(50) NOT NULL,
          \`name\` VARCHAR(150) NOT NULL,
          \`description\` TEXT DEFAULT NULL,
          \`points_required\` INT NOT NULL DEFAULT 0,
          \`stock\` INT DEFAULT NULL,
          \`is_unlimited\` TINYINT(1) NOT NULL DEFAULT 1,
          \`valid_from\` DATETIME DEFAULT NULL,
          \`valid_until\` DATETIME DEFAULT NULL,
          \`status\` ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
          \`reward_type\` VARCHAR(50) NOT NULL DEFAULT 'VOUCHER',
          \`discount_type\` VARCHAR(50) DEFAULT NULL,
          \`discount_value\` INT DEFAULT NULL,
          \`image_url\` VARCHAR(500) DEFAULT NULL,
          \`category\` VARCHAR(100) DEFAULT 'Food',
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_rewards_code\` (\`code\`),
          KEY \`idx_rewards_status_validity\` (\`status\`, \`valid_from\`, \`valid_until\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`redemptions\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`member_id\` VARCHAR(50) NOT NULL,
          \`reward_id\` VARCHAR(50) NOT NULL,
          \`points_used\` INT NOT NULL,
          \`redemption_code\` VARCHAR(50) NOT NULL,
          \`status\` ENUM('REDEEMED', 'FULFILLED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'REDEEMED',
          \`idempotency_key\` VARCHAR(100) DEFAULT NULL,
          \`redeemed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`expires_at\` DATETIME DEFAULT NULL,
          \`fulfilled_at\` DATETIME DEFAULT NULL,
          \`fulfilled_by_staff_id\` VARCHAR(50) DEFAULT NULL,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_redemptions_code\` (\`redemption_code\`),
          UNIQUE KEY \`uq_redemptions_idempotency_key\` (\`idempotency_key\`),
          KEY \`idx_redemptions_member_redeemed\` (\`member_id\`, \`redeemed_at\`),
          KEY \`idx_redemptions_reward_id\` (\`reward_id\`),
          KEY \`idx_redemptions_status\` (\`status\`),
          KEY \`idx_redemptions_expires_at\` (\`expires_at\`),
          KEY \`idx_redemptions_fulfilled_staff\` (\`fulfilled_by_staff_id\`),
          CONSTRAINT \`fk_redemptions_member_id\` FOREIGN KEY (\`member_id\`) REFERENCES \`members\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT,
          CONSTRAINT \`fk_redemptions_reward_id\` FOREIGN KEY (\`reward_id\`) REFERENCES \`rewards\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT,
          CONSTRAINT \`fk_redemptions_staff_id\` FOREIGN KEY (\`fulfilled_by_staff_id\`) REFERENCES \`staff\` (\`id\`) ON UPDATE CASCADE ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      // Seed default loyalty period if empty
      const [periodsCount]: any = await connection.query("SELECT COUNT(*) AS count FROM loyalty_periods");
      if (periodsCount[0].count === 0) {
        await connection.query(`
          INSERT IGNORE INTO loyalty_periods (id, code, name, start_date, end_date, status)
          VALUES ('lp-default-2026', 'PERIOD-2026', 'Tahun Akademik 2026/2027', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'ACTIVE')
        `);
      }

      // Seed default tiers if empty
      const [tiersCount]: any = await connection.query("SELECT COUNT(*) AS count FROM member_tiers");
      if (tiersCount[0].count === 0) {
        await connection.query(`
          INSERT IGNORE INTO member_tiers (id, code, name, min_spending, max_spending, benefit_description, multiplier, status)
          VALUES 
          ('tier-classmate', 'CLASSMATE', 'Classmate', 0.00, 100000.00, 'Dapat 1x poin tiap transaksi, akses promo bulanan', 1.00, 'ACTIVE'),
          ('tier-study-buddy', 'STUDY_BUDDY', 'Study Buddy', 100000.00, 300000.00, 'Dapat 1.2x poin tiap transaksi, upsize minuman 1x/minggu', 1.20, 'ACTIVE'),
          ('tier-campus-star', 'CAMPUS_STAR', 'Campus Star', 300000.00, 750000.00, 'Dapat 1.5x poin tiap transaksi, potongan 5% di semua menu', 1.50, 'ACTIVE'),
          ('tier-hall-of-fame', 'HALL_OF_FAME', 'Hall of Fame', 750000.00, NULL, 'Dapat 2x poin tiap transaksi, diskon khusus 30% bulanan', 2.00, 'ACTIVE')
        `);
      }

      // Pastikan periode aktif hingga akhir 2027
      await connection.query(`
        UPDATE loyalty_periods SET end_date = '2027-12-31 23:59:59', status = 'ACTIVE'
        WHERE id = 'lp-default-2026' AND end_date < '2027-12-31 00:00:00'
      `);

      // Seed default rewards catalog if empty (digunakan oleh NGOLAB-GAMI & PointLab)
      const [rewardsCount]: any = await connection.query("SELECT COUNT(*) AS count FROM rewards");
      if (rewardsCount[0].count === 0) {
        await connection.query(`
          INSERT IGNORE INTO rewards (id, code, name, description, points_required, stock, is_unlimited, valid_from, valid_until, status, reward_type, discount_type, discount_value, image_url, category)
          VALUES
          ('rw-esteh-free', 'ESTEH100', 'Gratis Es Teh Manis Segar', 'Tukar 100 poin untuk 1 cup Es Teh Manis dingin di WarmingUp FIT.', 100, NULL, 1, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'ACTIVE', 'VOUCHER', 'FREE_ITEM', 7000, '/uploads/default_voucher.png', 'Drink'),
          ('rw-gila-cash20', 'GILACASH20', 'Cashback 20% Nasi Goreng Gila', 'Cashback poin 20% khusus pembelian Nasi Goreng Gila terfavorit.', 150, NULL, 1, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'ACTIVE', 'VOUCHER', 'PERCENTAGE', 20, '/uploads/default_voucher.png', 'Food'),
          ('rw-ayam-20', 'AYAM20', 'Diskon 20% Ayam Bakar', 'Ayam bakar diskon 20% untuk makan siang hemat di WarmingUp FIT.', 200, NULL, 1, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'ACTIVE', 'VOUCHER', 'PERCENTAGE', 20, '/uploads/promos/promo-1780646072923.jpeg', 'Food'),
          ('rw-ayam-teh', 'AYAMTEH', 'Beli Ayam Bakar Gratis Es Teh Manis', 'Dapatkan 1 cup Es Teh Manis dingin gratis pada pembelian paket Ayam Bakar.', 400, NULL, 1, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'ACTIVE', 'VOUCHER', 'FREE_ITEM', 7000, '/uploads/promos/promo-1781605494248.jpeg', 'Drink'),
          ('rw-diskon-5k', 'DISKON5K', 'Voucher Potongan Rp 5.000', 'Potongan langsung Rp 5.000 khusus pembelian menu kantin (min. belanja Rp 10.000).', 500, NULL, 1, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'ACTIVE', 'VOUCHER', 'FIXED', 5000, '/uploads/default_voucher.png', 'Food'),
          ('rw-kantin-50k', 'KANTIN50K', 'Voucher Makan Kantin Rp 50.000', 'Potongan langsung Rp 50.000 untuk seluruh menu kantin WarmingUp / Ngolab.', 5000, 50, 0, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'ACTIVE', 'VOUCHER', 'FIXED', 50000, '/uploads/default_voucher.png', 'Food')
        `);
      }

      // Pastikan katalog coin_promos aktif & memiliki masa berlaku valid + kode promo NGOLABin88 / NGOLABID
      await connection.query(`
        UPDATE coin_promos SET valid_until = '2027-12-31 23:59:59', is_active = 1
        WHERE id IN ('cp-1780646073298', 'cp-1781605494257', 'cp-1789530889514') AND valid_until < NOW()
      `);
      await connection.query(`
        INSERT IGNORE INTO coin_promos (id, title, description, coin_cost, discount_type, discount_value, min_order, max_usage, used_count, valid_until, is_active, image_url, category, promo_code, limit_per_user)
        VALUES
        ('cp-1780649192893', 'Voucher Diskon Spesial NGOLABin88', 'Diskon ekstra 20% all menu menggunakan kode promo khusus mahasiswa.', 200, 'percentage', 20, 10000, 500, 0, '2027-12-31 23:59:59', 1, '/uploads/default_voucher.png', 'Makanan', 'NGOLABin88', 5),
        ('cp-1781704530917', 'Cashback 20% Nasi Goreng Gila', 'Cashback koin 20% khusus pembelian Nasi Goreng Gila terfavorit.', 150, 'percentage', 20, 10000, 500, 0, '2027-12-31 23:59:59', 1, '/uploads/default_voucher.png', 'Makanan', 'GILACASH20', 5),
        ('cp-kantin-50k', 'Voucher Makan Kantin Rp 50.000', 'Potongan langsung Rp 50.000 untuk seluruh menu kantin WarmingUp / Ngolab.', 5000, 'fixed', 50000, 50000, 100, 0, '2027-12-31 23:59:59', 1, '/uploads/default_voucher.png', 'Makanan', 'KANTIN50K', 2)
      `);

      // Sinkronkan saldo awal antara users.coin_balance dan loyalty_accounts.current_points
      await connection.query(`
        UPDATE users u
        JOIN members m ON m.user_id = u.id
        JOIN loyalty_accounts la ON la.member_id = m.id
        SET u.coin_balance = GREATEST(u.coin_balance, la.current_points),
            la.current_points = GREATEST(u.coin_balance, la.current_points),
            la.lifetime_earned_points = GREATEST(la.lifetime_earned_points, GREATEST(u.coin_balance, la.current_points))
        WHERE u.coin_balance <> la.current_points
      `);

      // Tabel feedbacks & reviews untuk PointLab
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`feedbacks\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`user_id\` VARCHAR(50) DEFAULT NULL,
          \`user_name\` VARCHAR(100) DEFAULT 'Member',
          \`category\` VARCHAR(50) NOT NULL DEFAULT 'Umum',
          \`message\` TEXT NOT NULL,
          \`rating\` INT DEFAULT NULL,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_feedbacks_user_id\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`reviews\` (
          \`id\` VARCHAR(50) NOT NULL,
          \`user_id\` VARCHAR(50) DEFAULT NULL,
          \`user_name\` VARCHAR(100) DEFAULT 'Member',
          \`order_id\` VARCHAR(50) DEFAULT NULL,
          \`menu_item_id\` VARCHAR(50) DEFAULT NULL,
          \`rating\` INT NOT NULL DEFAULT 5,
          \`review_text\` TEXT DEFAULT NULL,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_reviews_user_id\` (\`user_id\`),
          KEY \`idx_reviews_order_id\` (\`order_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      // Pastikan kolom user_name pada feedbacks & reviews tersedia jika tabel dibuat oleh PointLab legacy
      const [fbCols]: any = await connection.query("SHOW COLUMNS FROM `feedbacks`");
      if (!fbCols.some((c: any) => c.Field === "user_name")) {
        await connection.query("ALTER TABLE `feedbacks` ADD COLUMN `user_name` VARCHAR(100) DEFAULT 'Member' AFTER `user_id`");
      }
      const [revCols]: any = await connection.query("SHOW COLUMNS FROM `reviews`");
      if (!revCols.some((c: any) => c.Field === "user_name")) {
        await connection.query("ALTER TABLE `reviews` ADD COLUMN `user_name` VARCHAR(100) DEFAULT 'Member' AFTER `user_id`");
      }

      // Pastikan avatar_url mendukung data URL maupun path file
      await connection.query("ALTER TABLE `users` MODIFY COLUMN `avatar_url` MEDIUMTEXT NULL").catch(() => {});

      console.log("✅ Membership and Loyalty Upgrade tables verified/created");
    } catch (err: any) {
      console.warn("⚠️ Membership & Loyalty Upgrade migration warning:", err.message);
    }

  } catch (error: any) {
    console.error("❌ Gagal koneksi MySQL:", error.message);
    throw error;
  } finally {
    connection?.release();
  }
}

// Helper untuk menulis log audit ke database
export async function addAuditLog(
  user: string,
  action: string,
  target: string,
  status: 'success' | 'warning' | 'info' = 'success',
  ip: string = '192.168.1.10'
) {
  try {
    await db.query(
      "INSERT INTO audit_logs (`user`, `action`, `target`, `status`, `ip`) VALUES (?, ?, ?, ?, ?)",
      [user, action, target, status, ip]
    );
  } catch (err: any) {
    console.error("❌ Gagal menulis audit log ke database:", err.message);
  }
}
