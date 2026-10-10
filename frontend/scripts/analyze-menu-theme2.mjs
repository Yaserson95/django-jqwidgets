// Временный: распечатать контекст вокруг обращений к this.theme в jqxgrid.js
import { readFileSync } from 'node:fs';

const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';
const s = readFileSync(base + 'jqxgrid.js', 'utf8');

const targets = process.argv[2]
  ? [Number(process.argv[2])]
  : [18259, 42780, 46548, 48505, 286732];

for (const t of targets) {
  console.log(`\n===== @${t} =====`);
  console.log(s.slice(t - 900, t + 400).replace(/\s+/g, ' '));
}
