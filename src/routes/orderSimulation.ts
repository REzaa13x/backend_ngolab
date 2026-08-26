import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';

const router = Router();

router.post('/simulate', async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const [users]: any = await db.query('SELECT id, nama FROM users ORDER BY RAND() LIMIT 1');
    const [menus]: any = await db.query("SELECT id, name, price FROM menus WHERE outlet = 'ngolab' AND in_stock = 1 AND stock > 0 ORDER BY RAND() LIMIT 3");
    if (!users.length || !menus.length) return res.status(409).json({ message: 'Simulasi membutuhkan minimal satu user dan satu menu aktif' });

    const selectedItems = menus.slice(0, Math.max(1, Math.floor(Math.random() * Math.min(3, menus.length)) + 1));
    const totalPrice = selectedItems.reduce((sum: number, item: any) => sum + Number(item.price), 0);
    const orderId = Date.now().toString();
    const invoiceNumber = `INV-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const paymentMethods = ['Transfer Bank (BCA)', 'E-Wallet (OVO)', 'E-Wallet (Dana)', 'Tunai', 'QRIS'];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const paymentStatus = Math.random() > 0.5 ? 'pending_verifikasi' : 'belum_bayar';

    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO orders (id, user_id, customer_name, invoice_number, total_price, status, payment_status, payment_method, amount_paid, external_id, source)
       VALUES (?, ?, ?, ?, ?, 'menunggu', ?, ?, 0, ?, 'ngolab')`,
      [orderId, users[0].id, users[0].nama, invoiceNumber, totalPrice, paymentStatus, paymentMethod, paymentMethod === 'Tunai' ? '-' : `SIM-${Date.now()}`]
    );
    for (const item of selectedItems) {
      await connection.query(
        'INSERT INTO order_items (order_id, menu_id, item_name, quantity, price) VALUES (?, ?, ?, 1, ?)',
        [orderId, item.id, item.name, item.price]
      );
    }
    await connection.commit();

    const order = {
      id: orderId, user_id: users[0].id, customer_name: users[0].nama, invoice_number: invoiceNumber,
      total_price: totalPrice, status: 'menunggu', payment_status: paymentStatus, payment_method: paymentMethod,
      amount_paid: 0, source: 'ngolab', items: selectedItems.map((item: any) => ({ id: item.id, name: item.name, quantity: 1, price: Number(item.price) })),
    };
    req.app.get('io')?.emit('new_order', order);
    req.app.get('io')?.emit('stats_updated');
    res.json(order);
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal mensimulasikan pesanan', error: err.message });
  } finally {
    connection.release();
  }
});

export default router;
