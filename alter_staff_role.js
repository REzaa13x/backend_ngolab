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
    console.log("Altering staff table role column...");
    await db.query("ALTER TABLE staff MODIFY COLUMN role ENUM('Super Admin', 'Admin', 'Kasir', 'Koki', 'Support') NOT NULL DEFAULT 'Kasir'");
    console.log("Column altered successfully!");
  } catch (error) {
    console.error("Error altering table:", error);
  } finally {
    db.end();
  }
}

run();
