import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { db, addAuditLog } from '../db/db.js';
import { calculateMovement, getStockLevel, normalizeBarcode } from '../lib/inventory.js';
import { emitInventoryChanges, syncMenuAvailability } from '../lib/inventoryDb.js';
import { getVerifiedActor, requireRoles } from '../middleware/authSession.js';

const router = Router();
const requireInventoryStaff = requireRoles('Super Admin', 'Kasir', 'Koki');
const requireInventoryAdmin = requireRoles('Super Admin', 'Koki');
const validOutlets = new Set(['ngolab', 'coworking']);
const validTypes = new Set(['raw_material', 'packaged_product']);
const validMovements = new Set(['purchase', 'adjustment', 'waste', 'stock_opname', 'transfer_in', 'transfer_out']);
const validInputMethods = new Set(['manual', 'barcode', 'camera', 'system']);

function serializeItem(row: any) {
  const stock = Number(row.stock);
  const minStock = Number(row.min_stock ?? row.minStock);
  const criticalStock = Number(row.critical_stock ?? row.criticalStock);
  return {
    id: String(row.id),
    name: String(row.name),
    inventoryType: row.inventory_type,
    sku: row.sku || '',
    barcode: row.barcode || '',
    category: row.category || '',
    unit: row.unit,
    purchaseUnit: row.purchase_unit || row.unit,
    purchaseConversion: Number(row.purchase_conversion || 1),
    stock,
    minStock,
    criticalStock,
    costPrice: Number(row.cost_price || 0),
    supplier: row.supplier || '',
    outlet: row.outlet || 'ngolab',
    isActive: Boolean(row.is_active),
    level: getStockLevel(stock, minStock, criticalStock)
  };
}

