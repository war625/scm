(() => {
  'use strict';
  const { toast, Api, guard, fmtBiz, fmtPhone, validBiz } = App;
  const me = guard({ roles: ['vendor'] }); if (!me) return;
  const id = +new URLSearchParams(location.search).get('id') || 0;

  Ext.onReady(async () => {
    let bp = null;
    if (id) {
      bp = (await Api.bps()).find(x => x.id === id);
      if (!bp || bp.owner !== me.id) { toast('접근할 수 없는 거래처입니다.', 'error'); return setTimeout(() => (location.href = 'bp-list.html'), 800); }
      if (bp.status === 'requested') { toast('승인 요청 중인 거래처는 수정할 수 없습니다.', 'error'); return setTimeout(() => (location.href = 'bp-list.html'), 800); }
      document.getElementById('title').textContent = `BP 수정 · ${bp.name}`;
    }
    const v = (k, d = '') => (bp && bp[k]) ?? d, c = (k, d = '') => (bp && bp.contact && bp.contact[k]) || d, bk = (k, d = '') => (bp && bp.bank && bp.bank[k]) || d;
    const req = { allowBlank: false, blankText: '필수 입력 항목입니다.', afterLabelTextTpl: ' <span style="color:var(--danger)">*</span>' };
    const docs = { bizLicense: bp && bp.docs.bizLicense, bankbook: bp && bp.docs.bankbook, etc: bp && (bp.docs.etc || [])[0] };
    let bizOk = !!bp && !!bp.bizNo;

    const file = (key, label, required) => ({
      xtype: 'filefield', itemId: key, fieldLabel: label, labelAlign: 'top', anchor: '100%', buttonText: '파일 선택', emptyText: docs[key] ? `✔ ${docs[key].name} (기존 파일)` : 'PDF·JPG·PNG, 5MB 이하',
      ...(required ? { afterLabelTextTpl: ' <span style="color:var(--danger)">*</span>' } : {}),
      listeners: { change: function () {
        const fl = this.fileInputEl.dom.files[0]; if (!fl) return;
        if (!/\.(pdf|jpe?g|png)$/i.test(fl.name)) { this.reset(); return toast('PDF, JPG, PNG 파일만 가능합니다.', 'error'); }
        if (fl.size > 5 * 1048576) { this.reset(); return toast('파일은 5MB 이하만 가능합니다.', 'error'); }
        docs[key] = { name: fl.name, size: fl.size };
      } } });

    const panel = Ext.create('Ext.form.Panel', {
      renderTo: 'form', title: bp ? 'BP 수정' : 'BP 신규 등록', bodyPadding: 18, border: true,
      defaults: { anchor: '100%', labelAlign: 'top', msgTarget: 'under' },
      items: [
        { xtype: 'fieldset', title: '거래처 정보', defaults: { anchor: '100%', labelAlign: 'top', msgTarget: 'under' }, items: [
          { xtype: 'textfield', itemId: 'name', fieldLabel: '거래처명', value: v('name'), minLength: 2, maxLength: 60, ...req },
          { xtype: 'textfield', itemId: 'bizNo', fieldLabel: '사업자등록번호', value: v('bizNo'), ...req, validator: x => validBiz(x) || '유효하지 않은 사업자등록번호입니다.',
            triggers: { lookup: { cls: 'x-fa fa-search', tooltip: '국세청 조회 + 중복 확인', handler: () => lookup() } },
            listeners: { change: function (f, val) { const t = fmtBiz(val); if (t !== val) f.setValue(t); bizOk = false; panel.down('#bizMsg').hide(); } } },
          { xtype: 'displayfield', itemId: 'bizMsg', hideLabel: true, hidden: !(bp && bp.bizNo), value: '<span style="color:var(--success)">✔ 기존 등록 사업자번호</span>', margin: '-6 0 6 0' },
          { xtype: 'fieldcontainer', layout: 'hbox', defaults: { labelAlign: 'top', msgTarget: 'under' }, items: [
            { xtype: 'textfield', itemId: 'ceo', fieldLabel: '대표자명', flex: 1, margin: '0 10 0 0', value: v('ceo'), ...req },
            Kit.combo({ itemId: 'tradeType', fieldLabel: '거래유형', labelAlign: 'top', flex: 1, value: v('tradeType') || undefined, options: [['매입처', '매입처'], ['매출처', '매출처'], ['양방향', '양방향']], emptyText: '선택', msgTarget: 'under', ...req })] },
          { xtype: 'textfield', itemId: 'industry', fieldLabel: '업태/업종', value: v('industry') },
          { xtype: 'textfield', itemId: 'address', fieldLabel: '주소', value: v('address'), ...req }] },
        { xtype: 'fieldset', title: '담당자', defaults: { anchor: '100%', labelAlign: 'top', msgTarget: 'under' }, items: [
          { xtype: 'textfield', itemId: 'cName', fieldLabel: '담당자명', value: c('name'), ...req },
          { xtype: 'textfield', itemId: 'cPhone', fieldLabel: '휴대폰', value: c('phone'), ...req, regex: /^01\d-?\d{3,4}-?\d{4}$/, regexText: '휴대폰 번호 형식이 아닙니다.',
            listeners: { change: (f, val) => { const t = fmtPhone(val); if (t !== val) f.setValue(t); } } },
          { xtype: 'textfield', itemId: 'cEmail', fieldLabel: '이메일', value: c('email'), vtype: 'email', vtypeText: '올바른 이메일 형식이 아닙니다.', ...req }] },
        { xtype: 'fieldset', title: '정산 계좌 (선택)', defaults: { anchor: '100%', labelAlign: 'top', msgTarget: 'under' }, items: [
          Kit.combo({ itemId: 'bank', fieldLabel: '은행', labelAlign: 'top', value: bk('name') || undefined, emptyText: '선택', options: ['국민은행', '신한은행', '우리은행', '하나은행', '농협은행', '기업은행'].map(x => [x, x]) }),
          { xtype: 'textfield', itemId: 'account', fieldLabel: '계좌번호', value: bk('account'), maskRe: /[\d-]/ },
          { xtype: 'textfield', itemId: 'holder', fieldLabel: '예금주', value: bk('holder') }] },
        { xtype: 'fieldset', title: '첨부 서류', defaults: { anchor: '100%', labelAlign: 'top', msgTarget: 'under' }, items: [
          file('bizLicense', '사업자등록증', true), file('bankbook', '통장사본'), file('etc', '기타 서류')] }
      ],
      buttons: [
        { text: '취소', cls: 'btn-ghost', handler: () => (location.href = 'bp-list.html') },
        { text: '임시저장', cls: 'btn-ghost', handler: () => save(false) },
        { text: bp && bp.code ? '변경 승인요청' : '승인요청', handler: () => save(true) }]
    });
    Kit.fit(panel, document.getElementById('form'));
    const F = k => panel.down('#' + k);
    const msg = (t, ok) => { F('bizMsg').setValue(`<span style="color:var(--${ok ? 'success' : 'danger'})">${t}</span>`); F('bizMsg').show(); };

    async function lookup() {
      const f = F('bizNo'); if (!f.isValid()) return;
      panel.setLoading('국세청 조회 중...');
      try { const r = await Api.bpBizDup(f.getValue(), bp && bp.id); bizOk = true; msg(`✔ 국세청 조회 완료 (${r.status}) · 중복 없음`, true); }
      catch (e) { bizOk = false; msg('✖ ' + e.message); }
      panel.setLoading(false);
    }
    async function save(submit) {
      if (submit) {
        if (!panel.isValid()) return toast('입력값을 확인해주세요.', 'error');
        if (!bizOk) { msg('✖ 사업자등록번호 조회(중복확인)를 해주세요.'); return toast('사업자등록번호 조회가 필요합니다.', 'error'); }
        if (!docs.bizLicense) return toast('사업자등록증을 첨부해주세요.', 'error');
        if (F('account').getValue() && (!F('bank').getValue() || !F('holder').getValue().trim())) return toast('계좌번호를 입력하면 은행과 예금주도 필요합니다.', 'error');
      } else if (!F('name').isValid() || !F('name').getValue().trim()) return toast('임시저장에도 거래처명은 필요합니다.', 'error');
      const data = { id: bp && bp.id, code: bp && bp.code, name: F('name').getValue().trim(), bizNo: F('bizNo').getValue(), ceo: F('ceo').getValue().trim(), tradeType: F('tradeType').getValue() || '', industry: F('industry').getValue().trim(), address: F('address').getValue().trim(),
        contact: { name: F('cName').getValue().trim(), phone: F('cPhone').getValue(), email: F('cEmail').getValue().trim() }, bank: { name: F('bank').getValue() || '', account: F('account').getValue(), holder: F('holder').getValue().trim() },
        docs: { bizLicense: docs.bizLicense || null, bankbook: docs.bankbook || null, etc: docs.etc ? [docs.etc] : [] } };
      panel.setLoading('저장 중...');
      await Api.saveBp(data, me, submit);
      toast(submit ? '승인 요청이 접수되었습니다. (MDM W/F 대기)' : '임시저장 되었습니다.');
      setTimeout(() => (location.href = 'bp-list.html'), 800);
    }
  });
})();
