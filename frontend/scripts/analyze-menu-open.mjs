// Временный: найти открытие меню в jqxgrid.js (gridmenu) и контекст
import { readFileSync } from 'node:fs';

const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';
const s = readFileSync(base + 'jqxgrid.js', 'utf8');

const needles = ['jqxMenu("open"', '_openmenu', 'openmenu', '_handlecolumnmenu', '_initmenu', '_buildfilter', '_initfilterpanel'];
for (const n of needles) {
  let i = -1;
  const hits = [];
  while ((i = s.indexOf(n, i + 1)) >= 0) hits.push(i);
  console.log(`${n}: [${hits.join(', ')}]`);
}

// контекст вызова jqxMenu("open"
let i = s.indexOf('jqxMenu("open"');
while (i >= 0) {
  console.log(`\n--- open @${i}:\n` + s.slice(Math.max(0, i - 600), i + 300).replace(/\s+/g, ' '));
  i = s.indexOf('jqxMenu("open"', i + 1);
}
