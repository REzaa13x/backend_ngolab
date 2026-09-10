import { Router, Request, Response } from "express";
import { db, addAuditLog } from "../db/db.js";
import { requireApiKeyScope } from "../middleware/authApiKey.js";
import { canUseGenericOrderStatus } from "../lib/preorderRules.js";
import { getVerifiedActor, requireRoles } from "../middleware/authSession.js";
import { consumeInventoryForOrder, emitInventoryChanges, restoreInventoryForOrder } from "../lib/inventoryDb.js";
import { processLoyaltyPoints } from "../lib/loyaltyHelper.js";

const router = Router();
const requireOrderStaff = requireRoles('Super Admin', 'Kasir', 'Koki');

// ==========================================
// 1. ORDERS API
// ==========================================

// GET /api/orders — Ambil semua pesanan
router.get("/", requireOrderStaff, async (_req: Request, res: Response) => {
  try {
    const [orders]: any = await db.query("SELECT * FROM orders ORDER BY created_at DESC");
    
    // Ambil item untuk setiap order
    for (const order of orders) {
      const [items]: any = await db.query("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
      order.items = items.map((i: any) => ({
        id: i.menu_id || i.id,
        name: i.item_name,
        quantity: i.quantity,
        price: i.price
      }));
    }
    
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil pesanan", error: err.message });
  }
});

// GET /api/orders/kds — Ambil pesanan untuk Kitchen Display
router.get("/kds", requireOrderStaff, async (req: Request, res: Response) => {
  try {
    const outlet = String(req.query.outlet || 'ngolab');
    if (outlet !== 'ngolab' && outlet !== 'coworking') {
      return res.status(400).json({ message: 'Outlet tidak valid' });
    }
    const [orders]: any = await db.query(
      `SELECT * FROM orders
       WHERE outlet = ?
         AND LOWER(status) IN ('menunggu', 'sedang_diproses', 'siap')
         AND (
           (order_type = 'regular')
           OR
           (order_type = 'preorder' AND fulfillment_at <= NOW())
         )
       ORDER BY COALESCE(fulfillment_at, created_at) ASC`,
      [outlet]
    );
    
    for (const order of orders) {
      const [items]: any = await db.query("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
      order.items = items.map((i: any) => ({
        id: i.menu_id || i.id,
        name: i.item_name,
        quantity: i.quantity,
        price: i.price
      }));
    }
    
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil pesanan KDS", error: err.message });
  }
});

// GET /api/orders/kds/pending-count — Badge pesanan baru pada sidebar.
router.get('/kds/pending-count', requireOrderStaff, async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      `SELECT outlet, COUNT(*) AS total
       FROM orders
       WHERE LOWER(status) = 'menunggu'
         AND (
           order_type = 'regular'
           OR (order_type = 'preorder' AND fulfillment_at <= NOW())
         )
       GROUP BY outlet`
    );
    const byOutlet = { ngolab: 0, coworking: 0 };
    rows.forEach((row: any) => {
      if (row.outlet === 'ngolab' || row.outlet === 'coworking') byOutlet[row.outlet] = Number(row.total);
    });
    res.json({ total: byOutlet.ngolab + byOutlet.coworking, byOutlet });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengambil jumlah pesanan dapur', error: error.message });
  }
});

// GET /api/orders/queue-status — Estimasi waktu tunggu dapur
router.get("/queue-status", async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      "SELECT COUNT(*) as active_orders FROM orders WHERE status IN ('menunggu', 'sedang_diproses')"
    );
    const activeOrders = rows[0].active_orders;
    
    // Asumsi: 1 order butuh waktu 3 menit. Base time: 5 menit.
    const estimatedMinutes = 5 + (activeOrders * 3);

    res.json({
      active_orders: activeOrders,
      estimated_wait_time_minutes: estimatedMinutes,
      message: activeOrders > 5 ? "Dapur Sedang Sibuk" : "Normal"
    });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil status antrean", error: err.message });
  }
});

