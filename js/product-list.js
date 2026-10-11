(() => {
  'use strict';
  const { toast, Api, guard, dateStr, esc, won } = App;
  const me = guard(); if (!me) return;
  const isAdmin = me.role === 'admin';
  Api.ensureSeed();
  let rows = [], f = { q: '', st: '', cat: '' };

  Ext.onReady(() => {
    const store = Kit.rowsStore(['id', 'name', 'code', 'category', 'price', 'discount', 'stock', 'ownerName', 'status', 'updatedAt', 'thumb'], 8);
    const mobile = Kit.isMobile();
    const grid = Ext.create('Ext.grid.Panel', {
      renderTo: 'grid', store, title: '상품 목록', height: Math.max(460, innerHeight - 250), minHeight: 380,
      viewConfig: { emptyText: '<div class="empty">조건에 맞는 상품이 없습니다.</div>', deferEmptyText: false },
      tbar: [
        Kit.search({ emptyText: '상품명·SKU·태그 검색' }, v => { f.q = v; apply(); }),
        Kit.combo({ width: 130, value: '', options: [['', '전체 상태'], ['requested', '승인요청'], ['approved', '승인완료'], ['rejected', '반려']], listeners: { change: (c, v) => { f.st = v; apply(); } } }),
        Kit.combo({ width: 130, value: '', hidden: mobile, options: [['', '전체 카테고리'], ...['식품', '생활용품', '전자기기', '뷰티', '의류'].map(x => [x, x])], listeners: { change: (c, v) => { f.cat = v; apply(); } } }),
        '->', { text: '+ 상품 등록', hidden: isAdmin, handler: () => (location.href = 'product.html') }],
      columns: [
        { text: '상품', dataIndex: 'name', flex: 1, minWidth: 220, renderer: (v, m, r) => `<div class="pcell"><div class="pthumb" style="${r.get('thumb') ? `background-image:url(${r.get('thumb')})` : ''}">${r.get('thumb') ? '' : '🖼️'}</div><div><b>${esc(v)}</b><br>${r.get('code') ? `<span class="code">${esc(r.get('code'))}</span>` : '<small style="color:var(--muted)">코드 미발급</small>'}</div></div>` },
        { text: '카테고리', dataIndex: 'category', width: 100, hidden: mobile },
        { text: '판매가', dataIndex: 'price', width: 130, align: 'right', renderer: (v, m, r) => (r.get('discount') ? `<b>${won(Math.round(v * (100 - r.get('discount')) / 100))}</b><br><small style="color:var(--danger)">${r.get('discount')}% 할인</small>` : won(v)) },
        { text: '재고', dataIndex: 'stock', width: 80, align: 'right', hidden: mobile },
        { text: '등록업체', dataIndex: 'ownerName', width: 120, hidden: !isAdmin || mobile },
        { text: '상태', dataIndex: 'status', width: 100, renderer: v => WF.tag(v) },
        { text: '수정일', dataIndex: 'updatedAt', width: 110, hidden: mobile, renderer: v => dateStr(v) }],
      bbar: { xtype: 'pagingtoolbar', store, displayInfo: true },
      listeners: { itemclick: (v, rec) => openDetail(rows.find(p => p.id === rec.get('id'))) }
    });
    Kit.fit(grid, document.getElementById('grid'));

    function apply() {
      const q = f.q.trim().toLowerCase();
      Kit.setRows(store, rows.filter(p => (!f.st || p.status === f.st) && (!f.cat || p.category === f.cat) && (!q || [p.name, p.code, (p.tags || []).join(' '), p.ownerName].join(' ').toLowerCase().includes(q))));
    }
    async function reload() {
      grid.setLoading('불러오는 중...');
      const all = (await Api.products()).filter(p => p.status);           // 구버전(상태 없는) 데이터 제외
      rows = (isAdmin ? all : all.filter(p => p.owner === me.id)).map(p => ({ ...p, thumb: WF.thumbOf(p) })).sort((a, b) => b.updatedAt - a.updatedAt);
      grid.setLoading(false); apply();
    }
    function openDetail(p) {
      if (!p) return;
      const mine = p.owner === me.id, buttons = [];
      if (mine && p.status !== 'requested') buttons.push({ text: '수정', primary: true, fn: () => (location.href = `product.html?id=${p.id}`) });
      if (mine && p.status === 'rejected') buttons.push({ text: '삭제', danger: true, fn: async close => { if (!confirm('이 상품을 삭제할까요?')) return; await Api.deleteProduct(p.id); close(); toast('삭제되었습니다.'); reload(); } });
      WF.detail({ title: p.name, status: p.status, rejectReason: p.rejectReason, body: WF.describeProduct(p), history: p.history || [], buttons,
        decide: isAdmin ? async (st, reason) => { const d = await Api.decideItems('product', [p.id], st, reason, me.name); toast(st === 'approved' ? `승인 완료 · MDM 전송 (${d[0].code})` : '반려 처리되었습니다. 업체에 알림이 발송됩니다(데모).'); reload(); } : null });
    }
    if (isAdmin) document.getElementById('sub').textContent = '전체 업체의 상품 등록 현황입니다. 승인요청 건은 상세에서 승인/반려할 수 있습니다.';
    reload();
  });
})();
