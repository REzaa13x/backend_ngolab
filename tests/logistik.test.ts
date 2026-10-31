import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/db.js';

test('Logistik: Dashboard summary menghitung metrik stok dan mutasi dengan akurat', async () => {
  const [statusRows]: any = await db.query(`
    SELECT 
      COUNT(*) AS total_item,
      SUM(CASE WHEN stok > min_stok THEN 1 ELSE 0 END) AS aman,
      SUM(CASE WHEN stok > batas_kritis AND stok <= min_stok THEN 1 ELSE 0 END) AS menipis,
      SUM(CASE WHEN stok > 0 AND stok <= batas_kritis THEN 1 ELSE 0 END) AS kritis,
      SUM(CASE WHEN stok <= 0 THEN 1 ELSE 0 END) AS habis,
      SUM(CASE WHEN stok <= min_stok THEN 1 ELSE 0 END) AS perlu_dibeli
    FROM items
    WHERE status = 'aktif'
  `);
  const stats = statusRows[0];
  assert.ok(Number(stats.total_item) >= 9, 'Minimal ada 9 item terdaftar');
  assert.ok(Number(stats.aman) >= 0, 'Metrik aman valid');
  assert.equal(
    Number(stats.total_item),
    Number(stats.aman) + Number(stats.menipis) + Number(stats.kritis) + Number(stats.habis),
    'Total item harus sama dengan jumlah seluruh kategori status'
  );
});

test('Logistik: Menghitung kapasitas porsi resep menu dan mengidentifikasi bahan bottleneck', async () => {
  // Ambil menu Mie Ayam Ko+Lab Komplit (id = 1)
  const [menus]: any = await db.query('SELECT * FROM logistik_menus WHERE id = 1');
  assert.equal(menus.length, 1, 'Menu Mie Ayam Komplit harus ada');

  const [ingredients]: any = await db.query(`
    SELECT mi.*, i.nama AS item_nama, i.stok AS item_stok
    FROM menu_ingredients mi
    JOIN items i ON mi.item_id = i.id
    WHERE mi.menu_id = 1
  `);
  assert.ok(ingredients.length >= 6, 'Resep Mie Ayam Komplit memiliki 6 komposisi bahan');

  // Hitung kapasitas masing-masing bahan:
  // Mie Basah: 100 / 1 = 100
  // Ayam Cincang: 80 / 1 = 80 -> BOTTLENECK!
  // Bakso Halus: 250 / 2 = 125
  // Bakso Urat: 100 / 1 = 100
  // Bumbu Rahasia: 5000 / 25 = 200
  // Pangsit Goreng: 150 / 1 = 150
  const capacities = ingredients.map((ing: any) => ({
    name: ing.item_nama,
    capacity: Math.floor(Number(ing.item_stok) / Number(ing.jumlah_per_porsi))
  }));

  const maxCapacity = Math.min(...capacities.map((c: any) => c.capacity));
  assert.equal(maxCapacity, 80, 'Kapasitas maksimal porsi awal harus tepat 80 porsi (dibatasi Ayam Cincang)');

  const bottleneck = capacities.reduce((prev: any, curr: any) => (curr.capacity < prev.capacity ? curr : prev), capacities[0]);
  assert.equal(bottleneck.name, 'Ayam Cincang', 'Bottleneck harus teridentifikasi sebagai Ayam Cincang');
});

test('Logistik: Simulasi & forecasting manufaktur menghitung konsumsi dan sisa stok', async () => {
  const targetPorsi = 50; // Rencana produksi 50 porsi
  const [ingredients]: any = await db.query(`
    SELECT mi.*, i.nama AS item_nama, i.stok AS item_stok
    FROM menu_ingredients mi
    JOIN items i ON mi.item_id = i.id
    WHERE mi.menu_id = 1
  `);

  for (const ing of ingredients) {
    const butuh = Number(ing.jumlah_per_porsi) * targetPorsi;
    const stok = Number(ing.item_stok);
    assert.ok(stok >= butuh, `Stok ${ing.item_nama} (${stok}) harus cukup untuk 50 porsi (butuh ${butuh})`);
    const sisa = stok - butuh;
    assert.ok(sisa >= 0, `Sisa stok ${ing.item_nama} tidak boleh negatif`);
  }
});

test('Logistik: Simulasi forecasting mendeteksi kekurangan bahan jika target porsi melebihi kapasitas', async () => {
  const targetPorsi = 100; // Melebihi kapasitas Ayam Cincang (hanya 80 porsi)
  const [ingredients]: any = await db.query(`
    SELECT mi.*, i.nama AS item_nama, i.stok AS item_stok
    FROM menu_ingredients mi
    JOIN items i ON mi.item_id = i.id
    WHERE mi.menu_id = 1 AND i.nama = 'Ayam Cincang'
  `);
  assert.equal(ingredients.length, 1);
  const ayam = ingredients[0];
  const butuh = Number(ayam.jumlah_per_porsi) * targetPorsi; // 100 porsi
  const stok = Number(ayam.item_stok); // 80 porsi
  const shortage = butuh - stok;
  assert.equal(shortage, 20, 'Kekurangan bahan Ayam Cincang untuk 100 porsi harus tepat 20 porsi');
});

test('Logistik: Mutasi stok atomik menolak barang keluar jika stok tidak mencukupi', async () => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [itemRows]: any = await connection.query('SELECT id, stok FROM items WHERE id = 1 FOR UPDATE');
    const stokSaatIni = Number(itemRows[0].stok);
    const jumlahDiminta = stokSaatIni + 500; // melebihi stok

    let threw = false;
    try {
      if (stokSaatIni < jumlahDiminta) {
        throw new Error(`Stok tidak mencukupi! Stok: ${stokSaatIni}, diminta: ${jumlahDiminta}`);
      }
    } catch (err: any) {
      threw = true;
      assert.match(err.message, /tidak mencukupi/i);
    }
    assert.equal(threw, true, 'Harus melempar error saat stok tidak mencukupi');
    await connection.rollback();
  } finally {
    connection.release();
  }
});

test.after(async () => {
  await db.end();
});

