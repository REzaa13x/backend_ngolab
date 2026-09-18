import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import sharp from 'sharp';

const PAYMENT_PROOF_PREFIX = '/uploads/payment-proofs/';
const SAFE_PAYMENT_PROOF_FILE = /^payment-proof-[A-Za-z0-9-]+\.(?:jpg|png|gif|webp)$/;
const SUPPORTED_FORMATS = new Map([
  ['jpeg', { extension: '.jpg', mimeType: 'image/jpeg' }],
  ['png', { extension: '.png', mimeType: 'image/png' }],
  ['gif', { extension: '.gif', mimeType: 'image/gif' }],
  ['webp', { extension: '.webp', mimeType: 'image/webp' }],
]);
const INVALID_IMAGE_MESSAGE = 'Bukti pembayaran harus berupa JPG, PNG, GIF, atau WEBP yang valid.';

export interface PaymentProofFile {
  filename: string;
  mimeType: string;
  publicUrl: string;
}

export class PaymentProofValidationError extends Error {
  constructor() {
    super(INVALID_IMAGE_MESSAGE);
    this.name = 'PaymentProofValidationError';
  }
}

export class PaymentProofConflictError extends Error {
  constructor() {
    super('Bukti pembayaran telah berubah. Silakan unggah ulang.');
    this.name = 'PaymentProofConflictError';
  }
}

export function paymentProofErrorResponse(error: unknown): {
  status: number;
  body: { message: string };
} {
  if (error instanceof PaymentProofValidationError) {
    return { status: 400, body: { message: error.message } };
  }
  if (error instanceof PaymentProofConflictError) {
    return { status: 409, body: { message: error.message } };
  }
  return { status: 500, body: { message: 'Gagal mengunggah bukti pembayaran.' } };
}

export function buildPaymentProofSuccessResponse<T extends {
  payment_proof_url: string | null;
  payment_proof_uploaded_at: unknown;
}>(order: T) {
  return {
    message: 'Bukti pembayaran berhasil diunggah.',
    payment_proof_url: order.payment_proof_url,
    payment_proof_uploaded_at: order.payment_proof_uploaded_at,
    order,
  };
}

export function assertPaymentProofUploadAllowed(order: {
  payment_status?: unknown;
  status?: unknown;
  order_type?: unknown;
}): 'pending_verifikasi' {
  const paymentStatus = String(order.payment_status || '').toLowerCase();
  const orderStatus = String(order.status || '').toLowerCase();
  const orderType = String(order.order_type || 'regular').toLowerCase();
  if (orderType !== 'regular') throw new Error('Upload bukti kiosk hanya berlaku untuk pesanan reguler.');
  if (paymentStatus === 'lunas') throw new Error('Pembayaran pesanan sudah lunas dan bukti tidak dapat diganti.');
  if (paymentStatus === 'ditolak') throw new Error('Pesanan yang ditolak tidak menerima bukti pembayaran baru.');
  if (orderStatus === 'dibatalkan') throw new Error('Pesanan sudah dibatalkan dan tidak menerima bukti pembayaran.');
  if (!['belum_bayar', 'pending_verifikasi'].includes(paymentStatus)) {
    throw new Error('Status pembayaran tidak menerima bukti pembayaran.');
  }
  return 'pending_verifikasi';
}

export function apiClientOwnsOrder(clientId: unknown, ownerId: unknown): boolean {
  if (clientId === null || clientId === undefined || ownerId === null || ownerId === undefined) return false;
  return String(clientId) === String(ownerId);
}

export function assertPaymentVerificationAllowed(order: {
  payment_status?: unknown;
  status?: unknown;
  order_type?: unknown;
}): void {
  const paymentStatus = String(order.payment_status || '').toLowerCase();
  const orderStatus = String(order.status || '').toLowerCase();
  const orderType = String(order.order_type || 'regular').toLowerCase();
  if (orderType !== 'regular') throw new Error('Pembayaran pre-order harus diverifikasi melalui alur pre-order.');
  if (paymentStatus === 'lunas') throw new Error('Pesanan sudah lunas.');
  if (paymentStatus === 'ditolak') throw new Error('Pembayaran yang ditolak tidak dapat diverifikasi ulang.');
  if (orderStatus === 'dibatalkan') throw new Error('Pesanan yang dibatalkan tidak dapat diverifikasi.');
  if (!['belum_bayar', 'pending_verifikasi'].includes(paymentStatus)) {
    throw new Error('Status pembayaran tidak dapat diverifikasi.');
  }
}

