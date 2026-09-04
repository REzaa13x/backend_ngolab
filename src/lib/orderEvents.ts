export type OrderEventHandler = (payload: any) => void;
export type OrderBellType = 'new_order' | 'ready' | null;
export type OrderEventName = 'new_order' | 'order_updated';

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
  const paymentStatus = String(order.payment_status || '').trim().toLowerCase();
  const status = String(order.status || '').trim().toLowerCase();
  const orderType = String(order.order_type || 'regular').trim().toLowerCase();

  if (event === 'order_updated' && status === 'siap') return 'ready';
  // PO enters the kitchen through the dedicated preorder_due scheduler event.
  if (orderType === 'preorder') return null;
  if (event === 'new_order' && paymentStatus === 'lunas') return 'new_order';
  if (event === 'order_updated' && paymentStatus === 'lunas' && status === 'menunggu') {
    return 'new_order';
  }
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