// POST /api/orders/manual — Buat pesanan baru (dari admin/telp/kiosk)
router.post("/manual", requireOrderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { customer_name, items, payment_method, payment_status, source, user_id } = req.body;

    if (!customer_name || !items || items.length === 0) {
      return res.status(400).json({ message: "Data pesanan tidak lengkap" });
    }

    let totalPrice = 0;
    const orderItems = items.map((item: any) => {
      totalPrice += (item.price * item.quantity);
      return {
        menu_id: item.id || null,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price
      };
    });

    const orderId = Date.now().toString();
    const invoiceNumber = `INV-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    // Status 'menunggu' agar masuk ke KDS kolom "Pesanan Masuk" — koki yang akan memulai
    const status = 'menunggu';
    const finalPaymentStatus = payment_status || 'belum_bayar';
    const amountPaid = finalPaymentStatus === 'lunas' ? totalPrice : 0;

    const finalOutlet = source === 'coworking' ? 'coworking' : 'ngolab';
    const finalSource = 'manual';

    await connection.query(
      `INSERT INTO orders (id, user_id, customer_name, invoice_number, total_price, status, payment_status, payment_method, amount_paid, external_id, source, outlet)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId, 
        user_id || null, // manual order bisa disertakan user_id member
        customer_name, invoiceNumber, totalPrice, status, finalPaymentStatus, 
        payment_method || 'Tunai', amountPaid, "MANUAL", finalSource, finalOutlet
      ]
    );

    for (const item of orderItems) {
      await connection.query(
        "INSERT INTO order_items (order_id, menu_id, item_name, quantity, price) VALUES (?, ?, ?, ?, ?)",
        [orderId, item.menu_id, item.item_name, item.quantity, item.price]
      );

      if (item.menu_id) {
        await connection.query(
          "UPDATE menus SET stock = GREATEST(stock - ?, 0) WHERE id = ?",
          [item.quantity, item.menu_id]
        );
        await connection.query(
          "UPDATE menus SET in_stock = 0 WHERE id = ? AND stock <= 0",
          [item.menu_id]
        );
      }
    }

    const actor = getVerifiedActor(req);
    const inventoryChanges = await consumeInventoryForOrder(
      connection,
      orderId,
      orderItems.map((item: any) => ({ name: item.item_name, quantity: Number(item.quantity) })),
      finalOutlet,
      actor
    );
    
    if (finalPaymentStatus === 'lunas' && user_id) {
      await processLoyaltyPoints(connection, user_id, customer_name, invoiceNumber, totalPrice);
    }
    
    await connection.commit();

    // Fetch the inserted order to return
    const [insertedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
    insertedOrder[0].items = orderItems.map((i: any) => ({
      id: i.menu_id, name: i.item_name, quantity: i.quantity, price: i.price
    }));

    // Log to security audit
    await addAuditLog(actor, "Buat Pesanan Manual", `${invoiceNumber} (${customer_name})`);

    const io = req.app.get('io');
    if (io) {
      io.emit("new_order", insertedOrder[0]);
      if (finalPaymentStatus === 'lunas') io.emit("order_updated", insertedOrder[0]);
      io.emit("stats_updated");
      emitInventoryChanges(io, inventoryChanges);
    }

    res.status(201).json(insertedOrder[0]);
  } catch (err: any) {
    await connection.rollback();
    res.status(err.statusCode || 500).json({ message: err.statusCode ? err.message : "Gagal membuat pesanan", ...(err.statusCode ? {} : { error: err.message }) });
  } finally {
    connection.release();
  }
});

