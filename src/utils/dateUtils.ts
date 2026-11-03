const MONTHS_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function getLocalTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateShortBR(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, monthStr, day] = parts;
  const monthIdx = Number(monthStr) - 1;
  const monthLabel = MONTHS_SHORT_PT[monthIdx] ?? monthStr;
  return `${day} ${monthLabel} ${year}`;
}

export function formatDateParts(isoDate: string): {
  day: string;
  month: string;
  year: string;
} {
  const parts = isoDate.split('-');
  if (parts.length !== 3) {
    return { day: '--', month: '---', year: '----' };
  }
  const [year, monthStr, day] = parts;
  const monthIdx = Number(monthStr) - 1;
  return {
    day,
    month: (MONTHS_SHORT_PT[monthIdx] ?? monthStr).toUpperCase(),
    year,
  };
}

export function isoToSetlistFmDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

export function setlistFmDateToIso(sfmDate: string): string {
  const parts = sfmDate.split('-');
  if (parts.length !== 3) return sfmDate;
  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
}

export function isFutureDate(eventDate: string, referenceDate: string): boolean {
  return eventDate > referenceDate;
}

export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
