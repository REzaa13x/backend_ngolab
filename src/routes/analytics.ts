import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { buildMonthlyData, calculateReportSummary } from '../lib/reporting.js';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const days = req.query.range === 'week' ? 7 : req.query.range === 'month' ? 30 : 1;
    const [revenueRows]: any = await db.query(
      "SELECT COALESCE(SUM(total_price), 0) AS total FROM orders WHERE payment_status = 'lunas' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)",
      [days]
    );
    const [pendingRows]: any = await db.query("SELECT COUNT(*) AS count FROM orders WHERE status = 'menunggu'");
    const [coinRows]: any = await db.query('SELECT COALESCE(SUM(coin_balance), 0) AS total FROM users');
    res.json({
      totalRevenue: Number(revenueRows[0].total),
      pendingOrders: Number(pendingRows[0].count),
      distributedCoins: Number(coinRows[0].total),
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mengambil statistik', error: err.message });
  }
});

router.get('/sales-data', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(`
      SELECT WEEKDAY(created_at) AS weekday,
             COALESCE(SUM(CASE WHEN payment_status = 'lunas' THEN total_price ELSE 0 END), 0) AS sales
      FROM orders
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY WEEKDAY(created_at)
    `);
    const labels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const salesByDay = new Map(rows.map((row: any) => [Number(row.weekday), Number(row.sales)]));
    res.json(labels.map((day, index) => ({ day, sales: salesByDay.get(index) || 0 })));
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mengambil data penjualan', error: err.message });
  }
});

// Backward-compatible alias for existing external/Postman clients.
router.get('/coin-transactions', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    const [rows]: any = user_id
      ? await db.query('SELECT * FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC', [user_id])
      : await db.query('SELECT * FROM coin_transactions ORDER BY created_at DESC');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mengambil transaksi koin', error: err.message });
  }
});

router.get('/reports/summary', async (_req: Request, res: Response) => {
  try {
    const [orders]: any = await db.query('SELECT total_price, payment_status FROM orders');
    res.json(calculateReportSummary(orders));
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mengambil ringkasan laporan', error: err.message });
  }
});

router.get('/reports/monthly', async (_req: Request, res: Response) => {
  try {
    const [monthlyRows]: any = await db.query(`
      SELECT MONTH(created_at) AS month_num,
             SUM(CASE WHEN payment_status = 'lunas' THEN total_price ELSE 0 END) AS sales,
             COUNT(id) AS orders,
             SUM(CASE WHEN payment_status = 'lunas' THEN 1 ELSE 0 END) AS verified
      FROM orders
      WHERE YEAR(created_at) = YEAR(CURDATE())
      GROUP BY MONTH(created_at)
      ORDER BY MONTH(created_at)
    `);
    const [categoryRows]: any = await db.query(`
      SELECT COALESCE(m.category, 'Main Course') AS name, SUM(oi.price * oi.quantity) AS value
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN menus m ON oi.menu_id = m.id
      WHERE o.payment_status = 'lunas'
        AND YEAR(o.created_at) = YEAR(CURDATE())
      GROUP BY COALESCE(m.category, 'Main Course')
    `);
    const categoryData = categoryRows.length
      ? categoryRows.map((row: any) => ({ name: row.name, value: Number(row.value) }))
      : [{ name: 'Main Course', value: 0 }, { name: 'Snack', value: 0 }, { name: 'Beverage', value: 0 }];
    res.json({ monthlyData: buildMonthlyData(monthlyRows), categoryData });
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mengambil data bulanan', error: err.message });
  }
});

export default router;
