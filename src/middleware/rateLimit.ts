import { NextFunction, Request, Response } from 'express';

interface Bucket {
  startedAt: number;
  count: number;
}

export function createRateLimit(windowMs: number, max: number) {
  const buckets = new Map<string, Bucket>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = buckets.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.ceil((windowMs - (now - current.startedAt)) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ message: 'Terlalu banyak permintaan. Coba lagi nanti.' });
    }
    return next();
  };
}
