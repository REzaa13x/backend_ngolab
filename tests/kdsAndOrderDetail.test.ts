import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

// Foto menu harus punya dua jalur pencarian: lewat menu_id, lalu lewat nama.
// Pesanan dari integrasi luar menyimpan menu_id berprefiks 'ext-<id>' sehingga
// pencocokan id gagal dan seluruh item kehilangan gambarnya.
test('foto item pesanan dicari lewat menu_id lalu jatuh ke nama menu', async () => {
  const orders = await read('../src/routes/orders.ts');
  assert.match(orders, /ORDER_ITEM_IMAGE_SQL/);
  assert.match(orders, /m\.id = oi\.menu_id/, 'jalur pertama memakai menu_id');
  assert.match(orders, /m\.name = COALESCE\(oi\.item_name, oi\.menu_name\)/, 'jalur cadangan memakai nama menu');
});

test('daftar pesanan dan KDS sama-sama menyertakan gambar item', async () => {
  const orders = await read('../src/routes/orders.ts');
  const listBody = orders.split('router.get("/", requireOrderStaff')[1]?.split('router.get(\'/smart-tag\'')[0] ?? '';
  const kdsBody = orders.split('router.get("/kds", requireOrderStaff')[1]?.split("router.get('/kds/pending-count'")[0] ?? '';
  assert.match(listBody, /ORDER_ITEM_IMAGE_SQL/, 'GET /api/orders harus menyertakan gambar');
  assert.match(kdsBody, /ORDER_ITEM_IMAGE_SQL/, 'GET /api/orders/kds harus menyertakan gambar');
});

test('titik tiga KDS menyediakan hapus pesanan lewat API, bukan sekadar menyembunyikan', async () => {
  const kds = await read('../src/components/KDS.tsx');
  assert.match(kds, /const deleteOrder = async/, 'harus ada handler hapus');
  assert.match(kds, /method: 'DELETE'/, 'hapus memakai DELETE /api/orders/:id');
  assert.match(kds, /Hapus Pesanan/);
  assert.doesNotMatch(kds, /Sembunyikan dari Layar/, 'penyembunyian lokal harus diganti hapus nyata');
  assert.match(kds, /Stok yang terpakai akan dikembalikan/, 'konfirmasi menjelaskan efek ke stok');
});

test('tiket cetak memuat harga satuan, subtotal, dan total', async () => {
  const lib = await read('../src/lib/printDoc.ts');
  const rows = lib.split('const itemRows')[1]?.split('// Baris kosong di akhir')[0] ?? '';
  const ticket = lib.split('export function printKitchenTicket')[1]?.split('export function printReceipt')[0] ?? '';
  assert.match(rows, /formatRupiah\(i\.price\)/, 'harga satuan tampil di baris item');
  assert.match(rows, /formatRupiah\(Number\(i\.price \|\| 0\) \* Number\(i\.quantity \|\| 0\)\)/, 'subtotal per baris');
  assert.match(ticket, /total-label/, 'ada baris total');
  assert.match(lib, /size: 80mm auto/, 'ukuran kertas termal 80mm');
});

test('Verifikasi & Transaksi menampilkan nama barang dan harga satuan', async () => {
  const om = await read('../src/components/OrderManagement.tsx');
  assert.match(om, /Pesanan &amp; Barang/);
  assert.match(om, /item\.quantity}x \{item\.name\}/, 'nama barang tampil per item');
  assert.match(om, /@ Rp \{Number\(item\.price \|\| 0\)\.toLocaleString\(\)\}/, 'harga satuan tampil');
  assert.match(om, /order\.items\?\.length \?/, 'ada penanganan pesanan tanpa item');
});
