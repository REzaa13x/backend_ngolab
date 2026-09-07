import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { db, addAuditLog } from '../db/db.js';
import {
  aggregatePreorderItems,
  getPreorderStatus,
  canCancelPreorder,
  canMarkPreorderNoShow,
  canMarkPreorderPickedUp,
  isTerminalPreorderStatus
} from '../lib/preorderRules.js';

import {
  getVerifiedActor,
  requireAuthenticated,
  requireRoles
} from '../middleware/authSession.js';

const router = Router();
const requirePreorderStaff = requireRoles('Super Admin', 'Kasir', 'Koki');
const validOutlets = new Set(['ngolab', 'coworking']);
const validPaymentTimings = new Set(['before_pickup', 'on_pickup']);

function serializeCampaign(campaign: any, items: any[] = []) {
  return {
    ...campaign,
    is_active: Boolean(campaign.is_active),
    status: getPreorderStatus(campaign),
    items: items.map(item => ({
      ...item,
      is_active: Boolean(item.is_active),
      remaining_quota: Math.max(0, Number(item.quota_total) - Number(item.quota_sold))
    }))
  };
}

async function loadCampaigns(where = '', params: any[] = []) {
  const [campaigns]: any = await db.query(`SELECT * FROM preorder_campaigns ${where} ORDER BY service_at DESC`, params);
  if (!campaigns.length) return [];
  const ids = campaigns.map((campaign: any) => campaign.id);
  const placeholders = ids.map(() => '?').join(',');
  const [items]: any = await db.query(
    `SELECT * FROM preorder_items WHERE campaign_id IN (${placeholders}) ORDER BY created_at ASC`,
    ids
  );
  return campaigns.map((campaign: any) => serializeCampaign(
    campaign,
    items.filter((item: any) => item.campaign_id === campaign.id)
  ));
}

router.get('/admin', requirePreorderStaff, async (req: Request, res: Response) => {
  try {
    const outlet = String(req.query.outlet || '');
    if (outlet && !validOutlets.has(outlet)) return res.status(400).json({ message: 'Outlet tidak valid' });
    const campaigns = outlet
      ? await loadCampaigns('WHERE outlet = ?', [outlet])
      : await loadCampaigns();
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengambil program PO', error: error.message });
  }
});

router.get('/active', async (req: Request, res: Response) => {
  try {
    const outlet = String(req.query.outlet || 'ngolab');
    if (!validOutlets.has(outlet)) return res.status(400).json({ message: 'Outlet tidak valid' });
    const campaigns = await loadCampaigns(
      'WHERE outlet = ? AND is_active = 1 AND order_start_at <= NOW() AND order_deadline_at > NOW()',
      [outlet]
    );
    res.json(campaigns.map((campaign: any) => ({
      ...campaign,
      items: campaign.items.filter((item: any) => item.is_active && item.remaining_quota > 0)
    })));
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengambil menu PO aktif', error: error.message });
  }
});

