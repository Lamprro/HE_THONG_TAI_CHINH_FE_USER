import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, X } from 'lucide-react';
import { apiData, apiPage, type Row, type Statement } from '../shared/api';
import { compactDecimal, date, decimal, safeUrl, text, trimmed } from '../shared/format';
import { Note, Pagination, QueryState } from '../shared/ui';

type Item = { code: string; name: string; unit: string | null };
type Matrix = {
  statementType: string; hasEarlierPeriods?: boolean; missingCodes?: string[];
  periods: { id: string; fiscalYear: number; periodType: string; periodEnd: string }[];
  series: { code: string; name: string; unit: string; scope: string; basis: string; currency: string | null; unitScale: string | null; values: Record<string, { value: string | null; statementId: string; sourceCode: string; publishedAt: string | null }> }[];
};
type LineageKind = 'statement' | 'metric' | 'price';

const statementNames: Record<string, string> = { BALANCE_SHEET: 'Cân đối kế toán', INCOME_STATEMENT: 'Kết quả kinh doanh', CASH_FLOW: 'Lưu chuyển tiền tệ' };
const scopeNames: Record<string, string> = { CONSOLIDATED: 'Hợp nhất', SEPARATE: 'Riêng lẻ', UNKNOWN: 'Chưa rõ phạm vi' };
const typeNames: Record<string, string> = { INCOME_STATEMENT: 'Kết quả kinh doanh', BALANCE_SHEET: 'Cân đối kế toán', CASH_FLOW: 'Lưu chuyển tiền tệ' };
const preferred: Record<string, string[]> = {
  INCOME_STATEMENT: ['NET_SALES', 'COST_OF_GOODS_SOLD', 'GROSS_PROFIT', 'FINANCIAL_INCOME', 'FINANCIAL_EXPENSES', 'SELLING_EXPENSES', 'GENERAL_AND_ADMIN_EXPENSES', 'NET_PROFIT_FROM_OPERATING_ACTIVITIES', 'PRETAX_PROFIT', 'NET_PROFIT_AFTER_TAX', 'NET_PROFIT_AFTER_TAX_OF_PARENT_COMPANY', 'EARNINGS_PER_SHARE'],
  BALANCE_SHEET: ['CURRENT_ASSETS', 'CASH_AND_CASH_EQUIVALENTS', 'ACCOUNT_RECEIVABLE', 'INVENTORIES', 'FIXED_ASSETS', 'TOTAL_ASSETS', 'LIABILITIES', 'SHORT_TERM_LIABILITIES', 'LONG_TERM_LIABILITIES', 'OWNERS_EQUITY', 'CAPITAL_AND_RESEARVES', 'COMMON_SHARES'],
  CASH_FLOW: ['NET_CASHFLOW_FROM_OPERATING_ACTIVITIES', 'NET_CASHFLOW_FROM_INVESTING_ACTIVITIES', 'NET_CASHFLOW_FROM_FINANCING_ACTIVITIES', 'NET_CASH_AND_CASH_EQUIVALENTS_DURING_THE_PERIOD', 'CASH_AND_CASH_EQUIVALENTS_AT_END_OF_YEAR', 'PURCHASES_OF_FIXED_ASSETS_AND_OTHER_LONG_TERM_ASSETS', 'DIVIDENDS_AND_PROFIT_PAID', 'DEPRECIATION_OF_FIXED_ASSETS_EXPENSES'],
};

async function allItems(symbol: string, exchange: string, type: string, signal: AbortSignal): Promise<Item[]> {
  const found = new Map<string, Item>();
  for (let page = 0; page < 6; page++) {
    const result = await apiPage<Item>('statementItems', [symbol], { exchange, type, page, size: 100 }, signal);
    result.items.forEach(item => { if (!found.has(item.code)) found.set(item.code, item); });
    if (!result.hasNext) break;
  }
  return [...found.values()];
}

export function defaultCodes(type: string, items: Item[]): string[] {
  const codes = new Set(items.map(item => item.code));
  const picked = (preferred[type] || []).filter(code => codes.has(code));
  for (const item of items) { if (picked.length >= 8) break; if (!picked.includes(item.code)) picked.push(item.code); }
  return picked.slice(0, 20);
}

