import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { apiData, apiPage, type Price, type Row, type Security } from '../shared/api';
import { compactVolume, date, decimal, fixed, int, safeUrl, signed, text, tradingToday } from '../shared/format';
import { priceTone } from '../shared/live-parse';
import { chartRanges, liveEnabled, liveSources, useCandles, useLiveQuotes, type Candle, type ChartRange, type LiveQuote } from '../shared/live';
import { getQuote } from '../shared/quotes';
import { Follow, Note, Pagination, QueryState, securityLink, useTitle } from '../shared/ui';
import { CandleChart } from './CandleChart';
import { NewsPage } from './News';
import { PriceChart } from './PriceChart';
import { OverviewPanel } from './SecurityOverview';
import { FinancialMatrixPanel, MetricsPanel } from './SecurityFinance';
import { AiPanel, ForeignPanel, ReferencePanel } from './SecurityExtra';


export const securityTabs = [
  ['overview', 'Tổng quan'], ['chart', 'Biểu đồ'], ['financials', 'Tài chính'], ['metrics', 'Chỉ số'], ['foreign', 'Khối ngoại'], ['news', 'Tin tức'], ['ai', 'AI & Dự báo'], ['profile', 'Hồ sơ'],
] as const;
export type SecurityTab = (typeof securityTabs)[number][0];

export function SecurityPage({ symbol, exchange, initialTab }: { symbol: string; exchange: string; initialTab?: string }) {
  const tabs = securityTabs;
  const [tab, setTabState] = useState<SecurityTab>(tabs.some(([value]) => value === initialTab) ? initialTab as SecurityTab : tabs[0][0]);
  // Keep the open tab in the URL (replaceState: no history spam, no scroll jump) so refresh/share keeps it.
  const setTab = (value: SecurityTab) => { setTabState(value); window.history.replaceState(null, '', securityLink(symbol, exchange) + (value === 'overview' ? '' : '&tab=' + value)); };
  const profile = useQuery({ queryKey: ['security', symbol, exchange], staleTime: 1_800_000, retry: false, queryFn: ({ signal }) => apiData<Security>('security', [symbol], { exchange: exchange || undefined }, signal) });
  const security = profile.data?.data;
  const live = useLiveQuotes([symbol]);
  const quote = live.data?.[symbol];
  const status = (profile.error as { status?: number } | null)?.status;
  const shownExchange = exchange || security?.exchange || quote?.market || '';
  useTitle(`${symbol}${quote?.price != null ? ' ' + fixed(quote.price) + ' ' + signed(quote.changePercent, 2, '%') : ''} · ${security?.companyName || 'Cổ phiếu'}`);
  return <>
    <a className="back-link" href="#/securities"><ArrowLeft size={14} />Danh sách cổ phiếu</a>
    <div className="security-heading">
      <div className="security-title"><span className="symbol-avatar">{symbol.slice(0, 3)}</span><div><h1>{symbol} <span className="exchange">{shownExchange || 'Sàn chưa chọn'}</span></h1><p>{security?.companyName || (status === 404 ? 'Mã chưa có trong hệ thống dữ liệu' : 'Đang tra cứu doanh nghiệp')}{security?.industryName ? ' · ' + security.industryName : ''}</p></div><Follow listing={{ symbol, exchange: shownExchange, companyName: security?.companyName }} /></div>
      <QuoteBox symbol={symbol} exchange={exchange} quote={quote} liveDone={!live.isPending} hasStored={Boolean(security)} loading={live.isFetching} error={live.error} refresh={() => live.refetch()} />
    </div>
    {status === 409 ? <ExchangePicker symbol={symbol} />
      : status === 404 ? <LiveOnly symbol={symbol} quote={quote} />
      : <QueryState loading={profile.isPending} error={profile.error} retry={profile.refetch}>
      <nav className="tabs" aria-label="Thông tin cổ phiếu">{tabs.map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)}>{label}</button>)}</nav>
      {tab === 'overview' && <OverviewPanel symbol={symbol} exchange={exchange} openTab={value => setTab(value as SecurityTab)} />}
      {tab === 'chart' && <ChartPanel symbol={symbol} exchange={exchange} quote={quote} />}
      {tab === 'financials' && <FinancialMatrixPanel symbol={symbol} exchange={exchange} />}
      {tab === 'metrics' && <MetricsPanel symbol={symbol} exchange={exchange} />}
      {tab === 'foreign' && <ForeignPanel symbol={symbol} exchange={exchange} />}
      {tab === 'ai' && <AiPanel symbol={symbol} exchange={exchange} />}
      {tab === 'news' && <NewsPage key={symbol + exchange} symbol={symbol} exchange={exchange} />}
      {tab === 'profile' && <><ProfilePanel security={security} /><ReferencePanel symbol={symbol} exchange={exchange} /></>}
    </QueryState>}
  </>;
}

