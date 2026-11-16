// Rekap penjualan bertingkat: per hari, per hari-dalam-seminggu (Senin–Minggu),
// per minggu (dengan nomor minggu + rentang tanggal), per bulan, dan per tahun.
//
// Kenapa dipisah dari menuSales.ts: menuSales menjawab "menu apa yang laku",
// modul ini menjawab "kapan lakunya". Semua perhitungan memakai tanggal WIB
// supaya transaksi pukul 00:30 WIB tidak jatuh ke hari sebelumnya.
//
// Aturan angka: hanya transaksi berstatus LUNAS yang dihitung sebagai
// pendapatan, sama seperti panel "Ringkasan Pendapatan" di layar. Pesanan
// belum lunas tetap dihitung di kolom jumlah pesanan pada ringkasan agar
// selisihnya terlihat, bukan disembunyikan.

import { wibDateKey, shiftDateKey, formatWibDateKey } from './salesHistoryPeriod';
import type { SalesOrderLike } from './menuSales';

export interface BreakdownOrder extends SalesOrderLike {
  payment_status?: string | null;
}

export interface MenuQuantity {
  name: string;
  quantity: number;
  revenue: number;
}

interface Agg {
  orders: number;
  items: number;
  revenue: number;
  menus: Map<string, MenuQuantity>;
}

export const WEEKDAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
// Urutan tampilan: Senin lebih dulu karena minggu kerja, Minggu di akhir.
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const rupiah = (value: number | string) => Math.round(Number(value) || 0);

function emptyAgg(): Agg {
  return { orders: 0, items: 0, revenue: 0, menus: new Map() };
}

function addOrder(agg: Agg, order: BreakdownOrder) {
  agg.orders += 1;
  agg.revenue += rupiah(order.total_price);
  for (const item of order.items ?? []) {
    const quantity = rupiah(item.quantity);
    const price = rupiah(item.price);
    const name = String(item.name ?? '').trim() || 'Tanpa Nama';
    const key = name.toLowerCase();
    const menu = agg.menus.get(key) ?? { name, quantity: 0, revenue: 0 };
    menu.quantity += quantity;
    menu.revenue += price * quantity;
    agg.menus.set(key, menu);
  }
  agg.items += [...(order.items ?? [])].reduce((sum, item) => sum + rupiah(item.quantity), 0);
}

function topMenuOf(agg: Agg): MenuQuantity | null {
  const menus = [...agg.menus.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name));
  return menus[0] ?? null;
}

