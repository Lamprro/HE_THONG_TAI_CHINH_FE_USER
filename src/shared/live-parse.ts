// Pure parsers for public market feeds called directly from the browser.
// No React / Vite imports so Node tests can load this file.
// Units are kept explicit: prices of stocks in thousand VND (like price boards), indices in points.

export type BookLevel = { price: number | null; volume: number | null };
export type LiveQuote = {
  symbol: string;
  market: 'HOSE' | 'HNX' | 'UPCOM' | string;
  price: number | null;
  reference: number | null;
  ceiling: number | null;
  floor: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  average: number | null;
  change: number | null;
  changePercent: number | null;
  /** Total matched volume in shares. */
  volume: number | null;
  bids: BookLevel[];
  asks: BookLevel[];
  foreignBuy: number | null;
  foreignSell: number | null;
  foreignRoom: number | null;
  notices: string[];
};
export type LiveIndex = {
  code: string;
  value: number | null;
  reference: number | null;
  change: number | null;
  changePercent: number | null;
  /** Matched volume in shares. */
  volume: number | null;
  /** Matched value in million VND. */
  valueMillion: number | null;
  advances: number | null;
  declines: number | null;
  unchanged: number | null;
  time: string | null;
};
export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

/** VPS board sends volumes in lots of 10 shares. */
export const VPS_LOT = 10;
export const VPS_INDEX_CODES: Record<string, string> = { '10': 'VNINDEX', '11': 'VN30', '02': 'HNXINDEX', '12': 'HNX30', '03': 'UPCOM' };
const MARKETS: Record<string, string> = { STO: 'HOSE', STX: 'HNX', UPX: 'UPCOM', HSX: 'HOSE', HNX: 'HNX', UPCOM: 'UPCOM' };

export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function level(raw: unknown): BookLevel {
  if (typeof raw !== 'string') return { price: null, volume: null };
  const [price, volume] = raw.split('|');
  const p = num(price); const v = num(volume);
  // VPS uses 0 or text like ATO/ATC for empty / auction levels.
  return { price: p && p > 0 ? p : null, volume: v && v > 0 ? v * VPS_LOT : null };
}

function decodeNotice(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.replace(/\\n/g, ' ').trim().slice(0, 300);
}

export function parseVpsQuote(raw: unknown): LiveQuote | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const symbol = typeof row.sym === 'string' ? row.sym.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{1,20}$/.test(symbol)) return null;
  const price = num(row.lastPrice);
  const reference = num(row.r);
  const hasPrice = price !== null && price > 0;
  const change = hasPrice && reference ? round(price - reference) : null;
  const lot = num(row.lot);
  const fb = num(row.fBVol); const fs = num(row.fSVolume); const room = num(row.fRoom);
  const notices = Array.isArray(row.rightInfos)
    ? row.rightInfos.map(item => decodeNotice((item as Record<string, unknown>)?.contentEn)).filter((v): v is string => Boolean(v))
    : [];
  return {
    symbol,
    market: MARKETS[String(row.marketId)] || String(row.marketId || ''),
    price: hasPrice ? price : null,
    reference,
    ceiling: num(row.c),
    floor: num(row.f),
    open: num(row.openPrice),
    high: num(row.highPrice),
    low: num(row.lowPrice),
    average: num(row.avePrice),
    change,
    changePercent: change !== null && reference ? round(change / reference * 100, 2) : null,
    volume: lot !== null ? lot * VPS_LOT : null,
    bids: [level(row.g1), level(row.g2), level(row.g3)],
    asks: [level(row.g4), level(row.g5), level(row.g6)],
    foreignBuy: fb !== null ? fb * VPS_LOT : null,
    foreignSell: fs !== null ? fs * VPS_LOT : null,
    foreignRoom: room,
    notices,
  };
}

export function parseVpsQuotes(raw: unknown): LiveQuote[] {
  if (!Array.isArray(raw)) throw new Error('Nguồn bảng giá trả dữ liệu không đúng định dạng.');
  return raw.map(parseVpsQuote).filter((row): row is LiveQuote => row !== null);
}

