import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSuggestions } from '../src/shared/search.ts';

test('search merges system securities first, then exchange tickers by prefix', () => {
  const system = [{ symbol: 'FPT', exchange: 'HOSE', companyName: 'Công ty Cổ phần FPT' }];
  const lists = { HOSE: ['FPT', 'FRT', 'FTS', 'VNM'], HNX: ['FID'], UPCOM: undefined };
  const result = mergeSuggestions('f', system, lists);
  assert.deepEqual(result.map(r => r.symbol), ['FPT', 'FID', 'FRT', 'FTS']);
  assert.equal(result[0].inSystem, true);
  assert.equal(result.filter(r => r.symbol === 'FPT').length, 1, 'no duplicate of system ticker');
  assert.equal(mergeSuggestions('vnm', [], lists)[0].symbol, 'VNM');
  assert.deepEqual(mergeSuggestions('  ', system, lists), []);
});

test('exact ticker outranks name matches from backend', () => {
  const system = [{ symbol: 'ACB', exchange: 'HOSE', companyName: 'Á Châu' }, { symbol: 'VCB', exchange: 'HOSE', companyName: 'Vietcombank' }];
  assert.equal(mergeSuggestions('VCB', system, {})[0].symbol, 'VCB');
});
