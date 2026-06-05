import mysql from 'mysql2/promise';

async function run() {
  const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "gesture_eats",
  });

  try {
    console.log('Altering users table to add rfid_tag_id...');
    try {
      await db.query(`ALTER TABLE users ADD COLUMN rfid_tag_id VARCHAR(100) UNIQUE DEFAULT NULL`);
      console.log('✅ Added rfid_tag_id to users');
      
      // Let's seed a tag_id to the first user for testing!
      const [userRows] = await db.query(`SELECT id FROM users LIMIT 1`);
      if (userRows.length > 0) {
        const userId = userRows[0].id;
        await db.query(`UPDATE users SET rfid_tag_id = 'RFID-TEST-123' WHERE id = ?`, [userId]);
        console.log(`✅ Seeded tag ID 'RFID-TEST-123' to user ID: ${userId}`);
      }
    } catch (e) {
      console.log('rfid_tag_id column might already exist:', e.message);
    }

    console.log('Creating user_vouchers table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_vouchers (
        id VARCHAR(50) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        promo_id VARCHAR(50) NOT NULL,
        voucher_code VARCHAR(100) NOT NULL UNIQUE,
        status ENUM('unused', 'used') NOT NULL DEFAULT 'unused',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (promo_id) REFERENCES coin_promos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ user_vouchers table created successfully!');
  } catch (error) {
    console.error('❌ Error during database update:', error);
  } finally {
    db.end();
  }
}

run();
