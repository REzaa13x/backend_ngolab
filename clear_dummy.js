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
    console.log('Menghapus data dummy...');
    // Menghapus promo dummy
    await db.query(`DELETE FROM coin_promos WHERE id IN ('cp-1', 'cp-2', 'cp-3')`);
    
    // Menghapus users dummy
    await db.query(`DELETE FROM users WHERE id IN ('1', '2', '3')`);

    // Menghapus data dari server mockup jika belum terhapus
    // await db.query(`DELETE FROM coin_transactions`);

    console.log('Data dummy berhasil dihapus!');
  } catch (error) {
    console.error('Gagal menghapus data dummy:', error);
  } finally {
    db.end();
  }
}

run();
