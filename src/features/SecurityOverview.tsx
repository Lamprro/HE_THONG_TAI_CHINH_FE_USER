import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { apiData, type Article, type Data, type Page, type Row, type Security, type Statement } from '../shared/api';
import { compactDecimal, date, decimal, text } from '../shared/format';
import { Note, QueryState } from '../shared/ui';

export type DataStatus = {
  security: Security;
  prices: { count: string; firstTimestamp: string | null; lastTimestamp: string | null; lastStoredAt: string | null };
  statements: { count: string; firstPeriodEnd: string | null; lastPeriodEnd: string | null; missingPublishedAt: string; unknownScope: string; unknownPeriodBasis: string; lastStoredAt: string | null };
  metrics: { count: string; firstAsOfDate: string | null; lastAsOfDate: string | null; lastStoredAt: string | null };
  news: { count: string; lastPublishedAt: string | null; lastCrawledAt: string | null };
  availability: string; limitations: string[]; pointInTimeCertified: boolean;
};
type Overview = {
  profile: Data<Security>; dataStatus: Data<DataStatus>; statements: Page<Statement>; metrics: Page<Row>; news: Page<Article>;
  financialScenarios: Data<Row[]>; financialScenarioState: string; localAi: Data<Row & { state?: string; models?: Row[] }>;
};
type Compare = { asOf: string; definitions: { code: string; name: string; unit: string }[]; securities: (Security & { metrics: (Row & { metricCode: string; value: string | null; unit: string; asOfDate: string | null; metricState: string })[] })[] };
type Matrix = { periods: { id: string; fiscalYear: number; periodType: string }[]; series: { code: string; name: string; unit: string; scope: string; values: Record<string, { value: string | null }> }[] };

const limitationNames: Record<string, string> = {
  PUBLICATION_DATES_INCOMPLETE: 'Thiếu ngày công bố báo cáo', REPORT_SCOPE_INCOMPLETE: 'Chưa rõ hợp nhất/riêng lẻ', PERIOD_BASIS_INCOMPLETE: 'Chưa rõ cơ sở kỳ (lũy kế/đơn quý)',
  PRICES_MISSING: 'Thiếu giá', STATEMENTS_MISSING: 'Thiếu báo cáo', METRICS_MISSING: 'Thiếu chỉ số',
};
const availabilityNames: Record<string, string> = { PARTIAL: 'Một phần', AVAILABLE_WITH_UNVERIFIED_HISTORY: 'Đủ nhóm dữ liệu, lịch sử chưa kiểm chứng', UNAVAILABLE: 'Chưa có dữ liệu' };
export const keyMetricCodes = ['PRICE_TO_EARNINGS', 'PRICE_TO_BOOK', 'EPS', 'BVPS', 'ROE', 'ROA', 'GROSS_MARGIN', 'NET_MARGIN', 'DEBT_TO_EQUITY', 'DIVIDEND_YIELD', 'REVENUE_GROWTH_YOY', 'NET_INCOME_GROWTH_YOY'];

export function DataStatusCard({ status }: { status?: DataStatus }) {
  if (!status) return null;
  const ok = status.availability !== 'PARTIAL' && status.availability !== 'UNAVAILABLE';
  return <section className="panel"><div className="panel-heading"><div><h2>Trạng thái dữ liệu</h2><span className="muted">Độ phủ dữ liệu đã lưu trong hệ thống cho mã này</span></div><span className={'status-chip ' + (ok ? 'ok' : 'warn')}>{ok ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}{availabilityNames[status.availability] || status.availability}</span></div>
    <div className="coverage-grid">
      <div><span>Giá ngày</span><strong>{decimal(status.prices.count)}</strong><small>{date(status.prices.firstTimestamp)} → {date(status.prices.lastTimestamp)}</small></div>
      <div><span>Báo cáo tài chính</span><strong>{decimal(status.statements.count)}</strong><small>Kỳ {date(status.statements.firstPeriodEnd)} → {date(status.statements.lastPeriodEnd)}</small></div>
      <div><span>Chỉ số</span><strong>{decimal(status.metrics.count)}</strong><small>{date(status.metrics.firstAsOfDate)} → {date(status.metrics.lastAsOfDate)}</small></div>
      <div><span>Tin tức</span><strong>{decimal(status.news.count)}</strong><small>Tin mới nhất {date(status.news.lastPublishedAt)}</small></div>
    </div>
    {status.limitations.length > 0 && <div className="limitations">{status.limitations.map(item => <span key={item}>{limitationNames[item] || item}</span>)}</div>}
    <Note>Lưu lần cuối: giá {date(status.prices.lastStoredAt)}, báo cáo {date(status.statements.lastStoredAt)}. Độ phủ không chứng nhận đủ mọi phiên/kỳ; dữ liệu point-in-time {status.pointInTimeCertified ? 'đã' : 'chưa'} được chứng nhận.</Note>
  </section>;
}

