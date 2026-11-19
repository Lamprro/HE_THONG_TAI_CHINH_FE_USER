import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { apiPage } from '../shared/api';
import { BreadthBar } from '../shared/charts';
import { compactVnd, date, fixed, int, signed, trimmed, tradingToday } from '../shared/format';
import { chartRanges, liveEnabled, liveSources, useBasket, useCandles, useLiveIndices, useLiveQuotes, type Basket, type Candle, type ChartRange } from '../shared/live';
import { Note, QueryState, useTitle } from '../shared/ui';
import { CandleChart } from './CandleChart';
import { useMarket } from './Market';
import { PriceBoard, type BoardRow } from './PriceBoard';

export const indexInfo: Record<string, { name: string; chart: string; basket: Basket; exchange: string }> = {
  VNINDEX: { name: 'VN-Index', chart: 'VNINDEX', basket: 'HOSE', exchange: 'HOSE' },
  VN30: { name: 'VN30', chart: 'VN30', basket: 'VN30', exchange: 'HOSE' },
  HNXINDEX: { name: 'HNX-Index', chart: 'HNX', basket: 'HNX', exchange: 'HNX' },
  HNX30: { name: 'HNX30', chart: 'HNX30', basket: 'HNX30', exchange: 'HNX' },
  UPCOM: { name: 'UPCoM-Index', chart: 'UPCOM', basket: 'UPCOM', exchange: 'UPCOM' },
};
type IndexPrice = { id: string; tradingDate: string; timestamp: string; open: string | null; high: string | null; low: string | null; close: string | null; volume: string | null; sourceCode: string };