export function LineageDialog({ kind, symbol, exchange, id, onClose }: { kind: LineageKind; symbol: string; exchange: string; id: string; onClose: () => void }) {
  const operation = kind === 'statement' ? 'lineage' : kind === 'metric' ? 'metricLineage' : 'priceLineage';
  const query = useQuery({ queryKey: ['lineage', kind, symbol, exchange, id], staleTime: 3_600_000, queryFn: ({ signal }) => apiData<Row>(operation, [symbol, id], { exchange }, signal) });
  const data = query.data?.data;
  const url = safeUrl(data?.sourceUrl);
  const fields: [string, unknown][] = data ? Object.entries(data).filter(([key, value]) => !['sourceUrl'].includes(key) && (typeof value !== 'object' || value === null)) : [];
  return <div className="dialog-backdrop" role="presentation" onClick={onClose}><div className="dialog" role="dialog" aria-modal="true" aria-label="Nguồn dữ liệu" onClick={event => event.stopPropagation()}>
    <div className="panel-heading"><div><h2><Link2 size={15} /> Nguồn gốc dữ liệu</h2><span className="muted">{kind === 'statement' ? 'Báo cáo' : kind === 'metric' ? 'Chỉ số' : 'Giá'} · {id}</span></div><button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={16} /></button></div>
    <QueryState loading={query.isPending} error={query.error} retry={query.refetch}><dl className="stats lineage">{fields.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{/At$|Date$|timestamp/i.test(key) && typeof value === 'string' ? `${date(value)} · ${value}` : text(value === null ? null : typeof value === 'boolean' ? String(value) : value)}</dd></div>)}</dl>{url && <p className="dialog-link"><a href={url} target="_blank" rel="noopener noreferrer">Mở nguồn gốc ↗</a></p>}</QueryState>
    <Note>{query.data?.meta.notes?.join(' ') || 'Chỉ hiển thị projection công khai; không có raw body/header.'}</Note>
  </div></div>;
}

export function FinancialMatrixPanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const [type, setType] = useState('INCOME_STATEMENT');
  const [period, setPeriod] = useState('QUARTER');
  const [limit, setLimit] = useState(8);
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [lineage, setLineage] = useState('');
  const items = useQuery({ queryKey: ['statement-items', symbol, exchange, type], staleTime: 3_600_000, queryFn: ({ signal }) => allItems(symbol, exchange, type, signal) });
  const codes = chosen[type] || (items.data ? defaultCodes(type, items.data) : []);
  const matrix = useQuery({ queryKey: ['financials', symbol, exchange, type, period, limit, codes.join(',')], enabled: codes.length > 0, staleTime: 1_800_000, queryFn: ({ signal }) => apiData<Matrix>('financials', [symbol], { exchange, type, period, codes: codes.join(','), periodLimit: limit }, signal) });
  const data = matrix.data?.data;
  const toggle = (code: string) => setChosen(current => { const list = current[type] || codes; const next = list.includes(code) ? list.filter(c => c !== code) : [...list, code].slice(0, 20); return { ...current, [type]: next }; });
  const ordered = useMemo(() => data ? [...data.series].sort((a, b) => codes.indexOf(a.code) - codes.indexOf(b.code)) : [], [data, codes]);
  return <>
    <section className="panel"><div className="panel-heading"><div><h2>Ma trận tài chính</h2><span className="muted">{typeNames[type]} · kỳ tăng dần · giá trị đã lưu (bấm ô để xem nguồn)</span></div><div className="toolbar">
      <select aria-label="Loại báo cáo ma trận" value={type} onChange={event => setType(event.target.value)}>{Object.entries(typeNames).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select aria-label="Kỳ ma trận" value={period} onChange={event => setPeriod(event.target.value)}><option value="QUARTER">Theo quý</option><option value="FY">Theo năm</option>{['Q1', 'Q2', 'Q3', 'Q4'].map(q => <option key={q} value={q}>Chỉ {q}</option>)}</select>
      <select aria-label="Số kỳ" value={limit} onChange={event => setLimit(Number(event.target.value))}>{[4, 8, 12, 20].map(n => <option key={n} value={n}>{n} kỳ</option>)}</select>
    </div></div>
      <details className="item-picker"><summary>Chọn chỉ tiêu ({codes.length}/20) · {items.data?.length ?? '…'} chỉ tiêu có dữ liệu</summary><div className="chips">{items.data?.map(item => <button key={item.code} className={'chip ' + (codes.includes(item.code) ? 'on' : '')} onClick={() => toggle(item.code)} title={item.code}>{item.name}</button>)}</div></details>
      <QueryState loading={items.isPending || (codes.length > 0 && matrix.isPending)} error={items.error || matrix.error} empty={!data?.periods.length} retry={() => { items.refetch(); matrix.refetch(); }}>
        <div className="table-scroll"><table className="matrix"><thead><tr><th>Chỉ tiêu</th>{data?.periods.map(p => <th key={p.id} className="number">{p.periodType}/{p.fiscalYear}</th>)}</tr></thead>
          <tbody>{ordered.map(series => <tr key={series.code + series.scope + series.basis + series.unit}><td className="sticky"><span>{series.name}</span><small>{series.unit}{series.scope !== 'UNKNOWN' ? ' · ' + series.scope : ''}{series.basis !== 'UNKNOWN' ? ' · ' + series.basis : ''}</small></td>{data?.periods.map(p => { const cell = series.values[p.id]; return <td key={p.id} className="number">{cell ? <button className="cell-link" title={`${decimal(cell.value)} ${series.unit} · ${cell.sourceCode}`} onClick={() => setLineage(cell.statementId)}>{series.unit === 'VND' && !/PER_SHARE|EPS/.test(series.code) ? compactDecimal(cell.value) : trimmed(cell.value)}</button> : <span className="muted">—</span>}</td>; })}</tr>)}</tbody></table></div>
      </QueryState>
      {data?.missingCodes?.length ? <p className="inline-alert">Không có dữ liệu trong các kỳ đã chọn: {data.missingCodes.join(', ')}</p> : null}
      <Note>Không tự nhân unitScale, không tính TTM/annualize, ô thiếu hiển thị “—”. Series tách theo phạm vi/cơ sở kỳ/đơn vị. Giá trị VND hiển thị rút gọn; di chuột để xem số chính xác.</Note>
    </section>
    <FinancialPanel symbol={symbol} exchange={exchange} />
    {lineage && <LineageDialog kind="statement" symbol={symbol} exchange={exchange} id={lineage} onClose={() => setLineage('')} />}
  </>;
}

