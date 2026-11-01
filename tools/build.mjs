// Сборка игры (npm run build):
//   dist/anno-tenebris.html       — скрипты и стили внутри, портреты рядом, в dist/portraits/ (так её публикуем:
//                                   файл игры остаётся лёгким, сколько бы портретов ни прибавилось);
//   dist/anno-tenebris-full.html  — всё в одном файле, портреты тоже: открывается где угодно, без папки рядом.
// С ключом --tiles — то же для плиточного вида.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');

const html = read('index.html');
const fonts = html.match(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts[^"]*"[^>]*>/g) || [];
let body = html.split('<body>')[1].split('</body>')[0];
const scripts = [...body.matchAll(/<script src="((?:js|content)\/[^"]+)"><\/script>/g)].map(m => m[1]);
body = body.replace(/\s*<script src="[^"]+"><\/script>/g, '').replace(/^\n+|\n+$/g, '');

const portraitFiles = readdirSync(join(root, 'portraits')).filter(f => f.endsWith('.webp')).sort();
const portraits = {};
for (const f of portraitFiles)
  portraits[f.slice(0, -5)] = 'data:image/webp;base64,' + readFileSync(join(root, 'portraits', f)).toString('base64');

const tiles = process.argv.includes('--tiles');
const page = inline => {
  const js = (tiles ? 'window.TILE_MODE_DEFAULT = true;\n' : '') + (inline ? `window.PORTRAITS_INLINE = ${JSON.stringify(portraits)};\n` : '')
    + scripts.map(read).join('\n');
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Anno Tenebris</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts.join('\n')}
<style>
${read('css/style.css')}
</style>
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>
`;
};
mkdirSync(join(root, 'dist', 'portraits'), { recursive: true });
for (const f of portraitFiles) copyFileSync(join(root, 'portraits', f), join(root, 'dist', 'portraits', f));
const base = tiles ? 'anno-tenebris-tiles' : 'anno-tenebris';
const light = page(false), full = page(true);
writeFileSync(join(root, 'dist', `${base}.html`), light);
writeFileSync(join(root, 'dist', `${base}-full.html`), full);
const mb = n => (n / 1024 / 1024).toFixed(2);
console.log(`dist/${base}.html: ${scripts.length} скриптов, ${mb(light.length)} МБ + ${portraitFiles.length} портретов в dist/portraits/`);
console.log(`dist/${base}-full.html: всё в одном файле, ${mb(full.length)} МБ`);
