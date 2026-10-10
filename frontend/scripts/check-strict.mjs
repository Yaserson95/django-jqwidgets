// Временный: проверить, есть ли "use strict" в бандле и как он подключается
import { readFileSync } from 'node:fs';

const p = '../jqxwidgets/static/jqxwidgets/';
const m = JSON.parse(readFileSync(p + 'manifest.json', 'utf8'));
console.log('manifest:', JSON.stringify(m));
for (const f of m.js) {
  const s = readFileSync(p + f, 'utf8');
  const strictCount = (s.match(/"use strict"/g) ?? []).length;
  const head = s.slice(0, 200);
  console.log(`${f}: len=${s.length} use_strict=${strictCount}`);
  console.log('  head:', JSON.stringify(head));
  const first = s.indexOf('"use strict"');
  if (first >= 0) console.log('  first use strict @', first, JSON.stringify(s.slice(Math.max(0, first - 40), first + 30)));
}
