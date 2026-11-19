import { useId } from 'react';

/** Small inline SVG line used on index cards and tables. */
export function Sparkline({ values, reference, width = 120, height = 36, label }: { values: number[]; reference?: number | null; width?: number; height?: number; label?: string }) {
  const id = useId();
  if (values.length < 2) return <svg className="sparkline" width={width} height={height} role="img" aria-label={label || 'Chưa đủ dữ liệu biểu đồ'} />;
  const all = reference !== null && reference !== undefined ? [...values, reference] : values;
  const low = Math.min(...all); const high = Math.max(...all);
  const range = high - low || 1;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => 3 + (high - v) / range * (height - 6);
  const last = values[values.length - 1];
  const tone = reference === null || reference === undefined ? 'neutral' : last > reference ? 'up' : last < reference ? 'down' : 'flat';
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return <svg className={'sparkline ' + tone} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
    <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".28" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
    {reference !== null && reference !== undefined && <line x1="0" x2={width} y1={y(reference)} y2={y(reference)} className="sparkline-ref" />}
    <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} stroke="none" />
    <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>;
}

/** Horizontal advance/decline bar. */
export function BreadthBar({ up, down, flat }: { up: number; down: number; flat: number }) {
  const total = up + down + flat || 1;
  return <div className="breadth-bar" role="img" aria-label={`${up} tăng, ${flat} đứng giá, ${down} giảm`}>
    <span className="up" style={{ width: `${up / total * 100}%` }} />
    <span className="flat" style={{ width: `${flat / total * 100}%` }} />
    <span className="down" style={{ width: `${down / total * 100}%` }} />
  </div>;
}
