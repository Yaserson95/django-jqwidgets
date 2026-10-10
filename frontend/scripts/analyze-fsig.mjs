// Временный: сигнатура _updatefilterpanel и контекст вызова в jqxgrid.js
import { readFileSync } from 'node:fs';

const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';

const f = readFileSync(base + 'jqxgrid.filter.js', 'utf8');
const def = f.indexOf('_updatefilterpanel');
console.log('=== _updatefilterpanel (filter.js) @' + def + ':\n' + f.slice(def - 20, def + 700).replace(/\s+/g, ' '));

const g = readFileSync(base + 'jqxgrid.js', 'utf8');
const call = g.indexOf('_updatefilterpanel');
console.log('\n=== вызов (grid.js) @' + call + ':\n' + g.slice(call - 800, call + 100).replace(/\s+/g, ' '));
