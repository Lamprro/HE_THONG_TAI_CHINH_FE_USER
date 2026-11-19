import { createUserApi, userOperations } from './user-api.mjs';

export type Row = Record<string, unknown>;
export type Meta = { notes?: string[]; generatedAt?: string; timezone?: string };
export type Data<T> = { data: T; meta: Meta };
export type Page<T> = { items: T[]; page: number; size: number; total: number; hasNext: boolean; meta: Meta };
export type Query = Record<string, string | number | boolean | undefined>;
export type Listing = { symbol: string; exchange: string; companyName?: string };
export type Security = Listing & { id: string; currency?: string; industryName?: string; company?: Row };
export type Price = { id: string; close: string | null; open?: string | null; high?: string | null; low?: string | null; volume?: string | null; timestamp: string; tradingDate: string; sourceCode: string; currency?: string; priceBasis?: string };
export type MarketRow = Listing & { close: string | null; changePercent: string | null; volume: string | null; tradingDate: string | null; currency: string; sourceCode: string | null; onLatestStoredSession: boolean };
export type Market = { latestStoredTradingDate: string | null; securities: MarketRow[]; indices: (Row & { code: string; name: string; close: string | null; tradingDate: string | null })[]; breadth: Record<string, number> };
export type Article = { id: string; title: string; sapo: string | null; url: string | null; publishedAt: string | null; sourceName: string; hasContent: boolean; contentText?: string | null };
export type Statement = { id: string; statementType: string; fiscalYear: number; periodType: string; reportScope: string; periodBasis: string; currency: string; unitScale: string | null; sourceCode: string; publishedAt: string | null; items?: { code: string; name: string; value: string | null; unit: string | null }[] };

export const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
// Reuse the backend's public SDK, including URL validation, cancellation and decimal handling.
const client = createUserApi({ baseUrl: apiBase }) as Record<string, (...args: unknown[]) => Promise<unknown>>;

export async function apiData<T>(operation: keyof typeof userOperations, path: string[] = [], query: Query = {}, signal?: AbortSignal): Promise<Data<T>> {
  const result = await client[operation](...path, query, { signal }) as Data<T>;
  if (!result || !('data' in result) || !result.meta) throw new Error('Phản hồi dữ liệu chưa đúng hợp đồng API.');
  return result;
}

export async function apiPage<T>(operation: keyof typeof userOperations, path: string[] = [], query: Query = {}, signal?: AbortSignal): Promise<Page<T>> {
  const result = await client[operation](...path, query, { signal }) as Page<T>;
  if (!Array.isArray(result?.items) || typeof result.hasNext !== 'boolean') throw new Error('Phản hồi danh sách chưa đúng hợp đồng API.');
  return result;
}

export { userOperations };
