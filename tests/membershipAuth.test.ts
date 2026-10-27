import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('registrasi publik tidak boleh membuat akun staf (Kasir, Koki, Support, Admin)', async () => {
  const auth = await read('../src/routes/auth.ts');
  // Pastikan tidak ada lagi pembuatan staff di rute register publik
  assert.doesNotMatch(auth, /INSERT INTO staff\s*\([^)]*\)\s*VALUES/i, 'registrasi publik tidak boleh insert ke tabel staff');
  // Pastikan role selalu Pelanggan
  assert.match(auth, /role.*'Pelanggan'/i, 'registrasi publik harus menetapkan role Pelanggan');
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
