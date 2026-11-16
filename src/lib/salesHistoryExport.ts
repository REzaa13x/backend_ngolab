import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatWibTimestamp, type HistoryPeriod } from './salesHistoryPeriod';
import { aggregateSoldMenus, soldMenusTotals, summarizeTotalValidation, type SoldMenuItem } from './menuSales';
import {
  dailyBreakdown, monthBreakdown, salesSummary, weekBreakdown, weekdayBreakdown, weekdayMenuBreakdown,
  yearBreakdown, type BreakdownOrder, type DailyRow, type WeekRow,
} from './salesBreakdown';

export interface HistoryExportOrder {
  invoice_number: string; customer_name: string; source: string; external_id?: string;
  total_price: number; payment_status: string; payment_method: string; status: string; created_at: string;
  items?: SoldMenuItem[];
}
export function historyExportRows(orders: HistoryExportOrder[]) {
  return orders.map(o => {
    return [o.invoice_number || '-', o.customer_name || '-', o.external_id === 'MANUAL' ? `Manual (${o.source})` : o.source || '-',
      formatWibTimestamp(o.created_at) + ' WIB',
      o.payment_status || '-', o.status || '-', o.payment_method || '-', Number(o.total_price) || 0] as const;
  });
}
const columns = ['Invoice', 'Pelanggan', 'Sumber', 'Waktu (WIB)', 'Pembayaran', 'Status order', 'Metode', 'Total (Rp)'];
const paidTotal = (orders: HistoryExportOrder[]) => orders.filter(o => o.payment_status === 'lunas').reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
const rupiah = (value: number) => value.toLocaleString('id-ID');

export interface ExportOptions {
  period?: HistoryPeriod;
  range?: { start: string; end: string } | null;
}

// Mencari minggu ke berapa sebuah tanggal, supaya rincian harian bisa
// dikelompokkan di bawah "Minggu ke-1 (01 Jan – 07 Jan)" seperti laporan manual.
function weekForDate(weeks: WeekRow[], date: string): WeekRow | null {
  return weeks.find(week => date >= week.start && date <= week.end) ?? null;
}

function paidOf(orders: HistoryExportOrder[]): BreakdownOrder[] {
  return orders.filter(order => String(order.payment_status ?? '').toLowerCase() === 'lunas') as BreakdownOrder[];
}

