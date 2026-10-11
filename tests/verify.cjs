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

  await test('R4', '할인율 90 초과는 90으로 보정, 음수는 비움, 저장·미리보기에 반영', async () => {
    await open(); await fill({ name: 'Discount Item', price: '10000' });
    await page.fill('[name=discount]', '95');
    const v = await page.inputValue('[name=discount]'); if (v !== '90') return `95 입력 시 값이 ${JSON.stringify(v)} (기대 "90")`;
    const pv = await page.innerText('#pvPrice'); if (!pv.includes('1,000')) return `미리보기 최종가가 1,000원이 아님 (현재: "${pv.replace(/\s+/g, ' ')}")`;
    await page.fill('[name=discount]', '-5');
    const n = await page.inputValue('[name=discount]'); if (n !== '') return `-5 입력 시 값이 ${JSON.stringify(n)} (기대 "")`;
    await page.fill('[name=discount]', '95'); await submit();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('products') || '[]').find(p => p.name === 'Discount Item'));
    return saved && saved.discount === 90 ? null : `저장된 할인율이 ${saved ? saved.discount : '(저장 안 됨)'} (기대 90)`;
  });

  await test('R5', '같은 이미지(파일명+크기) 중복 업로드 거부 + 안내, 다른 파일은 허용', async () => {
    await open();
    const up = n => page.setInputFiles('#files', { name: n, mimeType: 'image/png', buffer: PNG });
    await up('dup.png'); await page.waitForTimeout(200);
    await up('dup.png'); await page.waitForTimeout(300);
    const c = await page.locator('.thumb').count(); if (c !== 1) return `같은 파일 2회 업로드 후 썸네일 ${c}개 (기대 1)`;
    const t = await page.locator('#toasts .toast.error').allInnerTexts();
    if (!t.some(x => x.includes('이미'))) return `'이미' 가 포함된 오류 토스트 없음 (현재: ${JSON.stringify(t)})`;
    await up('other.png'); await page.waitForTimeout(300);
    const c2 = await page.locator('.thumb').count(); return c2 === 2 ? null : `다른 파일명 업로드 후 썸네일 ${c2}개 (기대 2)`;
  });

  await browser.close(); srv.close();
  for (const [id, ok, d, m] of results) console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${d}${ok ? '' : '  → ' + m}`);
  process.exit(results.every(r => r[1]) ? 0 : 1);
})();
