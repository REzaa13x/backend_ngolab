import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import {
  assertPaymentProofStorageOutsideRoot,
  evacuateLegacyPaymentProofDirs,
  isPublicUploadPath,
  isSafePaymentProofFilename,
  isUploadsRequestPath,
  normalizeRequestPath,
  paymentProofPathFromUrl,
  paymentProofStorageDir,
  paymentProofUrlCandidates,
  removePaymentProofFile,
} from '../src/lib/paymentProof.js';

// Jaminan utama bersifat struktural: folder bukti berada DI LUAR root proyek, sehingga static mana pun
// (express.static, static bawaan Vite dev, atau rung '/@fs/') tidak punya URL yang memetakan ke sana.
async function buildSite() {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'proof-parent-'));
  const root = path.join(parent, 'app');
  const uploads = path.join(root, 'public', 'uploads');
  await fs.mkdir(path.join(uploads, 'preorders'), { recursive: true });
  await fs.writeFile(path.join(uploads, 'preorders', 'ok.png'), 'PUBLIC');
  // Berkas lama yang sengaja ditaruh di dalam root, meniru state sebelum upgrade.
  await fs.mkdir(path.join(uploads, 'payment-proofs'), { recursive: true });
  await fs.writeFile(path.join(uploads, 'payment-proofs', 'payment-proof-legacy.png'), 'LEGACY-SECRET');
  const storage = paymentProofStorageDir(root);
  await fs.mkdir(storage, { recursive: true });
  await fs.writeFile(path.join(storage, 'payment-proof-secret.png'), 'SECRET-PROOF-BYTES');
  return { parent, root, uploads, storage };
}

function buildApp(uploads: string, root: string) {
  const app = express();
  // Route bukti terautentikasi didaftarkan SEBELUM gate, sama seperti server.ts, agar permintaan
  // yang sah tidak dihentikan gate static.
  app.get('/uploads/payment-proofs/:filename', (req, res) => {
    if (!isSafePaymentProofFilename(String(req.params.filename || ''))) {
      return res.status(404).json({ message: 'Bukti pembayaran tidak ditemukan.' });
    }
    res.status(401).json({ message: 'butuh autentikasi' });
  });
  // Meniru server.ts: gate app-level berbasis path TERNORMALISASI, bukan app.use('/uploads').
  app.use((req, res, next) => {
    const normalized = normalizeRequestPath(req.url);
    if (isUploadsRequestPath(normalized)) {
      if (!isPublicUploadPath(normalized)) {
        return res.status(404).json({ message: 'Berkas tidak ditemukan.' });
      }
    }
    next();
  });
  app.use((req, res, next) => {
    const normalized = normalizeRequestPath(req.url);
    if (normalized === null || !isUploadsRequestPath(normalized)) return next();
    // req.url dipulihkan setelah static, agar tidak menyambungkan ulang ke handler hilir.
    const originalUrl = req.url;
    req.url = normalized.slice('/uploads'.length);
    express.static(uploads)(req, res, error => {
      req.url = originalUrl;
      if (error) return next(error);
      res.status(404).json({ message: 'Berkas tidak ditemukan.' });
    });
  });
  // Denylist dibandingkan tanpa memandang huruf.
  const DENIED = ['/storage', '/dist', '/migrations', '/backups', '/releases', '/scripts'];
  app.use((req, res, next) => {
    const normalized = normalizeRequestPath(req.url);
    if (normalized === null) return res.status(404).json({ message: 'Berkas tidak ditemukan.' });
    const lowered = normalized.toLowerCase();
    if (DENIED.some(prefix => lowered === prefix || lowered.startsWith(`${prefix}/`))) {
      return res.status(404).json({ message: 'Berkas tidak ditemukan.' });
    }
    next();
  });
  // Route bukti terautentikasi tiruan: hanya menyajikan nama berkas yang cocok pola bukti.
  // Middleware yang melayani seluruh root proyek, meniru static bawaan Vite dev.
  app.use(express.static(root));
  app.use((req, res, next) => {
    const normalized = normalizeRequestPath(req.url);
    if (isUploadsRequestPath(normalized)) {
      return res.status(404).json({ message: 'Berkas tidak ditemukan.' });
    }
    next();
  });
  return app;
}

