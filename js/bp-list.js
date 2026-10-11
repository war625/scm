(() => {
  'use strict';
  const { toast, Api, guard, dateStr, esc } = App;
  const me = guard(); if (!me) return;
  const isAdmin = me.role === 'admin';
  Api.ensureSeed();
  let rows = [], f = { q: '', st: '', type: '' };

  Ext.onReady(() => {
    const store = Kit.rowsStore(['id', 'code', 'name', 'bizNo', 'ceo', 'tradeType', 'ownerName', 'status', 'updatedAt']);
    const mobile = Kit.isMobile();
    const stOpts = [['', '전체 상태'], ['draft', '임시저장'], ['requested', '승인요청'], ['approved', '승인완료'], ['rejected', '반려']];
    const grid = Ext.create('Ext.grid.Panel', {
      renderTo: 'grid', store, title: 'BP 목록', height: Math.max(420, innerHeight - 250), minHeight: 360, columnLines: false,
      viewConfig: { emptyText: '<div class="empty">조건에 맞는 BP가 없습니다.</div>', deferEmptyText: false },
      tbar: [
        Kit.search({ emptyText: '거래처명·사업자번호·코드 검색' }, v => { f.q = v; apply(); }),
        Kit.combo({ width: 130, value: '', options: stOpts, listeners: { change: (c, v) => { f.st = v; apply(); } } }),
        Kit.combo({ width: 120, value: '', options: [['', '전체 유형'], ['매입처', '매입처'], ['매출처', '매출처'], ['양방향', '양방향']], hidden: mobile, listeners: { change: (c, v) => { f.type = v; apply(); } } }),
        '->', { text: '+ BP 등록', hidden: isAdmin, handler: () => (location.href = 'bp-form.html') }],
      columns: [
        { text: 'MDM 코드', dataIndex: 'code', width: 120, hidden: mobile, renderer: v => (v ? `<span class="code">${esc(v)}</span>` : '<span style="color:var(--muted)">-</span>') },
        { text: '거래처명', dataIndex: 'name', flex: 1, minWidth: 150, renderer: v => `<b>${esc(v)}</b>` },
        { text: '사업자번호', dataIndex: 'bizNo', width: 130, hidden: mobile },
        { text: '대표자', dataIndex: 'ceo', width: 100, hidden: mobile },
        { text: '유형', dataIndex: 'tradeType', width: 90 },
        { text: '등록업체', dataIndex: 'ownerName', width: 120, hidden: !isAdmin || mobile },
        { text: '상태', dataIndex: 'status', width: 100, renderer: v => WF.tag(v) },
        { text: '수정일', dataIndex: 'updatedAt', width: 110, hidden: mobile, renderer: v => dateStr(v) }],
      bbar: { xtype: 'pagingtoolbar', store, displayInfo: true },
      listeners: { itemclick: (v, rec) => openDetail(rows.find(b => b.id === rec.get('id'))) }
    });
    Kit.fit(grid, document.getElementById('grid'));

    function apply() {
      const q = f.q.trim().toLowerCase();
      const r = rows.filter(b => (!f.st || b.status === f.st) && (!f.type || b.tradeType === f.type) && (!q || [b.name, b.bizNo, b.code, b.ceo, b.ownerName].join(' ').toLowerCase().includes(q)));
      Kit.setRows(store, r);
    }
    async function reload() {
      grid.setLoading('불러오는 중...');
      const all = await Api.bps();
      rows = (isAdmin ? all : all.filter(b => b.owner === me.id)).sort((a, b) => b.updatedAt - a.updatedAt);
      grid.setLoading(false); apply();
    }
    function openDetail(b) {
      if (!b) return;
      const mine = b.owner === me.id, buttons = [];
      if (mine && b.status !== 'requested') buttons.push({ text: '수정', primary: true, fn: () => (location.href = `bp-form.html?id=${b.id}`) });
      if (mine && (b.status === 'draft' || b.status === 'rejected')) buttons.push({ text: '삭제', danger: true, fn: async close => { if (!confirm('이 거래처를 삭제할까요?')) return; await Api.deleteBp(b.id); close(); toast('삭제되었습니다.'); reload(); } });
      WF.detail({ title: b.name, status: b.status, rejectReason: b.rejectReason, body: WF.describeBp(b), history: b.history, buttons,
        decide: isAdmin ? async (st, reason) => { const d = await Api.decideItems('bp', [b.id], st, reason, me.name); toast(st === 'approved' ? `승인 완료 · MDM 전송 (${d[0].code})` : '반려 처리되었습니다. 업체에 알림이 발송됩니다(데모).'); reload(); } : null });
    }
    if (isAdmin) document.getElementById('sub').textContent = '전체 업체의 BP 등록 현황입니다. 승인요청 건은 상세에서 승인/반려할 수 있습니다.';
    reload();
  });
})();
