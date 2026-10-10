// E2E-тест страницы /tree/ в jsdom против живого Django dev server.
// Проверяет: регистрация <jqx-tree>, загрузка корней, expand → подгрузка детей,
// offset-логика чанков при догрузке, число сетевых запросов.
// Запуск: node scripts/test-tree-e2e.mjs (из frontend/); сервер: runserver 127.0.0.1:8765
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');

const URL_PAGE = process.env['TREE_URL'] ?? 'http://127.0.0.1:8765/tree/';

let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`[OK] ${name}`);
  else {
    failed += 1;
    console.log(`[FAIL] ${name} — ${detail}`);
  }
};

const vc = new VirtualConsole();
const pageErrors = [];
vc.on('jsdomError', (err) => pageErrors.push(String(err?.message ?? err).slice(0, 200)));
// console.* из страницы — только ошибки в тихий лог
vc.on('error', (...args) => pageErrors.push('console.error: ' + args.map(String).join(' ').slice(0, 200)));

const requests = [];

// Загрузка страницы. beforeParse: polyfill fetch (jsdom его не даёт) с логом запросов.
const dom = await JSDOM.fromURL(URL_PAGE, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    const realFetch = globalThis.fetch;
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : String(input?.url ?? input);
      requests.push(url);
      return realFetch(new URL(url, window.location.href), init);
    };
    // jsdom не реализует matchMedia — jqx/стили могут спрашивать
    if (!window.matchMedia) {
      window.matchMedia = () => ({
        matches: false, media: '', addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
      });
    }
  },
});

const { window } = dom;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// jsdom не исполняет <script type="module"> (лоадер не получает onload), а бандлы
// Angular собираются без import/export — выполняем polyfills+main вручную.
await sleep(500);
{
  const manifest = await globalThis.fetch('http://127.0.0.1:8765/static/jqxwidgets/manifest.json')
    .then((r) => r.json());
  for (const name of manifest.js ?? []) {
    const src = await globalThis.fetch(`http://127.0.0.1:8765/static/jqxwidgets/${name}`)
      .then((r) => r.text());
    window.eval(src);
  }
}

// Ждём custom element и первую отрисовку (до 15 c)
let treeEl = null;
let rootsCount = 0;
for (let i = 0; i < 150; i++) {
  await sleep(100);
  treeEl = window.document.querySelector('jqx-tree');
  if (treeEl) {
    rootsCount = treeEl.querySelectorAll('li').length;
    if (rootsCount > 0) break;
  }
}

check('элемент <jqx-tree> на странице', !!treeEl);
check('корни отрисованы (li > 0)', rootsCount > 0, `li=${rootsCount}`);
check('есть запрос конфига', requests.some((u) => u.includes('/api/node/config/')), requests.join(', '));
check('есть запрос корней', requests.some((u) => u.includes('/api/node/?')), requests.join(' | '));

// Найдём ветку с haschildren (плейсхолдером) и раскроем её кликом по стрелке
const host = treeEl.querySelector('div') ?? treeEl;
let branch = null;
for (const li of treeEl.querySelectorAll('li')) {
  const ul = li.querySelector(':scope > ul');
  const ph = ul?.querySelector(':scope > li[id^="ph-"]');
  if (ph) { branch = li; break; }
}
check('найдена ветка с плейсхолдером (haschildren)', !!branch, 'нет li с плейсхолдером');

if (branch) {
  const branchId = branch.id;
  const arrow = branch.querySelector(':scope > span[id^="arrow"]') ?? branch.querySelector('span[id^="arrow"]');
  check('стрелка раскрытия у ветки есть', !!arrow, branch.innerHTML.slice(0, 120));
  const liBefore = treeEl.querySelectorAll('li').length;

if (arrow) {
  // jqx определяет jsdom как touch-устройство ('ontouchstart' in window) и вешает
  // на стрелку touchend вместо click — шлём оба события для надёжности.
  for (const type of ['touchend', 'click']) {
    arrow.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true }));
    await sleep(150);
  }
  // ждём анимацию expand + fetch детей + перерисовку (до 10 c)
  let loaded = false;
  let liAfter = liBefore;
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    liAfter = treeEl.querySelectorAll('li').length;
    const ph = branch.querySelector(':scope > ul > li[id^="ph-"]');
    if (!ph && liAfter > liBefore) { loaded = true; break; }
  }
  const realChildren = branch.querySelectorAll(':scope > ul > li:not([id^="ph-"])').length;
  check('expand подгрузил детей (плейсхолдер заменён)', loaded && realChildren > 0,
    `li ${liBefore}→${liAfter}, ph остался=${!!branch.querySelector('ul > li[id^="ph-"]')}, детей=${realChildren}`);
  check('запрос детей с ?parent=', requests.some((u) => u.includes(`parent=${branchId}`)),
    requests.filter((u) => u.includes('parent=')).join(' | '));
  }
}

// Дождёмся завершения фоновой догрузки чанков (poll в компоненте) и проверим,
// что offset-логика не сломана: при 300 узлах "Большой раздел" запросы идут со смещением.
// "Большой раздел" (300 детей) — это первая ветка, она уже раскрыта в шаге выше,
// и poll-цикл jsdom (без layout nearBottom()=true) продолжает догружать чанки.
// Проверяем приращение детей и наличие offset-запросов у именно этой ветки.
const bigBranch = branch;
check('ветка "Большой раздел" найдена', !!bigBranch && (bigBranch.textContent ?? '').includes('Большой раздел'),
  bigBranch ? bigBranch.querySelector('[item-label]')?.getAttribute('item-label') : 'нет');
if (bigBranch) {
  await sleep(2000);
  const bigChildren = bigBranch.querySelectorAll(':scope > ul > li:not([id^="ph-"])').length;
  const offsetReqs = requests.filter((u) => u.includes('offset=') && u.includes(`parent=${bigBranch.id}`));
  console.log(`  чанки ветки ${bigBranch.id}: ${offsetReqs.length} — ${offsetReqs.slice(0, 6).join(' | ')}`);
  check('у "Большой раздел" есть реальные дети', bigChildren > 0, `children=${bigChildren}`);
  check('чанки догружаются со смещением offset=', offsetReqs.length > 0,
    'нет запросов с offset (после раскрытия 300-узловой ветки)');
  check('число детей больше первого чанка (poll докинул)', bigChildren > 50,
    `children=${bigChildren} (первый чанк 50)`);
  check('число чанков ограничено (≤7 на 300 узлов)', offsetReqs.length <= 7, `${offsetReqs.length}`);
  // защита от зацикливания: все запросы дерева должны укладываться в разумный предел
  const treeReqs = requests.filter((u) => u.includes('/api/node/'));
  check('нет перебора запросов (< 40)', treeReqs.length < 40, `всего ${treeReqs.length}`);
}

if (pageErrors.length) {
  console.log('--- ошибки страницы:');
  for (const e of pageErrors.slice(0, 10)) console.log('  ' + e);
}
check('нет ошибок jsdom/console на странице', pageErrors.length === 0, `${pageErrors.length} шт.`);

console.log(failed === 0 ? 'ALL PASSED' : `FAILED: ${failed}`);
window.close();
process.exit(failed === 0 ? 0 : 1);