async function request(app: express.Express, urlPath: string): Promise<{ status: number; body: string }> {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  try {
    const response = await fetch(`http://127.0.0.1:${port}${urlPath}`);
    return { status: response.status, body: await response.text() };
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

test('bukti pembayaran tidak dapat diambil tanpa autentikasi, termasuk bentuk alias tingkat mount', async () => {
  const { parent, root, uploads } = await buildSite();
  const app = buildApp(uploads, root);
  const pathVariants = [
    '/payment-proofs/payment-proof-legacy.png',
    '//payment-proofs/payment-proof-legacy.png',
    '/payment-proofs//payment-proof-legacy.png',
    '/payment-proofs%2Fpayment-proof-legacy.png',
    '/foo/../payment-proofs/payment-proof-legacy.png',
    '/foo/%2e%2e/payment-proofs/payment-proof-legacy.png',
    '/foo/%252e%252e/payment-proofs/payment-proof-legacy.png',
    '/paymen~1/payment-proof-legacy.png',
    '/PAYMEN~1/payment-proof-legacy.png',
    '/paymen%7E1/payment-proof-legacy.png',
    '/paymen%257E1/payment-proof-legacy.png',
    '/payment-proofs./payment-proof-legacy.png',
    '/payment-proofs%2e/payment-proof-legacy.png',
    '/payment-proofs%20/payment-proof-legacy.png',
    '/%70ayment-proofs/payment-proof-legacy.png',
    '/storage/payment-proof-legacy.png',
    '/preorders/../../payment-proofs/payment-proof-legacy.png',
    '/payment-proof-missing.png',
  ];
  // Bentuk alias tingkat mount: Express mencocokkan app.use(prefix) terhadap path MENTAH, jadi dulu
  // bentuk ini melewati gate ber-prefix lalu didekode oleh static di belakangnya.
  const mountAlias = [
    '/uploads%2Fpayment-proofs%2Fpayment-proof-legacy.png',
    '/uploads%2fpayment-proofs%2fpayment-proof-legacy.png',
    '//uploads/payment-proofs/payment-proof-legacy.png',
    '///uploads/payment-proofs/payment-proof-legacy.png',
    '/./uploads/payment-proofs/payment-proof-legacy.png',
    '/uploads\\payment-proofs\\payment-proof-legacy.png',
    '/UPLOADS/payment-proofs/payment-proof-legacy.png',
    '/uploads%2F%70ayment-proofs/payment-proof-legacy.png',
  ];
  try {
    for (const suffix of pathVariants) {
      for (const urlPath of [`/uploads${suffix}`, suffix.startsWith('/') ? `/uploads${suffix}` : suffix]) {
        const response = await request(app, urlPath);
        // 404 (ditolak gate/static) atau 401 (route terautentikasi tanpa token) sama-sama benar;
        // yang penting tidak 200 dan tidak membocorkan isi berkas.
        assert.ok(
          response.status === 404 || response.status === 401,
          `${urlPath} harus 404/401, dapat ${response.status}`,
        );
        assert.doesNotMatch(response.body, /LEGACY-SECRET|SECRET-PROOF-BYTES/, `${urlPath} membocorkan bukti`);
      }
    }
    for (const urlPath of mountAlias) {
      const response = await request(app, urlPath);
      assert.ok(
        response.status === 404 || response.status === 401,
        `alias mount ${urlPath} harus 404/401, dapat ${response.status}`,
      );
      assert.doesNotMatch(response.body, /LEGACY-SECRET|SECRET-PROOF-BYTES/, `alias mount ${urlPath} membocorkan bukti`);
    }
    // Aset unggahan sah harus tetap tersaji.
    for (const ok of ['/uploads/preorders/ok.png', '/uploads%2Fpreorders%2Fok.png']) {
      const response = await request(app, ok);
      assert.equal(response.status, 200, `${ok} harus 200, dapat ${response.status}`);
      assert.equal(response.body, 'PUBLIC');
    }
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('akar static root proyek tidak memiliki jalur ke folder bukti karena folder itu di luar root', async () => {
  const { parent, root, storage } = await buildSite();
  try {
    assert.equal(path.relative(root, storage).startsWith('..'), true);
    // Tanpa gate apa pun: static atas SELURUH root tetap tidak menemukan folder penyimpanan.
    const bare = express();
    bare.use(express.static(root));
    const response = await request(bare, '/storage/payment-proofs/payment-proof-secret.png');
    assert.equal(response.status, 404);
    assert.notEqual(response.body, 'SECRET-PROOF-BYTES');
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('konfigurasi folder bukti di dalam root proyek ditolak secara gagal-tertutup', () => {
  const previous = process.env.PAYMENT_PROOF_PATH;
  try {
    // Default harus berada di luar root proyek, jadi tidak boleh melempar.
    delete process.env.PAYMENT_PROOF_PATH;
    assert.equal(path.relative('C:/app', assertPaymentProofStorageOutsideRoot('C:/app')).startsWith('..'), true);

    for (const inside of ['storage/payment-proofs', '.', './proofs', 'public/uploads/payment-proofs', '../app/storage']) {
      process.env.PAYMENT_PROOF_PATH = inside;
      assert.throws(
        () => assertPaymentProofStorageOutsideRoot('C:/app'),
        /di luar root proyek/i,
        `${inside} seharusnya ditolak`,
      );
    }

    process.env.PAYMENT_PROOF_PATH = '../user_billing';
    assert.equal(assertPaymentProofStorageOutsideRoot('C:/app'), path.resolve('C:/app', '../user_billing'));
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROOF_PATH;
    else process.env.PAYMENT_PROOF_PATH = previous;
  }
});

test('folder penyimpanan bukti dapat dialihkan keluar rilis lewat PAYMENT_PROOF_PATH', () => {
  const previous = process.env.PAYMENT_PROOF_PATH;
  try {
    delete process.env.PAYMENT_PROOF_PATH;
    assert.equal(path.relative('C:/app', paymentProofStorageDir('C:/app')).startsWith('..'), true);
    process.env.PAYMENT_PROOF_PATH = '../user_billing';
    assert.equal(paymentProofStorageDir('C:/app'), path.resolve('C:/app', '../user_billing'));
    process.env.PAYMENT_PROOF_PATH = path.join(os.tmpdir(), 'proof-absolute');
    assert.equal(paymentProofStorageDir('C:/app'), path.resolve(os.tmpdir(), 'proof-absolute'));
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROOF_PATH;
    else process.env.PAYMENT_PROOF_PATH = previous;
  }
});

test('URL bukti hanya dipetakan ke folder penyimpanan, bukan ke public/uploads', () => {
  const previous = process.env.PAYMENT_PROOF_PATH;
  try {
    process.env.PAYMENT_PROOF_PATH = 'C:/proofs';
    assert.equal(
      paymentProofPathFromUrl('/uploads/payment-proofs/payment-proof-a.png', 'C:/app'),
      path.join('C:/proofs', 'payment-proof-a.png').replace(/\\/g, '/'),
    );
    assert.equal(paymentProofPathFromUrl('/uploads/preorders/other.png', 'C:/app'), null);
    assert.equal(paymentProofPathFromUrl('/uploads/payment-proofs/../secret.env', 'C:/app'), null);
    assert.equal(paymentProofPathFromUrl('/uploads/payment-proofs/..%2Fsecret.env', 'C:/app'), null);
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROOF_PATH;
    else process.env.PAYMENT_PROOF_PATH = previous;
  }
});

test('normalisasi path menyatukan semua bentuk alias menjadi satu bentuk kanonik, tanpa mengubah huruf', () => {
  const canonical = '/uploads/preorders/ok.png';
  for (const form of [
    '//uploads/preorders/ok.png',
    '/./uploads/preorders/ok.png',
    '/uploads%2Fpreorders%2Fok.png',
    '/uploads/preorders/./ok.png',
    '/uploads/other/../preorders/ok.png',
    '/UPLOADS/preorders/ok.png',
  ]) {
    assert.equal(normalizeRequestPath(form)?.toLowerCase(), canonical, `${form} harus ternormalisasi`);
  }
  // Huruf TIDAK boleh dilipat: nama berkas bukti memakai randomUUID() dengan huruf besar.
  assert.equal(
    normalizeRequestPath('/uploads/payment-proofs/payment-proof-A1B2C3D4.png'),
    '/uploads/payment-proofs/payment-proof-A1B2C3D4.png',
  );
  assert.equal(normalizeRequestPath('/../../etc/passwd'), null, 'overflow traversal harus null');
  assert.equal(normalizeRequestPath('/%ZZ'), null, 'encoding tidak valid harus null');
});

test('daftar putih unggahan publik mengizinkan seluruh keluarga URL unggahan yang benar-benar dipakai', () => {
  // Daftar ini diambil dari setiap tempat aplikasi membentuk URL /uploads. Salah satu false negative
  // di sini berarti gambar/video/audio yang sah gagal dimuat di production.
  const legitimate = [
    '/uploads/default_voucher.png',                        // VoucherManagement
    '/uploads/promo-1778787209382.webp',                   // berkas lama di akar uploads
    '/uploads/promos/promo-1778787209382.webp',            // coinPromos
    '/uploads/digital-board/media-1778789906315.jpg',      // digitalBoard (gambar)
    '/uploads/digital-board/media-1778789906315.mp4',      // digitalBoard (video)
    '/uploads/digital-board/media-1778789906315.webm',     // digitalBoard (video)
    '/uploads/digital-board/media-1778789906315.mov',      // digitalBoard (video quicktime)
    '/uploads/menus/menu-1780673324566-45.jpg',            // menu (base64 & unggahan)
    '/uploads/menus/menu-1780673324566-45.png',
    '/uploads/menus/menu-1780673324566-45.gif',
    '/uploads/menus/menu-1780673324566-45.webp',
    '/uploads/preorders/preorder-2f1c9f4e.jpg',            // preorders
    '/uploads/promotions/promo-1779263715407-1a2b3c4d.jpeg', // promotions
    '/uploads/promotions/promo-1779263715407-1a2b3c4d.mp4',
    '/uploads/brand/logo-1780674481356.jpeg',              // settings (brand)
    '/uploads/brand/logo-1780674481356.png',
    '/uploads/sounds/kds-new_order-2f1c9f4e.mp3',          // settings (KDS sound)
    '/uploads/sounds/kds-ready-2f1c9f4e.wav',
    '/uploads/sounds/kds-ready-2f1c9f4e.ogg',
    '/uploads/sounds/kds-ready-2f1c9f4e.m4a',
    '/uploads/sounds/kds-ready-2f1c9f4e.webm',
  ];
  for (const urlPath of legitimate) {
    assert.equal(isPublicUploadPath(urlPath), true, `${urlPath} harus diizinkan`);
  }
});

test('nama berkas bukti berhuruf besar tetap dapat diresolusi handler terautentikasi', () => {
  // Regresi ini pernah nyata: melipat huruf ke kecil membuat setiap bukti asli (randomUUID
  // menghasilkan hex huruf besar) ditolak gate-nya sendiri, sehingga Kasir/Super Admin tidak dapat
  // membuka bukti pembayaran sama sekali.
  const previous = process.env.PAYMENT_PROOF_PATH;
  try {
    process.env.PAYMENT_PROOF_PATH = 'C:/proofs';
    const uuidName = 'payment-proof-A1B2C3D4-E5F6-4A7B-8C9D-E0F1A2B3C4D5.png';
    assert.equal(
      paymentProofPathFromUrl(`/uploads/payment-proofs/${uuidName}`, 'C:/app'),
      path.join('C:/proofs', uuidName).replace(/\\/g, '/'),
    );
    // Gate static TIDAK boleh melayani folder bukti (dilayani handler terautentikasi), apa pun kasusnya.
    assert.equal(isPublicUploadPath(`/uploads/payment-proofs/${uuidName}`), false);
    assert.equal(isPublicUploadPath('/uploads/PAYMENT-PROOFS/x.png'), false);
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROOF_PATH;
    else process.env.PAYMENT_PROOF_PATH = previous;
  }
});

test('nama berkas unggahan publik berhuruf besar tetap diizinkan', () => {
  // preorder-<randomUUID>.jpg dan kds-ready-<randomUUID>.mp3 memakai huruf besar.
  const withUppercase = [
    '/uploads/preorders/preorder-4F2A9C1E-8B3D-4E5F-A6B7-C8D9E0F1A2B3.jpg',
    '/uploads/sounds/kds-ready-9A8B7C6D-5E4F-4A3B-8C2D-1E0F9A8B7C6D.mp3',
    '/uploads/digital-board/media-1778789906315.png',
    '/uploads/menus/MENU-1780673324566-45.JPG',
  ];
  for (const urlPath of withUppercase) {
    assert.equal(isPublicUploadPath(urlPath), true, `${urlPath} harus diizinkan`);
  }
  // Nama direktori tetap dibandingkan tanpa memandang huruf.
  assert.equal(isPublicUploadPath('/uploads/PREORDERS/photo.png'), true);
  assert.equal(isPublicUploadPath('/uploads/PreOrders/photo.png'), true);
});

test('daftar putih unggahan publik menolak direktori tak dikenal, bukti pembayaran, dan bentuk terkode', () => {
  assert.equal(isPublicUploadPath('/uploads/preorders/photo.png'), true);
  assert.equal(isPublicUploadPath('/uploads/preorders/./photo.png'), true);
  assert.equal(isPublicUploadPath('/uploads/preorders/a/../photo.png'), true);

  assert.equal(isPublicUploadPath('/uploads/payment-proofs/g.png'), false);
  assert.equal(isPublicUploadPath('/uploads/paymen%7E1/g.png'), false);
  assert.equal(isPublicUploadPath('/uploads/paymen~1/g.png'), false);
  assert.equal(isPublicUploadPath('/uploads/%70ayment-proofs/g.png'), false);
  assert.equal(isPublicUploadPath('/uploads/payment-proofs%2Fg.png'), false);
  assert.equal(isPublicUploadPath('/uploads/storage/secret.png'), false);
  assert.equal(isPublicUploadPath('/uploads/%73torage/secret.png'), false);
  assert.equal(isPublicUploadPath('/uploads/storage%5Csecret.png'), false);
  assert.equal(isPublicUploadPath('/uploads/../../etc/passwd'), false);
  assert.equal(isPublicUploadPath('/uploads/preorders/../../secret.txt'), false);
  assert.equal(isPublicUploadPath('/uploads/unknown-dir/photo.png'), false);
  assert.equal(isPublicUploadPath('/uploads'), false);
  assert.equal(isPublicUploadPath('/uploads/'), false);
  // Segmen '~' (alias nama pendek NTFS) selalu ditolak, termasuk di dalam direktori sah.
  assert.equal(isPublicUploadPath('/uploads/preorders/sub~1/photo.png'), false);
  assert.equal(isPublicUploadPath('/uploads/menus/menu%7E1.jpg'), false);
  assert.equal(isPublicUploadPath(''), false);
  assert.equal(isPublicUploadPath('/'), false);
});

test('semua berkas bukti lama dievakuasi rekursif, termasuk subfolder, berapa pun namanya', async () => {
  const { parent, root } = await buildSite();
  const legacyDir = path.join(root, 'public', 'uploads', 'payment-proofs');
  const distDir = path.join(root, 'dist', 'uploads', 'payment-proofs');
  await fs.mkdir(path.join(legacyDir, '2026-01'), { recursive: true });
  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(path.join(distDir, 'payment-proof-legacy.png'), 'LEGACY');
  // Nama yang TIDAK sesuai pola pun tetap data pelanggan dan harus ikut dipindahkan.
  await fs.writeFile(path.join(legacyDir, 'bukti-123.jpg'), 'LEGACY2');
  await fs.writeFile(path.join(legacyDir, 'not-a-proof.txt'), 'LEGACY3');
  // Subfolder tidak boleh ditinggalkan di dalam root.
  await fs.writeFile(path.join(legacyDir, '2026-01', 'nested.png'), 'NESTED-SECRET');

  const targetDir = paymentProofStorageDir(root);
  const logs: string[] = [];
  try {
    const moved = await evacuateLegacyPaymentProofDirs(root, message => logs.push(message));
    assert.equal(moved, 5);
    assert.equal(await fs.readFile(path.join(targetDir, 'payment-proof-legacy.png'), 'utf8'), 'LEGACY-SECRET');
    assert.equal(await fs.readFile(path.join(targetDir, 'bukti-123.jpg'), 'utf8'), 'LEGACY2');
    assert.equal(await fs.readFile(path.join(targetDir, 'not-a-proof.txt'), 'utf8'), 'LEGACY3');
    assert.equal(await fs.readFile(path.join(targetDir, '2026-01', 'nested.png'), 'utf8'), 'NESTED-SECRET');
    // Salinan dari dist disimpan terpisah agar tidak menimpa berkas asli.
    assert.equal(await fs.readFile(path.join(targetDir, 'recovered', 'payment-proof-legacy.png'), 'utf8'), 'LEGACY');
    // Kedua folder lama benar-benar hilang, termasuk subfoldernya (folder kosong ikut dibuang).
    await assert.rejects(fs.access(legacyDir), 'folder lama harus hilang');
    await assert.rejects(fs.access(distDir), 'folder dist lama harus hilang');

    assert.equal(await evacuateLegacyPaymentProofDirs(root, message => logs.push(message)), 0);
    await fs.rm(legacyDir, { recursive: true, force: true });
    assert.equal(await evacuateLegacyPaymentProofDirs(root, message => logs.push(message)), 0);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('evakuasi bukti lama tidak menimpa berkas yang sudah ada di folder penyimpanan', async () => {
  const { parent, root } = await buildSite();
  const legacyDir = path.join(root, 'public', 'uploads', 'payment-proofs');
  const targetDir = paymentProofStorageDir(root);
  // Berkas tujuan sudah terisi dengan nama yang sama; bukti lama tidak boleh menimpanya.
  await fs.writeFile(path.join(targetDir, 'payment-proof-dup.png'), 'SUDAH-ADA');
  await fs.writeFile(path.join(legacyDir, 'payment-proof-dup.png'), 'BUKTI-LAMA');

  const logs: string[] = [];
  try {
    const moved = await evacuateLegacyPaymentProofDirs(root, message => logs.push(message));
    // Dua berkas dipindahkan: berkas legacy bawaan fixture dan berkas bernama sama.
    assert.equal(moved, 2);
    assert.equal(await fs.readFile(path.join(targetDir, 'payment-proof-dup.png'), 'utf8'), 'SUDAH-ADA');
    // Bukti lama tetap tersimpan, tidak hilang, di subfolder collision.
    const collisionDir = path.join(targetDir, 'collision');
    const rescued = await fs.readdir(collisionDir);
    assert.equal(rescued.length, 1);
    assert.equal(await fs.readFile(path.join(collisionDir, rescued[0]), 'utf8'), 'BUKTI-LAMA');
    assert.ok(logs.some(message => /Nama tujuan sudah terisi/i.test(message)));
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('evakuasi bukti lama tidak menghentikan startup ketika folder tujuan tidak dapat dibuat', async () => {
  const { parent, root } = await buildSite();
  const previous = process.env.PAYMENT_PROOF_PATH;
  const logs: string[] = [];
  try {
    // Folder tujuan berada di bawah berkas biasa, sehingga mkdir pasti gagal.
    const blocker = path.join(parent, 'blocker');
    await fs.writeFile(blocker, 'not a directory');
    process.env.PAYMENT_PROOF_PATH = path.join(blocker, 'proofs');
    assert.equal(await evacuateLegacyPaymentProofDirs(root, message => logs.push(message)), 0);
    assert.ok(logs.some(message => /Gagal menyiapkan folder/i.test(message)));
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_PROOF_PATH;
    else process.env.PAYMENT_PROOF_PATH = previous;
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('direktori internal tidak tersaji lewat variasi huruf besar-kecil', async () => {
  const { parent, root, uploads } = await buildSite();
  // Salinan bukti yang tertinggal di dist, seperti keadaan yang mungkin terjadi setelah evakuasi
  // sebagian: tanpa perbandingan tanpa huruf, '/DIST/...' diselesaikan static ke direktori aslinya.
  await fs.mkdir(path.join(root, 'dist', 'uploads', 'payment-proofs'), { recursive: true });
  await fs.writeFile(path.join(root, 'dist', 'uploads', 'payment-proofs', 'payment-proof-x.png'), 'DIST-PROOF-SECRET');
  await fs.mkdir(path.join(root, 'backups'), { recursive: true });
  await fs.writeFile(path.join(root, 'backups', 'dump.sql'), 'DB-DUMP-SECRET');
  await fs.mkdir(path.join(root, 'releases'), { recursive: true });
  await fs.writeFile(path.join(root, 'releases', 'old.txt'), 'RELEASE-SECRET');

  const app = buildApp(uploads, root);
  const blocked = [
    '/dist/uploads/payment-proofs/payment-proof-x.png',
    '/DIST/uploads/payment-proofs/payment-proof-x.png',
    '/Dist/uploads/payment-proofs/payment-proof-x.png',
    '/dist%2Fuploads%2Fpayment-proofs%2Fpayment-proof-x.png',
    '/%64ist/uploads/payment-proofs/payment-proof-x.png',
    '/BACKUPS/dump.sql',
    '/backups/dump.sql',
    '/RELEASES/old.txt',
    '/Releases/old.txt',
    '/uploads/../dist/uploads/payment-proofs/payment-proof-x.png',
  ];
  try {
    for (const urlPath of blocked) {
      const response = await request(app, urlPath);
      assert.equal(response.status, 404, `${urlPath} harus 404, dapat ${response.status}`);
      assert.doesNotMatch(
        response.body,
        /DIST-PROOF-SECRET|DB-DUMP-SECRET|RELEASE-SECRET/,
        `${urlPath} membocorkan berkas internal`,
      );
    }
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('rewrite path unggahan tidak menyambungkan ulang permintaan ke handler hilir', async () => {
  const { parent, root, uploads } = await buildSite();
  const app = buildApp(uploads, root);
  const uuid = 'payment-proof-A1B2C3D4-E5F6-4A7B-8C9D-E0F1A2B3C4D5.png';
  try {
    // Tanpa pemulihan req.url, bentuk ini sampai ke route bukti sebagai nama berkas '(../<dir>/...)'
    // atau diteruskan ke router lain. Sekarang harus berhenti sebagai 404 biasa.
    for (const urlPath of [
      `/uploads/../user_billing/${uuid}`,
      '/uploads/../api/health',
      '/uploads/../storage/secret.png',
    ]) {
      const response = await request(app, urlPath);
      assert.equal(response.status, 404, `${urlPath} harus 404, dapat ${response.status}`);
    }
    // Path yang memang menunjuk berkas unggahan sah tetap disajikan setelah normalisasi.
    const legit = await request(app, '/uploads/../uploads/preorders/ok.png');
    assert.equal(legit.status, 200);
    assert.equal(legit.body, 'PUBLIC');
    // Route terautentikasi tetap menolak tanpa token, dan menolak nama berkas tak aman.
    const authed = await request(app, `/uploads/payment-proofs/${uuid}`);
    assert.equal(authed.status, 401, 'route bukti harus meminta autentikasi');
    const bad = await request(app, '/uploads/payment-proofs/../user_billing/x.png');
    assert.equal(bad.status, 404);
    assert.equal(isSafePaymentProofFilename('../user_billing/x.png'), false);
    assert.equal(isSafePaymentProofFilename(uuid), true);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test('penghapusan file bukti melaporkan kegagalan dan menganggap ENOENT berhasil', async () => {
  const log: string[] = [];
  const record = (message: string) => log.push(message);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'proof-delete-'));
  const existing = path.join(root, 'payment-proof-a.png');
  const missing = path.join(root, 'payment-proof-b.png');
  await fs.writeFile(existing, 'data');

  try {
    assert.equal(await removePaymentProofFile(missing, record), true);
    assert.equal(log.length, 0);
    assert.equal(await removePaymentProofFile(existing, record), true);
    await assert.rejects(fs.access(existing));

    const stubbornDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proof-dir-'));
    await fs.mkdir(path.join(stubbornDir, 'keep.png'));
    log.length = 0;
    assert.equal(await removePaymentProofFile(path.join(stubbornDir, 'keep.png'), record, 0), false);
    assert.equal(log.length, 1);
    assert.match(log[0], /3 percobaan/);
    await fs.rm(stubbornDir, { recursive: true, force: true });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('penghapusan bukti mempertimbangkan kedua kolom URL warisan', () => {
  assert.deepEqual(
    paymentProofUrlCandidates({ payment_proof_url: '/uploads/payment-proofs/a.png' }),
    ['/uploads/payment-proofs/a.png'],
  );
  assert.deepEqual(
    paymentProofUrlCandidates({ payment_proof_url: 'https://gateway.example/proof.png', payment_proof: '/uploads/payment-proofs/b.png' }),
    ['https://gateway.example/proof.png', '/uploads/payment-proofs/b.png'],
  );
  assert.deepEqual(
    paymentProofUrlCandidates({ payment_proof: '/uploads/payment-proofs/c.png' }),
    ['/uploads/payment-proofs/c.png'],
  );
  assert.deepEqual(paymentProofUrlCandidates({}), []);
});