export function paymentProofDisplayUrl(order: {
  payment_proof_url?: unknown;
  payment_proof?: unknown;
}): string | null {
  if (typeof order.payment_proof_url === 'string' && order.payment_proof_url) return order.payment_proof_url;
  if (typeof order.payment_proof === 'string' && order.payment_proof) return order.payment_proof;
  return null;
}

/**
 * Kedua kolom URL bukti dapat diisi oleh aplikasi kasir bersama. Saat menghapus, kita harus
 * membersihkan file dari kolom mana pun yang menyimpannya, bukan hanya kolom yang diprioritaskan.
 */
export function paymentProofUrlCandidates(order: {
  payment_proof_url?: unknown;
  payment_proof?: unknown;
}): string[] {
  const urls: string[] = [];
  for (const value of [order.payment_proof_url, order.payment_proof]) {
    if (typeof value === 'string' && value && !urls.includes(value)) urls.push(value);
  }
  return urls;
}

export function paymentProofPublicUrl(filename: string): string {
  return `${PAYMENT_PROOF_PREFIX}${filename}`;
}

/**
 * Nama berkas bukti harus cocok pola yang kita tulis sendiri. Dipakai route penyajian agar parameter
 * path seperti '../<dir>/x.png' tidak pernah diperlakukan sebagai berkas bukti.
 */
export function isSafePaymentProofFilename(filename: unknown): boolean {
  return typeof filename === 'string' && SAFE_PAYMENT_PROOF_FILE.test(filename);
}

export async function buildPaymentProofFile(buffer: Buffer, id: string): Promise<PaymentProofFile> {
  try {
    const image = sharp(buffer, { animated: true, failOn: 'error' });
    const metadata = await image.metadata();
    const detected = metadata.format ? SUPPORTED_FORMATS.get(metadata.format) : undefined;
    if (!detected) throw new PaymentProofValidationError();

    // metadata() alone can accept a valid header with a truncated body. Force libvips
    // to decode every frame/pixel before accepting the upload.
    await image.toBuffer();

    const filename = `payment-proof-${id}${detected.extension}`;
    return {
      filename,
      mimeType: detected.mimeType,
      publicUrl: paymentProofPublicUrl(filename),
    };
  } catch (error) {
    if (error instanceof PaymentProofValidationError) throw error;
    throw new PaymentProofValidationError();
  }
}

// Hanya direktori ini yang boleh dilayani dari public/uploads. Daftar putih, bukan daftar hitam:
// daftar hitam berbasis teks selalu dapat dilewati ('%7E' untuk alias nama pendek NTFS, '%2e',
// '%73torage', 'storage%5C', garis miring ganda, segmen '.'/'..').
const PUBLIC_UPLOAD_DIRS = new Set([
  'brand',
  'digital-board',
  'menus',
  'preorders',
  'promos',
  'promotions',
  'sounds',
]);
const PUBLIC_UPLOAD_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|jpeg|png|gif|webp)$/;
// Nama berkas di dalam direktori yang diizinkan: huruf/angka/titik/strip/garis bawah, tanpa
// karakter path. Ekstensi tidak dibatasi karena direktori unggahan memang menyimpan media campuran
// (gambar, video mp4/webm/mov, audio mp3/wav/ogg/m4a, logo). Huruf besar WAJIB diizinkan: nama
// berkas asli memakai randomUUID() yang mengandung huruf besar, mis. preorder-4F2A...jpg.
const SAFE_UPLOAD_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Normalisasi URL dilakukan SEKALI di satu tempat, karena Express mencocokkan app.use(prefix)
// terhadap path mentah yang belum didekode: '/uploads%2F...', '//uploads/...', '/./uploads/...' dan
// '/uploads\\...' tidak akan pernah masuk ke gate ber-prefix dan jatuh ke static berikutnya, yang
// justru mendekode sendiri. Karena itu gate harus berbasis path ternormalisasi, bukan prefix literal.
//
// PENTING: huruf TIDAK diubah di sini. Nama berkas bukti memakai randomUUID() yang mengandung huruf
// besar; melipatnya ke huruf kecil membuat setiap bukti asli ditolak gate-nya sendiri. Perbandingan
// yang tidak peka huruf hanya dilakukan pada nama direktori di daftar putih.
export function normalizeRequestPath(rawUrl: unknown): string | null {
  let decoded = String(rawUrl || '').split('?')[0];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }
  const segments: string[] = [];
  for (const segment of decoded.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!segments.length) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

