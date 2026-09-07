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
import { authenticateAuthorization, getAuthTokenSecret, isRoleAllowed } from './src/lib/authToken.js';
import { lookupCurrentIdentity } from './src/middleware/authSession.js';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
  });
  const port = Number(process.env.PORT || 3000);

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
  app.set('io', io);

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
  app.use('/api/auth', authRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/shifts', shiftsRouter);
  app.use('/api/audit-logs', auditLogsRouter);
  app.use('/api/orders', orderSimulationRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/coin-promos', coinPromosRouter);
  app.use('/api/menu', menuRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/patungan-rooms', crowdfundingRouter);
  app.use('/api/digital-board', digitalBoardRouter);
  app.use('/api/promotions', promotionsRouter);
  app.use('/api/preorders', preordersRouter);
  app.use('/api/ingredients', ingredientsRouter);
  app.use('/api/admin/catalog', catalogRouter);
  app.use('/api/v1', kioskRouter);
  app.use('/api', analyticsRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer().catch(error => {
  console.error('Server startup failed:', error);
  process.exitCode = 1;
});
