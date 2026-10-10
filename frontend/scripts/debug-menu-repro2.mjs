// Временный: найти внутренний инстанс jqxGrid (с columns.records) и воспроизвести
// баг this.theme при открытии меню колонки: strict (как type="module") vs sloppy.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');

const STRICT = process.env['STRICT'] === '1';
const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', (e) => errors.push(String(e?.stack ?? e?.message ?? e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ').slice(0, 300)));

const dom = new JSDOM(
  '<!doctype html><html><head></head><body><div id="grid"></div></body></html>',
  { pretendToBeVisual: true, url: 'http://localhost/', runScripts: 'dangerously', virtualConsole: vc },
);
const w = dom.window;
w.addEventListener('error', (ev) => errors.push('onerror: ' + (ev.error?.stack ?? ev.message)));

for (const f of [
  'jqxcore.js', 'jqxdata.js', 'jqxbuttons.js', 'jqxscrollbar.js', 'jqxpanel.js',
  'jqxmenu.js', 'jqxlistbox.js', 'jqxdropdownlist.js', 'jqxdatetimeinput.js',
  'jqxgrid.js', 'jqxgrid.sort.js', 'jqxgrid.filter.js', 'jqxgrid.selection.js',
]) {
  const s = w.document.createElement('script');
  s.textContent = (STRICT ? '"use strict";' : '') + readFileSync(base + f, 'utf8');
  w.document.head.appendChild(s);
}

const $ = w.jQuery ?? w.$;
$('#grid').jqxGrid({
  width: 600,
  height: 400,
  source: {
    datatype: 'local',
    localdata: [
      { id: 1, name: 'Alpha', price: 10 },
      { id: 2, name: 'Beta', price: 20 },
      { id: 3, name: 'Gamma', price: 30 },
    ],
    datafields: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'price', type: 'number' },
    ],
  },
  columns: [
    { text: 'ID', datafield: 'id', width: 80 },
    { text: 'Name', datafield: 'name', width: 200 },
    { text: 'Price', datafield: 'price', width: 100 },
  ],
  showfilterrow: true,
  filterable: true,
  sortable: true,
});

const holder = $('#grid').data('jqxGrid');
console.log('holder:', Object.keys(holder).join(','));
console.log('holder.instance:', holder.instance && Object.keys(holder.instance).slice(0, 25).join(','));
console.log('holder.instance.columns тип:', typeof holder.instance?.columns,
  '| records:', holder.instance?.columns?.records?.length,
  '| isArray:', Array.isArray(holder.instance?.columns));
console.log('holder.instance.instance:', holder.instance?.instance && Object.keys(holder.instance.instance).slice(0, 25).join(','));
// найти реальный инстанс с columns.records
function findInternal(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 3) return null;
  if (obj.columns?.records && Array.isArray(obj.columns.records)) return obj;
  for (const k of Object.keys(obj)) {
    const found = findInternal(obj[k], depth + 1);
    if (found) return found;
  }
  return null;
}
const grid = findInternal(holder);
console.log('внутренний инстанс найден:', !!grid, '| записей колонок:', grid?.columns?.records?.length,
  '| datafields:', grid?.columns?.records?.map((c) => c.datafield).join(','));

console.log('режим:', STRICT ? 'STRICT (эмуляция type="module")' : 'sloppy (classic script)');

const before = errors.length;
try {
  if (!grid.gridmenu) grid._initmenu();
  const panel = w.document.createElement('div');
  grid._updatefilterpanel(grid, panel, grid.columns.records[1]);
  console.log('_updatefilterpanel отработал, детей в панели:', panel.children.length);
} catch (e) {
  errors.push('_updatefilterpanel: ' + (e?.stack ?? e));
}

const newErrors = errors.slice(before);
if (newErrors.length) {
  console.log('ОШИБКА ВОСПРОИЗВЕДЕНА:', newErrors.length);
  for (const e of newErrors) console.log('---\n' + e.split('\n').slice(0, 8).join('\n'));
} else {
  console.log('ошибок нет');
}
process.exit(0);
