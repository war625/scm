(() => {
  'use strict';
  const { $, $$, esc, won, toast, Api, guard, setLoading, Rules, setupField } = App;
  const me = guard(); if (!me) return;
  const editId = +new URLSearchParams(location.search).get('id') || 0;

  const f = $('#productForm'), MAX_IMG = 5, MAX_MB = 3;
  let images = [], tags = [];

  const checks = [
    setupField(f.name, [Rules.required, Rules.min(2)]),
    setupField(f.price, [v => (+v > 0) || '판매가를 입력해주세요.']),
    setupField(f.stock, [v => (v !== '' && +v >= 0) || '재고 수량을 입력해주세요.']),
    setupField(f.category, [Rules.required]),
    setupField(f.desc, [Rules.required, Rules.min(10)])
  ];
  f.discount.addEventListener('input', () => { f.discount.value = Math.min(90, Math.max(0, f.discount.value)) || ''; });

  // ---------- 이미지 업로드 (클릭 / 드래그앤드롭 / 미리보기 / 대표지정) ----------
  const dz = $('#dropzone'), file = $('#files'), thumbs = $('#thumbs');
  dz.addEventListener('click', () => file.click());
  dz.addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), file.click()));
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  file.addEventListener('change', () => { addFiles(file.files); file.value = ''; });
  function makeThumb(file) {
    return new Promise(res => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => { const r = 160 / Math.max(img.width, img.height, 1), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * Math.min(r, 1))); c.height = Math.max(1, Math.round(img.height * Math.min(r, 1))); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.7)); };
      img.onerror = () => res(null); img.src = u;
    });
  }
  function addFiles(fl) {
    for (const x of fl) {
      if (!x.type.startsWith('image/')) { toast('이미지 파일만 가능합니다.', 'error'); continue; }
      if (x.size > MAX_MB * 1048576) { toast(`${x.name}: ${MAX_MB}MB 이하만 가능합니다.`, 'error'); continue; }
      if (images.length >= MAX_IMG) { toast(`이미지는 최대 ${MAX_IMG}장입니다.`, 'error'); break; }
      if (images.some(im => im.name === x.name && im.size === x.size)) { toast(`${x.name}: 이미 등록된 이미지입니다.`, 'error'); continue; }
      const im = { name: x.name, size: x.size, url: URL.createObjectURL(x) };
      images.push(im); im.p = makeThumb(x).then(t => (im.thumb = t));   // 목록 표시용 축소 이미지(저장용)
    }
    paintImages();
  }
  function paintImages() {
    thumbs.innerHTML = images.map((im, i) => `<div class="thumb"><img src="${im.url}" alt="${esc(im.name)}">${i === 0 ? '<em>대표</em>' : ''}<button type="button" data-rm="${i}" aria-label="삭제">✕</button></div>`).join('');
    $('#imgCount').textContent = `${images.length}/${MAX_IMG}`; preview();
  }
  thumbs.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { URL.revokeObjectURL(images[b.dataset.rm].url); images.splice(b.dataset.rm, 1); paintImages(); } });

  // ---------- 태그 입력 ----------
  const tagBox = $('#tagBox'), tagIn = $('#tagInput');
  const paintTags = () => { $$('span', tagBox).forEach(s => s.remove()); tags.forEach((t, i) => tagIn.insertAdjacentHTML('beforebegin', `<span>#${esc(t)}<button type="button" data-t="${i}" aria-label="태그 삭제">×</button></span>`)); preview(); };
  tagIn.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ',') && !e.isComposing) {
      e.preventDefault(); const v = tagIn.value.trim().replace(/^#/, '');
      if (v && !tags.includes(v) && tags.length < 8) { tags.push(v); paintTags(); } tagIn.value = '';
    } else if (e.key === 'Backspace' && !tagIn.value && tags.length) { tags.pop(); paintTags(); }
  });
  tagBox.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { tags.splice(b.dataset.t, 1); paintTags(); } else tagIn.focus(); });

  // ---------- 실시간 미리보기 ----------
  function preview() {
    const price = +f.price.value || 0, d = +f.discount.value || 0, final = Math.round(price * (100 - d) / 100);
    $('#pvName').textContent = f.name.value || '상품명을 입력하세요';
    $('#pvPrice').innerHTML = price ? `${d ? `<span class="off">${d}%</span>` : ''}${won(final)}${d ? `<span class="old">${won(price)}</span>` : ''}` : '—';
    $('#pvTags').innerHTML = tags.map(t => `<span class="badge">#${esc(t)}</span>`).join(' ');
    $('#pvImg').style.backgroundImage = images[0] ? `url(${images[0].url})` : '';
    $('#pvImg').textContent = images[0] ? '' : '🖼️';
    $('#pvStatus').textContent = f.soldout.checked ? '품절' : (f.stock.value !== '' ? `재고 ${f.stock.value}개` : '');
  }
  f.addEventListener('input', preview); f.addEventListener('change', preview);

  // 입력 중 이탈 방지
  let dirty = false, saved = false;
  f.addEventListener('input', () => (dirty = true));
  addEventListener('beforeunload', e => { if (dirty && !saved) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- 임시저장 / 등록 ----------
  const data = () => ({ name: f.name.value.trim(), category: f.category.value, price: +f.price.value, discount: +f.discount.value || 0, stock: +f.stock.value, desc: f.desc.value.trim(), soldout: f.soldout.checked, tags, images: images.map(({ name, size, thumb }) => ({ name, size, thumb: thumb || null })) });
  $('#draftBtn').addEventListener('click', () => { localStorage.setItem('productDraft', JSON.stringify({ ...data(), images: [] })); dirty = false; toast('임시저장 되었습니다.'); });
  try { const d = editId ? null : JSON.parse(localStorage.getItem('productDraft') || 'null'); if (d && confirm('임시저장된 내용이 있습니다. 불러올까요?')) { ['name', 'category', 'price', 'discount', 'stock', 'desc'].forEach(k => (f[k].value = d[k] ?? '')); f.soldout.checked = d.soldout; tags = d.tags || []; paintTags(); } } catch { }

  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (!checks.map(c => c()).every(Boolean)) { toast('필수 항목을 확인해주세요.', 'error'); return $('.invalid input, .invalid select, .invalid textarea')?.focus(); }
    if (!images.length) return toast('대표 이미지를 1장 이상 등록해주세요.', 'error');
    const norm = s => s.trim().toLowerCase();
    if ((await Api.products()).some(x => x.id !== editId && norm(x.name) === norm(f.name.value))) {
      const w = f.name.closest('.field'); w.classList.add('invalid'); w.classList.remove('valid');
      w.querySelector('.msg').textContent = '이미 등록된 상품명입니다.';
      return toast('이미 등록된 상품명입니다.', 'error');
    }
    const btn = $('button[type=submit]', f); setLoading(btn, true, '등록 중...');
    await Promise.all(images.map(i => i.p));
    await Api.saveProduct({ ...data(), ...(editId ? { id: editId } : {}) }, me); saved = true; localStorage.removeItem('productDraft');
    setLoading(btn, false);
    if (editId) { toast('수정 후 승인 요청되었습니다. (MDM W/F 대기)'); return setTimeout(() => (location.href = 'product-list.html'), 900); }
    toast('승인 요청되었습니다 🎉 상품 목록에서 상태를 확인하세요.');
    setTimeout(() => location.reload(), 1200);
  });
  // ---------- 수정 모드: 기존 상품 불러오기 ----------
  if (editId) {
    Api.products().then(list => {
      const p = list.find(x => x.id === editId);
      if (!p || p.owner !== me.id || p.status === 'requested') { toast(p && p.status === 'requested' ? '승인 요청 중인 상품은 수정할 수 없습니다.' : '접근할 수 없는 상품입니다.', 'error'); return setTimeout(() => (location.href = 'product-list.html'), 800); }
      ['name', 'category', 'price', 'discount', 'stock', 'desc'].forEach(k => (f[k].value = p[k] ?? '')); f.soldout.checked = !!p.soldout; tags = p.tags || [];
      images = (p.images || []).map(i => ({ name: i.name, size: i.size, url: i.thumb || '', thumb: i.thumb, p: Promise.resolve() }));
      paintTags(); paintImages(); dirty = false;
      $('h1').textContent = `상품 수정 · ${p.name}`; $('[type=submit]', f).textContent = p.status === 'approved' ? '변경 승인요청' : '재승인 요청';
    });
  }
  preview();
})();
