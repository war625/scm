(() => {
  'use strict';
  const { $, $$, toast, Api, Rules, setupField, fieldError, setLoading, bindMeter, Verify, fmtPhone, fmtBiz, validBiz } = App;
  const params = new URLSearchParams(location.search);

  // ---------- 로그인 ----------
  const lf = $('#loginForm');
  if (lf) {
    const roleHome = r => (r === 'admin' ? 'admin-members.html' : 'board.html');
    const err = $('#loginErr');
    if (params.get('joined')) $('#joined').hidden = false;
    const savedId = localStorage.getItem('savedId');
    if (savedId) { lf.loginId.value = savedId; lf.saveId.checked = true; }
    const checks = [setupField(lf.loginId, [Rules.required]), setupField(lf.password, [Rules.required])];
    lf.addEventListener('submit', async e => {
      e.preventDefault(); err.hidden = true;
      if (!checks.map(c => c()).every(Boolean)) return toast('입력값을 확인해주세요.', 'error');
      const btn = $('button[type=submit]', lf); setLoading(btn, true, '로그인 중...');
      try {
        const u = await Api.login(lf.loginId.value, lf.password.value);
        lf.saveId.checked ? localStorage.setItem('savedId', lf.loginId.value.trim()) : localStorage.removeItem('savedId');
        toast('환영합니다!');
        const next = params.get('next');
        setTimeout(() => (location.href = next && /^[\w-]+\.html$/.test(next) ? next : roleHome(u.role)), 500);
      } catch (ex) {
        err.textContent = ex.message; err.hidden = false;
        err.className = 'alert ' + (ex.code === 'PENDING' ? 'warn' : 'err');
        if (ex.code === 'LOCKED') err.innerHTML = `${ex.message} <a href="reset.html">비밀번호 재설정</a>`;
        setLoading(btn, false);
      }
    });
    $$('[data-fill]').forEach(b => b.addEventListener('click', () => {
      const d = b.dataset.fill === 'admin' ? ['admin', 'admin1234'] : ['demo', 'demo1234'];
      [lf.loginId.value, lf.password.value] = d; $$('input', lf).forEach(i => i.dispatchEvent(new Event('input')));
    }));
  }

  // ---------- 업체 회원가입 (4단계) ----------
  const sf = $('#signupForm');
  if (sf) {
    const F = n => sf.elements[n];
    const st = { id: false, biz: false, phone: false };   // 중복확인 / 사업자조회 / 본인인증 완료 여부
    const docs = {};
    const vId = setupField(F('loginId'), [Rules.required, v => /^[a-z0-9]{4,20}$/.test(v) || '영문 소문자·숫자 4~20자로 입력해주세요.']);
    const vPw = setupField(F('password'), [Rules.required, Rules.password]);
    const vPw2 = setupField(F('password2'), [Rules.required, v => v === F('password').value || '비밀번호가 일치하지 않습니다.']);
    const vBiz = setupField(F('bizNo'), [Rules.required, v => validBiz(v) || '유효하지 않은 사업자등록번호입니다.']);
    const vCo = setupField(F('company'), [Rules.required]), vCeo = setupField(F('ceo'), [Rules.required]), vType = setupField(F('bizType'), [Rules.required]);
    const vMn = setupField(F('mName'), [Rules.required]), vEm = setupField(F('email'), [Rules.required, Rules.email]);
    const vPh = setupField(F('phone'), [Rules.required, Rules.phone]);
    bindMeter(F('password'), sf);
    F('password').addEventListener('input', () => F('password2').value && F('password2').validate());

    const panes = $$('.pane', sf), bars = $$('.steps span');
    const go = n => { panes.forEach((p, i) => (p.hidden = i !== n)); bars.forEach((b, i) => b.classList.toggle('on', i <= n)); $('#stepLabel').textContent = `${n + 1} / ${panes.length} 단계`; scrollTo({ top: 0, behavior: 'smooth' }); };
    let cur = 0;
    const need = (flag, input, msg) => { if (!flag) { fieldError(input, msg); return false; } return true; };
    const gates = [
      () => [vId(), vPw(), vPw2()].every(Boolean) && need(st.id, F('loginId'), '아이디 중복확인을 해주세요.'),
      () => [vBiz(), vCo(), vCeo(), vType()].every(Boolean) && need(st.biz, F('bizNo'), '사업자등록번호 조회를 해주세요.'),
      () => [vMn(), vEm(), vPh()].every(Boolean) && need(st.phone, F('phone'), '휴대폰 본인인증을 완료해주세요.')
    ];
    $$('[data-next]', sf).forEach(b => b.addEventListener('click', () => gates[cur]() ? go(++cur) : toast('입력값을 확인해주세요.', 'error')));
    $$('[data-prev]', sf).forEach(b => b.addEventListener('click', () => go(--cur)));

    // 아이디 중복확인
    const reset = (flagName, input) => input.addEventListener('input', () => { st[flagName] = false; input.closest('.field').classList.remove('verified'); });
    reset('id', F('loginId')); reset('biz', F('bizNo'));
    $('#idCheck').addEventListener('click', async e => {
      if (!vId()) return;
      const b = e.currentTarget; b.disabled = true;
      if (await Api.idAvailable(F('loginId').value)) { st.id = true; F('loginId').closest('.field').classList.add('verified'); }
      else fieldError(F('loginId'), '이미 사용 중인 아이디입니다.');
      b.disabled = false;
    });

    // 사업자번호 조회 (국세청 API 자리)
    F('bizNo').addEventListener('input', () => (F('bizNo').value = fmtBiz(F('bizNo').value)));
    $('#bizCheck').addEventListener('click', async e => {
      if (!vBiz()) return;
      const b = e.currentTarget; b.disabled = true; b.textContent = '조회 중';
      try { const r = await Api.bizLookup(F('bizNo').value); st.biz = true; $('#bizOk').textContent = `✔ 국세청 조회 완료 (${r.status})`; F('bizNo').closest('.field').classList.add('verified'); }
      catch (ex) { fieldError(F('bizNo'), ex.message); }
      b.disabled = false; b.textContent = '조회';
    });

    // 휴대폰 본인인증
    F('phone').addEventListener('input', () => { F('phone').value = fmtPhone(F('phone').value); st.phone = false; F('phone').closest('.field').classList.remove('verified'); });
    let sess = null, stop = null;
    $('#sendCode').addEventListener('click', () => {
      if (!vPh()) return;
      stop && stop(); sess = Verify.send('SMS', F('phone').value);
      $('#codeRow').hidden = false; F('code').value = ''; F('code').focus();
      stop = Verify.timer($('#timer'), () => (sess = null));
      $('#sendCode').textContent = '재요청';
    });
    $('#verifyCode').addEventListener('click', () => {
      const r = Verify.check(sess, F('code').value);
      if (r !== true) return fieldError(F('code'), r);
      st.phone = true; stop && stop(); $('#codeRow').hidden = true; F('phone').closest('.field').classList.add('verified'); F('phone').closest('.field').classList.remove('invalid');
      toast('본인인증이 완료되었습니다.');
    });

    // 서류 첨부
    $$('.upload', sf).forEach(box => {
      const input = $('input', box), label = $('.fname', box), key = box.dataset.doc;
      $('button', box).addEventListener('click', () => input.click());
      input.addEventListener('change', () => {
        const f = input.files[0]; if (!f) return;
        if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) { input.value = ''; return toast('PDF, JPG, PNG 파일만 가능합니다.', 'error'); }
        if (f.size > 5 * 1048576) { input.value = ''; return toast('파일은 5MB 이하만 가능합니다.', 'error'); }
        docs[key] = { name: f.name, size: f.size }; box.classList.add('has'); label.textContent = `✔ ${f.name} (${Math.ceil(f.size / 1024)}KB)`;
      });
    });

    // 약관
    const all = $('#agreeAll'), items = $$('.agree');
    all.addEventListener('change', () => items.forEach(i => (i.checked = all.checked)));
    items.forEach(i => i.addEventListener('change', () => (all.checked = items.every(x => x.checked))));

    sf.addEventListener('submit', async e => {
      e.preventDefault();
      if (!docs.bizLicense) return toast('사업자등록증을 첨부해주세요.', 'error');
      if (!$$('.agree[required]', sf).every(c => c.checked)) return toast('필수 약관에 동의해주세요.', 'error');
      const btn = $('button[type=submit]', sf); setLoading(btn, true, '신청 중...');
      try {
        await Api.signup({
          loginId: F('loginId').value, password: F('password').value,
          company: { name: F('company').value.trim(), bizNo: F('bizNo').value, ceo: F('ceo').value.trim(), type: F('bizType').value },
          manager: { name: F('mName').value.trim(), email: F('email').value.trim(), phone: F('phone').value },
          docs: { bizLicense: docs.bizLicense, bankbook: docs.bankbook || null }, agree: { email: F('agEmail').checked, sms: F('agSms').checked, talk: F('agSms').checked }
        });
        toast('가입 신청이 접수되었습니다.'); setTimeout(() => (location.href = 'login.html?joined=1'), 900);
      } catch (ex) { toast(ex.message, 'error'); setLoading(btn, false); cur = 0; go(0); }
    });
    go(0);
  }
})();
