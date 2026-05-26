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
    const sqlPath = path.join(process.cwd(), 'src/db/menus_schema.sql');
    const sqlFile = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing Menus SQL...');
    await db.query(sqlFile);
    console.log('Menus SQL executed successfully!');

    // Insert dummy data if table is empty
    const [rows] = await db.query("SELECT COUNT(*) as count FROM menus");
    if (rows[0].count === 0) {
      console.log('Inserting mock menu data...');
      const mockMenus = [
        { id: "1", name: 'Kopi Susu Gula Aren', category: 'Minuman', price: 18000, inStock: 1, stock: 50, outlet: 'ngolab', image: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?q=80&w=600&auto=format&fit=crop' },
        { id: "2", name: 'Nasi Goreng Spesial', category: 'Makanan Utama', price: 25000, inStock: 1, stock: 30, outlet: 'ngolab', image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=600&auto=format&fit=crop' },
        { id: "3", name: 'Mie Yamin Baso', category: 'Makanan Utama', price: 20000, inStock: 1, stock: 25, outlet: 'ngolab', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=600&auto=format&fit=crop' },
        { id: "401", name: 'Paket Coworking Harian', category: 'Paket Sewa', price: 50000, inStock: 1, stock: 20, outlet: 'coworking', image: 'https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?q=80&w=600&auto=format&fit=crop' },
        { id: "402", name: 'Espresso Double Shot', category: 'Minuman', price: 22000, inStock: 1, stock: 100, outlet: 'coworking', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop' },
      ];
      
      for (const m of mockMenus) {
        await db.query(
          "INSERT INTO menus (id, name, category, price, in_stock, stock, outlet, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [m.id, m.name, m.category, m.price, m.inStock, m.stock, m.outlet, m.image]
        );
      }
      console.log('Mock menu data inserted!');
    }
  } catch (error) {
    console.error('Error executing SQL:', error);
  } finally {
    db.end();
  }
}

run();
