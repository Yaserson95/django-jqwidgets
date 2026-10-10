// Временный: this.theme в jqxgrid.filter.js и контекст вхождений
import { readFileSync } from 'node:fs';

const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';
const s = readFileSync(base + 'jqxgrid.filter.js', 'utf8');
console.log('длина', s.length);

let i = -1;
const hits = [];
while ((i = s.indexOf('this.theme', i + 1)) >= 0) hits.push(i);
console.log('this.theme:', hits.length);

// найти функцию-контейнер для каждого: ищем ближайшее ":function" слева
function enclosingFn(pos) {
  const seg = s.slice(Math.max(0, pos - 4000), pos);
  const m = [...seg.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*function\s*\(/g)];
  return m.length ? m[m.length - 1][1] + ' @' + (Math.max(0, pos - 4000) + m[m.length - 1].index) : '?';
}

for (const h of hits) {
  console.log(`\n@${h} fn=${enclosingFn(h)}`);
  console.log(s.slice(Math.max(0, h - 350), h + 150).replace(/\s+/g, ' '));
}
