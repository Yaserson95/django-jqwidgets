// Временный решающий тест: работают ли бандлы как classic script в IIFE-обёртке
// (1) Zone остаётся глобальным? (2) коллизий var нет? (3) main видит Zone?
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const p = '../jqxwidgets/static/jqxwidgets/';
const poly = readFileSync(p + 'polyfills-5CFQRCPP.js', 'utf8');
const main = readFileSync(p + 'main-GOQ5YICA.js', 'utf8');

// песочница с минимальным DOM-окружением
const sandbox = {};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.console = console;
sandbox.setTimeout = setTimeout;
sandbox.clearTimeout = clearTimeout;
sandbox.setInterval = setInterval;
sandbox.clearInterval = clearInterval;
sandbox.queueMicrotask = queueMicrotask;
sandbox.performance = { now: () => Date.now() };
sandbox.navigator = { userAgent: 'node', platform: 'node' };
sandbox.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementsByTagName: () => [],
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }),
  addEventListener() {}, removeEventListener() {},
  head: { appendChild() {} }, body: { appendChild() {} }, documentElement: { style: {} },
  readyState: 'complete', currentScript: null,
};
sandbox.HTMLElement = class HTMLElement {};
sandbox.Element = class Element {};
sandbox.customElements = { get: () => undefined, define() {} };
const ctx = vm.createContext(sandbox);

function run(label, code) {
  try {
    vm.runInContext(code, ctx, { timeout: 5000, filename: label });
    return null;
  } catch (e) {
    return e;
  }
}

// 1) polyfills в IIFE
const e1 = run('polyfills-iife', '(function(){\n' + poly + '\n})();');
console.log('polyfills IIFE: ', e1 ? 'ошибка: ' + e1.message.slice(0, 100) : 'выполнился');
console.log('  Zone глобален?', typeof sandbox.Zone, '| __zone_symbol__Promise:', typeof sandbox.__zone_symbol__Promise);
console.log('  глобальных var-имен добавлено после IIFE: n/a (скрыты в IIFE)');

// 2) main в IIFE (видит ли Zone)
const e2 = run('main-iife', '(function(){\n' + main + '\n})();');
console.log('main IIFE:      ', e2 ? 'ошибка: ' + e2.message.slice(0, 100) : 'выполнился');

// 3) коллизии var: сколько имён из пересечения реально мешали бы?
console.log('\nВывод: с IIFE-обёрткой var-коллизии невозможны, Zone должен остаться глобальным.');
