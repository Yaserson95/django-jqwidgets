// Временный анализатор: вызовы, где this может быть отвязан (strict mode -> undefined),
// в коде меню/фильтров jqxGrid и jqxMenu.
import { readFileSync } from 'node:fs';

const base = process.env['JQX_LIBS'] ?? 'node_modules/jqxwidgets-ng/jqxwidgets/';

for (const file of ['jqxmenu.js', 'jqxgrid.js']) {
  const s = readFileSync(base + file, 'utf8');
  console.log(`===== ${file} (${s.length} байт)`);

  // 1) отвязанные вызовы: var X = this.method; ... X(  или setTimeout(this.method)
  const patterns = [
    /var\s+\w+\s*=\s*this\.(\w+);\s*\w+\(/g,           // var f=this.m; f(
    /(?:setTimeout|setInterval)\(\s*this\.(\w+)\s*[,)]/g, // setTimeout(this.m)
    /\.each\([^,]+,\s*this\.(\w+)\s*\)/g,               // .each(x, this.m)
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(s))) {
      const ctx = s.slice(Math.max(0, m.index - 80), m.index + 120).replace(/\s+/g, ' ');
      console.log(`  DETACH[${re.source.slice(0, 20)}]: ${ctx}`);
    }
  }

  // 2) прямые обращения к theme внутри обработчиков, где this — DOM/элемент
  let i = 0;
  let count = 0;
  while ((i = s.indexOf('.theme', i + 1)) >= 0 && count < 40) {
    const ctx = s.slice(Math.max(0, i - 100), i + 60).replace(/\s+/g, ' ');
    // показываем только контексты, где рядом this.
    if (/this\.theme/.test(ctx)) {
      console.log(`  THEME @${i}: ${ctx}`);
      count++;
    }
  }
}
