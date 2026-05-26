import mysql from 'mysql2/promise';

async function insertDummyData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gesture_eats'
  });

  try {
    const id1 = `dummy-${Date.now()}-1`;
    const id2 = `dummy-${Date.now()}-2`;

    // Dummy 1: Belum Bayar
    await connection.query(
      `INSERT INTO orders (id, customer_name, invoice_number, total_price, status, payment_status, payment_method, source, created_at)
       VALUES (?, 'Budi (Dummy)', 'INV-001', 50000, 'menunggu', 'belum_bayar', 'QRIS', 'ngolab', NOW())`,
      [id1]
    );
    await connection.query(
      `INSERT INTO order_items (order_id, item_name, quantity, price) VALUES (?, 'Kopi Aren', 2, 25000)`,
      [id1]
    );

    // Dummy 2: Sudah Lunas
    await connection.query(
      `INSERT INTO orders (id, customer_name, invoice_number, total_price, status, payment_status, payment_method, amount_paid, source, created_at)
       VALUES (?, 'Siti (Dummy)', 'INV-002', 75000, 'sedang_diproses', 'lunas', 'QRIS', 75000, 'ngolab', DATE_SUB(NOW(), INTERVAL 1 HOUR))`,
      [id2]
    );
    await connection.query(
      `INSERT INTO order_items (order_id, item_name, quantity, price) VALUES (?, 'Nasi Goreng', 1, 40000)`,
      [id2]
    );
    await connection.query(
      `INSERT INTO order_items (order_id, item_name, quantity, price) VALUES (?, 'Es Teh', 1, 35000)`,
      [id2]
    );

    console.log("Dummy data berhasil dimasukkan!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await connection.end();
  }
}

insertDummyData();
