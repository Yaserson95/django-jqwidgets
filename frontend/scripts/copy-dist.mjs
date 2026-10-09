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

// Entry-файлы берём из эмитированного index.html (чанки подгружаются сами).
const html = readFileSync(join(targetDir, 'index.html'), 'utf8');

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
