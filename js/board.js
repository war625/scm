(() => {
  'use strict';
  const { $, $$, esc, ago, toast, Api, guard, setLoading, Rules, setupField, sleep } = App;
  const me = guard(); if (!me) return;
  const PER = 5, CAT = { notice: '공지', free: '자유', qna: 'Q&A' };
  let posts = [], state = { q: '', cat: 'all', sort: 'new', page: 1 }, current = null, editing = null;

  const list = $('#postList'), pager = $('#pager');

  const view = () => {
    let r = posts.filter(p => (state.cat === 'all' || p.category === state.cat) && (p.title + p.content).toLowerCase().includes(state.q.toLowerCase()));
    r.sort((a, b) => state.sort === 'new' ? b.createdAt - a.createdAt : state.sort === 'views' ? b.views - a.views : b.likes - a.likes);
    return r;
  };
  function render() {
    const r = view(), pages = Math.max(1, Math.ceil(r.length / PER));
    state.page = Math.min(state.page, pages);
    const slice = r.slice((state.page - 1) * PER, state.page * PER);
    $('#count').textContent = `총 ${r.length}개`;
    list.innerHTML = slice.length ? slice.map((p, i) => `
      <li class="post" data-id="${p.id}" style="animation-delay:${i * 40}ms" tabindex="0">
        <h3><span class="badge ${p.category}">${CAT[p.category]}</span>${esc(p.title)}${p.comments.length ? ` <small style="color:var(--primary)">[${p.comments.length}]</small>` : ''}</h3>
        <button class="btn btn-sm btn-ghost like" data-like="${p.id}" aria-label="좋아요">${p.liked ? '❤️' : '🤍'} ${p.likes}</button>
        <p class="excerpt">${esc(p.content)}</p>
        <div class="meta"><span>👤 ${esc(p.author)}</span><span>🕒 ${ago(p.createdAt)}</span><span>👁 ${p.views}</span></div>
      </li>`).join('') : '<li class="empty">🔍 검색 결과가 없습니다.</li>';
    pager.innerHTML = pages > 1 ? `<button ${state.page === 1 ? 'disabled' : ''} data-p="${state.page - 1}">‹</button>` +
      Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === state.page ? 'on' : ''}" data-p="${i + 1}">${i + 1}</button>`).join('') +
      `<button ${state.page === pages ? 'disabled' : ''} data-p="${state.page + 1}">›</button>` : '';
  }
  const persist = () => Api.savePosts(posts);

  // ---------- 목록 이벤트 (이벤트 위임) ----------
  list.addEventListener('click', e => {
    const like = e.target.closest('[data-like]');
    if (like) {
      e.stopPropagation(); const p = posts.find(x => x.id == like.dataset.like);
      p.liked = !p.liked; p.likes += p.liked ? 1 : -1; persist(); render(); return;
    }
    const li = e.target.closest('.post'); if (li) openPost(+li.dataset.id);
  });
  list.addEventListener('keydown', e => e.key === 'Enter' && e.target.classList.contains('post') && openPost(+e.target.dataset.id));
  pager.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { state.page = +b.dataset.p; render(); scrollTo({ top: 0, behavior: 'smooth' }); } });
  let t; $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; state.page = 1; render(); }, 200); }); // 디바운스
  $('#chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; $$('.chip').forEach(x => x.classList.toggle('on', x === c)); state.cat = c.dataset.cat; state.page = 1; render(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });

  // ---------- 모달 공통 ----------
  const open = id => { $(id).classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { $$('.overlay').forEach(o => o.classList.remove('open')); document.body.style.overflow = ''; };
  document.addEventListener('keydown', e => e.key === 'Escape' && close());
  $$('.overlay').forEach(o => o.addEventListener('mousedown', e => e.target === o && close()));
  $$('[data-close]').forEach(b => b.addEventListener('click', close));

  // ---------- 상세 ----------
  function openPost(id) {
    current = posts.find(p => p.id === id); current.views++; persist(); render();
    $('#vTitle').textContent = current.title;
    $('#vMeta').innerHTML = `<span class="badge ${current.category}">${CAT[current.category]}</span> ${esc(current.author)} · ${ago(current.createdAt)} · 👁 ${current.views}`;
    $('#vBody').textContent = current.content;
    $('#vActions').hidden = current.author !== me.name;
    renderComments(); open('#viewModal');
  }
  function renderComments() {
    $('#cList').innerHTML = current.comments.map(c => `<div class="comment"><b>${esc(c.author)}</b><small>${ago(c.at)}</small><br>${esc(c.text)}</div>`).join('') || '<div class="empty" style="padding:16px">첫 댓글을 남겨보세요.</div>';
  }
  $('#cForm').addEventListener('submit', e => {
    e.preventDefault(); const i = $('#cInput'); if (!i.value.trim()) return;
    current.comments.push({ author: me.name, text: i.value.trim(), at: Date.now() }); i.value = ''; persist(); renderComments(); render();
  });
  $('#delBtn').addEventListener('click', () => {
    if (!confirm('이 글을 삭제할까요?')) return;
    posts = posts.filter(p => p !== current); persist(); close(); render(); toast('삭제되었습니다.');
  });

  // ---------- 작성/수정 ----------
  const wf = $('#writeForm');
  const checks = [setupField(wf.title, [Rules.required, Rules.min(2)]), setupField(wf.content, [Rules.required, Rules.min(10)])];
  const cnt = $('#wCount'); wf.content.addEventListener('input', () => (cnt.textContent = `${wf.content.value.length} / 2000`));
  function openWrite(p) {
    editing = p || null; wf.reset(); $$('.field', wf).forEach(f => f.classList.remove('invalid', 'valid'));
    $('#wHead').textContent = p ? '글 수정' : '새 글 작성';
    if (p) { wf.category.value = p.category; wf.title.value = p.title; wf.content.value = p.content; }
    cnt.textContent = `${wf.content.value.length} / 2000`; open('#writeModal'); wf.title.focus();
  }
  $('#writeBtn').addEventListener('click', () => openWrite());
  $('#editBtn').addEventListener('click', () => { close(); openWrite(current); });
  wf.addEventListener('submit', async e => {
    e.preventDefault(); if (!checks.map(c => c()).every(Boolean)) return;
    const btn = $('button[type=submit]', wf); setLoading(btn, true, '저장 중...'); await sleep(500);
    if (editing) Object.assign(editing, { category: wf.category.value, title: wf.title.value.trim(), content: wf.content.value.trim() });
    else posts.unshift({ id: Date.now(), category: wf.category.value, title: wf.title.value.trim(), content: wf.content.value.trim(), author: me.name, views: 0, likes: 0, liked: false, createdAt: Date.now(), comments: [] });
    await persist(); setLoading(btn, false); close(); render(); toast(editing ? '수정되었습니다.' : '등록되었습니다.');
  });

  // ---------- 초기 로딩 (스켈레톤) ----------
  list.innerHTML = '<li class="skeleton"></li>'.repeat(4);
  Api.posts().then(p => { posts = p; render(); });
})();
