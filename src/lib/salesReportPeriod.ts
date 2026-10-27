import { reportDateInJakarta } from './reporting';

export type SelectedReportPeriod = 'day' | 'month' | 'year';

export function matchesReportPeriod(createdAt: string, period: SelectedReportPeriod, selection: string): boolean {
  const date = reportDateInJakarta(createdAt);
  return selection !== '' && (period === 'day' ? date : period === 'month' ? date.slice(0, 7) : date.slice(0, 4)) === selection;
}

export function reportPeriodLabel(period: SelectedReportPeriod, selection: string): string {
  const label = period === 'day' ? 'Tanggal' : period === 'month' ? 'Bulan' : 'Tahun';
  return `${label} ${selection} WIB`;
}
