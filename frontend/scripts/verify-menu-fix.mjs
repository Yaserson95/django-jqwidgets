// Сквозная проверка фикса бага меню фильтров/сортировки грида.
// Страница /custom-options/ грузит бандл как classic script (IIFE, sloppy-режим) —
// ровно так, как это теперь делает jqxwidgets/assets.py. Прогоняем реальный путь
// открытия меню колонки (_initmenu + _updatefilterpanel) и проверяем отсутствие
// TypeError "can't access property 'theme', this is undefined".
import { JSDOM, VirtualConsole } from 'jsdom';

const url = process.env['PAGE_URL'] ?? 'http://127.0.0.1:8765/custom-options/';

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', (e) => errors.push(String(e?.stack ?? e?.message ?? e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ').slice(0, 300)));

const dom = await JSDOM.fromURL(url, {
  pretendToBeVisual: true,
  runScripts: 'dangerously',
  resources: 'usable',
  virtualConsole: vc,
  beforeParse(window) {
    // jsdom не даёт fetch/matchMedia — патчи как в e2e-тесте дерева
    const realFetch = globalThis.fetch;
    window.fetch = (input, init) => realFetch(new URL(String(input), window.location.href), init);
    if (!window.matchMedia) {
      window.matchMedia = () => ({
        matches: false, media: '', addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
      });
    }
  },
});
const w = dom.window;
w.addEventListener('error', (ev) => errors.push('onerror: ' + (ev.error?.stack ?? ev.message)));

// jsdom не исполняет динамически внедрённые внешние скрипты — подгружаем бандл
// вручную, как в test-tree-e2e.mjs. window.eval выполняет код в sloppy-режиме,
// что соответствует classic-скрипту в браузере (см. jqxwidgets/assets.py).
{
  const manifest = await globalThis.fetch('http://127.0.0.1:8765/static/jqxwidgets/manifest.json').then((r) => r.json());
  for (const name of manifest.js ?? []) {
    const src = await globalThis.fetch(`http://127.0.0.1:8765/static/jqxwidgets/${name}`).then((r) => r.text());
    w.eval(src);
  }
}

// ждём инициализации компонента (<jqx-grid> получает jqx-классы)
let host = null;
for (let i = 0; i < 100; i++) {
  host = w.document.querySelector('jqx-grid [id^="jqxWidget"]');
  if (host) break;
  await new Promise((r) => setTimeout(r, 100));
}
console.log('бандл выполнился, элементов jqx-grid:', w.document.querySelectorAll('jqx-grid').length,
  '| хост найден:', !!host);

const $ = w.jQuery ?? w.$;
if (!$ || !host) {
  console.log('FAIL: нет $ или хоста');
  process.exit(1);
}

const before = errors.length;
const call = (method, ...args) => {
  try {
    return $(host).jqxGrid(method, ...args);
  } catch (e) {
    errors.push(`${method}: ${e?.stack ?? e}`);
    return null;
  }
};

// 1) меню колонки создаётся (путь openmenu/_initmenu)
call('_initmenu');
const gridmenu = w.document.querySelector('[id$="_gridmenu"], .jqx-grid-column-menu, [class*="gridmenu"]');
console.log('gridmenu создан:', !!gridmenu || 'проверено без DOM-элемента');

// 2) панель фильтров внутри меню — ровно та функция, где this.theme падал в strict
const column = call('getcolumn', 'name') ?? call('getcolumnat', 1);
console.log('колонка найдена:', !!column, column ? `datafield=${column.datafield}` : '');
const panel = w.document.createElement('div');
call('_updatefilterpanel', null, panel, column);
console.log('_updatefilterpanel отработал, элементов в панели фильтра:', panel.children.length);

// 3) открытие меню по API (mouseenter+click по кнопке колонки)
call('openmenu', column?.datafield ?? 'name');
await new Promise((r) => setTimeout(r, 600));

const newErrors = errors.slice(before);
const themeErrors = newErrors.filter((e) => /'theme'|"theme"|property "theme"/.test(e));
console.log('\nновых ошибок:', newErrors.length, '| из них про theme:', themeErrors.length);
for (const e of newErrors.slice(0, 5)) console.log('---\n' + e.split('\n').slice(0, 6).join('\n'));

if (newErrors.length === 0) {
  console.log('\nFIX ПОДТВЕРЖДЁН: путь меню фильтров/сортировки отработал без ошибок');
} else if (themeErrors.length === 0) {
  console.log('\nбага theme нет; прочие ошибки (проверь вручную):', newErrors.length);
} else {
  console.log('\nFAIL: баг theme воспроизводится');
}
process.exit(newErrors.length === 0 ? 0 : 1);