async function fetchItem(id: string, connection: any = db) {
  const [rows]: any = await connection.query('SELECT * FROM ingredients WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? serializeItem(rows[0]) : null;
}

router.get('/summary', requireInventoryStaff, async (req: Request, res: Response) => {
  try {
    const outlet = String(req.query.outlet || 'ngolab');
    if (!validOutlets.has(outlet)) return res.status(400).json({ message: 'Outlet tidak valid.' });
    const [rows]: any = await db.query('SELECT * FROM ingredients WHERE outlet = ? AND is_active = 1 ORDER BY name', [outlet]);
    const items = rows.map(serializeItem);
    const counts = { safe: 0, low: 0, critical: 0, out: 0 };
    items.forEach((item: any) => { counts[item.level as keyof typeof counts] += 1; });
    res.json({
      outlet,
      total: items.length,
      counts,
      alerts: items.filter((item: any) => item.level !== 'safe'),
      estimatedPurchaseValue: items.reduce((sum: number, item: any) => {
        const shortage = Math.max(0, item.minStock - item.stock);
        return sum + shortage * item.costPrice;
      }, 0)
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengambil ringkasan stok', error: error.message });
  }
});

router.get('/movements', requireInventoryStaff, async (req: Request, res: Response) => {
  try {
    const outlet = String(req.query.outlet || 'ngolab');
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
    const [rows]: any = await db.query(
      `SELECT m.*, i.name AS item_name, i.unit
       FROM inventory_movements m
       JOIN ingredients i ON i.id = m.ingredient_id
       WHERE m.outlet = ? ORDER BY m.created_at DESC LIMIT ?`,
      [outlet, limit]
    );
    res.json(rows.map((row: any) => ({
      ...row,
      quantity: Number(row.quantity),
      stock_before: Number(row.stock_before),
      stock_after: Number(row.stock_after),
      purchase_quantity: row.purchase_quantity == null ? null : Number(row.purchase_quantity),
      unit_cost: row.unit_cost == null ? null : Number(row.unit_cost)
    })));
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengambil riwayat mutasi stok', error: error.message });
  }
});

router.get('/barcode/:barcode', requireInventoryStaff, async (req: Request, res: Response) => {
  try {
    const barcode = normalizeBarcode(req.params.barcode);
    const outlet = String(req.query.outlet || 'ngolab');
    const [rows]: any = await db.query(
      'SELECT * FROM ingredients WHERE barcode = ? AND outlet = ? AND is_active = 1 LIMIT 1',
      [barcode, outlet]
    );
    if (!rows.length) return res.status(404).json({ message: 'Barcode belum terdaftar.', barcode });
    res.json(serializeItem(rows[0]));
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/yield', requireInventoryStaff, async (req: Request, res: Response) => {
  try {
    const outlet = String(req.query.outlet || 'ngolab');
    const [rows]: any = await db.query(`
      SELECT ri.menu_name AS name,
             FLOOR(MIN(i.stock / NULLIF(ri.amount, 0))) AS yield
      FROM recipe_ingredients ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE i.outlet = ? AND i.is_active = 1
      GROUP BY ri.menu_name
      ORDER BY ri.menu_name ASC
    `, [outlet]);
    res.json(rows.map((row: any) => ({ name: row.name, yield: Number(row.yield || 0) })));
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal menghitung yield bahan', error: error.message });
  }
});

router.get('/recipes', requireInventoryStaff, async (req: Request, res: Response) => {
  try {
    const outlet = String(req.query.outlet || 'ngolab');
    if (!['ngolab', 'coworking'].includes(outlet)) return res.status(400).json({ message: 'Outlet tidak valid.' });
    const [rows]: any = await db.query(`
      SELECT ri.menu_name, ri.outlet, ri.ingredient_id, ri.amount, i.name AS ingredient_name, i.unit
      FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE ri.outlet = ?
      ORDER BY ri.menu_name, i.name
    `, [outlet]);
    res.json(rows.map((row: any) => ({ ...row, amount: Number(row.amount) })));
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengambil resep', error: error.message });
  }
});

router.put('/recipes/:menuName', requireInventoryAdmin, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const menuName = decodeURIComponent(req.params.menuName).trim();
    const outlet = String(req.body.outlet || 'ngolab');
    const items = req.body.items;
    if (!['ngolab', 'coworking'].includes(outlet)) return res.status(400).json({ message: 'Outlet tidak valid.' });
    if (!menuName || !Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Menu dan minimal satu bahan wajib diisi.' });
    for (const item of items) {
      if (!item.ingredient_id || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0) {
        return res.status(400).json({ message: 'Bahan dan jumlah resep harus valid.' });
      }
    }
    await connection.beginTransaction();
    await connection.query('DELETE FROM recipe_ingredients WHERE menu_name = ? AND outlet = ?', [menuName, outlet]);
    for (const item of items) {
      await connection.query(
        'INSERT INTO recipe_ingredients (menu_name, outlet, ingredient_id, amount) VALUES (?, ?, ?, ?)',
        [menuName, outlet, item.ingredient_id, Number(item.amount)]
      );
    }
    await syncMenuAvailability(connection, outlet);
    await connection.commit();
    await addAuditLog(getVerifiedActor(req), 'Perbarui Resep Menu', menuName);
    res.json({ message: 'Resep berhasil disimpan.' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ message: 'Gagal menyimpan resep', error: error.message });
  } finally {
    connection.release();
  }
});

router.get('/', requireInventoryStaff, async (req: Request, res: Response) => {
  try {
    const outlet = String(req.query.outlet || 'ngolab');
    const [rows]: any = await db.query('SELECT * FROM ingredients WHERE outlet = ? ORDER BY name ASC', [outlet]);
    res.json(rows.map(serializeItem));
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengambil inventori', error: error.message });
  }
});

router.post('/', requireInventoryAdmin, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const body = req.body;
    const outlet = String(body.outlet || 'ngolab');
    if (!body.name?.trim() || !body.unit?.trim() || !validOutlets.has(outlet) || !validTypes.has(body.inventoryType)) {
      return res.status(400).json({ message: 'Nama, jenis inventori, satuan, dan outlet wajib valid.' });
    }
    const barcode = body.barcode ? normalizeBarcode(body.barcode) : null;
    const id = randomUUID();
    const sku = String(body.sku || `NGL-${Date.now().toString(36).toUpperCase()}`).trim();
    const openingStock = Number(body.stock || 0);
    if (!Number.isFinite(openingStock) || openingStock < 0) return res.status(400).json({ message: 'Stok awal tidak valid.' });
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO ingredients
       (id, name, inventory_type, sku, barcode, category, unit, purchase_unit, purchase_conversion,
        stock, min_stock, critical_stock, cost_price, supplier, outlet, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, body.name.trim(), body.inventoryType, sku, barcode, body.category || 'Lainnya', body.unit.trim(),
       body.purchaseUnit || body.unit.trim(), Number(body.purchaseConversion || 1), openingStock,
       Number(body.minStock || 0), Number(body.criticalStock || 0), Number(body.costPrice || 0), body.supplier || null, outlet]
    );
    if (openingStock > 0) {
      await connection.query(
        `INSERT INTO inventory_movements
         (ingredient_id, outlet, movement_type, quantity, stock_before, stock_after, input_method,
          reference_type, actor_id, actor_name, notes)
         VALUES (?, ?, 'adjustment', ?, 0, ?, 'manual', 'opening_balance', ?, ?, 'Stok awal item')`,
        [id, outlet, openingStock, openingStock, (req as any).auth?.id || null, getVerifiedActor(req)]
      );
    }
    await connection.commit();
    const item = await fetchItem(id);
    await addAuditLog(getVerifiedActor(req), 'Tambah Item Inventori', `${item.name} (${outlet})`);
    res.status(201).json(item);
  } catch (error: any) {
    await connection.rollback();
    const duplicate = error.code === 'ER_DUP_ENTRY';
    res.status(duplicate ? 409 : 500).json({ message: duplicate ? 'SKU atau barcode sudah terdaftar pada outlet ini.' : 'Gagal menambah item inventori', ...(duplicate ? {} : { error: error.message }) });
  } finally {
    connection.release();
  }
});

