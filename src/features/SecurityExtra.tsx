import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, ShieldAlert } from 'lucide-react';
import { apiData, apiPage, type Row } from '../shared/api';
import { compactVolume, date, decimal, text, tradingToday } from '../shared/format';
import { Note, Pagination, QueryState } from '../shared/ui';

type Foreign = { id: string; tradingDate: string; buyVolume: string | null; sellVolume: string | null; volumeUnit: string; sourceCode: string };

export function ForeignPanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const [days, setDays] = useState(90);
  const [page, setPage] = useState(0);
  const to = tradingToday();
  const fromDate = new Date(to + 'T00:00:00Z'); fromDate.setUTCDate(fromDate.getUTCDate() - days);
  const from = fromDate.toISOString().slice(0, 10);
  const query = useQuery({ queryKey: ['foreign', symbol, exchange, from, page], staleTime: 1_800_000, queryFn: ({ signal }) => apiPage<Foreign>('foreignTrades', [symbol], { exchange, from, to, page, size: 100 }, signal) });
  const rows = query.data?.items || [];
  const nets = rows.map(r => (r.buyVolume === null || r.sellVolume === null) ? null : Number(r.buyVolume) - Number(r.sellVolume));
  const max = Math.max(1, ...nets.map(n => Math.abs(n ?? 0)));
  const total = nets.reduce<number>((sum, n) => sum + (n ?? 0), 0);
  return <section className="panel"><div className="panel-heading"><div><h2>Giao dịch khối ngoại</h2><span className="muted">Khối lượng mua/bán đã lưu (CP) · ròng trong khoảng: <b className={total >= 0 ? 'positive' : 'negative'}>{compactVolume(total)}</b></span></div><div className="segments">{[[30, '1T'], [90, '3T'], [180, '6T'], [365, '1N']].map(([v, l]) => <button key={v} className={days === v ? 'selected' : ''} onClick={() => { setDays(Number(v)); setPage(0); }}>{l}</button>)}</div></div>
    <QueryState loading={query.isPending} error={query.error} empty={!rows.length} retry={query.refetch}>
      <div className="net-bars" role="img" aria-label="Khối lượng ròng khối ngoại theo phiên">{nets.map((n, i) => <span key={rows[i].id} title={`${rows[i].tradingDate}: ${compactVolume(n)}`} className={(n ?? 0) >= 0 ? 'up' : 'down'} style={{ height: `${Math.abs(n ?? 0) / max * 50}%` }} />)}</div>
      <details><summary>Bảng chi tiết {rows.length} phiên</summary><div className="table-scroll price-history"><table><thead><tr><th>Phiên</th><th className="number">Mua</th><th className="number">Bán</th><th className="number">Ròng</th><th>Nguồn</th></tr></thead><tbody>{[...rows].reverse().map((r, i) => { const n = nets[rows.length - 1 - i]; return <tr key={r.id}><td>{date(r.tradingDate)}</td><td className="number">{decimal(r.buyVolume === null ? null : String(Math.round(Number(r.buyVolume))))}</td><td className="number">{decimal(r.sellVolume === null ? null : String(Math.round(Number(r.sellVolume))))}</td><td className={'number ' + ((n ?? 0) >= 0 ? 'positive' : 'negative')}>{compactVolume(n)}</td><td>{r.sourceCode}</td></tr>; })}</tbody></table></div></details>
    </QueryState>
    {query.data && (page > 0 || query.data.hasNext) && <Pagination page={page} total={query.data.total} hasNext={query.data.hasNext} onChange={setPage} />}
    <Note>Dữ liệu canonical đã lưu; thiếu khối lượng giữ trống, không thay bằng 0. Khối ngoại trong phiên hiện tại xem ở Sổ lệnh (nguồn trực tiếp).</Note>
  </section>;
}

type LocalModel = { modelId: string; horizonQuarters: number; targetPeriod: string; selectedAlgorithm: string; developmentGatePassed: boolean; registeredInputs: string; storedSelectedResearchResults: string; firstInputAsOf: string | null; lastInputAsOf: string | null; readiness: string; publicResultsAvailable: boolean; outputContract?: { type?: string; unit?: string; note?: string; fields?: string[] } };
type SecurityLocalAi = { state?: string; publicResultsAvailable: boolean; executionAvailable: boolean; models: LocalModel[]; package?: Row | null };

const stateNames: Record<string, string> = { RESEARCH_ONLY: 'Nghiên cứu (chưa công bố)', NOT_INSTALLED: 'Chưa cài registry', NO_REGISTERED_PACKAGE: 'Chưa có gói', TICKER_IDENTITY_AMBIGUOUS: 'Mã trùng nhiều sàn', NO_REGISTERED_INPUT: 'Chưa có input cho mã' };

