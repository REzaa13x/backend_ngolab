// Aturan "selesaikan semua pesanan" untuk kasir/admin.
//
// Kenapa dipisah ke sini: endpoint bulk menyentuh banyak baris sekaligus, jadi
// kriteria pesanan mana yang boleh ditutup harus bisa diuji tanpa database.
// Yang ditutup hanya pesanan yang sudah LUNAS dan masih berjalan. Pesanan
// pre-order sengaja dikecualikan karena statusnya dikelola halaman Pesanan
// Pre-order (lihat canUseGenericOrderStatus), dan pesanan batal/yatim tidak
// boleh ikut "diselesaikan".

export const BULK_COMPLETABLE_STATUSES = ['menunggu', 'sedang_diproses', 'siap'] as const;

export interface BulkCompletableOrder {
  id: string | number;
  status?: string | null;
  payment_status?: string | null;
  order_type?: string | null;
  preorder_status?: string | null;
  outlet?: string | null;
  created_at?: string | null;
}

export type BulkSkipReason = 'sudah_selesai' | 'belum_lunas' | 'dibatalkan' | 'preorder' | 'outlet_lain' | 'status_tidak_dikenal';

export interface BulkPlan {
  completable: BulkCompletableOrder[];
  skipped: { id: string; reason: BulkSkipReason }[];
}

export interface BulkScope {
  outlet?: 'ngolab' | 'coworking';
  paidOnly?: boolean;
}

// Alasan dilewati dipakai untuk laporan ke pengguna, jadi urutannya penting:
// pembayaran diperiksa lebih dulu supaya pesan "belum lunas" yang muncul,
// bukan "status tidak dikenal".
export function bulkSkipReason(order: BulkCompletableOrder, scope: BulkScope = {}): BulkSkipReason | null {
  const status = String(order.status ?? '').toLowerCase();
  const payment = String(order.payment_status ?? '').toLowerCase();
  const orderType = String(order.order_type ?? '').toLowerCase();
  if (orderType === 'preorder') return 'preorder';
  if (status === 'dibatalkan') return 'dibatalkan';
  if (status === 'selesai') return 'sudah_selesai';
  if (scope.outlet && String(order.outlet ?? '').toLowerCase() !== scope.outlet) return 'outlet_lain';
  if (scope.paidOnly !== false && payment !== 'lunas') return 'belum_lunas';
  if (!(BULK_COMPLETABLE_STATUSES as readonly string[]).includes(status)) return 'status_tidak_dikenal';
  return null;
}

export function planBulkComplete(orders: BulkCompletableOrder[], scope: BulkScope = {}): BulkPlan {
  const plan: BulkPlan = { completable: [], skipped: [] };
  for (const order of orders) {
    const reason = bulkSkipReason(order, scope);
    if (reason) plan.skipped.push({ id: String(order.id), reason });
    else plan.completable.push(order);
  }
  return plan;
}

export function bulkCompleteMessage(plan: BulkPlan): string {
  const count = (reason: BulkSkipReason) => plan.skipped.filter(item => item.reason === reason).length;
  const parts = [`${plan.completable.length} pesanan diselesaikan`];
  const belumLunas = count('belum_lunas');
  if (belumLunas) parts.push(`${belumLunas} belum lunas dilewati`);
  if (count('sudah_selesai')) parts.push(`${count('sudah_selesai')} sudah selesai`);
  if (count('dibatalkan')) parts.push(`${count('dibatalkan')} dibatalkan`);
  if (count('preorder')) parts.push(`${count('preorder')} pre-order dilewati`);
  if (count('outlet_lain')) parts.push(`${count('outlet_lain')} outlet lain`);
  if (count('status_tidak_dikenal')) parts.push(`${count('status_tidak_dikenal')} status tidak dikenal`);
  return parts.join(' · ');
}