export function parseVpsIndex(raw: unknown): LiveIndex | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const code = VPS_INDEX_CODES[String(row.mc)];
  if (!code) return null;
  const value = num(row.cIndex);
  const reference = num(row.oIndex);
  const parts = typeof row.ot === 'string' ? row.ot.split('|') : [];
  const change = value !== null && reference !== null && value > 0 ? round(value - reference, 2) : null;
  const volume = num(row.vol);
  return {
    code,
    value: value && value > 0 ? value : null,
    reference,
    change,
    changePercent: change !== null && reference ? round(change / reference * 100, 2) : null,
    volume: volume && volume > 0 ? volume : null,
    valueMillion: num(row.value) || null,
    advances: num(parts[3]),
    declines: num(parts[4]),
    unchanged: num(parts[5]),
    time: typeof row.time === 'string' ? row.time : null,
  };
}

export function parseVpsIndices(raw: unknown): LiveIndex[] {
  if (!Array.isArray(raw)) throw new Error('Nguồn chỉ số trả dữ liệu không đúng định dạng.');
  return raw.map(parseVpsIndex).filter((row): row is LiveIndex => row !== null);
}

/** TradingView-style history used by VNDirect dchart: { s, t[], o[], h[], l[], c[], v[] }. */
export function parseDchart(raw: unknown): Candle[] {
  if (!raw || typeof raw !== 'object') throw new Error('Nguồn biểu đồ trả dữ liệu không đúng định dạng.');
  const body = raw as Record<string, unknown>;
  if (body.s === 'no_data') return [];
  const arrays = ['t', 'o', 'h', 'l', 'c', 'v'].map(key => body[key]);
  if (!arrays.every(Array.isArray)) throw new Error('Nguồn biểu đồ thiếu chuỗi thời gian.');
  const [t, o, h, l, c, v] = arrays as unknown[][];
  const result: Candle[] = [];
  for (let i = 0; i < t.length; i++) {
    const row = { time: num(t[i]), open: num(o[i]), high: num(h[i]), low: num(l[i]), close: num(c[i]), volume: num(v[i]) ?? 0 };
    if (row.time === null || row.open === null || row.high === null || row.low === null || row.close === null) continue;
    result.push(row as Candle);
  }
  return result.sort((a, b) => a.time - b.time);
}

/** Vietnamese continuous trading window (Mon–Fri, 09:00–15:00 Asia/Ho_Chi_Minh). */
export function isTradingTime(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  if (['Sat', 'Sun'].includes(get('weekday'))) return false;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  // Lunch break 11:30–13:00 has no matching: skip polling.
  return minutes >= 9 * 60 && minutes <= 15 * 60 && !(minutes > 11 * 60 + 30 && minutes < 13 * 60);
}

/** Session label for the header pill. */
export function sessionLabel(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  if (['Sat', 'Sun'].includes(get('weekday'))) return 'Nghỉ cuối tuần';
  const m = Number(get('hour')) * 60 + Number(get('minute'));
  if (m < 9 * 60) return 'Chưa mở cửa';
  if (m < 9 * 60 + 15) return 'Phiên ATO';
  if (m <= 11 * 60 + 30) return 'Phiên sáng';
  if (m < 13 * 60) return 'Nghỉ trưa';
  if (m < 14 * 60 + 30) return 'Phiên chiều';
  if (m < 14 * 60 + 45) return 'Phiên ATC';
  if (m <= 15 * 60) return 'Thỏa thuận';
  return 'Đã đóng cửa';
}

/** Price board colour class: ceiling / floor / reference / up / down. */
export function priceTone(price: number | null, quote: Pick<LiveQuote, 'reference' | 'ceiling' | 'floor'> | null | undefined): string {
  if (price === null || !quote || quote.reference === null) return '';
  if (quote.ceiling !== null && price >= quote.ceiling) return 'ceiling';
  if (quote.floor !== null && price <= quote.floor) return 'floor';
  if (price > quote.reference) return 'positive';
  if (price < quote.reference) return 'negative';
  return 'reference';
}

export function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}