export function LocalAiTable({ models }: { models: LocalModel[] }) {
  return <div className="table-scroll"><table><thead><tr><th>Mô hình</th><th>Kỳ dự báo</th><th>Thuật toán chọn</th><th>Kiểu đầu ra</th><th className="number">Input</th><th className="number">Kết quả lưu</th><th>Dữ liệu đến</th><th>Cổng dev</th><th>Trạng thái</th></tr></thead>
    <tbody>{models.map(m => <tr key={m.modelId}><td><strong>{m.modelId}</strong></td><td>H{m.horizonQuarters} · {m.targetPeriod}</td><td>{m.selectedAlgorithm}</td><td>{text(m.outputContract?.type)}<small>{text(m.outputContract?.unit)}</small></td><td className="number">{decimal(m.registeredInputs)}</td><td className="number">{decimal(m.storedSelectedResearchResults)}</td><td>{date(m.lastInputAsOf)}</td><td>{m.developmentGatePassed ? <span className="positive">Đạt</span> : <span className="muted">Chưa đạt</span>}</td><td><span className="status-chip warn">{stateNames[m.readiness] || m.readiness}</span></td></tr>)}</tbody></table></div>;
}

function ScenarioCard({ row }: { row: Row }) {
  const entries = Object.entries(row).filter(([, v]) => v !== null && typeof v !== 'object');
  const nested = Object.entries(row).filter(([, v]) => v !== null && typeof v === 'object');
  return <article className="scenario"><dl className="stats">{entries.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{text(typeof v === 'boolean' ? String(v) : v)}</dd></div>)}</dl>{nested.map(([k, v]) => <details key={k}><summary>{k}</summary><pre>{JSON.stringify(v, null, 2).slice(0, 4000)}</pre></details>)}</article>;
}

export function AiPanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const forecasts = useQuery({ queryKey: ['forecasts', symbol, exchange], staleTime: 900_000, queryFn: ({ signal }) => apiData<Row[]>('forecasts', [symbol], { exchange, limit: 5 }, signal) });
  const local = useQuery({ queryKey: ['security-local-ai', symbol, exchange], staleTime: 900_000, queryFn: ({ signal }) => apiData<SecurityLocalAi>('securityLocalAi', [symbol], { exchange }, signal) });
  const data = local.data?.data;
  return <>
    <section className="panel"><div className="panel-heading"><div><h2><Bot size={16} /> Kịch bản tài chính AI (LLM)</h2><span className="muted">Chỉ hiển thị kết quả đã qua kiểm định và còn hiệu lực với dữ liệu nguồn hiện tại</span></div></div>
      <QueryState loading={forecasts.isPending} error={forecasts.error} retry={forecasts.refetch}>{forecasts.data?.data.length ? <div className="scenario-grid">{forecasts.data.data.map((row, i) => <ScenarioCard key={text(row.id, String(i))} row={row} />)}</div> : <div className="state"><strong>Chưa có kịch bản đủ điều kiện công bố</strong><span>Có thể chưa chạy, đã hết hiệu lực do dữ liệu nguồn đổi, hoặc chưa qua vòng kiểm định. Trang không tự gọi mô hình.</span></div>}</QueryState>
      <Note>{forecasts.data?.meta.notes?.join(' ') || 'Kịch bản AI không phải khuyến nghị đầu tư, giá mục tiêu hay xác suất đã hiệu chỉnh.'}</Note>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2><Bot size={16} /> Local AI · {symbol}</h2><span className="muted">Mô hình dự báo nội bộ theo quý (hướng giá, lợi nhuận NPAT)</span></div><span className="status-chip warn">{stateNames[text(data?.state)] || text(data?.state)}</span></div>
      <QueryState loading={local.isPending} error={local.error} empty={!data?.models?.length} retry={local.refetch}><LocalAiTable models={data?.models || []} /></QueryState>
      <div className="ai-guard"><ShieldAlert size={16} /><p>Giá trị dự đoán chưa được công bố cho người dùng (<code>publicResultsAvailable={String(data?.publicResultsAvailable ?? false)}</code>). Bảng chỉ cho thấy tiến độ: số input/kết quả nghiên cứu đã lưu, không phải độ chính xác. Điểm 0–1 của mô hình hướng không phải xác suất.</p></div>
      <Note>{local.data?.meta.notes?.join(' ') || ''}</Note>
    </section>
    <ResearchPreview symbol={symbol} exchange={exchange} />
  </>;
}

type Reference = { id: string; observedAt: string; sourceEffectiveAt: string | null; industryName: string | null; outstandingShares: string | null; currentVenueListingDate: string | null; delistedDate: string | null; listingStatus: string | null; sourceCode: string };