type Metric = Row & { id: string; code: string; name: string; unit: string; value: string | null; valueText: string | null; asOfDate: string | null; derived: boolean; sourceCode: string | null; qualityStatus: string; periodType: string | null; periodEnd: string | null; calculationVersion: string | null };

export function MetricsPanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const [origin, setOrigin] = useState('');
  const [code, setCode] = useState('');
  const [page, setPage] = useState(0);
  const [lineage, setLineage] = useState('');
  const catalog = useQuery({ queryKey: ['metric-catalog'], staleTime: 3_600_000, queryFn: ({ signal }) => apiPage<{ code: string; name: string; unit: string; category?: string }>('metrics', [], { size: 100 }, signal) });
  const query = useQuery({ queryKey: ['security-metrics', symbol, exchange, origin, code, page], staleTime: 1_800_000, queryFn: ({ signal }) => apiPage<Metric>('securityMetrics', [symbol], { exchange, origin: origin || undefined, codes: code || undefined, page, size: 50 }, signal) });
  return <section className="panel"><div className="panel-heading"><div><h2>Chỉ số tài chính đã lưu</h2><span className="muted">Canonical VALID/WARNING · bấm để xem nguồn và công thức</span></div><div className="toolbar">
    <select aria-label="Chỉ số" value={code} onChange={event => { setCode(event.target.value); setPage(0); }}><option value="">Tất cả chỉ số</option>{catalog.data?.items.map(m => <option key={m.code} value={m.code}>{m.name} ({m.unit})</option>)}</select>
    <select aria-label="Nguồn gốc" value={origin} onChange={event => { setOrigin(event.target.value); setPage(0); }}><option value="">Mọi nguồn</option><option value="PROVIDER">Nhà cung cấp</option><option value="DERIVED">Java tính</option></select>
  </div></div>
    <QueryState loading={query.isPending} error={query.error} empty={!query.data?.items.length} retry={query.refetch}><div className="table-scroll"><table><thead><tr><th>Chỉ số</th><th className="number">Giá trị</th><th>Đơn vị</th><th>Ngày / Kỳ</th><th>Nguồn</th><th>Chất lượng</th><th /></tr></thead><tbody>{query.data?.items.map(row => <tr key={row.id}><td>{row.name}<small>{row.code}</small></td><td className="number">{row.value == null ? text(row.valueText) : decimal(row.value)}</td><td>{row.unit}</td><td>{date(row.asOfDate)}<small>{row.periodType ? `${row.periodType} · ${date(row.periodEnd)}` : '—'}</small></td><td>{row.derived ? 'Java tính' : text(row.sourceCode)}<small>{text(row.calculationVersion)}</small></td><td>{row.qualityStatus}</td><td><button onClick={() => setLineage(row.id)}>Nguồn</button></td></tr>)}</tbody></table></div></QueryState>
    {query.data && <Pagination page={page} total={query.data.total} hasNext={query.data.hasNext} onChange={setPage} />}
    <Note>Ngày chỉ số không phải ngày công bố đã xác minh. GET không tính lại chỉ số.</Note>
    {lineage && <LineageDialog kind="metric" symbol={symbol} exchange={exchange} id={lineage} onClose={() => setLineage('')} />}
  </section>;
}

