import { Router, Request, Response } from "express";
import { db, addAuditLog } from "../db/db.js";
import fs from "fs";
import path from "path";
import { requireApiKeyScope } from "../middleware/authApiKey.js";
import { getVerifiedActor, requireRoles } from "../middleware/authSession.js";
import { desiredSmartTagDisplayed, parseMenuMutationTarget, serializeSmartTagMenu, smartTagMenuPathId } from "../lib/smartTagMenu.js";

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
const requireMenuAdmin = requireRoles('Super Admin', 'Koki');
const requireMenuStaff = requireRoles('Super Admin', 'Kasir', 'Koki', 'Support');
const smartTagHeaders = () => {
  const key = process.env.SMART_TAG_API_KEY || '';
  const token = process.env.SMART_TAG_ACCESS_TOKEN || '';
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 Tangolab-Ngolab-Integration',
    ...(key ? { 'x-api-key': key } : {}),
    ...(token ? { Authorization: 'Bearer ' + token } : {})
  };
};

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data: any = await response.json();
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

function serializeMenu(menu: any) {
  const isActive = menu.is_active === undefined ? true : Boolean(menu.is_active);
  const inventoryAvailable = menu.inventory_available === undefined ? Boolean(menu.in_stock) : Boolean(menu.inventory_available);
  const override = menu.availability_override || 'auto';
  const inStock = isActive && override === 'auto' && inventoryAvailable;
  const unavailableReason = !isActive ? 'archived' : override === 'force_off' ? 'manual' : !inventoryAvailable ? 'inventory' : 'available';
  return {
    id: menu.id,
    name: menu.name,
    category: menu.category,
    price: Number(menu.price),
    inStock,
    displayed: inStock ? 1 : 0,
    stock: Number(menu.stock || 0),
    outlet: menu.outlet,
    image: menu.image_url,
    description: menu.description || '',
    isActive,
    inventoryAvailable,
    availabilityOverride: override,
    availabilityReason: menu.availability_reason || '',
    availabilityUpdatedBy: menu.availability_updated_by || '',
    availabilityUpdatedAt: menu.availability_updated_at,
    unavailableReason,
    source: 'local'
  };
}

// GET /api/menu/external — menu lokal untuk integrasi server-to-server.
router.get("/external", requireApiKeyScope('menu:read'), async (req: Request, res: Response) => {
  try {
    const { category, outlet } = req.query;
    let query = "SELECT id, name, category, price, in_stock, inventory_available, availability_override, availability_reason, stock, outlet, image_url, description FROM menus WHERE is_active = 1";
    const params: any[] = [];
    if (outlet) {
      query += " AND outlet = ?";
      params.push(outlet);
    }
    if (category && category !== 'Semua') {
      query += " AND category = ?";
      params.push(category);
    }
    query += " ORDER BY created_at DESC";
    const [rows]: any = await db.query(query, params);
    res.json(rows.map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: Number(item.price),
      in_stock: Boolean(item.in_stock),
      inventory_available: Boolean(item.inventory_available),
      availability_override: item.availability_override,
      availability_reason: item.availability_reason || '',
      stock: Number(item.stock),
      outlet: item.outlet,
      image_url: item.image_url,
      description: item.description || ''
    })));
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengambil menu integrasi', error: error.message });
  }
});

// GET /api/menu — Ambil daftar menu dengan filter opsional (category, outlet)
router.get("/", async (req: Request, res: Response) => {
  const { category, outlet } = req.query;
  const includeArchived = req.query.includeArchived === '1';
  
  const SMART_TAG_API = (process.env.SMART_TAG_API_URL || 'https://smarttag.ngolab.online').replace(/\/$/, '');
  let fetchedFromExternal = false;
  let formattedMenus: any[] = [];

  // Admin lokal dapat melewati sinkronisasi Smart Tag tanpa membocorkan API key ke browser.
  const forceLocal = req.query.source === 'local';

  if (outlet === "ngolab" && !forceLocal) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5 seconds timeout

      const response = await fetch(`${SMART_TAG_API}/api/menu`, { signal: controller.signal, headers: smartTagHeaders() });
      clearTimeout(timeoutId);

      if (response.ok) {
        const externalData: any = await response.json();
        formattedMenus = externalData.map((item: any) => serializeSmartTagMenu(item, SMART_TAG_API));

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
      if (!includeArchived) query += " AND is_active = 1";

      query += " ORDER BY created_at DESC";

      const [menus]: any = await db.query(query, params);
      
      formattedMenus = menus.map(serializeMenu);
    } catch (error: any) {
      return res.status(500).json({ message: "Gagal mengambil data menu", error: error.message });
    }
  }

  res.json(formattedMenus);
});

