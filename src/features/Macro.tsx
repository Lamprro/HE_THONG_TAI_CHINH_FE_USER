import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiPage } from '../shared/api';
import { Sparkline } from '../shared/charts';
import { date, trimmed } from '../shared/format';
import { Note, QueryState } from '../shared/ui';

type Series = { id: string; code: string; name: string; frequency: string; unit: string; countryCode?: string; sourceCode?: string; description?: string | null };
type Observation = { id: string; date: string; value: string | null; valueText: string | null; unit: string; sourceCode: string; storedAt: string };

const frequencyNames: Record<string, string> = { YEARLY: 'Năm', QUARTERLY: 'Quý', MONTHLY: 'Tháng', DAILY: 'Ngày' };
const viNames: Record<string, string> = {
  VN_CPI_INDEX_2010: 'Chỉ số giá tiêu dùng (2010 = 100)', VN_CPI_INFLATION_YOY: 'Lạm phát CPI (%/năm)', VN_DEPOSIT_RATE_YEAR: 'Lãi suất tiền gửi (%)',
  VN_EXPORTS_GOODS_SERVICES_USD: 'Xuất khẩu hàng hóa & dịch vụ (USD)', VN_GDP_CURRENT_USD: 'GDP danh nghĩa (USD)', VN_GDP_REAL_GROWTH_YOY: 'Tăng trưởng GDP thực (%)',
  VN_IMPORTS_GOODS_SERVICES_USD: 'Nhập khẩu hàng hóa & dịch vụ (USD)', VN_LENDING_RATE_YEAR: 'Lãi suất cho vay (%)', VN_OFFICIAL_USD_VND_YEAR_AVG: 'Tỷ giá chính thức USD/VND (TB năm)',
  VN_UNEMPLOYMENT_ILO_ESTIMATE: 'Tỷ lệ thất nghiệp (ILO, %)', VN_USD_VND_MONTH_AVG: 'Tỷ giá USD/VND (TB tháng)', VN_USD_VND_QUARTER_AVG: 'Tỷ giá USD/VND (TB quý)',
};

function useObservations(id: string, years: number) {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - years * 365.25 * 86400000).toISOString().slice(0, 10);
  return useQuery({ queryKey: ['macro-obs', id, years], staleTime: 3_600_000, queryFn: ({ signal }) => apiPage<Observation>('macroObservations', [id], { from, to, size: 500 }, signal) });
}

function short(value: string | null, unit: string): string {
  if (value === null) return '—';
  const n = Number(value);
  if (unit === 'USD' && Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ USD';
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function MacroCard({ series, selected, onSelect }: { series: Series; selected: boolean; onSelect: () => void }) {
  const obs = useObservations(series.id, 10);
  const values = (obs.data?.items || []).filter(o => o.value !== null);
  const last = values.at(-1); const prev = values.at(-2);
  const delta = last && prev ? Number(last.value) - Number(prev.value) : null;
  return <button className={'macro-card ' + (selected ? 'selected' : '')} onClick={onSelect} aria-pressed={selected}>
    <span className="macro-name">{viNames[series.code] || series.name}</span>
    <strong>{short(last?.value ?? null, series.unit)}</strong>
    <small className={delta === null ? '' : delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}>{delta === null ? '—' : (delta > 0 ? '▲ ' : delta < 0 ? '▼ ' : '') + short(String(Math.abs(delta)), series.unit)} · {date(last?.date)}</small>
    <Sparkline values={values.map(o => Number(o.value))} width={200} height={34} label={series.name} />
    <small>{frequencyNames[series.frequency] || series.frequency} · {series.unit}</small>
  </button>;
}

function MacroDetail({ series }: { series: Series }) {
  const [years, setYears] = useState(10);
  const obs = useObservations(series.id, years);
  const values = (obs.data?.items || []).filter(o => o.value !== null);
  return <section className="panel"><div className="panel-heading"><div><h2>{viNames[series.code] || series.name}</h2><span className="muted">{series.name} · {series.code} · {frequencyNames[series.frequency] || series.frequency} · đơn vị {series.unit}</span></div><div className="segments">{[5, 10, 20, 40].map(y => <button key={y} className={years === y ? 'selected' : ''} onClick={() => setYears(y)}>{y}N</button>)}</div></div>
    <QueryState loading={obs.isPending} error={obs.error} empty={!values.length} retry={obs.refetch}>
      <div className="macro-chart"><Sparkline values={values.map(o => Number(o.value))} width={900} height={220} label={'Biểu đồ ' + series.name} /><div className="macro-axis"><span>{date(values[0]?.date)}</span><span>{date(values.at(-1)?.date)}</span></div></div>
      <details><summary>Bảng {values.length} quan sát</summary><div className="table-scroll price-history"><table><thead><tr><th>Kỳ</th><th className="number">Giá trị</th><th>Đơn vị</th><th>Nguồn</th><th>Lưu lúc</th></tr></thead><tbody>{[...values].reverse().map(o => <tr key={o.id}><td>{date(o.date)}</td><td className="number">{trimmed(o.value)}</td><td>{o.unit}</td><td>{o.sourceCode}</td><td>{date(o.storedAt)}</td></tr>)}</tbody></table></div></details>
    </QueryState>
    <Note>Ngày là ngày kỳ kinh tế, không phải ngày phát hành số liệu. {obs.data?.hasNext ? 'Có thêm quan sát cũ hơn ngoài 500 bản ghi đầu.' : ''}</Note>
  </section>;
}

export function MacroPage() {
  const series = useQuery({ queryKey: ['macro-series'], staleTime: 3_600_000, queryFn: ({ signal }) => apiPage<Series>('macroSeries', [], { size: 100 }, signal) });
  const [selected, setSelected] = useState('');
  const current = series.data?.items.find(s => s.id === selected) || series.data?.items.find(s => s.code === 'VN_GDP_REAL_GROWTH_YOY') || series.data?.items[0];
  return <>
    <div className="page-heading"><div><p className="eyebrow">BỐI CẢNH KINH TẾ</p><h1>Kinh tế vĩ mô</h1><p>Các chuỗi vĩ mô Việt Nam đã lưu trong hệ thống: tăng trưởng, lạm phát, lãi suất, tỷ giá, thương mại.</p></div></div>
    <QueryState loading={series.isPending} error={series.error} empty={!series.data?.items.length} retry={series.refetch}>
      <div className="macro-grid">{series.data?.items.map(s => <MacroCard key={s.id} series={s} selected={current?.id === s.id} onSelect={() => setSelected(s.id)} />)}</div>
      {current && <MacroDetail key={current.id} series={current} />}
    </QueryState>
  </>;
}
