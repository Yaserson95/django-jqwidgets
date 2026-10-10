// Временный: найти this.theme / отвязанные вызовы во всех jqx-файлах
import { readFileSync, readdirSync } from 'node:fs';

const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';
const files = readdirSync(base).filter((f) => /^jqx.*\.js$/.test(f));

for (const f of files) {
  const s = readFileSync(base + f, 'utf8');
  const hits = [];
  let i = -1;
  while ((i = s.indexOf('this.theme', i + 1)) >= 0) hits.push(i);
  if (!hits.length) continue;
  console.log(`===== ${f}: ${hits.length} this.theme`);
  for (const h of hits) {
    console.log(`  @${h}: ${s.slice(Math.max(0, h - 90), h + 50).replace(/\s+/g, ' ')}`);
  }
}
