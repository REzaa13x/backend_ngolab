import { Router, Request, Response } from 'express';
import { db, addAuditLog } from '../db/db.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      'SELECT id, name, unit, stock, min_stock AS minStock FROM ingredients ORDER BY name ASC'
    );
    res.json(rows.map((row: any) => ({ ...row, stock: Number(row.stock), minStock: Number(row.minStock) })));
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal mengambil stok bahan', error: err.message });
  }
});

router.get('/yield', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(`
      SELECT ri.menu_name AS name,
             FLOOR(MIN(i.stock / NULLIF(ri.amount, 0))) AS yield
      FROM recipe_ingredients ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      GROUP BY ri.menu_name
      ORDER BY ri.menu_name ASC
    `);
    res.json(rows.map((row: any) => ({ name: row.name, yield: Number(row.yield || 0) })));
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal menghitung yield bahan', error: err.message });
  }
});

router.post('/:id/restock', async (req: Request, res: Response) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Jumlah restock harus lebih dari 0' });
    }

    const [result]: any = await db.query('UPDATE ingredients SET stock = stock + ? WHERE id = ?', [amount, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Ingredient not found' });

    const [rows]: any = await db.query(
      'SELECT id, name, unit, stock, min_stock AS minStock FROM ingredients WHERE id = ?',
      [req.params.id]
    );
    const ingredient = { ...rows[0], stock: Number(rows[0].stock), minStock: Number(rows[0].minStock) };
    const actor = (req.headers['x-user-name'] as string) || 'Koki';
    await addAuditLog(actor, 'Restock Bahan Baku', `${ingredient.name} (+${amount} ${ingredient.unit})`);
    res.json(ingredient);
  } catch (err: any) {
    res.status(500).json({ message: 'Gagal restock bahan', error: err.message });
  }
});

export default router;
