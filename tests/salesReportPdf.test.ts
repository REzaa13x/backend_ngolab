import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { appendDailySummaryToPdf } from '../src/lib/salesReportPdf.js';

test('PDF ringkasan tanggal menampilkan tanggal WIB dan pendapatan', () => {
  const doc = new jsPDF({ compress: false });
  appendDailySummaryToPdf(doc, [{ date: '2026-01-01', paid: 1, failed: 1, revenue: 25000 }], 20);
  const pdf = doc.output();
  assert.ok(pdf.includes('RINGKASAN PER TANGGAL \\(WIB\\)'));
  assert.match(pdf, /2026-01-01/);
  assert.match(pdf, /25\.000/);
});
