/* 공통 모듈: 테마, 토스트, 목업 API(localStorage), 세션 가드
 * 실제 서버/AI 연동 시 Api 객체의 메서드만 fetch 호출로 교체하면 화면 코드는 그대로 사용 가능 */
(() => {
  'use strict';

  // ---------- 테마 ----------
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  root.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const SUN = '☀️', MOON = '🌙';
  function bindTheme() {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
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
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = n => Number(n || 0).toLocaleString('ko-KR') + '원';
  const ago = ts => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return '방금 전'; if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

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
  const Api = {
    async signup(u) {
      await sleep(700);
      const users = read('users', []);
      if (users.some(x => x.email === u.email)) throw new Error('이미 가입된 이메일입니다.');
      users.push(u); write('users', users); return { ok: true };
    },
    async login(email, pw, remember) {
      await sleep(600);
      const u = read('users', []).find(x => x.email === email && x.password === pw);
      // 데모용: 미가입 상태에서도 demo@demo.com / demo1234 로 체험 가능
      const user = u || (email === 'demo@demo.com' && pw === 'demo1234' ? { name: '데모', email } : null);
      if (!user) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      (remember ? localStorage : sessionStorage).setItem('session', JSON.stringify({ name: user.name, email: user.email }));
      return user;
    },
    session() { return read('session', null) || JSON.parse(sessionStorage.getItem('session') || 'null'); },
    logout() { localStorage.removeItem('session'); sessionStorage.removeItem('session'); },
    async posts() { await sleep(500); let p = read('posts', null); if (!p) { p = seedPosts(); write('posts', p); } return p; },
    async savePosts(p) { write('posts', p); },
    async products() { await sleep(200); return read('products', []); },
    async addProduct(p) { await sleep(900); const l = read('products', []); l.unshift({ ...p, id: Date.now() }); write('products', l); return p; }
  };

  // ---------- 폼 검증 헬퍼 ----------
  const Rules = {
    required: v => !!String(v).trim() || '필수 입력 항목입니다.',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || '올바른 이메일 형식이 아닙니다.',
    min: n => v => String(v).length >= n || `${n}자 이상 입력해주세요.`
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
  function bindEyes() {
    $$('.eye').forEach(b => b.addEventListener('click', () => {
      const i = b.parentElement.querySelector('input'); const show = i.type === 'password';
      i.type = show ? 'text' : 'password'; b.textContent = show ? '🙈' : '👁️';
    }));
  }
  function setLoading(btn, on, label) {
    if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span> ' + (label || '처리 중...'); btn.disabled = true; }
    else { btn.innerHTML = btn.dataset.label; btn.disabled = false; }
  }
  // 보호 페이지에서 사용: 비로그인 시 로그인으로 이동
  function guard() {
    const s = Api.session();
    if (!s) { location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop())); return null; }
    const av = $('.avatar'); if (av) av.textContent = s.name.slice(0, 1);
    const lo = $('[data-logout]'); if (lo) lo.addEventListener('click', () => { Api.logout(); location.href = 'login.html'; });
    return s;
  }

  document.addEventListener('DOMContentLoaded', () => { bindTheme(); bindEyes(); });
  window.App = { $, $$, sleep, esc, won, ago, toast, Api, Rules, setupField, setLoading, guard };
})();