function Bars({ title, unit, values }: { title: string; unit: string; values: { label: string; value: number | null; raw: string | null }[] }) {
  const max = Math.max(1, ...values.map(v => Math.abs(v.value ?? 0)));
  return <div className="bars"><h3>{title}<small>{unit}</small></h3><div className="bars-row">{values.map(v => <div key={v.label} className="bar-col" title={v.raw ?? 'Không có dữ liệu'}><span className="bar-value">{compactDecimal(v.raw)}</span><span className={'bar ' + ((v.value ?? 0) < 0 ? 'neg' : '')} style={{ height: `${Math.abs(v.value ?? 0) / max * 100}%` }} /><span className="bar-label">{v.label}</span></div>)}</div></div>;
}

function QuarterlyBars({ symbol, exchange }: { symbol: string; exchange: string }) {
  const query = useQuery({ queryKey: ['financials-overview', symbol, exchange], staleTime: 1_800_000, queryFn: ({ signal }) => apiData<Matrix>('financials', [symbol], { exchange, type: 'INCOME_STATEMENT', period: 'QUARTER', codes: 'NET_SALES,NET_PROFIT_AFTER_TAX', periodLimit: 8 }, signal) });
  const matrix = query.data?.data;
  const pick = (code: string) => {
    const series = matrix?.series.find(s => s.code === code);
    return { unit: series?.unit || '', values: (matrix?.periods || []).map(p => { const raw = series?.values[p.id]?.value ?? null; return { label: `${p.periodType}/${String(p.fiscalYear).slice(2)}`, raw, value: raw === null ? null : Number(raw) }; }) };
  };
  const sales = pick('NET_SALES'); const profit = pick('NET_PROFIT_AFTER_TAX');
  return <section className="panel"><div className="panel-heading"><div><h2>Kết quả kinh doanh theo quý</h2><span className="muted">Giá trị đã lưu, 8 kỳ gần nhất, không cộng dồn hay quy đổi</span></div></div>
    <QueryState loading={query.isPending} error={query.error} empty={!matrix?.periods.length} retry={query.refetch}><div className="bars-grid"><Bars title="Doanh thu thuần" unit={sales.unit} values={sales.values} /><Bars title="Lợi nhuận sau thuế" unit={profit.unit} values={profit.values} /></div></QueryState>
    <Note>Phạm vi và cơ sở kỳ lấy theo từng series của backend; khi nguồn ghi UNKNOWN, giá trị có thể là lũy kế hoặc đơn quý.</Note>
  </section>;
}

