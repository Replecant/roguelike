// Автотесты: node tests/run.js [часть названия]
// Нужен Playwright с Chromium: npm install && npx playwright install chromium
const path = require('path');
const { chromium } = require('playwright');
const cases = require('./cases.js');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const HELPERS = path.join(__dirname, 'helpers.js');

async function openGame(page) {
  await page.goto(URL);
  await page.addScriptTag({ path: HELPERS });
  await page.waitForFunction(() => typeof G !== 'undefined' && G.screens && G.screens.length);
}

// Начать игру быстрым стартом с титульного экрана.
async function startPage(page) {
  await page.keyboard.press('KeyQ');   // быстрый старт
  await page.waitForFunction(() => G.player && G.mode === 'local');
}

(async () => {
  const filter = process.argv[2];
  const list = cases.filter(c => !filter || c.name.toLowerCase().includes(filter.toLowerCase()));
  const browser = await chromium.launch();
  let failed = 0;
  for (const c of list) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 820 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('load', () => page.addScriptTag({ path: HELPERS }).catch(() => {}));
    const t0 = Date.now();
    let result, error;
    try {
      await openGame(page);
      result = c.node ? await c.node(page, startPage) : await page.evaluate(`(${c.run.toString().replace(/^run\s*\(/, 'function (')})()`);
      if (errors.length) throw new Error('ошибка на странице: ' + errors[0]);
    } catch (e) { error = e.message.split('\n')[0]; }
    const ms = Date.now() - t0;
    if (error) { failed++; console.log(`✗ ${c.name} (${ms} мс)\n    ${error}`); }
    else console.log(`✓ ${c.name} — ${result} (${ms} мс)`);
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${list.length - failed} из ${list.length} прошли`);
  process.exit(failed ? 1 : 0);
})();