export function weekdayIndex(dateKey: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return -1;
  const date = new Date(`${dateKey}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? -1 : date.getUTCDay();
}

export function weekdayName(dateKey: string): string {
  const index = weekdayIndex(dateKey);
  return index < 0 ? 'Tanggal tidak valid' : WEEKDAY_NAMES[index];
}

function isPaid(order: BreakdownOrder): boolean {
  const status = String(order.payment_status ?? '').toLowerCase();
  // Data tanpa kolom pembayaran (mis. hasil normalisasi Smart Tag lama)
  // dianggap lunas agar tidak hilang dari rekap; data yang jelas belum lunas
  // tetap dikecualikan.
  return status === '' || status === 'lunas';
}

export function paidOnly(orders: BreakdownOrder[]): BreakdownOrder[] {
  return orders.filter(isPaid);
}

export interface DailyRow {
  date: string;
  label: string;
  weekday: string;
  orders: number;
  items: number;
  revenue: number;
  topMenu: string;
  topMenuQty: number;
}

export function dailyBreakdown(orders: BreakdownOrder[]): DailyRow[] {
  const groups = new Map<string, Agg>();
  for (const order of orders) {
    const key = wibDateKey(order.created_at ?? '');
    if (!key) continue;
    const agg = groups.get(key) ?? emptyAgg();
    addOrder(agg, order);
    groups.set(key, agg);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agg]) => {
      const top = topMenuOf(agg);
      return {
        date,
        label: formatWibDateKey(date),
        weekday: weekdayName(date),
        orders: agg.orders,
        items: agg.items,
        revenue: agg.revenue,
        topMenu: top?.name ?? '-',
        topMenuQty: top?.quantity ?? 0,
      };
    });
}

export interface WeekdayRow {
  weekday: number;
  name: string;
  orders: number;
  items: number;
  revenue: number;
  topMenu: string;
  topMenuQty: number;
}

export function weekdayBreakdown(orders: BreakdownOrder[]): WeekdayRow[] {
  const groups = new Map<number, Agg>();
  for (const order of orders) {
    const key = wibDateKey(order.created_at ?? '');
    const index = weekdayIndex(key);
    if (index < 0) continue;
    const agg = groups.get(index) ?? emptyAgg();
    addOrder(agg, order);
    groups.set(index, agg);
  }
  return WEEKDAY_ORDER.map(index => {
    const agg = groups.get(index) ?? emptyAgg();
    const top = topMenuOf(agg);
    return {
      weekday: index,
      name: WEEKDAY_NAMES[index],
      orders: agg.orders,
      items: agg.items,
      revenue: agg.revenue,
      topMenu: top?.name ?? '-',
      topMenuQty: top?.quantity ?? 0,
    };
  });
}

export interface WeekdayMenuRow {
  weekday: number;
  name: string;
  orders: number;
  items: number;
  revenue: number;
  menus: MenuQuantity[];
}

// Matriks "menu apa yang laku di hari Senin, Selasa, ...". Dipakai untuk
// menjawab pertanyaan "makanan yang laku hari Senin–Jumat apa saja".
export function weekdayMenuBreakdown(orders: BreakdownOrder[]): WeekdayMenuRow[] {
  const groups = new Map<number, Agg>();
  for (const order of orders) {
    const index = weekdayIndex(wibDateKey(order.created_at ?? ''));
    if (index < 0) continue;
    const agg = groups.get(index) ?? emptyAgg();
    addOrder(agg, order);
    groups.set(index, agg);
  }
  return WEEKDAY_ORDER.map(index => {
    const agg = groups.get(index) ?? emptyAgg();
    const menus = [...agg.menus.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name));
    return { weekday: index, name: WEEKDAY_NAMES[index], orders: agg.orders, items: agg.items, revenue: agg.revenue, menus };
  });
}

export interface WeekRow {
  index: number;
  label: string;
  start: string;
  end: string;
  rangeLabel: string;
  orders: number;
  items: number;
  revenue: number;
  topMenu: string;
  topMenuQty: number;
}

function mondayOf(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return '';
  return shiftDateKey(dateKey, -((day.getUTCDay() + 6) % 7));
}

// Nomor minggu dihitung dari awal periode ekspor, bukan nomor minggu ISO —
// tujuannya supaya laporan mingguan selalu mulai dari "Minggu ke-1" beserta
// tanggal awalnya, sesuai permintaan laporan manual.
//
// Rentang tiap minggu DIPOTONG ke batas periode. Contoh: ekspor Oktober 2026
// dimulai Kamis 01 Okt, jadi Minggu ke-1 ditulis "01 Okt – 04 Okt 2026",
// bukan "28 Sep – 04 Okt" — kalau tidak, label akan menjanjikan data akhir
// September yang memang tidak ikut diekspor.
export function weekBreakdown(orders: BreakdownOrder[], range?: { start: string; end: string } | null): WeekRow[] {
  const keys = orders.map(order => wibDateKey(order.created_at ?? '')).filter(Boolean).sort();
  const start = range?.start && /^\d{4}-\d{2}-\d{2}$/.test(range.start) ? range.start : keys[0];
  const end = range?.end && /^\d{4}-\d{2}-\d{2}$/.test(range.end) ? range.end : keys[keys.length - 1];
  if (!start || !end) return [];
  const firstMonday = mondayOf(start);
  if (!firstMonday) return [];

  const byDate = new Map<string, Agg>();
  for (const order of orders) {
    const key = wibDateKey(order.created_at ?? '');
    if (!key) continue;
    const agg = byDate.get(key) ?? emptyAgg();
    addOrder(agg, order);
    byDate.set(key, agg);
  }

  const rows: WeekRow[] = [];
  let cursor = firstMonday;
  let index = 1;
  while (cursor <= end) {
    const rawEnd = shiftDateKey(cursor, 6);
    // Potong ke batas periode agar label rentang selalu sama dengan data.
    const weekStart = cursor < start ? start : cursor;
    const weekEnd = rawEnd > end ? end : rawEnd;
    const agg = emptyAgg();
    for (const [date, dayAgg] of byDate) {
      if (date < weekStart || date > weekEnd) continue;
      agg.orders += dayAgg.orders;
      agg.items += dayAgg.items;
      agg.revenue += dayAgg.revenue;
      for (const [key, menu] of dayAgg.menus) {
        const existing = agg.menus.get(key) ?? { name: menu.name, quantity: 0, revenue: 0 };
        existing.quantity += menu.quantity;
        existing.revenue += menu.revenue;
        agg.menus.set(key, existing);
      }
    }
    const top = topMenuOf(agg);
    rows.push({
      index,
      label: `Minggu ke-${index}`,
      start: weekStart,
      end: weekEnd,
      rangeLabel: weekStart === weekEnd
        ? formatWibDateKey(weekStart)
        : `${formatWibDateKey(weekStart)} – ${formatWibDateKey(weekEnd)}`,
      orders: agg.orders,
      items: agg.items,
      revenue: agg.revenue,
      topMenu: top?.name ?? '-',
      topMenuQty: top?.quantity ?? 0,
    });
    cursor = shiftDateKey(cursor, 7);
    index += 1;
  }
  return rows;
}

export interface MonthRow {
  month: string;
  label: string;
  orders: number;
  items: number;
  revenue: number;
  topMenu: string;
  topMenuQty: number;
}

export function monthBreakdown(orders: BreakdownOrder[]): MonthRow[] {
  const groups = new Map<string, Agg>();
  for (const order of orders) {
    const key = wibDateKey(order.created_at ?? '').slice(0, 7);
    if (key.length !== 7) continue;
    const agg = groups.get(key) ?? emptyAgg();
    addOrder(agg, order);
    groups.set(key, agg);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, agg]) => {
    const top = topMenuOf(agg);
    return {
      month,
      label: new Date(`${month}-01T00:00:00+07:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }),
      orders: agg.orders,
      items: agg.items,
      revenue: agg.revenue,
      topMenu: top?.name ?? '-',
      topMenuQty: top?.quantity ?? 0,
    };
  });
}

