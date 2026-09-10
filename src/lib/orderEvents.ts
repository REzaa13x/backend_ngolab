export type OrderEventHandler = (payload: any) => void;
export type OrderBellType = 'new_order' | 'ready' | null;
export type OrderEventName = 'new_order' | 'order_updated';

export function createOrderBellDeduper(maxEntries = 1000) {
  const seen = new Set<string>();
  const order: string[] = [];
  return {
    shouldRing(type: Exclude<OrderBellType, null>, id: string | number) {
      const key = `${type}:${id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      order.push(key);
      while (order.length > maxEntries) {
        const oldest = order.shift();
        if (oldest) seen.delete(oldest);
      }
      return true;
    }
  };
}

interface OrderEventPayload {
  id?: string | number;
  payment_status?: string;
  status?: string;
  order_type?: string;
  fulfillment_at?: string | Date;
}

/** Decide which sound an order event should produce using normalized DB values. */
export function getOrderBellType(
  event: OrderEventName,
  order: OrderEventPayload
): OrderBellType {
  const status = String(order.status || '').trim().toLowerCase();
  const orderType = String(order.order_type || 'regular').trim().toLowerCase();

  if (event === 'order_updated' && status === 'siap') return 'ready';
  // PO enters the kitchen through the dedicated preorder_due scheduler event.
  if (orderType === 'preorder') return null;
  // Every regular order enters KDS immediately, regardless of payment status.
  // Later payment updates must not ring again for the same order.
  if (event === 'new_order') return 'new_order';
  return null;
}

interface OrderEventSocket {
  on(event: 'new_order' | 'order_updated', handler: OrderEventHandler): unknown;
  off(event: 'new_order' | 'order_updated', handler: OrderEventHandler): unknown;
}

interface OrderEventHandlers {
  onNewOrder: OrderEventHandler;
  onOrderUpdated: OrderEventHandler;
}

/**
 * Subscribe to realtime order events without allowing one component's cleanup
 * to remove listeners registered by another component.
 */
export function subscribeToOrderEvents(
  socket: OrderEventSocket,
  { onNewOrder, onOrderUpdated }: OrderEventHandlers
) {
  socket.on('new_order', onNewOrder);
  socket.on('order_updated', onOrderUpdated);

  return () => {
    socket.off('new_order', onNewOrder);
    socket.off('order_updated', onOrderUpdated);
  };
}
