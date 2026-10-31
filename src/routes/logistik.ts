import { Router, Request, Response } from 'express';
import { db, addAuditLog } from '../db/db.js';
import { getVerifiedActor } from '../middleware/authSession.js';

export const logistikRouter = Router();

// ==============================================================================
// 1. DASHBOARD & RINGKASAN STOK
// ==============================================================================
logistikRouter.get('/dashboard/summary', async (_req: Request, res: Response) => {
  try {
    const [statusRows]: any = await db.query(`
      SELECT 
        COUNT(*) AS total_item,
        SUM(CASE WHEN stok > min_stok THEN 1 ELSE 0 END) AS aman,
        SUM(CASE WHEN stok > batas_kritis AND stok <= min_stok THEN 1 ELSE 0 END) AS menipis,
        SUM(CASE WHEN stok > 0 AND stok <= batas_kritis THEN 1 ELSE 0 END) AS kritis,
        SUM(CASE WHEN stok <= 0 THEN 1 ELSE 0 END) AS habis,
        SUM(CASE WHEN stok <= min_stok THEN 1 ELSE 0 END) AS perlu_dibeli
      FROM items
      WHERE status = 'aktif'
    `);

    const [movementStats]: any = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN jenis = 'Barang Masuk' THEN jumlah ELSE 0 END), 0) AS total_masuk,
        COALESCE(SUM(CASE WHEN jenis = 'Barang Keluar' THEN jumlah ELSE 0 END), 0) AS total_keluar
      FROM stock_movements
      WHERE created_at >= NOW() - INTERVAL 30 DAY
    `);

    const [chartData]: any = await db.query(`
      SELECT 
        DATE_FORMAT(d.date, '%d %b') AS tanggal,
        DATE(d.date) as raw_date,
        COALESCE(SUM(CASE WHEN sm.jenis = 'Barang Masuk' THEN sm.jumlah ELSE 0 END), 0) AS masuk,
        COALESCE(SUM(CASE WHEN sm.jenis = 'Barang Keluar' THEN sm.jumlah ELSE 0 END), 0) AS keluar
      FROM (
        SELECT CURDATE() - INTERVAL 6 DAY AS date UNION ALL
        SELECT CURDATE() - INTERVAL 5 DAY UNION ALL
        SELECT CURDATE() - INTERVAL 4 DAY UNION ALL
        SELECT CURDATE() - INTERVAL 3 DAY UNION ALL
        SELECT CURDATE() - INTERVAL 2 DAY UNION ALL
        SELECT CURDATE() - INTERVAL 1 DAY UNION ALL
        SELECT CURDATE()
      ) d
      LEFT JOIN stock_movements sm ON DATE(sm.created_at) = d.date
      GROUP BY d.date
      ORDER BY d.date ASC
    `);

    const [urgentItems]: any = await db.query(`
      SELECT 
        i.id, i.nama, i.sku, i.satuan, i.stok, i.min_stok, i.batas_kritis,
        c.nama AS kategori_nama,
        w.nama AS warehouse_nama,
        CASE
          WHEN i.stok <= 0 THEN 'habis'
          WHEN i.stok <= i.batas_kritis THEN 'kritis'
          ELSE 'menipis'
        END AS status_stok
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE i.status = 'aktif' AND i.stok <= i.min_stok
      ORDER BY i.stok ASC
      LIMIT 6
    `);

    const [recentMovements]: any = await db.query(`
      SELECT 
        sm.id, sm.kode_transaksi, sm.jenis, sm.jumlah, sm.metode, sm.petugas, sm.created_at,
        i.nama AS item_nama, i.satuan AS item_satuan, i.sku AS item_sku
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      ORDER BY sm.created_at DESC
      LIMIT 5
    `);

    const stats = statusRows[0] || {};
    res.json({
      success: true,
      data: {
        total_item: Number(stats.total_item || 0),
        aman: Number(stats.aman || 0),
        menipis: Number(stats.menipis || 0),
        kritis: Number(stats.kritis || 0),
        habis: Number(stats.habis || 0),
        perlu_dibeli: Number(stats.perlu_dibeli || 0),
        total_masuk: Number(movementStats[0]?.total_masuk || 0),
        total_keluar: Number(movementStats[0]?.total_keluar || 0),
        chart: chartData,
        urgent_items: urgentItems,
        recent_movements: recentMovements
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Gagal memuat ringkasan stok', error: error.message });
  }
});

// ==============================================================================
// 2. MASTER ITEMS (BARANG & INVENTORI)
// ==============================================================================
logistikRouter.get('/items', async (req: Request, res: Response) => {
  try {
    const { search = '', category_id = '', warehouse_id = '', status = '', stock_status = '' } = req.query as any;
    let query = `
      SELECT 
        i.*,
        c.nama AS kategori_nama,
        c.tipe AS kategori_tipe,
        w.nama AS warehouse_nama,
        w.kode AS warehouse_kode,
        s.nama AS supplier_nama,
        CASE
          WHEN i.stok <= 0 THEN 'habis'
          WHEN i.stok <= i.batas_kritis THEN 'kritis'
          WHEN i.stok <= i.min_stok THEN 'menipis'
          ELSE 'aman'
        END AS status_stok
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (i.nama LIKE ? OR i.sku LIKE ? OR i.barcode LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (category_id) {
      query += ` AND i.category_id = ?`;
      params.push(category_id);
    }
    if (warehouse_id) {
      query += ` AND i.warehouse_id = ?`;
      params.push(warehouse_id);
    }
    if (status) {
      query += ` AND i.status = ?`;
      params.push(status);
    }
    if (stock_status) {
      if (stock_status === 'habis') query += ` AND i.stok <= 0`;
      else if (stock_status === 'kritis') query += ` AND i.stok > 0 AND i.stok <= i.batas_kritis`;
      else if (stock_status === 'menipis') query += ` AND i.stok > i.batas_kritis AND i.stok <= i.min_stok`;
      else if (stock_status === 'aman') query += ` AND i.stok > i.min_stok`;
      else if (stock_status === 'perlu_dibeli') query += ` AND i.stok <= i.min_stok`;
    }

    query += ` ORDER BY i.id DESC`;
    const [rows]: any = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Gagal memuat barang', error: error.message });
  }
});

