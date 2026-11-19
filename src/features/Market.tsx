import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw, Search, TrendingDown, TrendingUp, Upload } from 'lucide-react';
import { apiData, apiPage, type Market, type Security } from '../shared/api';
import { BreadthBar, Sparkline } from '../shared/charts';
import { compactVnd, date, decimal, fixed, int, signed } from '../shared/format';
import { isTradingTime, sessionLabel } from '../shared/live-parse';
import { liveEnabled, liveSources, useBasket, useCandles, useLiveIndices, useLiveQuotes, type Basket, type LiveIndex, type LiveQuote } from '../shared/live';
import { Follow, Note, Pagination, QueryState, securityLink, useTitle, useWatchlist } from '../shared/ui';
import { PriceBoard, type BoardRow } from './PriceBoard';

export function useMarket(exchange = '') {
  return useQuery({ queryKey: ['market', exchange], staleTime: 900_000, queryFn: ({ signal }) => apiData<Market>('marketOverview', [], { exchange: exchange || undefined }, signal) });
}

const indexCards = [
  { code: 'VNINDEX', chart: 'VNINDEX', name: 'VN-Index' },
  { code: 'VN30', chart: 'VN30', name: 'VN30' },
  { code: 'HNXINDEX', chart: 'HNX', name: 'HNX-Index' },
  { code: 'UPCOM', chart: 'UPCOM', name: 'UPCoM' },
];

function IndexCard({ code, chart, name, live, stored }: { code: string; chart: string; name: string; live?: LiveIndex; stored?: { close: string | null; tradingDate: string | null } }) {
  const candles = useCandles(chart, '1D');
  const tone = live?.change == null ? '' : live.change > 0 ? 'positive' : live.change < 0 ? 'negative' : 'reference';
  return <a className="index-card" href={'#/index/' + code} aria-label={'Xem chi tiết ' + name}>
    <span className="label">{name}<small>{live?.time ? 'Lúc ' + live.time : 'Đã lưu'}</small></span>
    {live?.value != null
      ? <><strong className={tone}>{fixed(live.value)}</strong><span className={'index-change ' + tone}>{signed(live.change)} ({signed(live.changePercent, 2, '%')})</span></>
      : <><strong>{decimal(stored?.close)}</strong><span className="index-change muted">Phiên {date(stored?.tradingDate)} · dữ liệu hệ thống</span></>}
    <Sparkline values={(candles.data || []).map(row => row.close)} reference={live?.reference} width={220} height={44} label={`Diễn biến ${name} trong phiên`} />
    <small>{live ? <>KL {int(live.volume)} · GT {compactVnd(live.valueMillion === null ? null : live.valueMillion * 1e6)}</> : code}</small>
    {live?.advances != null && <div className="index-breadth"><span className="positive">▲ {live.advances}</span><span className="reference">■ {live.unchanged}</span><span className="negative">▼ {live.declines}</span></div>}
  </a>;
}

export function IndexStrip({ stored }: { stored?: Market['indices'] }) {
  const live = useLiveIndices();
  return <div className="index-grid">{indexCards.map(card => <IndexCard key={card.code} {...card} live={live.data?.find(row => row.code === card.code)} stored={stored?.find(row => row.code === card.code)} />)}</div>;
}

function Movers({ quotes, rows, scope }: { quotes: Record<string, LiveQuote> | undefined; rows: BoardRow[]; scope: string }) {
  const ranked = rows.map(row => ({ row, q: quotes?.[row.symbol] })).filter(item => item.q?.changePercent != null).sort((a, b) => (b.q!.changePercent! - a.q!.changePercent!));
  if (!ranked.length) return null;
  const list = (items: typeof ranked, title: string, Icon: typeof TrendingUp) => <div className="movers-col"><h3><Icon size={15} />{title}</h3>{items.map(({ row, q }) => <a key={row.symbol} href={securityLink(row.symbol, row.exchange)} className="mover"><strong>{row.symbol}</strong><span>{fixed(q!.price)}</span><span className={q!.change! > 0 ? 'positive' : q!.change! < 0 ? 'negative' : 'reference'}>{signed(q!.changePercent, 2, '%')}</span></a>)}</div>;
  return <section className="panel movers">{list(ranked.slice(0, 5), 'Tăng mạnh nhất · ' + scope, TrendingUp)}{list(ranked.slice(-5).reverse(), 'Giảm mạnh nhất · ' + scope, TrendingDown)}</section>;
}