router.get('/orders', requirePreorderStaff, async (req: Request, res: Response) => {
  try {
    const outlet = String(req.query.outlet || '');
    const paymentStatus = String(req.query.payment_status || '');
    const preorderStatus = String(req.query.preorder_status || '');
    const campaignId = String(req.query.campaign_id || '');
    if (outlet && !validOutlets.has(outlet)) return res.status(400).json({ message: 'Outlet tidak valid' });

    let query = `SELECT o.*, p.name AS campaign_name, p.order_deadline_at
                 FROM orders o JOIN preorder_campaigns p ON p.id = o.preorder_campaign_id
                 WHERE o.order_type = 'preorder'`;
    const params: any[] = [];
    if (outlet) { query += ' AND o.outlet = ?'; params.push(outlet); }
    if (paymentStatus) { query += ' AND o.payment_status = ?'; params.push(paymentStatus); }
    if (preorderStatus) { query += ' AND o.preorder_status = ?'; params.push(preorderStatus); }
    if (campaignId) { query += ' AND o.preorder_campaign_id = ?'; params.push(campaignId); }
    query += ' ORDER BY o.fulfillment_at ASC, o.created_at DESC';
    const [orders]: any = await db.query(query, params);
    for (const order of orders) {
      const [items]: any = await db.query(
        'SELECT item_name AS name, quantity, price, preorder_item_id FROM order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
      order.can_cancel = canCancelPreorder(order) && !['cancelled', 'picked_up', 'no_show'].includes(String(order.preorder_status));
      order.can_pick_up = canMarkPreorderPickedUp(order);
      order.can_no_show = canMarkPreorderNoShow(order);
    }
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengambil pesanan PO', error: error.message });
  }
});

router.post('/', requirePreorderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const { name, description, outlet, order_start_at, order_deadline_at, service_at, items = [] } = req.body;
    if (!name || !validOutlets.has(outlet) || !order_start_at || !order_deadline_at || !service_at) {
      return res.status(400).json({ message: 'Nama, outlet, periode PO, deadline, dan waktu penyajian wajib diisi' });
    }
    const start = new Date(order_start_at);
    const deadline = new Date(order_deadline_at);
    const service = new Date(service_at);
    if (![start, deadline, service].every(date => Number.isFinite(date.getTime())) || !(start < deadline && deadline < service)) {
      return res.status(400).json({ message: 'Urutan waktu harus: mulai PO < deadline < waktu penyajian' });
    }
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Minimal satu menu PO wajib ditambahkan' });
    for (const item of items) {
      if (!item.name || Number(item.price) <= 0 || Number(item.quota_total) <= 0) {
        return res.status(400).json({ message: 'Nama, harga, dan kuota menu PO harus valid' });
      }
    }

    await connection.beginTransaction();
    const id = randomUUID();
    await connection.query(
      `INSERT INTO preorder_campaigns
       (id, name, description, outlet, order_start_at, order_deadline_at, service_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, name.trim(), description || '', outlet, start, deadline, service]
    );
    for (const item of items) {
      await connection.query(
        `INSERT INTO preorder_items
         (id, campaign_id, name, category, price, quota_total, image_url, description, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [randomUUID(), id, item.name.trim(), item.category || 'PO', Number(item.price), Number(item.quota_total), item.image_url || '', item.description || '']
      );
    }
    await connection.commit();
    await addAuditLog(getVerifiedActor(req), 'Buat Program PO', `${name} (${outlet})`);
    const [campaign] = await loadCampaigns('WHERE id = ?', [id]);
    res.status(201).json(campaign);
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal membuat program PO', error: error.message });
  } finally {
    connection.release();
  }
});

router.patch('/:id/toggle', requirePreorderStaff, async (req: Request, res: Response) => {
  try {
    const [result]: any = await db.query('UPDATE preorder_campaigns SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Program PO tidak ditemukan' });
    const [campaign] = await loadCampaigns('WHERE id = ?', [req.params.id]);
    await addAuditLog(getVerifiedActor(req), 'Toggle Program PO', campaign.name);
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengubah status program PO', error: error.message });
  }
});

router.delete('/:id', requirePreorderStaff, async (req: Request, res: Response) => {
  try {
    const [orders]: any = await db.query('SELECT id FROM orders WHERE preorder_campaign_id = ? LIMIT 1', [req.params.id]);
    if (orders.length) return res.status(409).json({ message: 'Program PO yang sudah memiliki transaksi tidak dapat dihapus' });
    const [result]: any = await db.query('DELETE FROM preorder_campaigns WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Program PO tidak ditemukan' });
    res.json({ message: 'Program PO berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal menghapus program PO', error: error.message });
  }
});

