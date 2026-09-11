import { aggregateRecipeNeeds, getStockLevel } from './inventory.js';

export class InsufficientInventoryError extends Error {
  statusCode = 409;
}

export interface OrderInventoryItem {
  name: string;
  quantity: number;
}

export async function syncMenuAvailability(connection: any, outlet: string) {
  const [rows]: any = await connection.query(
    `SELECT ri.menu_name, FLOOR(MIN(i.stock / NULLIF(ri.amount, 0))) AS available_portions
     FROM recipe_ingredients ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.outlet = ? AND i.outlet = ? AND i.is_active = 1
     GROUP BY ri.menu_name`,
    [outlet, outlet]
  );
  for (const row of rows) {
    const portions = Math.max(0, Number(row.available_portions || 0));
    await connection.query(
      `UPDATE menus
       SET stock = ?, inventory_available = ?,
           in_stock = IF(is_active = 1 AND availability_override = 'auto' AND ? = 1, 1, 0)
       WHERE name = ? AND outlet = ?`,
      [portions, portions > 0 ? 1 : 0, portions > 0 ? 1 : 0, row.menu_name, outlet]
    );
  }
}

export async function consumeInventoryForOrder(
  connection: any,
  orderId: string,
  items: OrderInventoryItem[],
  outlet: string,
  actorName: string
) {
  const [existing]: any = await connection.query(
    "SELECT id FROM inventory_movements WHERE reference_type = 'order' AND reference_id = ? AND movement_type = 'sale' LIMIT 1",
    [orderId]
  );
  if (existing.length) return [];

  const names = [...new Set(items.map(item => String(item.name).trim()).filter(Boolean))];
  if (!names.length) return [];
  const placeholders = names.map(() => '?').join(',');
  const [recipeRows]: any = await connection.query(
    `SELECT menu_name, ingredient_id, amount FROM recipe_ingredients WHERE outlet = ? AND menu_name IN (${placeholders})`,
    [outlet, ...names]
  );
  const needs = aggregateRecipeNeeds(items, recipeRows);
  const changes: any[] = [];

  for (const need of needs) {
    const [rows]: any = await connection.query(
      'SELECT id, name, unit, stock, min_stock, critical_stock, outlet FROM ingredients WHERE id = ? AND outlet = ? AND is_active = 1 FOR UPDATE',
      [need.ingredientId, outlet]
    );
    if (!rows.length) throw new InsufficientInventoryError(`Bahan resep ${need.ingredientId} tidak tersedia di outlet ${outlet}.`);
    const item = rows[0];
    const before = Number(item.stock);
    const after = before - need.quantity;
    if (after < 0) {
      throw new InsufficientInventoryError(`Stok ${item.name} tidak mencukupi. Tersedia ${before} ${item.unit}, dibutuhkan ${need.quantity} ${item.unit}.`);
    }

    await connection.query('UPDATE ingredients SET stock = ? WHERE id = ?', [after, item.id]);
    await connection.query(
      `INSERT INTO inventory_movements
       (ingredient_id, outlet, movement_type, quantity, stock_before, stock_after, input_method,
        reference_type, reference_id, actor_name, notes)
       VALUES (?, ?, 'sale', ?, ?, ?, 'system', 'order', ?, ?, ?)`,
      [item.id, outlet, -need.quantity, before, after, orderId, actorName, `Pemakaian resep pesanan ${orderId}`]
    );
    changes.push({
      id: item.id,
      name: item.name,
      unit: item.unit,
      before,
      after,
      previousLevel: getStockLevel(before, Number(item.min_stock), Number(item.critical_stock)),
      level: getStockLevel(after, Number(item.min_stock), Number(item.critical_stock))
    });
  }
  if (changes.length) await syncMenuAvailability(connection, outlet);
  return changes;
}

export async function restoreInventoryForOrder(
  connection: any,
  orderId: string,
  actorName: string
) {
  const [alreadyRestored]: any = await connection.query(
    "SELECT id FROM inventory_movements WHERE reference_type = 'order_refund' AND reference_id = ? LIMIT 1",
    [orderId]
  );
  if (alreadyRestored.length) return [];

  const [sales]: any = await connection.query(
    `SELECT ingredient_id, outlet, SUM(-quantity) AS quantity
     FROM inventory_movements
     WHERE reference_type = 'order' AND reference_id = ? AND movement_type = 'sale'
     GROUP BY ingredient_id, outlet
     ORDER BY ingredient_id`,
    [orderId]
  );
  const changes: any[] = [];
  const changedOutlets = new Set<string>();
  for (const sale of sales) {
    const [rows]: any = await connection.query(
      'SELECT id, name, unit, stock, min_stock, critical_stock FROM ingredients WHERE id = ? FOR UPDATE',
      [sale.ingredient_id]
    );
    if (!rows.length) continue;
    const item = rows[0];
    const before = Number(item.stock);
    const quantity = Number(sale.quantity);
    const after = before + quantity;
    await connection.query('UPDATE ingredients SET stock = ? WHERE id = ?', [after, item.id]);
    await connection.query(
      `INSERT INTO inventory_movements
       (ingredient_id, outlet, movement_type, quantity, stock_before, stock_after, input_method,
        reference_type, reference_id, actor_name, notes)
       VALUES (?, ?, 'refund', ?, ?, ?, 'system', 'order_refund', ?, ?, ?)`,
      [item.id, sale.outlet, quantity, before, after, orderId, actorName, `Pengembalian stok pesanan ${orderId}`]
    );
    changedOutlets.add(String(sale.outlet));
    changes.push({ id: item.id, name: item.name, unit: item.unit, before, after, previousLevel: getStockLevel(before, Number(item.min_stock), Number(item.critical_stock)), level: getStockLevel(after, Number(item.min_stock), Number(item.critical_stock)) });
  }
  for (const outlet of changedOutlets) await syncMenuAvailability(connection, outlet);
  return changes;
}

export function emitInventoryChanges(io: any, changes: any[]) {
  if (!io || !changes.length) return;
  io.emit('inventory_updated', changes);
  for (const change of changes) {
    if (change.level && change.level !== 'safe' && change.previousLevel !== change.level) io.emit('low_stock_alert', change);
  }
}
