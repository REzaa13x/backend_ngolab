import mysql from 'mysql2/promise';

async function run() {
  const db = mysql.createPool({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "gesture_eats",
  });

  try {
    console.log('Altering coin_promos table...');
    await db.query(`ALTER TABLE coin_promos MODIFY COLUMN discount_type ENUM('fixed', 'percentage', 'free_item') NOT NULL DEFAULT 'fixed'`);
    
    // Add columns if they don't exist
    try {
      await db.query(`ALTER TABLE coin_promos ADD COLUMN free_item_name VARCHAR(200) DEFAULT NULL`);
    } catch (e) {
      console.log('free_item_name column might already exist');
    }

    try {
      await db.query(`ALTER TABLE coin_promos ADD COLUMN required_item_name VARCHAR(200) DEFAULT NULL`);
    } catch (e) {
      console.log('required_item_name column might already exist');
    }

    console.log('Table altered successfully!');
  } catch (error) {
    console.error('Error executing SQL:', error);
  } finally {
    db.end();
  }
}

run();
