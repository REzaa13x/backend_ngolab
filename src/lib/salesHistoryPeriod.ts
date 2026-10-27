export type HistoryPeriod = 'semua' | 'hari' | 'minggu' | 'bulan';

export function parseHistoryTimestamp(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00', second = '00', fraction = '', zone] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${zone || '+07:00'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatWibTimestamp(value: string | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' }): string {
  const date = typeof value === 'string' ? parseHistoryTimestamp(value) : value;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('id-ID', { ...options, timeZone: 'Asia/Jakarta' }) : 'Tanggal tidak valid';
}

export function wibDateKey(value: string | Date): string {
  const date = typeof value === 'string' ? parseHistoryTimestamp(value) : value;
  if (!date) return '';
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (name: string) => parts.find(part => part.type === name)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function matchesHistoryPeriod(value: string, period: HistoryPeriod, selectedDate: string): boolean {
  if (period === 'semua') return true;
  const key = wibDateKey(value);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return false;
  if (period === 'hari') return key === selectedDate;
  if (period === 'bulan') return key.slice(0, 7) === selectedDate.slice(0, 7);
  const selected = new Date(`${selectedDate}T00:00:00Z`);
  const start = new Date(selected);
  start.setUTCDate(selected.getUTCDate() - (selected.getUTCDay() + 6) % 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return key >= start.toISOString().slice(0, 10) && key < end.toISOString().slice(0, 10);
}