export function isUploadsRequestPath(normalized: string | null): boolean {
  // Perbandingan prefix tanpa memandang huruf: '/UPLOADS/...' harus tetap masuk gate, dan di
  // filesystem yang tidak peka huruf bentuk itu memang dapat disajikan static.
  if (normalized === null) return false;
  const lowered = normalized.toLowerCase();
  return lowered === '/uploads' || lowered.startsWith('/uploads/');
}

/**
 * Menerima path yang SUDAH dinormalisasi (lihat normalizeRequestPath) atau path mentah.
 * Daftar putih, bukan daftar hitam: daftar hitam berbasis teks selalu dapat dilewati.
 */
export function isPublicUploadPath(pathOrUrl: string): boolean {
  const normalized = normalizeRequestPath(pathOrUrl);
  if (!isUploadsRequestPath(normalized) || normalized === null) return false;
  const segments = normalized.slice('/uploads/'.length).split('/');
  if (!segments.length || !segments[0]) return false;
  // '~' menandakan alias nama pendek NTFS dan tidak pernah muncul pada berkas unggahan asli.
  if (segments.some(segment => segment.includes('~'))) return false;
  if (segments.length === 1) return PUBLIC_UPLOAD_FILE.test(segments[0]);
  // Nama direktori dibandingkan tanpa memandang huruf; nama berkas tetap peka huruf karena
  // berkas unggahan nyata menyimpan huruf besar.
  if (!PUBLIC_UPLOAD_DIRS.has(segments[0].toLowerCase())) return false;
  return segments.slice(1).every(segment => SAFE_UPLOAD_NAME.test(segment));
}

export function paymentProofStorageDir(projectRoot = process.cwd()): string {
  // Bukti pembayaran disimpan DI LUAR root proyek. Ini jaminan struktural, bukan pemeriksaan teks:
  // otorisasi berbasis teks URL terbukti dapat dilewati (alias nama pendek NTFS 'paymen~1',
  // '%7E', '%73torage', 'storage%5C', traversal, rung '/@fs/'). Selama folder berada di luar root,
  // tidak ada URL apa pun yang memetakan ke sana—express.static maupun static bawaan Vite dev
  // (yang melayani seluruh root proyek) tidak dapat menjangkaunya.
  const configured = process.env.PAYMENT_PROOF_PATH;
  if (configured && configured.trim()) return path.resolve(projectRoot, configured.trim());
  return path.join(path.dirname(path.resolve(projectRoot)), '.tangolab-payment-proofs');
}

export class PaymentProofStorageConfigError extends Error {
  constructor(storageDir: string, projectRoot: string) {
    super(
      `Folder bukti pembayaran (${storageDir}) berada di dalam root proyek (${projectRoot}). `
      + 'Folder ini tidak boleh berada di dalam pohon yang dilayani static, karena bukti pembayaran '
      + 'akan dapat diunduh tanpa autentikasi. Set PAYMENT_PROOF_PATH ke folder di luar root proyek.',
    );
    this.name = 'PaymentProofStorageConfigError';
  }
}

/**
 * Dipanggil saat startup. Gagal tertutup: konfigurasi tidak aman harus menghentikan layanan,
 * bukan diam-diam menonaktifkan perlindungan.
 */
export function assertPaymentProofStorageOutsideRoot(projectRoot = process.cwd()): string {
  const root = path.resolve(projectRoot);
  const storage = paymentProofStorageDir(root);
  // Perbandingan leksikal saja tidak cukup: symlink/junction yang menunjuk ke dalam root akan lolos,
  // begitu pula perbedaan huruf besar-kecil pada filesystem yang tidak peka huruf.
  // Karena itu realpath dari leluhur terdekat yang benar-benar ada ikut dibandingkan.
  const rootReal = realpathOfNearestExisting(root);
  for (const candidate of [storage, realpathOfNearestExisting(storage)]) {
    if (isPathInside(rootReal, candidate)) throw new PaymentProofStorageConfigError(storage, root);
  }
  return storage;
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  if (relative === '') return true;
  // path.relative mengembalikan path absolut bila keduanya berada di volume berbeda; itu berarti
  // kandidat tidak mungkin berada di dalam root, jadi bukan pelanggaran.
  if (path.isAbsolute(relative)) return false;
  return !relative.startsWith('..');
}

