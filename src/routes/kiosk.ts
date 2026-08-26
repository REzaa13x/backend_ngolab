import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db, addAuditLog } from '../db/db.js';

const router = Router();

router.get('/users/scan-tag/:tag_id', async (req: Request, res: Response) => {
  try {
    const [users]: any = await db.query(
      'SELECT id, nama, nim, coin_balance, avatar_url FROM users WHERE rfid_tag_id = ?',
      [req.params.tag_id]
    );
    if (!users.length) return res.status(404).json({ status: 'error', message: 'Pengguna dengan Smart Tag tersebut tidak ditemukan' });
    res.json({ status: 'success', user: users[0] });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: 'Gagal memindai tag', error: err.message });
  }
});

router.post('/vouchers/redeem-gesture', async (req: Request, res: Response) => {
  const { user_id, promo_id } = req.body;
  if (!user_id || !promo_id) return res.status(400).json({ status: 'error', message: 'user_id dan promo_id wajib diisi' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [promos]: any = await connection.query('SELECT * FROM coin_promos WHERE id = ? FOR UPDATE', [promo_id]);
    if (!promos.length) { await connection.rollback(); return res.status(404).json({ status: 'error', message: 'Promo tidak ditemukan' }); }
    const promo = promos[0];

    const [users]: any = await connection.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [user_id]);
    if (!users.length) { await connection.rollback(); return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' }); }
    const user = users[0];

    if (!promo.is_active) { await connection.rollback(); return res.status(422).json({ status: 'error', message: 'Promo sedang tidak aktif' }); }
    if (new Date() > new Date(promo.valid_until)) { await connection.rollback(); return res.status(422).json({ status: 'error', message: 'Promo sudah kedaluwarsa' }); }
    if (promo.used_count >= promo.max_usage) { await connection.rollback(); return res.status(422).json({ status: 'error', message: 'Kuota penukaran promo ini sudah habis' }); }
    if (user.coin_balance < promo.coin_cost) { await connection.rollback(); return res.status(422).json({ status: 'error', message: 'Koin Anda tidak mencukupi' }); }

    if (promo.product_id) {
      const [menus]: any = await connection.query('SELECT in_stock, stock, name FROM menus WHERE id = ? FOR UPDATE', [promo.product_id]);
      if (menus.length && (!menus[0].in_stock || menus[0].stock <= 0)) {
        await connection.rollback();
        return res.status(422).json({ status: 'error', message: `Produk '${menus[0].name}' untuk promo ini sedang habis` });
      }
    }

    const txId = `ct-${Date.now()}`;
    const voucherId = `uv-${Date.now()}`;
    const voucherCode = `NGLB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    await connection.query('UPDATE users SET coin_balance = coin_balance - ? WHERE id = ?', [promo.coin_cost, user_id]);
    await connection.query('UPDATE coin_promos SET used_count = used_count + 1 WHERE id = ?', [promo_id]);
    await connection.query(
      "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description, promo_id) VALUES (?, ?, ?, 'redeem', ?, ?, ?)",
      [txId, user_id, user.nama, promo.coin_cost, `Penukaran koin untuk promo: ${promo.title}`, promo_id]
    );
    await connection.query(
      "INSERT INTO user_vouchers (id, user_id, promo_id, voucher_code, status) VALUES (?, ?, ?, ?, 'unused')",
      [voucherId, user_id, promo_id, voucherCode]
    );
    await connection.commit();
    await addAuditLog('Kiosk Gesture', 'Penukaran Koin', `${user.nama} → ${promo.title} (${promo.coin_cost} koin)`);
    req.app.get('io')?.emit('stats_updated');
    res.json({ status: 'success', message: 'Penukaran koin berhasil!', data: { voucher_code: voucherCode, product_id: promo.product_id || null, new_balance: user.coin_balance - promo.coin_cost } });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server saat memproses penukaran koin', error: err.message });
  } finally {
    connection.release();
  }
});

export default router;
