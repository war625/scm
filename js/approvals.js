(() => {
  'use strict';
  const { toast, Api, guard, dateStr, esc } = App;
  const me = guard({ roles: ['admin'] }); if (!me) return;
  Api.ensureSeed();
  let rows = [], f = { q: '', kind: '', st: 'requested' };

  Ext.onReady(() => {
    const store = Kit.rowsStore(['key', 'kind', 'id', 'name', 'code', 'ownerName', 'status', 'updatedAt'], 10);
    const mobile = Kit.isMobile();
    const approveBtn = Ext.create('Ext.button.Button', { text: '선택 승인', disabled: true, handler: () => bulk() });
    const grid = Ext.create('Ext.grid.Panel', {
      renderTo: 'grid', store, title: '승인요청', height: Math.max(460, innerHeight - 230), minHeight: 380,
      selModel: { selType: 'checkboxmodel', mode: 'SIMPLE', checkOnly: true, listeners: { beforeselect: (s, rec) => rec.get('status') === 'requested', selectionchange: (s, sel) => { approveBtn.setDisabled(!sel.length); approveBtn.setText(sel.length ? `선택 승인 (${sel.length})` : '선택 승인'); } } },
      viewConfig: { emptyText: '<div class="empty">처리할 요청이 없습니다. 🎉</div>', deferEmptyText: false },
      tbar: [
        Kit.search({ emptyText: '이름·코드·업체 검색' }, v => { f.q = v; apply(); }),
        Kit.combo({ width: 110, value: '', options: [['', '전체 구분'], ['bp', 'BP'], ['product', '상품']], listeners: { change: (c, v) => { f.kind = v; apply(); } } }),
        Kit.combo({ width: 120, value: 'requested', options: [['requested', '승인요청'], ['approved', '승인완료'], ['rejected', '반려'], ['', '전체 상태']], listeners: { change: (c, v) => { f.st = v; apply(); } } }),
        '->', approveBtn],
      columns: [
        { text: '구분', dataIndex: 'kind', width: 80, renderer: v => `<span class="mdm">${v === 'bp' ? 'BP' : '상품'}</span>` },
        { text: '이름', dataIndex: 'name', flex: 1, minWidth: 150, renderer: (v, m, r) => `<b>${esc(v)}</b>${r.get('code') ? `<br><span class="code">${esc(r.get('code'))}</span>` : ''}` },
        { text: '등록업체', dataIndex: 'ownerName', width: 130, hidden: mobile },
        { text: '상태', dataIndex: 'status', width: 100, renderer: v => WF.tag(v) },
        { text: '요청/처리일', dataIndex: 'updatedAt', width: 120, hidden: mobile, renderer: v => dateStr(v) }],
      bbar: { xtype: 'pagingtoolbar', store, displayInfo: true },
      listeners: { itemclick: (v, rec, el, i, e) => { if (!e.getTarget('.x-grid-cell-row-checker')) openDetail(rows.find(r => r.key === rec.get('key'))); } }
    });
    Kit.fit(grid, document.getElementById('grid'));

    function apply() {
      const q = f.q.trim().toLowerCase();
      const r = rows.filter(x => (!f.kind || x.kind === f.kind) && (!f.st || x.status === f.st) && (!q || [x.name, x.code, x.ownerName].join(' ').toLowerCase().includes(q)));
      Kit.setRows(store, r); grid.setTitle(`승인요청 · 대기 ${rows.filter(x => x.status === 'requested').length}건`);
    }
    async function reload() {
      grid.setLoading('불러오는 중...');
      const [bps, prs] = await Promise.all([Api.bps(), Api.products()]);
      rows = [...bps.map(b => ({ ...b, kind: 'bp', key: 'bp' + b.id })), ...prs.filter(p => p.status).map(p => ({ ...p, kind: 'product', key: 'p' + p.id }))]
        .filter(x => x.status !== 'draft').sort((a, b) => (a.status === 'requested' ? 0 : 1) - (b.status === 'requested' ? 0 : 1) || b.updatedAt - a.updatedAt);
      grid.setLoading(false); apply();
    }
    function openDetail(x) {
      if (!x) return;
      WF.detail({ title: `[${x.kind === 'bp' ? 'BP' : '상품'}] ${x.name}`, status: x.status, rejectReason: x.rejectReason, body: x.kind === 'bp' ? WF.describeBp(x) : WF.describeProduct(x), history: x.history || [],
        decide: async (st, reason) => { const d = await Api.decideItems(x.kind, [x.id], st, reason, me.name); toast(st === 'approved' ? `승인 완료 · MDM 전송 (${d[0].code})` : '반려 처리되었습니다. 업체에 알림이 발송됩니다(데모).'); reload(); } });
    }
    async function bulk() {
      const sel = grid.getSelection().map(r => rows.find(x => x.key === r.get('key'))).filter(x => x && x.status === 'requested');
      if (!sel.length || !confirm(`${sel.length}건을 승인할까요?`)) return;
      grid.setLoading('승인 처리 중...');
      let n = 0;
      for (const kind of ['bp', 'product']) { const ids = sel.filter(x => x.kind === kind).map(x => x.id); if (ids.length) n += (await Api.decideItems(kind, ids, 'approved', '', me.name)).length; }
      grid.getSelectionModel().deselectAll(); toast(`${n}건 승인 · MDM 전송 완료(데모)`); reload();
    }
    reload();
  });
})();
