// Cetak dokumen ke printer (thermal 80mm maupun printer biasa) tanpa dependensi tambahan.
//
// Aturan penting untuk driver printer:
// - Hindari flexbox. Sebagian driver gagal menghitung lebar di posisi potong, sehingga
//   baris kiri/kanan bertumpuk. Semua baris kiri-kanan memakai tabel dua kolom.
// - print() dipanggil dari dalam dokumen setelah jeda, bukan langsung setelah write(),
//   karena driver (terutama printer jaringan) sering menerima halaman kosong.
// - @page 80mm + baris kosong di akhir memberi ruang sebelum potong kertas.

export type PrintItem = {
  name?: string;
  quantity?: number;
  price?: number;
};

export type PrintableOrder = {
  invoice_number?: string;
  customer_name?: string;
  created_at?: string;
  payment_method?: string;
  payment_status?: string;
  outlet?: string;
  total_price?: number;
  amount_paid?: number;
  change_amount?: number;
  notes?: string;
  items?: PrintItem[];
};

const STYLES = `
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', ui-monospace, monospace; font-size: 12px; color: #000; margin: 0; padding: 6px; }
  .center { text-align: center; }
  .brand { font-size: 17px; font-weight: 700; letter-spacing: 1px; }
  .sub { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
  .rule { border-top: 1px dashed #000; margin: 7px 0; }
  .rule-strong { border-top: 2px solid #000; margin: 7px 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { vertical-align: top; padding: 2px 0; }
  td.l { text-align: left; word-break: break-word; }
  td.r { text-align: right; white-space: nowrap; }
  .row-head td { font-weight: 700; font-size: 12px; }
  .qty { width: 30px; font-weight: 700; }
  .unit { font-size: 10px; }
  .amt { text-align: right; white-space: nowrap; font-weight: 700; width: 30%; }
  .total-label { font-size: 15px; font-weight: 700; }
  .total-amount { text-align: right; font-size: 15px; font-weight: 700; white-space: nowrap; }
  .notes { font-size: 11px; border: 1px dashed #000; padding: 6px; margin-top: 8px; }
  .foot { font-size: 10px; text-align: center; margin-top: 10px; }
`;

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

export const formatRupiah = (value: unknown): string =>
  'Rp ' + Number(value || 0).toLocaleString('id-ID');

function formatWaktu(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleString('id-ID');
  return date.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

const itemRows = (items: PrintItem[]): string => items.map(i => `
      <tr>
        <td class="qty">${Number(i.quantity || 0)}x</td>
        <td class="l">${escapeHtml(i.name)}<div class="unit">@ ${formatRupiah(i.price)}</div></td>
        <td class="amt">${formatRupiah(Number(i.price || 0) * Number(i.quantity || 0))}</td>
      </tr>`).join('');

// Baris kosong di akhir: memberi jarak sebelum mekanisme potong bekerja.
const TAIL = `<div class="foot">&nbsp;</div><div class="foot">&nbsp;</div>`;

/**
 * Membuka jendela cetak lalu memanggil print(). Mengembalikan false bila popup diblokir,
 * supaya pemanggil dapat menampilkan pesan alih-alih gagal diam-diam.
 */
export function openPrintWindow(title: string, bodyHtml: string): boolean {
  const win = window.open('', '_blank', 'width=420,height=700');
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLES}</style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  // Jeda agar driver selesai layout; print() instan sering menghasilkan halaman kosong.
  win.setTimeout(() => { win.print(); }, 600);
  return true;
}

/** Tiket dapur: tanpa harga total pelanggan, fokus pada item yang harus dimasak. */
export function printKitchenTicket(order: PrintableOrder, outletFallback: string): boolean {
  const items = Array.isArray(order.items) ? order.items : [];
  const total = items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);
  const waktu = formatWaktu(order.created_at);

  const html = `
  <div class="center">
    <div class="brand">GeastEats</div>
    <div class="sub">Tiket Dapur</div>
  </div>
  <div class="rule"></div>
  <table class="row-head">
    <tr><td class="l">${escapeHtml(order.invoice_number)}</td><td class="r">${escapeHtml(order.outlet || outletFallback)}</td></tr>
    <tr><td class="l">${escapeHtml(order.customer_name)}</td><td class="r">${escapeHtml(waktu)}</td></tr>
  </table>
  <div class="rule"></div>
  <table>${itemRows(items)}</table>
  <div class="rule-strong"></div>
  <table>
    <tr><td class="total-label">TOTAL</td><td class="total-amount">${formatRupiah(total)}</td></tr>
  </table>
  ${order.notes ? `<div class="notes"><b>Catatan:</b><br>${escapeHtml(order.notes)}</div>` : ''}
  <div class="rule"></div>
  <div class="foot">Dicetak ${escapeHtml(waktu)}<br>-- GeastEats --</div>
  ${TAIL}`;

  return openPrintWindow(order.invoice_number || 'tiket', html);
}

/** Struk pelanggan: memuat identitas pesanan, rincian item, dan status pembayaran. */
export function printReceipt(order: PrintableOrder): boolean {
  const items = Array.isArray(order.items) ? order.items : [];
  const waktu = formatWaktu(order.created_at);
  const status = String(order.payment_status || 'belum_bayar').replace(/_/g, ' ');
  const paid = Number(order.amount_paid || 0);
  const change = Number(order.change_amount || 0);

  const html = `
  <div class="center">
    <div class="brand">GeastEats</div>
    <div class="sub">Struk Pembayaran</div>
  </div>
  <div class="rule"></div>
  <table>
    <tr><td class="l">No. Faktur</td><td class="r">${escapeHtml(order.invoice_number)}</td></tr>
    <tr><td class="l">Waktu</td><td class="r">${escapeHtml(waktu)}</td></tr>
    <tr><td class="l">Pelanggan</td><td class="r">${escapeHtml(order.customer_name)}</td></tr>
    <tr><td class="l">Metode</td><td class="r">${escapeHtml(order.payment_method || 'Tunai')}</td></tr>
    <tr><td class="l">Outlet</td><td class="r">${escapeHtml(order.outlet || '-')}</td></tr>
  </table>
  <div class="rule"></div>
  <table>${items.length ? itemRows(items) : '<tr><td class="l" colspan="3">Tanpa rincian item</td></tr>'}</table>
  <div class="rule-strong"></div>
  <table>
    <tr><td class="total-label">TOTAL</td><td class="total-amount">${formatRupiah(order.total_price)}</td></tr>
    ${paid > 0 ? `<tr><td class="l">Dibayar</td><td class="r">${formatRupiah(paid)}</td></tr>` : ''}
    ${change > 0 ? `<tr><td class="l">Kembalian</td><td class="r">${formatRupiah(change)}</td></tr>` : ''}
  </table>
  <div class="rule"></div>
  <table><tr><td class="l">Status Bayar</td><td class="r">${escapeHtml(status.toUpperCase())}</td></tr></table>
  <div class="rule"></div>
  <div class="foot">Terima kasih atas kunjungan Anda</div>
  <div class="foot">-- GeastEats --</div>
  ${TAIL}`;

  return openPrintWindow(order.invoice_number || 'struk', html);
}