// POST /api/orders/external — Endpoint Master untuk Aplikasi Eksternal (contoh: Smart Tag QR)
router.post("/external", requireApiKeyScope('orders:write'), async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { user_id, customer_name, items, payment_method, payment_status, total_price, external_id, source } = req.body;

    if (!customer_name || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Data pesanan tidak lengkap" });
    }
    if (external_id) {
      const [existing]: any = await connection.query(
        'SELECT id, invoice_number FROM orders WHERE external_id = ? AND source = ? LIMIT 1',
        [external_id, source || 'ngolab']
      );
      if (existing.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'Pesanan external_id tersebut sudah pernah diterima', order_id: existing[0].id, invoice_number: existing[0].invoice_number });
      }
    }

    const orderId = Date.now().toString();
    const invoiceNumber = external_id || `EXT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const finalPaymentStatus = payment_status || 'belum_bayar'; // Default ke belum_bayar agar diverifikasi Kasir terlebih dahulu
    const status = finalPaymentStatus === 'lunas' ? 'sedang_diproses' : 'menunggu';
    const amountPaid = finalPaymentStatus === 'lunas' ? total_price : 0;
    const finalSource = source || 'ngolab';
    const finalOutlet = source === 'coworking' ? 'coworking' : 'ngolab';

    await connection.query(
      `INSERT INTO orders (id, user_id, customer_name, invoice_number, total_price, status, payment_status, payment_method, amount_paid, external_id, source, outlet)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        user_id || null,
        customer_name, invoiceNumber, total_price, status, finalPaymentStatus,
        payment_method || 'QRIS', amountPaid, external_id || "EXTERNAL", finalSource, finalOutlet
      ]
    );

    for (const item of items) {
      const menuId = item.id || item.menu_id || null;
      await connection.query(
        "INSERT INTO order_items (order_id, menu_id, item_name, quantity, price) VALUES (?, ?, ?, ?, ?)",
        [orderId, menuId, item.name || item.item_name, item.quantity, item.price]
      );

      if (menuId) {
        await connection.query(
          "UPDATE menus SET stock = GREATEST(stock - ?, 0) WHERE id = ?",
          [item.quantity, menuId]
        );
        await connection.query(
          "UPDATE menus SET in_stock = 0 WHERE id = ? AND stock <= 0",
          [menuId]
        );
      }
    }

    const inventoryActor = (req as any).apiClient?.name || 'Integrasi eksternal';
    const inventoryChanges = await consumeInventoryForOrder(
      connection,
      orderId,
      items.map((item: any) => ({ name: item.name || item.item_name, quantity: Number(item.quantity) })),
      finalOutlet,
      inventoryActor
    );
    
    if (finalPaymentStatus === 'lunas' && user_id) {
      await processLoyaltyPoints(connection, user_id, customer_name, invoiceNumber, total_price);
    }
    
    await connection.commit();

    // Fetch the inserted order to return
    const [insertedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
    insertedOrder[0].items = items;

    const io = req.app.get('io');
    if (io) {
      io.emit("new_order", insertedOrder[0]);
      if (finalPaymentStatus === 'lunas') io.emit("order_updated", insertedOrder[0]);
      io.emit("stats_updated");
      emitInventoryChanges(io, inventoryChanges);
    }

    res.status(201).json({ message: "Pesanan berhasil diterima", order: insertedOrder[0] });
  } catch (err: any) {
    await connection.rollback();
    res.status(err.statusCode || 500).json({ message: err.statusCode ? err.message : "Gagal memproses pesanan eksternal", ...(err.statusCode ? {} : { error: err.message }) });
  } finally {
    connection.release();
  }
});

