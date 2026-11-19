import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWatchlist } from '../src/shared/watchlist.ts';

test('imported watchlist keeps only valid, unique symbol+exchange rows', () => {
  const raw = JSON.stringify([
    { symbol: 'FPT', exchange: 'HOSE', companyName: 'FPT' },
    { symbol: 'FPT', exchange: 'HOSE' },
    { symbol: 'VHM', exchange: '' },
    { symbol: '<script>', exchange: 'HOSE' },
    { symbol: 'SHS', exchange: 'HNX', companyName: 'x'.repeat(500) },
    'bad',
  ]);
  const rows = parseWatchlist(raw);
  assert.deepEqual(rows.map(r => r.symbol + ':' + r.exchange), ['FPT:HOSE', 'SHS:HNX']);
  assert.equal(rows[1].companyName.length, 300);
  assert.deepEqual(parseWatchlist('{not json'), []);
  assert.deepEqual(parseWatchlist('{"a":1}'), []);
  assert.equal(parseWatchlist(JSON.stringify(Array.from({ length: 150 }, (_, i) => ({ symbol: 'A' + i, exchange: 'HOSE' })))).length, 100);
});
