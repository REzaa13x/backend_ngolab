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
    console.log('Adding product_id and category_id columns to coin_promos...');
    try {
      await db.query(`ALTER TABLE coin_promos ADD COLUMN product_id VARCHAR(50) DEFAULT NULL`);
      console.log('✅ Added product_id to coin_promos');
    } catch (e) {
      console.log('product_id might already exist:', e.message);
    }

    try {
      await db.query(`ALTER TABLE coin_promos ADD COLUMN category_id VARCHAR(50) DEFAULT NULL`);
      console.log('✅ Added category_id to coin_promos');
    } catch (e) {
      console.log('category_id might already exist:', e.message);
    }
  } catch (err) {
    console.error(err);
  } finally {
    db.end();
  }
}

run();