router.post('/:campaignId/orders', requireAuthenticated, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const { customer_name, items, payment_timing, payment_method } = req.body;
    if (!customer_name || !Array.isArray(items) || !items.length || !validPaymentTimings.has(payment_timing)) {
      return res.status(400).json({ message: 'Pelanggan, item, dan pilihan pembayaran wajib diisi' });
    }
    await connection.beginTransaction();
    const [campaignRows]: any = await connection.query(
      'SELECT * FROM preorder_campaigns WHERE id = ? FOR UPDATE',
      [req.params.campaignId]
    );
    if (!campaignRows.length) { await connection.rollback(); return res.status(404).json({ message: 'Program PO tidak ditemukan' }); }
    const campaign = campaignRows[0];
    if (getPreorderStatus(campaign) !== 'open') { await connection.rollback(); return res.status(409).json({ message: 'Periode pemesanan PO belum dibuka atau sudah ditutup' }); }

    let requested;
    try {
      requested = aggregatePreorderItems(items);
    } catch {
      await connection.rollback();
      return res.status(400).json({ message: 'Item atau jumlah PO tidak valid' });
    }
    const resolved: any[] = [];
    let total = 0;
    for (const requestItem of requested) {
      const quantity = requestItem.quantity;
      const [rows]: any = await connection.query(
        'SELECT * FROM preorder_items WHERE id = ? AND campaign_id = ? AND is_active = 1 FOR UPDATE',
        [requestItem.id, campaign.id]
      );
      if (!rows.length) { await connection.rollback(); return res.status(404).json({ message: 'Menu PO tidak ditemukan' }); }
      const item = rows[0];
      if (Number(item.quota_sold) + quantity > Number(item.quota_total)) {
        await connection.rollback();
        return res.status(409).json({ message: `Kuota ${item.name} tidak mencukupi` });
      }
      resolved.push({ ...item, quantity });
      total += Number(item.price) * quantity;
    }

    const orderId = randomUUID();
    const invoice = `PO-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    await connection.query(
      `INSERT INTO orders
       (id, user_id, customer_name, invoice_number, total_price, status, payment_status, payment_method,
        amount_paid, external_id, source, outlet, order_type, preorder_campaign_id, payment_timing, fulfillment_at, preorder_status)
       VALUES (?, NULL, ?, ?, ?, 'menunggu', 'belum_bayar', ?, 0, ?, 'preorder', ?, 'preorder', ?, ?, ?, 'reserved')`,
      [orderId, customer_name.trim(), invoice, total, payment_method || null, invoice, campaign.outlet, campaign.id, payment_timing, campaign.service_at]
    );
    for (const item of resolved) {
      await connection.query(
        `INSERT INTO order_items (order_id, menu_id, preorder_item_id, item_name, quantity, price)
         VALUES (?, NULL, ?, ?, ?, ?)`,
        [orderId, item.id, item.name, item.quantity, item.price]
      );
      await connection.query('UPDATE preorder_items SET quota_sold = quota_sold + ? WHERE id = ?', [item.quantity, item.id]);
    }
    await connection.commit();
    const [orders]: any = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    req.app.get('io')?.emit('new_order', orders[0]);
    req.app.get('io')?.emit('stats_updated');
    await addAuditLog(getVerifiedActor(req), 'Buat Pesanan PO', `${invoice} (${campaign.outlet})`);
    res.status(201).json(orders[0]);
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal membuat pesanan PO', error: error.message });
  } finally {
    connection.release();
  }
});

router.post('/orders/:orderId/pay', requirePreorderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows]: any = await connection.query(
      "SELECT * FROM orders WHERE id = ? AND order_type = 'preorder' FOR UPDATE",
      [req.params.orderId]
    );
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ message: 'Pesanan PO tidak ditemukan' }); }
    const order = rows[0];
    if (isTerminalPreorderStatus(order.preorder_status)) {
      await connection.rollback();
      return res.status(409).json({ message: 'Pesanan PO yang sudah terminal tidak dapat dibayar' });
    }
    const changed = String(order.payment_status).toLowerCase() !== 'lunas';
    if (changed) {
      await connection.query(
        "UPDATE orders SET payment_status = 'lunas', amount_paid = total_price, payment_method = COALESCE(?, payment_method) WHERE id = ?",
        [req.body.payment_method || null, order.id]
      );
    }
    const [updated]: any = await connection.query('SELECT * FROM orders WHERE id = ?', [order.id]);
    await connection.commit();
    if (changed) await addAuditLog(getVerifiedActor(req), 'Pelunasan PO', order.invoice_number);
    req.app.get('io')?.emit('order_updated', updated[0]);
    res.json(updated[0]);
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal menandai pembayaran PO', error: error.message });
  } finally {
    connection.release();
  }
});

router.post('/orders/:orderId/pickup', requirePreorderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows]: any = await connection.query(
      "SELECT * FROM orders WHERE id = ? AND order_type = 'preorder' FOR UPDATE",
      [req.params.orderId]
    );
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ message: 'Pesanan PO tidak ditemukan' }); }
    const order = rows[0];
    if (!canMarkPreorderPickedUp(order)) { await connection.rollback(); return res.status(409).json({ message: 'Pesanan harus lunas dan belum terminal sebelum ditandai sudah diambil' }); }
    await connection.query("UPDATE orders SET preorder_status = 'picked_up', status = 'selesai', picked_up_at = NOW() WHERE id = ?", [order.id]);
    const [updated]: any = await connection.query('SELECT * FROM orders WHERE id = ?', [order.id]);
    await connection.commit();
    await addAuditLog(getVerifiedActor(req), 'PO Sudah Diambil', order.invoice_number);
    req.app.get('io')?.emit('order_updated', updated[0]);
    res.json(updated[0]);
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal menyelesaikan pengambilan PO', error: error.message });
  } finally {
    connection.release();
  }
});

router.post('/orders/:orderId/no-show', requirePreorderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows]: any = await connection.query(
      "SELECT * FROM orders WHERE id = ? AND order_type = 'preorder' FOR UPDATE",
      [req.params.orderId]
    );
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ message: 'Pesanan PO tidak ditemukan' }); }
    const order = rows[0];
    if (!canMarkPreorderNoShow(order)) { await connection.rollback(); return res.status(409).json({ message: 'No-show hanya dapat ditandai setelah waktu pengambilan dan sebelum order terminal' }); }
    await connection.query("UPDATE orders SET preorder_status = 'no_show', status = 'selesai' WHERE id = ?", [order.id]);
    const [updated]: any = await connection.query('SELECT * FROM orders WHERE id = ?', [order.id]);
    await connection.commit();
    await addAuditLog(getVerifiedActor(req), 'PO No-show', order.invoice_number, 'warning');
    req.app.get('io')?.emit('order_updated', updated[0]);
    res.json(updated[0]);
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal menandai no-show', error: error.message });
  } finally {
    connection.release();
  }
});

router.post('/orders/:orderId/cancel', requirePreorderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [orders]: any = await connection.query(
      `SELECT o.*, p.order_deadline_at FROM orders o
       JOIN preorder_campaigns p ON p.id = o.preorder_campaign_id
       WHERE o.id = ? AND o.order_type = 'preorder' FOR UPDATE`,
      [req.params.orderId]
    );
    if (!orders.length) { await connection.rollback(); return res.status(404).json({ message: 'Pesanan PO tidak ditemukan' }); }
    const order = orders[0];
    if (isTerminalPreorderStatus(order.preorder_status)) { await connection.rollback(); return res.status(409).json({ message: 'Pesanan PO sudah berada pada status terminal' }); }
    if (!canCancelPreorder(order)) { await connection.rollback(); return res.status(409).json({ message: 'PO tidak dapat dibatalkan setelah deadline' }); }
    const [items]: any = await connection.query('SELECT preorder_item_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
    for (const item of items) {
      if (item.preorder_item_id) {
        await connection.query('UPDATE preorder_items SET quota_sold = GREATEST(quota_sold - ?, 0) WHERE id = ?', [item.quantity, item.preorder_item_id]);
      }
    }
    await connection.query("UPDATE orders SET status = 'dibatalkan', preorder_status = 'cancelled' WHERE id = ?", [order.id]);
    await connection.commit();
    await addAuditLog(getVerifiedActor(req), 'Batalkan PO', order.invoice_number, 'warning');
    req.app.get('io')?.emit('order_updated', { ...order, status: 'dibatalkan', preorder_status: 'cancelled' });
    res.json({ message: 'Pesanan PO dibatalkan dan kuota dikembalikan' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal membatalkan pesanan PO', error: error.message });
  } finally {
    connection.release();
  }
});

export default router;
