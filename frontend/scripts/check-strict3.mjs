// Временный: проверки бандла перед фиксом загрузки
// 1) контекст "use strict" @834466 (не wraps ли jqx-код @977188)
// 2) sourcemap-комментарии в хвосте
// 3) парсимость как classic script (new Function бросает на import/export)
import { readFileSync } from 'node:fs';

const p = '../jqxwidgets/static/jqxwidgets/';
const main = readFileSync(p + 'main-GOQ5YICA.js', 'utf8');
const poly = readFileSync(p + 'polyfills-5CFQRCPP.js', 'utf8');

console.log('=== use strict @834466 контекст:');
console.log(main.slice(834466 - 200, 834466 + 120).replace(/\s+/g, ' '));

console.log('\n=== хвост main:', JSON.stringify(main.slice(-150)));
console.log('=== хвост polyfills:', JSON.stringify(poly.slice(-150)));

console.log('\n=== парсимость как classic script:');
for (const [name, code] of [['polyfills', poly], ['main', main]]) {
  try {
    new Function(code);
    console.log(`${name}: OK (классический скрипт парсится)`);
  } catch (e) {
    console.log(`${name}: ОШИБКА ${e.message}`);
  }
}

// IIFE-обёртка: скрипт в функции без "use strict" -> sloppy mode
console.log('\n=== IIFE-обёртка парсится:');
for (const [name, code] of [['polyfills', poly], ['main', main]]) {
  try {
    new Function('(function(){' + code + '\n})();');
    console.log(`${name}: OK`);
  } catch (e) {
    console.log(`${name}: ОШИБКА ${e.message}`);
  }
}

// кто объявляет var на верхнем уровне (глобальные коллизии при classic-загрузке)
console.log('\n=== возможные коллизии var между файлами:');
const toplevelVars = (code) => {
  const m = code.match(/^var [^;]+;/m);
  return m ? m[0].slice(0, 200) : '(нет)';
};
console.log('polyfills head:', toplevelVars(poly));
console.log('main head:', toplevelVars(main));
