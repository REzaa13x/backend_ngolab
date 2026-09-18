export interface OrderItemColumn {
  Field: string;
  Null?: string;
  Default?: unknown;
}

export interface OrderItemInsertValue {
  orderId: string;
  menuId: string | null;
  preorderItemId?: string | null;
  name: string;
  quantity: number;
  price: number;
}

export interface NormalizedExternalOrderItem {
  menuId: string | null;
  name: string;
  quantity: number;
  price: number;
}

export function externalOrderPaymentState() {
  return {
    userId: null,
    paymentStatus: 'belum_bayar' as const,
    orderStatus: 'menunggu' as const,
    amountPaid: 0,
  };
}

export function buildOrderItemInsert(
  availableColumns: Iterable<string>,
  item: OrderItemInsertValue,
): { sql: string; params: unknown[] } {
  const available = new Set(availableColumns);
  const columns = ['order_id', 'menu_id'];
  const params: unknown[] = [item.orderId, item.menuId];

  if (item.preorderItemId !== undefined && available.has('preorder_item_id')) {
    columns.push('preorder_item_id');
    params.push(item.preorderItemId);
  }
  if (available.has('item_name')) {
    columns.push('item_name');
    params.push(item.name);
  }
  if (available.has('menu_name')) {
    columns.push('menu_name');
    params.push(item.name);
  }
  if (!available.has('item_name') && !available.has('menu_name')) {
    throw new Error('Skema order_items tidak memiliki kolom nama item.');
  }

  columns.push('quantity', 'price');
  params.push(item.quantity, item.price);
  const placeholders = columns.map(() => '?').join(', ');
  return {
    sql: `INSERT INTO order_items (${columns.join(', ')}) VALUES (${placeholders})`,
    params,
  };
}

export function normalizeExternalOrderItems(items: unknown): NormalizedExternalOrderItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Daftar item pesanan wajib diisi.');
  }

  return items.map((raw, index) => {
    const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const name = String(item.name ?? item.item_name ?? item.menu_name ?? '').trim();
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    if (!name) throw new Error(`Nama item ke-${index + 1} wajib diisi.`);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Quantity item ke-${index + 1} harus bilangan bulat lebih dari 0.`);
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Price item ke-${index + 1} harus berupa angka 0 atau lebih.`);
    }
    const rawMenuId = item.id ?? item.menu_id;
    return {
      menuId: rawMenuId === null || rawMenuId === undefined || rawMenuId === '' ? null : String(rawMenuId),
      name,
      quantity,
      price,
    };
  });
}

export function orderItemSchemaChanges(columns: OrderItemColumn[]): string[] {
  const byName = new Map(columns.map(column => [column.Field, column]));
  const statements: string[] = [];

  if (!byName.has('item_name')) {
    statements.push('ALTER TABLE order_items ADD COLUMN item_name VARCHAR(200) NULL DEFAULT NULL AFTER menu_id');
  }

  if (!byName.has('menu_name')) {
    statements.push('ALTER TABLE order_items ADD COLUMN menu_name VARCHAR(200) NULL DEFAULT NULL AFTER item_name');
  }

  // Kolom NOT NULL membuat aplikasi kasir gagal INSERT saat hanya salah satu kolom nama dikirim.
  // Hanya kolom yang benar-benar NOT NULL yang disesuaikan, dan hanya sifat Null/default-nya.
  for (const name of ['item_name', 'menu_name']) {
    const column = byName.get(name);
    if (column && column.Null === 'NO') {
      statements.push(`ALTER TABLE order_items MODIFY COLUMN ${name} VARCHAR(200) NULL DEFAULT NULL`);
    }
  }

  statements.push("UPDATE order_items SET item_name = menu_name WHERE (item_name IS NULL OR item_name = '') AND menu_name IS NOT NULL");
  statements.push("UPDATE order_items SET menu_name = item_name WHERE (menu_name IS NULL OR menu_name = '') AND item_name IS NOT NULL");
  return statements;
}

export function orderItemColumnNames(columns: OrderItemColumn[]): Set<string> {
  return new Set(columns.map(column => String(column.Field)));
}