const boardTabs = [
  { key: 'SYSTEM', label: 'Mã hệ thống' }, { key: 'VN30', label: 'VN30' }, { key: 'HNX30', label: 'HNX30' },
  { key: 'HOSE', label: 'HOSE' }, { key: 'HNX', label: 'HNX' }, { key: 'UPCOM', label: 'UPCoM' },
] as const;
type BoardTab = (typeof boardTabs)[number]['key'];
const basketExchange: Record<string, string> = { VN30: 'HOSE', HNX30: 'HNX', HOSE: 'HOSE', HNX: 'HNX', UPCOM: 'UPCOM' };

export function MarketPage() {
  const [board, setBoard] = useState<BoardTab>(() => { try { return (localStorage.getItem('financial-user.board') as BoardTab) || 'SYSTEM'; } catch { return 'SYSTEM'; } });
  const [exchange, setExchange] = useState('');
  const [search, setSearch] = useState('');
  const market = useMarket(exchange);
  const data = market.data?.data;
  const basket = useBasket(board === 'SYSTEM' ? null : board as Basket);
  const tracked = useMemo(() => new Map((data?.securities || []).map(row => [row.symbol, row])), [data]);
  const rows: BoardRow[] = useMemo(() => board === 'SYSTEM'
    ? (data?.securities || []).map(row => ({ symbol: row.symbol, exchange: row.exchange, companyName: row.companyName, stored: row }))
    : (basket.data || []).map(symbol => { const stored = tracked.get(symbol); return { symbol, exchange: stored?.exchange || basketExchange[board], companyName: stored?.companyName, stored }; }), [board, data, basket.data, tracked]);
  const big = rows.length > 60;
  const quotes = useLiveQuotes(rows.map(row => row.symbol), big ? 15_000 : 10_000);
  const liveIndices = useLiveIndices();
  const vnindex = liveIndices.data?.find(row => row.code === 'VNINDEX');
  const filtered = rows.filter(row => (row.symbol + ' ' + (row.companyName || '')).toLowerCase().includes(search.toLowerCase()));
  const open = isTradingTime();
  const chooseBoard = (value: BoardTab) => { setBoard(value); setSearch(''); try { localStorage.setItem('financial-user.board', value); } catch { /* optional */ } };
  const listPending = board === 'SYSTEM' ? market.isPending : basket.isPending;
  const listError = board === 'SYSTEM' ? market.error : basket.error;
  useTitle(vnindex?.value != null ? `VN-Index ${fixed(vnindex.value)} ${signed(vnindex.changePercent, 2, '%')}` : 'Tổng quan thị trường');
  return <>
    <div className="page-heading"><div><p className="eyebrow">GÓC NHÌN THỊ TRƯỜNG</p><h1>Tổng quan thị trường</h1><p>Chỉ số, bảng giá trực tiếp và độ rộng thị trường. <span className={'session-pill ' + (open ? 'open' : '')}>{sessionLabel()}{open ? ` · tự cập nhật ${big ? 15 : 10} giây` : ''}</span></p></div><button disabled={market.isFetching || quotes.isFetching} onClick={() => { market.refetch(); quotes.refetch(); liveIndices.refetch(); }}><RefreshCw size={15} />Cập nhật</button></div>
    <IndexStrip stored={data?.indices} />
    {vnindex?.advances != null && <section className="panel breadth-panel"><div><h2>Độ rộng HOSE</h2><span className="muted">Nguồn {liveSources.board} · {vnindex.time}</span></div><BreadthBar up={vnindex.advances} down={vnindex.declines || 0} flat={vnindex.unchanged || 0} /><div className="breadth-legend"><span className="positive">{vnindex.advances} tăng</span><span className="reference">{vnindex.unchanged} đứng giá</span><span className="negative">{vnindex.declines} giảm</span></div></section>}
    <Movers quotes={quotes.data} rows={rows} scope={boardTabs.find(t => t.key === board)?.label || ''} />
    <section className="panel"><nav className="board-tabs" aria-label="Chọn bảng giá">{boardTabs.map(tab => <button key={tab.key} className={board === tab.key ? 'active' : ''} aria-pressed={board === tab.key} onClick={() => chooseBoard(tab.key)}>{tab.label}</button>)}</nav>
      <div className="panel-heading"><div><h2>{board === 'SYSTEM' ? 'Bảng giá các mã hệ thống theo dõi' : `Bảng giá ${boardTabs.find(t => t.key === board)?.label} · ${rows.length} mã`}</h2><span className="muted">Giá trực tiếp {liveSources.board} (nghìn VND){board === 'SYSTEM' ? ` · giá đã lưu phiên ${date(data?.latestStoredTradingDate)} (VND)` : ' · danh sách rổ từ ' + liveSources.board + ', mã có dữ liệu hệ thống hiển thị tên công ty'}</span></div><div className="toolbar"><label className="search"><Search size={16} /><input aria-label="Lọc bảng giá" placeholder="Lọc mã, doanh nghiệp…" value={search} onChange={event => setSearch(event.target.value)} /></label>{board === 'SYSTEM' && <select aria-label="Sàn giao dịch" value={exchange} onChange={event => setExchange(event.target.value)}><option value="">Tất cả sàn</option><option>HOSE</option><option>HNX</option><option>UPCOM</option></select>}</div></div>
      {board === 'SYSTEM' && data && <div className="breadth"><span>Dữ liệu hệ thống:</span><span className="positive">{data.breadth.rising} tăng</span><span className="negative">{data.breadth.falling} giảm</span><span>{data.breadth.unchanged} tham chiếu</span><span className="muted">{data.breadth.missingPrice} thiếu giá · {data.breadth.olderSession} phiên cũ</span></div>}
      {quotes.error && <p className="inline-alert" role="alert">Nguồn giá trực tiếp lỗi: {quotes.error.message}.{board === 'SYSTEM' ? ' Đang hiển thị giá đã lưu.' : ''}</p>}
      <QueryState loading={listPending} error={listError} empty={!listPending && filtered.length === 0} retry={board === 'SYSTEM' ? market.refetch : basket.refetch}><PriceBoard key={board} rows={filtered} quotes={quotes.data} /></QueryState>
      <Note>{liveEnabled ? `Giá khớp, dư mua/bán và khối ngoại lấy trực tiếp từ ${liveSources.board}, đơn vị giá nghìn VND, khối lượng cổ phiếu. ` : 'Nguồn trực tiếp đang tắt. '}Cột “Giá đã lưu” là dữ liệu chuẩn hóa của hệ thống (VND, có nguồn và phiên). Bấm tiêu đề cột để sắp xếp. Màu: tím trần, xanh lam sàn, vàng tham chiếu; ô nháy khi giá thay đổi.</Note>
    </section>
  </>;
}

