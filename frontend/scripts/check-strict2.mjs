// Временный: окружает ли "use strict" jqx-код в бандле (позиции относительно паттерна this.theme)
import { readFileSync } from 'node:fs';

const s = readFileSync('../jqxwidgets/static/jqxwidgets/main-GOQ5YICA.js', 'utf8');
const pos = [];
let i = -1;
while ((i = s.indexOf('"use strict"', i + 1)) >= 0) pos.push(i);
console.log('use strict позиции:', pos.join(', '));

const target = s.indexOf('_filterpanelwidth-(this.theme');
console.log('jqx-паттерн @', target);
const before = pos.filter((p) => p < target);
const after = pos.filter((p) => p > target);
console.log('ближайший use strict до jqx-кода:', before.length ? before[before.length - 1] : 'нет');
console.log('ближайший use strict после:', after.length ? after[0] : 'нет');

// как загружен бандл: посмотреть head бандла на предмет IIFE-обёртки
console.log('head:', JSON.stringify(s.slice(0, 80)));
console.log('tail:', JSON.stringify(s.slice(-120)));
