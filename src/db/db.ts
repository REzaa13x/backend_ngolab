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
    connection.release();
  } catch (error: any) {
    console.error("❌ Gagal koneksi MySQL:", error.message);
  }
}