function WatchlistTools() {
  const { saved, replaceAll } = useWatchlist();
  const [message, setMessage] = useState('');
  const exportFile = () => {
    const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'danh-sach-theo-doi.json'; link.click(); URL.revokeObjectURL(url);
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 100_000) { setMessage('File quá lớn.'); return; }
    const count = replaceAll(await file.text());
    setMessage(count ? `Đã nhập ${count} mã.` : 'File không có mã hợp lệ.');
  };
  return <div className="toolbar"><button onClick={exportFile} disabled={!saved.length}><Download size={14} />Xuất file</button><label className="button"><Upload size={14} />Nhập file<input type="file" accept="application/json,.json" hidden onChange={event => { importFile(event.target.files?.[0]); event.target.value = ''; }} /></label>{message && <span className="muted" role="status">{message}</span>}</div>;
}

export function WatchlistPage() {
  const { saved } = useWatchlist();
  const quotes = useLiveQuotes(saved.map(row => row.symbol));
  const rows: BoardRow[] = saved.map(row => ({ symbol: row.symbol, exchange: row.exchange, companyName: row.companyName }));
  return <>
    <div className="page-heading"><div><p className="eyebrow">KHÔNG GIAN CÁ NHÂN</p><h1>Danh sách theo dõi</h1><p>Các mã bạn đã lưu trên trình duyệt này, giá cập nhật trực tiếp.</p></div><button disabled={quotes.isFetching || !saved.length} onClick={() => quotes.refetch()}><RefreshCw size={15} />Cập nhật</button></div>
    <section className="panel"><div className="panel-heading"><div><h2>{saved.length} mã đang theo dõi</h2><span className="muted">Nguồn {liveSources.board} · nghìn VND</span></div><WatchlistTools /></div>
      {quotes.error && <p className="inline-alert" role="alert">{quotes.error.message}</p>}
      {saved.length ? <PriceBoard rows={rows} quotes={quotes.data} /> : <div className="state"><strong>Chưa có mã nào</strong><span>Bấm ngôi sao cạnh mã cổ phiếu để thêm vào danh sách.</span><a href="#/securities">Khám phá cổ phiếu</a></div>}
      <Note>Danh sách lưu trong localStorage của trình duyệt (tối đa 100 mã); dùng Xuất/Nhập file để chuyển sang máy khác. Backend chưa có hợp đồng watchlist tài khoản.</Note>
    </section>
  </>;
}

