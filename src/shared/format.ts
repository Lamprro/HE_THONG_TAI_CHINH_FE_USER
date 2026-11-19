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

// Display helpers for live feed numbers (already JS numbers from public providers).
export function fixed(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function int(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('vi-VN');
}

export function signed(value: number | null | undefined, digits = 2, suffix = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return (value > 0 ? '+' : '') + fixed(value, digits) + suffix;
}

/** Compact Vietnamese amount for VND values (e.g. 15,01 nghìn tỷ). */
export function compactVnd(vnd: number | null | undefined): string {
  if (vnd === null || vnd === undefined || !Number.isFinite(vnd)) return '—';
  const abs = Math.abs(vnd);
  if (abs >= 1e12) return fixed(vnd / 1e12, 2) + ' nghìn tỷ';
  if (abs >= 1e9) return fixed(vnd / 1e9, 2) + ' tỷ';
  if (abs >= 1e6) return fixed(vnd / 1e6, 1) + ' triệu';
  return int(vnd);
}

/** Compact share volume (e.g. 18,44 tr). */
export function compactVolume(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1e6) return fixed(value / 1e6, 2) + ' tr';
  if (Math.abs(value) >= 1e3) return fixed(value / 1e3, 1) + ' k';
  return int(value);
}

/** Compact a decimal string from the backend for display only (exact value kept in title). */
export function compactDecimal(value: unknown): string {
  if (value === null || value === undefined || value === '' || !/^-?\d+(\.\d+)?$/.test(String(value))) return '—';
  return compactVnd(Number(value));
}

export function tradingToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Same as decimal() but drops trailing fractional zeros (display only, value stays a string). */
export function trimmed(value: unknown): string {
  if (value === null || value === undefined || !/^-?\d+(\.\d+)?$/.test(String(value))) return decimal(value);
  return decimal(String(value).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''));
}
