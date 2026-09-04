export type PreorderStatus = 'draft' | 'upcoming' | 'open' | 'closed' | 'service_day';

export interface PreorderWindow {
  is_active: boolean | number;
  order_start_at: string | Date;
  order_deadline_at: string | Date;
  service_at: string | Date;
}

const asTime = (value: string | Date) => new Date(value).getTime();

export interface PreorderRequestItem {
  id: string;
  quantity: number;
}

export function aggregatePreorderItems(items: unknown[]): PreorderRequestItem[] {
  const quantities = new Map<string, number>();
  for (const rawItem of items) {
    const item = rawItem as { id?: unknown; quantity?: unknown };
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    const quantity = Number(item?.quantity);
    if (!id || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Item atau jumlah PO tidak valid');
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }
  return Array.from(quantities, ([id, quantity]) => ({ id, quantity }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getPreorderStatus(campaign: PreorderWindow, now = new Date()): PreorderStatus {
  if (!Boolean(campaign.is_active)) return 'draft';
  const current = now.getTime();
  const start = asTime(campaign.order_start_at);
  const deadline = asTime(campaign.order_deadline_at);
  const service = asTime(campaign.service_at);
  if (current < start) return 'upcoming';
  if (current < deadline) return 'open';
  if (current < service) return 'closed';
  return 'service_day';
}

export function canCancelPreorder(campaign: Pick<PreorderWindow, 'order_deadline_at'>, now = new Date()) {
  return now.getTime() < asTime(campaign.order_deadline_at);
}

export function canMarkPreorderPickedUp(order: { payment_status?: string; preorder_status?: string }) {
  return String(order.payment_status).toLowerCase() === 'lunas'
    && !['cancelled', 'picked_up', 'no_show'].includes(String(order.preorder_status || '').toLowerCase());
}

export function canMarkPreorderNoShow(
  order: { fulfillment_at: string | Date; preorder_status?: string },
  now = new Date()
) {
  return now.getTime() >= asTime(order.fulfillment_at)
    && !['cancelled', 'picked_up', 'no_show'].includes(String(order.preorder_status || '').toLowerCase());
}
