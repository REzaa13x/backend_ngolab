// UNIX_TIMESTAMP(TIMESTAMP) is an instant independent of the MySQL session timezone.
// Keep DATETIME fields untouched: they represent application wall-clock values.
export function normalizeOrderCreatedAt<T extends { created_at: unknown; created_at_epoch?: unknown }>(row: T): T {
  const { created_at_epoch, ...rest } = row;
  if (created_at_epoch == null) return rest as T;
  const date = new Date(Number(created_at_epoch) * 1000);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid order created_at epoch');
  return { ...rest, created_at: date.toISOString() } as T;
}
