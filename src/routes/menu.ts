import { Router, Request, Response } from "express";
import { db, addAuditLog } from "../db/db.js";
import fs from "fs";
import path from "path";

// Helper function to save base64 image string as a physical file on the server
function saveBase64Image(base64Str: string): string {
  if (!base64Str || !base64Str.startsWith("data:image/")) {
    return base64Str;
  }

  try {
    const matches = base64Str.match(/^data:image\/([A-Za-z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Str;
    }

    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, "base64");

    const uploadDir = path.join(process.cwd(), "public", "uploads", "menus");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `menu-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, buffer);
    return `/uploads/menus/${fileName}`;
  } catch (error) {
    console.error("⚠️ Gagal menyimpan gambar base64:", error);
    return base64Str;
  }
}

const router = Router();

// GET /api/menu — Ambil daftar menu dengan filter opsional (category, outlet)
router.get("/", async (req: Request, res: Response) => {
  const { category, outlet } = req.query;
  
  const SMART_TAG_API = "http://192.168.1.11:5000";
  let fetchedFromExternal = false;
  let formattedMenus: any[] = [];

  // Check if request is an external API call from your friend's app using the API Key
  const isExternalRequest = req.header('x-api-key') === (process.env.EXTERNAL_API_KEY || 'tangolab-secret-key-2026');

  if (outlet === "ngolab" && !isExternalRequest) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5 seconds timeout

      const response = await fetch(`${SMART_TAG_API}/api/menu`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const externalData: any = await response.json();
        formattedMenus = externalData.map((item: any) => {
          let imageUrl = item.image_url;
          if (imageUrl && imageUrl.startsWith('/')) {
            imageUrl = `${SMART_TAG_API}${imageUrl}`;
          } else if (!imageUrl) {
            imageUrl = `https://picsum.photos/seed/${item.name.replace(/\s+/g, '')}/400/300`;
          }

          return {
            id: item.id,
            name: item.name,
            category: item.category || "Main Course",
            price: parseFloat(item.price) || 0,
            inStock: item.status === "Tersedia",
            stock: item.stock || 0,
            outlet: "ngolab",
            image: imageUrl,
            description: item.description || item.deskripsi || "",
            deskripsi: item.description || item.deskripsi || ""
          };
        });

        // Apply category filter if requested
        if (category && category !== "Semua") {
          formattedMenus = formattedMenus.filter((m: any) => m.category === category);
        }

        fetchedFromExternal = true;
        console.log("⚡ Menampilkan menu real-time dari Smart Tag (tanpa database).");
      }
    } catch (err: any) {
      console.warn("⚠️ Koneksi ke Smart Tag gagal/timeout, beralih ke database lokal:", err.message);
    }
  }

  if (!fetchedFromExternal) {
    try {
      let query = "SELECT * FROM menus WHERE 1=1";
      const params: any[] = [];

      if (outlet) {
        query += " AND outlet = ?";
        params.push(outlet);
      }
      if (category && category !== "Semua") {
        query += " AND category = ?";
        params.push(category);
      }

      query += " ORDER BY created_at DESC";

      const [menus]: any = await db.query(query, params);
      
      formattedMenus = menus.map((m: any) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        price: m.price,
        inStock: Boolean(m.in_stock),
        status: m.in_stock ? "Tersedia" : "Habis",
        stock: m.stock,
        outlet: m.outlet,
        image: m.image_url,
        description: m.description || "",
        deskripsi: m.description || ""
      }));
    } catch (error: any) {
      return res.status(500).json({ message: "Gagal mengambil data menu", error: error.message });
    }
  }

  res.json(formattedMenus);
});

