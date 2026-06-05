import { Router, Request, Response } from "express";
import { db, addAuditLog } from "../db/db.js";
import { authApiKey } from "../middleware/authApiKey.js";

const router = Router();

// ==========================================
// 1. ORDERS API
// ==========================================

// GET /api/orders — Ambil semua pesanan
router.get("/", async (_req: Request, res: Response) => {
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
router.get("/kds", async (_req: Request, res: Response) => {
  try {
    const [orders]: any = await db.query(
      "SELECT * FROM orders WHERE payment_status = 'lunas' AND status != 'selesai' ORDER BY created_at ASC"
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

// POST /api/orders/manual — Buat pesanan baru (dari admin/telp/kiosk)
router.post("/manual", async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { customer_name, items, payment_method, payment_status, source } = req.body;

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

    const finalSource = source || 'ngolab';

    await connection.query(
      `INSERT INTO orders (id, user_id, customer_name, invoice_number, total_price, status, payment_status, payment_method, amount_paid, external_id, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId, 
        null, // manual order tidak spesifik user untuk sekarang, jika ada user_id bisa di set
        customer_name, invoiceNumber, totalPrice, status, finalPaymentStatus, 
        payment_method || 'Tunai', amountPaid, "MANUAL", finalSource
      ]
    );

    for (const item of orderItems) {
      await connection.query(
        "INSERT INTO order_items (order_id, menu_id, item_name, quantity, price) VALUES (?, ?, ?, ?, ?)",
        [orderId, item.menu_id, item.item_name, item.quantity, item.price]
      );
    }

    await connection.commit();

    // Fetch the inserted order to return
    const [insertedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
    insertedOrder[0].items = orderItems.map((i: any) => ({
      id: i.menu_id, name: i.item_name, quantity: i.quantity, price: i.price
    }));

    // Log to security audit
    const actor = (req.headers["x-user-name"] as string) || "Kasir";
    await addAuditLog(actor, "Buat Pesanan Manual", `${invoiceNumber} (${customer_name})`);

    const io = req.app.get('io');
    if (io) {
      io.emit("new_order", insertedOrder[0]);
      if (finalPaymentStatus === 'lunas') io.emit("order_updated", insertedOrder[0]);
      io.emit("stats_updated");
    }

    res.status(201).json(insertedOrder[0]);
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal membuat pesanan", error: err.message });
  } finally {
    connection.release();
  }
});

// POST /api/orders/external — Endpoint Master untuk Aplikasi Eksternal (contoh: Smart Tag QR)
router.post("/external", authApiKey, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { customer_name, items, payment_method, payment_status, total_price, external_id, source } = req.body;

    if (!customer_name || !items || items.length === 0) {
      return res.status(400).json({ message: "Data pesanan tidak lengkap" });
    }

    const orderId = Date.now().toString();
    const invoiceNumber = external_id || `EXT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const finalPaymentStatus = payment_status || 'belum_bayar'; // Default ke belum_bayar agar diverifikasi Kasir terlebih dahulu
    const status = finalPaymentStatus === 'lunas' ? 'sedang_diproses' : 'menunggu';
    const amountPaid = finalPaymentStatus === 'lunas' ? total_price : 0;
    const finalSource = source || 'ngolab';

    await connection.query(
      `INSERT INTO orders (id, user_id, customer_name, invoice_number, total_price, status, payment_status, payment_method, amount_paid, external_id, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId, 
        null, 
        customer_name, invoiceNumber, total_price, status, finalPaymentStatus, 
        payment_method || 'QRIS', amountPaid, external_id || "EXTERNAL", finalSource
      ]
    );

    for (const item of items) {
      await connection.query(
        "INSERT INTO order_items (order_id, menu_id, item_name, quantity, price) VALUES (?, ?, ?, ?, ?)",
        [orderId, item.id || item.menu_id || null, item.name || item.item_name, item.quantity, item.price]
      );
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
    }

    res.status(201).json({ message: "Pesanan berhasil diterima", order: insertedOrder[0] });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ message: "Gagal memproses pesanan eksternal", error: err.message });
  } finally {
    connection.release();
  }
});

// GET /api/orders/external/history — Endpoint Riwayat untuk Aplikasi Eksternal (contoh: Smart Tag QR)
router.get("/external/history", authApiKey, async (req: Request, res: Response) => {
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
router.get("/external/incoming", authApiKey, async (req: Request, res: Response) => {
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
router.post("/:id/verify", async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    const [orders]: any = await connection.query("SELECT * FROM orders WHERE id = ?", [id]);
    if (!orders.length) return res.status(404).json({ message: "Pesanan tidak ditemukan" });
    
    const order = orders[0];
    if (order.payment_status === 'lunas') {
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

    // Koin Cashback Logic (5%)
    let cashback = 0;
    if (order.user_id) {
      cashback = Math.floor(order.total_price * 0.05);
      await connection.query("UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?", [cashback, order.user_id]);
      
      const [users]: any = await connection.query("SELECT nama FROM users WHERE id = ?", [order.user_id]);
      const userName = users && users.length > 0 ? users[0].nama : "Pelanggan";
      
      await connection.query(
        "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, ?)",
        [`ct-${Date.now()}`, order.user_id, userName, cashback, `Cashback 5% dari ${order.invoice_number}`]
      );
    }

    await connection.commit();

    const [updatedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [id]);
    
    // Log to security audit
    const actor = (req.headers["x-user-name"] as string) || "Kasir";
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
router.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    await db.query("UPDATE orders SET payment_status = 'ditolak', status = 'dibatalkan' WHERE id = ?", [req.params.id]);
    const [updatedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    
    // Log to security audit
    const actor = (req.headers["x-user-name"] as string) || "Kasir";
    await addAuditLog(actor, "Tolak Pesanan", `${updatedOrder[0].invoice_number} (Dibatalkan)`, "warning");

    const io = req.app.get('io');
    if (io) {
      io.emit("order_updated", updatedOrder[0]);
      io.emit("stats_updated");
    }
    res.json({ message: "Pesanan telah ditolak", order: updatedOrder[0] });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menolak pesanan", error: err.message });
  }
});

// PATCH /api/orders/:id/payment-status — Ubah Status Pembayaran (belum_bayar, lunas)
router.patch("/:id/payment-status", async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { payment_status } = req.body;

    if (payment_status !== 'belum_bayar' && payment_status !== 'lunas') {
      return res.status(400).json({ message: "Status pembayaran tidak valid" });
    }

    const [orders]: any = await connection.query("SELECT * FROM orders WHERE id = ?", [id]);
    if (!orders.length) return res.status(404).json({ message: "Pesanan tidak ditemukan" });
    const order = orders[0];

    // Saat lunas: status 'menunggu' agar masuk ke kolom "Pesanan Masuk" di KDS
    // Koki yang akan menggeser ke 'sedang_diproses' lewat tombol "Mulai Masak"
    const status = payment_status === 'lunas' ? 'menunggu' : 'menunggu';
    const amountPaid = payment_status === 'lunas' ? order.total_price : 0;

    await connection.query(
      "UPDATE orders SET payment_status = ?, status = ?, amount_paid = ? WHERE id = ?",
      [payment_status, status, amountPaid, id]
    );

    let cashback = 0;
    if (payment_status === 'lunas' && order.user_id) {
      cashback = Math.floor(order.total_price * 0.05);
      await connection.query("UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?", [cashback, order.user_id]);
      
      const [users]: any = await connection.query("SELECT nama FROM users WHERE id = ?", [order.user_id]);
      const userName = users && users.length > 0 ? users[0].nama : "Pelanggan";
      
      await connection.query(
        "INSERT INTO coin_transactions (id, user_id, user_name, type, amount, description) VALUES (?, ?, ?, 'earn', ?, ?)",
        [`ct-${Date.now()}`, order.user_id, userName, cashback, `Cashback 5% dari ${order.invoice_number}`]
      );
    }

    await connection.commit();

    const [updatedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [id]);
    
    // Log to security audit
    const actor = (req.headers["x-user-name"] as string) || "Kasir";
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
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    await db.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);
    const [updatedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    
    // Log to security audit
    const actor = (req.headers["x-user-name"] as string) || "Kasir/Koki";
    if (updatedOrder.length > 0) {
      await addAuditLog(actor, "Update Status Pesanan", `${updatedOrder[0].invoice_number} (${status})`);
    }

    const io = req.app.get('io');
    if (io && updatedOrder.length > 0) {
      io.emit("order_updated", updatedOrder[0]);
      io.emit("stats_updated");
    }
    res.json(updatedOrder[0]);
  } catch (err: any) {
    res.status(500).json({ message: "Gagal merubah status pesanan", error: err.message });
  }
});




// DELETE /api/orders/:id — Hapus Pesanan
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = (req.headers["x-user-name"] as string) || "Admin";
    const [orderData]: any = await db.query("SELECT invoice_number FROM orders WHERE id = ?", [id]);
    const inv = orderData.length ? orderData[0].invoice_number : id;

    // Delete items first
    await db.query("DELETE FROM order_items WHERE order_id = ?", [id]);
    await db.query("DELETE FROM orders WHERE id = ?", [id]);
    
    await addAuditLog(actor, "Hapus Pesanan", `${inv}`, "warning");

    const io = req.app.get('io');
    if (io) {
      io.emit("stats_updated");
    }
    res.json({ message: "Pesanan dihapus" });
  } catch (err: any) {
    res.status(500).json({ message: "Gagal menghapus pesanan", error: err.message });
  }
});

export default router;
