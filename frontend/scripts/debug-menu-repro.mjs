// Временное воспроизведение бага: strict vs sloppy режим при открытии меню колонки.
// jqx написан для classic <script> (sloppy): отвязанный вызов w(x) даёт this=window.
// Angular-бандл подключается как type="module" -> strict -> this=undefined -> TypeError.
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
  // STRICT=1 эмулирует type="module" (ES-модули всегда strict)
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
const grid = holder.instance ?? holder;
console.log('holder keys:', Object.keys(holder).slice(0, 20).join(','));
console.log('режим:', STRICT ? 'STRICT (как type="module")' : 'sloppy (как classic script)');

// Открыть меню колонки тем же путём, что и клик по кнопке меню/сортировке
const before = errors.length;
try {
  grid.openmenu('name');
} catch (e) {
  errors.push('openmenu: ' + (e?.stack ?? e));
}
// openmenu внутри setTimeout(200) кликает кнопку -> ждём и допроверяем панель фильтра
await new Promise((r) => setTimeout(r, 600));
try {
  if (!grid.gridmenu) grid._initmenu();
  console.log('gridmenu создан:', !!grid.gridmenu);
  console.log('columns:', typeof grid.columns, 'records:', grid.columns?.records?.length);
  const col = grid.getcolumnat ? grid.getcolumnat(1) : null;
  console.log('getcolumnat(1):', col?.datafield);
  // прямой вызов пути построения панели фильтров внутри gridmenu
  grid._updatefilterpanel(grid, grid.gridmenu, col ?? grid.columns.records[1]);
} catch (e) {
  errors.push('_updatefilterpanel: ' + (e?.stack ?? e));
}
await new Promise((r) => setTimeout(r, 200));

const newErrors = errors.slice(before);
if (newErrors.length) {
  console.log('ОШИБКИ:', newErrors.length);
  for (const e of newErrors) console.log('---\n' + e.split('\n').slice(0, 6).join('\n'));
} else {
  console.log('ошибок нет');
}
process.exit(0);
