export function text(value: unknown, fallback = '—'): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

// Keep decimal strings exact. No multiplication by unitScale or conversion of bigint IDs.
export function decimal(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const raw = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return '—';
  const [integer, fraction] = raw.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraction ? ',' + fraction : '');
}

export function date(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(parsed);
}

export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* Unusable source link. */ }
}

export function direction(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  return number > 0 ? 'positive' : number < 0 ? 'negative' : '';
}

export function tradingToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
