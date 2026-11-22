// Bounds covering all of Japan from Okinawa (Yonaguni/Ishigaki) to Hokkaido (Wakkanai/Shiretoko)
export const JAPAN_MAX_BOUNDS: [[number, number], [number, number]] = [
  [121.5, 22.5],
  [147.5, 46.8],
];

export const JAPAN_INITIAL_BOUNDS: [[number, number], [number, number]] = [
  [123.5, 24.0],
  [145.9, 45.6],
];

export const JAPAN_CENTER: [number, number] = [136.8, 35.8];

export function isInsideJapan(lat: number, lng: number): boolean {
  return lat >= 23.5 && lat <= 46.0 && lng >= 122.5 && lng <= 146.5;
}

/** Generate inclusive YYYY-MM-DD array between startDate and endDate (capped at 120 days for UI sanity). */
export function getTripDays(startDate: string, endDate: string): string[] {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  if (!start || !end || end < start) return [startDate];

  const days: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end && days.length < 120) {
    days.push(toISODate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days.length > 0 ? days : [startDate];
}

export function parseISODate(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatFrenchDate(dateStr: string, withYear = false): string {
  const d = parseISODate(dateStr);
  if (!d) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(d);
}

export function formatDateTimeFr(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
