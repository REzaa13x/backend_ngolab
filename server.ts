import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import sharp from "sharp";
import fs from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import { db, testDbConnection } from "./src/db/db.js";
import digitalBoardRouter from "./src/routes/digitalBoard.js";
import ordersRouter from "./src/routes/orders.js";
import usersRouter from "./src/routes/users.js";
import coinPromosRouter from "./src/routes/coinPromos.js";
import authRouter from "./src/routes/auth.js";
import staffRouter from "./src/routes/staff.js";
import menuRouter from "./src/routes/menu.js";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  app.use(express.json());

  // Static file serving untuk file upload Papan Digital
  app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

  // ─── Papan Digital API Routes ───────────────────────────────────────────────
  app.use("/api/digital-board", digitalBoardRouter);

  // Test koneksi MySQL
  await testDbConnection();

  // Socket.io Connection Logic
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  // Share IO instance to routers
  app.set('io', io);

  // ─── Real Database API Routes ──────────────────────────────────────────────
  app.use("/api/auth", authRouter);
  app.use("/api/staff", staffRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/coin-promos", coinPromosRouter);
  app.use("/api/menu", menuRouter);

  // Ensure upload directory exists
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Multer config for file upload
  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  // Mock Data
  let users = [
    { id: "1", nama: "Ahmad Fauzi", nim: "2024001", coin_balance: 14250, avatar_url: "https://picsum.photos/seed/user1/100/100" },
    { id: "2", nama: "Siti Aminah", nim: "2024002", coin_balance: 8450, avatar_url: "https://picsum.photos/seed/user2/100/100" },
    { id: "3", nama: "Budi Santoso", nim: "2024003", coin_balance: 21200, avatar_url: "https://picsum.photos/seed/user3/100/100" },
  ];

  let orders = [
    { 
      id: "1", 
      user_id: "1", 
      customer_name: "Ahmad Fauzi",
      invoice_number: "INV-001", 
      total_price: 43000, 
      status: "sedang_diproses", 
      payment_status: "lunas", 
      payment_method: "Transfer Bank (BCA)",
      external_id: "TRX-BCA-99281",
      amount_paid: 43000,
      payment_proof: "https://images.unsplash.com/photo-1554224155-169641357599?w=400&q=80",
      created_at: new Date().toISOString(),
      items: [
        { name: "Mie Yamin Spesial Ayam", quantity: 1, price: 18000 },
        { name: "Mie Bakso Urat Super", quantity: 1, price: 25000 }
      ]
    },
    { 
      id: "2", 
      user_id: "2", 
      customer_name: "Siti Aminah",
      invoice_number: "INV-002", 
      total_price: 32000, 
      status: "menunggu", 
      payment_status: "pending_verifikasi", 
      payment_method: "E-Wallet (Gopay)",
      external_id: "GPY-772182",
      amount_paid: 0,
      payment_proof: "https://images.unsplash.com/photo-1614028674026-a65e31bfd27c?w=400&q=80",
      created_at: new Date().toISOString(),
      items: [
        { name: "Bakso Malang Komplit Ibu Sri", quantity: 1, price: 22000 },
        { name: "Ice Cream Vanilla Oreo", quantity: 1, price: 10000 }
      ]
    },
    { 
      id: "3", 
      user_id: "3", 
      customer_name: "Budi Santoso",
      invoice_number: "INV-003", 
      total_price: 15000, 
      status: "siap", 
      payment_status: "lunas", 
      payment_method: "Tunai",
      external_id: "-",
      amount_paid: 15000,
      payment_proof: null,
      created_at: new Date().toISOString(),
      items: [
        { name: "Kopi Susu Gula Aren Signature", quantity: 1, price: 15000 }
      ]
    },
  ];

  let promotions = [
    { 
      id: "1", 
      title: "Menu Baru: Nasi Lemak Royale", 
      url: "https://picsum.photos/seed/nasilemak/1920/1080", 
      type: "image", 
      duration: 10,
      order_index: 0,
      created_at: new Date().toISOString()
    },
    { 
      id: "2", 
      title: "Promo Hemat: Saldo Bonus 50%", 
      url: "https://picsum.photos/seed/promo/1920/1080", 
      type: "image", 
      duration: 8,
      order_index: 1,
      created_at: new Date().toISOString()
    }
  ];

  // ─── Coin Promo System ──────────────────────────────────────────────────────
  let coinPromos = [
    {
      id: "cp-1",
      title: "Diskon 20% Semua Menu",
      description: "Potongan 20% untuk semua menu makanan dan minuman. Berlaku 1x per transaksi.",
      coin_cost: 500,
      discount_type: "percentage" as const,
      discount_value: 20,
      min_order: 20000,
      max_usage: 100,
      used_count: 23,
      valid_until: "2026-06-30T23:59:59.000Z",
      is_active: true,
      image_url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
      category: "Makanan",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
    },
    {
      id: "cp-2",
      title: "Gratis Es Teh Manis",
      description: "Tukarkan koin Anda untuk mendapatkan 1 Es Teh Manis gratis!",
      coin_cost: 200,
      discount_type: "fixed" as const,
      discount_value: 5000,
      min_order: 0,
      max_usage: 50,
      used_count: 31,
      valid_until: "2026-07-15T23:59:59.000Z",
      is_active: true,
      image_url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80",
      category: "Minuman",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()
    },
    {
      id: "cp-3",
      title: "Cashback Rp 10.000",
      description: "Dapatkan cashback Rp 10.000 untuk pesanan minimum Rp 50.000.",
      coin_cost: 1000,
      discount_type: "fixed" as const,
      discount_value: 10000,
      min_order: 50000,
      max_usage: 30,
      used_count: 12,
      valid_until: "2026-06-15T23:59:59.000Z",
      is_active: true,
      image_url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
      category: "Semua",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString()
    },
    {
      id: "cp-4",
      title: "Beli 1 Gratis 1 Snack",
      description: "Promo spesial! Beli 1 snack gratis 1 snack pilihan.",
      coin_cost: 750,
      discount_type: "percentage" as const,
      discount_value: 50,
      min_order: 10000,
      max_usage: 20,
      used_count: 20,
      valid_until: "2026-05-10T23:59:59.000Z",
      is_active: false,
      image_url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
      category: "Snack",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString()
    },
  ];

  let coinTransactions: Array<{
    id: string; user_id: string; user_name: string; type: 'earn' | 'redeem';
    amount: number; description: string; promo_id?: string; created_at: string;
  }> = [
    { id: "ct-1", user_id: "1", user_name: "Ahmad Fauzi", type: "earn", amount: 2150, description: "Cashback 5% dari INV-001", created_at: new Date(Date.now() - 1000*60*60*2).toISOString() },
    { id: "ct-2", user_id: "2", user_name: "Siti Aminah", type: "earn", amount: 1600, description: "Cashback 5% dari INV-002", created_at: new Date(Date.now() - 1000*60*60*4).toISOString() },
    { id: "ct-3", user_id: "1", user_name: "Ahmad Fauzi", type: "redeem", amount: 500, description: "Tukar: Diskon 20% Semua Menu", promo_id: "cp-1", created_at: new Date(Date.now() - 1000*60*60*6).toISOString() },
    { id: "ct-4", user_id: "3", user_name: "Budi Santoso", type: "earn", amount: 750, description: "Cashback 5% dari INV-003", created_at: new Date(Date.now() - 1000*60*60*8).toISOString() },
    { id: "ct-5", user_id: "3", user_name: "Budi Santoso", type: "redeem", amount: 200, description: "Tukar: Gratis Es Teh Manis", promo_id: "cp-2", created_at: new Date(Date.now() - 1000*60*60*10).toISOString() },
  ];

  // Mock Sales Data for Chart
  const salesData = [
    { day: 'Sen', sales: 1200000 },
    { day: 'Sel', sales: 1500000 },
    { day: 'Rab', sales: 1100000 },
    { day: 'Kam', sales: 1800000 },
    { day: 'Jum', sales: 2200000 },
    { day: 'Sab', sales: 1600000 },
    { day: 'Min', sales: 2500000 },
  ];

  let ingredients = [
    { id: "ing-1", name: "Mie Basah", unit: "Porsi", stock: 100, minStock: 20 },
    { id: "ing-2", name: "Ayam Cincang", unit: "Porsi", stock: 80, minStock: 15 },
    { id: "ing-3", name: "Bakso Halus", unit: "Biji", stock: 250, minStock: 50 },
    { id: "ing-4", name: "Bakso Urat", unit: "Biji", stock: 100, minStock: 20 },
    { id: "ing-5", name: "Pangsit Goreng", unit: "Biji", stock: 150, minStock: 30 },
    { id: "ing-6", name: "Siomay", unit: "Biji", stock: 120, minStock: 20 },
    { id: "ing-7", name: "Sawi Hijau", unit: "Porsi", stock: 100, minStock: 15 },
    { id: "ing-8", name: "Bumbu Rahasia", unit: "Gram", stock: 5000, minStock: 500 },
  ];

  const recipes: Record<string, Record<string, number>> = {
    "Mie Yamin Spesial Ayam": { "ing-1": 1, "ing-2": 1, "ing-7": 1, "ing-8": 50 },
    "Mie Bakso Urat Super": { "ing-1": 1, "ing-3": 2, "ing-4": 1, "ing-7": 1, "ing-8": 40 },
    "Bakso Malang Komplit Ibu Sri": { "ing-3": 3, "ing-5": 2, "ing-6": 1, "ing-1": 0.5, "ing-8": 30 },
    "Nasi Ayam Geprek Level 3": { "ing-8": 20 }, // Simplified
    "Siomay Bandung Asli": { "ing-6": 5 },
    "Batagor Ikan Bandung": { "ing-6": 3, "ing-5": 2 }
  };

  // API Routes
  app.get("/api/users", (req, res) => {
    res.json(users);
  });

  app.get("/api/shifts", (req, res) => {
    res.json([
      { id: 1, staff_id: 'S001', name: 'Admin Bagus', role: 'Admin', shift_type: 'Pagi', time: '08:00 - 16:00', date: new Date().toISOString() }
    ]);
  });

  app.get("/api/sales-data", (req, res) => {
    res.json(salesData);
  });

  app.get("/api/promotions", (req, res) => {
    res.json(promotions.sort((a, b) => a.order_index - b.order_index));
  });

  app.post("/api/promotions/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Tidak ada file yang diunggah" });
      }

      const { title, duration } = req.body;
      const filename = `promo-${Date.now()}.webp`;
      const outputPath = path.join(uploadDir, filename);

      // Digital Signage Optimization: Convert to WebP & Resize (1080p target)
      // This is the middleware logic for image compression
      await sharp(req.file.buffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outputPath);

      // Simulation of returning a cloud storage URL
      // In production, you would upload to AWS S3 / GCS here
      const publicUrl = `/uploads/${filename}`;

      const newPromo = {
        id: Date.now().toString(),
        title: title || "Promosi Baru",
        url: publicUrl,
        type: req.file.mimetype.startsWith('video') ? "video" : "image",
        duration: parseInt(duration) || 10,
        order_index: promotions.length,
        created_at: new Date().toISOString()
      };

      promotions.push(newPromo);
      res.json(newPromo);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Kesalahan server internal saat unggah" });
    }
  });

  app.delete("/api/promotions/:id", (req, res) => {
    const { id } = req.params;
    promotions = promotions.filter(p => p.id !== id);
    res.json({ message: "Dihapus" });
  });

  // ─── Coin Promo API Routes ──────────────────────────────────────────────────
  app.get("/api/coin-promos", (req, res) => {
    res.json(coinPromos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  });

  app.post("/api/coin-promos", (req, res) => {
    const { title, description, coin_cost, discount_type, discount_value, min_order, max_usage, valid_until, image_url, category } = req.body;
    if (!title || !coin_cost || !discount_value) {
      return res.status(400).json({ message: "Judul, biaya koin, dan nilai diskon wajib diisi" });
    }
    const newPromo = {
      id: `cp-${Date.now()}`,
      title, description: description || "",
      coin_cost: parseInt(coin_cost), discount_type: discount_type || "fixed",
      discount_value: parseInt(discount_value), min_order: parseInt(min_order) || 0,
      max_usage: parseInt(max_usage) || 100, used_count: 0,
      valid_until: valid_until || new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      is_active: true, image_url: image_url || "",
      category: category || "Semua",
      created_at: new Date().toISOString()
    };
    coinPromos.push(newPromo);
    addAuditLog("Admin Bagus", "Buat Promo Koin", `${title} (${coin_cost} koin)`);
    res.status(201).json(newPromo);
  });

  app.put("/api/coin-promos/:id", (req, res) => {
    const { id } = req.params;
    const idx = coinPromos.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ message: "Promo tidak ditemukan" });
    coinPromos[idx] = { ...coinPromos[idx], ...req.body, id };
    res.json(coinPromos[idx]);
  });

  app.delete("/api/coin-promos/:id", (req, res) => {
    const { id } = req.params;
    const promo = coinPromos.find(p => p.id === id);
    coinPromos = coinPromos.filter(p => p.id !== id);
    if (promo) addAuditLog("Admin Bagus", "Hapus Promo Koin", promo.title, "warning");
    res.json({ message: "Promo dihapus" });
  });

  app.patch("/api/coin-promos/:id/toggle", (req, res) => {
    const { id } = req.params;
    const promo = coinPromos.find(p => p.id === id);
    if (!promo) return res.status(404).json({ message: "Promo tidak ditemukan" });
    promo.is_active = !promo.is_active;
    res.json(promo);
  });

  app.post("/api/coin-promos/:id/redeem", (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    const promo = coinPromos.find(p => p.id === id);
    if (!promo) return res.status(404).json({ message: "Promo tidak ditemukan" });
    if (!promo.is_active) return res.status(400).json({ message: "Promo tidak aktif" });
    if (promo.used_count >= promo.max_usage) return res.status(400).json({ message: "Kuota promo habis" });
    const user = users.find(u => u.id === user_id);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
    if (user.coin_balance < promo.coin_cost) return res.status(400).json({ message: `Koin tidak cukup. Butuh ${promo.coin_cost}, saldo ${user.coin_balance}` });

    user.coin_balance -= promo.coin_cost;
    promo.used_count += 1;
    const tx = {
      id: `ct-${Date.now()}`, user_id, user_name: user.nama, type: "redeem" as const,
      amount: promo.coin_cost, description: `Tukar: ${promo.title}`, promo_id: id,
      created_at: new Date().toISOString()
    };
    coinTransactions.unshift(tx);
    addAuditLog("Sistem", "Penukaran Promo Koin", `${user.nama} → ${promo.title} (${promo.coin_cost} koin)`);
    io.emit("stats_updated");
    res.json({ message: "Promo berhasil ditukar!", transaction: tx, new_balance: user.coin_balance });
  });

  app.get("/api/users/:id/recommendations", (req, res) => {
    const { id } = req.params;
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });
    const now = new Date();
    const activePromos = coinPromos.filter(p => p.is_active && p.used_count < p.max_usage && new Date(p.valid_until) > now);
    const recommendations = activePromos.map(p => ({
      ...p,
      can_redeem: user.coin_balance >= p.coin_cost,
      coins_needed: Math.max(0, p.coin_cost - user.coin_balance),
      progress: Math.min(100, Math.round((user.coin_balance / p.coin_cost) * 100)),
    })).sort((a, b) => (a.can_redeem === b.can_redeem ? a.coin_cost - b.coin_cost : a.can_redeem ? -1 : 1));
    res.json({ user: { id: user.id, nama: user.nama, coin_balance: user.coin_balance }, recommendations });
  });

  app.get("/api/coin-transactions", (req, res) => {
    const { user_id } = req.query;
    if (user_id) return res.json(coinTransactions.filter(t => t.user_id === user_id));
    res.json(coinTransactions);
  });

  app.get("/api/stats", async (req, res) => {
    const { range } = req.query; // 'day', 'week', 'month'
    try {
      const days = range === 'week' ? 7 : range === 'month' ? 30 : 1;
      
      const [revenueRows]: any = await db.query(
        "SELECT SUM(total_price) AS total FROM orders WHERE payment_status = 'lunas' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)",
        [days]
      );
      const totalRevenue = Number(revenueRows[0]?.total || 0);

      const [pendingRows]: any = await db.query(
        "SELECT COUNT(*) AS count FROM orders WHERE status = 'menunggu'"
      );
      const pendingOrders = Number(pendingRows[0]?.count || 0);

      const [coinRows]: any = await db.query(
        "SELECT SUM(coin_balance) AS total FROM users"
      );
      const distributedCoins = Number(coinRows[0]?.total || 0);

      res.json({ totalRevenue, pendingOrders, distributedCoins });
    } catch (err: any) {
      res.status(500).json({ message: "Gagal mengambil statistik", error: err.message });
    }
  });

  // Logic Verifikasi & Saldo ditangani oleh ordersRouter

  app.get("/api/reports/summary", async (req, res) => {
    try {
      const [allOrders]: any = await db.query("SELECT * FROM orders");
      const totalSales = allOrders.filter((o: any) => o.payment_status === 'lunas').reduce((acc: number, curr: any) => acc + curr.total_price, 0);
      const pendingPayments = allOrders.filter((o: any) => o.payment_status === 'pending_verifikasi').length;
      const totalOrders = allOrders.length;
      
      const insights = {
        totalSales,
        pendingPayments,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0
      };
      
      res.json(insights);
    } catch (err: any) {
      res.status(500).json({ message: "Gagal mengambil ringkasan laporan", error: err.message });
    }
  });

  app.get("/api/reports/monthly", async (req, res) => {
    try {
      const [dbMonthly]: any = await db.query(`
        SELECT 
          DATE_FORMAT(created_at, '%b') AS month_name,
          MONTH(created_at) AS month_num,
          SUM(CASE WHEN payment_status = 'lunas' THEN total_price ELSE 0 END) AS sales,
          COUNT(id) AS orders,
          SUM(CASE WHEN payment_status = 'lunas' THEN 1 ELSE 0 END) AS verified
        FROM orders
        GROUP BY MONTH(created_at), DATE_FORMAT(created_at, '%b')
        ORDER BY MONTH(created_at) ASC
      `);

      const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"];
      const monthlyData = months.map(m => {
        const found = dbMonthly.find((dbRow: any) => dbRow.month_name === m);
        return {
          name: m,
          sales: found ? Number(found.sales) : 0,
          orders: found ? Number(found.orders) : 0,
          verified: found ? Number(found.verified) : 0
        };
      });

      const [dbCategories]: any = await db.query(`
        SELECT 
          COALESCE(m.category, 'Main Course') AS name,
          SUM(oi.price * oi.quantity) AS value
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN menus m ON oi.menu_id = m.id
        WHERE o.payment_status = 'lunas'
        GROUP BY COALESCE(m.category, 'Main Course')
      `);

      const categoryData = dbCategories.map((c: any) => ({
        name: c.name,
        value: Number(c.value)
      }));

      if (categoryData.length === 0) {
        categoryData.push(
          { name: 'Main Course', value: 0 },
          { name: 'Snack', value: 0 },
          { name: 'Beverage', value: 0 }
        );
      }

      res.json({ monthlyData, categoryData });
    } catch (err: any) {
      res.status(500).json({ message: "Gagal mengambil data bulanan", error: err.message });
    }
  });

  const staff = [
    { id: "S001", name: "Bagus Azhar", role: "Admin", email: "bagus@example.com", phone: "08123456789", status: "active" },
    { id: "S002", name: "Siti Rahma", role: "Kasir", email: "siti@example.com", phone: "08123456790", status: "active" },
    { id: "S003", name: "Alif Hidayat", role: "Koki", email: "alif@example.com", phone: "08123456791", status: "active" },
    { id: "S004", name: "Budi Santoso", role: "Koki", email: "budi@example.com", phone: "08123456792", status: "active" },
    { id: "S005", name: "Dedi Irawan", role: "Support", email: "dedi@example.com", phone: "08123456793", status: "active" }
  ];

  const shifts = [
    { id: 1, staff_id: "S002", name: "Siti Rahma", role: "Kasir", shift_type: "Pagi", time: "08:00 - 16:00", date: new Date().toISOString().split("T")[0] },
    { id: 2, staff_id: "S003", name: "Alif Hidayat", role: "Koki", shift_type: "Pagi", time: "08:00 - 16:00", date: new Date().toISOString().split("T")[0] },
    { id: 3, staff_id: "S001", name: "Bagus Azhar", role: "Admin", shift_type: "Full Day", time: "08:00 - 22:00", date: new Date().toISOString().split("T")[0] }
  ];

  let auditLogs = [
    { id: 1, user: "Admin Bagus", action: "Update Stok Produk", target: "Mie Yamin Spesial", timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), status: "success", ip: "192.168.1.10" },
    { id: 2, user: "Kasir Siti", action: "Verifikasi Pembayaran", target: "INV-001", timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), status: "success", ip: "192.168.1.12" },
    { id: 3, user: "Sistem", action: "Sinkronisasi Saldo Koin", target: "User ID: 8821", timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), status: "info", ip: "local" },
    { id: 4, user: "Staf Alif", action: "Update Status KDS", target: "INV-002 (Selesai)", timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(), status: "success", ip: "192.168.1.15" },
    { id: 5, user: "Admin Bagus", action: "Eksport Laporan Bulanan", target: "PDF Generation", timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(), status: "success", ip: "192.168.1.10" },
    { id: 6, user: "Gagal Login", action: "Autentikasi", target: "admin_test", timestamp: new Date(Date.now() - 1000 * 60 * 400).toISOString(), status: "warning", ip: "103.11.22.1" }
  ];

  const addAuditLog = (user: string, action: string, target: string, status: string = 'success') => {
    auditLogs.unshift({
      id: auditLogs.length + 1,
      user,
      action,
      target,
      timestamp: new Date().toISOString(),
      status,
      ip: "192.168.1.10" // Simulating admin IP
    });
    // Keep only last 50 logs
    if (auditLogs.length > 50) auditLogs = auditLogs.slice(0, 50);
  };

  app.get("/api/staff", (req, res) => {
    res.json(staff);
  });
  
  app.post("/api/staff", (req, res) => {
    const { name, role, email, phone } = req.body;
    const newStaff = {
      id: `S${(staff.length + 1).toString().padStart(3, '0')}`,
      name,
      role,
      email,
      phone,
      status: "active"
    };
    staff.push(newStaff);
    addAuditLog("Admin Bagus", "Registrasi Pegawai", `${name} (${role})`);
    res.status(201).json(newStaff);
  });

  app.patch("/api/staff/:id", (req, res) => {
    const { id } = req.params;
    const { role, name, email, phone } = req.body;
    const staffIndex = staff.findIndex(s => s.id === id);
    if (staffIndex !== -1) {
      const oldRole = staff[staffIndex].role;
      staff[staffIndex] = { 
        ...staff[staffIndex], 
        ...(role && { role }),
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone })
      };
      
      const changes = [];
      if (role && role !== oldRole) changes.push(`Role: ${oldRole} -> ${role}`);
      if (name) changes.push(`Nama: ${name}`);
      
      addAuditLog("Admin Bagus", "Update Data Pegawai", `${staff[staffIndex].name} (${changes.join(", ") || "Info Kontak"})`);
      res.json(staff[staffIndex]);
    } else {
      res.status(404).json({ message: "Staff not found" });
    }
  });

  app.delete("/api/staff/:id", (req, res) => {
    const { id } = req.params;
    const staffIndex = staff.findIndex(s => s.id === id);
    if (staffIndex !== -1) {
      const deletedName = staff[staffIndex].name;
      staff.splice(staffIndex, 1);
      addAuditLog("Admin Bagus", "Hapus Pegawai", deletedName, "warning");
      res.json({ message: "Staff deleted" });
    } else {
      res.status(404).json({ message: "Staff not found" });
    }
  });

  app.get("/api/shifts", (req, res) => {
    res.json(shifts);
  });

  app.get("/api/ingredients", (req, res) => {
    res.json(ingredients);
  });

  app.get("/api/ingredients/yield", (req, res) => {
    const yieldCalculations = Object.keys(recipes).map(menuName => {
      const recipe = recipes[menuName];
      let minYield = Infinity;

      for (const [ingId, amount] of Object.entries(recipe)) {
        const ing = ingredients.find(i => i.id === ingId);
        if (ing) {
          const possible = Math.floor(ing.stock / amount);
          if (possible < minYield) minYield = possible;
        } else {
          minYield = 0;
        }
      }

      return {
        name: menuName,
        yield: minYield === Infinity ? 0 : minYield
      };
    });
    res.json(yieldCalculations);
  });

  app.post("/api/ingredients/:id/restock", (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    const ing = ingredients.find(i => i.id === id);
    if (ing) {
      ing.stock += parseFloat(amount);
      addAuditLog("Koki Alif", "Restock Bahan Baku", `${ing.name} (+${amount} ${ing.unit})`);
      res.json(ing);
    } else {
      res.status(404).json({ message: "Ingredient not found" });
    }
  });

  app.post("/api/shifts", (req, res) => {
    const { staff_id, shift_type, time } = req.body;
    const selectedStaff = staff.find(s => s.id === staff_id);
    
    if (!selectedStaff) {
      return res.status(404).json({ error: "Staff not found" });
    }

    const newShift = {
      id: shifts.length + 1,
      staff_id,
      name: selectedStaff.name,
      role: selectedStaff.role,
      shift_type,
      time,
      date: new Date().toISOString().split('T')[0]
    };

    shifts.push(newShift);
    addAuditLog("Admin Bagus", "Penetapan Shift", `${selectedStaff.name} (${shift_type})`);
    res.json(newShift);
  });

  app.get("/api/audit-logs", (req, res) => {
    res.json(auditLogs);
  });

  app.post("/api/orders/simulate", async (req, res) => {
    try {
      const [dbUsers]: any = await db.query("SELECT * FROM users");
      const [dbMenus]: any = await db.query("SELECT * FROM menus WHERE outlet = 'ngolab'");

      const usersList = dbUsers.length > 0 ? dbUsers : [
        { id: "1", nama: "Ahmad Fauzi", NIM: "2024001", coin_balance: 14250 }
      ];
      const menusList = dbMenus.length > 0 ? dbMenus : [
        { id: "1", name: "Mie Yamin Spesial Ayam", price: 18000, category: "Main Course" },
        { id: "2", name: "Es Teh Manis", price: 5000, category: "Beverage" }
      ];

      const randomUser = usersList[Math.floor(Math.random() * usersList.length)];
      const randomItemsCount = Math.floor(Math.random() * 3 + 1);
      const orderItems = [];
      let totalPrice = 0;

      for (let i = 0; i < randomItemsCount; i++) {
        const item = menusList[Math.floor(Math.random() * menusList.length)];
        orderItems.push({ 
          id: item.id || "1", 
          name: item.name, 
          quantity: 1, 
          price: item.price 
        });
        totalPrice += item.price;
      }

      const methods = ["Transfer Bank (BCA)", "E-Wallet (OVO)", "E-Wallet (Dana)", "Tunai", "QRIS"];
      const statusOptions = ["pending_verifikasi", "belum_bayar", "lunas"];
      const proofs = [
        "https://images.unsplash.com/photo-1554224155-169641357599?w=400&q=80",
        "https://images.unsplash.com/photo-1614028674026-a65e31bfd27c?w=400&q=80",
        "https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=400&q=80"
      ];

      const randomMethod = methods[Math.floor(Math.random() * methods.length)];
      const randomStatus = statusOptions[Math.floor(Math.random() * statusOptions.length)];

      const orderId = Date.now().toString();
      const invoiceNumber = `INV-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const amountPaid = randomStatus === 'lunas' ? totalPrice : 0;
      const externalId = randomMethod === "Tunai" ? "-" : `EXT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const paymentProof = (randomMethod !== "Tunai" && randomStatus !== "belum_bayar") ? proofs[Math.floor(Math.random() * proofs.length)] : null;

      // Save simulated order to MySQL DB
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `INSERT INTO orders (id, user_id, customer_name, invoice_number, total_price, status, payment_status, payment_method, amount_paid, external_id, payment_proof, created_at, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
          [
            orderId, 
            randomUser.id || null, 
            randomUser.nama, 
            invoiceNumber, 
            totalPrice, 
            "menunggu", 
            randomStatus, 
            randomMethod, 
            amountPaid, 
            externalId, 
            paymentProof, 
            "ngolab"
          ]
        );

        for (const item of orderItems) {
          await connection.query(
            "INSERT INTO order_items (order_id, menu_id, item_name, quantity, price) VALUES (?, ?, ?, ?, ?)",
            [orderId, item.id, item.name, item.quantity, item.price]
          );
        }

        await connection.commit();
      } catch (dbErr) {
        await connection.rollback();
        throw dbErr;
      } finally {
        connection.release();
      }

      // Fetch the created order to send over Socket.io
      const [insertedOrder]: any = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
      insertedOrder[0].items = orderItems;

      io.emit("new_order", insertedOrder[0]);
      io.emit("stats_updated");

      res.json(insertedOrder[0]);
    } catch (err: any) {
      console.error("Order simulation error:", err);
      res.status(500).json({ message: "Gagal mensimulasikan pesanan", error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
