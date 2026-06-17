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
    const [menus] = await db.query("SELECT * FROM menus WHERE outlet = 'coworking'");
    
    const formattedMenus = menus.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      price: m.price,
      inStock: Boolean(m.in_stock),
      displayed: m.in_stock ? 1 : 0,
      status: m.in_stock ? "Tersedia" : "Habis",
      stock: m.stock,
      outlet: m.outlet,
      image: m.image_url,
      description: m.description || "",
      deskripsi: m.description || ""
    }));

    console.log(JSON.stringify(formattedMenus, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    db.end();
  }
}

run();
