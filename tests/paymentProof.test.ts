import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildPaymentProofFile,
  buildPaymentProofSuccessResponse,
  paymentProofDisplayUrl,
  assertPaymentProofUploadAllowed,
  assertPaymentVerificationAllowed,
  apiClientOwnsOrder,
  PaymentProofConflictError,
  paymentProofErrorResponse,
  paymentProofPublicUrl,
  paymentProofPathFromUrl,
  persistPaymentProofReplacement,
} from '../src/lib/paymentProof.js';

const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('bukti pembayaran menerima gambar PNG yang dapat didekode seluruhnya', async () => {
  const result = await buildPaymentProofFile(VALID_PNG, 'fixed-id');

  assert.equal(result.filename, 'payment-proof-fixed-id.png');
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.publicUrl, '/uploads/payment-proofs/payment-proof-fixed-id.png');
});

test('bukti pembayaran menolak file yang hanya berisi signature gambar', async () => {
  await assert.rejects(
    buildPaymentProofFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'signature-only'),
    /JPG, PNG, GIF, atau WEBP/i,
  );
});

test('bukti pembayaran menolak gambar yang terpotong', async () => {
  await assert.rejects(
    buildPaymentProofFile(VALID_PNG.subarray(0, 20), 'truncated'),
    /JPG, PNG, GIF, atau WEBP/i,
  );
});

test('bukti pembayaran menolak konten non-gambar', async () => {
  await assert.rejects(
    buildPaymentProofFile(Buffer.from('<script>alert(1)</script>'), 'bad-file'),
    /JPG, PNG, GIF, atau WEBP/i,
  );
});

test('penggantian konkuren memakai compare-and-swap dan tidak menghapus URL pemenang', async () => {
  const previousUrl = '/uploads/payment-proofs/payment-proof-old.png';
  let currentUrl = previousUrl;
  const written: string[] = [];
  const deleted: string[] = [];

  const replace = (suffix: string) => persistPaymentProofReplacement({
    orderId: 'order-1',
    previousUrl,
    nextUrl: `/uploads/payment-proofs/payment-proof-${suffix}.png`,
    nextPath: `C:/app/public/uploads/payment-proofs/payment-proof-${suffix}.png`,
    previousPath: 'C:/app/public/uploads/payment-proofs/payment-proof-old.png',
    buffer: VALID_PNG,
    writeFile: async path => { written.push(path); },
    compareAndSwap: async (_orderId, expectedUrl, nextUrl) => {
      if (currentUrl !== expectedUrl) return false;
      currentUrl = nextUrl;
      return true;
    },
    deleteFile: async path => { deleted.push(path); },
    log: () => undefined,
    retryDelayMs: 0,
  });

  const results = await Promise.allSettled([replace('one'), replace('two')]);
  const fulfilled = results.filter(result => result.status === 'fulfilled');
  const rejected = results.filter(result => result.status === 'rejected');

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].status === 'rejected' && rejected[0].reason instanceof PaymentProofConflictError);
  assert.equal(written.length, 2);
  assert.equal(deleted.filter(path => path.endsWith('payment-proof-old.png')).length, 1);
  assert.equal(deleted.some(path => path.endsWith(currentUrl.split('/').at(-1)!)), false);
});

test('kegagalan menghapus file lama dicoba ulang secara terbatas dan dicatat', async () => {
  let attempts = 0;
  const logs: Array<{ message: string; error: unknown }> = [];

  await persistPaymentProofReplacement({
    orderId: 'order-1',
    previousUrl: '/uploads/payment-proofs/payment-proof-old.png',
    nextUrl: '/uploads/payment-proofs/payment-proof-new.png',
    nextPath: 'C:/app/public/uploads/payment-proofs/payment-proof-new.png',
    previousPath: 'C:/app/public/uploads/payment-proofs/payment-proof-old.png',
    buffer: VALID_PNG,
    writeFile: async () => undefined,
    compareAndSwap: async () => true,
    deleteFile: async () => {
      attempts += 1;
      throw new Error('filesystem unavailable');
    },
    log: (message, error) => { logs.push({ message, error }); },
    retryDelayMs: 0,
  });

  assert.equal(attempts, 3);
  assert.equal(logs.length, 1);
  assert.match(logs[0].message, /file lama/i);
});

test('kegagalan cleanup tidak menutupi error database asli', async () => {
  const databaseError = new Error('database exploded');
  const logs: Array<{ message: string; error: unknown }> = [];

  await assert.rejects(
    persistPaymentProofReplacement({
      orderId: 'order-1',
      previousUrl: null,
      nextUrl: '/uploads/payment-proofs/payment-proof-new.png',
      nextPath: 'C:/app/public/uploads/payment-proofs/payment-proof-new.png',
      previousPath: null,
      buffer: VALID_PNG,
      writeFile: async () => undefined,
      compareAndSwap: async () => { throw databaseError; },
      deleteFile: async () => { throw new Error('cleanup exploded'); },
      log: (message, error) => { logs.push({ message, error }); },
      retryDelayMs: 0,
    }),
    error => error === databaseError,
  );

  assert.equal(logs.length, 1);
  assert.match(logs[0].message, /cleanup/i);
});

