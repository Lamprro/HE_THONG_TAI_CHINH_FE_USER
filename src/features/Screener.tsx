import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, RotateCcw } from 'lucide-react';
import { apiData, apiPage, type Security } from '../shared/api';
import { date, fixed, signed, text, trimmed } from '../shared/format';
import { useLiveQuotes } from '../shared/live';
import { Follow, Note, Pagination, QueryState, securityLink } from '../shared/ui';

export type Filters = { exchanges: { exchange: string; count: string }[]; industries: { name: string; count: string }[]; metricOrigins: string[] };
export type MetricDef = { code: string; name: string; unit: string; category?: string; description?: string | null };
type ScreenRow = Security & { metricCode: string | null; metricName: string | null; unit: string | null; value: string | null; valueText: string | null; derived: boolean | null; asOfDate: string | null; sourceCode: string | null; metricState: string | null; candidateCount: string | null };

export function useFilters() {
  return useQuery({ queryKey: ['market-filters'], staleTime: 3_600_000, queryFn: ({ signal }) => apiData<Filters>('marketFilters', [], {}, signal) });
}
export function useMetricCatalog() {
  return useQuery({ queryKey: ['metric-catalog'], staleTime: 3_600_000, queryFn: ({ signal }) => apiPage<MetricDef>('metrics', [], { size: 100 }, signal) });
}

const presets = [
  { label: 'P/E thấp', metric: 'PRICE_TO_EARNINGS', sort: 'METRIC_ASC', min: '0', max: '' },
  { label: 'P/B dưới 1,5', metric: 'PRICE_TO_BOOK', sort: 'METRIC_ASC', min: '0', max: '1.5' },
  { label: 'Cổ tức cao', metric: 'DIVIDEND_YIELD', sort: 'METRIC_DESC', min: '', max: '' },
  { label: 'ROE cao', metric: 'ROE', sort: 'METRIC_DESC', min: '', max: '' },
];
const empty = { search: '', exchange: '', industry: '', metric: 'PRICE_TO_EARNINGS', origin: 'PROVIDER', min: '', max: '', sort: 'METRIC_ASC' };
const decimalPattern = /^-?\d+(\.\d+)?$/;

