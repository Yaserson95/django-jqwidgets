// Временный микро-доказательство: точный код из бандла (minified C с this.theme)
// работает в sloppy-режиме и падает в strict (как type="module").
import { readFileSync } from 'node:fs';

const s = readFileSync('../jqxwidgets/static/jqxwidgets/main-GOQ5YICA.js', 'utf8');
// извлечь точное тело функции C из _updatefilterpanel
const idx = s.indexOf('_filterpanelwidth-(this.theme');
const start = s.lastIndexOf('var C=function', idx);
const end = s.indexOf('C(S)', idx) + 'C(S)'.length;
const snippet = s.slice(start, end);
console.log('извлечённый код бандла:\n', snippet, '\n');

// мок jQuery-цепочки
function makeChain() {
  const chain = new Proxy(function () {}, {
    get: (t, prop) => {
      if (prop === '0') return { style: {} };
      if (prop === Symbol.toPrimitive) return () => 0;
      return (...args) => chain;
    },
    apply: () => chain,
  });
  return chain;
}

function test(label, strict) {
  const grid = { toThemeProperty: (x) => x, _filterpanelwidth: 220, filterMenuItemsHeight: 24, theme: undefined };
  // код бандла обращается к e (grid) и n (jQuery) — подставляем параметрами
  const body = (strict ? '"use strict";' : '') + snippet
    .replace(/\bvar C=function/, 'var C=function');
  const factory = new Function('e', 'n', 'S', body + '; return C;');
  const S = makeChain();
  const C = factory(grid, makeChain(), S);
  try {
    C(S); // отвязанный вызов — ровно как в бандле
    console.log(`${label}: БЕЗ ОШИБКИ (this=${strict ? 'undefined — но до this.theme не дошли?' : 'window'})`);
    return true;
  } catch (err) {
    console.log(`${label}: ОШИБКА → ${err.message}`);
    return false;
  }
}

const sloppyOk = test('sloppy (classic script)', false);
const strictOk = test('strict  (type="module")', true);
console.log('\nВЫВОД: sloppy =', sloppyOk ? 'работает' : 'падает', '| strict =', strictOk ? 'работает' : 'падает (баг воспроизведён)');
