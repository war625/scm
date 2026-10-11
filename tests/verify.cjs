// 검증기: node tests/verify.cjs  (NODE_PATH=글로벌 node_modules 필요) → 실패 시 exit 1
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const srv = http.createServer((q, r) => {
  const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); } });
});

(async () => {
  await new Promise(r => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('session')) sessionStorage.setItem('session', JSON.stringify({ name: '테스터', email: 't@t.com' })); });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  const products = () => page.evaluate(() => JSON.parse(localStorage.getItem('products') || '[]').length);
  const open = async () => { await page.goto(base + '/product.html'); };
  const fill = async o => {
    const v = { name: '테스트 상품', category: '식품', desc: '설명은 열 글자 이상입니다.', price: '1000', stock: '5', ...o };
    await page.fill('[name=name]', v.name); await page.selectOption('[name=category]', v.category);
    await page.fill('[name=desc]', v.desc); await page.fill('[name=price]', v.price); await page.fill('[name=stock]', v.stock);
    if (!(await page.locator('.thumb').count())) await page.setInputFiles('#files', { name: 'a.png', mimeType: 'image/png', buffer: PNG });
  };
  const submit = async () => { await page.click('button[type=submit]'); await page.waitForTimeout(1600); };

  const results = [];
  const test = async (id, desc, fn) => { try { const m = await fn(); results.push([id, !m, desc, m]); } catch (e) { results.push([id, false, desc, e.message.split('\n')[0]]); } };

  await test('R1', '상품명 비면 등록 안 됨', async () => { await open(); await fill({ name: '' }); await submit(); return (await products()) === 0 ? null : '빈 상품명이 등록됨'; });
  await test('R2', '가격 0이면 등록 안 됨', async () => { await open(); await fill({ price: '0' }); await submit(); return (await products()) === 0 ? null : '가격 0 상품이 등록됨'; });
  await test('R3', '중복 상품명 거부 + 안내', async () => {
    await open(); await fill({ name: 'Apple Juice' }); await submit();
    if ((await products()) !== 1) return '정상 등록 자체가 실패(전제 오류)';
    await open(); await fill({ name: ' apple juice ' }); await submit();
    const n = await products(); if (n !== 1) return `중복 상품이 등록됨 (총 ${n}개)`;
    const msg = await page.locator('.field:has([name=name]) .msg').innerText();
    return msg.includes('이미') ? null : `상품명 오류 메시지에 '이미' 없음 (현재: "${msg}")`;
  });

  await browser.close(); srv.close();
  for (const [id, ok, d, m] of results) console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${d}${ok ? '' : '  → ' + m}`);
  process.exit(results.every(r => r[1]) ? 0 : 1);
})();
