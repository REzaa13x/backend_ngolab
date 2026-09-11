import { Router, Response } from 'express';
import { db, addAuditLog } from '../db/db.js';
import { prepareApiKeyCredential, parseStoredScopes } from '../lib/apiKeys.js';
import { verifyPassword } from '../lib/password.js';
import {
  AuthenticatedRequest,
  getVerifiedActor,
  requireRoles
} from '../middleware/authSession.js';

const router = Router();
const requireSuperAdmin = requireRoles('Super Admin');

async function verifyCurrentAdminPassword(req: AuthenticatedRequest, password: unknown) {
  if (typeof password !== 'string' || !password) return false;
  const [rows]: any = await db.query(
    "SELECT password_hash FROM staff WHERE id = ? AND role = 'Super Admin' AND status = 'active' LIMIT 1",
    [req.auth?.id]
  );
  return rows.length > 0 && verifyPassword(password, rows[0].password_hash);
}

function publicKeyRow(row: any) {
  return {
    id: Number(row.id),
    name: String(row.name),
    key_prefix: String(row.key_prefix),
    masked_key: `${row.key_prefix}••••••••••••`,
    scopes: parseStoredScopes(row.scopes),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    last_used_at: row.last_used_at,
    revoked_at: row.revoked_at
  };
}

router.get('/', requireSuperAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows]: any = await db.query(
      `SELECT id, name, key_prefix, scopes, is_active, created_at, last_used_at, revoked_at
       FROM api_keys
       ORDER BY created_at DESC`
    );
    res.json(rows.map(publicKeyRow));
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mengambil daftar API Key', error: error.message });
  }
});

router.post('/', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifyCurrentAdminPassword(req, req.body.password))) {
      return res.status(401).json({ message: 'Password Super Admin tidak valid.' });
    }

    const credential = prepareApiKeyCredential(req.body.name, req.body.scopes);
    const [result]: any = await db.query(
      `INSERT INTO api_keys (name, key_prefix, key_hash, scopes, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        credential.record.name,
        credential.record.keyPrefix,
        credential.record.keyHash,
        credential.record.scopes,
        req.auth!.id
      ]
    );
    const actor = getVerifiedActor(req);
    await addAuditLog(actor, 'Buat API Key', credential.record.name, 'success', req.ip);

    res.status(201).json({
      message: 'API Key berhasil dibuat. Salin sekarang karena key lengkap tidak akan ditampilkan lagi.',
      api_key: credential.secret,
      key: publicKeyRow({
        id: result.insertId,
        name: credential.record.name,
        key_prefix: credential.record.keyPrefix,
        scopes: credential.record.scopes,
        is_active: 1,
        created_at: new Date(),
        last_used_at: null,
        revoked_at: null
      })
    });
  } catch (error: any) {
    const isValidation = /Nama integrasi|izin API/.test(error.message);
    res.status(isValidation ? 400 : 500).json({
      message: isValidation ? error.message : 'Gagal membuat API Key',
      ...(isValidation ? {} : { error: error.message })
    });
  }
});

router.post('/:id/regenerate', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifyCurrentAdminPassword(req, req.body.password))) {
      return res.status(401).json({ message: 'Password Super Admin tidak valid.' });
    }

    const [rows]: any = await db.query(
      'SELECT id, name, scopes FROM api_keys WHERE id = ? AND is_active = 1 LIMIT 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'API Key aktif tidak ditemukan.' });

    const credential = prepareApiKeyCredential(rows[0].name, parseStoredScopes(rows[0].scopes));
    await db.query(
      `UPDATE api_keys
       SET key_prefix = ?, key_hash = ?, last_used_at = NULL
       WHERE id = ?`,
      [credential.record.keyPrefix, credential.record.keyHash, req.params.id]
    );
    await addAuditLog(getVerifiedActor(req), 'Regenerasi API Key', rows[0].name, 'warning', req.ip);

    res.json({
      message: 'API Key berhasil diregenerasi. Key sebelumnya langsung tidak berlaku.',
      api_key: credential.secret,
      key_prefix: credential.record.keyPrefix
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal meregenerasi API Key', error: error.message });
  }
});

router.post('/:id/revoke', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!(await verifyCurrentAdminPassword(req, req.body.password))) {
      return res.status(401).json({ message: 'Password Super Admin tidak valid.' });
    }

    const [rows]: any = await db.query(
      'SELECT id, name FROM api_keys WHERE id = ? AND is_active = 1 LIMIT 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'API Key aktif tidak ditemukan.' });

    await db.query(
      'UPDATE api_keys SET is_active = 0, revoked_at = NOW() WHERE id = ?',
      [req.params.id]
    );
    await addAuditLog(getVerifiedActor(req), 'Cabut API Key', rows[0].name, 'warning', req.ip);
    res.json({ message: 'API Key berhasil dicabut dan tidak dapat digunakan lagi.' });
  } catch (error: any) {
    res.status(500).json({ message: 'Gagal mencabut API Key', error: error.message });
  }
});

export default router;
