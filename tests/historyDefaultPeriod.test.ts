import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

// Regresi: layar Riwayat Transaksi dulu default ke periode 'bulan' dengan
// selectedDate = hari ini. Akibatnya riwayat bulan lalu seolah "hilang" —
// pemilik hanya melihat transaksi bulan berjalan dan menyimpulkan datanya
// terhapus, padahal database utuh. Default harus "Semua", dan bila filter
// menyembunyikan sebagian data, layar wajib memberi tahu berapa yang disembunyikan.
test('Riwayat Transaksi default menampilkan semua periode, bukan hanya bulan berjalan', async () => {
  const src = await read('../src/components/SalesHistory.tsx');
  assert.match(src, /useState<HistoryPeriod>\('semua'\)/, 'periode default harus "semua" agar riwayat lama langsung terlihat');
  assert.doesNotMatch(src, /useState<HistoryPeriod>\('bulan'\)/, 'default "bulan" menyembunyikan riwayat lama dan terlihat seperti data hilang');
});

test('layar memberi tahu berapa transaksi yang disembunyikan filter', async () => {
  const src = await read('../src/components/SalesHistory.tsx');
  assert.match(src, /allOrders\.length - filtered\.length/, 'harus menghitung selisih yang disembunyikan');
  assert.match(src, /disembunyikan filter/, 'harus menjelaskan bahwa data disembunyikan, bukan hilang');
  assert.match(src, /role="status"/, 'pemberitahuan harus terbaca pembaca layar');
});

// Verifikasi & Transaksi sudah benar sejak awal; test ini mengunci perilakunya
// supaya tidak ikut diubah jadi default bulanan.
test('Verifikasi & Transaksi tetap default semua periode', async () => {
  const src = await read('../src/components/OrderManagement.tsx');
  assert.match(src, /useState<HistoryPeriod>\('semua'\)/);
});
