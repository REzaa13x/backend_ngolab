import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

// Aturan peran: Support = pramusaji. Ia harus bisa melihat antrean dapur,
// membuat pesanan manual, dan mengubah status pesanan — tetapi TIDAK boleh
// memverifikasi pembayaran.
test('Support mendapat akses operasional dapur tetapi bukan verifikasi pembayaran', async () => {
  const orders = await read('../src/routes/orders.ts');
  const orderStaff = orders.match(/const requireOrderStaff = requireRoles\(([^)]*)\)/)?.[1] ?? '';
  const paymentStaff = orders.match(/const requirePaymentStaff = requireRoles\(([^)]*)\)/)?.[1] ?? '';

  assert.match(orderStaff, /'Support'/, 'Support harus boleh mengakses endpoint staf pesanan');
  assert.doesNotMatch(paymentStaff, /'Support'/, 'Support tidak boleh memverifikasi pembayaran');
  assert.match(paymentStaff, /'Kasir'/);
});

test('ketersediaan menu dan pre-order terbuka untuk Support', async () => {
  const menu = await read('../src/routes/menu.ts');
  const preorders = await read('../src/routes/preorders.ts');
  assert.match(menu.match(/const requireMenuStaff = requireRoles\(([^)]*)\)/)?.[1] ?? '', /'Support'/);
  assert.match(preorders.match(/const requirePreorderStaff = requireRoles\(([^)]*)\)/)?.[1] ?? '', /'Support'/);
});

test('sidebar menyembunyikan menu sensitif dari Support', async () => {
  const sidebar = await read('../src/components/Sidebar.tsx');
  const lineFor = (id: string) => sidebar.split('\n').find(line => line.includes(`id: '${id}'`)) ?? '';

  // Support boleh buka dapur, pesanan manual, pengguna, ketersediaan menu, PO.
  for (const allowed of ['kds', 'manual-order', 'users', 'menu-availability', 'preorder-orders']) {
    assert.match(lineFor(allowed), /Support/, `Support harus melihat menu ${allowed}`);
  }
  // Support tidak boleh membuka laporan, inventori, tim & shift, log audit, pengaturan.
  for (const denied of ['reports', 'stock', 'staff', 'logs', 'settings', 'api-docs', 'sales-history']) {
    assert.doesNotMatch(lineFor(denied), /Support/, `Support tidak boleh melihat menu ${denied}`);
  }
});

test('registrasi pegawai mewajibkan password minimal 6 karakter', async () => {
  const staff = await read('../src/routes/staff.ts');
  assert.match(staff, /length < 6/, 'validasi panjang password harus ada');
  assert.doesNotMatch(staff, /hashPassword\("password"\)/, 'password default "password" harus dihapus');
  assert.match(staff, /password_plain/, 'password tercatat agar Super Admin dapat membacanya');
});

test('perubahan password pegawai ikut memperbarui hash dan catatan password', async () => {
  const staff = await read('../src/routes/staff.ts');
  assert.match(staff, /updates\.push\("password_hash = \?"\)/);
  assert.match(staff, /updates\.push\("password_plain = \?"\)/);
});

test('shift ganda untuk pegawai yang sama pada tanggal yang sama ditolak', async () => {
  const shifts = await read('../src/routes/shifts.ts');
  assert.match(shifts, /SELECT id FROM shifts WHERE staff_id = \? AND date = \?/);
  assert.match(shifts, /409/);
});

test('riwayat Smart Tag diproksikan lewat backend, bukan IP LAN dari browser', async () => {
  const orders = await read('../src/routes/orders.ts');
  const history = await read('../src/components/SalesHistory.tsx');
  assert.match(orders, /router\.get\('\/smart-tag'/);
  assert.doesNotMatch(history, /192\.168\.1\.11/, 'browser tidak boleh memanggil IP LAN');
  assert.match(history, /\/api\/orders\/smart-tag/);
});

test('estimasi antrean dapur diambil dari API, bukan angka statis', async () => {
  const kds = await read('../src/components/KDS.tsx');
  assert.match(kds, /\/api\/orders\/queue-status/);
  assert.doesNotMatch(kds, /Rata-rata Persiapan: 12m/);
});

test('gambar item KDS memakai foto menu bila tersedia', async () => {
  const orders = await read('../src/routes/orders.ts');
  const kds = await read('../src/components/KDS.tsx');
  assert.match(orders, /m\.image_url FROM menus m/, 'endpoint pesanan harus mengirim gambar menu');
  assert.match(kds, /item\.image \|\|/, 'KDS memakai gambar menu dengan cadangan contoh');
});

test('tombol aksi tidak lagi mati di KDS, Database Pengguna, dan Tim & Shift', async () => {
  const kds = await read('../src/components/KDS.tsx');
  const users = await read('../src/components/UserManagement.tsx');
  const staff = await read('../src/components/StaffManagement.tsx');

  assert.match(kds, /printTicket/, 'KDS harus punya aksi nyata pada titik tiga');
  assert.match(users, /openUserManager/, 'Database Pengguna harus membuka pengelolaan pengguna');
  assert.match(users, /method: 'PUT'/, 'edit pengguna memakai PUT /api/users/:id yang sebelumnya tidak terpakai');
  assert.match(staff, /setEditingStaff/, 'Tim & Shift harus membuka editor pegawai');
});

test('nama aplikasi memakai GeastEats, bukan judul bawaan AI Studio', async () => {
  const html = await read('../index.html');
  const settings = await read('../src/contexts/SettingsContext.tsx');
  assert.match(html, /<title>GeastEats<\/title>/);
  assert.doesNotMatch(html, /My Google AI Studio App/);
  assert.match(settings, /brand_name: 'GeastEats'/);
});
