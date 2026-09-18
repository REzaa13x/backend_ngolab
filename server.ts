import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { db, testDbConnection } from './src/db/db.js';
import digitalBoardRouter from './src/routes/digitalBoard.js';
import ordersRouter from './src/routes/orders.js';
import orderSimulationRouter from './src/routes/orderSimulation.js';
import usersRouter from './src/routes/users.js';
import coinPromosRouter from './src/routes/coinPromos.js';
import authRouter from './src/routes/auth.js';
import staffRouter from './src/routes/staff.js';
import menuRouter from './src/routes/menu.js';
import shiftsRouter from './src/routes/shifts.js';
import auditLogsRouter from './src/routes/auditLogs.js';
import settingsRouter from './src/routes/settings.js';
import leaderboardRouter from './src/routes/leaderboard.js';
import crowdfundingRouter from './src/routes/crowdfunding.js';
import analyticsRouter from './src/routes/analytics.js';
import ingredientsRouter from './src/routes/ingredients.js';
import catalogRouter from './src/routes/catalog.js';
import kioskRouter from './src/routes/kiosk.js';
import promotionsRouter from './src/routes/promotions.js';
import preordersRouter from './src/routes/preorders.js';
import apiKeysRouter from './src/routes/apiKeys.js';
import { authenticateAuthorization, getAuthTokenSecret, isRoleAllowed } from './src/lib/authToken.js';
import { lookupCurrentIdentity, requireRoles, AuthenticatedRequest } from './src/middleware/authSession.js';
import { assertPaymentProofStorageOutsideRoot, evacuateLegacyPaymentProofDirs, isPublicUploadPath, isSafePaymentProofFilename, isUploadsRequestPath, normalizeRequestPath, paymentProofPathFromUrl } from './src/lib/paymentProof.js';
import { createRateLimit } from './src/middleware/rateLimit.js';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
        : false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
  });
  const port = Number(process.env.PORT || 3000);
  const configuredOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  const corsOrigin = configuredOrigins.length
    ? (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
        if (!origin || configuredOrigins.includes(origin)) callback(null, true);
        else callback(new Error('Origin tidak diizinkan'));
      }
    : false;

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '20mb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'tangolab', environment: process.env.NODE_ENV || 'development' }));
  app.get('/uploads/payment-proofs/:filename', requireRoles('Super Admin', 'Kasir'), async (req, res) => {
    const rawFilename = String(req.params.filename || '');
    // Nama berkas harus cocok pola bukti yang kita tulis sendiri. Ditolak lebih awal, sebelum
    // kueri database, agar parameter seperti '../<dir>/x.png' tidak pernah dianggap berkas bukti.
    if (!isSafePaymentProofFilename(rawFilename)) {
      return res.status(404).json({ message: 'Bukti pembayaran tidak ditemukan.' });
    }
    // URL publik dibentuk apa adanya (nama berkas bukti memakai randomUUID dengan huruf besar),
    // sehingga kueri referensi membandingkan nilai yang sama persis dengan yang tersimpan.
    const publicUrl = `/uploads/payment-proofs/${rawFilename}`;
    const proofPath = paymentProofPathFromUrl(publicUrl);
    if (!proofPath) return res.status(404).json({ message: 'Bukti pembayaran tidak ditemukan.' });
    // Otorisasi berbasis referensi hidup: file yatim (hasil replace/hapus yang gagal) tidak boleh
    // tetap dapat diunduh meski staf punya token yang sah. Dua uji kesamaan (bukan COALESCE) supaya
    // indeks dipakai dan kolom warisan mana pun yang menyimpan URL ini tetap dikenali.
    let referenced: any[] = [];
    try {
      const [rows]: any = await db.query(
        `SELECT payment_status FROM orders
         WHERE payment_proof_url = ? OR payment_proof = ?
         LIMIT 1`,
        [publicUrl, publicUrl],
      );
      referenced = rows;
    } catch (error: any) {
      if (error?.code === 'ER_BAD_FIELD_ERROR') {
        // Kolom payment_proof belum ada; URL ini berasal dari kolom payment_proof_url.
        try {
          const [rows]: any = await db.query(
            'SELECT payment_status FROM orders WHERE payment_proof_url = ? LIMIT 1',
            [publicUrl],
          );
          referenced = rows;
        } catch (fallbackError) {
          console.error('Gagal memverifikasi referensi bukti pembayaran', fallbackError);
          return res.status(503).json({ message: 'Bukti pembayaran tidak dapat diverifikasi saat ini.' });
        }
      } else {
        console.error('Gagal memverifikasi referensi bukti pembayaran', error);
        return res.status(503).json({ message: 'Bukti pembayaran tidak dapat diverifikasi saat ini.' });
      }
    }
    if (!referenced.length) return res.status(404).json({ message: 'Bukti pembayaran tidak ditemukan.' });
    // Route ini sudah dibatasi requireRoles('Super Admin','Kasir'); pemeriksaan berikut hanya
    // pertahanan berlapis bila daftar peran diubah tanpa memperbarui kebijakan privasi bukti.
    const viewer = (req as AuthenticatedRequest).auth;
    const isPaymentStaff = isRoleAllowed(
      { id: viewer?.id ?? '', name: viewer?.name ?? '', role: viewer?.role ?? '' },
      ['Super Admin', 'Kasir'],
    );
    if (!isPaymentStaff && String(referenced[0].payment_status || '').toLowerCase() !== 'lunas') {
      return res.status(403).json({ message: 'Bukti pembayaran belum lunas.' });
    }
    res.sendFile(proofPath, error => {
      if (error && !res.headersSent) res.status(404).json({ message: 'Bukti pembayaran tidak ditemukan.' });
    });
  });
  // Satu gate app-level berbasis path TERNORMALISASI, dipasang sebelum semua static/Vite/SPA.
  // Wajib app-level (bukan app.use('/uploads')) karena Express mencocokkan prefix terhadap path
  // mentah: '/uploads%2F...', '//uploads/...', '/./uploads/...', '/uploads\...' melewati gate
  // ber-prefix lalu didekode oleh static di belakangnya.
  app.use((req, res, next) => {
    const normalized = normalizeRequestPath(req.url);
    if (isUploadsRequestPath(normalized)) {
      if (!isPublicUploadPath(normalized)) {
        return res.status(404).json({ message: 'Berkas tidak ditemukan.' });
      }
    }
    next();
  });
  const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');
  app.use((req, res, next) => {
    const normalized = normalizeRequestPath(req.url);
    if (normalized === null || !isUploadsRequestPath(normalized)) return next();
    // Path yang dilayani adalah versi TERNORMALISASI tanpa prefiks mount, karena express.static
    // menyelesaikan berkas relatif terhadap akar yang diberikan. req.url WAJIB dipulihkan sebelum
    // diteruskan: membiarkan nilai turunan path akan menyambungkan ulang permintaan ke handler
    // hilir (mis. '/uploads/../<dirBukti>/x.png' sampai ke route bukti, atau '/uploads/../api/...').
    const originalUrl = req.url;
    req.url = normalized.slice('/uploads'.length);
    express.static(uploadsRoot)(req, res, error => {
      req.url = originalUrl;
      if (error) return next(error);
      res.status(404).json({ message: 'Berkas tidak ditemukan.' });
    });
  });
  app.set('io', io);
  const authRateLimit = createRateLimit(60_000, 20);
  const externalRateLimit = createRateLimit(60_000, 120);

  const authTokenSecret = getAuthTokenSecret();
  io.use(async (socket, next) => {
    try {
      const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
      const tokenIdentity = authenticateAuthorization(token ? `Bearer ${token}` : undefined, { secret: authTokenSecret });
      const identity = tokenIdentity ? await lookupCurrentIdentity(tokenIdentity) : null;
      if (!identity || !isRoleAllowed(identity, ['Super Admin', 'Kasir', 'Koki'])) {
        return next(new Error('Sesi Socket.io staf tidak valid'));
      }
      socket.data.auth = identity;
      next();
    } catch {
      next(new Error('Autentikasi Socket.io tidak tersedia'));
    }
  });

  await testDbConnection();
  // Gagal tertutup: konfigurasi folder bukti yang tidak aman harus menghentikan layanan.
  assertPaymentProofStorageOutsideRoot();
  await evacuateLegacyPaymentProofDirs();

  io.on('connection', socket => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
  });

  const releaseDuePreorders = async () => {
    try {
      const [campaigns]: any = await db.query(
        `SELECT p.id, p.name, p.outlet, p.service_at FROM preorder_campaigns p
         WHERE p.is_active = 1 AND p.service_at <= NOW() AND p.kds_released_at IS NULL
           AND EXISTS (
             SELECT 1 FROM orders o
             WHERE o.preorder_campaign_id = p.id
               AND LOWER(o.status) IN ('menunggu', 'sedang_diproses', 'siap')
           )`
      );
      for (const campaign of campaigns) {
        const [result]: any = await db.query(
          'UPDATE preorder_campaigns SET kds_released_at = NOW() WHERE id = ? AND kds_released_at IS NULL',
          [campaign.id]
        );
        if (result.affectedRows) io.emit('preorder_due', campaign);
      }
    } catch (error) {
      console.error('Pre-order release scheduler failed:', error);
    }
  };
  await releaseDuePreorders();
  const preorderTimer = setInterval(releaseDuePreorders, 30_000);
  preorderTimer.unref();

  // API routes. Routers with specific endpoints are mounted before generic routers.
  app.use('/api/auth', authRateLimit, authRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/shifts', shiftsRouter);
  app.use('/api/audit-logs', auditLogsRouter);
  app.use('/api/orders', orderSimulationRouter);
  app.use('/api/orders', externalRateLimit, ordersRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/coin-promos', coinPromosRouter);
  app.use('/api/menu', menuRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/patungan-rooms', crowdfundingRouter);
  app.use('/api/digital-board', digitalBoardRouter);
  app.use('/api/promotions', promotionsRouter);
  app.use('/api/preorders', preordersRouter);
  app.use('/api/api-keys', apiKeysRouter);
  app.use('/api/ingredients', ingredientsRouter);
  app.use('/api/admin/catalog', catalogRouter);
  app.use('/api/v1', kioskRouter);
  app.use('/api', analyticsRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Endpoint API tidak ditemukan' });
  });

  // Folder bukti pembayaran berada di LUAR root proyek (lihat assertPaymentProofStorageOutsideRoot),
  // jadi express.static maupun static bawaan Vite dev tidak dapat menjangkaunya. Daftar dir yang
  // tidak boleh dilayani di bawah ini murni lapisan kedua. '/src' SENGAJA tidak ada di daftar: Vite
  // dev menyajikan modul aplikasi dari sana, dan menutupnya membuat halaman dev kosong.
  // Direktori internal tidak boleh dilayani. Dibandingkan pada path TERNORMALISASI, karena denylist
  // ber-prefix mentah dapat dilewati bentuk terkode ('/dist%2F...', '//dist/...') yang kemudian
  // didekode oleh static di belakangnya.
  const DENIED_PREFIXES = ['/storage', '/dist', '/migrations', '/backups', '/releases', '/scripts'];
  app.use((req, res, next) => {
    const normalized = normalizeRequestPath(req.url);
    if (normalized === null) return res.status(404).json({ message: 'Berkas tidak ditemukan.' });
    // Dibandingkan tanpa memandang huruf: pada filesystem yang tidak peka huruf (Windows/macOS)
    // express.static menyelesaikan '/DIST/...' ke direktori aslinya, sehingga denylist yang peka
    // huruf akan dilewati begitu saja.
    const lowered = normalized.toLowerCase();
    const denied = DENIED_PREFIXES.some(prefix => lowered === prefix || lowered.startsWith(`${prefix}/`));
    if (denied) return res.status(404).json({ message: 'Berkas tidak ditemukan.' });
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback mengecualikan /uploads (termasuk bentuk terkode, karena dinormalisasi).
    app.get('*', (req, res, next) => {
      const normalized = normalizeRequestPath(req.path);
      if (isUploadsRequestPath(normalized)) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Penutup terakhir: apa pun di bawah /uploads yang lolos sampai sini ditolak, sehingga berkas
  // hilang, alias nama pendek, dan traversal tidak pernah jatuh ke fallback SPA (HTTP 200 HTML).
  app.use((req, res, next) => {
    const normalized = normalizeRequestPath(req.url);
    if (isUploadsRequestPath(normalized)) {
      return res.status(404).json({ message: 'Berkas tidak ditemukan.' });
    }
    next();
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer().catch(error => {
  console.error('Server startup failed:', error);
  process.exitCode = 1;
});
