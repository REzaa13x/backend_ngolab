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
    const [rows] = await db.query("DESCRIBE menus");
    console.table(rows);
    const [data] = await db.query("SELECT * FROM menus LIMIT 1");
    console.log("Data sample:", data);
  } catch (error) {
    console.error(error);
  } finally {
    db.end();
  }
}

run();
