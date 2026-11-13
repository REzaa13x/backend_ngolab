export type HistoryPeriod = 'semua' | 'hari' | 'minggu' | 'bulan' | 'tahun' | 'rentang';

export interface HistoryRange {
  start: string;
  end: string;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

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

export function shiftDateKey(key: string, days: number): string {
  if (!DATE_KEY.test(key)) return '';
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

// Rentang inklusif dalam tanggal WIB. Mingguan memakai Senin–Minggu, sama dengan
// matchesHistoryPeriod versi sebelumnya, supaya angka lama tidak bergeser.
export function historyPeriodRange(period: HistoryPeriod, selectedDate: string, endDate?: string): HistoryRange | null {
  if (period === 'semua') return null;
  if (!DATE_KEY.test(selectedDate)) return null;
  if (period === 'hari') return { start: selectedDate, end: selectedDate };
  if (period === 'tahun') return { start: `${selectedDate.slice(0, 4)}-01-01`, end: `${selectedDate.slice(0, 4)}-12-31` };
  if (period === 'bulan') {
    const year = Number(selectedDate.slice(0, 4));
    const month = Number(selectedDate.slice(5, 7));
    return { start: `${selectedDate.slice(0, 7)}-01`, end: lastDayOfMonth(year, month) };
  }
  if (period === 'rentang') {
    if (!endDate || !DATE_KEY.test(endDate)) return null;
    // Terima pilihan terbalik tanpa error: tanggal awal selalu yang lebih kecil.
    return selectedDate <= endDate ? { start: selectedDate, end: endDate } : { start: endDate, end: selectedDate };
  }
  const day = new Date(`${selectedDate}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return null;
  const start = shiftDateKey(selectedDate, -((day.getUTCDay() + 6) % 7));
  if (!start) return null;
  return { start, end: shiftDateKey(start, 6) };
}

export function matchesHistoryPeriod(value: string, period: HistoryPeriod, selectedDate: string, endDate?: string): boolean {
  if (period === 'semua') return true;
  const range = historyPeriodRange(period, selectedDate, endDate);
  if (!range) return false;
  const key = wibDateKey(value);
  return Boolean(key) && key >= range.start && key <= range.end;
}

export function formatWibDateKey(key: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
  if (!DATE_KEY.test(key)) return 'Tanggal tidak valid';
  const date = new Date(`${key}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? 'Tanggal tidak valid' : date.toLocaleDateString('id-ID', { ...options, timeZone: 'Asia/Jakarta' });
}

// Label dipakai di layar dan di judul ekspor, jadi harus menyebut tanggal
// sebenarnya — bukan hanya nama periode — supaya tidak ambigu.
export function historyPeriodLabel(period: HistoryPeriod, selectedDate: string, endDate?: string): string {
  if (period === 'semua') return 'Semua Periode';
  const range = historyPeriodRange(period, selectedDate, endDate);
  if (!range) return 'Periode tidak valid';
  const name = period === 'hari' ? 'Harian' : period === 'minggu' ? 'Mingguan' : period === 'bulan' ? 'Bulanan' : period === 'tahun' ? 'Tahunan' : 'Rentang';
  const rangeText = range.start === range.end
    ? formatWibDateKey(range.start)
    : `${formatWibDateKey(range.start)} – ${formatWibDateKey(range.end)}`;
  return `${name} (${rangeText})`;
}

export function historyPeriodDayCount(period: HistoryPeriod, selectedDate: string, endDate?: string): number {
  const range = historyPeriodRange(period, selectedDate, endDate);
  if (!range) return 0;
  const start = new Date(`${range.start}T00:00:00Z`).getTime();
  const end = new Date(`${range.end}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000) + 1;
}
