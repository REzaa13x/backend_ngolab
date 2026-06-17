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
    console.log("=== 1. ORDERS ===");
    const [orders] = await db.query("SELECT * FROM orders LIMIT 1");
    if (orders.length > 0) {
      const [items] = await db.query("SELECT * FROM order_items WHERE order_id = ?", [orders[0].id]);
      orders[0].items = items.map((i) => ({
        id: i.menu_id || i.id,
        name: i.item_name,
        quantity: i.quantity,
        price: i.price
      }));
      console.log(JSON.stringify(orders[0], null, 2));
    } else {
      console.log("No orders found");
    }

    console.log("=== 2. COIN PROMOS ===");
    const [coinPromos] = await db.query("SELECT * FROM coin_promos LIMIT 1");
    if (coinPromos.length > 0) {
      console.log(JSON.stringify(coinPromos[0], null, 2));
    } else {
      console.log("No coin promos found");
    }

    console.log("=== 3. COIN TRANSACTIONS ===");
    const [coinTxs] = await db.query("SELECT * FROM coin_transactions LIMIT 1");
    if (coinTxs.length > 0) {
      console.log(JSON.stringify(coinTxs[0], null, 2));
    } else {
      console.log("No coin transactions found");
    }

    console.log("=== 4. RFID / SCAN USER ===");
    const [users] = await db.query("SELECT id, nama, nim, coin_balance, avatar_url, rfid_tag_id FROM users LIMIT 1");
    if (users.length > 0) {
      console.log(JSON.stringify(users[0], null, 2));
    } else {
      console.log("No users found");
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    db.end();
  }
}

run();
