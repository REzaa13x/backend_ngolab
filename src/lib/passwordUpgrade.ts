import { db } from '../db/db.js';
import { hashPassword } from './password.js';

export async function upgradeLegacyPassword(table: 'users' | 'staff', id: string, password: string): Promise<void> {
  try {
    const hash = await hashPassword(password);
    await db.query(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [hash, id]);
  } catch (error: any) {
    // Upgrade bersifat best-effort; kredensial yang sudah valid tidak boleh gagal login.
    console.warn(`⚠️ Password hash upgrade skipped for ${table}:${id}:`, error.message);
  }
}
