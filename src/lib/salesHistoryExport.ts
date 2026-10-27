import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatWibTimestamp } from './salesHistoryPeriod';

export interface HistoryExportOrder {
  invoice_number: string; customer_name: string; source: string; external_id?: string;
  total_price: number; payment_status: string; payment_method: string; status: string; created_at: string;
}
export function historyExportRows(orders: HistoryExportOrder[]) {
  return orders.map(o => {
    return [o.invoice_number || '-', o.customer_name || '-', o.external_id === 'MANUAL' ? `Manual (${o.source})` : o.source || '-',
      formatWibTimestamp(o.created_at) + ' WIB',
      o.payment_status || '-', o.status || '-', o.payment_method || '-', Number(o.total_price) || 0] as const;
  });
}
const columns = ['Invoice', 'Pelanggan', 'Sumber', 'Waktu (WIB)', 'Pembayaran', 'Status order', 'Metode', 'Total (Rp)'];
export async function makeHistoryWorkbook(orders: HistoryExportOrder[], description: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Riwayat Transaksi', { views: [{ state: 'frozen', ySplit: 4 }] });
  sheet.addRow(['RIWAYAT TRANSAKSI']); sheet.mergeCells('A1:H1');
  sheet.addRow([description]); sheet.mergeCells('A2:H2'); sheet.getRow(2).alignment = { wrapText: true, vertical: 'middle' }; sheet.getRow(2).height = 30;
  sheet.addRow([`${orders.length} transaksi | Pendapatan lunas: Rp ${orders.filter(o => o.payment_status === 'lunas').reduce((sum, o) => sum + (Number(o.total_price) || 0), 0).toLocaleString('id-ID')}`]); sheet.mergeCells('A3:H3');
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
  doc.text(`${orders.length} transaksi | Pendapatan lunas: Rp ${orders.filter(o => o.payment_status === 'lunas').reduce((sum, o) => sum + (Number(o.total_price) || 0), 0).toLocaleString('id-ID')}`, 14, summaryY);
  autoTable(doc, { startY: summaryY + 5, head: [columns], body: historyExportRows(orders).map(row => [...row.slice(0, 7), Number(row[7]).toLocaleString('id-ID')]), theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, overflow: 'linebreak' }, columnStyles: { 7: { halign: 'right' } }, didDrawPage: () => { doc.setFontSize(8); doc.text(`Halaman ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 8); } });
  return doc;
}
export function exportHistoryPdf(orders: HistoryExportOrder[], description: string, filename: string) {
  makeHistoryPdf(orders, description).save(`${filename}.pdf`);
}
