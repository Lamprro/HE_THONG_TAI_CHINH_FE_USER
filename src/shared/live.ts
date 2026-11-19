import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { chunk, isTradingTime, parseDchart, parseVpsIndices, parseVpsQuotes, type Candle, type LiveIndex, type LiveQuote } from './live-parse';

// Realtime prices come straight from public providers so the Java backend
// (stored, provenance-checked data) is not polled for every tick.
const env = import.meta.env;
export const liveEnabled = env.VITE_LIVE_FEED !== 'off';
const boardBase = publicBase(env.VITE_LIVE_BOARD_URL || 'https://bgapidatafeed.vps.com.vn');
const chartBase = publicBase(env.VITE_LIVE_CHART_URL || 'https://dchart-api.vndirect.com.vn');
export const liveSources = { board: 'VPS', chart: 'VNDirect' } as const;

function publicBase(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))))
    throw new Error('URL nguồn giá cần HTTPS (hoặc localhost) và không chứa khóa/query.');
  return url.href.replace(/\/$/, '');
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Nguồn giá trực tiếp trả HTTP ${response.status}.`);
  return response.json();
}

const symbolPattern = /^[A-Z0-9]{1,20}$/;

export async function fetchLiveQuotes(symbols: string[], signal?: AbortSignal): Promise<Record<string, LiveQuote>> {
  const clean = [...new Set(symbols.map(value => value.trim().toUpperCase()).filter(value => symbolPattern.test(value)))];
  const result: Record<string, LiveQuote> = {};
  if (!clean.length) return result;
  // One failing batch must not blank the whole board: keep the batches that succeeded.
  const settled = await Promise.allSettled(chunk(clean, 60).map(group => getJson(`${boardBase}/getliststockdata/${group.join(',')}`, signal).then(parseVpsQuotes)));
  const failed = settled.filter(item => item.status === 'rejected');
  if (failed.length === settled.length) throw (failed[0] as PromiseRejectedResult).reason;
  for (const item of settled) if (item.status === 'fulfilled') for (const row of item.value) result[row.symbol] = row;
  return result;
}

/** Basket / exchange constituents from the board provider (VN30, HNX30, HOSE, HNX, UPCOM). */
export const baskets = { VN30: 'VN30', HNX30: 'HNX30', HOSE: 'hose', HNX: 'hnx', UPCOM: 'upcom' } as const;
export type Basket = keyof typeof baskets;
export async function fetchBasket(basket: Basket, signal?: AbortSignal): Promise<string[]> {
  const body = await getJson(`${boardBase}/getlistckindex/${baskets[basket]}`, signal);
  if (!Array.isArray(body)) throw new Error('Nguồn danh sách rổ trả dữ liệu không đúng định dạng.');
  return [...new Set(body.filter((v): v is string => typeof v === 'string').map(v => v.trim().toUpperCase()).filter(v => symbolPattern.test(v)))];
}
export function useBasket(basket: Basket | null) {
  return useQuery({ queryKey: ['basket', basket], enabled: liveEnabled && basket !== null, staleTime: 6 * 3_600_000, queryFn: ({ signal }) => fetchBasket(basket as Basket, signal) });
}

export async function fetchLiveIndices(signal?: AbortSignal): Promise<LiveIndex[]> {
  return parseVpsIndices(await getJson(`${boardBase}/getlistindexdetail/10,11,02,12,03`, signal));
}

export type Resolution = '1' | '5' | '15' | '60' | 'D' | 'W';
export async function fetchCandles(symbol: string, resolution: Resolution, fromSeconds: number, toSeconds: number, signal?: AbortSignal): Promise<Candle[]> {
  if (!symbolPattern.test(symbol)) throw new Error('Mã không hợp lệ cho nguồn biểu đồ.');
  const url = new URL(`${chartBase}/dchart/history`);
  url.search = new URLSearchParams({ resolution, symbol, from: String(Math.floor(fromSeconds)), to: String(Math.floor(toSeconds)) }).toString();
  return parseDchart(await getJson(url.href, signal));
}

/** Poll only while the market is open and the tab is visible; otherwise reuse cache. */
export function livePollInterval(ms = 10_000): number | false {
  return liveEnabled && isTradingTime() ? ms : false;
}

export function useLiveQuotes(symbols: string[], intervalMs = 10_000) {
  const key = [...new Set(symbols)].sort();
  return useQuery({
    queryKey: ['live-quotes', key],
    enabled: liveEnabled && key.length > 0,
    staleTime: 8_000,
    refetchInterval: () => livePollInterval(intervalMs),
    refetchIntervalInBackground: false, retry: 1,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchLiveQuotes(key, signal),
  });
}

export function useLiveIndices() {
  return useQuery({ queryKey: ['live-indices'], enabled: liveEnabled, staleTime: 8_000, refetchInterval: () => livePollInterval(), refetchIntervalInBackground: false, retry: 1, queryFn: ({ signal }) => fetchLiveIndices(signal) });
}

export const chartRanges = [
  { key: '1D', label: '1 ngày', resolution: '1', days: 1 },
  { key: '5D', label: '5 ngày', resolution: '5', days: 7 },
  { key: '1M', label: '1 tháng', resolution: '60', days: 31 },
  { key: '3M', label: '3 tháng', resolution: 'D', days: 92 },
  { key: '6M', label: '6 tháng', resolution: 'D', days: 183 },
  { key: '1Y', label: '1 năm', resolution: 'D', days: 366 },
  { key: '5Y', label: '5 năm', resolution: 'W', days: 1830 },
] as const satisfies readonly { key: string; label: string; resolution: Resolution; days: number }[];
export type ChartRange = (typeof chartRanges)[number]['key'];

export function useCandles(symbol: string, range: ChartRange) {
  const config = chartRanges.find(item => item.key === range) || chartRanges[4];
  const intraday = config.resolution !== 'D' && config.resolution !== 'W';
  return useQuery({
    queryKey: ['candles', symbol, range],
    enabled: liveEnabled && Boolean(symbol),
    staleTime: intraday ? 30_000 : 600_000,
    refetchInterval: () => (intraday ? livePollInterval(30_000) : false),
    refetchIntervalInBackground: false, retry: 1,
    queryFn: async ({ signal }) => {
      const to = Date.now() / 1000;
      // Intraday 1D: extend to the last 4 days and keep the latest session so weekends still show data.
      const lookback = config.key === '1D' ? 4 : config.days;
      const candles = await fetchCandles(symbol, config.resolution, to - lookback * 86400, to, signal);
      if (config.key !== '1D' || !candles.length) return candles;
      const sessionDay = (seconds: number) => new Date(seconds * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      const last = sessionDay(candles[candles.length - 1].time);
      return candles.filter(row => sessionDay(row.time) === last);
    },
  });
}

export type { Candle, LiveIndex, LiveQuote };