export interface YearRow {
  year: string;
  orders: number;
  items: number;
  revenue: number;
  topMenu: string;
  topMenuQty: number;
}

export function yearBreakdown(orders: BreakdownOrder[]): YearRow[] {
  const groups = new Map<string, Agg>();
  for (const order of orders) {
    const key = wibDateKey(order.created_at ?? '').slice(0, 4);
    if (key.length !== 4) continue;
    const agg = groups.get(key) ?? emptyAgg();
    addOrder(agg, order);
    groups.set(key, agg);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, agg]) => {
    const top = topMenuOf(agg);
    return { year, orders: agg.orders, items: agg.items, revenue: agg.revenue, topMenu: top?.name ?? '-', topMenuQty: top?.quantity ?? 0 };
  });
}

export interface SalesSummary {
  transactions: number;
  paidTransactions: number;
  items: number;
  revenue: number;
  days: number;
  averagePerDay: number;
  averagePerTransaction: number;
  bestDay: DailyRow | null;
  busiestWeekday: WeekdayRow | null;
  topMenu: MenuQuantity | null;
}

export function salesSummary(allOrders: BreakdownOrder[], paidOrders: BreakdownOrder[]): SalesSummary {
  const days = dailyBreakdown(paidOrders);
  const weekdays = weekdayBreakdown(paidOrders);
  const revenue = paidOrders.reduce((sum, order) => sum + rupiah(order.total_price), 0);
  const items = paidOrders.reduce((sum, order) => sum + [...(order.items ?? [])].reduce((acc, item) => acc + rupiah(item.quantity), 0), 0);
  const menuTotals = new Map<string, MenuQuantity>();
  for (const order of paidOrders) {
    for (const item of order.items ?? []) {
      const name = String(item.name ?? '').trim() || 'Tanpa Nama';
      const key = name.toLowerCase();
      const menu = menuTotals.get(key) ?? { name, quantity: 0, revenue: 0 };
      menu.quantity += rupiah(item.quantity);
      menu.revenue += rupiah(item.price) * rupiah(item.quantity);
      menuTotals.set(key, menu);
    }
  }
  const topMenu = [...menuTotals.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)[0] ?? null;
  const bestDay = [...days].sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  const busiestWeekday = [...weekdays].sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  return {
    transactions: allOrders.length,
    paidTransactions: paidOrders.length,
    items,
    revenue,
    days: days.length,
    averagePerDay: days.length ? Math.round(revenue / days.length) : 0,
    averagePerTransaction: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
    bestDay,
    busiestWeekday,
    topMenu,
  };
}
