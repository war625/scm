(() => {
  'use strict';
  const { $, $$, toast, Api, Rules, setupField, fieldError, setLoading, bindMeter, Verify, fmtPhone, fmtBiz, validBiz, dateStr } = App;
  const s = App.guard(); if (!s) return;
  const me = Api.me();
  if (!me) { toast('세션 정보가 없습니다. 다시 로그인해주세요.', 'error'); setTimeout(() => { Api.logout(); location.href = 'login.html'; }, 1200); return; }
  const isAdmin = me.role === 'admin';

  // ---------- 계정 요약 ----------
  const ST = { pending: ['승인대기', 'st-pending'], approved: ['승인완료', 'st-approved'], rejected: ['반려', 'st-rejected'] };
  $('#pId').textContent = me.loginId; $('#pDate').textContent = dateStr(me.createdAt); $('#pRole').textContent = isAdmin ? '관리자' : '업체(BP)';
  const stEl = $('#myStatus'); stEl.textContent = ST[me.status][0]; stEl.classList.add(ST[me.status][1]);
  if (isAdmin) $('#coForm').remove();

  // ---------- 업체 정보 ----------
  const co = $('#coForm');
  if (co) {
    const F = n => co.elements[n];
    F('bizNo').value = me.company.bizNo; F('company').value = me.company.name; F('ceo').value = me.company.ceo; F('bizType').value = me.company.type;
    const vCo = setupField(F('company'), [Rules.required]), vCeo = setupField(F('ceo'), [Rules.required]), vType = setupField(F('bizType'), [Rules.required]);
    let bizDirty = false, bizOk = true;
    $('#bizEdit').addEventListener('click', async e => {
      const b = e.currentTarget;
      if (F('bizNo').readOnly) { F('bizNo').readOnly = false; F('bizNo').focus(); b.textContent = '조회'; bizDirty = true; bizOk = false; return; }
      if (!validBiz(F('bizNo').value)) return fieldError(F('bizNo'), '유효하지 않은 사업자등록번호입니다.');
      b.disabled = true; b.textContent = '조회 중';
      try {
        if (fmtBiz(F('bizNo').value) !== me.company.bizNo) await Api.bizLookup(F('bizNo').value);
        bizOk = true; F('bizNo').readOnly = true; F('bizNo').closest('.field').classList.add('verified'); F('bizNo').closest('.field').classList.remove('invalid'); b.textContent = '변경';
      } catch (ex) { fieldError(F('bizNo'), ex.message); b.textContent = '조회'; }
      b.disabled = false;
    });
    F('bizNo').addEventListener('input', () => { F('bizNo').value = fmtBiz(F('bizNo').value); bizOk = false; F('bizNo').closest('.field').classList.remove('verified'); });
    co.addEventListener('submit', async e => {
      e.preventDefault();
      if (![vCo(), vCeo(), vType()].every(Boolean)) return;
      if (bizDirty && !bizOk) return fieldError(F('bizNo'), '사업자등록번호 조회(재인증)를 완료해주세요.');
      const btn = $('button[type=submit]', co); setLoading(btn, true, '저장 중...');
      await Api.updateMember(me.loginId, { company: { bizNo: fmtBiz(F('bizNo').value), name: F('company').value.trim(), ceo: F('ceo').value.trim(), type: F('bizType').value } });
      setLoading(btn, false); toast('업체정보가 저장되었습니다.'); bizDirty = false;
    });
  }

  // ---------- 담당자 정보 (휴대폰 변경 시 재인증) ----------
  const mg = $('#mgForm'), M = n => mg.elements[n];
  M('mName').value = me.manager.name; M('email').value = me.manager.email; M('phone').value = me.manager.phone;
  const vMn = setupField(M('mName'), [Rules.required]), vEm = setupField(M('email'), [Rules.required, Rules.email]), vPh = setupField(M('phone'), [Rules.required, Rules.phone]);
  let phoneOk = true, sess = null, stop = null;
  M('phone').addEventListener('input', () => {
    M('phone').value = fmtPhone(M('phone').value);
    const changed = M('phone').value !== me.manager.phone; phoneOk = !changed;
    $('#sendCode').hidden = !changed; $('#phoneHint').hidden = !changed; M('phone').closest('.field').classList.remove('verified');
    M('phone').closest('.field').classList.toggle('has-btn', changed); if (!changed) $('#codeRow').hidden = true;
  });
  $('#sendCode').addEventListener('click', () => {
    if (!vPh()) return;
    stop && stop(); sess = Verify.send('SMS', M('phone').value);
    $('#codeRow').hidden = false; M('code').value = ''; M('code').focus();
    stop = Verify.timer($('#timer'), () => (sess = null));
  });
  $('#verifyCode').addEventListener('click', () => {
    const r = Verify.check(sess, M('code').value); if (r !== true) return fieldError(M('code'), r);
    phoneOk = true; stop && stop(); $('#codeRow').hidden = true; M('phone').closest('.field').classList.add('verified'); toast('재인증이 완료되었습니다.');
  });
  mg.addEventListener('submit', async e => {
    e.preventDefault();
    if (![vMn(), vEm(), vPh()].every(Boolean)) return;
    if (!phoneOk) return fieldError(M('phone'), '변경한 휴대폰 번호의 재인증이 필요합니다.');
    const btn = $('button[type=submit]', mg); setLoading(btn, true, '저장 중...');
    await Api.updateMember(me.loginId, { manager: { name: M('mName').value.trim(), email: M('email').value.trim(), phone: M('phone').value } });
    me.manager.phone = M('phone').value; M('phone').dispatchEvent(new Event('input'));
    setLoading(btn, false); toast('담당자정보가 저장되었습니다.');
  });

  // ---------- 비밀번호 변경 ----------
  const pw = $('#pwForm'), P = n => pw.elements[n];
  const vCur = setupField(P('cur'), [Rules.required]), vNew = setupField(P('password'), [Rules.required, Rules.password]);
  const vNew2 = setupField(P('password2'), [Rules.required, v => v === P('password').value || '비밀번호가 일치하지 않습니다.']);
  bindMeter(P('password'), pw);
  pw.addEventListener('submit', async e => {
    e.preventDefault();
    if (![vCur(), vNew(), vNew2()].every(Boolean)) return;
    const btn = $('button[type=submit]', pw); setLoading(btn, true, '변경 중...');
    try { await Api.changePassword(me.loginId, P('cur').value, P('password').value); toast('비밀번호가 변경되었습니다.'); pw.reset(); $$('.field', pw).forEach(x => x.classList.remove('valid')); }
    catch (ex) { fieldError(P('cur'), ex.message); }
    setLoading(btn, false);
  });

  // ---------- 수신동의 ----------
  const ag = $('#agForm');
  ['email', 'sms', 'talk'].forEach(k => (ag.elements[k].checked = !!me.agree[k]));
  ag.addEventListener('submit', async e => {
    e.preventDefault();
    await Api.updateMember(me.loginId, { agree: { email: ag.elements.email.checked, sms: ag.elements.sms.checked, talk: ag.elements.talk.checked } });
    toast('수신동의 설정이 저장되었습니다.');
  });
})();