function realpathOfNearestExisting(target: string): string {
  let current = path.resolve(target);
  for (;;) {
    try {
      return fsSync.realpathSync.native
        ? fsSync.realpathSync.native(current)
        : fsSync.realpathSync(current);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      current = parent;
    }
  }
}

export function paymentProofPathFromUrl(url: unknown, projectRoot = process.cwd()): string | null {
  if (typeof url !== 'string' || !url.startsWith(PAYMENT_PROOF_PREFIX)) return null;
  const filename = url.slice(PAYMENT_PROOF_PREFIX.length);
  if (!SAFE_PAYMENT_PROOF_FILE.test(filename)) return null;
  return path.join(paymentProofStorageDir(projectRoot), filename).replace(/\\/g, '/');
}

type PaymentProofLog = (message: string, error: unknown) => void;

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function moveLegacyProofFile(
  source: string,
  targetDir: string,
  fallbackName: string,
  log: PaymentProofLog,
): Promise<boolean> {
  // Nama tujuan tidak boleh menimpa berkas yang sudah ada; bukti pelanggan tidak boleh hilang.
  let target = path.join(targetDir, fallbackName);
  try {
    await fs.access(target);
    target = path.join(targetDir, 'collision', `${Date.now()}-${fallbackName}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    log(`Nama tujuan sudah terisi, bukti lama disimpan sebagai ${target}`, null);
  } catch {
    // Nama tujuan bebas; lanjut memakai target semula.
  }
  try {
    await fs.rename(source, target);
    return true;
  } catch (error: any) {
    if (error?.code === 'EXDEV') {
      // Volume berbeda; rename tidak mungkin. copyFile lalu unlink; bila unlink gagal, catat.
      try {
        await fs.copyFile(source, target);
      } catch (copyError) {
        log(`Gagal menyalin bukti pembayaran lama: ${source}`, copyError);
        return false;
      }
      try {
        await fs.unlink(source);
      } catch (unlinkError) {
        log(`Salinan ganda tertinggal di ${source} (unlink gagal)`, unlinkError);
      }
      return true;
    }
    log(`Gagal memindahkan bukti pembayaran lama: ${source}`, error);
    return false;
  }
}

async function evacuateDirectory(
  sourceDir: string,
  targetDirRoot: string,
  relativePrefix: string,
  log: PaymentProofLog,
): Promise<{ moved: number; skipped: number }> {
  // Rekursif: subfolder juga berisi bukti pelanggan dan tidak boleh ditinggalkan di dalam root,
  // karena root dilayani sebagai berkas statis.
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(sourceDir, { withFileTypes: true });
  } catch (error) {
    if (!isMissingFile(error)) log(`Gagal membaca folder bukti lama ${sourceDir}`, error);
    return { moved: 0, skipped: 0 };
  }
  let moved = 0;
  let skipped = 0;
  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const relative = relativePrefix ? path.join(relativePrefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      const nested = await evacuateDirectory(source, targetDirRoot, relative, log);
      moved += nested.moved;
      skipped += nested.skipped;
      continue;
    }
    if (!entry.isFile()) {
      // Symlink/FIFO dan sejenisnya tidak dipindahkan, tetapi tidak boleh dianggap sukses.
      log(`Melewati entri non-berkas di folder bukti lama: ${source}`, null);
      skipped += 1;
      continue;
    }
    const targetDir = path.join(targetDirRoot, path.dirname(relative));
    try {
      await fs.mkdir(targetDir, { recursive: true });
    } catch (error) {
      log(`Gagal menyiapkan folder bukti pembayaran ${targetDir}`, error);
      skipped += 1;
      continue;
    }
    if (await moveLegacyProofFile(source, targetDir, entry.name, log)) moved += 1;
    else skipped += 1;
  }
  // Folder sumber dibuang setelah kosong; kalau tidak, folder kosong tetap ada di dalam root dan
  // menyisakan struktur yang bisa dijelajahi.
  try {
    await fs.rmdir(sourceDir);
  } catch {
    // Masih berisi entri yang dilewati; dibiarkan agar tidak menghapus data apa pun.
  }
  return { moved, skipped };
}

export async function evacuateLegacyPaymentProofDirs(
  projectRoot = process.cwd(),
  log: PaymentProofLog = (message, error) => console.error(message, error),
): Promise<number> {
  // Bukti lama pernah ditulis ke public/uploads/payment-proofs, dan Vite menyalin public/ ke dist/,
  // sehingga salinannya juga bisa ada di dist/uploads/payment-proofs. Keduanya dapat disajikan
  // static dan tidak lagi menjadi sumber baca mana pun. SELURUH isi dipindahkan, termasuk subfolder
  // dan berkas dengan nama yang tidak sesuai pola, karena semuanya tetap data pelanggan.
  const roots = [
    path.join(projectRoot, 'public', 'uploads', 'payment-proofs'),
    path.join(projectRoot, 'dist', 'uploads', 'payment-proofs'),
  ];
  let moved = 0;
  let skipped = 0;
  for (const [index, legacyDir] of roots.entries()) {
    const targetDir = index === 0
      ? paymentProofStorageDir(projectRoot)
      : path.join(paymentProofStorageDir(projectRoot), 'recovered');
    const result = await evacuateDirectory(legacyDir, targetDir, '', log);
    moved += result.moved;
    skipped += result.skipped;
  }
  if (moved > 0) log(`Memindahkan ${moved} bukti pembayaran lama ke ${paymentProofStorageDir(projectRoot)}`, null);
  if (skipped > 0) log(`${skipped} entri folder bukti lama TIDAK berhasil dipindahkan dan perlu ditangani manual`, null);
  return moved;
}

export interface PersistPaymentProofReplacementOptions {
  orderId: string;
  previousUrl: string | null;
  nextUrl: string;
  nextPath: string;
  previousPath: string | null;
  buffer: Buffer;
  writeFile: (path: string, buffer: Buffer) => Promise<void>;
  compareAndSwap: (orderId: string, previousUrl: string | null, nextUrl: string) => Promise<boolean>;
  deleteFile: (path: string) => Promise<void>;
  log: PaymentProofLog;
  retryDelayMs?: number;
}

async function deleteOldFileWithRetry(
  filePath: string,
  deleteFile: (path: string) => Promise<void>,
  log: PaymentProofLog,
  retryDelayMs: number,
): Promise<boolean> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await deleteFile(filePath);
      return true;
    } catch (error) {
      if (isMissingFile(error)) return true;
      lastError = error;
      if (attempt < 3 && retryDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  log(`Gagal menghapus file lama bukti pembayaran setelah 3 percobaan: ${filePath}`, lastError);
  return false;
}

async function cleanupNewFile(
  filePath: string,
  deleteFile: (path: string) => Promise<void>,
  log: PaymentProofLog,
): Promise<void> {
  try {
    await deleteFile(filePath);
  } catch (error) {
    if (!isMissingFile(error)) log(`Gagal cleanup file bukti pembayaran baru: ${filePath}`, error);
  }
}

export async function removePaymentProofFile(
  filePath: string,
  log: PaymentProofLog,
  retryDelayMs = 25,
): Promise<boolean> {
  return deleteOldFileWithRetry(filePath, fs.unlink, log, retryDelayMs);
}

export async function persistPaymentProofReplacement(
  options: PersistPaymentProofReplacementOptions,
): Promise<void> {
  let writeAttempted = false;
  try {
    writeAttempted = true;
    await options.writeFile(options.nextPath, options.buffer);
    const replaced = await options.compareAndSwap(
      options.orderId,
      options.previousUrl,
      options.nextUrl,
    );
    if (!replaced) throw new PaymentProofConflictError();
  } catch (error) {
    if (writeAttempted) {
      // Cleanup is best-effort and must never replace the database/write error.
      await cleanupNewFile(options.nextPath, options.deleteFile, options.log);
    }
    throw error;
  }

  if (options.previousPath && options.previousPath !== options.nextPath.replace(/\\/g, '/')) {
    await deleteOldFileWithRetry(
      options.previousPath,
      options.deleteFile,
      options.log,
      options.retryDelayMs ?? 25,
    );
  }
}
