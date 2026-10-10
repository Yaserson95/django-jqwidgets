// Временный: как zone.js экспонирует Zone + пересечение top-level var между файлами
import { readFileSync } from 'node:fs';

const p = '../jqxwidgets/static/jqxwidgets/';
const main = readFileSync(p + 'main-GOQ5YICA.js', 'utf8');
const poly = readFileSync(p + 'polyfills-5CFQRCPP.js', 'utf8');

console.log('=== экспозиция Zone в polyfills:');
for (const needle of ['globalThis.Zone', 'window.Zone', '.Zone=', 'Zone=']) {
  let i = -1, c = 0;
  while ((i = poly.indexOf(needle, i + 1)) >= 0 && c < 3) {
    console.log(`  ${needle} @${i}: ${poly.slice(Math.max(0, i - 80), i + 60).replace(/\s+/g, ' ')}`);
    c++;
  }
  if (!c) console.log(`  ${needle}: нет`);
}

console.log('\n=== Zone в main (как читается):');
for (const needle of ['typeof Zone', 'globalThis.Ze', 'window.Zone', ' Zone ', '(Zone']) {
  const i = main.indexOf(needle);
  if (i >= 0) console.log(`  ${needle} @${i}: ${main.slice(Math.max(0, i - 70), i + 70).replace(/\s+/g, ' ')}`);
  else console.log(`  ${needle}: нет`);
}

// top-level var/function имена: всё, что объявлено до первой { или в начале файла
// приблизительно: первые 2000 символов до появления глубоких вложенностей
function topLevelNames(code, label) {
  const head = code.slice(0, 3000);
  const names = new Set();
  for (const m of head.matchAll(/\bvar\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of head.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  console.log(`\n=== ${label} (первые var/function в head):`, [...names].join(', '));
}
topLevelNames(poly, 'polyfills');
topLevelNames(main, 'main');

// более точный способ: выполнить файл в изолированном контексте и сравнить
// глобальные свойства до/после (как classic script без обёртки)
console.log('\n=== глобальные имена, добавляемые файлами (vm-тест):');
const vm = await import('node:vm');
function globalsAdded(code) {
  const sandbox = { globalThis: undefined, window: undefined, self: undefined, document: undefined, navigator: undefined };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const before = new Set(Object.keys(sandbox));
  try {
    vm.runInNewContext(code, sandbox, { timeout: 3000 });
  } catch (e) {
    console.log('  (выполнение прервано:', e.message.slice(0, 80), ')');
  }
  return { added: Object.keys(sandbox).filter((k) => !before.has(k)), sandbox };
}
const r1 = globalsAdded(poly);
console.log('polyfills добавляет:', r1.added.join(', ') || '(нет)');
const r2 = globalsAdded(main);
console.log('main добавляет:', r2.added.join(', ') || '(нет)');
const overlap = r1.added.filter((k) => r2.added.includes(k));
console.log('пересечение (коллизии при classic-загрузке):', overlap.join(', ') || '(нет)');
