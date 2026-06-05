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
  try {
    const connection = await db.getConnection();
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
    } catch (migErr: any) {
      console.warn("⚠️ Users Migration warning:", migErr.message);
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

    connection.release();
  } catch (error: any) {
    console.error("❌ Gagal koneksi MySQL:", error.message);
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
