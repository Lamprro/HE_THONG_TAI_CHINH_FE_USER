export type SavedListing = { symbol: string; exchange: string; companyName?: string };
export const WATCH_KEY = 'financial-user.watchlist.v1';

export function parseWatchlist(raw: string | null): SavedListing[] {
  try {
    const values: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(values)) return [];
    const found = new Set<string>();
    return values.filter((value): value is SavedListing => {
      if (!value || typeof value !== 'object') return false;
      const row = value as SavedListing;
      if (typeof row.symbol !== 'string' || !/^[A-Z0-9._-]{1,20}$/.test(row.symbol) || typeof row.exchange !== 'string' || !/^[A-Z0-9_-]{1,30}$/.test(row.exchange)) return false;
      const key = row.exchange + ':' + row.symbol;
      if (found.has(key)) return false;
      found.add(key);
      return true;
    }).slice(0, 100).map(row => ({ symbol: row.symbol, exchange: row.exchange, companyName: typeof row.companyName === 'string' ? row.companyName.slice(0, 300) : undefined }));
  } catch { return []; }
}