// POST /api/menu — Tambah menu baru
router.post("/", async (req: Request, res: Response) => {
  const { name, category, price, stock, image, outlet, description } = req.body;
  
  if (!name || !category || !price) {
    return res.status(400).json({ message: "Nama, kategori, dan harga wajib diisi" });
  }

  try {
    const newId = Date.now().toString();
    const isStock = parseInt(stock) > 0 ? 1 : 0;
    const stockVal = parseInt(stock) || 0;
    const outletVal = outlet || "ngolab";
    const imageVal = saveBase64Image(image) || `https://picsum.photos/seed/${name.replace(/\s+/g, '')}/400/300`;

    await db.query(
      "INSERT INTO menus (id, name, category, price, in_stock, stock, outlet, image_url, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [newId, name, category, parseInt(price), isStock, stockVal, outletVal, imageVal, description || ""]
    );

    // Log to security audit
    const actor = (req.headers["x-user-name"] as string) || "Koki";
    await addAuditLog(actor, "Tambah Menu Baru", `${name} (${outletVal})`);

    res.status(201).json({
      id: newId,
      name,
      category,
      price: parseInt(price),
      inStock: Boolean(isStock),
      stock: stockVal,
      outlet: outletVal,
      image: imageVal,
      description: description || ""
    });
  } catch (error: any) {
    res.status(500).json({ message: "Gagal menambahkan menu", error: error.message });
  }
});

// PUT /api/menu/:id — Update menu
router.put("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, category, price, stock, image, description } = req.body;

  try {
    const [existing]: any = await db.query("SELECT * FROM menus WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Menu tidak ditemukan" });
    }

    const current = existing[0];
    const newName = name || current.name;
    const newCategory = category || current.category;
    const newPrice = price !== undefined ? parseInt(price) : current.price;
    const newStock = stock !== undefined ? parseInt(stock) : current.stock;
    const newInStock = newStock > 0 ? 1 : (stock !== undefined ? 0 : current.in_stock);
    const newImage = image ? saveBase64Image(image) : current.image_url;
    const newDescription = description !== undefined ? description : current.description;

    await db.query(
      "UPDATE menus SET name=?, category=?, price=?, in_stock=?, stock=?, image_url=?, description=? WHERE id=?",
      [newName, newCategory, newPrice, newInStock, newStock, newImage, newDescription, id]
    );

    // Log to security audit
    const actor = (req.headers["x-user-name"] as string) || "Koki";
    await addAuditLog(actor, "Update Menu", `${newName}`);

    res.json({
      id,
      name: newName,
      category: newCategory,
      price: newPrice,
      inStock: Boolean(newInStock),
      stock: newStock,
      outlet: current.outlet,
      image: newImage,
      description: newDescription || ""
    });
  } catch (error: any) {
    res.status(500).json({ message: "Gagal memperbarui menu", error: error.message });
  }
});

// DELETE /api/menu/:id — Hapus menu
router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const actor = (req.headers["x-user-name"] as string) || "Koki";
    const [menuData]: any = await db.query("SELECT name FROM menus WHERE id = ?", [id]);
    const nameVal = menuData.length ? menuData[0].name : id;

    const [result]: any = await db.query("DELETE FROM menus WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Menu tidak ditemukan" });
    }
    
    await addAuditLog(actor, "Hapus Menu", `${nameVal}`, "warning");
    res.json({ message: "Menu berhasil dihapus" });
  } catch (error: any) {
    res.status(500).json({ message: "Gagal menghapus menu", error: error.message });
  }
});

