import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCompareArrows, X } from 'lucide-react';
import { apiData, type Security } from '../shared/api';
import { date, fixed, signed, text, trimmed } from '../shared/format';
import { useLiveQuotes } from '../shared/live';
import { Note, QueryState, securityLink } from '../shared/ui';
import { useMetricCatalog } from './Screener';
import { keyMetricCodes } from './SecurityOverview';

type CompareMetric = { metricCode: string; value: string | null; valueText: string | null; unit: string; asOfDate: string | null; derived: boolean; sourceCode: string | null; metricState: string };
type CompareData = { asOf: string; origin: string; definitions: { code: string; name: string; unit: string; category?: string }[]; unknownCodes: string[]; securities: (Security & { metrics: CompareMetric[] })[] };

const symbolPattern = /^[A-Z0-9]{1,20}$/;
function parseSymbols(value: string): string[] {
  return [...new Set(value.toUpperCase().split(/[\s,;]+/).filter(s => symbolPattern.test(s)))].slice(0, 10);
}

export function ComparePage({ initial = '' }: { initial?: string }) {
  const [symbols, setSymbols] = useState(parseSymbols(initial || 'FPT,ACB,VNM'));
  const [input, setInput] = useState('');
  const [origin, setOrigin] = useState('AUTO');
  const [codes, setCodes] = useState<string[]>(keyMetricCodes.slice(0, 12));
  const catalog = useMetricCatalog();
  const query = useQuery({
    queryKey: ['compare', symbols, codes, origin], enabled: symbols.length > 0 && codes.length > 0, staleTime: 900_000,
    queryFn: async ({ signal }) => {
      const load = (o: string) => apiData<CompareData>('compare', [], { symbols: symbols.join(','), codes: codes.join(','), origin: o }, signal);
      if (origin !== 'AUTO') return load(origin);
      // AUTO: provider value first, Java-derived value when the provider has none.
      const [provider, derived] = await Promise.all([load('PROVIDER'), load('DERIVED')]);
      const securities = provider.data.securities.map(sec => {
        const other = derived.data.securities.find(d => d.id === sec.id);
        return { ...sec, metrics: codes.map(code => { const p = sec.metrics.find(m => m.metricCode === code); const d = other?.metrics.find(m => m.metricCode === code); return p?.metricState === 'AVAILABLE' ? p : d?.metricState === 'AVAILABLE' ? d : p || d; }).filter((m): m is CompareMetric => Boolean(m)) };
      });
      const definitions = [...provider.data.definitions, ...derived.data.definitions.filter(d => !provider.data.definitions.some(p => p.code === d.code))];
      return { ...provider, data: { ...provider.data, origin: 'AUTO', definitions, unknownCodes: provider.data.unknownCodes.filter(c => derived.data.unknownCodes.includes(c)), securities } };
    },
  });
  const quotes = useLiveQuotes(symbols);
  const data = query.data?.data;
  const update = (next: string[]) => { setSymbols(next); window.history.replaceState(null, '', '#/compare?symbols=' + next.join(',')); };
  const add = () => { update(parseSymbols([...symbols, ...parseSymbols(input)].join(','))); setInput(''); };
  const best = (code: string) => {
    const values = (data?.securities || []).map(s => s.metrics.find(m => m.metricCode === code)).map(m => m?.metricState === 'AVAILABLE' && m.value !== null ? Number(m.value) : null);
    const valid = values.filter((v): v is number => v !== null);
    if (valid.length < 2) return null;
    const lowerBetter = ['PRICE_TO_EARNINGS', 'PRICE_TO_BOOK', 'PE', 'PB', 'DEBT_TO_EQUITY', 'LIABILITIES_TO_ASSETS', 'LIABILITIES_TO_EQUITY'].includes(code);
    return lowerBetter ? Math.min(...valid) : Math.max(...valid);
  };
  return <>
    <div className="page-heading"><div><p className="eyebrow">PHÂN TÍCH TƯƠNG QUAN</p><h1>So sánh doanh nghiệp</h1><p>Đặt tối đa 10 mã cạnh nhau theo các chỉ số mới nhất đã lưu.</p></div></div>
    <section className="panel"><div className="compare-controls">
      <div className="symbol-chips">{symbols.map(s => <span key={s} className="chip on">{s}<button className="icon-button" aria-label={'Bỏ ' + s} onClick={() => update(symbols.filter(x => x !== s))}><X size={12} /></button></span>)}</div>
      <form onSubmit={event => { event.preventDefault(); add(); }} className="toolbar"><input aria-label="Thêm mã so sánh" value={input} onChange={e => setInput(e.target.value)} placeholder="Thêm mã, vd HPG, MBB" /><button type="submit" disabled={symbols.length >= 10}><GitCompareArrows size={14} />Thêm</button>
        <select aria-label="Nguồn chỉ số" value={origin} onChange={e => setOrigin(e.target.value)}><option value="AUTO">Tự động (ưu tiên nhà cung cấp)</option><option value="PROVIDER">Nhà cung cấp</option><option value="DERIVED">Java tính</option></select></form>
    </div>
      <details className="item-picker"><summary>Chọn chỉ số ({codes.length}/20)</summary><div className="chips">{catalog.data?.items.map(m => <button key={m.code} className={'chip ' + (codes.includes(m.code) ? 'on' : '')} onClick={() => setCodes(c => c.includes(m.code) ? c.filter(x => x !== m.code) : [...c, m.code].slice(0, 20))}>{m.name}</button>)}</div></details>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Bảng so sánh</h2><span className="muted">Tính đến {date(data?.asOf)} · {origin === 'AUTO' ? 'nhà cung cấp, bổ sung chỉ số Java tính' : origin === 'PROVIDER' ? 'chỉ số nhà cung cấp' : 'chỉ số Java tính'} · ô viền xanh là giá trị tốt nhất trong nhóm</span></div></div>
      {data?.unknownCodes.length ? <p className="inline-alert">Không có định nghĩa cho: {data.unknownCodes.join(', ')}</p> : null}
      <QueryState loading={query.isPending && symbols.length > 0} error={query.error} empty={!data?.securities.length} retry={query.refetch}><div className="table-scroll"><table className="compare"><thead><tr><th>Chỉ số</th>{data?.securities.map(s => <th key={s.id} className="number"><a className="ticker" href={securityLink(s.symbol, s.exchange)}>{s.symbol}</a><small>{s.exchange} · {text(s.industryName)}</small></th>)}</tr></thead>
        <tbody>
          <tr className="live-row"><td>Giá trực tiếp (nghìn VND)</td>{data?.securities.map(s => { const q = quotes.data?.[s.symbol]; const tone = q?.change == null ? '' : q.change > 0 ? 'positive' : q.change < 0 ? 'negative' : 'reference'; return <td key={s.id} className={'number ' + tone}>{fixed(q?.price)}<small>{signed(q?.changePercent, 2, '%')}</small></td>; })}</tr>
          {data?.definitions.map(def => { const top = best(def.code); return <tr key={def.code}><td>{def.name}<small>{def.unit}</small></td>{data.securities.map(s => { const m = s.metrics.find(x => x.metricCode === def.code); const ok = m?.metricState === 'AVAILABLE'; const v = ok && m?.value !== null ? Number(m!.value) : null; return <td key={s.id} className={'number ' + (top !== null && v === top ? 'best' : '')} title={m ? `${m.metricState} · ${m.asOfDate || ''} · ${m.derived ? 'Java' : m.sourceCode || ''}` : ''}>{ok ? (m!.value === null ? text(m!.valueText) : trimmed(Number(m!.value).toFixed(2))) : <span className="muted">{m?.metricState === 'AMBIGUOUS' ? 'Nhiều bản' : '—'}</span>}<small>{ok ? date(m!.asOfDate) : ''}</small></td>; })}</tr>; })}
        </tbody></table></div></QueryState>
      <Note>Mỗi ô là giá trị canonical mới nhất của mã đó, ngày có thể khác nhau giữa các mã. “Tốt nhất” chỉ là so sánh số học trong nhóm (P/E, P/B, nợ: thấp hơn; còn lại: cao hơn), không phải khuyến nghị.</Note>
    </section>
  </>;
}
