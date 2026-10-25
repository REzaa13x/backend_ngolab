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

export interface SalesAxisScale {
  domain: [number, number];
  ticks: number[];
  maxSales: number;
  width: number;
}

export const MIN_SALES_AXIS_TICK = 50_000;
const DEFAULT_EMPTY_MAX_TICK = 200_000;
const NICE_AXIS_STEPS = [
  50_000,
  100_000,
  200_000,
  250_000,
  500_000,
  1_000_000,
  2_000_000,
  2_500_000,
  5_000_000,
  10_000_000,
  25_000_000,
  50_000_000,
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatRupiah(value: number | string): string {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
  return `Rp ${safe.toLocaleString('id-ID')}`;
}

function chooseNiceStep(maxSales: number): number {
  for (const step of NICE_AXIS_STEPS) {
    if (Math.ceil(maxSales / step) <= 5) {
      return step;
    }
  }
  const roughStep = maxSales / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export function buildSalesAxisScale(values: Array<number | string>): SalesAxisScale {
  const maxSales = values.reduce<number>((highest, current) => {
    const parsed = Number(current);
    return Number.isFinite(parsed) && parsed > highest ? parsed : highest;
  }, 0);

  if (maxSales <= MIN_SALES_AXIS_TICK) {
    const ticks = [50_000, 100_000, 150_000, DEFAULT_EMPTY_MAX_TICK];
    return {
      domain: [0, DEFAULT_EMPTY_MAX_TICK],
      ticks,
      maxSales,
      width: 88,
    };
  }

  if (maxSales <= 100_000) {
    const ticks = [50_000, 75_000, 100_000];
    return {
      domain: [0, 100_000],
      ticks,
      maxSales,
      width: 88,
    };
  }

  const step = chooseNiceStep(maxSales);
  const domainMax = Math.ceil(maxSales / step) * step;
  const minDistanceFromFirst = domainMax * 0.12;
  const ticks: number[] = [MIN_SALES_AXIS_TICK];

  for (let tick = step; tick <= domainMax; tick += step) {
    if (tick <= MIN_SALES_AXIS_TICK) continue;
    if (tick < domainMax && tick - MIN_SALES_AXIS_TICK < minDistanceFromFirst) continue;
    ticks.push(tick);
  }

  if (ticks[ticks.length - 1] !== domainMax) {
    ticks.push(domainMax);
  }

  const longestLabelLength = formatRupiah(domainMax).length;
  const width = Math.max(88, Math.ceil(longestLabelLength * 6.5) + 8);

  return {
    domain: [0, domainMax],
    ticks,
    maxSales,
    width,
  };
}

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