// GET /api/orders/external/history — Endpoint Riwayat untuk Aplikasi Eksternal (contoh: Smart Tag QR)
router.get("/external/history", requireApiKeyScope('orders:read'), async (req: Request, res: Response) => {
  try {
    const [orders]: any = await db.query(
      `SELECT * FROM orders WHERE source IN ('ngolab', 'smart_tag_qr') ORDER BY created_at DESC LIMIT 100`
    );
    
    // Ambil item untuk setiap order
    for (const order of orders) {
      const [items]: any = await db.query("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
      order.items = items.map((i: any) => ({
        id: i.menu_id || i.id,
        name: i.item_name,
        quantity: i.quantity,
        price: i.price
      }));
    }
    
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil riwayat transaksi", error: err.message });
  }
});

// GET /api/orders/external/incoming — Endpoint Pesanan Masuk untuk Aplikasi Eksternal (contoh: Smart Tag QR)
router.get("/external/incoming", requireApiKeyScope('orders:read'), async (req: Request, res: Response) => {
  try {
    const [orders]: any = await db.query(
      `SELECT * FROM orders WHERE status IN ('menunggu', 'sedang_diproses', 'siap') ORDER BY created_at DESC`
    );
    
    // Ambil item untuk setiap order
    for (const order of orders) {
      const [items]: any = await db.query("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
      order.items = items.map((i: any) => ({
        id: i.menu_id || i.id,
        name: i.item_name,
        quantity: i.quantity,
        price: i.price
      }));
    }
    
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal mengambil data pesanan masuk", error: err.message });
  }
});

// POST /api/orders/:id/verify — Verifikasi Pembayaran & Beri Cashback
router.post("/:id/verify", requireOrderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    const [orders]: any = await connection.query("SELECT * FROM orders WHERE id = ?", [id]);
    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Pesanan tidak ditemukan" });
    }
    
    const order = orders[0];
    if (order.order_type === 'preorder') {
      await connection.rollback();
      return res.status(409).json({ message: 'Pelunasan PO harus melalui aksi Tandai Lunas agar aturan operasional PO tervalidasi' });
    }
    if (order.payment_status === 'lunas') {
      await connection.rollback();
      return res.status(400).json({ message: "Pesanan sudah lunas" });
    }

    const amountPaid = req.body.amount_paid || order.total_price;
    const paymentMethod = req.body.payment_method || order.payment_method || 'QRIS';

    // Status kembali ke 'menunggu' agar koki bisa melihat di kolom "Pesanan Masuk" KDS
    // Koki yang akan menggeser ke 'sedang_diproses' ketika mulai memasak
    await connection.query(
      "UPDATE orders SET payment_status = 'lunas', status = 'menunggu', amount_paid = ?, payment_method = ? WHERE id = ?",
      [amountPaid, paymentMethod, id]
    );

    // Koin Cashback Logic terpusat
    let cashback = 0;
    if (order.user_id) {
      const [users]: any = await connection.query("SELECT nama FROM users WHERE id = ?", [order.user_id]);
      const userName = users && users.length > 0 ? users[0].nama : "Pelanggan";
      cashback = await processLoyaltyPoints(connection, order.user_id, userName, order.invoice_number, order.total_price);
    }

    await connection.commit();

    const [updatedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [id]);
    
    // Log to security audit
    const actor = getVerifiedActor(req);
    await addAuditLog(actor, "Verifikasi Pembayaran", `${order.invoice_number} (Lunas)`);

    const io = req.app.get('io');
    if (io) {
      io.emit("order_updated", updatedOrder[0]);
      io.emit("stats_updated");
    }

    res.json({ message: "Pesanan telah diverifikasi", order: updatedOrder[0], cashback });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal verifikasi pesanan", error: err.message });
  } finally {
    connection.release();
  }
});

// POST /api/orders/:id/reject
router.post("/:id/reject", requireOrderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [orders]: any = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!orders.length) { await connection.rollback(); return res.status(404).json({ message: 'Pesanan tidak ditemukan' }); }
    if (orders[0].order_type === 'preorder') {
      await connection.rollback();
      return res.status(409).json({ message: 'Pembatalan PO harus melalui aksi Batalkan PO agar deadline dan kuota tervalidasi' });
    }
    const actor = getVerifiedActor(req);
    const inventoryChanges = await restoreInventoryForOrder(connection, req.params.id, actor);
    await connection.query("UPDATE orders SET payment_status = 'ditolak', status = 'dibatalkan' WHERE id = ?", [req.params.id]);
    await connection.commit();
    const [updatedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    await addAuditLog(actor, "Tolak Pesanan", `${updatedOrder[0].invoice_number} (Dibatalkan)`, "warning");

    const io = req.app.get('io');
    if (io) {
      io.emit("order_updated", updatedOrder[0]);
      io.emit("stats_updated");
      emitInventoryChanges(io, inventoryChanges);
    }
    res.json({ message: "Pesanan telah ditolak dan stok dikembalikan", order: updatedOrder[0] });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal menolak pesanan", error: err.message });
  } finally {
    connection.release();
  }
});