export function ReferencePanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ['reference', symbol, exchange, page], staleTime: 3_600_000, queryFn: ({ signal }) => apiPage<Reference>('referenceObservations', [symbol], { exchange, page, size: 10 }, signal) });
  return <section className="panel"><div className="panel-heading"><div><h2>Lịch sử niêm yết</h2><span className="muted">Các lần quan sát dữ liệu tham chiếu từ nguồn, mới nhất trước</span></div></div>
    <QueryState loading={query.isPending} error={query.error} empty={!query.data?.items.length} retry={query.refetch}><div className="table-scroll"><table><thead><tr><th>Quan sát</th><th>Trạng thái</th><th>Ngày niêm yết sàn hiện tại</th><th>Hủy niêm yết</th><th className="number">CP lưu hành</th><th>Ngành</th><th>Nguồn</th></tr></thead><tbody>{query.data?.items.map(r => <tr key={r.id}><td>{date(r.observedAt)}</td><td>{text(r.listingStatus)}</td><td>{date(r.currentVenueListingDate)}</td><td>{date(r.delistedDate)}</td><td className="number">{decimal(r.outstandingShares)}</td><td>{text(r.industryName)}</td><td>{r.sourceCode}</td></tr>)}</tbody></table></div></QueryState>
    {query.data && (page > 0 || query.data.hasNext) && <Pagination page={page} total={query.data.total} hasNext={query.data.hasNext} onChange={setPage} />}
  </section>;
}

type PreviewRow = { modelId: string; kind: string; horizonQuarters: number | null; targetPeriod: string; issuedAt: string; dataAsOf: string | null; selectedAlgorithm: string | null; developmentGatePassed: boolean; values: Record<string, string | boolean | null> };
type Preview = { state: string; predictions: PreviewRow[] };

function score(value: unknown): string {
  return typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : '—';
}

function pct(value: unknown): string {
  if (typeof value !== 'string' || !/^-?\d+(\.\d+)?(E-?\d+)?$/i.test(value)) return '—';
  return (Number(value) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '%';
}

export function previewValue(row: PreviewRow): { main: string; detail: string; tone: string } {
  const v = row.values;
  switch (row.kind) {
    case 'h3': return { main: v.direction === 'UP' ? 'Tăng' : v.direction === 'NOT_UP' ? 'Không tăng' : text(v.direction), detail: `điểm ${score(v.score_up)} · ngưỡng ${score(v.threshold)} (chưa hiệu chỉnh)`, tone: v.direction === 'UP' ? 'positive' : 'reference' };
    case 'quantile': return { main: pct(v.return_p50), detail: `P10 ${pct(v.return_p10)} · P90 ${pct(v.return_p90)}`, tone: '' };
    case 'npat': return { main: compactDecimalVnd(v.prediction_vnd), detail: 'LNST hợp nhất, riêng quý (VND)', tone: '' };
    case 'return': return { main: pct(v.prediction), detail: 'Lợi suất giá điều chỉnh', tone: Number(v.prediction) > 0 ? 'positive' : Number(v.prediction) < 0 ? 'negative' : '' };
    case 'volatility': return { main: pct(v.prediction), detail: 'Biến động năm hóa (log return)', tone: '' };
    case 'drawdown': return { main: pct(v.prediction), detail: 'Mức sụt giảm tối đa theo giá đóng cửa', tone: 'negative' };
    default: return { main: '—', detail: '', tone: '' };
  }
}

function compactDecimalVnd(value: unknown): string {
  if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value)) return '—';
  const n = Number(value);
  return Math.abs(n) >= 1e9 ? (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ' : n.toLocaleString('vi-VN');
}

/** Rendered only when the backend enables financial.local-ai.research-preview (404 otherwise). */
export function ResearchPreview({ symbol, exchange }: { symbol: string; exchange: string }) {
  const query = useQuery({ queryKey: ['local-ai-preview', symbol, exchange], staleTime: 900_000, retry: false, queryFn: ({ signal }) => apiData<Preview>('securityLocalAiPreview', [symbol], { exchange }, signal) });
  if (query.isPending || query.error) return null;
  const rows = query.data?.data.predictions || [];
  return <section className="panel preview-panel"><div className="panel-heading"><div><h2><ShieldAlert size={16} /> Xem trước kết quả nghiên cứu Local AI</h2><span className="muted">Chế độ nghiên cứu do backend bật riêng · kết quả mới nhất mỗi mô hình · {query.data?.data.state}</span></div><span className="status-chip warn">RESEARCH_ONLY</span></div>
    {rows.length ? <div className="preview-grid">{rows.map(row => { const shown = previewValue(row); return <article key={row.modelId} className="preview-card"><span>{row.modelId} · H{row.horizonQuarters ?? '?'} → {row.targetPeriod}</span><strong className={shown.tone}>{shown.main}</strong><small>{shown.detail}</small><small>{row.selectedAlgorithm} · dữ liệu đến {date(row.dataAsOf)} · {row.developmentGatePassed ? 'đạt cổng dev' : 'chưa đạt cổng dev'}</small></article>; })}</div> : <div className="state"><strong>Chưa có kết quả lưu cho mã này</strong></div>}
    <div className="ai-guard"><ShieldAlert size={16} /><p>Đây là đầu ra nghiên cứu chưa được duyệt công bố: không phải khuyến nghị đầu tư, không phải xác suất đã hiệu chỉnh hay độ chính xác đã kiểm chứng. Chỉ dùng cho phát triển/đánh giá nội bộ.</p></div>
  </section>;
}
