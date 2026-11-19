import { useEffect, useRef } from 'react';
import type { Price } from '../shared/api';
import { date, decimal } from '../shared/format';

export function PriceChart({ prices }: { prices: Price[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const context = element.getContext('2d');
      if (!context) return;
      const width = element.clientWidth;
      const height = 260;
      const scale = window.devicePixelRatio || 1;
      element.width = width * scale;
      element.height = height * scale;
      context.scale(scale, scale);
      context.clearRect(0, 0, width, height);
      const values = prices.filter(row => row.close !== null && Number.isFinite(Number(row.close)));
      if (!values.length) return;
      const amounts = values.map(row => Number(row.close));
      const low = Math.min(...amounts);
      const high = Math.max(...amounts);
      const range = high - low || Math.max(Math.abs(high) * 0.02, 1);
      const top = high + range * 0.1;
      const bottom = low - range * 0.1;
      const x = (i: number) => 14 + i / Math.max(prices.length - 1, 1) * (width - 100);
      const y = (value: number) => 16 + (top - value) / (top - bottom) * 210;
      context.font = '11px system-ui';
      for (let i = 0; i < 5; i++) {
        const value = bottom + i * (top - bottom) / 4;
        context.strokeStyle = '#253141';
        context.beginPath(); context.moveTo(14, y(value)); context.lineTo(width - 82, y(value)); context.stroke();
        context.fillStyle = '#92a3b8'; context.fillText(value.toLocaleString('vi-VN', { maximumFractionDigits: 2 }), width - 74, y(value) + 3);
      }
      context.strokeStyle = '#57d6aa'; context.lineWidth = 2;
      let previous: Price | undefined;
      prices.forEach((row, i) => {
        if (row.close === null || !Number.isFinite(Number(row.close))) { previous = undefined; return; }
        if (previous && row.sourceCode === previous.sourceCode && row.priceBasis === previous.priceBasis) {
          context.beginPath(); context.moveTo(x(i - 1), y(Number(previous.close))); context.lineTo(x(i), y(Number(row.close))); context.stroke();
        }
        context.fillStyle = '#57d6aa'; context.beginPath(); context.arc(x(i), y(Number(row.close)), 2, 0, Math.PI * 2); context.fill();
        previous = row;
      });
      context.fillStyle = '#92a3b8';
      context.fillText(date(prices[0]?.tradingDate), 14, 254);
      context.fillText(date(prices.at(-1)?.tradingDate), Math.max(14, width - 170), 254);
    };
    const resize = new ResizeObserver(draw);
    resize.observe(element); draw();
    return () => resize.disconnect();
  }, [prices]);
  return <><canvas ref={canvas} className="price-chart" role="img" aria-label="Biểu đồ giá đóng cửa theo các phiên có dữ liệu. Bảng giá trị đầy đủ ở dưới." /><details><summary>Xem bảng giá và nguồn dữ liệu</summary><div className="table-scroll price-history"><table><thead><tr><th>Phiên</th><th>Đóng cửa</th><th>Tiền tệ</th><th>Khối lượng (CP)</th><th>Nguồn / Cơ sở giá</th></tr></thead><tbody>{prices.map(row => <tr key={row.id}><td>{date(row.tradingDate)}</td><td>{decimal(row.close)}</td><td>{row.currency || '—'}</td><td>{decimal(row.volume)}</td><td>{row.sourceCode} · {row.priceBasis || 'UNKNOWN'}</td></tr>)}</tbody></table></div></details></>;
}
