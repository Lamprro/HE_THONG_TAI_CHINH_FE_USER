import { Component, Suspense, lazy, type ReactNode } from 'react';
import { ArrowUpRight, Bot, Landmark, ChartNoAxesCombined, Database, Filter, GitCompareArrows, LayoutDashboard, ListFilter, Newspaper, Star } from 'lucide-react';
import { MarketPage, SecuritiesPage, WatchlistPage } from '../features/Market';
import { fixed, signed } from '../shared/format';
import { liveEnabled, liveSources, useLiveQuotes } from '../shared/live';
import { SearchBox } from '../shared/SearchBox';
import { securityLink, useRoute, useWatchlist } from '../shared/ui';

const SecurityPage = lazy(() => import('../features/Security').then(module => ({ default: module.SecurityPage })));
const NewsPage = lazy(() => import('../features/News').then(module => ({ default: module.NewsPage })));
const ArticlePage = lazy(() => import('../features/News').then(module => ({ default: module.ArticlePage })));
const ComparePage = lazy(() => import('../features/Compare').then(module => ({ default: module.ComparePage })));
const MacroPage = lazy(() => import('../features/Macro').then(module => ({ default: module.MacroPage })));
const AiCenterPage = lazy(() => import('../features/AiCenter').then(module => ({ default: module.AiCenterPage })));
const IndexPage = lazy(() => import('../features/IndexPage').then(module => ({ default: module.IndexPage })));
const ScreenerPage = lazy(() => import('../features/Screener').then(module => ({ default: module.ScreenerPage })));

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="state" role="alert"><h2>Trang chưa hiển thị được</h2><p>Hãy tải lại để thử kết nối và đọc dữ liệu lại.</p><button onClick={() => window.location.reload()}>Tải lại trang</button></div> : this.props.children;
  }
}

function decode(value: string) { try { return decodeURIComponent(value); } catch { return ''; } }

const navigation = [
  { group: 'THỊ TRƯỜNG', items: [
    { path: '/market', label: 'Tổng quan', icon: LayoutDashboard, match: '/index/' },
    { path: '/securities', label: 'Cổ phiếu', icon: ListFilter, match: '/security/' },
    { path: '/watchlist', label: 'Theo dõi', icon: Star },
  ] },
  { group: 'PHÂN TÍCH', items: [
    { path: '/screener', label: 'Bộ lọc', icon: Filter },
    { path: '/compare', label: 'So sánh', icon: GitCompareArrows },
    { path: '/macro', label: 'Vĩ mô', icon: Landmark },
    { path: '/ai', label: 'Trung tâm AI', icon: Bot },
  ] },
  { group: 'THÔNG TIN', items: [
    { path: '/news', label: 'Tin tức', icon: Newspaper, match: '/news/' },
  ] },
];

function route(path: string, params: URLSearchParams): ReactNode {
  if (path === '/market' || path === '/' || path === '') return <MarketPage />;
  if (path === '/watchlist') return <WatchlistPage />;
  if (path === '/securities') return <SecuritiesPage key={params.get('search')} initialSearch={params.get('search') || ''} />;
  if (path.startsWith('/security/')) return <SecurityPage key={path + params.toString()} symbol={decode(path.slice(10)).toUpperCase()} exchange={params.get('exchange') || ''} initialTab={params.get('tab') || undefined} />;
  if (path.startsWith('/index/')) return <IndexPage key={path} code={decode(path.slice(7)).toUpperCase()} />;
  if (path === '/screener') return <ScreenerPage />;
  if (path === '/macro') return <MacroPage />;
  if (path === '/ai') return <AiCenterPage />;
  if (path === '/compare') return <ComparePage initial={params.get('symbols') || ''} />;
  if (path === '/news') return <><div className="page-heading"><div><p className="eyebrow">THÔNG TIN & DOANH NGHIỆP</p><h1>Nhịp thị trường</h1><p>Đọc tin và theo dõi các cập nhật từ nguồn.</p></div></div><NewsPage /></>;
  if (path.startsWith('/news/')) return <ArticlePage key={path} id={decode(path.slice(6))} />;
  return <div className="state"><h1>Không tìm thấy trang</h1><a href="#/market">Về tổng quan</a></div>;
}

