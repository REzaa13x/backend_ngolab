import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyBreakdown, monthBreakdown, salesSummary, weekBreakdown, weekdayBreakdown,
  weekdayMenuBreakdown, yearBreakdown, weekdayName,
} from '../src/lib/salesBreakdown.js';

// Semua timestamp sengaja disimpan UTC: 2026-01-05T02:00:00Z = Senin 09:00 WIB.
// Kalau konversi WIB salah, transaksi ini akan jatuh ke hari Minggu.
const order = (created_at: string, total_price: number, items: { name: string; quantity: number; price: number }[], payment_status = 'lunas') => ({
  invoice_number: `INV-${created_at}`, customer_name: 'Ani', created_at, total_price, payment_status, items,
});

const orders = [
  order('2026-01-05T02:00:00Z', 50000, [{ name: 'Nasi Goreng', quantity: 2, price: 20000 }, { name: 'Es Teh', quantity: 1, price: 10000 }]), // Senin
  order('2026-01-06T03:00:00Z', 30000, [{ name: 'Nasi Goreng', quantity: 1, price: 30000 }]), // Selasa
  order('2026-01-06T04:00:00Z', 20000, [{ name: 'Es Teh', quantity: 2, price: 10000 }]), // Selasa
  order('2026-01-12T02:00:00Z', 40000, [{ name: 'Mie', quantity: 2, price: 20000 }]), // Senin minggu berikutnya
];

test('tanggal WIB menentukan hari, bukan tanggal UTC', () => {
  assert.equal(weekdayName('2026-01-05'), 'Senin');
  // 2026-01-04T17:00Z = 2026-01-05 00:00 WIB → tetap Senin, bukan Minggu.
  const rows = dailyBreakdown([order('2026-01-04T17:00:00Z', 10000, [{ name: 'Kopi', quantity: 1, price: 10000 }])]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, '2026-01-05');
  assert.equal(rows[0].weekday, 'Senin');
});

test('rekap harian menjumlahkan pesanan, item, pendapatan, dan menu teratas', () => {
  const rows = dailyBreakdown(orders);
  assert.deepEqual(rows.map(row => row.date), ['2026-01-05', '2026-01-06', '2026-01-12']);
  assert.equal(rows[0].orders, 1);
  assert.equal(rows[0].items, 3);
  assert.equal(rows[0].revenue, 50000);
  assert.equal(rows[0].topMenu, 'Nasi Goreng');
  assert.equal(rows[0].topMenuQty, 2);
  // 06 Jan punya dua transaksi: total 50.000 dan Es Teh menang qty (2 vs 1).
  assert.equal(rows[1].orders, 2);
  assert.equal(rows[1].revenue, 50000);
  assert.equal(rows[1].topMenu, 'Es Teh');
});

test('rekap per hari dalam seminggu selalu Senin–Minggu dan menjumlah per hari', () => {
  const rows = weekdayBreakdown(orders);
  assert.deepEqual(rows.map(row => row.name), ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']);
  const senin = rows[0];
  assert.equal(senin.orders, 2); // 05 Jan + 12 Jan
  assert.equal(senin.revenue, 90000);
  assert.equal(rows[1].revenue, 50000);
  // Hari tanpa transaksi tetap muncul dengan nilai 0, bukan hilang.
  assert.equal(rows[2].orders, 0);
  assert.equal(rows[2].revenue, 0);
});

test('menu per hari mengelompokkan makanan yang laku di tiap hari', () => {
  const rows = weekdayMenuBreakdown(orders);
  const senin = rows.find(row => row.name === 'Senin')!;
  // Senin: Nasi Goreng 2 (05 Jan), Es Teh 1 (05 Jan), Mie 2 (12 Jan).
  // Urutan: qty terbanyak dulu, seri dipecah nama A–Z.
  assert.deepEqual(senin.menus.map(menu => menu.name), ['Mie', 'Nasi Goreng', 'Es Teh']);
  assert.deepEqual(senin.menus.map(menu => menu.quantity), [2, 2, 1]);
  assert.equal(senin.menus.find(menu => menu.name === 'Nasi Goreng')!.revenue, 40000);
  const rabu = rows.find(row => row.name === 'Rabu')!;
  assert.deepEqual(rabu.menus, []);
});

test('rekap mingguan memberi nomor minggu beserta rentang tanggal', () => {
  const weeks = weekBreakdown(orders, { start: '2026-01-01', end: '2026-01-31' });
  assert.ok(weeks.length >= 4);
  assert.equal(weeks[0].label, 'Minggu ke-1');
  // 01 Jan 2026 = Kamis. Rentang dipotong ke awal periode supaya label tidak
  // menjanjikan data akhir Desember yang tidak ikut diekspor.
  assert.equal(weeks[0].start, '2026-01-01');
  assert.equal(weeks[0].end, '2026-01-04');
  assert.equal(weeks[0].rangeLabel, '01 Jan 2026 – 04 Jan 2026');
  const weekWithSenin = weeks.find(week => week.start === '2026-01-05')!;
  assert.equal(weekWithSenin.orders, 3);
  assert.equal(weekWithSenin.revenue, 100000);
  // Minggu ke-1 = 01–04 Jan, jadi 05–11 Jan adalah Minggu ke-2.
  assert.equal(weekWithSenin.label, 'Minggu ke-2');
  assert.equal(weeks[2].label, 'Minggu ke-3');
  // Minggu terakhir juga dipotong ke akhir periode (31 Jan), bukan 01 Feb.
  assert.equal(weeks[weeks.length - 1].end, '2026-01-31');
});

test('rekap mingguan tanpa rentang memakai tanggal transaksi pertama dan terakhir', () => {
  const weeks = weekBreakdown(orders);
  assert.equal(weeks[0].start, '2026-01-05');
  assert.equal(weeks[0].end, '2026-01-11');
  assert.equal(weeks[1].start, '2026-01-12');
});

test('rekap bulanan dan tahunan menjumlah per periode', () => {
  const months = monthBreakdown(orders);
  assert.equal(months.length, 1);
  assert.equal(months[0].month, '2026-01');
  assert.equal(months[0].revenue, 140000);
  assert.equal(months[0].orders, 4);

  const years = yearBreakdown(orders);
  assert.equal(years.length, 1);
  assert.equal(years[0].year, '2026');
  assert.equal(years[0].revenue, 140000);
});

test('ringkasan menghitung rata-rata, hari terbaik, dan menu terlaris', () => {
  const summary = salesSummary(orders, orders);
  assert.equal(summary.revenue, 140000);
  assert.equal(summary.items, 8);
  assert.equal(summary.days, 3);
  assert.equal(summary.averagePerDay, Math.round(140000 / 3));
  assert.equal(summary.bestDay?.date, '2026-01-05');
  assert.equal(summary.topMenu?.name, 'Nasi Goreng');
  assert.equal(summary.topMenu?.quantity, 3);
});

test('transaksi belum lunas tidak masuk pendapatan rekap', () => {
  const mixed = [...orders, order('2026-01-07T03:00:00Z', 999000, [{ name: 'Mahal', quantity: 1, price: 999000 }], 'belum_bayar')];
  const paid = mixed.filter(item => item.payment_status === 'lunas');
  const summary = salesSummary(mixed, paid);
  assert.equal(summary.transactions, 5);
  assert.equal(summary.paidTransactions, 4);
  assert.equal(summary.revenue, 140000);
  assert.ok(!dailyBreakdown(paid).some(row => row.date === '2026-01-07'));
});
