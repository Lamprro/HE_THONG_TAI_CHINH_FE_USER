import { useEffect, useRef, useState } from 'react';
import type { Candle } from '../shared/live';
import { compactVolume, fixed } from '../shared/format';

const COLORS = { up: '#3ddc84', down: '#ff5b6b', grid: '#1f2b3a', text: '#8ea0b7', ma: '#f5c542', ma50: '#6fa8ff', cross: '#5d7590' };

export function movingAverage(values: number[], period: number): (number | null)[] {
  let sum = 0;
  return values.map((value, i) => {
    sum += value;
    if (i >= period) sum -= values[i - period];
    return i >= period - 1 ? sum / period : null;
  });
}

function label(seconds: number, intraday: boolean): string {
  const d = new Date(seconds * 1000);
  return intraday
    ? d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Canvas candlestick chart with volume pane, MA20/MA50 and hover crosshair. */
export function CandleChart({ candles, intraday = false, digits = 2, height = 380 }: { candles: Candle[]; intraday?: boolean; digits?: number; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const layout = useRef({ left: 10, right: 64, width: 0, step: 1 });

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const ctx = element.getContext('2d');
      if (!ctx) return;
      const width = element.clientWidth; const scale = window.devicePixelRatio || 1;
      element.width = width * scale; element.height = height * scale;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (!candles.length) return;
      const { left, right } = layout.current;
      const plotW = width - left - right;
      const priceH = height * 0.7 - 20; const volTop = height * 0.72; const volH = height * 0.22;
      const highs = candles.map(c => c.high); const lows = candles.map(c => c.low);
      const max = Math.max(...highs); const min = Math.min(...lows); const pad = (max - min) * 0.06 || max * 0.01 || 1;
      const top = max + pad; const bottom = min - pad;
      const step = plotW / candles.length; layout.current.width = plotW; layout.current.step = step;
      const x = (i: number) => left + step * (i + 0.5);
      const y = (v: number) => 10 + (top - v) / (top - bottom) * priceH;
      const vmax = Math.max(...candles.map(c => c.volume), 1);
      ctx.font = '11px Inter, system-ui'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const v = bottom + (top - bottom) * i / 4;
        ctx.strokeStyle = COLORS.grid; ctx.beginPath(); ctx.moveTo(left, y(v)); ctx.lineTo(width - right, y(v)); ctx.stroke();
        ctx.fillStyle = COLORS.text; ctx.fillText(fixed(v, digits), width - right + 6, y(v) + 4);
      }
      const body = Math.max(1, Math.min(12, step * 0.65));
      candles.forEach((c, i) => {
        const color = c.close >= c.open ? COLORS.up : COLORS.down;
        ctx.strokeStyle = color; ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(x(i), y(c.high)); ctx.lineTo(x(i), y(c.low)); ctx.stroke();
        const y1 = y(Math.max(c.open, c.close)); const y2 = y(Math.min(c.open, c.close));
        ctx.fillRect(x(i) - body / 2, y1, body, Math.max(1, y2 - y1));
        ctx.globalAlpha = 0.45; const vh = c.volume / vmax * volH; ctx.fillRect(x(i) - body / 2, volTop + volH - vh, body, vh); ctx.globalAlpha = 1;
      });
      const closes = candles.map(c => c.close);
      for (const [period, color] of [[20, COLORS.ma], [50, COLORS.ma50]] as const) {
        const ma = movingAverage(closes, period); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath();
        let started = false;
        ma.forEach((v, i) => { if (v === null) return; if (!started) { ctx.moveTo(x(i), y(v)); started = true; } else ctx.lineTo(x(i), y(v)); });
        ctx.stroke(); ctx.lineWidth = 1;
      }
      ctx.fillStyle = COLORS.text;
      ctx.fillText(label(candles[0].time, intraday), left, height - 4);
      const end = label(candles[candles.length - 1].time, intraday);
      ctx.fillText(end, width - right - ctx.measureText(end).width, height - 4);
      ctx.fillText('KL ' + compactVolume(vmax), width - right + 6, volTop + 10);
      if (hover !== null && candles[hover]) {
        ctx.strokeStyle = COLORS.cross; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x(hover), 10); ctx.lineTo(x(hover), volTop + volH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(left, y(candles[hover].close)); ctx.lineTo(width - right, y(candles[hover].close)); ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(element);
    return () => observer.disconnect();
  }, [candles, hover, height, intraday, digits]);

  const active = hover !== null ? candles[hover] : candles[candles.length - 1];
  const prev = hover !== null ? candles[hover - 1] : candles[candles.length - 2];
  const change = active && prev ? active.close - prev.close : null;
  return <div className="candle-wrap">
    {active && <div className="candle-legend"><span>{label(active.time, intraday)}</span><span>O <b>{fixed(active.open, digits)}</b></span><span>H <b>{fixed(active.high, digits)}</b></span><span>L <b>{fixed(active.low, digits)}</b></span><span>C <b className={change === null ? '' : change >= 0 ? 'positive' : 'negative'}>{fixed(active.close, digits)}</b></span><span>KL <b>{compactVolume(active.volume)}</b></span><span className="ma20">MA20</span><span className="ma50">MA50</span></div>}
    <canvas ref={canvas} className="candle-chart" style={{ height }} role="img" aria-label={`Biểu đồ nến ${candles.length} cây`}
      onMouseMove={event => { const rect = event.currentTarget.getBoundingClientRect(); const i = Math.floor((event.clientX - rect.left - layout.current.left) / layout.current.step); setHover(i >= 0 && i < candles.length ? i : null); }}
      onMouseLeave={() => setHover(null)} />
  </div>;
}
