// End-to-end user flow against the REAL local Java backend + DB.
// Third-party live feeds (VPS board, VNDirect chart) are NOT called: they are routed to
// deterministic fixtures so the browser test never automates external providers.
//
// Usage (dev server on 5173, backend on 8080):
//   PLAYWRIGHT_MODULE=<path to playwright> node tests/e2e.mjs [screenshotDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.FE_URL || 'http://127.0.0.1:5173';
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });

// ---------- fixtures for external providers (shape copied from real responses) ----------
function fixtureQuote(sym, i) {
  const ref = 20 + (i * 7.3) % 60; const r = Math.round(ref * 20) / 20;
  const delta = [0.9, -0.6, 0, 1.4, -1.1, 0.3][i % 6];
  const last = Math.round((r + delta) * 100) / 100;
  return { sym, marketId: 'STO', c: Math.round(r * 1.07 * 20) / 20, f: Math.round(r * 0.93 * 20) / 20, r, lastPrice: last, lot: 100000 + i * 12345, avePrice: String(r), highPrice: String(last + 0.3), lowPrice: String(r - 0.4), openPrice: String(r), g1: `${last - 0.05}|1200|d`, g2: `${last - 0.1}|3400|d`, g3: `${last - 0.15}|5000|d`, g4: `${last + 0.05}|900|i`, g5: `${last + 0.1}|2000|i`, g6: `${last + 0.15}|4100|i`, fBVol: '12000', fSVolume: '8000', fRoom: '1000000', rightInfos: [] };
}
const fixtureIndices = [
  { mc: '10', cIndex: 1689.62, oIndex: 1703.01, vol: 652868677, value: 15008735.561, ot: '13.39|0.79%|15008735.561|107|207|65', time: '15:05:05' },
  { mc: '11', cIndex: 1788.51, oIndex: 1806.54, vol: 312497330, value: 9569305.797, ot: '18.03|1.00%|9569305.797|4|21|5', time: '15:05:05' },
  { mc: '02', cIndex: 238.94, oIndex: 242.73, vol: 53593956, value: 645069.73, ot: '3.79|1.56%|645069.730|48|84|50', time: '15:05:10' },
  { mc: '03', cIndex: 120.36, oIndex: 121.12, vol: 21423131, value: 285384.112, ot: '0.76|0.63%|285384.112|76|112|72', time: '15:05:10' },
];
function fixtureCandles(url) {
  const from = Number(url.searchParams.get('from')); const to = Number(url.searchParams.get('to'));
  const step = { '1': 60, '5': 300, '15': 900, '60': 3600, D: 86400, W: 604800 }[url.searchParams.get('resolution')] || 86400;
  const t = [], o = [], h = [], l = [], c = [], v = [];
  let price = url.searchParams.get('symbol')?.startsWith('VN') ? 1700 : 50;
  for (let s = from, i = 0; s <= to && i < 400; s += step, i++) {
    const open = price; price = Math.max(1, price * (1 + Math.sin(i / 5) * 0.004));
    t.push(s); o.push(open); c.push(price); h.push(Math.max(open, price) * 1.003); l.push(Math.min(open, price) * 0.997); v.push(100000 + (i % 7) * 20000);
  }
  return { s: 'ok', t, o, h, l, c, v };
}

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const external = [];
await context.route(/bgapidatafeed\.vps\.com\.vn|dchart-api\.vndirect\.com\.vn/, async route => {
  const url = new URL(route.request().url());
  external.push(url.hostname + url.pathname.split('/').slice(0, 2).join('/'));
  let json;
  if (url.pathname.startsWith('/getliststockdata/')) json = decodeURIComponent(url.pathname.split('/')[2]).split(',').map(fixtureQuote);
  else if (url.pathname.startsWith('/getlistindexdetail/')) json = fixtureIndices;
  else if (url.pathname.startsWith('/getlistckindex/')) json = url.pathname.endsWith('VN30') ? ['ACB', 'BID', 'BSR', 'CTG', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG', 'LPB', 'MBB', 'MCH', 'MSN', 'MWG', 'SAB', 'SHB', 'SSB', 'SSI', 'STB', 'TCB', 'TCX', 'VCB', 'VHM', 'VIB', 'VIC', 'VJC', 'VNM', 'VPB', 'VPL', 'VRE'] : Array.from({ length: 150 }, (_, i) => 'M' + String(i).padStart(2, '0'));
  else json = fixtureCandles(url);
  await route.fulfill({ json, headers: { 'Access-Control-Allow-Origin': '*' } });
});
const page = await context.newPage();
const problems = []; const backend = new Set(); const writes = [];
page.on('pageerror', error => problems.push('pageerror ' + error.message));
page.on('request', request => {
  const url = new URL(request.url());
  if (url.port === '8080') { backend.add(url.pathname.replace(/[0-9a-f-]{36}/g, '{id}').replace(/\/securities\/[A-Z0-9]+/, '/securities/{symbol}')); if (request.method() !== 'GET') writes.push(request.url()); }
});
page.on('response', response => { if (response.status() >= 500) problems.push(response.status() + ' ' + response.url()); });

async function visit(hash, name, check) {
  await page.goto(base + '/#' + hash);
  await check();
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
  console.log('PASS', name);
}
const text = s => page.getByText(s, { exact: false }).first().waitFor({ timeout: 15000 });

try {
  await visit('/market', '01-market', async () => {
    await text('Tổng quan thị trường');
    await page.locator('table.board tbody tr').first().waitFor({ timeout: 15000 });
    assert.ok(await page.locator('table.board tbody tr').count() >= 5, 'board rows from backend');
    await text('VN-Index');
    await text('Độ rộng HOSE');
  });
  await page.getByRole('button', { name: 'VN30', exact: true }).click();
  await text('Bảng giá VN30 · 30 mã');
  assert.equal(await page.locator('table.board tbody tr').count(), 30, 'VN30 basket rows');
  await page.getByRole('button', { name: '%', exact: true }).click();
  const firstPct = await page.locator('table.board tbody tr').first().locator('td').nth(9).innerText();
  assert.match(firstPct, /^\+/, 'sorted by % descending starts with a gainer');
  if (shots) await page.screenshot({ path: `${shots}/01b-market-vn30.png`, fullPage: true });
  console.log('PASS 01b-market-vn30-sort');
  await page.getByRole('button', { name: 'HOSE', exact: true }).click();
  await text('Hiển thị thêm');
  assert.equal(await page.locator('table.board tbody tr').count(), 100, 'large board renders first 100 rows');
  console.log('PASS 01c-market-hose-cap');
  await page.getByRole('button', { name: 'Mã hệ thống', exact: true }).click();
  await page.keyboard.press('/');
  await page.keyboard.type('FP');
  await page.locator('#search-suggestions button', { hasText: 'FPT' }).first().waitFor({ timeout: 15000 });
  if (shots) await page.screenshot({ path: `${shots}/01d-search.png` });
  await page.keyboard.press('Enter');
  await text('Công ty Cổ phần FPT');
  assert.match(await page.title(), /FPT/, 'document title follows the security');
  console.log('PASS 01d-search-keyboard');
  await visit('/index/VN30', '01e-index-vn30', async () => { await text('Cổ phiếu thành phần · 30 mã'); await text('Biểu đồ VN30'); await page.locator('table.board tbody tr').nth(29).waitFor(); });
  await visit('/securities?search=FPT', '02-securities', async () => {
    await page.getByRole('link', { name: 'FPT', exact: true }).first().waitFor();
  });
  await page.getByRole('button', { name: 'Theo dõi FPT' }).first().click();
  await visit('/security/FPT?exchange=HOSE', '03-security-overview', async () => {
    await text('Công ty Cổ phần FPT');
    await text('Trạng thái dữ liệu');
  });
  for (const [tab, name, expect] of [
    ['Biểu đồ', '04-security-chart', 'Biểu đồ kỹ thuật'],
    ['Tài chính', '05-security-financials', 'Ma trận tài chính'],
    ['Chỉ số', '06-security-metrics', 'Chỉ số tài chính đã lưu'],
    ['Khối ngoại', '07-security-foreign', 'Giao dịch khối ngoại'],
    ['Tin tức', '08-security-news', 'Tin liên quan FPT'],
    ['AI & Dự báo', '09-security-ai', 'Local AI'],
    ['Hồ sơ', '10-security-profile', 'Lịch sử niêm yết'],
  ]) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await text(expect);
    await page.waitForTimeout(800);
    if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
    console.log('PASS', name);
  }
  await page.goto(base + '/#/watchlist');
  await text('mã đang theo dõi');
  await page.locator('input[type=file]').setInputFiles({ name: 'w.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ symbol: 'FPT', exchange: 'HOSE' }, { symbol: 'VHM', exchange: 'HOSE' }, { symbol: 'BAD!', exchange: 'HOSE' }])) });
  await text('Đã nhập 2 mã.');
  await text('2 mã đang theo dõi');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất file' }).click()]);
  assert.equal(download.suggestedFilename(), 'danh-sach-theo-doi.json');
  await page.locator('input[type=file]').setInputFiles({ name: 'w.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ symbol: 'FPT', exchange: 'HOSE' }])) });
  await text('1 mã đang theo dõi');
  console.log('PASS 10a-watchlist-import-export');
  await visit('/security/VHM?exchange=HOSE', '10b-security-live-only', async () => { await text('chưa có trong hệ thống dữ liệu'); await text('Biểu đồ kỹ thuật'); });
  await page.goto(base + '/#/security/FPT?exchange=HOSE&tab=financials');
  await text('Ma trận tài chính');
  console.log('PASS 10c-tab-from-url');
  await visit('/watchlist', '11-watchlist', async () => { await text('1 mã đang theo dõi'); await page.locator('table.board tbody tr').first().waitFor(); });
  await visit('/screener', '12-screener', async () => { await text('Bộ lọc cổ phiếu'); await page.locator('tbody tr').first().waitFor({ timeout: 15000 }); });
  await visit('/compare?symbols=FPT,ACB,VNM', '13-compare', async () => { await text('So sánh doanh nghiệp'); await page.locator('tbody tr').first().waitFor({ timeout: 15000 }); });
  await visit('/macro', '14-macro', async () => { await text('Kinh tế vĩ mô'); await page.locator('.macro-card').first().waitFor({ timeout: 15000 }); });
  await visit('/news', '15-news', async () => { await page.locator('.news-card').first().waitFor({ timeout: 15000 }); });
  await page.locator('.news-card h3 a').first().click();
  await text('Đọc tại nguồn').catch(() => text('Tin tức'));
  if (shots) await page.screenshot({ path: `${shots}/16-article.png`, fullPage: true });
  console.log('PASS 16-article');
  await visit('/ai', '17-ai', async () => { await text('Trung tâm AI'); await text('direction_h1'); });

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [hash, name] of [['/market', '18-mobile-market'], ['/security/FPT?exchange=HOSE', '19-mobile-security']]) {
    await page.goto(base + '/#' + hash);
    await page.waitForTimeout(2500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `${name}: page scrolls horizontally by ${overflow}px`);
    if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
    console.log('PASS', name);
  }

  assert.deepEqual(problems, [], 'no page errors / 5xx');
  assert.deepEqual(writes, [], 'user FE only sends GET');
  console.log(JSON.stringify({ status: 'PASS', backendRoutes: [...backend].sort(), externalCallsMocked: external.length }, null, 1));
} catch (error) {
  if (shots) await page.screenshot({ path: `${shots}/failure.png`, fullPage: true });
  console.error('FAIL', error.message, problems);
  process.exitCode = 1;
} finally {
  await browser.close();
}
