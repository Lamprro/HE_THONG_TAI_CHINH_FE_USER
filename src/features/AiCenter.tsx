import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, ShieldAlert } from 'lucide-react';
import { apiData, apiPage, type Row } from '../shared/api';
import { date, decimal, text } from '../shared/format';
import { Note, QueryState } from '../shared/ui';

type Availability = {
  localAi: { registryAvailable: boolean; publicPredictionReader: string; reason: string; registry: { target: string; status: string; count: string }[]; registeredSuite?: { data: { state: string; package?: { id: string; status: string; registeredAt: string } | null; publicResultsAvailable: boolean; executionAvailable: boolean } } };
  newsAnalysis: { readerAvailable: boolean; publicationGuard: string }; financialScenarios: { readerAvailable: boolean; publicationGuard: string }; executesModels: boolean;
};
type CatalogModel = { packageId: string; modelId: string; horizonQuarters: number; targetPeriod: string; selectedAlgorithm: string; developmentGatePassed: boolean; registeredInputs: string; storedSelectedResearchResults: string; firstInputAsOf: string | null; lastInputAsOf: string | null; readiness: string; outputContract?: { type?: string; unit?: string; note?: string } };

const families: Record<string, string> = { direction: 'Hướng giá', drawdown: 'Sụt giảm tối đa', ensemble: 'Tổ hợp hướng', npat: 'Lợi nhuận sau thuế', quantile: 'Phân vị lợi suất', return: 'Lợi suất điều chỉnh', volatility: 'Biến động' };

export function AiCenterPage() {
  const availability = useQuery({ queryKey: ['analysis-availability'], staleTime: 900_000, queryFn: ({ signal }) => apiData<Availability>('analysisAvailability', [], {}, signal) });
  const catalog = useQuery({ queryKey: ['local-ai-models'], staleTime: 900_000, queryFn: ({ signal }) => apiPage<CatalogModel>('localAiModels', [], { size: 100 }, signal) });
  const [symbol, setSymbol] = useState('');
  const a = availability.data?.data;
  const suite = a?.localAi.registeredSuite?.data;
  return <>
    <div className="page-heading"><div><p className="eyebrow">PHÂN TÍCH BẰNG AI</p><h1>Trung tâm AI</h1><p>Tình trạng các luồng AI: phân tích tin (LLM), kịch bản tài chính (LLM) và bộ mô hình Local AI theo quý.</p></div></div>
    <QueryState loading={availability.isPending} error={availability.error} retry={availability.refetch}>
      <div className="ai-status-grid">
        <article className="ai-status"><Bot size={18} /><h3>Phân tích tin tức</h3><strong className={a?.newsAnalysis.readerAvailable ? 'positive' : 'muted'}>{a?.newsAnalysis.readerAvailable ? 'Sẵn sàng đọc' : 'Chưa sẵn sàng'}</strong><small>Chỉ hiển thị kết quả qua kiểm định ({text(a?.newsAnalysis.publicationGuard)}). Xem trong từng bài tin.</small></article>
        <article className="ai-status"><Bot size={18} /><h3>Kịch bản tài chính</h3><strong className={a?.financialScenarios.readerAvailable ? 'positive' : 'muted'}>{a?.financialScenarios.readerAvailable ? 'Sẵn sàng đọc' : 'Chưa sẵn sàng'}</strong><small>Xem ở tab “AI & Dự báo” của từng mã.</small></article>
        <article className="ai-status"><Bot size={18} /><h3>Local AI</h3><strong className="reference">{suite?.state || a?.localAi.publicPredictionReader}</strong><small>Gói {suite?.package ? suite.package.id.slice(0, 8) + '… đăng ký ' + date(suite.package.registeredAt) : 'chưa có'} · đọc dự đoán công khai: {a?.localAi.publicPredictionReader} ({a?.localAi.reason})</small></article>
      </div>
    </QueryState>
    <section className="panel"><div className="panel-heading"><div><h2>Bộ mô hình Local AI</h2><span className="muted">{catalog.data ? `${catalog.data.total} mô hình trong gói nghiên cứu mới nhất` : 'Danh mục mô hình'}</span></div>
      <form className="toolbar" onSubmit={event => { event.preventDefault(); if (/^[A-Za-z0-9]{1,20}$/.test(symbol.trim())) window.location.hash = '/securities?search=' + encodeURIComponent(symbol.trim().toUpperCase()); }}><input aria-label="Xem Local AI theo mã" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Mã, vd FPT" /><button type="submit">Tìm mã</button></form></div>
      <QueryState loading={catalog.isPending} error={catalog.error} empty={!catalog.data?.items.length} retry={catalog.refetch}><div className="table-scroll"><table><thead><tr><th>Mô hình</th><th>Nhóm</th><th>Kỳ</th><th>Thuật toán chọn</th><th>Đầu ra</th><th className="number">Input đã đăng ký</th><th className="number">Kết quả nghiên cứu</th><th>Dữ liệu</th><th>Cổng dev</th></tr></thead>
        <tbody>{catalog.data?.items.map(m => <tr key={m.packageId + m.modelId}><td><strong>{m.modelId}</strong></td><td>{families[m.modelId.split('_')[0]] || '—'}</td><td>H{m.horizonQuarters} · {m.targetPeriod}</td><td>{m.selectedAlgorithm}</td><td>{text(m.outputContract?.type)}<small title={m.outputContract?.note}>{text(m.outputContract?.unit)}</small></td><td className="number">{decimal(m.registeredInputs)}</td><td className="number">{decimal(m.storedSelectedResearchResults)}</td><td>{date(m.firstInputAsOf)} → {date(m.lastInputAsOf)}</td><td>{m.developmentGatePassed ? <span className="positive">Đạt</span> : <span className="muted">Chưa đạt</span>}</td></tr>)}</tbody></table></div></QueryState>
      <div className="ai-guard"><ShieldAlert size={16} /><p>Gói đang ở trạng thái <b>RESEARCH_ONLY</b>: chưa có chính sách công bố nên giá trị dự đoán không được trả cho người dùng. Cổng dev là bằng chứng chọn mô hình, không phải độ chính xác dự báo tương lai. Trang chỉ đọc, không chạy mô hình hay gửi dữ liệu.</p></div>
      <Note>{catalog.data?.meta.notes?.join(' ') || ''}</Note>
    </section>
    {a && a.localAi.registry.length > 0 && <section className="panel"><div className="panel-heading"><h2>Registry mô hình (model_versions)</h2></div><div className="table-scroll"><table><thead><tr><th>Mục tiêu</th><th>Trạng thái</th><th className="number">Số bản</th></tr></thead><tbody>{a.localAi.registry.map((r: Row & { target: string; status: string; count: string }) => <tr key={r.target + r.status}><td>{r.target}</td><td>{r.status}</td><td className="number">{decimal(r.count)}</td></tr>)}</tbody></table></div></section>}
  </>;
}
