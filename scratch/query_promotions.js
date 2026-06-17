import mysql from 'mysql2/promise';

async function run() {
  const db = mysql.createPool({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "gesture_eats"
  });

  try {
    console.log("=== MEDIA FILES (Digital Board / Idle Promotion) ===");
    const [media] = await db.query("SELECT * FROM media_files WHERE is_active = 1 ORDER BY created_at DESC");
    console.log(JSON.stringify(media, null, 2));

    console.log("\n=== PLAYLISTS ===");
    const [playlists] = await db.query("SELECT * FROM playlists WHERE is_active = 1");
    console.log(JSON.stringify(playlists, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    db.end();
  }
}

run();