export function KeyMetrics({ symbol, exchange }: { symbol: string; exchange: string }) {
  const query = useQuery({ queryKey: ['compare-self', symbol, exchange], staleTime: 1_800_000, queryFn: ({ signal }) => apiData<Compare>('compare', [], { symbols: symbol, exchange, codes: keyMetricCodes.join(','), origin: 'PROVIDER' }, signal) });
  const derived = useQuery({ queryKey: ['compare-self-derived', symbol, exchange], staleTime: 1_800_000, queryFn: ({ signal }) => apiData<Compare>('compare', [], { symbols: symbol, exchange, codes: keyMetricCodes.join(','), origin: 'DERIVED' }, signal) });
  const metrics = [...(query.data?.data.securities[0]?.metrics || []), ...(derived.data?.data.securities[0]?.metrics || [])];
  const defs = [...(query.data?.data.definitions || []), ...(derived.data?.data.definitions || [])];
  const rows = keyMetricCodes.map(code => metrics.find(m => m.metricCode === code && m.metricState === 'AVAILABLE')).filter(Boolean) as Compare['securities'][0]['metrics'];
  return <section className="panel"><div className="panel-heading"><div><h2>Chỉ số chính</h2><span className="muted">Giá trị mới nhất đã lưu theo từng chỉ số (nguồn cung cấp hoặc Java tính)</span></div></div>
    <QueryState loading={query.isPending} error={query.error} empty={!rows.length} retry={query.refetch}><div className="metric-tiles">{rows.map(m => <div key={m.metricCode + text(m.derived)} className="metric-tile"><span>{defs.find(d => d.code === m.metricCode)?.name || m.metricCode}</span><strong>{decimal(m.value === null ? null : Number(m.value).toFixed(2))}<small>{m.unit}</small></strong><small>{date(m.asOfDate)} · {m.derived ? 'Java tính' : text(m.sourceCode)}</small></div>)}</div></QueryState>
  </section>;
}

export function OverviewPanel({ symbol, exchange, openTab }: { symbol: string; exchange: string; openTab: (tab: 'financials' | 'news' | 'ai') => void }) {
  const query = useQuery({ queryKey: ['overview', symbol, exchange], staleTime: 900_000, queryFn: ({ signal }) => apiData<Overview>('overview', [symbol], { exchange }, signal) });
  const data = query.data?.data;
  const security = data?.profile.data;
  return <QueryState loading={query.isPending} error={query.error} retry={query.refetch}>
    <div className="overview-grid">
      <div>
        <KeyMetrics symbol={symbol} exchange={exchange} />
        <QuarterlyBars symbol={symbol} exchange={exchange} />
        <section className="panel"><div className="panel-heading"><h2>Tin mới</h2><button onClick={() => openTab('news')}>Xem tất cả</button></div>
          {data?.news.items.length ? <ul className="plain-list">{data.news.items.map(item => <li key={item.id}><a href={'#/news/' + encodeURIComponent(item.id)}>{item.title}</a><small>{item.sourceName} · {date(item.publishedAt)}</small></li>)}</ul> : <div className="state"><strong>Chưa có tin liên kết</strong></div>}
        </section>
      </div>
      <div>
        <section className="panel"><div className="panel-heading"><h2>Thông tin niêm yết</h2></div><dl className="stats">{[['Sàn', security?.exchange], ['Loại', security?.securityType], ['Ngày niêm yết', date(security?.listedDate)], ['Mệnh giá', decimal(security?.parValue)], ['Cổ phiếu lưu hành', decimal(security?.sharesOutstanding)], ['Ngành', security?.industryName], ['Lĩnh vực', security?.sectorName]].map(([k, v]) => <div key={String(k)}><dt>{String(k)}</dt><dd>{text(v)}</dd></div>)}</dl></section>
        <DataStatusCard status={data?.dataStatus.data} />
        <section className="panel"><div className="panel-heading"><h2>Báo cáo gần nhất</h2><button onClick={() => openTab('financials')}>Chi tiết</button></div><ul className="plain-list">{data?.statements.items.map(item => <li key={item.id}><span>{item.periodType}/{item.fiscalYear} · {item.statementType}</span><small>{item.sourceCode} · công bố {date(item.publishedAt)}</small></li>)}</ul></section>
        <section className="panel"><div className="panel-heading"><h2>AI</h2><button onClick={() => openTab('ai')}>Xem</button></div><dl className="stats"><div><dt>Kịch bản tài chính</dt><dd>{data?.financialScenarioState === 'NO_ELIGIBLE_RESULT' ? 'Chưa có kết quả đủ điều kiện' : text(data?.financialScenarioState)}</dd></div><div><dt>Local AI</dt><dd>{text(data?.localAi.data.state)}</dd></div></dl></section>
      </div>
    </div>
  </QueryState>;
}
