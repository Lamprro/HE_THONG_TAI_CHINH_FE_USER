import test from 'node:test';
import assert from 'node:assert/strict';
import { chunk, isTradingTime, parseDchart, parseVpsIndex, parseVpsQuote, parseVpsQuotes, priceTone } from '../src/shared/live-parse.ts';

const vpsFpt = { sym: 'FPT', marketId: 'STO', c: 50.2, f: 43.7, r: 46.95, lastPrice: 45.7, lot: 1843770, ot: '1.25', changePc: '2.66', avePrice: '46.24', highPrice: '47.95', lowPrice: '45.6', openPrice: '46.95', g1: '45.7|6180|d', g2: '45.65|22120|d', g3: 'ATO|0|e', g4: '45.75|40|d', g5: '0|0|e', g6: '45.85|550|d', fBVol: '357673', fSVolume: '944529', fRoom: '44179103.30', rightInfos: [{ contentEn: 'FPT - Cash dividend 10%\\n ex-date 27/11/2026' }] };

test('VPS quote keeps thousand-VND prices, signs change from reference and converts lots to shares', () => {
  const q = parseVpsQuote(vpsFpt);
  assert.equal(q.symbol, 'FPT');
  assert.equal(q.market, 'HOSE');
  assert.equal(q.price, 45.7);
  assert.equal(q.change, -1.25); // changePc from VPS is unsigned; sign comes from price - reference
  assert.equal(q.changePercent, -2.66);
  assert.equal(q.volume, 18437700);
  assert.deepEqual(q.bids[0], { price: 45.7, volume: 61800 });
  assert.deepEqual(q.bids[2], { price: null, volume: null });
  assert.deepEqual(q.asks[1], { price: null, volume: null });
  assert.equal(q.foreignBuy, 3576730);
  assert.equal(q.notices[0], 'FPT - Cash dividend 10%  ex-date 27/11/2026');
});

test('VPS quote without a match has null price and change, invalid rows are dropped', () => {
  const q = parseVpsQuote({ ...vpsFpt, lastPrice: 0, lot: 0 });
  assert.equal(q.price, null);
  assert.equal(q.change, null);
  assert.equal(parseVpsQuotes([{ sym: '../x' }, null, vpsFpt]).length, 1);
  assert.throws(() => parseVpsQuotes({ error: true }));
});

test('VPS index maps market codes and breadth', () => {
  const index = parseVpsIndex({ mc: '10', cIndex: 1689.62, oIndex: 1703.01, vol: 652868677, value: 15008735.561, ot: '13.39|0.79%|15008735.561|107|207|65', time: '15:05:05' });
  assert.equal(index.code, 'VNINDEX');
  assert.equal(index.change, -13.39);
  assert.equal(index.changePercent, -0.79);
  assert.deepEqual([index.advances, index.declines, index.unchanged], [107, 207, 65]);
  assert.equal(parseVpsIndex({ mc: '99' }), null);
});

test('dchart history becomes sorted candles and no_data is empty', () => {
  const candles = parseDchart({ s: 'ok', t: [20, 10], o: [2, 1], h: [3, 2], l: [1, 0.5], c: [2.5, 1.5], v: [100, null] });
  assert.deepEqual(candles.map(c => c.time), [10, 20]);
  assert.equal(candles[0].volume, 0);
  assert.deepEqual(parseDchart({ s: 'no_data' }), []);
  assert.throws(() => parseDchart({ s: 'ok', t: [1] }));
});

test('price tone follows board colours', () => {
  const q = { reference: 46.95, ceiling: 50.2, floor: 43.7 };
  assert.equal(priceTone(50.2, q), 'ceiling');
  assert.equal(priceTone(43.7, q), 'floor');
  assert.equal(priceTone(46.95, q), 'reference');
  assert.equal(priceTone(47, q), 'positive');
  assert.equal(priceTone(45, q), 'negative');
  assert.equal(priceTone(null, q), '');
});

test('trading window is Vietnam weekday 09:00-15:00', () => {
  assert.equal(isTradingTime(new Date('2026-11-19T03:00:00Z')), true); // Thu 10:00 ICT
  assert.equal(isTradingTime(new Date('2026-11-19T09:30:00Z')), false); // Thu 16:30 ICT
  assert.equal(isTradingTime(new Date('2026-11-21T03:00:00Z')), false); // Saturday
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]]);
});

test('lunch break pauses polling and session labels follow HOSE schedule', async () => {
  const { sessionLabel } = await import('../src/shared/live-parse.ts');
  assert.equal(isTradingTime(new Date('2026-11-19T05:00:00Z')), false); // 12:00 ICT lunch
  assert.equal(isTradingTime(new Date('2026-11-19T06:10:00Z')), true); // 13:10 ICT
  assert.equal(sessionLabel(new Date('2026-11-19T01:30:00Z')), 'Chưa mở cửa');
  assert.equal(sessionLabel(new Date('2026-11-19T02:05:00Z')), 'Phiên ATO');
  assert.equal(sessionLabel(new Date('2026-11-19T05:00:00Z')), 'Nghỉ trưa');
  assert.equal(sessionLabel(new Date('2026-11-19T07:35:00Z')), 'Phiên ATC');
  assert.equal(sessionLabel(new Date('2026-11-19T09:00:00Z')), 'Đã đóng cửa');
  assert.equal(sessionLabel(new Date('2026-11-22T03:00:00Z')), 'Nghỉ cuối tuần');
});
