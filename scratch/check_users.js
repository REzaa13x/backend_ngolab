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
    const [rows] = await db.query("DESCRIBE users");
    console.table(rows);
  } catch (error) {
    console.error(error);
  } finally {
    db.end();
  }
}

run();
