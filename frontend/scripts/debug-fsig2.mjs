// Временный: сигнатуры _initfilterpanel и создание filterpanel в jqxgrid.filter.js
import { readFileSync } from 'node:fs';

const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';
const s = readFileSync(base + 'jqxgrid.filter.js', 'utf8');

let i = s.indexOf('_initfilterpanel');
while (i >= 0) {
  console.log(`\n=== _initfilterpanel @${i}:\n` + s.slice(i - 10, i + 400).replace(/\s+/g, ' '));
  i = s.indexOf('_initfilterpanel', i + 1);
}

// где присваивается t.filterpanel
let j = s.indexOf('filterpanel=');
const seen = new Set();
while (j >= 0 && seen.size < 10) {
  const ctx = s.slice(Math.max(0, j - 120), j + 80).replace(/\s+/g, ' ');
  seen.add(ctx);
  console.log(`\n-- filterpanel= @${j}: ${ctx}`);
  j = s.indexOf('filterpanel=', j + 1);
}
