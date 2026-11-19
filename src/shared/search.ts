export type Suggestion = { symbol: string; exchange: string; name?: string; inSystem: boolean };

/** Merge system securities (backend) with exchange-wide tickers (live board lists). System rows first. */
export function mergeSuggestions(term: string, system: { symbol: string; exchange: string; companyName?: string }[], lists: Record<string, string[] | undefined>, limit = 10): Suggestion[] {
  const q = term.trim().toUpperCase();
  if (!q) return [];
  const result: Suggestion[] = system.map(row => ({ symbol: row.symbol, exchange: row.exchange, name: row.companyName, inSystem: true }));
  const known = new Set(result.map(row => row.symbol));
  for (const [exchange, symbols] of Object.entries(lists)) {
    for (const symbol of symbols || []) {
      if (result.length >= limit * 2) break;
      if (!known.has(symbol) && symbol.startsWith(q)) { result.push({ symbol, exchange, inSystem: false }); known.add(symbol); }
    }
  }
  // Exact ticker first, then prefix, then the rest (name matches from backend).
  const rank = (row: Suggestion) => row.symbol === q ? 0 : row.symbol.startsWith(q) ? 1 : 2;
  return result.sort((a, b) => rank(a) - rank(b) || Number(b.inSystem) - Number(a.inSystem) || a.symbol.localeCompare(b.symbol)).slice(0, limit);
}
