import path from 'path';
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

export function paymentProofPublicUrl(filename: string): string {
  return `${PAYMENT_PROOF_PREFIX}${filename}`;
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

export function paymentProofPathFromUrl(url: unknown, projectRoot = process.cwd()): string | null {
  if (typeof url !== 'string' || !url.startsWith(PAYMENT_PROOF_PREFIX)) return null;
  const filename = url.slice(PAYMENT_PROOF_PREFIX.length);
  if (!SAFE_PAYMENT_PROOF_FILE.test(filename)) return null;
  return path.join(projectRoot, 'public', 'uploads', 'payment-proofs', filename).replace(/\\/g, '/');
}

type PaymentProofLog = (message: string, error: unknown) => void;

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

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function deleteOldFileWithRetry(
  filePath: string,
  deleteFile: (path: string) => Promise<void>,
  log: PaymentProofLog,
  retryDelayMs: number,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await deleteFile(filePath);
      return;
    } catch (error) {
      if (isMissingFile(error)) return;
      lastError = error;
      if (attempt < 3 && retryDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  log(`Gagal menghapus file lama bukti pembayaran setelah 3 percobaan: ${filePath}`, lastError);
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
