// Временное воспроизведение: меню фильтров/сортировки jqxGrid в strict mode
// (Angular-бандл — строгий режим, JQXLite вместо jQuery; в этом контексте
// отвязанные вызовы методов дают this === undefined).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');

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

const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';
// "use strict" сверху — эмуляция попадания jqx-кода в строгий бандл Angular
for (const f of [
  'jqxcore.js', 'jqxdata.js', 'jqxbuttons.js', 'jqxscrollbar.js', 'jqxpanel.js',
  'jqxmenu.js', 'jqxlistbox.js', 'jqxdropdownlist.js', 'jqxdatetimeinput.js',
  'jqxgrid.js', 'jqxgrid.sort.js', 'jqxgrid.filter.js', 'jqxgrid.selection.js',
]) {
  const s = w.document.createElement('script');
  s.textContent = '"use strict";' + readFileSync(base + f, 'utf8');
  w.document.head.appendChild(s);
}
if (errors.length) {
  console.log('ошибка при загрузке библиотек:');
  for (const e of errors) console.log(e.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}

const $ = w.jQuery ?? w.$;
const data = [
  { id: 1, name: 'Alpha', price: 10 },
  { id: 2, name: 'Beta', price: 20 },
  { id: 3, name: 'Gamma', price: 30 },
];
$('#grid').jqxGrid({
  width: 600,
  height: 400,
  source: {
    datatype: 'local',
    localdata: data,
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
  pageable: false,
});
const el = w.document.getElementById('grid');
console.log('таблиц отрисовано:', el.querySelectorAll('table').length, 'tr:', el.querySelectorAll('tr').length);
console.log('innerHTML len:', el.innerHTML.length, 'head:', el.innerHTML.slice(0, 200));
console.log('instance:', !!($('#grid').data('jqxGrid') ?? {}).instance);

// элементы меню: кнопка в заголовке (columnmenu) и воронка в filter row
const menuBtns = el.querySelectorAll('[id*="columnmenu"], [class*="column-menu"]');
const filterBtns = el.querySelectorAll('[id*="filter"], [class*="filter"]');
console.log('кнопок меню:', menuBtns.length, [...menuBtns].map((b) => b.id || b.className).join(' | '));
console.log('элементов фильтра:', filterBtns.length,
  [...filterBtns].slice(0, 8).map((b) => (b.id || b.className).slice(0, 40)).join(' | '));

const errorsBefore = errors.length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) клик по кнопке меню в заголовке колонки (меню сортировки/фильтров)
const menuBtn = [...menuBtns].find((b) => b.offsetParent !== null || true);
if (menuBtn) {
  for (const type of ['mousedown', 'mouseup', 'click', 'touchend']) {
    menuBtn.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true }));
    await sleep(150);
  }
  console.log('после клика по кнопке меню: новых ошибок:', errors.length - errorsBefore);
}

// 2) правый клик по заголовку (contextmenu -> gridmenu)
const headerCell = el.querySelector('.jqx-grid-column-header') ?? el.querySelector('td');
if (headerCell) {
  for (const type of ['mousedown', 'contextmenu', 'mouseup', 'click']) {
    headerCell.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, button: 2 }));
    await sleep(150);
  }
  console.log('после contextmenu по заголовку: новых ошибок:', errors.length - errorsBefore);
}

// 3) клик по воронке фильтра в filter row
const funnel = [...filterBtns].find((b) => /filter.*button|column-filter|icon-filter/i.test(b.id + ' ' + b.className));
if (funnel) {
  console.log('воронка:', funnel.id || funnel.className);
  for (const type of ['mousedown', 'mouseup', 'click', 'touchend']) {
    funnel.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true }));
    await sleep(150);
  }
  console.log('после клика по воронке: новых ошибок:', errors.length - errorsBefore);
}

for (const e of errors.slice(errorsBefore)) {
  console.log('--- ОШИБКА:\n' + e.split('\n').slice(0, 14).join('\n'));
}
console.log('видимых меню в DOM:', [...w.document.querySelectorAll('[id*="menu"], .jqx-menu')].filter((n) => n.style?.display !== 'none').length);
process.exit(0);