// POST /api/menu — Tambah menu baru
router.post("/", requireMenuAdmin, async (req: Request, res: Response) => {
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
      "INSERT INTO menus (id, name, category, price, in_stock, is_active, inventory_available, availability_override, stock, outlet, image_url, description) VALUES (?, ?, ?, ?, ?, 1, ?, 'auto', ?, ?, ?, ?)",
      [newId, name, category, parseInt(price), isStock, isStock, stockVal, outletVal, imageVal, description || ""]
    );

    // Log to security audit
    const actor = getVerifiedActor(req);
    await addAuditLog(actor, "Tambah Menu Baru", `${name} (${outletVal})`);

    res.status(201).json({
      id: newId,
      name,
      category,
      price: parseInt(price),
      inStock: Boolean(isStock),
      displayed: isStock ? 1 : 0,
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
router.put("/:id", requireMenuAdmin, async (req: Request, res: Response) => {
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
    const newInventoryAvailable = stock !== undefined ? newStock > 0 : Boolean(current.inventory_available);
    const newInStock = Boolean(current.is_active) && current.availability_override === 'auto' && newInventoryAvailable;
    const newImage = image ? saveBase64Image(image) : current.image_url;
    const newDescription = description !== undefined ? description : current.description;

    await db.query(
      "UPDATE menus SET name=?, category=?, price=?, in_stock=?, inventory_available=?, stock=?, image_url=?, description=? WHERE id=?",
      [newName, newCategory, newPrice, newInStock ? 1 : 0, newInventoryAvailable ? 1 : 0, newStock, newImage, newDescription, id]
    );

    // Log to security audit
    const actor = getVerifiedActor(req);
    await addAuditLog(actor, "Update Menu", `${newName}`);

    res.json({
      id,
      name: newName,
      category: newCategory,
      price: newPrice,
      inStock: Boolean(newInStock),
      displayed: newInStock ? 1 : 0,
      stock: newStock,
      outlet: current.outlet,
      image: newImage,
      description: newDescription || ""
    });
  } catch (error: any) {
    res.status(500).json({ message: "Gagal memperbarui menu", error: error.message });
  }
});

// PATCH /api/menu/:id/availability — Nonaktifkan sementara atau kembali mengikuti inventori.
router.patch('/:id/availability', requireMenuStaff, async (req: Request, res: Response) => {
  try {
    const override = req.body.override;
    const reason = String(req.body.reason || '').trim();
    if (override !== 'auto' && override !== 'force_off') return res.status(400).json({ message: 'Status ketersediaan tidak valid.' });
    if (override === 'force_off' && reason.length < 3) return res.status(400).json({ message: 'Alasan menonaktifkan menu wajib diisi.' });
    let target: ReturnType<typeof parseMenuMutationTarget>;
    try {
      target = parseMenuMutationTarget(req.body.source, req.body.outlet);
    } catch (validationError: any) {
      return res.status(400).json({ message: validationError.message });
    }
    const { source, outlet } = target;
    if (source === 'smart-tag') {
      if (outlet !== 'ngolab') return res.status(400).json({ message: 'Smart Tag hanya berlaku untuk outlet Ngolab.' });
      let externalId: string;
      try {
        externalId = smartTagMenuPathId(req.params.id);
      } catch {
        return res.status(400).json({ message: 'ID menu Smart Tag tidak valid.' });
      }
      const smartTagBaseUrl = (process.env.SMART_TAG_API_URL || 'https://smarttag.ngolab.online').replace(/\/$/, '');
      const { response: listResponse, data: externalMenus } = await fetchJsonWithTimeout(
        `${smartTagBaseUrl}/api/menu`,
        { headers: smartTagHeaders() }
      );
      if (!listResponse.ok) return res.status(503).json({ message: 'Menu Smart Tag sedang tidak dapat diakses.' });
      const current = Array.isArray(externalMenus)
        ? externalMenus.find((menu: any) => String(menu.id) === String(req.params.id))
        : null;
      if (!current) return res.status(404).json({ message: 'Menu Smart Tag tidak ditemukan.' });

      const displayResponse = await fetchWithTimeout(`${smartTagBaseUrl}/api/menu/${externalId}/display`, {
        method: 'PUT',
        headers: smartTagHeaders(),
        body: JSON.stringify({ displayed: desiredSmartTagDisplayed(override) })
      });
      if (!displayResponse.ok) {
        return res.status(displayResponse.status === 401 || displayResponse.status === 403 ? 502 : displayResponse.status)
          .json({ message: 'Smart Tag menolak perubahan status menu. Periksa kredensial integrasi.' });
      }

      let refreshed: any = null;
      try {
        const { response: refreshedResponse, data: refreshedMenus } = await fetchJsonWithTimeout(
          `${smartTagBaseUrl}/api/menu`,
          { headers: smartTagHeaders() }
        );
        refreshed = refreshedResponse.ok && Array.isArray(refreshedMenus)
          ? refreshedMenus.find((menu: any) => String(menu.id) === String(req.params.id))
          : null;
      } catch (refreshError) {
        // PUT sudah berhasil. Gunakan snapshot deterministik agar audit dan event tetap tercatat.
        console.warn('Smart Tag refresh after successful mutation failed', refreshError);
      }
      const fallback = {
        ...current,
        displayed: desiredSmartTagDisplayed(override),
        status: override === 'auto' && Number(current.stock || 0) > 0 ? 'Tersedia' : 'Tidak Tersedia'
      };
      const item = serializeSmartTagMenu(refreshed || fallback, smartTagBaseUrl);
      const actor = getVerifiedActor(req);
      await addAuditLog(actor, override === 'force_off' ? 'Nonaktifkan Menu Smart Tag' : 'Aktifkan Menu Smart Tag', `${item.name}${reason ? ` (${reason})` : ''}`, override === 'force_off' ? 'warning' : 'success');
      req.app.get('io')?.emit('menu_availability_updated', item);
      return res.json({ message: override === 'force_off' ? 'Menu Smart Tag dinonaktifkan.' : 'Menu Smart Tag diaktifkan kembali.', item });
    }

    const [rows]: any = await db.query('SELECT * FROM menus WHERE id = ? AND outlet = ? LIMIT 1', [req.params.id, outlet]);
    if (!rows.length) return res.status(404).json({ message: 'Menu lokal tidak ditemukan.' });
    const actor = getVerifiedActor(req);
    await db.query(
      `UPDATE menus SET availability_override = ?, availability_reason = ?, availability_updated_by = ?,
       availability_updated_at = NOW(), in_stock = IF(is_active = 1 AND inventory_available = 1 AND ? = 'auto', 1, 0)
       WHERE id = ? AND outlet = ?`,
      [override, override === 'force_off' ? reason : null, actor, override, req.params.id, outlet]
    );
    const [updated]: any = await db.query('SELECT * FROM menus WHERE id = ? AND outlet = ?', [req.params.id, outlet]);
    const item = serializeMenu(updated[0]);
    await addAuditLog(actor, override === 'force_off' ? 'Nonaktifkan Menu Sementara' : 'Aktifkan Mode Otomatis Menu', `${item.name}${reason ? ` (${reason})` : ''}`, override === 'force_off' ? 'warning' : 'success');
    req.app.get('io')?.emit('menu_availability_updated', item);
    res.json({ message: override === 'force_off' ? 'Menu dinonaktifkan sementara.' : 'Menu kembali mengikuti stok inventori.', item });
  } catch (error: any) {
    const timedOut = error?.name === 'AbortError';
    console.error('Menu availability update failed', error);
    res.status(timedOut ? 503 : 500).json({
      message: timedOut ? 'Smart Tag tidak merespons dalam batas waktu.' : 'Gagal mengubah ketersediaan menu'
    });
  }
});

// PATCH /api/menu/:id/archive — Arsipkan atau pulihkan master menu.
router.patch('/:id/archive', requireMenuAdmin, async (req: Request, res: Response) => {
  try {
    const isActive = req.body.isActive === true;
    const [rows]: any = await db.query('SELECT * FROM menus WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Menu tidak ditemukan.' });
    await db.query(
      `UPDATE menus SET is_active = ?, in_stock = IF(? = 1 AND inventory_available = 1 AND availability_override = 'auto', 1, 0) WHERE id = ?`,
      [isActive ? 1 : 0, isActive ? 1 : 0, req.params.id]
    );
    const [updated]: any = await db.query('SELECT * FROM menus WHERE id = ?', [req.params.id]);
    const item = serializeMenu(updated[0]);
    const actor = getVerifiedActor(req);
    await addAuditLog(actor, isActive ? 'Pulihkan Menu' : 'Arsipkan Menu', item.name, isActive ? 'success' : 'warning');
    req.app.get('io')?.emit('menu_availability_updated', item);
    res.json({ message: isActive ? 'Menu berhasil dipulihkan.' : 'Menu berhasil diarsipkan.', item });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengubah status arsip menu', error: error.message });
  }
});

// DELETE /api/menu/:id — Hapus menu
router.delete("/:id", requireMenuAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const actor = getVerifiedActor(req);
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
router.patch("/:id/toggle-stock", requireMenuStaff, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [existing]: any = await db.query("SELECT * FROM menus WHERE id = ?", [id]);
    
    // Jika tidak ditemukan di database lokal, berarti menu eksternal dari teman kita!
    if (existing.length === 0) {
      const SMART_TAG_API = (process.env.SMART_TAG_API_URL || 'https://smarttag.ngolab.online').replace(/\/$/, '');
      try {
        console.log(`⚡ Meneruskan toggle-stock ke server teman untuk Menu ID: ${id}`);
        
        // 1. Dapatkan status terkini dari server teman untuk menentukan nilai displayed (0 atau 1)
        let displayedVal = 0; // default to disable
        let targetMenu: any = null;
        try {
          const getRes = await fetch(`${SMART_TAG_API}/api/menu`, { headers: smartTagHeaders() });
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
          headers: smartTagHeaders(),
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
              displayed: displayedVal,
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
    const override = current.availability_override === 'force_off' ? 'auto' : 'force_off';
    const actor = getVerifiedActor(req);
    await db.query(
      `UPDATE menus SET availability_override = ?, availability_reason = ?, availability_updated_by = ?,
       availability_updated_at = NOW(), in_stock = IF(is_active = 1 AND inventory_available = 1 AND ? = 'auto', 1, 0)
       WHERE id = ?`,
      [override, override === 'force_off' ? 'Dinonaktifkan melalui tombol cepat' : null, actor, override, id]
    );
    const [updated]: any = await db.query('SELECT * FROM menus WHERE id = ?', [id]);
    const item = serializeMenu(updated[0]);
    await addAuditLog(actor, override === 'force_off' ? 'Nonaktifkan Menu Sementara' : 'Aktifkan Mode Otomatis Menu', item.name, override === 'force_off' ? 'warning' : 'success');
    req.app.get('io')?.emit('menu_availability_updated', item);
    res.json({ item });
  } catch (error: any) {
    res.status(500).json({ message: "Gagal update stok menu", error: error.message });
  }
});

// POST /api/menu/sync-smart-tag — Tes konektivitas ke Smart Tag API
router.post("/sync-smart-tag", requireMenuAdmin, async (req: Request, res: Response) => {
  try {
    const SMART_TAG_API = (process.env.SMART_TAG_API_URL || 'https://smarttag.ngolab.online').replace(/\/$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

    const response = await fetch(`${SMART_TAG_API}/api/menu`, { signal: controller.signal, headers: smartTagHeaders() });
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
