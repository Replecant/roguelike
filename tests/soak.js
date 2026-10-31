// Бот-игрок: npm run soak [героев] [шагов]. Сам ходит по Италии, говорит со всеми, торгует,
// лезет в подземелья, берёт задания, спит, сохраняется и загружается; на каждом шаге проверяет,
// что ничего не сломалось (исключения, числа, тексты, журнал, панель, сохранение).
// Бот-игрок: долго играет сам и ищет ошибки.
const { chromium } = require('playwright');
const RUNS = +(process.argv[2] || 2), STEPS = +(process.argv[3] || 400);
(async () => {
  const b = await chromium.launch();
  const all = {};
  for (let run = 0; run < RUNS; run++) {
    const pg = await b.newPage({ viewport: { width: 1400, height: 820 } });
    const pageErrs = []; pg.on('pageerror', e => pageErrs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
    await pg.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
    await pg.addScriptTag({ path: require('path').resolve(__dirname, 'helpers.js') });
    await pg.evaluate(() => {
      window.BOT = { issues: {}, n: 0 };
      const bad = (k, v) => { const L = BOT.issues[k] = BOT.issues[k] || []; if (L.length < 6) L.push(String(v).slice(0, 300)); };
      BOT.bad = bad;
      const TXT = /undefined|NaN|\[object|\{[a-zа-я_]+\}|null\b/;
      BOT.checkText = (src, t) => { if (typeof t === 'string' && TXT.test(t)) bad('текст', src + ': ' + t); };
      BOT.inv = () => {
        const p = G.player;
        for (const k of ['coins', 'hp', 'food', 'fatigue', 'piety', 'grace', 'xp']) if (!Number.isFinite(p[k])) bad('не число', k + '=' + p[k]);
        if (p.coins < 0) bad('минус деньги', p.coins);
        if (p.food < 0 || p.food > 100 || p.fatigue < 0 || p.fatigue > 100) bad('шкалы', `еда ${p.food} уст ${p.fatigue}`);
        if (p.piety < 0 || p.piety > 100) bad('благочестие', p.piety);
        if ((p.fame || 0) < 0) bad('слава', p.fame);
        for (const q of p.quests) { try { const l = questLine(q); BOT.checkText('задание', l); questTarget(q); questDetail(q); } catch (e) { bad('задание падает', q.type + ' ' + e.message); } }
        for (const t of G.travelers || []) { if (!G.over.passable(t.x, t.y)) bad('путник в непроходимом', t.kind + ' ' + t.x + ',' + t.y); if (t.path && t.path.length && (t.i < 0 || t.i >= t.path.length)) bad('путь путника', t.kind); }
        for (const h of G.happenings || []) if (!G.over.cities.find(c => c.id === h.place)) bad('событие без места', h.kind);
        try { panelHtml(); } catch (e) { bad('панель падает', e.message); }
        try { pushScreen(new JournalScreen()); for (let t = 0; t < 4; t++) { topScreen().tab = t; topScreen().html(); } popScreen(); } catch (e) { bad('журнал падает', e.message); while (G.screens.length > 1) popScreen(); }
        try { pushScreen(new CharacterScreen()); topScreen().html(); popScreen(); } catch (e) { bad('лист героя падает', e.message); while (G.screens.length > 1) popScreen(); }
        if (G.mode === 'local') { const w = G.world; if (!w.walkable(p.x, p.y) && !SWIM_TILES.has(w.get(p.x, p.y))) bad('герой в стене', `${w.kind} ${p.x},${p.y} ${w.def(p.x, p.y).name}`); }
      };
      // Разговор со всеми: все пункты (кроме уходов), торговля.
      BOT.talkAll = (limit = 6) => {
        const w = G.world, npcs = (w.villages && w.villages[0] ? w.villages[0].npcs : w.actors.filter(a => a.kind === 'npc')).slice(0, limit);
        for (const n of npcs) {
          try {
            const d = new DialogScreen(n); pushScreen(d);
            BOT.checkText('приветствие ' + n.role, d.text);
            const labels = d.options.map(o => o.label);
            for (const l of labels) BOT.checkText('пункт', l);
            for (let i = 0; i < labels.length; i++) {
              const l = labels[i];
              if (/Уйти|Прощай|Отказываюсь|Не сейчас|Отплыть/.test(l)) continue;
              const dd = new DialogScreen(n); pushScreen(dd);
              const j = dd.options.findIndex(o => o.label === l);
              if (j < 0) { popScreen(); continue; }
              dd.choose(j);
              if (topScreen() instanceof TradeScreen) { const tr = topScreen(); tr.html && tr.html(); const rows = tr.rows(0); if (rows.length && G.player.coins > 50) { try { rows[0].buy(1); } catch (e) { BOT.bad('торговля падает', e.message); } } const s1 = tr.rows(1); if (s1.length && s1[0].sell && s1[0].price) try { s1[0].sell(1); } catch (e) { BOT.bad('продажа падает', e.message); } }
              BOT.checkText('ответ ' + n.role + ' «' + l + '»', dd.text);
              while (G.screens.length > 1) popScreen();
            }
          } catch (e) { BOT.bad('диалог падает', n.role + ' ' + (n.title || '') + ': ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
          while (G.screens.length > 1) popScreen();
        }
      };
      BOT.dungeon = () => {
        const w = G.world, p = G.player;
        for (const m of w.actors.filter(a => a.kind === 'beast' && dist(a, p) < 30)) killBeast(m, true);
        for (const i of [...(w.containers || new Map()).keys()].slice(0, 3)) { const k = w.containers.get(i); if (/^relic_|kidnap/.test(k)) continue; openContainer(i % w.w, (i / w.w) | 0); }
        if (w.down && rng.chance(0.5)) { useStairs(T.STAIRS_DOWN); return; }
        if (G.mode === 'local' && G.world.kind === 'dungeon') { while (G.world.depth > 0) goToLevel(G.world.site, G.dungeons[G.world.site.id], G.world.depth - 1, 'down'); leaveLocal(); }
      };
    });
    const res = await pg.evaluate(async (STEPS) => {
      const p = TH.start(rng.int(0, PEOPLES.length - 1)); TH.immortal(); p.coins = 300;
      const msgs0 = G.messages.length;
      for (let s = 0; s < STEPS; s++) {
        try {
          if (G.player.hp <= 0) { G.player.hp = 50; BOT.bad('смерть', G.deathCause); while (G.screens.length > 1) popScreen(); }
          if (G.mode === 'local') {
            const w = G.world;
            if (w.kind === 'dungeon') BOT.dungeon();
            else {
              if (w.villages && w.villages.length && rng.chance(0.6)) BOT.talkAll(rng.int(3, 8));
              // походить
              for (let k = 0; k < 15 && G.mode === 'local'; k++) { const [dx, dy] = rng.pick(DIRS8); tryMove(dx, dy); while (G.screens.length > 1) popScreen(); }
              if (G.mode === 'local' && rng.chance(0.15)) { G.player.fatigue = 80; sleepWild(); }
              if (G.mode === 'local' && G.world && G.world.kind !== 'dungeon') {
                for (const m of G.world.actors.filter(a => a.kind === 'beast')) killBeast(m, true);
                if (G.mode === 'local' && G.world.kind !== 'dungeon') leaveLocal();
              }
            }
          } else {
            // идти к случайному городу по дороге шагов 10–25
            const r = rng.next();
            if (r < 0.12) {   // к цели задания
              const q = rng.pick(G.player.quests), t = q && questTarget(q);
              if (t) { G.ox = t.x; G.oy = t.y; overEnter(); while (G.screens.length > 1) popScreen(); continue; }
            }
            if (r >= 0.12 && r < 0.22) {   // в подземелье
              const s = rng.pick(G.over.sites.filter(x => x.dungeon && !x.quest));
              revealTomb(s); G.ox = s.x; G.oy = s.y; overEnter(); continue;
            }
            if (r >= 0.22 && r < 0.27 && (G.happenings || []).length) {   // на событие
              const h = rng.pick(G.happenings), c = G.over.cities.find(x => x.id === h.place);
              if (c) { G.ox = c.x; G.oy = c.y; overEnter(); continue; }
            }
            if (r < 0.75) {
              BOT.goal = BOT.goal && rng.chance(0.9) ? BOT.goal : rng.pick(G.over.cities);
              for (let k = 0; k < 20 && G.mode === 'over'; k++) {
                const dx = Math.sign(BOT.goal.x - G.ox), dy = Math.sign(BOT.goal.y - G.oy);
                const opts = [[dx, dy], [dx, 0], [0, dy], ...DIRS8].filter(([a, b]) => (a || b) && G.over.passable(G.ox + a, G.oy + b));
                if (!opts.length) break;
                overMove(...opts[0]);
                while (G.screens.length > 1) popScreen();
                if (G.ox === BOT.goal.x && G.oy === BOT.goal.y) break;
              }
            }
            if (G.mode === 'over') { if (rng.chance(0.15)) { G.player.fatigue = 80; camp(); } else { overEnter(); } while (G.screens.length > 1) popScreen(); }
          }
          if (s % 25 === 0) { G.player.food = 80; G.player.coins = Math.max(G.player.coins, 100); }
          BOT.inv();
          if (s % 60 === 59) { // сохранение и загрузка
            const c = G.player.coins, day = timeInfo().day;
            if (!(await saveGame())) BOT.bad('не сохраняется', `${G.mode} ${G.world ? G.world.kind : ''} ${timeInfo().day}`); await loadGame();
            TH.immortal();
            if (G.player.coins !== c || timeInfo().day !== day) BOT.bad('сохранение', `монет ${c}→${G.player.coins}, день ${day}→${timeInfo().day}`);
          }
        } catch (e) { BOT.bad('исключение', e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); while (G.screens.length > 1) popScreen(); if (G.mode === 'local' && G.world && G.world.kind === 'dungeon') { try { leaveLocal(); } catch (e2) {} } }
      }
      for (const m of G.messages.slice(msgs0)) BOT.checkText('лог', m.text);
      return { issues: BOT.issues, day: dateText(today(), false), lvl: G.player.level, fame: G.player.fame || 0, quests: G.player.quests.map(q => q.type + (q.id ? ':' + q.id : '')).join(','), hap: (G.happenings || []).length, trav: (G.travelers || []).length };
    }, STEPS).catch(e => ({ fatal: e.message }));
    all[run] = { res, pageErrs: [...new Set(pageErrs)].slice(0, 8) };
    console.log(JSON.stringify(all[run], null, 1));
    await pg.close();
  }
  await b.close();
})();
