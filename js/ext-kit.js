/* ExtJS 공통 도우미: 목록(그리드)·입력(폼) 화면에서 공통으로 쓰는 설정 */
(() => {
  'use strict';
  Ext.enableAriaButtons = false; Ext.enableAriaPanels = false; Ext.ariaWarn = Ext.emptyFn;

  const isMobile = () => innerWidth < 700;
  // 컨테이너 폭에 맞춰 컴포넌트 크기 조정 (반응형)
  function fit(cmp, el) {
    const apply = () => { const w = el.clientWidth; if (w) cmp.setWidth(w); };
    window.addEventListener('resize', apply); apply();
  }
  // 클라이언트 메모리 데이터 + ExtJS 페이징/정렬 (서버 연동 시 proxy 만 ajax 로 교체)
  const rowsStore = (fields, pageSize = 10) => Ext.create('Ext.data.Store', {
    fields, pageSize, remoteSort: true, remoteFilter: true, proxy: { type: 'memory', enablePaging: true, data: [] }
  });
  const setRows = (store, rows) => { store.getProxy().setData(rows); store.loadPage(1); };
  const combo = cfg => Ext.create('Ext.form.field.ComboBox', Object.assign({ editable: false, queryMode: 'local', displayField: 't', valueField: 'v', forceSelection: true, store: { fields: ['v', 't'], data: (cfg.options || []).map(([v, t]) => ({ v, t })) } }, cfg));
  const search = (cfg, onChange) => Ext.create('Ext.form.field.Text', Object.assign({ emptyText: '검색', flex: 1, minWidth: 140, triggers: { clear: { cls: 'x-form-clear-trigger', hidden: true, handler: f => f.setValue('') } },
    listeners: { change: { buffer: 250, fn: (f, v) => onChange(v) } } }, cfg));
  window.Kit = { isMobile, fit, rowsStore, setRows, combo, search };
})();
