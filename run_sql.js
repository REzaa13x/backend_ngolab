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
    multipleStatements: true // VERY IMPORTANT for executing SQL scripts
  });

  try {
    const sqlPath = path.join(process.cwd(), 'src/db/orders_schema.sql');
    const sqlFile = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing SQL...');
    await db.query(sqlFile);
    console.log('SQL executed successfully!');
  } catch (error) {
    console.error('Error executing SQL:', error);
  } finally {
    db.end();
  }
}

run();
