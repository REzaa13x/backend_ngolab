import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaymentProofFile,
  buildPaymentProofSuccessResponse,
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

test('path bukti lama hanya dapat dibuat dari URL upload payment-proofs yang aman', () => {
  assert.equal(
    paymentProofPathFromUrl('/uploads/payment-proofs/payment-proof-old.png', 'C:/app'),
    'C:/app/public/uploads/payment-proofs/payment-proof-old.png',
  );
  assert.equal(paymentProofPathFromUrl('/uploads/preorders/other.png', 'C:/app'), null);
  assert.equal(paymentProofPathFromUrl('/uploads/payment-proofs/../secret.env', 'C:/app'), null);
  assert.equal(paymentProofPublicUrl('payment-proof-new.webp'), '/uploads/payment-proofs/payment-proof-new.webp');
});
