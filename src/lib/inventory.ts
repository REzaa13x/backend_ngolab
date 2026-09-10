export type StockLevel = 'safe' | 'low' | 'critical' | 'out';
export type InventoryMovementType = 'purchase' | 'adjustment' | 'waste' | 'stock_opname' | 'sale' | 'refund' | 'transfer_in' | 'transfer_out';

export function getStockLevel(stock: number, minStock: number, criticalStock: number): StockLevel {
  if (stock <= 0) return 'out';
  if (stock <= criticalStock) return 'critical';
  if (stock <= minStock) return 'low';
  return 'safe';
}

export function calculateMovement(
  type: InventoryMovementType,
  quantity: number,
  conversion: number,
  currentStock: number
) {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Jumlah stok tidak valid.');
  if (!Number.isFinite(conversion) || conversion <= 0) throw new Error('Konversi satuan tidak valid.');
  if (!Number.isFinite(currentStock) || currentStock < 0) throw new Error('Stok saat ini tidak valid.');

  if (type === 'stock_opname' || type === 'adjustment') {
    const after = quantity * conversion;
    return { delta: after - currentStock, after };
  }

  const absolute = quantity * conversion;
  const positive = type === 'purchase' || type === 'refund' || type === 'transfer_in';
  const delta = positive ? absolute : -absolute;
  const after = currentStock + delta;
  if (after < 0) throw new Error('Stok tidak mencukupi untuk transaksi ini.');
  return { delta, after };
}

export function normalizeBarcode(value: unknown): string {
  const barcode = typeof value === 'string' ? value.trim().replace(/\s+/g, '') : '';
  if (!barcode) throw new Error('Barcode tidak boleh kosong.');
  if (barcode.length > 100) throw new Error('Barcode terlalu panjang.');
  return barcode;
}

export interface OrderInventoryItem {
  name: string;
  quantity: number;
}

export interface RecipeRequirement {
  menu_name: string;
  ingredient_id: string;
  amount: number;
}

export function aggregateRecipeNeeds(items: OrderInventoryItem[], recipes: RecipeRequirement[]) {
  const totals = new Map<string, number>();
  const quantities = new Map<string, number>();
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!item.name || !Number.isFinite(quantity) || quantity <= 0) throw new Error('Item pesanan tidak valid.');
    quantities.set(item.name.trim().toLowerCase(), (quantities.get(item.name.trim().toLowerCase()) || 0) + quantity);
  }
  for (const recipe of recipes) {
    const orderQuantity = quantities.get(String(recipe.menu_name).trim().toLowerCase()) || 0;
    const amount = Number(recipe.amount);
    if (!orderQuantity || !Number.isFinite(amount) || amount <= 0) continue;
    totals.set(recipe.ingredient_id, (totals.get(recipe.ingredient_id) || 0) + orderQuantity * amount);
  }
  return [...totals.entries()]
    .map(([ingredientId, quantity]) => ({ ingredientId, quantity }))
    .sort((left, right) => left.ingredientId.localeCompare(right.ingredientId));
}
