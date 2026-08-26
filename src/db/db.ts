import mysql from "mysql2/promise";

// MySQL Connection Pool untuk Papan Digital
export const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "gesture_eats",
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
    console.log("✅ MySQL terhubung ke database:", process.env.DB_NAME || "gesture_eats");
    
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
      await connection.query(`
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
          menu_name VARCHAR(200) NOT NULL,
          ingredient_id VARCHAR(50) NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          PRIMARY KEY (menu_name, ingredient_id),
          FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

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
          "INSERT IGNORE INTO recipe_ingredients (menu_name, ingredient_id, amount) VALUES (?, ?, ?)",
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
        ['brand_name', 'ngolab'],
        ['brand_subtitle', 'Gesture-Eats'],
        ['brand_logo_url', ''],
        ['active_zone', '60'],
        ['dwell_time', '1.5'],
        ['kiosk_idle_timeout', '60'],
        ['kiosk_mode', 'gesture'],
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
        ['sidebar_section_text_color', '#94a3b8']
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
