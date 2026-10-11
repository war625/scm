(() => {
  'use strict';
  const { $, $$, esc, ago, dateStr, toast, Api, guard, setLoading, fieldError } = App;
  if (!guard({ roles: ['admin'] })) return;   // 업체 계정은 접근 불가

  const ST = { pending: ['승인대기', 'st-pending'], approved: ['승인완료', 'st-approved'], rejected: ['반려', 'st-rejected'] };
  const tag = m => `<span class="st ${m.locked ? 'st-locked' : ST[m.status][1]}">${m.locked ? '잠김' : ST[m.status][0]}</span>`;
  let list = [], state = { st: 'all', q: '' }, selected = new Set(), cur = null;

  const rows = $('#rows');
  const filtered = () => list.filter(m => (state.st === 'all' || m.status === state.st) &&
    [m.company.name, m.company.bizNo, m.loginId, m.manager.name].join(' ').toLowerCase().includes(state.q.toLowerCase()))
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.createdAt - a.createdAt);

  function render() {
    const c = s => list.filter(m => m.status === s).length;
    $('#stats').innerHTML = [['all', '전체 업체', list.length], ['pending', '승인대기', c('pending')], ['approved', '승인완료', c('approved')], ['rejected', '반려', c('rejected')]]
      .map(([k, t, n]) => `<div class="stat" data-st="${k}"><b>${n}</b><small>${t}</small></div>`).join('');
    if (state.st === 'log') { $('#tblWrap').hidden = true; $('#logWrap').hidden = false; renderLog(); return; }
    $('#tblWrap').hidden = false; $('#logWrap').hidden = true;
    const r = filtered();
    rows.innerHTML = r.length ? r.map(m => `<tr data-id="${esc(m.loginId)}">
      <td><input type="checkbox" data-sel="${esc(m.loginId)}" ${m.status !== 'pending' ? 'disabled' : ''} ${selected.has(m.loginId) ? 'checked' : ''} aria-label="선택"></td>
      <td><b>${esc(m.company.name)}</b><br><small style="color:var(--muted)">${esc(m.loginId)}</small></td><td>${esc(m.company.bizNo)}</td><td>${esc(m.company.ceo)}</td>
      <td>${esc(m.manager.name)}<br><small style="color:var(--muted)">${esc(m.manager.phone)}</small></td><td>${dateStr(m.createdAt)}</td><td>${tag(m)}</td></tr>`).join('')
      : '<tr><td colspan="7" class="empty">조건에 맞는 업체가 없습니다.</td></tr>';
    $('#bulkApprove').disabled = !selected.size; $('#bulkApprove').textContent = selected.size ? `선택 승인 (${selected.size})` : '선택 승인';
    $('#chkAll').checked = false;
  }
  function renderLog() {
    const l = Api.notices();
    $('#logRows').innerHTML = l.length ? l.map(n => `<tr style="cursor:default"><td>${ago(n.at)}</td><td>${esc(n.channel)}</td><td>${esc(n.to)}</td><td style="white-space:normal">${esc(n.text)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">발송 이력이 없습니다.</td></tr>';
  }

  // ---------- 목록 이벤트 ----------
  rows.addEventListener('click', e => {
    const chk = e.target.closest('[data-sel]');
    if (chk) { chk.checked ? selected.add(chk.dataset.sel) : selected.delete(chk.dataset.sel); render(); return; }
    const tr = e.target.closest('tr[data-id]'); if (tr) openDetail(tr.dataset.id);
  });
  $('#chkAll').addEventListener('change', e => { filtered().filter(m => m.status === 'pending').forEach(m => (e.target.checked ? selected.add(m.loginId) : selected.delete(m.loginId))); render(); $('#chkAll').checked = e.target.checked; });
  $('#chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; $$('#chips .chip').forEach(x => x.classList.toggle('on', x === c)); state.st = c.dataset.st; render(); });
  $('#stats').addEventListener('click', e => { const s = e.target.closest('.stat'); if (s) $(`#chips [data-st=${s.dataset.st}]`).click(); });
  let t; $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; render(); }, 200); });

  // ---------- 상세 / 승인·반려 ----------
  const open = () => { $('#detail').classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { $('#detail').classList.remove('open'); document.body.style.overflow = ''; };
  document.addEventListener('keydown', e => e.key === 'Escape' && close());
  $('#detail').addEventListener('mousedown', e => e.target.id === 'detail' && close());
  $$('[data-close]').forEach(b => b.addEventListener('click', close));

  function openDetail(id) {
    cur = list.find(m => m.loginId === id);
    const m = cur, d = m.docs || {};
    $('#dName').textContent = m.company.name; const s = $('#dSt'); s.textContent = ST[m.status][0]; s.className = 'st ' + ST[m.status][1];
    $('#dReason').hidden = m.status !== 'rejected'; $('#dReason').textContent = '반려 사유: ' + (m.rejectReason || '-');
    $('#dInfo').innerHTML = [['아이디', m.loginId], ['사업자번호', m.company.bizNo], ['대표자', m.company.ceo], ['업종', m.company.type], ['담당자', m.manager.name], ['이메일', m.manager.email], ['휴대폰', m.manager.phone], ['신청일', dateStr(m.createdAt)],
      ['수신동의', ['email', 'sms', 'talk'].filter(k => m.agree[k]).map(k => ({ email: '이메일', sms: 'SMS', talk: '알림톡' }[k])).join(', ') || '없음']].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    $('#dDocs').innerHTML = [['사업자등록증', d.bizLicense], ['통장사본', d.bankbook]].map(([k, f]) => `<span>📄 ${k}: ${f ? `${esc(f.name)} (${Math.ceil(f.size / 1024)}KB)` : '<i style="color:var(--muted)">미제출</i>'}</span>`).join('');
    $('#dActions').hidden = m.status !== 'pending';
    $('#rejectReason').value = ''; $('#rejectReason').closest('.field').classList.remove('invalid');
    open();
  }
  $('#reasons').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { const r = $('#rejectReason'); r.value = r.value ? `${r.value}, ${c.textContent}` : c.textContent; r.dispatchEvent(new Event('input')); } });
  $('#approveBtn').addEventListener('click', () => decide([cur.loginId], 'approved', '', $('#approveBtn')));
  $('#rejectBtn').addEventListener('click', () => {
    const reason = $('#rejectReason').value.trim();
    if (!reason) return fieldError($('#rejectReason'), '반려 사유를 입력해주세요.');
    decide([cur.loginId], 'rejected', reason, $('#rejectBtn'));
  });
  $('#bulkApprove').addEventListener('click', () => confirm(`${selected.size}건을 승인할까요?`) && decide([...selected], 'approved', '', $('#bulkApprove')));

  async function decide(ids, status, reason, btn) {
    setLoading(btn, true, '처리 중...');
    const done = await Api.decide(ids, status, reason);
    setLoading(btn, false); selected.clear(); close();
    list = await Api.members(); render();
    toast(`${done.length}건 ${status === 'approved' ? '승인' : '반려'} 처리 · SMS 발송(데모)`);
  }

  // ---------- 초기 로딩 ----------
  rows.innerHTML = '<tr><td colspan="7"><div class="skeleton"></div></td></tr>';
  Api.members().then(m => { list = m; render(); });
})();
