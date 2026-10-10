/**
 * Временный jsdom-тест API jqxTree: проверяет последовательности вызовов,
 * которые использует <jqx-tree> (addTo/removeItem/render/getItem/isExpanded,
 * панель скролла). Запуск: node scripts/test-tree-jsdom.mjs (из frontend/).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');

// Ошибки внутри инлайн-скриптов jsdom репортятся в virtualConsole.
const scriptErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (err) => {
  scriptErrors.push(String(err?.message ?? err).slice(0, 160));
});
virtualConsole.forwardTo(console, { jsdomErrors: 'none' });

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="tree"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
  runScripts: 'dangerously',
  virtualConsole,
});
const { window } = dom;
for (const key of [
  'window', 'document', 'navigator', 'location', 'Element', 'HTMLElement', 'Node',
  'DocumentFragment', 'MutationObserver', 'CustomEvent', 'Event', 'MouseEvent',
  'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
]) {
  const value = window[key];
  if (!value) continue;
  const bound = key.startsWith('request') || key.startsWith('cancel')
    ? value.bind(window)
    : value;
  try {
    Object.defineProperty(globalThis, key, { value: bound, configurable: true, writable: true });
  } catch {
    // отдельные свойства (например navigator) Node определяет как getter-only
  }
}

// Пути к jqx-библиотекам: по умолчанию node_modules, можно переопределить
// извне (JQX_LIBS) — например, когда файлы в node_modules недоступны.
const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';
// Инъекция через <script> — семантика классического скрипта браузера
// (window.eval нарушает порядок определений JQXLite/jqxBaseFramework).
for (const file of [
  'jqxcore.js', 'jqxdata.js', 'jqxbuttons.js', 'jqxscrollbar.js', 'jqxpanel.js', 'jqxtree.js',
]) {
  const script = dom.window.document.createElement('script');
  script.textContent = readFileSync(base + file, 'utf8');
  dom.window.document.head.appendChild(script);
}
if (scriptErrors.length) {
  console.log('Загрузка библиотек не удалась:');
  for (const p of scriptErrors) console.log('  ' + p);
  process.exit(1);
}

const results = [];
const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond, detail });
  console.log(`[${cond ? 'OK' : 'FAIL'}] ${name}${cond ? '' : ' — ' + detail}`);
};

await new Promise((resolve) => setTimeout(resolve, 150)); // jQuery ready

const $ = window.jQuery ?? window.$;
check('jQuery доступен', !!$);

$('#tree').jqxTree({ source: [], width: 300, height: 300 });
const host = window.document.getElementById('tree');
const tree = ($('#tree').data('jqxTree') ?? {}).instance;
check('дерево создано (пустой source)', !!tree && host.querySelectorAll('ul').length === 1);

// 1. Начальная загрузка корней: addTo(items, null, false) + render()
const roots = [
  { id: '1', label: 'A', items: [{ id: 'ph-1', label: '…' }] },
  { id: '2', label: 'B' },
];
tree.addTo(roots, null, false);
tree.render();
check('корни добавлены: 3 <li>', host.querySelectorAll('li').length === 3,
  `li=${host.querySelectorAll('li').length}`);
const liA = window.document.getElementById('1');
const itemA = tree.getItem(liA);
check('getItem по <li> возвращает id=1', itemA?.id === '1', `id=${itemA?.id}`);
const arrowA = itemA?.arrow;
check('стрелка раскрытия у ветки с плейсхолдером видима',
  !!arrowA && arrowA.style.visibility !== 'hidden', `vis=${arrowA?.style?.visibility}`);
const itemPh = tree.getItem(window.document.getElementById('ph-1'));
// У листа jqxTree либо не создаёт стрелку, либо прячет её — оба варианта ок.
const phArrow = itemPh?.arrow;
const phHidden = !phArrow || phArrow.style.visibility === 'hidden';
check('у плейсхолдера-листа нет видимой стрелки раскрытия', phHidden,
  `arrow=${!!phArrow} vis=${phArrow?.style?.visibility}`);

// 2. Раскрытие: removeItem(placeholder, false) + addTo(parent, children, false) + render()
tree.removeItem(window.document.getElementById('ph-1'), false);
check('плейсхолдер удалён', !window.document.getElementById('ph-1'));
tree.addTo([{ id: '3', label: 'A1' }], liA, false);
tree.render();
check('дети добавлены: снова 3 <li> (A, A1, B)', host.querySelectorAll('li').length === 3,
  `li=${host.querySelectorAll('li').length}`);
const itemA1 = tree.getItem(window.document.getElementById('3'));
check('getItem для нового ребёнка (id=3, label=A1)', itemA1?.id === '3' && itemA1?.label === 'A1',
  `item=${JSON.stringify({ id: itemA1?.id, label: itemA1?.label })}`);
check('hasItems у родителя стал true', itemA?.hasItems === true, `hasItems=${itemA?.hasItems}`);

// 3. Панель скролла и isExpanded
check('isExpanded=false у ветки', tree.isExpanded(liA) === false);
let scrollPos = null;
try {
  scrollPos = tree.panel.jqxPanel('getVScrollPosition');
} catch (err) {
  scrollPos = `throw: ${err.message}`;
}
check('panel.jqxPanel("getVScrollPosition") работает', typeof scrollPos === 'number',
  `pos=${scrollPos}`);

// 4. Повторный addTo того же родителя (следующий чанк) — как при прокрутке
tree.addTo([{ id: '4', label: 'A2' }], liA, false);
tree.render();
check('второй чанк докинут: 4 <li>', host.querySelectorAll('li').length === 4,
  `li=${host.querySelectorAll('li').length}`);
const ids = tree.getItems().map((item) => String(item.id)).sort();
check('getItems отражает все id', JSON.stringify(ids) === JSON.stringify(['1', '2', '3', '4']),
  `ids=${ids}`);

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FAILED: ${failed.length}` : 'ALL PASSED');
process.exit(failed.length ? 1 : 0);
