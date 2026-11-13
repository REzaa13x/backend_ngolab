import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatWibTimestamp } from './salesHistoryPeriod';
import { aggregateSoldMenus, orderItemsSubtotal, soldMenusTotals, summarizeTotalValidation, type SoldMenuItem } from './menuSales';

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

export async function makeHistoryWorkbook(orders: HistoryExportOrder[], description: string) {
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

  // Sheet 1: rekap produk terjual — pertanyaan "menu apa saja yang laku".
  const sold = aggregateSoldMenus(orders);
  const soldTotals = soldMenusTotals(sold);
  const soldSheet = workbook.addWorksheet('Menu Terjual', { views: [{ state: 'frozen', ySplit: 4 }] });
  soldSheet.addRow(['REKAP MENU TERJUAL']); soldSheet.mergeCells('A1:D1'); soldSheet.getRow(1).font = { bold: true, size: 16 };
  soldSheet.addRow([description]); soldSheet.mergeCells('A2:D2'); soldSheet.getRow(2).alignment = { wrapText: true, vertical: 'middle' }; soldSheet.getRow(2).height = 30;
  soldSheet.addRow([`${sold.length} jenis menu | ${soldTotals.quantity} item terjual | Nilai item: Rp ${rupiah(soldTotals.revenue)}`]); soldSheet.mergeCells('A3:D3');
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
  detailSheet.addRow(['RINCIAN ITEM PER TRANSAKSI']); detailSheet.mergeCells('A1:G1'); detailSheet.getRow(1).font = { bold: true, size: 16 };
  detailSheet.addRow([description]); detailSheet.mergeCells('A2:G2'); detailSheet.getRow(2).alignment = { wrapText: true, vertical: 'middle' }; detailSheet.getRow(2).height = 30;
  detailSheet.addRow([`${orders.length} transaksi`]); detailSheet.mergeCells('A3:G3');
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
  checkSheet.addRow(['VALIDASI TOTAL PESANAN']); checkSheet.mergeCells('A1:F1'); checkSheet.getRow(1).font = { bold: true, size: 16 };
  checkSheet.addRow([description]); checkSheet.mergeCells('A2:F2'); checkSheet.getRow(2).alignment = { wrapText: true, vertical: 'middle' }; checkSheet.getRow(2).height = 30;
  checkSheet.addRow([`${validation.checked} diperiksa | ${validation.matched} cocok | ${validation.mismatched} selisih | ${validation.withoutItems} tanpa rincian item`]);
  checkSheet.mergeCells('A3:F3');
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

  return workbook;
}
export async function exportHistoryExcel(orders: HistoryExportOrder[], description: string, filename: string) {
  const workbook = await makeHistoryWorkbook(orders, description);
  const data = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url; link.download = `${filename}.xlsx`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function makeHistoryPdf(orders: HistoryExportOrder[], description: string) {
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
  return doc;
}
export function exportHistoryPdf(orders: HistoryExportOrder[], description: string, filename: string) {
  makeHistoryPdf(orders, description).save(`${filename}.pdf`);
}
