import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

// Cetak struk harus jalan di printer nyata, bukan hanya terlihat bagus di layar.
// Dua aturan driver yang mudah terlewat: hindari flexbox (lebar salah di posisi potong),
// dan beri jeda sebelum print() agar printer jaringan tidak menerima halaman kosong.
test('dokumen cetak tidak memakai flexbox', async () => {
  const lib = await read('../src/lib/printDoc.ts');
  const styles = lib.split('const STYLES')[1]?.split('`;')[0] ?? '';
  assert.doesNotMatch(styles, /display:\s*flex/, 'flexbox merusak layout di driver printer');
  assert.match(styles, /table-layout:\s*fixed/, 'lebar kolom harus dipatok');
  assert.match(styles, /@page\s*\{[^}]*80mm/, 'ukuran kertas 80mm');
});

test('print dipanggil setelah jeda, bukan langsung setelah write', async () => {
  const lib = await read('../src/lib/printDoc.ts');
  assert.match(lib, /setTimeout\(\(\)\s*=>\s*\{\s*win\.print\(\)/, 'print() harus ditunda');
  assert.match(lib, /return true;/, 'kegagalan popup harus dilaporkan ke pemanggil');
  assert.match(lib, /if \(!win\) return false;/, 'popup diblokir tidak boleh gagal diam-diam');
});

test('tiket dapur dan struk pelanggan adalah dua dokumen terpisah', async () => {
  const lib = await read('../src/lib/printDoc.ts');
  assert.match(lib, /export function printKitchenTicket/);
  assert.match(lib, /export function printReceipt/);
  const receipt = lib.split('export function printReceipt')[1] ?? '';
  assert.match(receipt, /Struk Pembayaran/);
  assert.match(receipt, /Status Bayar/);
  assert.match(receipt, /Terima kasih atas kunjungan Anda/);
  // Kembalian hanya masuk akal bila pelanggan membayar lebih.
  assert.match(receipt, /change > 0 \?/, 'kembalian bersyarat');
});

test('KDS dan Verifikasi & Transaksi memakai modul cetak yang sama', async () => {
  const kds = await read('../src/components/KDS.tsx');
  const om = await read('../src/components/OrderManagement.tsx');
  assert.match(kds, /printKitchenTicket/, 'KDS memakai printer tiket bersama');
  assert.match(kds, /import \{ printKitchenTicket \} from '\.\.\/lib\/printDoc'/);
  assert.match(om, /printReceipt/, 'Verifikasi & Transaksi memakai printer struk bersama');
  assert.match(om, /Cetak Struk/);
  assert.doesNotMatch(kds, /const ticketStyles/, 'duplikasi CSS cetak di komponen harus hilang');
});

test('password pelanggan tersimpan dan hanya dikirim ke staf berizin', async () => {
  const users = await read('../src/routes/users.ts');
  const db = await read('../src/db/db.ts');
  assert.match(users, /COALESCE\(u\.password_plain, ''\) AS password_plain/);
  assert.match(users, /password_plain\) VALUES/, 'registrasi pelanggan mencatat password');
  assert.match(users, /updates\.push\("password_plain = \?"\)/, 'ganti password pelanggan ikut tercatat');
  assert.match(db, /Users password_plain column verified\/created/, 'kolom ditambah otomatis saat startup');

  // Route pembaca password harus di balik requireUserAdmin, bukan terbuka.
  const listRoute = users.split('// GET /api/users')[1]?.split('// GET /api/users/:id/recommendations')[0] ?? '';
  assert.match(listRoute, /requireUserAdmin/, 'daftar pengguna wajib requireUserAdmin');
});

test('password pelanggan disamarkan sampai staf menekan tombol lihat', async () => {
  const um = await read('../src/components/UserManagement.tsx');
  assert.match(um, /revealedPasswordId/, 'status tampil/sembunyi per pengguna');
  assert.match(um, /'•'\.repeat/, 'password disamarkan secara default');
  assert.match(um, /KeyRound/, 'kartu pengguna menampilkan baris password');
});
