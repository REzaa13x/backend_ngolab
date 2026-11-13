import test from 'node:test';
import assert from 'node:assert/strict';
import { bulkCompleteMessage, bulkSkipReason, planBulkComplete } from '../src/lib/bulkComplete.js';

const base = { payment_status: 'lunas', order_type: 'regular' };

test('hanya pesanan lunas yang masih berjalan yang boleh diselesaikan', () => {
  assert.equal(bulkSkipReason({ ...base, id: '1', status: 'menunggu' }), null);
  assert.equal(bulkSkipReason({ ...base, id: '2', status: 'siap' }), null);
  assert.equal(bulkSkipReason({ ...base, id: '3', status: 'sedang_diproses' }), null);
  assert.equal(bulkSkipReason({ ...base, id: '4', status: 'menunggu', payment_status: 'pending_verifikasi' }), 'belum_lunas');
  // Status di luar daftar berjalan dilewati apa pun status bayarnya, sehingga
  // tidak ada pesanan aneh yang ikut ditutup.
  assert.equal(bulkSkipReason({ ...base, id: '5', status: 'belum_bayar' }), 'status_tidak_dikenal');
});

test('pesanan selesai, batal, dan pre-order tidak ikut ditutup', () => {
  assert.equal(bulkSkipReason({ ...base, id: '1', status: 'selesai' }), 'sudah_selesai');
  assert.equal(bulkSkipReason({ ...base, id: '2', status: 'dibatalkan' }), 'dibatalkan');
  assert.equal(bulkSkipReason({ ...base, id: '3', status: 'menunggu', order_type: 'preorder' }), 'preorder');
});

test('filter outlet menghormati outlet lain dan status tak dikenal', () => {
  assert.equal(bulkSkipReason({ ...base, id: '1', status: 'menunggu', outlet: 'coworking' }, { outlet: 'ngolab' }), 'outlet_lain');
  assert.equal(bulkSkipReason({ ...base, id: '2', status: 'antri', outlet: 'ngolab' }, { outlet: 'ngolab' }), 'status_tidak_dikenal');
});

test('rencana bulk memisahkan yang selesai dan yang dilewati beserta alasannya', () => {
  const plan = planBulkComplete([
    { ...base, id: '1', status: 'menunggu' },
    { ...base, id: '2', status: 'menunggu', payment_status: 'belum_bayar' },
    { ...base, id: '3', status: 'selesai' },
    { ...base, id: '4', status: 'menunggu', order_type: 'preorder' },
  ]);
  assert.deepEqual(plan.completable.map(order => order.id), ['1']);
  assert.deepEqual(plan.skipped, [
    { id: '2', reason: 'belum_lunas' },
    { id: '3', reason: 'sudah_selesai' },
    { id: '4', reason: 'preorder' },
  ]);
  assert.match(bulkCompleteMessage(plan), /1 pesanan diselesaikan/);
  assert.match(bulkCompleteMessage(plan), /1 belum lunas dilewati/);
});

test('rencana kosong tetap memberi pesan yang jelas', () => {
  const plan = planBulkComplete([]);
  assert.equal(plan.completable.length, 0);
  assert.match(bulkCompleteMessage(plan), /0 pesanan diselesaikan/);
});