/** Symbol not in the system DB: still useful with live price, order book and live chart. */
function LiveOnly({ symbol, quote }: { symbol: string; quote?: LiveQuote }) {
  return <>
    <p className="inline-alert info" role="status">Mã {symbol} chưa có trong hệ thống dữ liệu (hồ sơ, BCTC, tin tức). Đang hiển thị giá và biểu đồ trực tiếp từ {liveSources.board}/{liveSources.chart}.</p>
    <ChartPanel symbol={symbol} exchange="" quote={quote} storedHistory={false} />
  </>;
}

/** 409: same ticker on several venues; never guess the exchange. */
function ExchangePicker({ symbol }: { symbol: string }) {
  const query = useQuery({ queryKey: ['securities-exact', symbol], staleTime: 1_800_000, queryFn: ({ signal }) => apiPage<Security>('securities', [], { search: symbol, size: 25 }, signal) });
  const matches = (query.data?.items || []).filter(row => row.symbol === symbol);
  return <section className="panel"><div className="panel-heading"><div><h2>Chọn sàn niêm yết</h2><span className="muted">Mã {symbol} có trên nhiều sàn trong hệ thống, hãy chọn một sàn</span></div></div>
    <QueryState loading={query.isPending} error={query.error} empty={!matches.length} retry={query.refetch}><ul className="plain-list">{matches.map(row => <li key={row.id}><a href={securityLink(row.symbol, row.exchange)}><strong>{row.symbol}</strong> · {row.exchange}</a><small>{row.companyName}</small></li>)}</ul></QueryState>
  </section>;
}

function QuoteBox({ symbol, exchange, quote, liveDone, hasStored, loading, error, refresh }: { symbol: string; exchange: string; quote?: LiveQuote; liveDone: boolean; hasStored: boolean; loading: boolean; error: Error | null; refresh: () => void }) {
  // Stored quote only when the live board cannot answer (disabled, failed, or symbol unknown to it).
  const needStored = hasStored && (!liveEnabled || (liveDone && (Boolean(error) || !quote)));
  const stored = useQuery({ queryKey: ['quote', symbol, exchange], staleTime: 1_800_000, enabled: needStored, queryFn: ({ signal }) => getQuote(symbol, exchange, signal) });
  const tone = priceTone(quote?.price ?? null, quote);
  if (quote?.price != null || quote?.reference != null) {
    const price = quote.price ?? quote.reference;
    return <div className="quote">
      <strong className={tone}>{fixed(price)} <small>nghìn VND</small></strong>
      <span className={tone}>{signed(quote.change)} ({signed(quote.changePercent, 2, '%')}){quote.price == null ? ' · chưa khớp' : ''}</span>
      <div className="quote-levels"><span className="reference">TC {fixed(quote.reference)}</span><span className="ceiling">Trần {fixed(quote.ceiling)}</span><span className="floor">Sàn {fixed(quote.floor)}</span><span>KL {int(quote.volume)}</span></div>
      <small>Trực tiếp · {liveSources.board}<button className="icon-button" disabled={loading} onClick={refresh} aria-label="Cập nhật giá"><RefreshCw size={13} /></button></small>
    </div>;
  }
  if (!needStored) return <div className="quote"><strong>—</strong><span>{liveDone ? 'Chưa có giá' : 'Đang lấy giá…'}</span></div>;
  return <div className="quote"><strong>{decimal(stored.data?.price)} <small>{stored.data?.currency}</small></strong><span>Giá đã lưu · {date(stored.data?.asOf)}</span><small>{stored.data?.source}</small>
    {(error || !liveEnabled) && <small className="negative" role="alert">{liveEnabled ? 'Nguồn trực tiếp chưa phản hồi: ' + error?.message : 'Nguồn trực tiếp đang tắt'}</small>}</div>;
}

