import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();

const MASTER_API_KEY = process.env.EXTERNAL_API_KEY || 'tangolab-secret-key-2026';

export const authApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ message: 'Akses ditolak. API Key tidak ditemukan.' });
  }

  if (apiKey !== MASTER_API_KEY) {
    return res.status(403).json({ message: 'Akses ditolak. API Key tidak valid.' });
  }

  next();
};
