import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('registrasi publik tidak boleh membuat akun staf (Kasir, Koki, Support, Admin)', async () => {
  const auth = await read('../src/routes/auth.ts');
  // Blok endpoint pelanggan dibatasi penanda kode, karena nama komentar
  // register-staff juga berawalan "// POST /api/auth/register".
  const customerStart = auth.indexOf('router.post("/register"');
  const customerEnd = auth.indexOf('// POST /api/auth/change-password');
  assert.ok(customerStart > 0 && customerEnd > customerStart, 'blok register pelanggan harus ditemukan');
  const customerRegister = auth.slice(customerStart, customerEnd);
  assert.doesNotMatch(customerRegister, /INSERT INTO staff/i, 'registrasi publik tidak boleh insert ke tabel staff');
  // Pastikan role selalu Pelanggan
  assert.match(customerRegister, /'Pelanggan'/i, 'registrasi publik harus menetapkan role Pelanggan');
});

test('pendaftaran pegawai mandiri wajib berstatus pending dan tidak langsung memberi sesi', async () => {
  const auth = await read('../src/routes/auth.ts');
  const start = auth.indexOf('// POST /api/auth/register-staff');
  const end = auth.indexOf('router.post("/register"');
  assert.ok(start > 0 && end > start, 'blok register-staff harus ditemukan');
  const staffRegister = auth.slice(start, end);
  // Akun pegawai baru harus menunggu persetujuan Super Admin, bukan langsung aktif.
  const insert = /INSERT INTO staff[\s\S]*?VALUES\s*\([^)]*\)/i.exec(staffRegister);
  assert.ok(insert, 'pernyataan INSERT staff harus ditemukan');
  assert.match(insert[0], /'pending'/, 'akun pegawai mandiri harus berstatus pending');
  assert.doesNotMatch(insert[0], /'active'/, 'pendaftaran mandiri tidak boleh langsung mengaktifkan akun');
  // Tanpa token: pendaftar tidak boleh langsung masuk sebelum disetujui.
  assert.doesNotMatch(staffRegister, /\.\.\.authenticatedUser/, 'pendaftaran mandiri tidak boleh mengeluarkan token sesi');
  assert.match(staffRegister, /requires_approval/, 'respons harus menandai perlunya persetujuan');
  // Role dibatasi daftar putih pegawai, bukan pelanggan/admin.
  assert.match(staffRegister, /isPublicStaffRole/);
});

test('registrasi publik tidak menyimpan password_plain baru', async () => {
  const auth = await read('../src/routes/auth.ts');
  // Pastikan parameter password_plain pada insert bernilai NULL
  assert.match(auth, /password_hash,\s*password_plain\)\s*VALUES\s*\([^)]*NULL\)/i, 'registrasi publik tidak boleh menyimpan password_plain');
});

test('login customer menolak login tanpa password jika password_hash bernilai NULL', async () => {
  const auth = await read('../src/routes/auth.ts');
  const users = await read('../src/routes/users.ts');
  assert.match(auth, /PASSWORD_SETUP_REQUIRED/, 'auth login harus menolak akun tanpa password_hash');
  assert.match(users, /PASSWORD_SETUP_REQUIRED/, 'users login harus menolak akun tanpa password_hash');
});

test('endpoint mutasi voucher dilindungi autentikasi dan role kasir/admin', async () => {
  const coinPromos = await read('../src/routes/coinPromos.ts');
  assert.match(coinPromos, /router\.get\("\/user-vouchers\/:user_id",\s*requireAuthenticated/, 'user vouchers harus requireAuthenticated');
  assert.match(coinPromos, /router\.post\("\/claim-code",\s*requireAuthenticated/, 'claim code harus requireAuthenticated');
  assert.match(coinPromos, /router\.post\("\/use-voucher",\s*requireCashierOrAdmin/, 'use voucher harus dibatasi role kasir/admin');
});

test('endpoint crowdfunding contribute dilindungi autentikasi', async () => {
  const cf = await read('../src/routes/crowdfunding.ts');
  assert.match(cf, /router\.post\("\/:room_id\/contribute",\s*requireAuthenticated/, 'contribute patungan wajib requireAuthenticated');
});
