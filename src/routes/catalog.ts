import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { requireRoles } from '../middleware/authSession.js';

const router = Router();
router.use(requireRoles('Super Admin', 'Kasir', 'Koki'));
const SMART_TAG_API = (process.env.SMART_TAG_API_URL || 'https://smarttag.ngolab.online').replace(/\/$/, '');
const SMART_TAG_HEADERS = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 Tangolab-Ngolab-Integration' };

async function fetchExternalMenus() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${SMART_TAG_API}/api/menu`, { signal: controller.signal, headers: SMART_TAG_HEADERS });
    if (!response.ok) return [];
    const data: any = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

router.get('/products', async (_req: Request, res: Response) => {
  try {
    const [localMenus]: any = await db.query('SELECT id, name FROM menus');
    const externalMenus = await fetchExternalMenus();
    const products = new Map<string, string>();
    localMenus.forEach((item: any) => products.set(String(item.id), item.name));
    externalMenus.forEach((item: any) => products.set(String(item.id), item.name));
    res.json(Array.from(products, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mengambil katalog produk', error: err.message });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const standard = ['Main Course', 'Beverage', 'Snack', 'Ready Meal', 'Makanan Ringan', 'Es Krim', 'Minuman Siap Saji'];
    const [local]: any = await db.query("SELECT DISTINCT category AS name FROM menus WHERE category IS NOT NULL AND category != ''");
    const external = await fetchExternalMenus();
    const categories = new Set<string>(standard);
    local.forEach((item: any) => item.name && categories.add(item.name.trim()));
    external.forEach((item: any) => item.category && categories.add(String(item.category).trim()));
    res.json(Array.from(categories).filter(Boolean).sort().map((name, index) => ({ id: `cat-${index + 1}`, name })));
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mengambil kategori', error: err.message });
  }
});

export default router;
