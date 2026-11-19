import { apiData, type Data, type Price, type Security } from './api';

export type Quote = { price: string | null; currency: string; asOf: string | null; source: string; mode: 'stored' | 'direct' };
const directEndpoint = import.meta.env.VITE_QUOTE_URL as string | undefined;
export const hasDirectQuotes = Boolean(directEndpoint);

export async function getQuote(symbol: string, exchange: string, signal?: AbortSignal): Promise<Quote> {
  if (!directEndpoint) {
    const response = await apiData<{ security: Security; daily: Price | null; snapshot: Price | null }>('quote', [symbol], { exchange }, signal);
    const candidates = [response.data.daily, response.data.snapshot].filter((value): value is Price => value !== null);
    const price = candidates.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    return { price: price?.close ?? null, currency: response.data.security.currency || '', asOf: price?.timestamp ?? null, source: price?.sourceCode || '', mode: 'stored' };
  }
  const url = new URL(directEndpoint);
  if (url.username || url.password || url.hash || url.search || !['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('URL nguồn giá cần HTTPS hoặc localhost, không chứa khóa hay query.');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('exchange', exchange);
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Nguồn giá trực tiếp chưa phản hồi thành công.');
  const body = await response.json() as Data<Quote & { symbol: string; exchange: string }>;
  const value = body?.data;
  if (!value || value.symbol !== symbol || value.exchange !== exchange || typeof value.source !== 'string' || !value.source || typeof value.currency !== 'string' || !value.currency || typeof value.asOf !== 'string' || Number.isNaN(Date.parse(value.asOf)) || (value.price !== null && (typeof value.price !== 'string' || !/^\d+(\.\d+)?$/.test(value.price)))) throw new Error('Dữ liệu nguồn giá không khớp mã, sàn hoặc định dạng.');
  return { price: value.price, currency: value.currency, asOf: value.asOf, source: value.source, mode: 'direct' };
}
