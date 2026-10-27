import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildDailyReport } from './reporting';

export function appendDailySummaryToPdf(doc: jsPDF, days: ReturnType<typeof buildDailyReport>, startY: number): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (startY + 30 > pageHeight) {
    doc.addPage();
    startY = 20;
  }
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('RINGKASAN PER TANGGAL (WIB)', 14, startY);
  autoTable(doc, {
    startY: startY + 5,
    head: [['Tanggal WIB', 'Lunas', 'Gagal', 'Pendapatan']],
    body: days.map(day => [day.date, String(day.paid), String(day.failed), `Rp ${day.revenue.toLocaleString('id-ID')}`]),
    headStyles: { fillColor: [15, 23, 42] },
    theme: 'striped',
    styles: { fontSize: 8 },
    columnStyles: { 3: { halign: 'right' } },
  });
}