export function FinancialPanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const [type, setType] = useState('INCOME_STATEMENT');
  const [period, setPeriod] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState('');
  const reports = useQuery({ queryKey: ['statements', symbol, exchange, type, period, page], staleTime: 1_800_000, queryFn: ({ signal }) => apiPage<Statement>('statements', [symbol], { exchange, type, period: period || undefined, page, size: 10 }, signal) });
  const statement = useQuery({ queryKey: ['statement', symbol, exchange, selected], enabled: Boolean(selected), staleTime: 1_800_000, queryFn: ({ signal }) => apiData<Statement>('statement', [symbol, selected], { exchange }, signal) });
  return <><section className="panel"><div className="panel-heading"><h2>Báo cáo tài chính</h2><div className="toolbar"><select aria-label="Loại báo cáo" value={type} onChange={event => { setType(event.target.value); setPage(0); setSelected(''); }}>{Object.entries(statementNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Kỳ báo cáo" value={period} onChange={event => { setPeriod(event.target.value); setPage(0); setSelected(''); }}><option value="">Tất cả kỳ</option>{['Q1', 'Q2', 'Q3', 'Q4', 'FY'].map(value => <option key={value}>{value}</option>)}</select></div></div><QueryState loading={reports.isPending} error={reports.error} empty={!reports.data?.items.length} retry={reports.refetch}><div className="table-scroll"><table><thead><tr><th>Kỳ</th><th>Phạm vi / Cơ sở kỳ</th><th>Nguồn</th><th>Ngày công bố</th><th>Chi tiết</th></tr></thead><tbody>{reports.data?.items.map(report => <tr key={report.id}><td>{report.periodType} / {report.fiscalYear}</td><td>{scopeNames[report.reportScope] || report.reportScope}<small>{report.periodBasis}</small></td><td>{report.sourceCode}</td><td>{date(report.publishedAt)}</td><td><button onClick={() => setSelected(report.id)} aria-pressed={selected === report.id}>Xem chỉ tiêu</button></td></tr>)}</tbody></table></div></QueryState>{reports.data && <Pagination page={page} total={reports.data.total} hasNext={reports.data.hasNext} onChange={value => { setPage(value); setSelected(''); }} />}</section>
    {selected && <section className="panel"><div className="panel-heading"><h2>Chỉ tiêu {statement.data?.data.periodType} {statement.data?.data.fiscalYear}</h2><button onClick={() => setSelected('')}>Đóng chi tiết</button></div><QueryState loading={statement.isPending} error={statement.error} empty={!statement.data?.data.items?.length} retry={statement.refetch}><div className="table-scroll"><table><thead><tr><th>Chỉ tiêu</th><th className="number">Giá trị đã lưu</th><th>Đơn vị</th></tr></thead><tbody>{statement.data?.data.items?.map(item => <tr key={item.code}><td>{item.name}<small>{item.code}</small></td><td className="number">{decimal(item.value)}</td><td>{item.unit || '—'}</td></tr>)}</tbody></table></div></QueryState><Note>{scopeNames[statement.data?.data.reportScope || 'UNKNOWN']} · {statement.data?.data.periodBasis} · {statement.data?.data.currency}. Đọc đơn vị từng chỉ tiêu. Thông tin chưa xác định được hiển thị “—”.</Note></section>}
  </>;
}
