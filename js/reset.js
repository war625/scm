(() => {
  'use strict';
  const { $, $$, toast, Api, Rules, setupField, fieldError, setLoading, bindMeter, Verify, maskEmail, maskPhone } = App;
  const f = $('#resetForm'), F = n => f.elements[n];
  const vId = setupField(F('loginId'), [Rules.required]), vEm = setupField(F('email'), [Rules.required, Rules.email]);
  const vPw = setupField(F('password'), [Rules.required, Rules.password]);
  const vPw2 = setupField(F('password2'), [Rules.required, v => v === F('password').value || '비밀번호가 일치하지 않습니다.']);
  bindMeter(F('password'), f);
  const panes = $$('.pane', f), bars = $$('.steps span');
  const go = n => { panes.forEach((p, i) => (p.hidden = i !== n)); bars.forEach((b, i) => b.classList.toggle('on', i <= n)); $('#rsSub').textContent = ['가입한 아이디와 담당자 이메일을 입력하세요.', '본인 확인을 위해 인증번호를 받아주세요.', '새 비밀번호를 입력하세요.'][n]; };
  let info = null, sess = null, stop = null;
  const target = () => (F('channel').value === 'SMS' ? maskPhone(info.phone) : maskEmail(info.email));
  const paintTarget = () => ($('#rsTarget').textContent = `${F('channel').value}로 발송: ${target()}`);

  $('#rsFind').addEventListener('click', async e => {
    if (![vId(), vEm()].every(Boolean)) return;
    const b = e.currentTarget; setLoading(b, true, '확인 중...');
    try { info = await Api.findForReset(F('loginId').value, F('email').value); paintTarget(); go(1); }
    catch (ex) { fieldError(F('email'), ex.message); }
    setLoading(b, false);
  });
  $$('[name=channel]', f).forEach(r => r.addEventListener('change', () => { paintTarget(); sess = null; $('#rsCodeRow').hidden = true; }));
  $('#rsSend').addEventListener('click', () => {
    stop && stop(); const ch = F('channel').value;
    sess = Verify.send(ch, ch === 'SMS' ? info.phone : info.email);
    $('#rsCodeRow').hidden = false; F('code').value = ''; F('code').focus();
    stop = Verify.timer($('#rsTimer'), () => (sess = null));
    $('#rsSend').textContent = '인증번호 다시 받기';
  });
  $('#rsVerify').addEventListener('click', () => {
    const r = Verify.check(sess, F('code').value);
    if (r !== true) return fieldError(F('code'), r);
    stop && stop(); go(2);
  });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (![vPw(), vPw2()].every(Boolean)) return;
    const btn = $('button[type=submit]', f); setLoading(btn, true, '변경 중...');
    await Api.resetPassword(F('loginId').value.trim().toLowerCase(), F('password').value);
    toast('비밀번호가 변경되었습니다. 다시 로그인해주세요.'); setTimeout(() => (location.href = 'login.html'), 1000);
  });
  go(0);
})();