router.put('/:id', requireInventoryAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const barcode = body.barcode ? normalizeBarcode(body.barcode) : null;
    const [result]: any = await db.query(
      `UPDATE ingredients SET name=?, inventory_type=?, sku=?, barcode=?, category=?, unit=?, purchase_unit=?,
       purchase_conversion=?, min_stock=?, critical_stock=?, cost_price=?, supplier=?, is_active=? WHERE id=?`,
      [body.name?.trim(), body.inventoryType, body.sku?.trim() || null, barcode, body.category || 'Lainnya', body.unit?.trim(),
       body.purchaseUnit || body.unit, Number(body.purchaseConversion || 1), Number(body.minStock || 0),
       Number(body.criticalStock || 0), Number(body.costPrice || 0), body.supplier || null, body.isActive === false ? 0 : 1, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Item inventori tidak ditemukan.' });
    const item = await fetchItem(req.params.id);
    await addAuditLog(getVerifiedActor(req), 'Ubah Item Inventori', item.name);
    res.json(item);
  } catch (error: any) {
    const duplicate = error.code === 'ER_DUP_ENTRY';
    res.status(duplicate ? 409 : 500).json({ message: duplicate ? 'SKU atau barcode sudah digunakan.' : 'Gagal mengubah item inventori', ...(duplicate ? {} : { error: error.message }) });
  }
});