function storedCandles(prices: Price[]): Candle[] {
  return prices.filter(p => p.close !== null && p.open && p.high && p.low).map(p => ({
    time: Date.parse(p.timestamp) / 1000, open: Number(p.open) / 1000, high: Number(p.high) / 1000, low: Number(p.low) / 1000, close: Number(p.close) / 1000, volume: Number(p.volume || 0),
  }));
}

function ChartPanel({ symbol, exchange, quote, storedHistory = true }: { symbol: string; exchange: string; quote?: LiveQuote; storedHistory?: boolean }) {
  const [range, setRange] = useState<ChartRange>('6M');
  const live = useCandles(symbol, range);
  const intraday = ['1D', '5D', '1M'].includes(range);
  const fallback = storedHistory && (!liveEnabled || Boolean(live.error));
  const days = Math.min(chartRanges.find(r => r.key === range)?.days || 183, 700);
  const to = tradingToday();
  const fromDate = new Date(to + 'T00:00:00Z'); fromDate.setUTCDate(fromDate.getUTCDate() - Math.max(days, 31));
  const stored = useQuery({ queryKey: ['prices', symbol, exchange, fromDate.toISOString().slice(0, 10), to, 0], enabled: fallback, staleTime: 1_800_000, queryFn: ({ signal }) => apiPage<Price>('prices', [symbol], { exchange, from: fromDate.toISOString().slice(0, 10), to, interval: '1d', size: 500, page: 0 }, signal) });
  const candles = useMemo(() => fallback ? storedCandles(stored.data?.items || []) : live.data || [], [fallback, stored.data, live.data]);
  const pending = fallback ? stored.isPending : live.isPending;
  return <>
    <div className="chart-layout">
      <section className="panel"><div className="panel-heading"><div><h2>Biểu đồ kỹ thuật</h2><span className="muted">{fallback ? `Giá đã lưu của hệ thống (quy đổi nghìn VND) · nguồn trực tiếp ${liveEnabled ? 'lỗi: ' + (live.error?.message || '') : 'đang tắt'}` : `Nguồn trực tiếp ${liveSources.chart} · nghìn VND · ${candles.length} nến`}</span></div><div className="segments">{chartRanges.map(item => <button key={item.key} className={range === item.key ? 'selected' : ''} onClick={() => setRange(item.key)} title={item.label}>{item.key}</button>)}</div></div>
        <QueryState loading={pending && !live.error} error={fallback ? stored.error : storedHistory ? null : live.error} empty={!candles.length} retry={fallback ? stored.refetch : live.refetch}><CandleChart candles={candles} intraday={!fallback && intraday} /></QueryState>
      </section>
      <OrderBook quote={quote} />
    </div>
    {storedHistory && <StoredPricePanel symbol={symbol} exchange={exchange} />}
  </>;
}