export function ScreenerPage() {
  const [form, setForm] = useState(empty);
  const [applied, setApplied] = useState(empty);
  const [page, setPage] = useState(0);
  const filters = useFilters();
  const catalog = useMetricCatalog();
  const invalid = [applied.min, applied.max].some(v => v && !decimalPattern.test(v));
  const query = useQuery({
    queryKey: ['screener', applied, page], enabled: !invalid, staleTime: 900_000,
    queryFn: ({ signal }) => apiPage<ScreenRow>('screener', [], { search: applied.search || undefined, exchange: applied.exchange || undefined, industry: applied.industry || undefined, metric: applied.metric || undefined, origin: applied.origin, min: applied.metric && applied.min ? applied.min : undefined, max: applied.metric && applied.max ? applied.max : undefined, sort: applied.metric ? applied.sort : 'SYMBOL', page, size: 25 }, signal),
  });
  const quotes = useLiveQuotes((query.data?.items || []).map(r => r.symbol));
  const set = (key: keyof typeof empty, value: string) => setForm(current => ({ ...current, [key]: value }));
  const apply = (next = form) => { setApplied(next); setPage(0); };
  const def = catalog.data?.items.find(m => m.code === applied.metric);
  return <>
    <div className="page-heading"><div><p className="eyebrow">KHÁM PHÁ CƠ HỘI</p><h1>Bộ lọc cổ phiếu</h1><p>Lọc theo sàn, ngành và chỉ số tài chính mới nhất đã lưu; giá cập nhật trực tiếp.</p></div></div>
    <section className="panel"><form className="screener-form" onSubmit={event => { event.preventDefault(); apply(); }}>
      <label>Từ khóa<input value={form.search} onChange={e => set('search', e.target.value)} placeholder="Mã hoặc tên" /></label>
      <label>Sàn<select value={form.exchange} onChange={e => set('exchange', e.target.value)}><option value="">Tất cả</option>{filters.data?.data.exchanges.map(x => <option key={x.exchange} value={x.exchange}>{x.exchange} ({x.count})</option>)}</select></label>
      <label>Ngành<select value={form.industry} onChange={e => set('industry', e.target.value)}><option value="">Tất cả</option>{filters.data?.data.industries.map(x => <option key={x.name} value={x.name}>{x.name} ({x.count})</option>)}</select></label>
      <label>Chỉ số<select value={form.metric} onChange={e => set('metric', e.target.value)}><option value="">Không lọc chỉ số</option>{catalog.data?.items.map(m => <option key={m.code} value={m.code}>{m.name} ({m.unit})</option>)}</select></label>
      <label>Nguồn<select value={form.origin} onChange={e => set('origin', e.target.value)}><option value="PROVIDER">Nhà cung cấp</option><option value="DERIVED">Java tính</option></select></label>
      <label>Từ<input inputMode="decimal" value={form.min} onChange={e => set('min', e.target.value.replace(',', '.'))} placeholder="min" disabled={!form.metric} /></label>
      <label>Đến<input inputMode="decimal" value={form.max} onChange={e => set('max', e.target.value.replace(',', '.'))} placeholder="max" disabled={!form.metric} /></label>
      <label>Sắp xếp<select value={form.sort} onChange={e => set('sort', e.target.value)}><option value="SYMBOL">Mã A→Z</option><option value="METRIC_ASC" disabled={!form.metric}>Chỉ số tăng dần</option><option value="METRIC_DESC" disabled={!form.metric}>Chỉ số giảm dần</option></select></label>
      <div className="form-actions"><button type="submit" className="primary"><Filter size={14} />Lọc</button><button type="button" onClick={() => { setForm(empty); apply(empty); }}><RotateCcw size={14} />Đặt lại</button></div>
    </form>
      <div className="preset-row">{presets.map(p => <button key={p.label} className="chip" onClick={() => { const next = { ...form, metric: p.metric, sort: p.sort, min: p.min, max: p.max }; setForm(next); apply(next); }}>{p.label}</button>)}</div>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>{query.data ? `${query.data.total} mã phù hợp` : 'Kết quả'}</h2><span className="muted">{def ? `${def.name} (${def.unit}) · giá trị mới nhất đến hôm nay` : 'Danh sách mã đang hoạt động'}</span></div></div>
      {invalid && <p className="inline-alert" role="alert">Giá trị từ/đến cần là số thập phân (vd 1.5).</p>}
      <QueryState loading={!invalid && query.isPending} error={query.error} empty={!invalid && !query.data?.items.length} retry={query.refetch}><div className="table-scroll"><table><thead><tr><th /><th>Mã</th><th>Doanh nghiệp</th><th>Sàn</th><th>Ngành</th><th className="number">Giá (nghìn)</th><th className="number">+/- %</th>{applied.metric && <><th className="number">{def?.name || applied.metric}</th><th>Ngày / nguồn</th></>}</tr></thead>
        <tbody>{query.data?.items.map(row => { const q = quotes.data?.[row.symbol]; const tone = q?.change == null ? '' : q.change > 0 ? 'positive' : q.change < 0 ? 'negative' : 'reference'; return <tr key={row.id}><td><Follow listing={row} /></td><td><a className="ticker" href={securityLink(row.symbol, row.exchange)}>{row.symbol}</a></td><td className="wrap">{row.companyName}</td><td>{row.exchange}</td><td>{text(row.industryName)}</td><td className={'number ' + tone}>{fixed(q?.price)}</td><td className={'number ' + tone}>{signed(q?.changePercent, 2, '%')}</td>{applied.metric && <><td className="number">{row.metricState === 'AVAILABLE' ? (row.value === null ? text(row.valueText) : trimmed(Number(row.value).toFixed(4))) : <span className="muted" title={row.metricState || ''}>{row.metricState === 'AMBIGUOUS' ? 'Nhiều bản' : '—'}</span>} <small>{row.unit}</small></td><td>{date(row.asOfDate)}<small>{row.derived ? 'Java tính' : text(row.sourceCode)}</small></td></>}</tr>; })}</tbody></table></div></QueryState>
      {query.data && <Pagination page={page} total={query.data.total} hasNext={query.data.hasNext} onChange={setPage} />}
      <Note>Lọc trên chỉ số canonical VALID/WARNING mới nhất đã lưu. “Nhiều bản” = có nhiều giá trị cùng ngày, hệ thống không tự chọn. Không phải khuyến nghị đầu tư.</Note>
    </section>
  </>;
}