// PATCH /api/menu/:id/toggle-stock — Toggle in_stock
router.patch("/:id/toggle-stock", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [existing]: any = await db.query("SELECT * FROM menus WHERE id = ?", [id]);
    
    // Jika tidak ditemukan di database lokal, berarti menu eksternal dari teman kita!
    if (existing.length === 0) {
      const SMART_TAG_API = "http://192.168.1.11:5000";
      try {
        console.log(`⚡ Meneruskan toggle-stock ke server teman untuk Menu ID: ${id}`);
        
        // 1. Dapatkan status terkini dari server teman untuk menentukan nilai displayed (0 atau 1)
        let displayedVal = 0; // default to disable
        let targetMenu: any = null;
        try {
          const getRes = await fetch(`${SMART_TAG_API}/api/menu`);
          if (getRes.ok) {
            const externalMenus: any = await getRes.json();
            targetMenu = externalMenus.find((m: any) => m.id.toString() === id.toString());
            if (targetMenu) {
              // Jika status saat ini "Tersedia", berarti kita ingin menonaktifkan (displayed = 0).
              // Jika status saat ini bukan "Tersedia" (misal "Habis"), berarti kita aktifkan kembali (displayed = 1).
              displayedVal = targetMenu.status === "Tersedia" ? 0 : 1;
            }
          }
        } catch (getErr: any) {
          console.warn("⚠️ Gagal membaca status awal dari teman, default ke nonaktifkan:", getErr.message);
        }

        // 2. Kirim PUT request ke API spesifik teman Anda
        const response = await fetch(`${SMART_TAG_API}/api/menu/${id}/display`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayed: displayedVal })
        });
        
        if (response.ok) {
          let imageUrl = targetMenu ? (targetMenu.image_url || targetMenu.image) : "";
          if (imageUrl && imageUrl.startsWith('/')) {
            imageUrl = `${SMART_TAG_API}${imageUrl}`;
          } else if (!imageUrl && targetMenu) {
            imageUrl = `https://picsum.photos/seed/${targetMenu.name.replace(/\s+/g, '')}/400/300`;
          }

          // Kembalikan objek item lengkap agar card menu tidak menjadi kosong/putih
          return res.json({
            item: {
              id: id,
              name: targetMenu ? targetMenu.name : "Menu Eksternal",
              category: targetMenu ? (targetMenu.category || "Main Course") : "Main Course",
              price: targetMenu ? (parseFloat(targetMenu.price) || 0) : 0,
              inStock: displayedVal === 1,
              stock: displayedVal === 1 ? (targetMenu ? (targetMenu.stock || 20) : 20) : 0,
              outlet: "ngolab",
              image: imageUrl
            }
          });
        } else {
          return res.status(response.status).json({ message: "Gagal merubah status tampilan di server teman" });
        }
      } catch (err: any) {
        return res.status(503).json({ message: "Server teman tidak dapat dijangkau", error: err.message });
      }
    }

    const current = existing[0];
    const newInStock = current.in_stock ? 0 : 1;
    const newStock = newInStock ? 20 : 0; // Default refill to 20 if marked as in stock

    await db.query(
      "UPDATE menus SET in_stock=?, stock=? WHERE id=?",
      [newInStock, newStock, id]
    );

    // Log to security audit
    const actor = (req.headers["x-user-name"] as string) || "Koki";
    await addAuditLog(actor, "Toggle Stok Menu", `${current.name} (${newInStock ? 'Tersedia' : 'Habis'})`);

    res.json({
      item: {
        id: current.id,
        name: current.name,
        category: current.category,
        price: current.price,
        inStock: Boolean(newInStock),
        stock: newStock,
        outlet: current.outlet,
        image: current.image_url,
        description: current.description || ""
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: "Gagal update stok menu", error: error.message });
  }
});

// POST /api/menu/sync-smart-tag — Tes konektivitas ke Smart Tag API
router.post("/sync-smart-tag", async (req: Request, res: Response) => {
  try {
    const SMART_TAG_API = "http://192.168.1.11:5000";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

    const response = await fetch(`${SMART_TAG_API}/api/menu`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("Gagal terhubung ke API Smart Tag");
    }
    const data: any = await response.json();

    res.json({ 
      message: `Koneksi ke Smart Tag Aktif! Terdeteksi ${data.length} menu yang disajikan secara real-time (tanpa database).`, 
      count: data.length 
    });
  } catch (error: any) {
    console.error("Sync Connection Error:", error);
    res.status(500).json({ 
      message: "Gagal menghubungkan ke Smart Tag. Pastikan perangkat aktif dan berada di jaringan WiFi yang sama.", 
      error: error.message 
    });
  }
});

export default router;
