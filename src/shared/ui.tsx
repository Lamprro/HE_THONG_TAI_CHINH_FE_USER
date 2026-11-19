import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Star } from 'lucide-react';
import { parseWatchlist, WATCH_KEY, type SavedListing } from './watchlist';

export function securityLink(symbol: string, exchange: string): string {
  return '#/security/' + encodeURIComponent(symbol) + '?exchange=' + encodeURIComponent(exchange);
}

export function useRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/market');
  useEffect(() => {
    const update = () => { setHash(window.location.hash || '#/market'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const [path, query] = hash.slice(1).split('?');
  return { path, params: new URLSearchParams(query) };
}

/** Browser tab title; restores the app name on unmount. */
export function useTitle(title: string) {
  useEffect(() => { document.title = title + ' · Tài Chính'; return () => { document.title = 'Tài Chính • Thị trường'; }; }, [title]);
}

export function useWatchlist() {
  const read = () => { try { return parseWatchlist(localStorage.getItem(WATCH_KEY)); } catch { return []; } };
  const [saved, setSaved] = useState(read);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    const update = () => setSaved(read());
    window.addEventListener('storage', update);
    window.addEventListener('watchlist-change', update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('watchlist-change', update); };
  }, []);
  function toggle(listing: SavedListing) {
    const current = read();
    const exists = current.some(row => row.symbol === listing.symbol && row.exchange === listing.exchange);
    if (!exists && current.length >= 100) { setStorageError('Danh sách đã có 100 mã. Hãy bỏ một mã trước khi thêm.'); return; }
    const next = exists ? current.filter(row => row.symbol !== listing.symbol || row.exchange !== listing.exchange) : [...current, listing];
    try {
      localStorage.setItem(WATCH_KEY, JSON.stringify(next));
      setSaved(next);
      setStorageError('');
      window.dispatchEvent(new Event('watchlist-change'));
    } catch { setStorageError('Trình duyệt chưa cho phép lưu danh sách theo dõi.'); }
  }
  /** Replace the whole list (import). Input goes through the same validation as stored data. */
  function replaceAll(raw: string): number {
    const next = parseWatchlist(raw);
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(next)); setSaved(next); setStorageError(''); window.dispatchEvent(new Event('watchlist-change')); }
    catch { setStorageError('Trình duyệt chưa cho phép lưu danh sách theo dõi.'); }
    return next.length;
  }
  return { saved, toggle, replaceAll, storageError };
}

export function Follow({ listing }: { listing: SavedListing }) {
  const { saved, toggle, storageError } = useWatchlist();
  const selected = saved.some(row => row.symbol === listing.symbol && row.exchange === listing.exchange);
  // Watchlist keys are symbol + exchange; without an exchange the entry would be rejected on read.
  if (!listing.exchange) return <button className="icon-button" disabled aria-label={'Chưa xác định sàn của ' + listing.symbol} title="Chưa xác định sàn"><Star size={16} /></button>;
  return <><button className={'icon-button ' + (selected ? 'starred' : '')} aria-label={(selected ? 'Bỏ theo dõi ' : 'Theo dõi ') + listing.symbol} aria-pressed={selected} onClick={() => toggle(listing)}><Star size={16} fill={selected ? 'currentColor' : 'none'} /></button>{storageError && <span role="alert" className="negative">{storageError}</span>}</>;
}

/** Vietnamese message for API client errors (kind/status come from user-api.mjs). */
export function errorMessage(error: unknown): string {
  const e = error as { kind?: string; status?: number; message?: string } | null;
  if (!e) return 'Kiểm tra kết nối tới dịch vụ dữ liệu.';
  if (e.kind === 'NETWORK') return 'Không kết nối được máy chủ dữ liệu. Kiểm tra backend đang chạy và cấu hình CORS.';
  if (e.kind === 'TIMEOUT') return 'Máy chủ phản hồi quá lâu. Thử lại sau ít phút.';
  if (e.kind === 'INVALID_RESPONSE') return 'Máy chủ trả dữ liệu không đúng định dạng.';
  if (e.status === 404) return 'Không tìm thấy dữ liệu trong hệ thống cho lựa chọn này.';
  if (e.status === 409) return 'Mã đang niêm yết trên nhiều sàn, hãy chọn sàn cụ thể.';
  if (e.status === 400) return 'Tham số tra cứu chưa hợp lệ' + (e.message ? `: ${e.message}` : '.');
  if (e.status === 422) return 'Kết quả vượt giới hạn hiển thị, hãy thu hẹp bộ lọc.';
  if (e.status && e.status >= 500) return 'Máy chủ dữ liệu đang lỗi (HTTP ' + e.status + ').';
  return e.message || 'Đã có lỗi khi tải dữ liệu.';
}

export function QueryState({ loading, error, empty, retry, children }: { loading: boolean; error: unknown; empty?: boolean; retry: () => unknown; children: ReactNode }) {
  if (loading) return <div className="state" role="status"><span className="spinner" />Đang tải dữ liệu…</div>;
  if (error) return <div className="state error" role="alert"><AlertCircle size={24} /><strong>Chưa tải được dữ liệu</strong><span>{errorMessage(error)}</span><button onClick={() => retry()}><RefreshCw size={14} />Thử lại</button></div>;
  if (empty) return <div className="state"><strong>Chưa có dữ liệu trong phạm vi đã chọn</strong><span>Thử đổi mã, sàn hoặc kỳ tra cứu.</span></div>;
  return <>{children}</>;
}

export function Pagination({ page, hasNext, total, onChange }: { page: number; hasNext: boolean; total?: number; onChange: (page: number) => void }) {
  return <div className="pagination"><span>Trang {page + 1}{total !== undefined ? ` · ${total} bản ghi` : ''}</span><button aria-label="Trang trước" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></button><button aria-label="Trang sau" disabled={!hasNext} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></button></div>;
}

export function Note({ children }: { children: ReactNode }) { return <p className="note">{children}</p>; }
