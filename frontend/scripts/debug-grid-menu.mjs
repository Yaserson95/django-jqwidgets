// Временное воспроизведение: меню фильтров/сортировки в гриде -> ошибка "this is undefined".
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');

const PAGE = process.env['GRID_URL'] ?? 'http://127.0.0.1:8765/custom-options/';

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', (e) => errors.push(String(e?.stack ?? e?.message ?? e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ').slice(0, 300)));

const dom = await JSDOM.fromURL(PAGE, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    const realFetch = globalThis.fetch;
    window.fetch = (input, init) => realFetch(new URL(String(input), window.location.href), init);
    if (!window.matchMedia) {
      window.matchMedia = () => ({
        matches: false, media: '', addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
      });
    }
    window.addEventListener('error', (ev) => {
      errors.push('window.onerror: ' + (ev.error?.stack ?? ev.message));
    });
  },
});
const { window } = dom;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(500);
{
  const manifest = await globalThis.fetch('http://127.0.0.1:8765/static/jqxwidgets/manifest.json').then((r) => r.json());
  for (const name of manifest.js ?? []) {
    const src = await globalThis.fetch(`http://127.0.0.1:8765/static/jqxwidgets/${name}`).then((r) => r.text());
    window.eval(src);
  }
}

const gridEl = await (async () => {
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    const el = window.document.querySelector('jqx-grid');
    if (el && el.querySelector('table')) return el;
  }
  return null;
})();
console.log('grid отрисован:', !!gridEl, 'таблиц:', gridEl?.querySelectorAll('table').length,
  'tr:', gridEl?.querySelectorAll('tr').length);
{
  const el = window.document.querySelector('jqx-grid');
  console.log('jqx-grid есть:', !!el, 'innerHTML len:', el?.innerHTML.length ?? -1);
  const host = el?.querySelector('[id^="jqxWidget"]');
  console.log('хост:', !!host, 'children:', host ? [...host.children].map((c) => c.tagName + '.' + (c.className || '').split(' ')[0]).join(' | ') : '');
  console.log('table count:', el?.querySelectorAll('table').length, 'grid-table div:', el?.querySelectorAll('.jqx-grid-table').length);
  console.log('ошибки страницы:', errors.slice(0, 5).map((e) => e.split('\n')[0]).join(' || ') || '(нет)');
}

// Кнопки меню в заголовках колонок и кнопки фильтров в filter row
const menuButtons = gridEl.querySelectorAll('[class*="column-menu"], [id*="columnmenu"], .jqx-icon-column-menu');
const filterButtons = gridEl.querySelectorAll('[class*="filter"], [id*="filterbutton"]');
console.log('кнопок меню колонки:', menuButtons.length, 'кнопок фильтра:', filterButtons.length);
console.log('classes примеров фильтра:', [...filterButtons].slice(0, 5).map((b) => b.className + '#' + b.id).join(' | '));

const errorsBefore = errors.length;

// 1) клик по кнопке фильтра в filter row (открывает меню фильтров)
const fb = [...filterButtons].find((b) => b.id?.includes('filterbutton')) ?? filterButtons[0];
if (fb) {
  for (const type of ['touchend', 'click']) {
    fb.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true }));
    await sleep(200);
  }
  console.log('после клика по фильтру: ошибок +', errors.length - errorsBefore);
  for (const e of errors.slice(errorsBefore)) console.log('--- ОШИБКА:\n' + e.split('\n').slice(0, 12).join('\n'));
}
process.exit(errors.length > 0 ? 1 : 0);