function RightRail() {
  const { saved } = useWatchlist();
  const quotes = useLiveQuotes(saved.slice(0, 20).map(row => row.symbol));
  return <aside className="right-rail">
    <div className="rail-heading"><Star size={17} /><h2>Theo dõi của bạn</h2><span>{saved.length}</span></div>
    {saved.length ? <ul>{saved.slice(0, 20).map(row => { const q = quotes.data?.[row.symbol]; const tone = q?.change == null ? '' : q.change > 0 ? 'positive' : q.change < 0 ? 'negative' : 'reference'; return <li key={row.exchange + row.symbol}><a href={securityLink(row.symbol, row.exchange)}><strong>{row.symbol}</strong><small>{row.exchange}</small></a><span className={'rail-price ' + tone}>{fixed(q?.price)}<small>{signed(q?.changePercent, 2, '%')}</small></span></li>; })}</ul>
      : <div className="rail-empty"><Star size={28} /><p>Thêm mã bạn quan tâm</p><span>Bấm ngôi sao cạnh mã cổ phiếu để lưu vào danh sách.</span><a href="#/securities">Khám phá cổ phiếu <ArrowUpRight size={14} /></a></div>}
    <div className="rail-note"><span className={'status-dot ' + (liveEnabled ? 'live' : '')} /><strong>{liveEnabled ? 'Giá trực tiếp' : 'Dữ liệu đã lưu'}</strong><p>{liveEnabled ? `Giá khớp từ ${liveSources.board}, nến từ ${liveSources.chart}. Lịch sử, BCTC và tin tức đọc từ hệ thống có nguồn.` : 'Nguồn trực tiếp đang tắt. Giá hiển thị là dữ liệu đã lưu kèm nguồn và phiên.'}</p></div>
    <div className="rail-foot">Phân tích bắt đầu<br />từ dữ liệu rõ ràng.</div>
  </aside>;
}

export function App() {
  const { path, params } = useRoute();
  const { saved } = useWatchlist();
  const active = (item: { path: string; match?: string }) => path === item.path || Boolean(item.match && path.startsWith(item.match)) || (item.path === '/market' && (path === '/' || path === ''));
  return <div className="app-shell">
    <aside className="sidebar"><a href="#/market" className="brand"><span><ChartNoAxesCombined size={24} /></span>TÀI CHÍNH<small>USER TERMINAL</small></a>
      {navigation.map(group => <div key={group.group}><p className="nav-caption">{group.group}</p><nav aria-label={group.group}>{group.items.map(item => <a key={item.path} href={'#' + item.path} className={active(item) ? 'active' : ''} aria-current={active(item) ? 'page' : undefined}><item.icon size={18} />{item.label}{item.path === '/watchlist' && saved.length > 0 && <span className="count">{saved.length}</span>}</a>)}</nav></div>)}
      <div className="sidebar-bottom"><Database size={17} /><span>Dữ liệu có nguồn<small>Giá · Tài chính · Tin tức</small></span></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><span className="workspace-label">Thị trường Việt Nam</span><SearchBox /><span className="profile-mark" title="Không gian cá nhân trên trình duyệt">CN</span></header>
      <div className="content-layout"><main id="main-content"><ErrorBoundary key={path}><Suspense fallback={<div className="state" role="status">Đang mở trang…</div>}>{route(path, params)}</Suspense></ErrorBoundary></main><RightRail /></div>
      <footer>© {new Date().getFullYear()} Tài Chính <span>Múi giờ dữ liệu · Asia/Ho_Chi_Minh</span></footer>
    </div>
  </div>;
}