logistikRouter.get('/items/search-code', async (req: Request, res: Response) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ success: false, message: 'Kode barcode/SKU harus diisi.' });

    const [rows]: any = await db.query(`
      SELECT 
        i.*,
        c.nama AS kategori_nama,
        w.nama AS warehouse_nama,
        CASE
          WHEN i.stok <= 0 THEN 'habis'
          WHEN i.stok <= i.batas_kritis THEN 'kritis'
          WHEN i.stok <= i.min_stok THEN 'menipis'
          ELSE 'aman'
        END AS status_stok
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE i.barcode = ? OR i.sku = ?
      LIMIT 1
    `, [code, code]);

    if (!rows.length) return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
    res.json({ success: true, data: rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.get('/items/:id', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(`
      SELECT 
        i.*,
        c.nama AS kategori_nama,
        c.tipe AS kategori_tipe,
        w.nama AS warehouse_nama,
        w.kode AS warehouse_kode,
        s.nama AS supplier_nama,
        CASE
          WHEN i.stok <= 0 THEN 'habis'
          WHEN i.stok <= i.batas_kritis THEN 'kritis'
          WHEN i.stok <= i.min_stok THEN 'menipis'
          ELSE 'aman'
        END AS status_stok
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
    res.json({ success: true, data: rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.post('/items', async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const { sku, barcode, nama, category_id, satuan, stok = 0, min_stok = 10, batas_kritis = 5, status = 'aktif', warehouse_id = null, supplier_id = null, foto = null } = req.body;
    if (!nama || !sku || !category_id || !satuan) {
      return res.status(400).json({ success: false, message: 'Nama, SKU, Kategori, dan Satuan wajib diisi.' });
    }

    const [dup]: any = await connection.query('SELECT id FROM items WHERE sku = ? OR (barcode = ? AND barcode IS NOT NULL)', [sku, barcode || null]);
    if (dup.length > 0) return res.status(409).json({ success: false, message: 'SKU atau Barcode sudah digunakan oleh item lain.' });

    await connection.beginTransaction();
    const [result]: any = await connection.query(
      `INSERT INTO items (sku, barcode, nama, category_id, satuan, stok, min_stok, batas_kritis, status, warehouse_id, supplier_id, foto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku.trim(), barcode?.trim() || null, nama.trim(), category_id, satuan.trim(), Number(stok), Number(min_stok), Number(batas_kritis), status, warehouse_id || null, supplier_id || null, foto]
    );

    const newItemId = result.insertId;
    if (Number(stok) > 0) {
      await connection.query(
        `INSERT INTO stock_movements (kode_transaksi, item_id, jenis, jumlah, stok_sebelum, stok_sesudah, warehouse_tujuan_id, metode, petugas, catatan)
         VALUES (?, ?, 'Barang Masuk', ?, 0, ?, ?, 'Manual', ?, 'Stok awal barang baru')`,
        [`TRX-INIT-${Date.now()}`, newItemId, Number(stok), Number(stok), warehouse_id || null, getVerifiedActor(req) || 'Admin Ko+Lab']
      );
    }
    await connection.commit();
    res.status(201).json({ success: true, message: 'Barang berhasil ditambahkan', data: { id: newItemId, nama, sku } });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ success: false, message: 'Gagal menambah barang', error: error.message });
  } finally {
    connection.release();
  }
});