test('error database atau filesystem tidak dibocorkan dalam respons API', () => {
  const response = paymentProofErrorResponse(new Error('ER_ACCESS_DENIED at C:/secret/uploads'));

  assert.deepEqual(response, {
    status: 500,
    body: { message: 'Gagal mengunggah bukti pembayaran.' },
  });
  assert.equal(JSON.stringify(response).includes('ER_ACCESS_DENIED'), false);
  assert.equal(JSON.stringify(response).includes('C:/secret'), false);
});

test('respons sukses mengambil seluruh field bukti dari snapshot order yang sama', () => {
  const order = {
    id: 'order-1',
    payment_proof_url: '/uploads/payment-proofs/payment-proof-winner.png',
    payment_proof_uploaded_at: '2026-09-17 09:00:00',
  };

  assert.deepEqual(buildPaymentProofSuccessResponse(order), {
    message: 'Bukti pembayaran berhasil diunggah.',
    payment_proof_url: order.payment_proof_url,
    payment_proof_uploaded_at: order.payment_proof_uploaded_at,
    order,
  });
});

test('upload dari kiosk hanya menerima pesanan reguler aktif yang belum diverifikasi', () => {
  assert.equal(assertPaymentProofUploadAllowed({ payment_status: 'belum_bayar', status: 'menunggu', order_type: 'regular' }), 'pending_verifikasi');
  assert.equal(assertPaymentProofUploadAllowed({ payment_status: 'pending_verifikasi', status: 'menunggu', order_type: 'regular' }), 'pending_verifikasi');
  assert.throws(() => assertPaymentProofUploadAllowed({ payment_status: 'lunas', status: 'menunggu', order_type: 'regular' }), /sudah lunas/i);
  assert.throws(() => assertPaymentProofUploadAllowed({ payment_status: 'ditolak', status: 'dibatalkan', order_type: 'regular' }), /tidak menerima bukti/i);
  assert.throws(() => assertPaymentProofUploadAllowed({ payment_status: 'belum_bayar', status: 'dibatalkan', order_type: 'regular' }), /dibatalkan/i);
  assert.throws(() => assertPaymentProofUploadAllowed({ payment_status: 'belum_bayar', status: 'menunggu', order_type: 'preorder' }), /reguler/i);
});

test('API key hanya boleh mengunggah bukti untuk order yang dibuat credential yang sama', () => {
  assert.equal(apiClientOwnsOrder(7, '7'), true);
  assert.equal(apiClientOwnsOrder('legacy', 'legacy'), true);
  assert.equal(apiClientOwnsOrder(8, '7'), false);
  assert.equal(apiClientOwnsOrder(7, null), false);
});

test('verifikasi pembayaran hanya menerima pesanan reguler aktif yang belum lunas', () => {
  assert.doesNotThrow(() => assertPaymentVerificationAllowed({ payment_status: 'pending_verifikasi', status: 'menunggu', order_type: 'regular' }));
  assert.doesNotThrow(() => assertPaymentVerificationAllowed({ payment_status: 'belum_bayar', status: 'menunggu', order_type: 'regular' }));
  assert.throws(() => assertPaymentVerificationAllowed({ payment_status: 'lunas', status: 'menunggu', order_type: 'regular' }), /sudah lunas/i);
  assert.throws(() => assertPaymentVerificationAllowed({ payment_status: 'ditolak', status: 'dibatalkan', order_type: 'regular' }), /ditolak/i);
  assert.throws(() => assertPaymentVerificationAllowed({ payment_status: 'belum_bayar', status: 'dibatalkan', order_type: 'regular' }), /dibatalkan/i);
  assert.throws(() => assertPaymentVerificationAllowed({ payment_status: 'pending_verifikasi', status: 'menunggu', order_type: 'preorder' }), /pre-order/i);
});

test('admin menggunakan URL bukti baru dengan fallback kolom legacy', () => {
  assert.equal(paymentProofDisplayUrl({ payment_proof_url: '/uploads/new.png', payment_proof: '/uploads/old.png' }), '/uploads/new.png');
  assert.equal(paymentProofDisplayUrl({ payment_proof_url: null, payment_proof: '/uploads/old.png' }), '/uploads/old.png');
  assert.equal(paymentProofDisplayUrl({}), null);
});

test('path bukti hanya dibuat dari URL payment-proofs yang aman, mengikuti folder penyimpanan terkonfigurasi', () => {
  const previous = process.env.PAYMENT_PROOF_PATH;
  try {
    process.env.PAYMENT_PROOF_PATH = 'C:/proofs';
    assert.equal(
      paymentProofPathFromUrl('/uploads/payment-proofs/payment-proof-old.png', 'C:/app'),
      path.join('C:/proofs', 'payment-proof-old.png').replace(/\\/g, '/'),
    );
    assert.equal(paymentProofPathFromUrl('/uploads/preorders/other.png', 'C:/app'), null);
    assert.equal(paymentProofPathFromUrl('/uploads/payment-proofs/../secret.env', 'C:/app'), null);
    assert.equal(paymentProofPublicUrl('payment-proof-new.webp'), '/uploads/payment-proofs/payment-proof-new.webp');
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROOF_PATH;
    else process.env.PAYMENT_PROOF_PATH = previous;
  }
});
