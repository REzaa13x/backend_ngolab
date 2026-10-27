import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('endpoint katalog reward mengekspos properti pointsCost untuk kompatibilitas frontend', async () => {
  const rs = await read('../src/lib/rewardService.ts');
  assert.match(rs, /pointsCost:\s*Number\(r\.points_required\)/, 'pointsCost harus diekspos sebagai alias points_required');
});

test('kode penukaran voucher dibuat secara acak aman (crypto.randomBytes)', async () => {
  const rs = await read('../src/lib/rewardService.ts');
  assert.match(rs, /crypto\.randomBytes/, 'kode penukaran harus menggunakan crypto.randomBytes');
  assert.doesNotMatch(rs, /Math\.random\(\)/, 'tidak boleh menggunakan Math.random untuk kode voucher');
});

test('penukaran reward memeriksa ketersediaan stok dan status aktif reward', async () => {
  const rs = await read('../src/lib/rewardService.ts');
  assert.match(rs, /REWARD_OUT_OF_STOCK/, 'harus memeriksa stok reward');
  assert.match(rs, /REWARD_INACTIVE/, 'harus memeriksa status aktif reward');
  assert.match(rs, /REWARD_EXPIRED/, 'harus memeriksa tanggal kedaluwarsa');
  assert.match(rs, /IDEMPOTENCY_CONFLICT/, 'harus menangani konflik idempotency key');
});

test('pemenuhan voucher (fulfill) menolak voucher yang sudah pernah digunakan sebelumnya', async () => {
  const rs = await read('../src/lib/rewardService.ts');
  assert.match(rs, /REDEMPTION_ALREADY_FULFILLED/, 'voucher yang sudah digunakan harus ditolak');
  assert.match(rs, /REDEMPTION_EXPIRED/, 'voucher kedaluwarsa harus ditolak');
});

test('rute validasi dan fulfillment voucher dibatasi hanya untuk staf (Kasir, Admin, Super Admin)', async () => {
  const route = await read('../src/routes/membership.ts');
  assert.match(route, /requireStaff.*=.*requireRoles\("Super Admin",\s*"Admin",\s*"Kasir"\)/, 'requireStaff mencakup Kasir, Admin, Super Admin');
  assert.match(route, /loyaltyStaffRouter\.post\("\/redemptions\/validate",\s*requireStaff/, 'validate voucher harus dilindungi requireStaff');
  assert.match(route, /loyaltyStaffRouter\.post\("\/redemptions\/:code\/fulfill",\s*requireStaff/, 'fulfill voucher harus dilindungi requireStaff');
});
