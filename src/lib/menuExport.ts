import ExcelJS from 'exceljs';

export type MenuExportOutlet = 'ngolab' | 'coworking';
export interface MenuExportItem {
  outlet: MenuExportOutlet;
  name: string;
  category: string;
  price: number;
  description: string;
  isActive: boolean;
  inStock: boolean;
}

export async function makeMenuWorkbook(items: MenuExportItem[], outlet: MenuExportOutlet) {
  const selected = items.filter(item => item.outlet === outlet);
  const workbook = new ExcelJS.Workbook();
  const groups = new Map<string, MenuExportItem[]>();
  for (const item of selected) {
    const category = String(item.category ?? '').trim() || 'Tanpa Kategori';
    const group = groups.get(category) ?? [];
    group.push(item);
    groups.set(category, group);
  }
  const usedNames = new Set(['menu', 'history']);
  const addSheet = (name: string, rows: MenuExportItem[], title: string) => {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }] });
  sheet.addRow([title]); sheet.mergeCells('A1:F1');
  sheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF4F46E5' } };
  sheet.getRow(1).height = 26;
  sheet.addRow([`Outlet: ${outlet === 'ngolab' ? 'Ngolab' : 'Coworking'} | ${rows.length} menu`]);
  sheet.mergeCells('A2:F2');
  const header = sheet.addRow(['Nama Menu', 'Kategori', 'Harga (Rp)', 'Ketersediaan', 'Status', 'Deskripsi']);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  header.height = 24;
  header.alignment = { vertical: 'middle' };
  rows.forEach((item, index) => {
    // ExcelJS serializes primitive strings as string cells, never formulas.
    const row = sheet.addRow([String(item.name ?? ''), String(item.category ?? ''), Number(item.price) || 0,
      item.inStock ? 'Tersedia' : 'Tidak tersedia', item.isActive ? 'Aktif' : 'Arsip', String(item.description ?? '')]);
    if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    row.getCell(3).numFmt = '#,##0';
    row.alignment = { vertical: 'top', wrapText: true };
  });
  [30, 22, 18, 20, 14, 50].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.autoFilter = 'A3:F3';
  };
  addSheet('Menu', selected, 'DAFTAR MENU');
  for (const [category, rows] of groups) {
    const base = category.replace(/[\\/*?:\[\]\x00-\x1f]/g, ' ').trim().replace(/^'+|'+$/g, '').trim() || 'Tanpa Kategori';
    let name = base.slice(0, 31).replace(/'+$/g, '').trim() || 'Kategori';
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) {
      const ending = ` (${suffix++})`;
      name = `${base.slice(0, 31 - ending.length).replace(/'+$/g, '').trim()}${ending}`;
    }
    usedNames.add(name.toLowerCase());
    addSheet(name, rows, `KATEGORI: ${category}`);
  }
  return workbook;
}

export async function exportMenuExcel(items: MenuExportItem[], outlet: MenuExportOutlet) {
  const workbook = await makeMenuWorkbook(items, outlet);
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `menu-${outlet}.xlsx`;
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