// PATCH /api/orders/:id/payment-status — Ubah Status Pembayaran (belum_bayar, lunas)
router.patch("/:id/payment-status", requireOrderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { payment_status } = req.body;

    if (payment_status !== 'belum_bayar' && payment_status !== 'lunas') {
      return res.status(400).json({ message: "Status pembayaran tidak valid" });
    }

    const [orders]: any = await connection.query("SELECT * FROM orders WHERE id = ?", [id]);
    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Pesanan tidak ditemukan" });
    }
    const order = orders[0];
    if (order.order_type === 'preorder') {
      await connection.rollback();
      return res.status(409).json({ message: 'Status pembayaran PO harus diubah melalui halaman Pesanan Pre-order' });
    }

    // Saat lunas: status 'menunggu' agar masuk ke kolom "Pesanan Masuk" di KDS
    // Koki yang akan menggeser ke 'sedang_diproses' lewat tombol "Mulai Masak"
    const status = payment_status === 'lunas' ? 'menunggu' : 'menunggu';
    const amountPaid = payment_status === 'lunas' ? order.total_price : 0;

    await connection.query(
      "UPDATE orders SET payment_status = ?, status = ?, amount_paid = ? WHERE id = ?",
      [payment_status, status, amountPaid, id]
    );

    let cashback = 0;
    if (payment_status === 'lunas' && order.payment_status !== 'lunas' && order.user_id) {
      const [users]: any = await connection.query("SELECT nama FROM users WHERE id = ?", [order.user_id]);
      const userName = users && users.length > 0 ? users[0].nama : "Pelanggan";
      cashback = await processLoyaltyPoints(connection, order.user_id, userName, order.invoice_number, order.total_price);
    }

    await connection.commit();

    const [updatedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [id]);
    
    // Log to security audit
    const actor = getVerifiedActor(req);
    await addAuditLog(actor, "Ubah Status Bayar", `${order.invoice_number} (${payment_status})`);

    const io = req.app.get('io');
    if (io && updatedOrder.length > 0) {
      io.emit("order_updated", updatedOrder[0]);
      io.emit("stats_updated");
    }

    res.json(updatedOrder[0]);
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal merubah status pembayaran", error: err.message });
  } finally {
    connection.release();
  }
});

// PATCH /api/orders/:id/status — Ubah Status Pesanan (menunggu, sedang_diproses, ready, selesai, dibatalkan)
router.patch("/:id/status", requireOrderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const { status } = req.body;
    if (!['menunggu', 'sedang_diproses', 'siap', 'selesai', 'dibatalkan'].includes(status)) {
      return res.status(400).json({ message: 'Status pesanan tidak valid' });
    }
    await connection.beginTransaction();
    const [orders]: any = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!orders.length) { await connection.rollback(); return res.status(404).json({ message: 'Pesanan tidak ditemukan' }); }
    const identity = orders[0];
    if (!canUseGenericOrderStatus(identity, status)) {
      await connection.rollback();
      return res.status(409).json({ message: 'Status PO terminal atau pembatalan hanya dapat diubah melalui halaman Pesanan Pre-order' });
    }
    let inventoryChanges: any[] = [];
    if (identity.order_type === 'preorder') {
      const [result]: any = await connection.query(
        "UPDATE orders SET status = ? WHERE id = ? AND preorder_status = 'reserved'",
        [status, req.params.id]
      );
      if (!result.affectedRows) { await connection.rollback(); return res.status(409).json({ message: 'Status PO berubah; muat ulang sebelum mencoba lagi' }); }
    } else {
      if (status === 'dibatalkan') inventoryChanges = await restoreInventoryForOrder(connection, req.params.id, getVerifiedActor(req));
      await connection.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);
    }
    await connection.commit();
    const [updatedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    const actor = getVerifiedActor(req);
    await addAuditLog(actor, "Update Status Pesanan", `${updatedOrder[0].invoice_number} (${status})`);

    const io = req.app.get('io');
    if (io) {
      io.emit("order_updated", updatedOrder[0]);
      io.emit("stats_updated");
      emitInventoryChanges(io, inventoryChanges);
    }
    res.json(updatedOrder[0]);
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal merubah status pesanan", error: err.message });
  } finally {
    connection.release();
  }
});




// DELETE /api/orders/:id — Hapus Pesanan
router.delete("/:id", requireOrderStaff, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();
    const [orders]: any = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!orders.length) { await connection.rollback(); return res.status(404).json({ message: 'Pesanan tidak ditemukan' }); }
    if (orders[0].order_type === 'preorder') {
      await connection.rollback();
      return res.status(409).json({ message: 'Transaksi PO tidak boleh dihapus melalui endpoint pesanan umum' });
    }
    const actor = getVerifiedActor(req);
    const inventoryChanges = await restoreInventoryForOrder(connection, id, actor);
    await connection.query("DELETE FROM order_items WHERE order_id = ?", [id]);
    await connection.query("DELETE FROM orders WHERE id = ?", [id]);
    await connection.commit();
    await addAuditLog(actor, "Hapus Pesanan", `${orders[0].invoice_number}`, "warning");

    const io = req.app.get('io');
    if (io) {
      io.emit("stats_updated");
      emitInventoryChanges(io, inventoryChanges);
    }
    res.json({ message: "Pesanan dihapus dan stok dikembalikan" });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal menghapus pesanan", error: err.message });
  } finally {
    connection.release();
  }
});

export default router;
