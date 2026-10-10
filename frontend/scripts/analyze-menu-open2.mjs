// Временный: контекст openmenu в jqxgrid.js + проверки бандла на ESM-признаки
import { readFileSync } from 'node:fs';

const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';
const s = readFileSync(base + 'jqxgrid.js', 'utf8');

for (const pos of [55480, 275880, 289419]) {
  console.log(`\n===== openmenu @${pos}:\n` + s.slice(pos - 150, pos + 500).replace(/\s+/g, ' '));
}

// где вызывается _updatefilterpanel?
let i = s.indexOf('_updatefilterpanel');
while (i >= 0) {
  console.log(`\n-- call _updatefilterpanel @${i}: ` + s.slice(Math.max(0, i - 250), i + 120).replace(/\s+/g, ' '));
  i = s.indexOf('_updatefilterpanel', i + 1);
}

// бандл: ESM-признаки
const p = '../jqxwidgets/static/jqxwidgets/';
const m = JSON.parse(readFileSync(p + 'manifest.json', 'utf8'));
for (const f of m.js) {
  const b = readFileSync(p + f, 'utf8');
  console.log(`\n### ${f}`);
  for (const needle of ['import.meta', 'await ', 'export ', ' import ', 'import{', 'import {']) {
    const idx = b.indexOf(needle);
    console.log(`  ${needle.trim()}: ${idx >= 0 ? '@' + idx + ' ...' + JSON.stringify(b.slice(Math.max(0, idx - 40), idx + 40)) : 'нет'}`);
  }
}
