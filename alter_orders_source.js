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
    console.log('Adding source column to orders table...');
    // Add column if it doesn't exist. Ignore if it already exists.
    await db.query(`
      ALTER TABLE \`orders\` 
      ADD COLUMN \`source\` VARCHAR(50) NOT NULL DEFAULT 'ngolab' 
      AFTER \`user_id\`
    `);
    console.log('Column source successfully added.');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Column source already exists.');
    } else {
      console.error('Failed to add column:', error);
    }
  } finally {
    db.end();
  }
}

run();
