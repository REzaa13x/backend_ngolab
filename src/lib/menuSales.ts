export interface SoldMenuItem {
  name: string;
  quantity: number | string;
  price: number | string;
}

export interface SalesOrderLike {
  id?: string;
  invoice_number?: string;
  customer_name?: string;
  created_at?: string;
  total_price: number | string;
  items?: SoldMenuItem[];
}

export interface SoldMenuRow {
  name: string;
  quantity: number;
  revenue: number;
  orders: number;
}

export interface OrderTotalCheck {
  invoice_number: string;
  orderTotal: number;
  itemSubtotal: number;
  difference: number;
  matches: boolean;
  itemCount: number;
}

export interface TotalValidationSummary {
  checked: number;
  matched: number;
  mismatched: number;
  withoutItems: number;
  itemSubtotal: number;
  orderTotal: number;
  difference: number;
  checks: OrderTotalCheck[];
}

const rupiah = (value: number | string) => Math.round(Number(value) || 0);

export function orderItemsSubtotal(order: SalesOrderLike): number {
  return (order.items ?? []).reduce((sum, item) => sum + rupiah(item.price) * rupiah(item.quantity), 0);
}

export function orderItemsQuantity(order: SalesOrderLike): number {
  return (order.items ?? []).reduce((sum, item) => sum + rupiah(item.quantity), 0);
}

// Total pesanan dianggap benar bila sama persis dengan jumlah harga satuan x qty.
// Pesanan tanpa rincian item tidak bisa divalidasi, jadi dilaporkan terpisah —
// bukan dianggap cocok, karena itu akan menyembunyikan data yang hilang.
export function reconcileOrderTotal(order: SalesOrderLike): OrderTotalCheck | null {
  const items = order.items ?? [];
  if (!items.length) return null;
  const itemSubtotal = orderItemsSubtotal(order);
  const orderTotal = rupiah(order.total_price);
  return {
    invoice_number: String(order.invoice_number ?? '-'),
    orderTotal,
    itemSubtotal,
    difference: orderTotal - itemSubtotal,
    matches: orderTotal === itemSubtotal,
    itemCount: orderItemsQuantity(order),
  };
}

export function summarizeTotalValidation(orders: SalesOrderLike[]): TotalValidationSummary {
  const checks: OrderTotalCheck[] = [];
  let withoutItems = 0;
  for (const order of orders) {
    const check = reconcileOrderTotal(order);
    if (check) checks.push(check);
    else withoutItems += 1;
  }
  const itemSubtotal = checks.reduce((sum, check) => sum + check.itemSubtotal, 0);
  const orderTotal = checks.reduce((sum, check) => sum + check.orderTotal, 0);
  const mismatched = checks.filter(check => !check.matches).length;
  return {
    checked: checks.length,
    matched: checks.length - mismatched,
    mismatched,
    withoutItems,
    itemSubtotal,
    orderTotal,
    difference: orderTotal - itemSubtotal,
    checks,
  };
}

// Rekap produk terjual: dikelompokkan per nama menu (case-insensitive) dan
// diurutkan dari yang paling laku agar langsung terbaca.
export function aggregateSoldMenus(orders: SalesOrderLike[]): SoldMenuRow[] {
  const groups = new Map<string, SoldMenuRow>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const displayName = String(item.name ?? '').trim() || 'Tanpa Nama';
      const key = displayName.toLowerCase();
      const row = groups.get(key) ?? { name: displayName, quantity: 0, revenue: 0, orders: 0 };
      row.quantity += rupiah(item.quantity);
      row.revenue += rupiah(item.price) * rupiah(item.quantity);
      row.orders += 1;
      groups.set(key, row);
    }
  }
  return [...groups.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name));
}

export function soldMenusTotals(rows: SoldMenuRow[]): { quantity: number; revenue: number } {
  return rows.reduce((total, row) => ({ quantity: total.quantity + row.quantity, revenue: total.revenue + row.revenue }), { quantity: 0, revenue: 0 });
}