function OrderBook({ quote }: { quote?: LiveQuote }) {
  const levels = [...(quote?.asks || []).slice().reverse().map(l => ({ ...l, side: 'ask' })), ...(quote?.bids || []).map(l => ({ ...l, side: 'bid' }))];
  const maxVol = Math.max(1, ...levels.map(l => l.volume || 0));
  return <section className="panel order-book"><div className="panel-heading"><div><h2>Sổ lệnh</h2><span className="muted">3 bước giá tốt nhất · {liveSources.board}</span></div></div>
    {quote ? <>
      <div className="book">{levels.map((l, i) => <div key={i} className={'book-row ' + l.side}><span className={priceTone(l.price, quote)}>{fixed(l.price)}</span><span className="bar" style={{ width: `${(l.volume || 0) / maxVol * 100}%` }} /><span>{compactVolume(l.volume)}</span></div>)}</div>
      <dl className="stats">{[['Mở cửa', fixed(quote.open)], ['Cao / Thấp', fixed(quote.high) + ' / ' + fixed(quote.low)], ['Trung bình', fixed(quote.average)], ['Tổng KL', int(quote.volume)], ['NN mua', compactVolume(quote.foreignBuy)], ['NN bán', compactVolume(quote.foreignSell)], ['Room NN', compactVolume(quote.foreignRoom)]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {quote.notices.length > 0 && <div className="notices">{quote.notices.map(n => <p key={n}>{n}</p>)}</div>}
    </> : <div className="state"><strong>Chưa có dữ liệu sổ lệnh</strong><span>{liveEnabled ? 'Đang chờ nguồn trực tiếp.' : 'Nguồn trực tiếp đang tắt.'}</span></div>}
  </section>;
}

function StoredPricePanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const [days, setDays] = useState(180);
  const [page, setPage] = useState(0);
  const to = tradingToday();
  const fromDate = new Date(to + 'T00:00:00Z');
  fromDate.setUTCDate(fromDate.getUTCDate() - days);
  const from = fromDate.toISOString().slice(0, 10);
  const query = useQuery({ queryKey: ['prices', symbol, exchange, from, to, page], staleTime: 1_800_000, queryFn: ({ signal }) => apiPage<Price>('prices', [symbol], { exchange, from, to, interval: '1d', size: 500, page }, signal) });
  return <section className="panel"><div className="panel-heading"><div><h2>Giá đóng cửa đã lưu trong hệ thống</h2><span className="muted">Đơn vị {query.data?.items[0]?.currency || 'theo nguồn'} · có nguồn và cơ sở giá</span></div><div className="segments">{[[30, '1T'], [90, '3T'], [180, '6T'], [365, '1N']].map(([value, label]) => <button className={days === value ? 'selected' : ''} key={value} onClick={() => { setDays(Number(value)); setPage(0); }}>{label}</button>)}</div></div><QueryState loading={query.isPending} error={query.error} empty={!query.data?.items.length} retry={query.refetch}><PriceChart prices={query.data?.items || []} /></QueryState>{query.data && (page > 0 || query.data.hasNext) && <Pagination page={page} hasNext={query.data.hasNext} total={query.data.total} onChange={setPage} />}<Note>Dữ liệu chuẩn hóa từ backend (canonical, phiên bản ACTIVATED). Đường nối ngắt khi nguồn hoặc cơ sở giá thay đổi. Dùng để đối chiếu với giá trực tiếp.</Note></section>;
}

function ProfilePanel({ security }: { security?: Security }) {
  const company = security?.company;
  const website = safeUrl(company?.website);
  return <section className="panel profile"><h2>{security?.companyName}</h2><dl>{[['Ngành', security?.industryName], ['Mã công ty', company?.companyCode], ['Trụ sở', company?.headquarters], ['Ngày thành lập', date(company?.foundedDate)], ['Tiền tệ', security?.currency]].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{text(value)}</dd></div>)}</dl><p>{text(company?.description, 'Hồ sơ doanh nghiệp chưa có phần giới thiệu.')}</p>{website && <a href={website} target="_blank" rel="noopener noreferrer">Website doanh nghiệp ↗</a>}</section>;
}

export type { Row };