async function applyMovement(req: Request, res: Response, forcedType?: string) {
  const connection = await db.getConnection();
  try {
    const type = forcedType || String(req.body.type || 'purchase');
    if (!validMovements.has(type)) return res.status(400).json({ message: 'Jenis mutasi stok tidak valid.' });
    const inputMethod = validInputMethods.has(req.body.input_method) ? req.body.input_method : 'manual';
    await connection.beginTransaction();
    const [rows]: any = await connection.query('SELECT * FROM ingredients WHERE id = ? AND is_active = 1 FOR UPDATE', [req.params.id]);
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ message: 'Item inventori tidak ditemukan.' }); }
    const raw = rows[0];
    const purchaseConversion = type === 'purchase' && req.body.use_purchase_unit !== false ? Number(raw.purchase_conversion || 1) : 1;
    const movement = calculateMovement(type as any, Number(req.body.quantity), purchaseConversion, Number(raw.stock));
    await connection.query('UPDATE ingredients SET stock = ?, cost_price = COALESCE(?, cost_price), supplier = COALESCE(?, supplier) WHERE id = ?', [movement.after, req.body.unit_cost ?? null, req.body.supplier || null, raw.id]);
    await connection.query(
      `INSERT INTO inventory_movements
       (ingredient_id, outlet, movement_type, quantity, stock_before, stock_after, input_method,
        reference_type, reference_id, purchase_unit, purchase_quantity, unit_cost, supplier,
        batch_number, expires_at, notes, actor_id, actor_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [raw.id, raw.outlet, type, movement.delta, Number(raw.stock), movement.after, inputMethod,
       raw.purchase_unit || raw.unit, Number(req.body.quantity), req.body.unit_cost ?? null, req.body.supplier || null,
       req.body.batch_number || null, req.body.expires_at || null, req.body.notes || null,
       (req as any).auth?.id || null, getVerifiedActor(req)]
    );
    await syncMenuAvailability(connection, raw.outlet);
    await connection.commit();
    const item = await fetchItem(raw.id);
    const change = {
      id: item.id,
      name: item.name,
      before: Number(raw.stock),
      after: item.stock,
      unit: item.unit,
      previousLevel: getStockLevel(Number(raw.stock), Number(raw.min_stock), Number(raw.critical_stock)),
      level: item.level
    };
    emitInventoryChanges(req.app.get('io'), [change]);
    await addAuditLog(getVerifiedActor(req), `Mutasi Stok: ${type}`, `${item.name} (${movement.delta >= 0 ? '+' : ''}${movement.delta} ${item.unit})`);
    res.json({ message: 'Mutasi stok berhasil disimpan.', item, movement });
  } catch (error: any) {
    await connection.rollback();
    const invalid = /tidak valid|tidak mencukupi/i.test(error.message);
    res.status(invalid ? 400 : 500).json({ message: invalid ? error.message : 'Gagal menyimpan mutasi stok', ...(invalid ? {} : { error: error.message }) });
  } finally {
    connection.release();
  }
}

router.post('/transfer', requireInventoryAdmin, async (req: Request, res: Response) => {
  const connection = await db.getConnection();
  try {
    const { ingredient_id, from_outlet, to_outlet, quantity, notes } = req.body;
    const amount = Number(quantity);
    if (!ingredient_id || !validOutlets.has(from_outlet) || !validOutlets.has(to_outlet) || from_outlet === to_outlet || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Item, outlet asal/tujuan, dan jumlah transfer harus valid.' });
    await connection.beginTransaction();
    const [rows]: any = await connection.query('SELECT * FROM ingredients WHERE id = ? AND outlet IN (?, ?) AND is_active = 1 FOR UPDATE', [ingredient_id, from_outlet, to_outlet]);
    if (rows.length !== 2) { await connection.rollback(); return res.status(404).json({ message: 'Item inventori harus tersedia pada kedua outlet.' }); }
    const source = rows.find((item: any) => item.outlet === from_outlet);
    const target = rows.find((item: any) => item.outlet === to_outlet);
    if (Number(source.stock) < amount) { await connection.rollback(); return res.status(409).json({ message: `Stok ${source.name} di outlet asal tidak mencukupi.` }); }
    const sourceAfter = Number(source.stock) - amount; const targetAfter = Number(target.stock) + amount;
    await connection.query('UPDATE ingredients SET stock = ? WHERE id = ?', [sourceAfter, source.id]);
    await connection.query('UPDATE ingredients SET stock = ? WHERE id = ?', [targetAfter, target.id]);
    const actor = getVerifiedActor(req); const reference = randomUUID();
    await connection.query(`INSERT INTO inventory_movements (ingredient_id, outlet, movement_type, quantity, stock_before, stock_after, input_method, reference_type, reference_id, actor_id, actor_name, notes) VALUES (?, ?, 'transfer_out', ?, ?, ?, 'manual', 'transfer', ?, ?, ?, ?)`, [source.id, from_outlet, -amount, source.stock, sourceAfter, reference, (req as any).auth?.id || null, actor, notes || `Transfer ke ${to_outlet}`]);
    await connection.query(`INSERT INTO inventory_movements (ingredient_id, outlet, movement_type, quantity, stock_before, stock_after, input_method, reference_type, reference_id, actor_id, actor_name, notes) VALUES (?, ?, 'transfer_in', ?, ?, ?, 'manual', 'transfer', ?, ?, ?, ?)`, [target.id, to_outlet, amount, target.stock, targetAfter, reference, (req as any).auth?.id || null, actor, notes || `Transfer dari ${from_outlet}`]);
    await syncMenuAvailability(connection, from_outlet); await syncMenuAvailability(connection, to_outlet);
    await connection.commit();
    emitInventoryChanges(req.app.get('io'), [{ id: source.id, name: source.name, outlet: from_outlet, before: Number(source.stock), after: sourceAfter, unit: source.unit }, { id: target.id, name: target.name, outlet: to_outlet, before: Number(target.stock), after: targetAfter, unit: target.unit }]);
    await addAuditLog(actor, 'Transfer Stok Antar Outlet', `${source.name}: ${from_outlet} → ${to_outlet}`);
    res.json({ message: 'Transfer stok berhasil.', reference_id: reference });
  } catch (error: any) { await connection.rollback(); res.status(500).json({ message: 'Gagal transfer stok', error: error.message }); }
  finally { connection.release(); }
});

router.post('/:id/movements', requireInventoryAdmin, (req, res) => applyMovement(req, res));
router.post('/:id/restock', requireInventoryAdmin, (req, res) => applyMovement(req, res, 'purchase'));

export default router;