export function SecuritiesPage({ initialSearch = '' }: { initialSearch?: string }) {
  const [input, setInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [exchange, setExchange] = useState('');
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ['securities', search, exchange, page], staleTime: 1_800_000, queryFn: ({ signal }) => apiPage<Security>('securities', [], { search, exchange: exchange || undefined, page, size: 25 }, signal) });
  const quotes = useLiveQuotes((query.data?.items || []).map(row => row.symbol));
  return <><div className="page-heading"><div><p className="eyebrow">KHÁM PHÁ DOANH NGHIỆP</p><h1>Cổ phiếu</h1><p>Tìm hồ sơ, lịch sử giá và báo cáo theo từng mã.</p></div></div><section className="panel"><form className="panel-heading" onSubmit={event => { event.preventDefault(); setSearch(input.trim()); setPage(0); }}><label className="search"><Search size={16} /><input aria-label="Tìm mã hoặc tên công ty" value={input} onChange={event => setInput(event.target.value)} placeholder="Mã chứng khoán hoặc tên công ty" /></label><select aria-label="Lọc sàn" value={exchange} onChange={event => { setExchange(event.target.value); setPage(0); }}><option value="">Tất cả sàn</option><option>HOSE</option><option>HNX</option><option>UPCOM</option></select><button type="submit" className="primary">Tìm kiếm</button></form><QueryState loading={query.isPending} error={query.error} empty={!query.data?.items.length} retry={query.refetch}><div className="table-scroll"><table><thead><tr><th>Mã</th><th>Doanh nghiệp</th><th>Sàn</th><th>Ngành</th><th className="number">Giá (nghìn)</th><th className="number">+/- %</th><th>Theo dõi</th></tr></thead><tbody>{query.data?.items.map(row => { const q = quotes.data?.[row.symbol]; const tone = q?.change == null ? '' : q.change > 0 ? 'positive' : q.change < 0 ? 'negative' : 'reference'; return <tr key={row.id}><td><a className="ticker" href={securityLink(row.symbol, row.exchange)}>{row.symbol}</a></td><td>{row.companyName}</td><td>{row.exchange}</td><td>{row.industryName || '—'}</td><td className={'number ' + tone}>{fixed(q?.price)}</td><td className={'number ' + tone}>{signed(q?.changePercent, 2, '%')}</td><td><Follow listing={row} /></td></tr>; })}</tbody></table></div></QueryState>{query.data && <Pagination page={page} total={query.data.total} hasNext={query.data.hasNext} onChange={setPage} />}</section></>;
}