export function IndexPage({ code }: { code: string }) {
  const info = indexInfo[code];
  const [range, setRange] = useState<ChartRange>('1D');
  const live = useLiveIndices();
  const value = live.data?.find(row => row.code === code);
  const candles = useCandles(info?.chart || '', range);
  const basket = useBasket(info ? info.basket : null);
  const market = useMarket('');
  const tracked = useMemo(() => new Map((market.data?.data.securities || []).map(row => [row.symbol, row])), [market.data]);
  const rows: BoardRow[] = (basket.data || []).map(symbol => { const stored = tracked.get(symbol); return { symbol, exchange: stored?.exchange || info?.exchange || '', companyName: stored?.companyName, stored }; });
  const quotes = useLiveQuotes(rows.map(row => row.symbol), rows.length > 60 ? 15_000 : 10_000);
  const to = tradingToday(); const from = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
  const stored = useQuery({ queryKey: ['index-prices', code, from], enabled: Boolean(info), staleTime: 1_800_000, retry: false, queryFn: ({ signal }) => apiPage<IndexPrice>('indexPrices', [code], { from, to, size: 500 }, signal) });
  const storedCandles: Candle[] = (stored.data?.items || []).filter(p => p.open && p.high && p.low && p.close).map(p => ({ time: Date.parse(p.timestamp) / 1000, open: Number(p.open), high: Number(p.high), low: Number(p.low), close: Number(p.close), volume: Number(p.volume || 0) }));
  const fallback = !liveEnabled || Boolean(candles.error);
  const tone = value?.change == null ? '' : value.change > 0 ? 'positive' : value.change < 0 ? 'negative' : 'reference';
  const counts = rows.reduce((acc, row) => { const c = quotes.data?.[row.symbol]?.change; if (c == null) return acc; if (c > 0) acc.up++; else if (c < 0) acc.down++; else acc.flat++; return acc; }, { up: 0, down: 0, flat: 0 });
  useTitle(`${info?.name || code}${value?.value != null ? ' ' + fixed(value.value) + ' ' + signed(value.changePercent, 2, '%') : ''}`);
  if (!info) return <div className="state"><h1>Chưa hỗ trợ chỉ số {code}</h1><a href="#/market">Về tổng quan</a></div>;
  return <>
    <a className="back-link" href="#/market"><ArrowLeft size={14} />Tổng quan thị trường</a>
    <div className="security-heading"><div className="security-title"><span className="symbol-avatar">{code.slice(0, 3)}</span><div><h1>{info.name}</h1><p>Chỉ số {info.exchange} · thành phần: {info.basket}</p></div></div>
      <div className="quote">{value?.value != null ? <><strong className={tone}>{fixed(value.value)} <small>điểm</small></strong><span className={tone}>{signed(value.change)} ({signed(value.changePercent, 2, '%')})</span><div className="quote-levels"><span>KL {int(value.volume)}</span><span>GT {compactVnd(value.valueMillion === null ? null : value.valueMillion * 1e6)}</span></div><small>Trực tiếp · {liveSources.board} · {value.time}</small></> : <><strong>—</strong><span>{live.isPending ? 'Đang lấy dữ liệu…' : 'Nguồn trực tiếp chưa có'}</span></>}</div></div>
    {value?.advances != null && <section className="panel breadth-panel"><div><h2>Độ rộng {info.name}</h2><span className="muted">Số mã tăng/giảm theo nguồn chỉ số</span></div><BreadthBar up={value.advances} down={value.declines || 0} flat={value.unchanged || 0} /><div className="breadth-legend"><span className="positive">{value.advances} tăng</span><span className="reference">{value.unchanged} đứng</span><span className="negative">{value.declines} giảm</span></div></section>}
    <section className="panel"><div className="panel-heading"><div><h2>Biểu đồ {info.name}</h2><span className="muted">{fallback ? 'Điểm đã lưu trong hệ thống (ngày)' : `Nguồn trực tiếp ${liveSources.chart} · điểm`}</span></div>{!fallback && <div className="segments">{chartRanges.map(item => <button key={item.key} className={range === item.key ? 'selected' : ''} onClick={() => setRange(item.key)}>{item.key}</button>)}</div>}</div>
      <QueryState loading={fallback ? stored.isPending : candles.isPending} error={fallback ? stored.error : null} empty={!(fallback ? storedCandles : candles.data || []).length} retry={fallback ? stored.refetch : candles.refetch}><CandleChart candles={fallback ? storedCandles : candles.data || []} intraday={!fallback && ['1D', '5D', '1M'].includes(range)} /></QueryState>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Cổ phiếu thành phần · {rows.length} mã</h2><span className="muted">Danh sách {info.basket} từ {liveSources.board}{rows.length ? ` · ${counts.up} tăng, ${counts.flat} đứng, ${counts.down} giảm` : ''}</span></div></div>
      <QueryState loading={basket.isPending} error={basket.error} empty={!rows.length} retry={basket.refetch}><PriceBoard rows={rows} quotes={quotes.data} compact /></QueryState>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Lịch sử điểm đã lưu</h2><span className="muted">Dữ liệu canonical của hệ thống, đơn vị điểm</span></div></div>
      <QueryState loading={stored.isPending} error={stored.error} empty={!stored.data?.items.length} retry={stored.refetch}><details><summary>{stored.data?.items.length} phiên gần nhất</summary><div className="table-scroll price-history"><table><thead><tr><th>Phiên</th><th className="number">Mở</th><th className="number">Cao</th><th className="number">Thấp</th><th className="number">Đóng</th><th className="number">KL</th><th>Nguồn</th></tr></thead><tbody>{[...(stored.data?.items || [])].reverse().map(p => <tr key={p.id}><td>{date(p.tradingDate)}</td><td className="number">{trimmed(p.open)}</td><td className="number">{trimmed(p.high)}</td><td className="number">{trimmed(p.low)}</td><td className="number">{trimmed(p.close)}</td><td className="number">{trimmed(p.volume)}</td><td>{p.sourceCode}</td></tr>)}</tbody></table></div></details></QueryState>
      <Note>Chỉ số có dữ liệu lưu trong hệ thống: VNINDEX, VN30, HNXINDEX. Chỉ số khác chỉ có nguồn trực tiếp.</Note>
    </section>
  </>;
}
