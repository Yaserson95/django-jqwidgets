/**
 * Копирует сборку Angular в статику Django-пакета и генерирует manifest.json
 * со списком entry-скриптов и стилей.
 *
 * Запускается из npm scripts: ng build && node scripts/copy-dist.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = dirname(scriptsDir);
const distDir = join(frontendDir, 'dist', 'jqxwidgets-angular', 'browser');
const targetDir = join(frontendDir, '..', 'jqxwidgets', 'static', 'jqxwidgets');

if (!existsSync(distDir)) {
  console.error(`[copy-dist] Не найдена сборка: ${distDir}`);
  process.exit(1);
}

// Чистая копия (старые хешированные файлы удаляются)
rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(distDir, targetDir, { recursive: true });

// Эмит Angular-сборки — ES-модули (всегда strict-режим). jqx-библиотека
// написана для classic-скриптов (sloppy-режим): отвязанные вызовы вроде
// `w(x)` внутри _updatefilterpanel полагаются на `this === window`.
// В strict-режиме `this === undefined` -> "can't access property 'theme'".
// Поэтому каждый JS-файл оборачивается в IIFE и грузится как classic script:
// изоляция var сохраняется (как в модуле), а код выполняется в sloppy-режиме.
for (const name of readdirSync(targetDir).filter((f) => f.endsWith('.js'))) {
  const path = join(targetDir, name);
  const code = readFileSync(path, 'utf8');
  if (code.startsWith('(function(){')) continue; // уже обёрнут
  writeFileSync(path, '(function(){\n' + code + '\n})();\n');
}

// Артефактный index.html ng build ссылается на entry как на type="module".
// Файлы уже обёрнуты в IIFE и грузятся как classic scripts (см. jqxwidgets/assets.py),
// поэтому атрибут убираем, чтобы файл оставался самодостаточным для отладки.
const indexPath = join(targetDir, 'index.html');
const indexHtml = readFileSync(indexPath, 'utf8')
  .replace(/<script([^>]*)\s+type="module"([^>]*)>/gi, '<script$1$2>');
writeFileSync(indexPath, indexHtml);

// Entry-файлы берём из эмитированного index.html (чанки подгружаются сами).
const html = readFileSync(indexPath, 'utf8');

const js = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*>/gi)]
  .map((m) => m[1].replace(/^\.\//, ''));

const css = [...new Set(
  [...html.matchAll(/<link[^>]*>/gi)]
    .map((tag) => {
      const rel = /rel="([^"]*)"/i.exec(tag)?.[1] ?? '';
      const href = /href="([^"]*)"/i.exec(tag)?.[1] ?? '';
      return rel.toLowerCase() === 'stylesheet' ? href.replace(/^\.\//, '') : null;
    })
    .filter(Boolean),
)];

// Порядок важен: polyfills (zone.js) до main.
js.sort((a, b) => {
  const rank = (name) => (name.startsWith('polyfills') ? 0 : name.startsWith('main') ? 1 : 2);
  return rank(a) - rank(b);
});

const manifest = { js, css };
writeFileSync(join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

const files = readdirSync(targetDir).filter((f) => statSync(join(targetDir, f)).isFile());
console.log(`[copy-dist] -> ${targetDir}`);
console.log(`[copy-dist] js: ${js.join(', ') || '-'}`);
console.log(`[copy-dist] css: ${css.join(', ') || '-'}`);
console.log(`[copy-dist] файлов: ${files.length}`);
