// Сборка игры в один HTML-файл (dist/anno-tenebris.html): скрипты, стили
// и портреты встраиваются внутрь — такой файл открывается где угодно.
// Запуск: npm run build
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');

const html = read('index.html');
const fonts = html.match(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts[^"]*"[^>]*>/g) || [];
let body = html.split('<body>')[1].split('</body>')[0];
const scripts = [...body.matchAll(/<script src="((?:js|content)\/[^"]+)"><\/script>/g)].map(m => m[1]);
body = body.replace(/\s*<script src="[^"]+"><\/script>/g, '').replace(/^\n+|\n+$/g, '');

const portraits = {};
for (const f of readdirSync(join(root, 'portraits')).filter(f => f.endsWith('.webp')).sort())
  portraits[f.slice(0, -5)] = 'data:image/webp;base64,' + readFileSync(join(root, 'portraits', f)).toString('base64');

const tiles = process.argv.includes('--tiles');
const js = (tiles ? 'window.TILE_MODE_DEFAULT = true;\n' : '') + `window.PORTRAITS_INLINE = ${JSON.stringify(portraits)};\n` + scripts.map(read).join('\n');
const out = `<!doctype html>
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
mkdirSync(join(root, 'dist'), { recursive: true });
const name = tiles ? 'anno-tenebris-tiles.html' : 'anno-tenebris.html';
writeFileSync(join(root, 'dist', name), out);
console.log(`dist/${name}: ${scripts.length} скриптов, ${Object.keys(portraits).length} портретов, ${(out.length / 1024 / 1024).toFixed(2)} МБ`);
