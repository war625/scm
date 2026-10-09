(() => {
  'use strict';
  const { $, $$, toast, Api, Rules, setupField, setLoading } = App;
  const next = new URLSearchParams(location.search).get('next') || 'board.html';

  // ---------- 로그인 ----------
  const lf = $('#loginForm');
  if (lf) {
    const checks = [setupField(lf.email, [Rules.required, Rules.email]), setupField(lf.password, [Rules.required])];
    lf.addEventListener('submit', async e => {
      e.preventDefault();
      if (!checks.map(c => c()).every(Boolean)) { lf.classList.remove('shake'); return toast('입력값을 확인해주세요.', 'error'); }
      const btn = $('button[type=submit]', lf); setLoading(btn, true, '로그인 중...');
      try { await Api.login(lf.email.value.trim(), lf.password.value, lf.remember.checked); toast('환영합니다!'); setTimeout(() => (location.href = next), 500); }
      catch (err) { toast(err.message, 'error'); setLoading(btn, false); }
    });
    $('#demoFill')?.addEventListener('click', () => { lf.email.value = 'demo@demo.com'; lf.password.value = 'demo1234'; $$('input', lf).forEach(i => i.dispatchEvent(new Event('input'))); });
  }

  // ---------- 회원가입 (2단계) ----------
  const sf = $('#signupForm');
  if (sf) {
    const step1 = [setupField(sf.name, [Rules.required]), setupField(sf.email, [Rules.required, Rules.email]),
      setupField(sf.password, [Rules.required, Rules.min(8), v => (/[A-Za-z]/.test(v) && /\d/.test(v)) || '영문과 숫자를 함께 사용해주세요.']),
      setupField(sf.password2, [Rules.required, v => v === sf.password.value || '비밀번호가 일치하지 않습니다.'])];
    const step2 = [setupField(sf.phone, [v => !v || /^01\d-?\d{3,4}-?\d{4}$/.test(v) || '휴대폰 번호 형식이 아닙니다.'])];
    const panes = $$('.pane', sf), bars = $$('.steps span');
    const go = n => { panes.forEach((p, i) => (p.hidden = i !== n)); bars.forEach((b, i) => b.classList.toggle('on', i <= n)); $('#stepLabel').textContent = `${n + 1} / 2 단계`; };

    // 비밀번호 강도 미터
    const meter = $$('.meter i'), mtxt = $('.meter-text');
    sf.password.addEventListener('input', () => {
      const v = sf.password.value;
      const s = [v.length >= 8, /[A-Z]/.test(v) && /[a-z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
      const colors = ['', '#e5484d', '#d97706', '#65a30d', '#16a34a'];
      meter.forEach((m, i) => (m.style.background = i < s ? colors[s] : ''));
      mtxt.textContent = v ? ['', '약함', '보통', '좋음', '매우 강함'][s] : '8자 이상, 영문+숫자 조합';
    });
    sf.password2.addEventListener('input', () => sf.password2.value && sf.password2.validate());
    // 휴대폰 자동 하이픈
    sf.phone.addEventListener('input', () => {
      const d = sf.phone.value.replace(/\D/g, '').slice(0, 11);
      sf.phone.value = d.length > 7 ? `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
    });
    // 약관 전체동의
    const all = $('#agreeAll'), items = $$('.agree');
    all.addEventListener('change', () => items.forEach(i => (i.checked = all.checked)));
    items.forEach(i => i.addEventListener('change', () => (all.checked = items.every(x => x.checked))));

    $('#toStep2').addEventListener('click', () => step1.map(c => c()).every(Boolean) ? go(1) : toast('입력값을 확인해주세요.', 'error'));
    $('#toStep1').addEventListener('click', () => go(0));
    sf.addEventListener('submit', async e => {
      e.preventDefault();
      if (!step2.map(c => c()).every(Boolean)) return;
      if (!$$('.agree[required]', sf).every(c => c.checked)) return toast('필수 약관에 동의해주세요.', 'error');
      const btn = $('button[type=submit]', sf); setLoading(btn, true, '가입 중...');
      try {
        await Api.signup({ name: sf.name.value.trim(), email: sf.email.value.trim(), password: sf.password.value, phone: sf.phone.value });
        toast('가입 완료! 로그인 페이지로 이동합니다.'); setTimeout(() => (location.href = 'login.html'), 900);
      } catch (err) { toast(err.message, 'error'); setLoading(btn, false); go(0); }
    });
    go(0);
  }
})();
