export interface OrderSummaryRow {
  total_price: number | string;
  payment_status: string;
}

export interface MonthlyRow {
  month_num: number | string;
  sales: number | string;
  orders: number | string;
  verified: number | string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function calculateReportSummary(orders: OrderSummaryRow[]) {
  const paidOrders = orders.filter(order => order.payment_status === 'lunas');
  const totalSales = paidOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);

  return {
    totalSales,
    pendingPayments: orders.filter(order => order.payment_status === 'pending_verifikasi').length,
    totalOrders: orders.length,
    averageOrderValue: paidOrders.length > 0 ? totalSales / paidOrders.length : 0,
  };
}

export function buildMonthlyData(rows: MonthlyRow[]) {
  return MONTH_NAMES.map((name, index) => {
    const row = rows.find(item => Number(item.month_num) === index + 1);
    return {
      name,
      sales: row ? Number(row.sales) : 0,
      orders: row ? Number(row.orders) : 0,
      verified: row ? Number(row.verified) : 0,
    };
  });
}
