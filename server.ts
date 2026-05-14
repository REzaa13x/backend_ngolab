import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import sharp from "sharp";
import fs from "fs";
import { createServer } from "http";
import { Server } from "socket.io";

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

  // Socket.io Connection Logic
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

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

  let menuItems = [
    { id: 1, name: 'Mie Yamin Spesial Ayam', category: 'Main Course', price: 18000, inStock: true, stock: 45, image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=600&auto=format&fit=crop' },
    { id: 2, name: 'Bakso Malang Komplit Ibu Sri', category: 'Main Course', price: 22000, inStock: true, stock: 30, image: 'https://images.unsplash.com/photo-1593504049359-74330189a345?q=80&w=600&auto=format&fit=crop' },
    { id: 3, name: 'Es Teh Manis Melati', category: 'Beverage', price: 5000, inStock: true, stock: 100, image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=600&auto=format&fit=crop' },
    { id: 4, name: 'Kopi Susu Gula Aren Signature', category: 'Beverage', price: 15000, inStock: true, stock: 80, image: 'https://images.unsplash.com/photo-1541167760496-162955ed8a9f?q=80&w=600&auto=format&fit=crop' },
    { id: 5, name: 'Kentang Goreng Krispi Mayo', category: 'Snack', price: 12000, inStock: true, stock: 50, image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=600&auto=format&fit=crop' },
    { id: 6, name: 'Ice Cream Vanilla Oreo', category: 'Snack', price: 10000, inStock: true, stock: 25, image: 'https://images.unsplash.com/photo-1560008447-51147046e10f?q=80&w=600&auto=format&fit=crop' },
    { id: 7, name: 'Jus Alpukat Mentega Spesial', category: 'Beverage', price: 17000, inStock: true, stock: 15, image: 'https://images.unsplash.com/photo-1582294121287-ba8e99994966?q=80&w=600&auto=format&fit=crop' },
    { id: 8, name: 'Siomay Bandung Asli', category: 'Snack', price: 15000, inStock: true, stock: 40, image: 'https://images.unsplash.com/photo-1626074353765-4a75a771d48f?q=80&w=600&auto=format&fit=crop' },
    { id: 9, name: 'Roti Bakar Cokelat Keju', category: 'Snack', price: 12000, inStock: true, stock: 20, image: 'https://images.unsplash.com/photo-1584947848227-024505f99371?q=80&w=600&auto=format&fit=crop' },
    { id: 10, name: 'Nasi Ayam Geprek Level 3', category: 'Main Course', price: 20000, inStock: true, stock: 35, image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=600&auto=format&fit=crop' },
    { id: 11, name: 'Ice Cream Strawberry Hills', category: 'Snack', price: 10000, inStock: true, stock: 15, image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?q=80&w=600&auto=format&fit=crop' },
    { id: 12, name: 'Es Jeruk Peras Segar', category: 'Beverage', price: 8000, inStock: true, stock: 60, image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?q=80&w=600&auto=format&fit=crop' },
    { id: 13, name: 'Mie Bakso Urat Super', category: 'Main Course', price: 25000, inStock: true, stock: 20, image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=600&auto=format&fit=crop' },
    { id: 14, name: 'Batagor Ikan Bandung', category: 'Snack', price: 15000, inStock: true, stock: 30, image: 'https://images.unsplash.com/photo-1626074353765-4a75a771d48f?q=80&w=600&auto=format&fit=crop' },
  ];

  // API Routes
  app.get("/api/users", (req, res) => {
    res.json(users);
  });

  app.get("/api/orders", (req, res) => {
    res.json(orders);
  });

  app.get("/api/sales-data", (req, res) => {
    res.json(salesData);
  });

  app.get("/api/menu", (req, res) => {
    const { category } = req.query;
    if (category && category !== 'Semua') {
      const filtered = menuItems.filter(item => item.category === category);
      return res.json(filtered);
    }
    res.json(menuItems);
  });

  app.post("/api/menu", (req, res) => {
    const { name, category, price, stock, image } = req.body;
    
    if (!name || !category || !price) {
      return res.status(400).json({ message: "Nama, kategori, dan harga wajib diisi" });
    }

    const newItem = {
      id: menuItems.length > 0 ? Math.max(...menuItems.map(m => m.id)) + 1 : 1,
      name,
      category,
      price: parseInt(price),
      inStock: parseInt(stock) > 0,
      stock: parseInt(stock) || 0,
      image: image || `https://picsum.photos/seed/${name.replace(/\s+/g, '')}/400/300`
    };

    menuItems.push(newItem);
    res.status(201).json(newItem);
  });

  app.put("/api/menu/:id", (req, res) => {
    const { id } = req.params;
    const { name, category, price, stock, image } = req.body;
    const itemIndex = menuItems.findIndex(item => item.id === parseInt(id));

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    menuItems[itemIndex] = {
      ...menuItems[itemIndex],
      name: name || menuItems[itemIndex].name,
      category: category || menuItems[itemIndex].category,
      price: price ? parseInt(price) : menuItems[itemIndex].price,
      stock: stock !== undefined ? parseInt(stock) : menuItems[itemIndex].stock,
      image: image || menuItems[itemIndex].image,
      inStock: stock !== undefined ? parseInt(stock) > 0 : menuItems[itemIndex].inStock
    };

    res.json(menuItems[itemIndex]);
  });

  app.patch("/api/menu/:id/toggle-stock", (req, res) => {
    const { id } = req.params;
    const itemIndex = menuItems.findIndex(item => item.id === parseInt(id));
    
    if (itemIndex !== -1) {
      const currentItem = menuItems[itemIndex];
      currentItem.inStock = !currentItem.inStock;
      
      // Update stock count based on availability status
      if (!currentItem.inStock) {
        currentItem.stock = 0;
      } else {
        // Set to a default value if replenished
        currentItem.stock = 20; 
      }
      
      res.json({ success: true, item: currentItem });
    } else {
      res.status(404).json({ success: false, message: "Menu tidak ditemukan" });
    }
  });

  app.get("/api/orders", (req, res) => {
    res.json(orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  });

  app.get("/api/orders/kds", (req, res) => {
    // Only return paid and not finished orders for kitchen
    const kdsOrders = orders.filter(o => o.payment_status === 'lunas' && o.status !== 'selesai');
    res.json(kdsOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
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

  app.get("/api/stats", (req, res) => {
    const { range } = req.query; // 'day', 'week', 'month'
    
    // In a real database, we would filter by created_at
    // We'll simulate data variation based on range
    let multiplier = 1;
    if (range === 'week') multiplier = 7;
    if (range === 'month') multiplier = 30;

    const baseRevenue = orders.filter(o => o.payment_status === 'lunas').reduce((acc, o) => acc + o.total_price, 0);
    const totalRevenue = baseRevenue * multiplier;
    const pendingOrders = orders.filter(o => o.status === 'menunggu').length;
    const distributedCoins = users.reduce((acc, u) => acc + u.coin_balance, 0);
    
    res.json({ totalRevenue, pendingOrders, distributedCoins });
  });

  // Logic Verifikasi & Saldo
  app.post("/api/orders/:id/verify", (req, res) => {
    const { id } = req.params;
    const orderIndex = orders.findIndex(o => o.id === id);

    if (orderIndex === -1) {
      return res.status(404).json({ message: "Pesanan tidak ditemukan" });
    }

    const order = orders[orderIndex];

    if (order.payment_status === 'lunas') {
      return res.status(400).json({ message: "Pesanan sudah lunas" });
    }

    // Update Order Status
    order.payment_status = 'lunas';
    order.status = 'sedang_diproses';
    order.payment_method = req.body.payment_method || order.payment_method || 'QRIS';
    order.amount_paid = req.body.amount_paid || order.total_price;

    // Deplete Ingredients based on Recipes
    order.items.forEach(item => {
      const recipe = recipes[item.name];
      if (recipe) {
        for (const [ingId, amount] of Object.entries(recipe)) {
          const ing = ingredients.find(i => i.id === ingId);
          if (ing) {
            ing.stock = Math.max(0, ing.stock - (amount * item.quantity));
          }
        }
      }
    });

    // Calculate 5% Koin Cashback
    const cashback = Math.floor(order.total_price * 0.05);
    
    addAuditLog(
      "Kasir Siti", 
      "Verifikasi Pembayaran", 
      `${order.invoice_number} (${order.payment_method} - Rp ${order.total_price.toLocaleString()})`
    );
    // Update User Balance
    const userIndex = users.findIndex(u => u.id === order.user_id);
    if (userIndex !== -1) {
      users[userIndex].coin_balance += cashback;
    }

    // REAL-TIME: Emit event to KDS and any listening clients
    // We emit "order_updated" instead of "new_order" here to differentiate 
    // from a fresh order that might still be pending
    io.emit("order_updated", order);
    io.emit("stats_updated");

    res.json({ message: "Pesanan telah diverifikasi dan koin telah ditambahkan", order, cashback });
  });

  app.post("/api/orders/:id/reject", (req, res) => {
    const { id } = req.params;
    const orderIndex = orders.findIndex(o => o.id === id);

    if (orderIndex === -1) {
      return res.status(404).json({ message: "Pesanan tidak ditemukan" });
    }

    const order = orders[orderIndex];
    order.payment_status = 'ditolak';
    order.status = 'dibatalkan';

    io.emit("order_updated", order);
    io.emit("stats_updated");

    res.json({ message: "Pesanan telah ditolak", order });
  });

  app.get("/api/reports/summary", (req, res) => {
    const totalSales = orders.filter(o => o.payment_status === 'lunas').reduce((acc, curr) => acc + curr.total_price, 0);
    const pendingPayments = orders.filter(o => o.payment_status === 'pending_verifikasi').length;
    const totalOrders = orders.length;
    
    // Group by category from menuItems for some insights
    const insights = {
      totalSales,
      pendingPayments,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0
    };
    
    res.json(insights);
  });

  app.post("/api/orders/manual", (req, res) => {
    const { customer_name, items, payment_method, payment_status } = req.body;

    if (!customer_name || !items || items.length === 0) {
      return res.status(400).json({ message: "Data pesanan tidak lengkap" });
    }

    let totalPrice = 0;
    const orderItems = items.map((item: any) => {
      const menuItem = menuItems.find(m => m.id === item.id);
      const price = menuItem ? menuItem.price : 0;
      totalPrice += price * item.quantity;
      return {
        name: menuItem ? menuItem.name : item.name,
        quantity: item.quantity,
        price: price
      };
    });

    const newOrder = {
      id: Date.now().toString(),
      user_id: "staff-manual", // Staff created order
      customer_name,
      invoice_number: `INV-TELP-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      total_price: totalPrice,
      status: payment_status === 'lunas' ? 'sedang_diproses' : 'menunggu',
      payment_status: payment_status || 'belum_bayar',
      payment_method: payment_method || 'Tunai',
      amount_paid: payment_status === 'lunas' ? totalPrice : 0,
      external_id: "MANUAL",
      payment_proof: null,
      created_at: new Date().toISOString(),
      items: orderItems
    };

    orders.push(newOrder);

    // If paid immediately, deplete ingredients
    if (payment_status === 'lunas') {
      newOrder.items.forEach(item => {
        const recipe = recipes[item.name];
        if (recipe) {
          for (const [ingId, amount] of Object.entries(recipe)) {
            const ing = ingredients.find(i => i.id === ingId);
            if (ing) {
              ing.stock = Math.max(0, ing.stock - (amount * item.quantity));
            }
          }
        }
      });
    }

    addAuditLog(
      "Admin Bagus", 
      "Pesanan Manual (Telp/Offline)", 
      `${newOrder.invoice_number} - ${customer_name} (Rp ${totalPrice.toLocaleString()})`
    );

    io.emit("new_order", newOrder);
    if (payment_status === 'lunas') io.emit("order_updated", newOrder);
    io.emit("stats_updated");

    res.status(201).json(newOrder);
  });

  app.get("/api/reports/monthly", (req, res) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"];
    const monthlyData = months.map((month, index) => ({
      name: month,
      sales: Math.floor(Math.random() * 500000) + 1000000,
      orders: Math.floor(Math.random() * 50) + 100,
      verified: Math.floor(Math.random() * 40) + 80
    }));
    
    const categoryData = [
      { name: 'Main Course', value: 4500000 },
      { name: 'Snack', value: 2100000 },
      { name: 'Beverage', value: 1800000 }
    ];

    res.json({ monthlyData, categoryData });
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

  app.post("/api/orders/simulate", (req, res) => {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const randomItemsCount = Math.floor(Math.random() * 3 + 1);
    const orderItems = [];
    let totalPrice = 0;

    for (let i = 0; i < randomItemsCount; i++) {
      const item = menuItems[Math.floor(Math.random() * menuItems.length)];
      orderItems.push({ name: item.name, quantity: 1, price: item.price });
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

    const newOrder = {
      id: Date.now().toString(),
      user_id: randomUser.id,
      customer_name: randomUser.nama,
      invoice_number: `INV-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      total_price: totalPrice,
      status: "menunggu",
      payment_status: randomStatus,
      payment_method: randomMethod,
      amount_paid: randomStatus === 'lunas' ? totalPrice : 0,
      external_id: randomMethod === "Tunai" ? "-" : `EXT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      payment_proof: (randomMethod !== "Tunai" && randomStatus !== "belum_bayar") ? proofs[Math.floor(Math.random() * proofs.length)] : null,
      created_at: new Date().toISOString(),
      items: orderItems
    };
    orders.push(newOrder);
    io.emit("new_order", newOrder);
    res.json(newOrder);
  });

  app.patch("/api/orders/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'siap', 'selesai'
    const order = orders.find(o => o.id === id);
    if (order) {
      order.status = status;
      io.emit("order_status_updated", order);
      res.json(order);
    } else {
      res.status(404).json({ message: "Not found" });
    }
  });

  app.delete("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    orders = orders.filter(o => o.id !== id);
    io.emit("stats_updated");
    res.json({ message: "Dihapus" });
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
