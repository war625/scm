/* 승인 워크플로우 공통 UI: 상태 배지, 이력 타임라인, 상세 모달(+관리자 승인/반려) */
(() => {
  'use strict';
  const { $, $$, esc, dateStr, ago, won, fieldError } = App;
  const ST = { draft: ['임시저장', 'st-locked'], requested: ['승인요청', 'st-pending'], approved: ['승인완료', 'st-approved'], rejected: ['반려', 'st-rejected'] };
  const tag = s => `<span class="st ${ST[s][1]}">${ST[s][0]}</span>`;
  const dl = rows => `<dl class="dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v === '' || v == null ? '<span style="color:var(--muted)">-</span>' : v}</dd>`).join('')}</dl>`;
  const timeline = h => `<ol class="tl">${[...(h || [])].reverse().map(x => `<li class="${x.status}"><b>${ST[x.status][0]}</b> · ${esc(x.by || '')}<small>${esc(x.note || '')} · ${dateStr(x.at)} (${ago(x.at)})</small></li>`).join('')}</ol>`;
  const doc = (label, f) => `<span>📄 ${label}: ${f ? `${esc(f.name)} (${Math.ceil(f.size / 1024)}KB)` : '<i style="color:var(--muted)">미제출</i>'}</span>`;
  const code = c => (c ? `<span class="code">${esc(c)}</span> <span class="mdm">MDM 연동</span>` : '');

  const describeBp = b => dl([['MDM 코드', code(b.code)], ['거래처명', esc(b.name)], ['사업자번호', esc(b.bizNo)], ['대표자', esc(b.ceo)], ['거래유형', esc(b.tradeType)], ['업태', esc(b.industry)], ['주소', esc(b.address)],
    ['담당자', esc(`${b.contact.name} / ${b.contact.phone} / ${b.contact.email}`)], ['계좌', b.bank && b.bank.account ? esc(`${b.bank.name} ${b.bank.account} (${b.bank.holder})`) : ''], ['등록업체', esc(b.ownerName)]])
    + `<div class="docs">${doc('사업자등록증', b.docs.bizLicense)}${doc('통장사본', b.docs.bankbook)}${(b.docs.etc || []).map((f, i) => doc('기타' + (i + 1), f)).join('')}</div>`;
  const price = p => (p.discount ? `${won(Math.round(p.price * (100 - p.discount) / 100))} <s style="color:var(--muted)">${won(p.price)}</s> (${p.discount}%)` : won(p.price));
  const thumbOf = p => (p.images && p.images[0] && p.images[0].thumb) || '';
  const describeProduct = p => `<div class="gallery">${(p.images || []).filter(i => i.thumb).map(i => `<div class="pthumb" style="background-image:url(${i.thumb})"></div>`).join('') || '<div class="pthumb">🖼️</div>'}</div>`
    + dl([['SKU 코드', code(p.code)], ['상품명', esc(p.name)], ['카테고리', esc(p.category)], ['판매가', price(p)], ['재고', p.soldout ? '품절 처리' : `${p.stock}개`], ['태그', (p.tags || []).map(t => `#${esc(t)}`).join(' ')], ['설명', esc(p.desc)], ['등록업체', esc(p.ownerName || '')]]);

  // ---------- 상세 창 (ExtJS Window) ----------
  // opts: { title, status, rejectReason, body, history, buttons:[{text,primary,danger,fn(close)}], decide:(status,reason)=>Promise }
  function detail(o) {
    const canDecide = !!o.decide && o.status === 'requested';
    const html = (o.status === 'rejected' && o.rejectReason ? `<div class="alert err">반려 사유: ${esc(o.rejectReason)}</div>` : '')
      + `<div style="margin-bottom:6px">${tag(o.status)}</div>${o.body}<div class="section-h">처리 이력</div>${timeline(o.history)}`;
    const items = [{ xtype: 'component', html }];
    let reason;
    if (canDecide) {
      reason = Ext.create('Ext.form.field.TextArea', { fieldLabel: '반려 사유 (반려 시 필수)', labelAlign: 'top', anchor: '100%', height: 90, emptyText: '승인 시에는 비워두세요', maxLength: 200 });
      items.push({ xtype: 'component', html: '<div class="alert info">MDM W/F 승인 단계 (데모)</div>' }, reason,
        { xtype: 'component', html: `<div class="reasons">${['서류 식별 불가', '정보 불일치', '필수 정보 누락', '표현/내용 부적절'].map(r => `<button type="button" class="chip">${r}</button>`).join('')}</div>`,
          listeners: { click: { element: 'el', delegate: '.chip', fn: (e, t) => { const v = reason.getValue(); reason.setValue(v ? `${v}, ${t.textContent}` : t.textContent); } } } });
    }
    const win = Ext.create('Ext.window.Window', { title: o.title, modal: true, constrain: true, resizable: false, draggable: false, scrollable: 'y', autoShow: false, bodyPadding: 16,
      width: Math.min(680, document.documentElement.clientWidth - 16), maxHeight: innerHeight - 24, items, closeAction: 'destroy' });
    const btns = [];
    const run = async st => { win.setLoading('처리 중...'); try { await o.decide(st, (reason ? reason.getValue() : '').trim()); } finally { win.destroy(); } };
    if (canDecide) {
      btns.push({ text: '반려', cls: 'btn-danger', handler: () => { if (!reason.getValue().trim()) return reason.markInvalid('반려 사유를 입력해주세요.'); run('rejected'); } }, { text: '승인', handler: () => run('approved') });
    }
    (o.buttons || []).forEach(b => btns.push({ text: b.text, cls: b.danger ? 'btn-danger' : b.primary ? '' : 'btn-ghost', handler: () => b.fn(() => win.destroy()) }));
    btns.push({ text: '닫기', cls: 'btn-ghost', handler: () => win.destroy() });
    win.addDocked({ xtype: 'toolbar', dock: 'bottom', ui: 'footer', layout: { pack: 'end' }, items: btns.map(b => Object.assign({ xtype: 'button', scale: 'medium' }, b)) });
    win.show(); win.center();
    return () => win.destroy();
  }

  // ---------- 목록 공통: 페이지네이션 ----------
  function pager(el, page, pages, go) {
    el.innerHTML = pages > 1 ? `<button ${page === 1 ? 'disabled' : ''} data-p="${page - 1}">‹</button>` + Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === page ? 'on' : ''}" data-p="${i + 1}">${i + 1}</button>`).join('') + `<button ${page === pages ? 'disabled' : ''} data-p="${page + 1}">›</button>` : '';
    el.onclick = e => { const b = e.target.closest('[data-p]'); if (b) go(+b.dataset.p); };
  }
  window.WF = { ST, tag, dl, timeline, describeBp, describeProduct, thumbOf, detail, pager, price };
})();