export async function makeHistoryWorkbook(orders: HistoryExportOrder[], description: string, options: ExportOptions = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Riwayat Transaksi', { views: [{ state: 'frozen', ySplit: 4 }] });
  sheet.addRow(['RIWAYAT TRANSAKSI']); sheet.mergeCells('A1:H1');
  sheet.addRow([description]); sheet.mergeCells('A2:H2'); sheet.getRow(2).alignment = { wrapText: true, vertical: 'middle' }; sheet.getRow(2).height = 30;
  sheet.addRow([`${orders.length} transaksi | Pendapatan lunas: Rp ${paidTotal(orders).toLocaleString('id-ID')}`]); sheet.mergeCells('A3:H3');
  const header = sheet.addRow(columns);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  historyExportRows(orders).forEach((data, i) => {
    const row = sheet.addRow([...data]);
    if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    row.getCell(8).numFmt = '#,##0';
  });
  sheet.getRow(1).font = { bold: true, size: 16 };
  [22, 24, 20, 23, 18, 18, 16, 18].forEach((width, i) => { sheet.getColumn(i + 1).width = width; });
  sheet.autoFilter = 'A4:H4';

  const styleHeader = (row: ExcelJS.Row) => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  };
  const title = (target: ExcelJS.Worksheet, text: string, width: number) => {
    target.addRow([text]); target.mergeCells(1, 1, 1, width); target.getRow(1).font = { bold: true, size: 16 };
  };
  const subtitle = (target: ExcelJS.Worksheet, text: string, width: number) => {
    target.addRow([text]); target.mergeCells(2, 1, 2, width);
    target.getRow(2).alignment = { wrapText: true, vertical: 'middle' }; target.getRow(2).height = 30;
  };
  const summaryLine = (target: ExcelJS.Worksheet, text: string, width: number) => {
    target.addRow([text]); target.mergeCells(3, 1, 3, width);
  };

  // Sheet 1: rekap produk terjual — pertanyaan "menu apa saja yang laku".
  const sold = aggregateSoldMenus(orders);
  const soldTotals = soldMenusTotals(sold);
  const soldSheet = workbook.addWorksheet('Menu Terjual', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(soldSheet, 'REKAP MENU TERJUAL', 4);
  subtitle(soldSheet, description, 4);
  summaryLine(soldSheet, `${sold.length} jenis menu | ${soldTotals.quantity} item terjual | Nilai item: Rp ${rupiah(soldTotals.revenue)}`, 4);
  styleHeader(soldSheet.addRow(['Nama Menu', 'Qty Terjual', 'Pendapatan (Rp)', 'Jumlah Transaksi']));
  sold.forEach((row, index) => {
    const dataRow = soldSheet.addRow([row.name, row.quantity, row.revenue, row.orders]);
    if (index % 2 === 0) dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    dataRow.getCell(3).numFmt = '#,##0';
  });
  const soldFooter = soldSheet.addRow(['TOTAL', soldTotals.quantity, soldTotals.revenue, '']);
  soldFooter.font = { bold: true };
  [34, 14, 20, 18].forEach((width, i) => { soldSheet.getColumn(i + 1).width = width; });
  soldSheet.autoFilter = 'A4:D4';

  // Sheet 2: rincian item per transaksi — siapa beli apa.
  const detailSheet = workbook.addWorksheet('Rincian Item', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(detailSheet, 'RINCIAN ITEM PER TRANSAKSI', 7);
  subtitle(detailSheet, description, 7);
  summaryLine(detailSheet, `${orders.length} transaksi`, 7);
  styleHeader(detailSheet.addRow(['Invoice', 'Pelanggan', 'Waktu (WIB)', 'Menu', 'Qty', 'Harga Satuan (Rp)', 'Subtotal (Rp)']));
  let detailIndex = 0;
  for (const order of orders) {
    const items = order.items ?? [];
    if (!items.length) {
      const row = detailSheet.addRow([order.invoice_number || '-', order.customer_name || '-', formatWibTimestamp(order.created_at) + ' WIB', '(tanpa rincian item)', '', '', '']);
      if (detailIndex++ % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      continue;
    }
    for (const item of items) {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const row = detailSheet.addRow([order.invoice_number || '-', order.customer_name || '-', formatWibTimestamp(order.created_at) + ' WIB',
        String(item.name ?? ''), quantity, price, quantity * price]);
      if (detailIndex++ % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).numFmt = '#,##0';
    }
  }
  [22, 24, 23, 34, 8, 18, 18].forEach((width, i) => { detailSheet.getColumn(i + 1).width = width; });
  detailSheet.autoFilter = 'A4:G4';

  // Sheet 3: validasi total pesanan vs jumlah item — jawaban "totalnya sudah benar?".
  const validation = summarizeTotalValidation(orders);
  const checkSheet = workbook.addWorksheet('Validasi Total', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(checkSheet, 'VALIDASI TOTAL PESANAN', 6);
  subtitle(checkSheet, description, 6);
  summaryLine(checkSheet, `${validation.checked} diperiksa | ${validation.matched} cocok | ${validation.mismatched} selisih | ${validation.withoutItems} tanpa rincian item`, 6);
  styleHeader(checkSheet.addRow(['Invoice', 'Total Pesanan (Rp)', 'Jumlah Item (Rp)', 'Selisih (Rp)', 'Status', 'Qty Item']));
  validation.checks.forEach((check, index) => {
    const row = checkSheet.addRow([check.invoice_number, check.orderTotal, check.itemSubtotal, check.difference,
      check.matches ? 'Cocok' : 'Tidak cocok', check.itemCount]);
    if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    [2, 3, 4].forEach(col => { row.getCell(col).numFmt = '#,##0'; });
    if (!check.matches) row.getCell(5).font = { bold: true, color: { argb: 'FFB91C1C' } };
  });
  [22, 20, 20, 16, 16, 10].forEach((width, i) => { checkSheet.getColumn(i + 1).width = width; });
  checkSheet.autoFilter = 'A4:F4';

  // ── Rekap bertingkat ────────────────────────────────────────────────────
  // Hanya transaksi lunas: angka pendapatan harus sebanding dengan ringkasan
  // di layar. Pesanan belum lunas tetap terlihat di sheet Riwayat Transaksi.
  const paid = paidOf(orders);
  const summary = salesSummary(paid, paid);
  const days = dailyBreakdown(paid);
  const weekdays = weekdayBreakdown(paid);
  const weekdayMenus = weekdayMenuBreakdown(paid);
  const weeks = weekBreakdown(paid, options.range ?? null);
  const months = monthBreakdown(paid);
  const years = yearBreakdown(paid);

  const ringkasan = workbook.addWorksheet('Ringkasan', { views: [{ state: 'frozen', ySplit: 2 }] });
  title(ringkasan, 'RINGKASAN PENJUALAN', 2);
  subtitle(ringkasan, description, 2);
  const ringkasanRows: [string, string | number][] = [
    ['Total transaksi (semua status)', summary.transactions],
    ['Transaksi lunas', summary.paidTransactions],
    ['Total item terjual', summary.items],
    ['Pendapatan lunas (Rp)', summary.revenue],
    ['Jumlah hari ada transaksi', summary.days],
    ['Rata-rata pendapatan per hari (Rp)', summary.averagePerDay],
    ['Rata-rata per transaksi (Rp)', summary.averagePerTransaction],
    ['Hari terbaik', summary.bestDay ? `${summary.bestDay.label} (${summary.bestDay.weekday})` : '-'],
    ['Pendapatan hari terbaik (Rp)', summary.bestDay?.revenue ?? 0],
    ['Hari paling ramai', summary.busiestWeekday ? summary.busiestWeekday.name : '-'],
    ['Pendapatan hari paling ramai (Rp)', summary.busiestWeekday?.revenue ?? 0],
    ['Menu terlaris', summary.topMenu ? `${summary.topMenu.name} (${summary.topMenu.quantity} item)` : '-'],
    ['Nilai menu terlaris (Rp)', summary.topMenu?.revenue ?? 0],
  ];
  ringkasanRows.forEach(([label, value], index) => {
    const row = ringkasan.addRow([label, value]);
    if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    row.getCell(1).font = { bold: true };
    if (typeof value === 'number') row.getCell(2).numFmt = '#,##0';
  });
  [42, 34].forEach((width, i) => { ringkasan.getColumn(i + 1).width = width; });

  // Sheet: Rekap Harian — pendapatan dan menu teratas setiap tanggal.
  const dailySheet = workbook.addWorksheet('Rekap Harian', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(dailySheet, 'REKAP HARIAN', 7);
  subtitle(dailySheet, description, 7);
  summaryLine(dailySheet, `${days.length} hari | Total pendapatan Rp ${rupiah(days.reduce((sum, day) => sum + day.revenue, 0))}`, 7);
  styleHeader(dailySheet.addRow(['Tanggal', 'Hari', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Menu Teratas', 'Qty Menu']));
  days.forEach((day, index) => {
    const row = dailySheet.addRow([day.date, day.weekday, day.orders, day.items, day.revenue, day.topMenu, day.topMenuQty]);
    if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    row.getCell(5).numFmt = '#,##0';
  });
  const dailyFooter = dailySheet.addRow(['TOTAL', '', days.reduce((sum, day) => sum + day.orders, 0), days.reduce((sum, day) => sum + day.items, 0), days.reduce((sum, day) => sum + day.revenue, 0), '', '']);
  dailyFooter.font = { bold: true };
  dailyFooter.getCell(5).numFmt = '#,##0';
  [14, 12, 12, 12, 18, 34, 12].forEach((width, i) => { dailySheet.getColumn(i + 1).width = width; });
  dailySheet.autoFilter = 'A4:G4';

  // Sheet: Menu per Hari (Senin–Minggu) — "makanan apa yang laku hari Senin–Jumat".
  const weekdaySheet = workbook.addWorksheet('Menu per Hari', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(weekdaySheet, 'MENU TERJUAL PER HARI DALAM SEMINGGU', 5);
  subtitle(weekdaySheet, description, 5);
  summaryLine(weekdaySheet, 'Senin–Minggu. Angka hanya dari transaksi lunas; hari tanpa transaksi tetap ditampilkan.', 5);
  styleHeader(weekdaySheet.addRow(['Hari', 'Menu', 'Qty', 'Pendapatan (Rp)', 'Pesanan']));
  let weekdayIndex = 0;
  for (const weekday of weekdayMenus) {
    if (!weekday.menus.length) {
      const row = weekdaySheet.addRow([weekday.name, '(tidak ada transaksi)', 0, 0, 0]);
      if (weekdayIndex++ % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      continue;
    }
    for (const menu of weekday.menus) {
      const row = weekdaySheet.addRow([weekday.name, menu.name, menu.quantity, menu.revenue, weekday.orders]);
      if (weekdayIndex++ % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      row.getCell(4).numFmt = '#,##0';
    }
  }
  [12, 34, 10, 18, 12].forEach((width, i) => { weekdaySheet.getColumn(i + 1).width = width; });
  weekdaySheet.autoFilter = 'A4:E4';

  // Sheet: Rekap Mingguan — "minggu ke-1 rentang tanggal berapa sampai berapa".
  const weekSheet = workbook.addWorksheet('Rekap Mingguan', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(weekSheet, 'REKAP MINGGUAN', 9);
  subtitle(weekSheet, description, 9);
  summaryLine(weekSheet, `${weeks.length} minggu | Minggu dihitung Senin–Minggu dari awal periode`, 9);
  styleHeader(weekSheet.addRow(['Minggu', 'Rentang Tanggal', 'Mulai', 'Selesai', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Menu Teratas', 'Qty Menu']));
  weeks.forEach((week, index) => {
    const row = weekSheet.addRow([week.label, week.rangeLabel, week.start, week.end, week.orders, week.items, week.revenue, week.topMenu, week.topMenuQty]);
    if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    row.getCell(7).numFmt = '#,##0';
  });
  const weekFooter = weekSheet.addRow(['TOTAL', '', '', '', weeks.reduce((s, w) => s + w.orders, 0), weeks.reduce((s, w) => s + w.items, 0), weeks.reduce((s, w) => s + w.revenue, 0), '', '']);
  weekFooter.font = { bold: true };
  weekFooter.getCell(7).numFmt = '#,##0';
  [14, 34, 14, 14, 12, 12, 18, 34, 12].forEach((width, i) => { weekSheet.getColumn(i + 1).width = width; });
  weekSheet.autoFilter = 'A4:I4';

  // Sheet: Rincian Harian per Minggu — versi paling detail, tiap hari di
  // dalam minggunya, termasuk menu teratas hari itu.
  const weekDetailSheet = workbook.addWorksheet('Rincian Harian per Minggu', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(weekDetailSheet, 'RINCIAN HARIAN PER MINGGU', 8);
  subtitle(weekDetailSheet, description, 8);
  summaryLine(weekDetailSheet, 'Tiap baris adalah satu tanggal di dalam minggunya, supaya total mingguan bisa ditelusuri.', 8);
  styleHeader(weekDetailSheet.addRow(['Minggu', 'Rentang Minggu', 'Tanggal', 'Hari', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Menu Teratas']));
  let weekDetailIndex = 0;
  for (const week of weeks) {
    const rowsInWeek = days.filter(day => day.date >= week.start && day.date <= week.end);
    if (!rowsInWeek.length) {
      const row = weekDetailSheet.addRow([week.label, week.rangeLabel, '(tidak ada transaksi)', '', 0, 0, 0, '-']);
      if (weekDetailIndex++ % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      continue;
    }
    for (const day of rowsInWeek) {
      const row = weekDetailSheet.addRow([week.label, week.rangeLabel, day.date, day.weekday, day.orders, day.items, day.revenue, `${day.topMenu} (${day.topMenuQty})`]);
      if (weekDetailIndex++ % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      row.getCell(7).numFmt = '#,##0';
    }
  }
  [14, 34, 14, 12, 12, 12, 18, 30].forEach((width, i) => { weekDetailSheet.getColumn(i + 1).width = width; });

  // Sheet: Rekap Bulanan.
  const monthSheet = workbook.addWorksheet('Rekap Bulanan', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(monthSheet, 'REKAP BULANAN', 7);
  subtitle(monthSheet, description, 7);
  summaryLine(monthSheet, `${months.length} bulan`, 7);
  styleHeader(monthSheet.addRow(['Bulan', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Rata-rata/Hari (Rp)', 'Menu Teratas', 'Qty Menu']));
  months.forEach((month, index) => {
    const daysInMonth = days.filter(day => day.date.startsWith(month.month)).length;
    const row = monthSheet.addRow([month.label, month.orders, month.items, month.revenue,
      daysInMonth ? Math.round(month.revenue / daysInMonth) : 0, month.topMenu, month.topMenuQty]);
    if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '#,##0';
  });
  [22, 12, 12, 18, 20, 34, 12].forEach((width, i) => { monthSheet.getColumn(i + 1).width = width; });
  monthSheet.autoFilter = 'A4:G4';

  // Sheet: Rekap Tahunan.
  const yearSheet = workbook.addWorksheet('Rekap Tahunan', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(yearSheet, 'REKAP TAHUNAN', 7);
  subtitle(yearSheet, description, 7);
  summaryLine(yearSheet, `${years.length} tahun`, 7);
  styleHeader(yearSheet.addRow(['Tahun', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Rata-rata/Bulan (Rp)', 'Menu Teratas', 'Qty Menu']));
  years.forEach((year, index) => {
    const monthsInYear = months.filter(month => month.month.startsWith(year.year)).length;
    const row = yearSheet.addRow([year.year, year.orders, year.items, year.revenue,
      monthsInYear ? Math.round(year.revenue / monthsInYear) : 0, year.topMenu, year.topMenuQty]);
    if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '#,##0';
  });
  [12, 12, 12, 18, 20, 34, 12].forEach((width, i) => { yearSheet.getColumn(i + 1).width = width; });
  yearSheet.autoFilter = 'A4:G4';

  // Sheet: Rincian Bulanan per Tahun — versi paling detail untuk ekspor tahunan,
  // supaya total setahun bisa ditelusuri sampai bulan dan menu teratasnya.
  const yearDetailSheet = workbook.addWorksheet('Rincian Bulanan per Tahun', { views: [{ state: 'frozen', ySplit: 4 }] });
  title(yearDetailSheet, 'RINCIAN BULANAN PER TAHUN', 8);
  subtitle(yearDetailSheet, description, 8);
  summaryLine(yearDetailSheet, 'Tiap baris adalah satu bulan di dalam tahunnya, lengkap dengan hari aktif dan rata-rata harian.', 8);
  styleHeader(yearDetailSheet.addRow(['Tahun', 'Bulan', 'Hari Aktif', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Rata-rata/Hari (Rp)', 'Menu Teratas']));
  let yearDetailIndex = 0;
  for (const year of years) {
    const monthsInYear = months.filter(month => month.month.startsWith(year.year));
    if (!monthsInYear.length) {
      const row = yearDetailSheet.addRow([year.year, '(tidak ada transaksi)', 0, 0, 0, 0, 0, '-']);
      if (yearDetailIndex++ % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      continue;
    }
    for (const month of monthsInYear) {
      const activeDays = days.filter(day => day.date.startsWith(month.month)).length;
      const row = yearDetailSheet.addRow([year.year, month.label, activeDays, month.orders, month.items, month.revenue,
        activeDays ? Math.round(month.revenue / activeDays) : 0, `${month.topMenu} (${month.topMenuQty})`]);
      if (yearDetailIndex++ % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).numFmt = '#,##0';
    }
  }
  [12, 22, 12, 12, 12, 18, 20, 30].forEach((width, i) => { yearDetailSheet.getColumn(i + 1).width = width; });

  return workbook;
}
export async function exportHistoryExcel(orders: HistoryExportOrder[], description: string, filename: string, options: ExportOptions = {}) {
  const workbook = await makeHistoryWorkbook(orders, description, options);
  const data = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url; link.download = `${filename}.xlsx`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function makeHistoryPdf(orders: HistoryExportOrder[], description: string, options: ExportOptions = {}) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(17); doc.text('RIWAYAT TRANSAKSI', 14, 17);
  doc.setFontSize(9); const lines = doc.splitTextToSize(description, doc.internal.pageSize.getWidth() - 28); doc.text(lines, 14, 24);
  const summaryY = 26 + lines.length * 4;
  doc.text(`${orders.length} transaksi | Pendapatan lunas: Rp ${paidTotal(orders).toLocaleString('id-ID')}`, 14, summaryY);
  const pageFooter = () => { doc.setFontSize(8); doc.text(`Halaman ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 8); };
  autoTable(doc, { startY: summaryY + 5, head: [columns], body: historyExportRows(orders).map(row => [...row.slice(0, 7), Number(row[7]).toLocaleString('id-ID')]), theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, overflow: 'linebreak' }, columnStyles: { 7: { halign: 'right' } }, didDrawPage: pageFooter });

  // Halaman rekap produk terjual: semua menu yang laku beserta qty dan nilainya.
  const sold = aggregateSoldMenus(orders);
  const soldTotals = soldMenusTotals(sold);
  doc.addPage();
  doc.setFontSize(15); doc.text('REKAP MENU TERJUAL', 14, 17);
  doc.setFontSize(9); doc.text(`${sold.length} jenis menu | ${soldTotals.quantity} item terjual | Nilai item: Rp ${soldTotals.revenue.toLocaleString('id-ID')}`, 14, 24);
  autoTable(doc, {
    startY: 30,
    head: [['Nama Menu', 'Qty Terjual', 'Pendapatan (Rp)', 'Jumlah Transaksi']],
    body: sold.map(row => [row.name, String(row.quantity), row.revenue.toLocaleString('id-ID'), String(row.orders)]),
    foot: [['TOTAL', String(soldTotals.quantity), soldTotals.revenue.toLocaleString('id-ID'), '']],
    theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, overflow: 'linebreak' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }, didDrawPage: pageFooter,
  });

  // Halaman rincian item per transaksi: pelanggan ini membeli apa saja.
  doc.addPage();
  doc.setFontSize(15); doc.text('RINCIAN ITEM PER TRANSAKSI', 14, 17);
  const detailBody: string[][] = [];
  for (const order of orders) {
    const items = order.items ?? [];
    if (!items.length) {
      detailBody.push([order.invoice_number || '-', order.customer_name || '-', formatWibTimestamp(order.created_at), '(tanpa rincian item)', '', '', '']);
      continue;
    }
    for (const item of items) {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      detailBody.push([order.invoice_number || '-', order.customer_name || '-', formatWibTimestamp(order.created_at),
        String(item.name ?? ''), String(quantity), price.toLocaleString('id-ID'), (quantity * price).toLocaleString('id-ID')]);
    }
  }
  autoTable(doc, {
    startY: 24,
    head: [['Invoice', 'Pelanggan', 'Waktu (WIB)', 'Menu', 'Qty', 'Harga Satuan', 'Subtotal']],
    body: detailBody,
    theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 7, overflow: 'linebreak' },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }, didDrawPage: pageFooter,
  });

  // Halaman validasi total: bukti angka total pesanan cocok dengan rincian item.
  const validation = summarizeTotalValidation(orders);
  doc.addPage();
  doc.setFontSize(15); doc.text('VALIDASI TOTAL PESANAN', 14, 17);
  doc.setFontSize(9);
  doc.text(`${validation.checked} diperiksa | ${validation.matched} cocok | ${validation.mismatched} selisih | ${validation.withoutItems} tanpa rincian item`, 14, 24);
  doc.text(`Total pesanan Rp ${validation.orderTotal.toLocaleString('id-ID')} vs jumlah item Rp ${validation.itemSubtotal.toLocaleString('id-ID')} (selisih Rp ${validation.difference.toLocaleString('id-ID')})`, 14, 30);
  autoTable(doc, {
    startY: 36,
    head: [['Invoice', 'Total Pesanan (Rp)', 'Jumlah Item (Rp)', 'Selisih (Rp)', 'Status', 'Qty Item']],
    body: validation.checks.map(check => [check.invoice_number, check.orderTotal.toLocaleString('id-ID'), check.itemSubtotal.toLocaleString('id-ID'),
      check.difference.toLocaleString('id-ID'), check.matches ? 'Cocok' : 'Tidak cocok', String(check.itemCount)]),
    theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 5: { halign: 'right' } }, didDrawPage: pageFooter,
  });

  // ── Halaman rekap bertingkat ────────────────────────────────────────────
  const paid = paidOf(orders);
  const summary = salesSummary(paid, paid);
  const days = dailyBreakdown(paid);
  const weekdays = weekdayBreakdown(paid);
  const weekdayMenus = weekdayMenuBreakdown(paid);
  const weeks = weekBreakdown(paid, options.range ?? null);
  const months = monthBreakdown(paid);
  const years = yearBreakdown(paid);

  doc.addPage();
  doc.setFontSize(15); doc.text('RINGKASAN PENJUALAN', 14, 17);
  autoTable(doc, {
    startY: 24,
    head: [['Ukuran', 'Nilai']],
    body: [
      ['Total transaksi (semua status)', String(summary.transactions)],
      ['Transaksi lunas', String(summary.paidTransactions)],
      ['Total item terjual', String(summary.items)],
      ['Pendapatan lunas (Rp)', summary.revenue.toLocaleString('id-ID')],
      ['Jumlah hari ada transaksi', String(summary.days)],
      ['Rata-rata pendapatan per hari (Rp)', summary.averagePerDay.toLocaleString('id-ID')],
      ['Rata-rata per transaksi (Rp)', summary.averagePerTransaction.toLocaleString('id-ID')],
      ['Hari terbaik', summary.bestDay ? `${summary.bestDay.label} (${summary.bestDay.weekday}) — Rp ${summary.bestDay.revenue.toLocaleString('id-ID')}` : '-'],
      ['Hari paling ramai', summary.busiestWeekday ? `${summary.busiestWeekday.name} — Rp ${summary.busiestWeekday.revenue.toLocaleString('id-ID')}` : '-'],
      ['Menu terlaris', summary.topMenu ? `${summary.topMenu.name} (${summary.topMenu.quantity} item, Rp ${summary.topMenu.revenue.toLocaleString('id-ID')})` : '-'],
    ],
    theme: 'grid', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 9 }, didDrawPage: pageFooter,
  });

  doc.addPage();
  doc.setFontSize(15); doc.text('REKAP HARIAN', 14, 17);
  doc.setFontSize(9); doc.text(`${days.length} hari | Total pendapatan Rp ${days.reduce((sum, day) => sum + day.revenue, 0).toLocaleString('id-ID')}`, 14, 24);
  autoTable(doc, {
    startY: 30,
    head: [['Tanggal', 'Hari', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Menu Teratas', 'Qty Menu']],
    body: days.map(day => [day.label, day.weekday, String(day.orders), String(day.items), day.revenue.toLocaleString('id-ID'), day.topMenu, String(day.topMenuQty)]),
    foot: [['TOTAL', '', String(days.reduce((sum, day) => sum + day.orders, 0)), String(days.reduce((sum, day) => sum + day.items, 0)), days.reduce((sum, day) => sum + day.revenue, 0).toLocaleString('id-ID'), '', '']],
    theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, overflow: 'linebreak' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 6: { halign: 'right' } }, didDrawPage: pageFooter,
  });

  doc.addPage();
  doc.setFontSize(15); doc.text('MENU TERJUAL PER HARI (SENIN–MINGGU)', 14, 17);
  doc.setFontSize(9); doc.text('Menjawab pertanyaan: makanan apa yang laku pada hari Senin–Jumat dan akhir pekan.', 14, 24);
  autoTable(doc, {
    startY: 30,
    head: [['Hari', 'Menu', 'Qty', 'Pendapatan (Rp)', 'Pesanan']],
    body: weekdayMenus.flatMap(weekday => weekday.menus.length
      ? weekday.menus.map(menu => [weekday.name, menu.name, String(menu.quantity), menu.revenue.toLocaleString('id-ID'), String(weekday.orders)])
      : [[weekday.name, '(tidak ada transaksi)', '0', '0', '0']]),
    theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, overflow: 'linebreak' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }, didDrawPage: pageFooter,
  });

  doc.addPage();
  doc.setFontSize(15); doc.text('REKAP MINGGUAN', 14, 17);
  doc.setFontSize(9); doc.text(`${weeks.length} minggu | Minggu ke-1 dimulai dari Senin pada tanggal awal periode.`, 14, 24);
  autoTable(doc, {
    startY: 30,
    head: [['Minggu', 'Rentang Tanggal', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Menu Teratas', 'Qty Menu']],
    body: weeks.map(week => [week.label, week.rangeLabel, String(week.orders), String(week.items), week.revenue.toLocaleString('id-ID'), week.topMenu, String(week.topMenuQty)]),
    foot: [['TOTAL', '', String(weeks.reduce((s, w) => s + w.orders, 0)), String(weeks.reduce((s, w) => s + w.items, 0)), weeks.reduce((s, w) => s + w.revenue, 0).toLocaleString('id-ID'), '', '']],
    theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, overflow: 'linebreak' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 6: { halign: 'right' } }, didDrawPage: pageFooter,
  });

  doc.addPage();
  doc.setFontSize(15); doc.text('RINCIAN HARIAN PER MINGGU', 14, 17);
  doc.setFontSize(9); doc.text('Setiap tanggal di dalam minggunya, agar total mingguan bisa ditelusuri.', 14, 24);
  const weekDetailBody: string[][] = [];
  for (const week of weeks) {
    const rowsInWeek = days.filter(day => day.date >= week.start && day.date <= week.end);
    if (!rowsInWeek.length) {
      weekDetailBody.push([week.label, week.rangeLabel, '(tidak ada transaksi)', '', '0', '0', '0', '-']);
      continue;
    }
    for (const day of rowsInWeek) {
      weekDetailBody.push([week.label, week.rangeLabel, day.label, day.weekday, String(day.orders), String(day.items), day.revenue.toLocaleString('id-ID'), `${day.topMenu} (${day.topMenuQty})`]);
    }
  }
  autoTable(doc, {
    startY: 30,
    head: [['Minggu', 'Rentang Minggu', 'Tanggal', 'Hari', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Menu Teratas']],
    body: weekDetailBody,
    theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 7, overflow: 'linebreak' },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }, didDrawPage: pageFooter,
  });

  doc.addPage();
  doc.setFontSize(15); doc.text('REKAP BULANAN & TAHUNAN', 14, 17);
  doc.setFontSize(9); doc.text(`${months.length} bulan | ${years.length} tahun`, 14, 24);
  autoTable(doc, {
    startY: 30,
    head: [['Bulan', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Menu Teratas', 'Qty Menu']],
    body: months.map(month => [month.label, String(month.orders), String(month.items), month.revenue.toLocaleString('id-ID'), month.topMenu, String(month.topMenuQty)]),
    theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 5: { halign: 'right' } }, didDrawPage: pageFooter,
  });
  const afterMonths = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  autoTable(doc, {
    startY: afterMonths + 10,
    head: [['Tahun', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Rata-rata/Bulan (Rp)', 'Menu Teratas', 'Qty Menu']],
    body: years.map(year => {
      const monthsInYear = months.filter(month => month.month.startsWith(year.year)).length;
      return [year.year, String(year.orders), String(year.items), year.revenue.toLocaleString('id-ID'),
        (monthsInYear ? Math.round(year.revenue / monthsInYear) : 0).toLocaleString('id-ID'), year.topMenu, String(year.topMenuQty)];
    }),
    theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 6: { halign: 'right' } }, didDrawPage: pageFooter,
  });

  // Halaman rincian bulanan per tahun: menelusuri total setahun sampai bulan.
  doc.addPage();
  doc.setFontSize(15); doc.text('RINCIAN BULANAN PER TAHUN', 14, 17);
  doc.setFontSize(9); doc.text('Tiap baris satu bulan: hari aktif, pesanan, pendapatan, dan menu teratas.', 14, 24);
  const yearDetailBody: string[][] = [];
  for (const year of years) {
    const monthsInYear = months.filter(month => month.month.startsWith(year.year));
    if (!monthsInYear.length) {
      yearDetailBody.push([year.year, '(tidak ada transaksi)', '0', '0', '0', '0', '0', '-']);
      continue;
    }
    for (const month of monthsInYear) {
      const activeDays = days.filter(day => day.date.startsWith(month.month)).length;
      yearDetailBody.push([year.year, month.label, String(activeDays), String(month.orders), String(month.items),
        month.revenue.toLocaleString('id-ID'), (activeDays ? Math.round(month.revenue / activeDays) : 0).toLocaleString('id-ID'),
        `${month.topMenu} (${month.topMenuQty})`]);
    }
  }
  autoTable(doc, {
    startY: 30,
    head: [['Tahun', 'Bulan', 'Hari Aktif', 'Pesanan', 'Qty Item', 'Pendapatan (Rp)', 'Rata-rata/Hari (Rp)', 'Menu Teratas']],
    body: yearDetailBody,
    theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, overflow: 'linebreak' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }, didDrawPage: pageFooter,
  });
  return doc;
}
export function exportHistoryPdf(orders: HistoryExportOrder[], description: string, filename: string, options: ExportOptions = {}) {
  makeHistoryPdf(orders, description, options).save(`${filename}.pdf`);
}