logistikRouter.put('/items/:id', async (req: Request, res: Response) => {
  try {
    const { sku, barcode, nama, category_id, satuan, min_stok, batas_kritis, status, warehouse_id, supplier_id, foto } = req.body;
    const [result]: any = await db.query(
      `UPDATE items SET
        sku = ?, barcode = ?, nama = ?, category_id = ?, satuan = ?,
        min_stok = ?, batas_kritis = ?, status = ?, warehouse_id = ?,
        supplier_id = ?, foto = COALESCE(?, foto)
       WHERE id = ?`,
      [sku?.trim(), barcode?.trim() || null, nama?.trim(), category_id, satuan?.trim(), Number(min_stok || 10), Number(batas_kritis || 5), status || 'aktif', warehouse_id || null, supplier_id || null, foto || null, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
    res.json({ success: true, message: 'Barang berhasil diperbarui.' });
  } catch (error: any) {
    const isDup = error.code === 'ER_DUP_ENTRY';
    res.status(isDup ? 409 : 500).json({ success: false, message: isDup ? 'SKU atau Barcode sudah terpakai.' : error.message });
  }
});

logistikRouter.delete('/items/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const [movs]: any = await db.query('SELECT COUNT(*) as count FROM stock_movements WHERE item_id = ?', [id]);
    if (movs[0]?.count > 0) {
      return res.status(409).json({ success: false, message: 'Barang memiliki riwayat transaksi mutasi stok dan tidak dapat dihapus permanen. Ubah status menjadi nonaktif.' });
    }
    const [recipes]: any = await db.query('SELECT COUNT(*) as count FROM menu_ingredients WHERE item_id = ?', [id]);
    if (recipes[0]?.count > 0) {
      return res.status(409).json({ success: false, message: 'Barang terdaftar dalam resep menu aktif. Hapus dari komposisi resep terlebih dahulu.' });
    }
    const [del]: any = await db.query('DELETE FROM items WHERE id = ?', [id]);
    if (!del.affectedRows) return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
    res.json({ success: true, message: 'Barang berhasil dihapus.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 3. MUTASI STOK ATOMIK (TRANSAKSI DATABASE)
// ==============================================================================
logistikRouter.post('/movements', async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const { item_id, jenis, jumlah, warehouse_asal_id = null, warehouse_tujuan_id = null, metode = 'Manual', petugas = 'Petugas Logistik', catatan = '', lampiran_foto = null } = req.body;
    const numJumlah = Number(jumlah);
    if (isNaN(numJumlah) || numJumlah <= 0) {
      return res.status(400).json({ success: false, message: 'Jumlah mutasi harus berupa angka lebih besar dari 0.' });
    }

    await connection.beginTransaction();
    const [items]: any = await connection.query('SELECT id, nama, stok, warehouse_id FROM items WHERE id = ? FOR UPDATE', [item_id]);
    if (!items.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
    }

    const currentItem = items[0];
    const stokSebelum = Number(currentItem.stok);
    let stokSesudah = stokSebelum;
    let newWarehouseId = currentItem.warehouse_id;

    if (jenis === 'Barang Masuk') {
      stokSesudah = stokSebelum + numJumlah;
      if (warehouse_tujuan_id) newWarehouseId = warehouse_tujuan_id;
    } else if (jenis === 'Barang Keluar') {
      if (stokSebelum < numJumlah) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Stok tidak mencukupi untuk Barang Keluar! Stok saat ini: ${stokSebelum}, diminta: ${numJumlah}.` });
      }
      stokSesudah = stokSebelum - numJumlah;
    } else if (jenis === 'Penyesuaian') {
      stokSesudah = numJumlah;
    } else if (jenis === 'Transfer Gudang') {
      if (!warehouse_asal_id || !warehouse_tujuan_id) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Transfer Gudang memerlukan Gudang Asal dan Gudang Tujuan.' });
      }
      if (warehouse_asal_id === warehouse_tujuan_id) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Gudang Asal dan Gudang Tujuan tidak boleh sama.' });
      }
      if (stokSebelum < numJumlah) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Stok tidak mencukupi untuk Transfer Gudang! Stok saat ini: ${stokSebelum}, diminta: ${numJumlah}.` });
      }
      newWarehouseId = warehouse_tujuan_id;
      stokSesudah = stokSebelum;
    } else {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Jenis transaksi '${jenis}' tidak valid.` });
    }

    if (stokSesudah < 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Stok barang tidak boleh negatif.' });
    }

    const kodeTransaksi = `TRX-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
    await connection.query('UPDATE items SET stok = ?, warehouse_id = ? WHERE id = ?', [stokSesudah, newWarehouseId, item_id]);
    await connection.query(
      `INSERT INTO stock_movements (kode_transaksi, item_id, jenis, jumlah, stok_sebelum, stok_sesudah, warehouse_asal_id, warehouse_tujuan_id, metode, petugas, catatan, lampiran_foto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [kodeTransaksi, item_id, jenis, numJumlah, stokSebelum, stokSesudah, warehouse_asal_id || null, warehouse_tujuan_id || null, metode, petugas, catatan || null, lampiran_foto || null]
    );

    // Sync juga dengan tabel ingredients jika ada item dengan nama yang sama
    await connection.query('UPDATE ingredients SET stock = ? WHERE name = ?', [stokSesudah, currentItem.nama]);

    await connection.commit();
    res.status(201).json({
      success: true,
      message: `Mutasi ${jenis} berhasil dicatat.`,
      data: { kode_transaksi: kodeTransaksi, item: currentItem.nama, stok_sebelum: stokSebelum, stok_sesudah: stokSesudah }
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ success: false, message: 'Gagal mencatat mutasi stok', error: error.message });
  } finally {
    connection.release();
  }
});

logistikRouter.get('/movements', async (req: Request, res: Response) => {
  try {
    const { start_date = '', end_date = '', jenis = '', warehouse_id = '', petugas = '', limit = 50, page = 1 } = req.query as any;
    let query = `
      SELECT 
        sm.*,
        i.nama AS item_nama,
        i.sku AS item_sku,
        i.satuan AS item_satuan,
        wa.nama AS warehouse_asal_nama,
        wt.nama AS warehouse_tujuan_nama
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      LEFT JOIN warehouses wa ON sm.warehouse_asal_id = wa.id
      LEFT JOIN warehouses wt ON sm.warehouse_tujuan_id = wt.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (start_date) { query += ` AND DATE(sm.created_at) >= ?`; params.push(start_date); }
    if (end_date) { query += ` AND DATE(sm.created_at) <= ?`; params.push(end_date); }
    if (jenis) { query += ` AND sm.jenis = ?`; params.push(jenis); }
    if (warehouse_id) { query += ` AND (sm.warehouse_asal_id = ? OR sm.warehouse_tujuan_id = ?)`; params.push(warehouse_id, warehouse_id); }
    if (petugas) { query += ` AND sm.petugas LIKE ?`; params.push(`%${petugas}%`); }

    query += ` ORDER BY sm.created_at DESC, sm.id DESC`;
    const numLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const offset = (Math.max(1, Number(page) || 1) - 1) * numLimit;
    query += ` LIMIT ? OFFSET ?`;
    params.push(numLimit, offset);

    const [rows]: any = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.get('/movements/export-csv', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(`
      SELECT 
        sm.created_at, sm.kode_transaksi, i.nama AS item_nama, i.sku AS item_sku,
        sm.jenis, sm.jumlah, i.satuan, sm.stok_sebelum, sm.stok_sesudah,
        sm.metode, sm.petugas, sm.catatan
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      ORDER BY sm.created_at DESC
    `);
    let csv = 'Waktu,Kode Transaksi,Nama Barang,SKU,Jenis Mutasi,Jumlah,Satuan,Stok Sebelum,Stok Sesudah,Metode,Petugas,Catatan\n';
    for (const r of rows) {
      csv += `"${r.created_at}","${r.kode_transaksi}","${r.item_nama}","${r.item_sku}","${r.jenis}",${r.jumlah},"${r.satuan}",${r.stok_sebelum},${r.stok_sesudah},"${r.metode}","${r.petugas}","${r.catatan || ''}"\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="mutasi_stok_kolab.csv"');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 4. RESEP MENU, KAPASITAS PORSI, & FORECASTING MANUFAKTUR
// ==============================================================================
async function calculateMenuAvailability(menuId?: number | string) {
  let menuQuery = `SELECT * FROM logistik_menus`;
  const params: any[] = [];
  if (menuId) {
    menuQuery += ` WHERE id = ?`;
    params.push(menuId);
  } else {
    menuQuery += ` ORDER BY id DESC`;
  }
  const [menus]: any = await db.query(menuQuery, params);

  const [ingredients]: any = await db.query(`
    SELECT 
      mi.*,
      i.nama AS item_nama,
      i.sku AS item_sku,
      i.stok AS item_stok,
      i.satuan AS item_satuan,
      i.min_stok AS item_min_stok,
      i.batas_kritis AS item_batas_kritis
    FROM menu_ingredients mi
    JOIN items i ON mi.item_id = i.id
  `);

  const ingredientsMap: Record<number, any[]> = {};
  for (const ing of ingredients) {
    if (!ingredientsMap[ing.menu_id]) ingredientsMap[ing.menu_id] = [];
    const stokTersedia = Number(ing.item_stok);
    const butuhPerPorsi = Number(ing.jumlah_per_porsi);
    const kapasitasPorsi = butuhPerPorsi > 0 ? Math.floor(stokTersedia / butuhPerPorsi) : 0;
    ingredientsMap[ing.menu_id].push({
      id: ing.id,
      item_id: ing.item_id,
      item_nama: ing.item_nama,
      item_sku: ing.item_sku,
      item_satuan: ing.item_satuan,
      jumlah_per_porsi: butuhPerPorsi,
      satuan: ing.satuan,
      item_stok: stokTersedia,
      kapasitas_porsi: kapasitasPorsi,
      is_sufficient: kapasitasPorsi > 0
    });
  }

  return menus.map((menu: any) => {
    const resep = ingredientsMap[menu.id] || [];
    let maxPorsi = 0;
    let bottleneckIngredient = null;
    if (resep.length > 0) {
      maxPorsi = Math.min(...resep.map((r: any) => r.kapasitas_porsi));
      bottleneckIngredient = resep.reduce((prev: any, curr: any) => (curr.kapasitas_porsi < prev.kapasitas_porsi ? curr : prev), resep[0]);
    } else {
      maxPorsi = 999;
    }

    let ketersediaan = 'tersedia';
    if (menu.status_manual === 'nonaktif') ketersediaan = 'nonaktif_manual';
    else if (resep.length > 0 && maxPorsi <= 0) ketersediaan = 'stok_habis';
    else if (resep.length > 0 && maxPorsi <= 10) ketersediaan = 'menipis';

    return {
      ...menu,
      resep,
      kapasitas_maksimal_porsi: maxPorsi === 999 ? 0 : maxPorsi,
      has_recipe: resep.length > 0,
      bottleneck: bottleneckIngredient,
      status_ketersediaan: ketersediaan
    };
  });
}

logistikRouter.get('/menus', async (req: Request, res: Response) => {
  try {
    const results = await calculateMenuAvailability();
    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Gagal memuat resep menu', error: error.message });
  }
});

logistikRouter.get('/menus/:id', async (req: Request, res: Response) => {
  try {
    const results = await calculateMenuAvailability(req.params.id);
    if (!results.length) return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
    res.json({ success: true, data: results[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// SIMULATOR & FORECASTING MANUFAKTUR RESEP
// Menghitung berapa banyak produk dapat dibuat, kebutuhan bahan baku total, dan identifikasi bahan yang kurang
logistikRouter.all(['/menus/:id/forecast', '/menus/forecast'], async (req: Request, res: Response) => {
  try {
    const menuId = req.params.id || req.body.menu_id || req.query.menu_id;
    const targetPorsi = Math.max(1, Number(req.body.porsi || req.query.porsi || 1));
    if (!menuId) return res.status(400).json({ success: false, message: 'ID Menu wajib ditentukan.' });

    const results = await calculateMenuAvailability(menuId);
    if (!results.length) return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });

    const menu = results[0];
    const resep = menu.resep || [];

    const breakdown = resep.map((r: any) => {
      const butuhTotal = Number(r.jumlah_per_porsi) * targetPorsi;
      const stokAda = Number(r.item_stok);
      const cukup = stokAda >= butuhTotal;
      const kekurangan = cukup ? 0 : Number((butuhTotal - stokAda).toFixed(2));
      const sisaStok = cukup ? Number((stokAda - butuhTotal).toFixed(2)) : 0;
      return {
        item_id: r.item_id,
        nama_bahan: r.item_nama,
        sku: r.item_sku,
        satuan: r.satuan,
        kebutuhan_per_porsi: r.jumlah_per_porsi,
        total_kebutuhan: Number(butuhTotal.toFixed(2)),
        stok_tersedia: stokAda,
        cukup,
        kekurangan,
        sisa_stok_setelah_produksi: sisaStok,
        kapasitas_maksimal_bahan: r.kapasitas_porsi
      };
    });

    const bisaDiproduksiPenuh = breakdown.every((b: any) => b.cukup);
    const bahanKurang = breakdown.filter((b: any) => !b.cukup);

    res.json({
      success: true,
      data: {
        menu_id: menu.id,
        nama_menu: menu.nama_menu,
        kode_menu: menu.kode_menu,
        target_porsi: targetPorsi,
        kapasitas_maksimal_saat_ini: menu.kapasitas_maksimal_porsi,
        bottleneck: menu.bottleneck,
        bisa_diproduksi_penuh: bisaDiproduksiPenuh,
        bahan_kurang: bahanKurang,
        breakdown,
        rekomendasi_pengadaan: bahanKurang.map((b: any) => ({
          nama_bahan: b.nama_bahan,
          jumlah_harus_dibeli: b.kekurangan,
          satuan: b.satuan
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Gagal melakukan forecasting manufaktur resep', error: error.message });
  }
});

logistikRouter.post('/menus', async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const { kode_menu, nama_menu, kategori = 'Makanan', foto = null, status_manual = 'aktif', deskripsi = '', harga = 0, ingredients } = req.body;
    let parsedIngredients = ingredients;
    if (typeof ingredients === 'string') {
      try { parsedIngredients = JSON.parse(ingredients); } catch {}
    }
    await connection.beginTransaction();
    const [result]: any = await connection.query(
      `INSERT INTO logistik_menus (kode_menu, nama_menu, kategori, foto, status_manual, deskripsi, harga)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [kode_menu, nama_menu, kategori, foto, status_manual, deskripsi, harga]
    );
    const menuId = result.insertId;
    if (Array.isArray(parsedIngredients)) {
      for (const ing of parsedIngredients) {
        if (ing.item_id && Number(ing.jumlah_per_porsi) > 0) {
          await connection.query(
            `INSERT INTO menu_ingredients (menu_id, item_id, jumlah_per_porsi, satuan) VALUES (?, ?, ?, ?)`,
            [menuId, ing.item_id, Number(ing.jumlah_per_porsi), ing.satuan || 'porsi']
          );
        }
      }
    }
    await connection.commit();
    res.status(201).json({ success: true, message: 'Resep menu berhasil dibuat', data: { id: menuId, nama_menu } });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ success: false, message: 'Gagal membuat resep menu', error: error.message });
  } finally {
    connection.release();
  }
});

logistikRouter.put('/menus/:id', async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const { kode_menu, nama_menu, kategori, foto, status_manual, deskripsi, harga, ingredients } = req.body;
    let parsedIngredients = ingredients;
    if (typeof ingredients === 'string') {
      try { parsedIngredients = JSON.parse(ingredients); } catch {}
    }
    await connection.beginTransaction();
    await connection.query(
      `UPDATE logistik_menus SET kode_menu = ?, nama_menu = ?, kategori = ?, foto = COALESCE(?, foto), status_manual = ?, deskripsi = ?, harga = ? WHERE id = ?`,
      [kode_menu, nama_menu, kategori, foto, status_manual, deskripsi, harga, req.params.id]
    );
    if (Array.isArray(parsedIngredients)) {
      await connection.query('DELETE FROM menu_ingredients WHERE menu_id = ?', [req.params.id]);
      for (const ing of parsedIngredients) {
        if (ing.item_id && Number(ing.jumlah_per_porsi) > 0) {
          await connection.query(
            `INSERT INTO menu_ingredients (menu_id, item_id, jumlah_per_porsi, satuan) VALUES (?, ?, ?, ?)`,
            [req.params.id, ing.item_id, Number(ing.jumlah_per_porsi), ing.satuan || 'porsi']
          );
        }
      }
    }
    await connection.commit();
    res.json({ success: true, message: 'Resep menu berhasil diperbarui.' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

logistikRouter.patch('/menus/:id/toggle-status', async (req: Request, res: Response) => {
  try {
    const { status_manual } = req.body;
    await db.query('UPDATE logistik_menus SET status_manual = ? WHERE id = ?', [status_manual, req.params.id]);
    res.json({ success: true, message: `Status menu berhasil diubah menjadi ${status_manual}.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.delete('/menus/:id', async (req: Request, res: Response) => {
  try {
    await db.query('DELETE FROM logistik_menus WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Menu berhasil dihapus.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 5. MASTER DATA (KATEGORI, GUDANG, SUPPLIER)
// ==============================================================================
logistikRouter.get('/master/categories', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query('SELECT * FROM categories ORDER BY nama ASC');
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.get('/master/warehouses', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query('SELECT * FROM warehouses ORDER BY nama ASC');
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.post('/master/warehouses', async (req: Request, res: Response) => {
  try {
    const { kode, nama, lokasi, keterangan } = req.body;
    const [result]: any = await db.query('INSERT INTO warehouses (kode, nama, lokasi, keterangan) VALUES (?, ?, ?, ?)', [kode, nama, lokasi, keterangan]);
    res.status(201).json({ success: true, data: { id: result.insertId, kode, nama } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.put('/master/warehouses/:id', async (req: Request, res: Response) => {
  try {
    const { kode, nama, lokasi, keterangan } = req.body;
    await db.query('UPDATE warehouses SET kode = ?, nama = ?, lokasi = ?, keterangan = ? WHERE id = ?', [kode, nama, lokasi, keterangan, req.params.id]);
    res.json({ success: true, message: 'Gudang berhasil diperbarui' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.delete('/master/warehouses/:id', async (req: Request, res: Response) => {
  try {
    await db.query('DELETE FROM warehouses WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Gudang berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.get('/master/suppliers', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query('SELECT * FROM suppliers ORDER BY nama ASC');
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.post('/master/suppliers', async (req: Request, res: Response) => {
  try {
    const { kode, nama, kontak, telepon, alamat } = req.body;
    const [result]: any = await db.query('INSERT INTO suppliers (kode, nama, kontak, telepon, alamat) VALUES (?, ?, ?, ?, ?)', [kode, nama, kontak, telepon, alamat]);
    res.status(201).json({ success: true, data: { id: result.insertId, kode, nama } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.put('/master/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { kode, nama, kontak, telepon, alamat } = req.body;
    await db.query('UPDATE suppliers SET kode = ?, nama = ?, kontak = ?, telepon = ?, alamat = ? WHERE id = ?', [kode, nama, kontak, telepon, alamat, req.params.id]);
    res.json({ success: true, message: 'Supplier berhasil diperbarui' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

logistikRouter.delete('/master/suppliers/:id', async (req: Request, res: Response) => {
  try {
    await db.query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Supplier berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 6. AUTH LOGIN UNTUK LOGISTIK
// ==============================================================================
logistikRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if ((username === 'admin' && password === 'admin123') || (username === 'staff_gudang' && password === 'staff123')) {
      return res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          user: {
            id: username === 'admin' ? 1 : 2,
            username,
            nama_lengkap: username === 'admin' ? 'Administrator Ko+Lab' : 'Staff Logistik',
            role: username === 'admin' ? 'admin' : 'gudang'
          },
          token: `logistik_token_${username}_${Date.now()}`
        }
      });
    }

    // Cek juga dari tabel staff jika username cocok dengan email/nama staf
    const [staffs]: any = await db.query('SELECT * FROM staff WHERE email = ? AND is_active = 1 LIMIT 1', [username]);
    if (staffs.length > 0) {
      return res.json({
        success: true,
        message: 'Login berhasil via akun Staf Master',
        data: {
          user: {
            id: staffs[0].id,
            username: staffs[0].email,
            nama_lengkap: staffs[0].name,
            role: staffs[0].role
          },
          token: `staff_token_${staffs[0].id}_${Date.now()}`
        }
      });
    }

    res.status(401).json({ success: false, message: 'Username atau password salah.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default logistikRouter;
