import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { apiPage, type Security } from './api';
import { useBasket } from './live';
import { securityLink } from './ui';
import { mergeSuggestions, type Suggestion } from './search';


function useDebounced<T>(value: T, ms: number): T {
  const [state, setState] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setState(value), ms); return () => clearTimeout(timer); }, [value, ms]);
  return state;
}

export function SearchBox() {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(term.trim(), 250);
  const system = useQuery({ queryKey: ['search', debounced], enabled: debounced.length >= 1, staleTime: 1_800_000, queryFn: ({ signal }) => apiPage<Security>('securities', [], { search: debounced, size: 8 }, signal) });
  const hose = useBasket(open ? 'HOSE' : null); const hnx = useBasket(open ? 'HNX' : null); const upcom = useBasket(open ? 'UPCOM' : null);
  const items = useMemo(() => mergeSuggestions(term, system.data?.items || [], { HOSE: hose.data, HNX: hnx.data, UPCOM: upcom.data }), [term, system.data, hose.data, hnx.data, upcom.data]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) { event.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (item?: Suggestion) => {
    const value = term.trim();
    if (item) window.location.hash = securityLink(item.symbol, item.exchange).slice(1);
    else if (value) window.location.hash = '/securities?search=' + encodeURIComponent(value);
    setOpen(false); setTerm(''); input.current?.blur();
  };

  return <form className="search-box" role="search" onSubmit={event => { event.preventDefault(); go(items[active] && term.trim() ? items[active] : undefined); }}>
    <Search size={17} />
    <input ref={input} aria-label="Tìm kiếm toàn cục" aria-expanded={open && items.length > 0} aria-controls="search-suggestions" role="combobox" autoComplete="off"
      placeholder="Tìm mã hoặc doanh nghiệp… (phím /)" value={term}
      onChange={event => { setTerm(event.target.value); setOpen(true); setActive(0); }}
      onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => Math.min(i + 1, items.length - 1)); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
        else if (event.key === 'Escape') { setOpen(false); input.current?.blur(); }
      }} />
    <button type="submit">Tìm</button>
    {open && term.trim() && <ul id="search-suggestions" className="suggestions" role="listbox">
      {items.length ? items.map((item, i) => <li key={item.exchange + item.symbol} role="option" aria-selected={i === active}>
        <button type="button" className={i === active ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => go(item)} onMouseEnter={() => setActive(i)}>
          <strong>{item.symbol}</strong><span className="exchange">{item.exchange}</span><span className="name">{item.name || (item.inSystem ? '' : 'Chỉ có giá trực tiếp')}</span>
        </button></li>)
        : <li className="empty">{system.isFetching ? 'Đang tìm…' : 'Không có mã phù hợp. Nhấn Enter để tìm theo tên.'}</li>}
    </ul>}
  </form>;
}
