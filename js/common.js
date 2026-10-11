/* 공통 모듈: 테마, 토스트, 목업 API(localStorage), 세션/권한 가드, 상단바
 * 실제 서버/MDM/AI 연동 시 Api 객체의 메서드만 fetch 호출로 교체하면 화면 코드는 그대로 사용 가능 */
(() => {
  'use strict';

  // ---------- 테마 ----------
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  root.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const SUN = '☀️', MOON = '🌙';
  function bindTheme() {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      if (btn.dataset.bound) return; btn.dataset.bound = 1;
      const paint = () => (btn.textContent = root.dataset.theme === 'dark' ? SUN : MOON);
      paint();
      btn.setAttribute('aria-label', '테마 전환');
      btn.addEventListener('click', () => {
        root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', root.dataset.theme);
        paint();
      });
    });
  }

  // ---------- 토스트 ----------
  function toast(message, type = 'success', ms = 2600) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); document.body.append(box); }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = (type === 'success' ? '✅ ' : '⚠️ ') + message;
    box.append(el);
    setTimeout(() => { el.style.transition = '.3s'; el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, ms);
  }

  // ---------- 유틸 ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = n => Number(n || 0).toLocaleString('ko-KR') + '원';
  const ago = ts => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return '방금 전'; if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };
  const dateStr = ts => new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // ---------- 입력 포맷/검증 헬퍼 ----------
  const digits = s => String(s || '').replace(/\D/g, '');
  const fmtPhone = v => { const d = digits(v).slice(0, 11); return d.length > 7 ? `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d; };
  const fmtBiz = v => { const d = digits(v).slice(0, 10); return d.length > 5 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d; };
  // 사업자등록번호 체크섬 (국세청 검증식)
  const bizCheckDigit = first9 => {
    const w = [1, 3, 7, 1, 3, 7, 1, 3, 5], d = first9.split('').map(Number);
    const sum = d.reduce((a, n, i) => a + n * w[i], 0) + Math.floor(d[8] * 5 / 10);
    return (10 - sum % 10) % 10;
  };
  const validBiz = v => { const d = digits(v); return d.length === 10 && bizCheckDigit(d.slice(0, 9)) === +d[9]; };
  const maskPhone = p => digits(p).replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-****-$3');
  const maskEmail = e => String(e).replace(/^(.{2}).*(@.*)$/, '$1***$2');

  // ---------- 인증번호(SMS/이메일) 목업 ----------
  // 실제 환경에서는 고객사 발송 API 호출 후 서버가 코드를 검증. 데모에서는 토스트로 코드를 보여준다.
  const Verify = {
    send(channel, target) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      Api.addNotice({ to: target, channel, text: `[인증번호] ${code} (3분 이내 입력)` });
      toast(`[데모] ${channel} 인증번호: ${code}`, 'success', 9000);
      return { code, expires: Date.now() + 180000 };
    },
    check(sess, input) {
      if (!sess) return '먼저 인증번호를 받아주세요.';
      if (Date.now() > sess.expires) return '인증 시간이 만료되었습니다. 다시 요청해주세요.';
      return sess.code === String(input).trim() ? true : '인증번호가 일치하지 않습니다.';
    },
    timer(el, onEnd) {
      let t, end = Date.now() + 180000;
      const tick = () => {
        const s = Math.max(0, Math.round((end - Date.now()) / 1000));
        el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        if (!s) { clearInterval(t); onEnd && onEnd(); }
      };
      tick(); t = setInterval(tick, 500);
      return () => clearInterval(t);
    }
  };

  // ---------- 목업 API (비동기, 네트워크 지연 흉내) ----------
  const seedPosts = () => {
    const cats = ['notice', 'free', 'qna'], now = Date.now();
    const titles = ['서비스 오픈 안내', '신규 기능 업데이트 소식', '상품 등록 방법이 궁금해요', '재고 연동은 어떻게 하나요?', '이번 주 프로모션 공유', '다크모드 지원되나요?', '엑셀 일괄 등록 질문', '배송 정책 변경 공지', '사용 후기 남깁니다', '카테고리 추가 요청', '모바일 화면 개선 제안', 'API 연동 문의'];
    return titles.map((t, i) => ({
      id: i + 1, category: i === 0 || i === 7 ? 'notice' : cats[1 + (i % 2)], title: t,
      content: `${t}에 대한 내용입니다.\n\n이 글은 샘플 데이터이며 실제 서비스에서는 서버에서 불러옵니다.`,
      author: ['관리자', '민지', '준호', '서연'][i % 4], views: 30 + i * 17, likes: i * 2, liked: false,
      createdAt: now - i * 3600e3 * 5, comments: i % 3 ? [] : [{ author: '서연', text: '확인했습니다 👍', at: now - 3600e3 }]
    }));
  };

  // 회원(업체) 시드: 관리자 1, 승인 업체 2, 승인대기 3, 반려 1
  const seedMembers = () => {
    const now = Date.now(), day = 864e5;
    const biz = n => { const b = String(n).padStart(9, '0'); return fmtBiz(b + bizCheckDigit(b)); };
    const v = (loginId, company, ceo, type, n, mName, phone, status, ago_, extra = {}) => ({
      loginId, password: 'test1234', role: 'vendor', status, createdAt: now - ago_ * day,
      company: { name: company, bizNo: biz(n), ceo, type },
      manager: { name: mName, email: `${loginId}@example.com`, phone },
      docs: { bizLicense: { name: `사업자등록증_${company}.pdf`, size: 482113 }, bankbook: status === 'pending' && n % 2 ? null : { name: `통장사본_${company}.pdf`, size: 213004 } },
      agree: { email: true, sms: n % 2 === 0, talk: false }, failCount: 0, locked: false, ...extra
    });
    return [
      { loginId: 'admin', password: 'admin1234', role: 'admin', status: 'approved', createdAt: now - 90 * day,
        company: { name: '운영사무국', bizNo: '', ceo: '', type: '' }, manager: { name: '관리자', email: 'admin@example.com', phone: '010-0000-0000' },
        docs: {}, agree: { email: true, sms: true, talk: true }, failCount: 0, locked: false },
      v('demo', '데모상사', '김데모', '식품', 100100100, '데모', '010-1111-2222', 'approved', 30, { password: 'demo1234' }),
      v('chungsol', '청솔식품', '이청솔', '식품', 123456789, '박담당', '010-2345-6789', 'approved', 14),
      v('hanbit', '한빛상사', '최한빛', '생활용품', 220330441, '정한빛', '010-3456-7890', 'pending', 1),
      v('saeron', '새론물산', '강새론', '전자기기', 311220987, '오새론', '010-4567-8901', 'pending', 2),
      v('daonfood', '다온푸드', '윤다온', '식품', 405516620, '한다온', '010-5678-9012', 'pending', 3),
      v('miraecorp', '미래유통', '송미래', '뷰티', 512340098, '임미래', '010-6789-0123', 'rejected', 5, { rejectReason: '사업자등록증 이미지가 흐려 식별이 어렵습니다. 다시 제출해주세요.' })
    ];
  };
  const members = () => { let m = read('members', null); if (!m) { m = seedMembers(); write('members', m); } return m; };
  const saveMembers = m => write('members', m);
  const find = (id, list = members()) => list.find(x => x.loginId === id);
  const publicInfo = m => ({ id: m.loginId, name: m.manager.name, email: m.manager.email, role: m.role, company: m.company.name });

  const Api = {
    // --- 회원가입 ---
    async idAvailable(id) { await sleep(350); return !find(id.toLowerCase()); },
    async bizLookup(bizNo) {
      await sleep(800); // 국세청 사업자 상태조회 API 자리
      if (!validBiz(bizNo)) throw new Error('유효하지 않은 사업자등록번호입니다.');
      if (members().some(m => m.company.bizNo === fmtBiz(bizNo))) throw new Error('이미 가입된 사업자등록번호입니다.');
      return { status: '계속사업자' };
    },
    async signup(m) {
      await sleep(800);
      const list = members();
      if (find(m.loginId, list)) throw new Error('이미 사용 중인 아이디입니다.');
      list.push({ ...m, role: 'vendor', status: 'pending', createdAt: Date.now(), failCount: 0, locked: false });
      saveMembers(list); return { ok: true };
    },
    // --- 로그인/세션 ---
    async login(loginId, pw) {
      await sleep(500);
      const list = members(), m = find(loginId.trim().toLowerCase(), list);
      const bad = new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
      if (!m) throw bad;
      if (m.locked) throw Object.assign(new Error('로그인 5회 실패로 계정이 잠겼습니다. 비밀번호 재설정으로 잠금을 해제하세요.'), { code: 'LOCKED' });
      if (m.password !== pw) {
        m.failCount = (m.failCount || 0) + 1;
        if (m.failCount >= 5) { m.locked = true; saveMembers(list); throw Object.assign(new Error('로그인 5회 실패로 계정이 잠겼습니다. 비밀번호 재설정으로 잠금을 해제하세요.'), { code: 'LOCKED' }); }
        saveMembers(list); throw new Error(`아이디 또는 비밀번호가 올바르지 않습니다. (${m.failCount}/5회 실패)`);
      }
      if (m.status === 'pending') throw Object.assign(new Error('가입 승인 대기 중입니다. 승인 완료 후 SMS로 안내드립니다.'), { code: 'PENDING' });
      if (m.status === 'rejected') throw Object.assign(new Error('가입이 반려되었습니다.' + (m.rejectReason ? ` 사유: ${m.rejectReason}` : '')), { code: 'REJECTED' });
      m.failCount = 0; saveMembers(list);
      sessionStorage.setItem('session', JSON.stringify(publicInfo(m)));
      return publicInfo(m);
    },
    session() { return read('session', null) || JSON.parse(sessionStorage.getItem('session') || 'null'); },
    logout() { localStorage.removeItem('session'); sessionStorage.removeItem('session'); },
    me() { const s = Api.session(); return s && s.id ? find(s.id) : null; },
    // --- 비밀번호 재설정 / 회원정보 ---
    async findForReset(loginId, email) {
      await sleep(500);
      const m = find(loginId.trim().toLowerCase());
      if (!m || m.manager.email.toLowerCase() !== email.trim().toLowerCase()) throw new Error('일치하는 회원 정보를 찾을 수 없습니다.');
      return { email: m.manager.email, phone: m.manager.phone };
    },
    async resetPassword(loginId, pw) {
      await sleep(600);
      const list = members(), m = find(loginId, list);
      m.password = pw; m.locked = false; m.failCount = 0; saveMembers(list); return true;
    },
    async updateMember(loginId, patch) {
      await sleep(600);
      const list = members(), m = find(loginId, list);
      for (const k of Object.keys(patch)) m[k] = typeof patch[k] === 'object' && !Array.isArray(patch[k]) && patch[k] ? { ...m[k], ...patch[k] } : patch[k];
      saveMembers(list);
      const s = Api.session(); if (s && s.id === loginId) sessionStorage.setItem('session', JSON.stringify(publicInfo(m)));
      return m;
    },
    async changePassword(loginId, cur, next) {
      await sleep(600);
      const list = members(), m = find(loginId, list);
      if (m.password !== cur) throw new Error('현재 비밀번호가 올바르지 않습니다.');
      if (cur === next) throw new Error('현재와 다른 비밀번호를 입력해주세요.');
      m.password = next; saveMembers(list); return true;
    },
    // --- 관리자: 가입 승인/반려 ---
    async members() { await sleep(350); return members().filter(m => m.role === 'vendor'); },
    async decide(ids, status, reason) {
      await sleep(600);
      const list = members(), done = [];
      ids.forEach(id => {
        const m = find(id, list); if (!m || m.status === status) return;
        m.status = status; m.decidedAt = Date.now(); m.rejectReason = status === 'rejected' ? reason : '';
        Api.addNotice({ to: m.manager.phone, channel: 'SMS', text: status === 'approved' ? `[SCM] ${m.company.name} 가입이 승인되었습니다. 지금 로그인하실 수 있습니다.` : `[SCM] ${m.company.name} 가입이 반려되었습니다. 사유: ${reason}` });
        done.push(m);
      });
      saveMembers(list); return done;
    },
    // --- 알림 발송 이력(SMS/이메일 목업) ---
    addNotice(n) { const l = read('notices', []); l.unshift({ ...n, at: Date.now() }); write('notices', l.slice(0, 100)); },
    notices() { return read('notices', []); },
    // --- 게시판/상품 ---
    async posts() { await sleep(500); let p = read('posts', null); if (!p) { p = seedPosts(); write('posts', p); } return p; },
    async savePosts(p) { write('posts', p); },
    async products() { await sleep(200); return read('products', []); },
    async addProduct(p) { await sleep(900); const l = read('products', []); l.unshift({ ...p, id: Date.now() }); write('products', l); return p; }
  };

  // ---------- 폼 검증 헬퍼 ----------
  const Rules = {
    required: v => !!String(v).trim() || '필수 입력 항목입니다.',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || '올바른 이메일 형식이 아닙니다.',
    min: n => v => String(v).length >= n || `${n}자 이상 입력해주세요.`,
    phone: v => /^01\d-?\d{3,4}-?\d{4}$/.test(v) || '휴대폰 번호 형식이 아닙니다.',
    password: v => (v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v)) || '8자 이상, 영문과 숫자를 함께 사용해주세요.'
  };
  function setupField(input, rules) {
    const wrap = input.closest('.field');
    const msg = wrap.querySelector('.msg');
    const run = () => {
      for (const r of rules) { const res = r(input.value); if (res !== true) { wrap.classList.add('invalid'); wrap.classList.remove('valid'); if (msg) msg.textContent = res; return false; } }
      wrap.classList.remove('invalid'); wrap.classList.toggle('valid', !!input.value); return true;
    };
    input.addEventListener('blur', run);
    input.addEventListener('input', () => wrap.classList.contains('invalid') && run());
    input.validate = run; return run;
  }
  function fieldError(input, text) {
    const w = input.closest('.field'); w.classList.add('invalid'); w.classList.remove('valid');
    const m = w.querySelector('.msg'); if (m) m.textContent = text;
  }
  function bindEyes() {
    $$('.eye').forEach(b => b.addEventListener('click', () => {
      const i = b.parentElement.querySelector('input'); const show = i.type === 'password';
      i.type = show ? 'text' : 'password'; b.textContent = show ? '🙈' : '👁️';
    }));
  }
  // 비밀번호 강도 미터 (.meter / .meter-text 를 입력 필드 뒤에 둔다)
  function bindMeter(input, scope = document) {
    const bars = $$('.meter i', scope), txt = $('.meter-text', scope);
    input.addEventListener('input', () => {
      const v = input.value;
      const s = [v.length >= 8, /[A-Z]/.test(v) && /[a-z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
      const colors = ['', '#e5484d', '#d97706', '#65a30d', '#16a34a'];
      bars.forEach((m, i) => (m.style.background = i < s ? colors[s] : ''));
      if (txt) txt.textContent = v ? ['', '약함', '보통', '좋음', '매우 강함'][s] : '8자 이상, 영문+숫자 조합';
    });
  }
  function setLoading(btn, on, label) {
    if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span> ' + (label || '처리 중...'); btn.disabled = true; }
    else { btn.innerHTML = btn.dataset.label; btn.disabled = false; }
  }

  // ---------- 상단바 (역할별 메뉴) ----------
  const MENUS = {
    vendor: [['board.html', '게시판'], ['product.html', '상품등록'], ['profile.html', '내정보']],
    admin: [['admin-members.html', '가입승인'], ['board.html', '게시판'], ['profile.html', '내정보']]
  };
  function renderTopbar(s) {
    const bar = $('#topbar'); if (!bar) return;
    const role = s.role === 'admin' ? 'admin' : 'vendor';
    const here = location.pathname.split('/').pop() || 'index.html';
    bar.className = 'topbar app';
    bar.innerHTML = `<a class="logo" href="${MENUS[role][0][0]}" style="color:inherit"><b>S</b> SCM</a>
      <nav>${MENUS[role].map(([h, t]) => `<a href="${h}"${h === here ? ' class="active"' : ''}>${t}</a>`).join('')}</nav>
      ${role === 'admin' ? '<span class="st st-approved" title="관리자 계정">관리자</span>' : ''}
      <button class="btn btn-sm btn-ghost" data-theme-toggle type="button"></button>
      <button class="btn btn-sm" data-logout type="button">로그아웃</button>
      <span class="avatar" title="${esc(s.name)}">${esc(s.name.slice(0, 1))}</span>`;
    $('[data-logout]', bar).addEventListener('click', () => { Api.logout(); location.href = 'login.html'; });
    bindTheme();
  }
  // 보호 페이지에서 사용: 비로그인 시 로그인으로, 권한 없으면 첫 화면으로
  // 세션에 role 이 없으면(구버전 세션) 업체 권한으로 취급
  function guard(opts = {}) {
    const s = Api.session();
    if (!s) { location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop())); return null; }
    const role = s.role === 'admin' ? 'admin' : 'vendor';
    if (opts.roles && !opts.roles.includes(role)) { location.replace(MENUS[role][0][0]); return null; }
    renderTopbar(s);
    return { ...s, role };
  }

  document.addEventListener('DOMContentLoaded', () => { bindTheme(); bindEyes(); });
  window.App = { $, $$, sleep, esc, won, ago, dateStr, toast, Api, Rules, setupField, fieldError, setLoading, guard, bindMeter, Verify, fmtPhone, fmtBiz, validBiz, digits, maskPhone, maskEmail };
})();
