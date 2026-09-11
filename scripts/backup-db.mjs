import 'dotenv/config';
import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} wajib diisi sebelum backup`);
}
if (!process.env.DB_PASSWORD) console.warn('Peringatan: DB_PASSWORD kosong.');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = process.env.DB_BACKUP_DIR || 'backups';
mkdirSync(outputDir, { recursive: true });
const output = `${outputDir}/gesture_eats-${stamp}.sql`;
const args = [
  `--host=${process.env.DB_HOST}`,
  `--port=${process.env.DB_PORT || '3306'}`,
  `--user=${process.env.DB_USER}`,
  '--single-transaction',
  '--routines',
  '--events',
  process.env.DB_NAME,
];
const env = { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' };
await execFileAsync('mysqldump', [...args, '--result-file', output], { env, windowsHide: true });
console.log(`Database backup dibuat: ${output}`);
