import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

async function run() {
  const db = mysql.createPool({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "gesture_eats",
    multipleStatements: true
  });

  try {
    console.log('Dropping old tables...');
    await db.query(`DROP TABLE IF EXISTS order_items;`);
    await db.query(`DROP TABLE IF EXISTS orders;`);

    console.log('Reading schema...');
    const schemaPath = path.join(process.cwd(), 'src', 'db', 'orders_schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema...');
    await db.query(sql);

    console.log('Database schema successfully updated!');
  } catch (error) {
    console.error('Failed to update schema:', error);
  } finally {
    db.end();
  }
}

run();
