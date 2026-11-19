import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { MarketRow } from '../shared/api';
import { compactVolume, fixed, int, signed, trimmed } from '../shared/format';
import { priceTone } from '../shared/live-parse';
import type { LiveQuote } from '../shared/live';
import { Follow, securityLink } from '../shared/ui';

export type BoardRow = { symbol: string; exchange: string; companyName?: string; stored?: MarketRow };
type SortKey = 'symbol' | 'price' | 'change' | 'volume' | 'foreign';
const PAGE = 100;

export function sortRows(rows: BoardRow[], quotes: Record<string, LiveQuote> | undefined, key: SortKey, desc: boolean): BoardRow[] {
  if (key === 'symbol') return [...rows].sort((a, b) => desc ? b.symbol.localeCompare(a.symbol) : a.symbol.localeCompare(b.symbol));
  const value = (row: BoardRow): number | null => {
    const q = quotes?.[row.symbol];
    if (!q) return null;
    if (key === 'price') return q.price; if (key === 'change') return q.changePercent; if (key === 'volume') return q.volume;
    return q.foreignBuy === null || q.foreignSell === null ? null : q.foreignBuy - q.foreignSell;
  };
  // Missing values always last, independent of direction.
  return [...rows].sort((a, b) => { const x = value(a), y = value(b); if (x === null && y === null) return a.symbol.localeCompare(b.symbol); if (x === null) return 1; if (y === null) return -1; return desc ? y - x : x - y; });
}

/** FireAnt-style board: reference / ceiling / floor colours, best bid/ask, foreign flow, sortable, flash on change. */
export function PriceBoard({ rows, quotes, compact = false }: { rows: BoardRow[]; quotes: Record<string, LiveQuote> | undefined; compact?: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'symbol', desc: false });
  const [limit, setLimit] = useState(PAGE);
  const sorted = sortRows(rows, quotes, sort.key, sort.desc);
  const shown = sorted.slice(0, limit);
  // Remember last rendered price/volume per symbol so only real changes flash (not the first render).
  const seen = useRef(new Map<string, string>());
  const changed = (symbol: string, field: string, value: unknown) => { const old = seen.current.get(symbol + field); return old !== undefined && old !== String(value); };
  useEffect(() => { for (const row of shown) { const q = quotes?.[row.symbol]; if (q) { seen.current.set(row.symbol + 'p', String(q.price)); seen.current.set(row.symbol + 'v', String(q.volume)); } } });
  const head = (key: SortKey, label: string, extra = 'number', rowSpan = 2) => <th rowSpan={rowSpan} className={extra} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}><button className="sort" onClick={() => setSort(current => ({ key, desc: current.key === key ? !current.desc : key !== 'symbol' }))}>{label}{sort.key === key && (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}</button></th>;
  return <><div className="table-scroll"><table className="board">
    <thead>
      <tr><th rowSpan={2} aria-label="Theo dõi" />{head('symbol', 'Mã', '')}<th rowSpan={2} className="number">TC</th><th rowSpan={2} className="number">Trần</th><th rowSpan={2} className="number">Sàn</th>
        {!compact && <th colSpan={2} className="group">Dư mua tốt nhất</th>}
        <th colSpan={3} className="group">Khớp lệnh</th>
        {!compact && <th colSpan={2} className="group">Dư bán tốt nhất</th>}
        {head('volume', 'Tổng KL')}<th rowSpan={2} className="number">Cao</th><th rowSpan={2} className="number">Thấp</th>
        {!compact && head('foreign', 'NN ròng')}
        <th rowSpan={2}>Giá đã lưu</th></tr>
      <tr>{!compact && <><th className="number">Giá</th><th className="number">KL</th></>}{head('price', 'Giá', 'number', 1)}<th className="number">+/-</th>{head('change', '%', 'number', 1)}{!compact && <><th className="number">Giá</th><th className="number">KL</th></>}</tr>
    </thead>
    <tbody>{shown.map(row => {
      const q = quotes?.[row.symbol];
      const tone = priceTone(q?.price ?? null, q);
      const cell = (value: number | null | undefined) => <td className={'number ' + priceTone(value ?? null, q)}>{fixed(value)}</td>;
      const net = q && q.foreignBuy !== null && q.foreignSell !== null ? q.foreignBuy - q.foreignSell : null;
      return <tr key={row.exchange + row.symbol}>
        <td><Follow listing={{ symbol: row.symbol, exchange: row.exchange, companyName: row.companyName }} /></td>
        <td><a className={'ticker ' + tone} href={securityLink(row.symbol, row.exchange)}>{row.symbol}</a><small className="company-name" title={row.companyName}>{row.exchange}{row.companyName ? ' · ' + row.companyName : ''}</small></td>
        <td className="number reference">{fixed(q?.reference)}</td><td className="number ceiling">{fixed(q?.ceiling)}</td><td className="number floor">{fixed(q?.floor)}</td>
        {!compact && <>{cell(q?.bids[0]?.price)}<td className="number muted">{compactVolume(q?.bids[0]?.volume)}</td></>}
        {/* key on the value remounts the cell so the flash animation replays whenever the matched price changes */}
        <td key={'p' + q?.price} className={'number strong ' + (changed(row.symbol, 'p', q?.price) ? 'flash ' : '') + tone}>{fixed(q?.price)}</td>
        <td className={'number ' + tone}>{signed(q?.change)}</td>
        <td className={'number ' + tone}>{signed(q?.changePercent, 2, '%')}</td>
        {!compact && <>{cell(q?.asks[0]?.price)}<td className="number muted">{compactVolume(q?.asks[0]?.volume)}</td></>}
        <td key={'v' + q?.volume} className={'number' + (changed(row.symbol, 'v', q?.volume) ? ' flash' : '')}>{int(q?.volume)}</td>{cell(q?.high)}{cell(q?.low)}
        {!compact && <td className={'number ' + (net === null ? '' : net > 0 ? 'positive' : net < 0 ? 'negative' : '')}>{compactVolume(net)}</td>}
        <td>{row.stored ? <>{trimmed(row.stored.close)}<small>{row.stored.tradingDate || '—'} · {row.stored.sourceCode || 'Chưa có nguồn'}</small></> : <span className="muted">—</span>}</td>
      </tr>;
    })}</tbody>
  </table></div>
    {sorted.length > limit && <div className="pagination"><span>Đang hiển thị {shown.length}/{sorted.length} mã</span><button onClick={() => setLimit(value => value + PAGE)}>Hiển thị thêm {Math.min(PAGE, sorted.length - limit)}</button><button onClick={() => setLimit(sorted.length)}>Tất cả</button></div>}
  </>;
}
