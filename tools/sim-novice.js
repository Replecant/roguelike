// Выживаемость новичка: node tools/sim-novice.js [героев] [дней]
// Каждый герой создаётся как в игре (случайные народ, предыстория, оружие, характеристики) и сам живёт
// первые дни, как живёт осторожный новичок: ходит по дорогам от города к городу, берёт простую работу
// (охота, доставка, работа на месте), покупает еду и отвары, ночует в трактире или у костра,
// дерётся с тем, кто напал, пьёт отвар, а без отваров — бежит. Смерть настоящая.
const { chromium } = require('playwright');
(async () => {
  const HEROES = +(process.argv[2] || 60), DAYS = +(process.argv[3] || 10);
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + __dirname + '/../index.html');
  await pg.addScriptTag({ path: __dirname + '/../tests/helpers.js' });
  const runs = [];
  for (let h = 0; h < HEROES; h++) {
    const r = await pg.evaluate(DAYS => {
      window.log = () => {};
      new CreationScreen().quickStart();
      while (G.screens.length > 1) popScreen();
      const p = G.player, ow = G.over;
      // Вещи предыстории — надеть (лук охотника, стёганка наёмника), если слот свободен.
      for (const it of p.bag.slice()) { const slot = KIND_SLOTS[it.kind] && KIND_SLOTS[it.kind][0]; if (slot && !p.equip[slot]) equip(p, it); }
      const R = { people: p.people.name, bg: p.background ? BACKGROUNDS.find(b2 => b2.id === p.background).name : '', weapon: p.equip.right ? p.equip.right.name : '—',
        died: false, day: null, cause: null, fights: 0, fled: 0, quests: 0, level: 1, coins: 0, potionsUsed: 0, where: null };
      const close = () => { while (G.screens.length > 1) popScreen(); };
      const dayNow = () => timeInfo().day;
      const visitedAt = {};
      let goal = null, guard = 0, triedInn = null;
      const t0 = Date.now();
      // Бой и бегство на местной карте.
      const localFight = () => {
        if (G.world.actors.some(a => a.kind === 'beast' && (a.provoked || a.target) && dist(a, p) <= 12)) R.fights++;
        for (let t = 0; t < 400 && G.mode === 'local' && p.hp > 0; t++) {
          close();
          const w = G.world;
          const foes = w.actors.filter(a => a.kind === 'beast' && !a.dead && (a.provoked || a.target) && beastMode(a) !== 'flee' && dist(a, p) <= 12);
          if (!foes.length) { if (!dangerNear()) { leaveLocal(); break; } }
          const adj = foes.filter(a => dist(a, p) === 1);
          if (p.hp < p.maxHp * 0.5 && p.potions > 0) { quaff(); R.potionsUsed++; endTurn(); continue; }
          if (p.hp < p.maxHp * 0.3 && !p.potions) {
            // Бежать к краю карты — подальше от ближайшего.
            const near = foes[0] || visibleBeasts()[0];
            const dx = near ? Math.sign(p.x - near.x) || 1 : 1, dy = near ? Math.sign(p.y - near.y) : 0;
            const opts = [[dx, dy], [dx, 0], [0, dy || 1], [0, -(dy || 1)]].filter(([a, c]) => !w.inside(p.x + a, p.y + c) || (w.walkable(p.x + a, p.y + c) && !w.actorAt(p.x + a, p.y + c)));
            if (opts.length) { const before = G.mode; tryMove(...opts[0]); if (G.mode !== 'local' && before === 'local') R.fled++; } else endTurn();
            continue;
          }
          if (adj.length) { playerAttack(adj.sort((a, b2) => a.hp - b2.hp)[0]); endTurn(); continue; }
          const mode = rangedMode(p);
          if (mode && (!mode.launcher || ammoLeft(p, mode.ammo))) {
            const tg = rangedTargets(mode).filter(a => foes.includes(a));
            if (tg.length) { shoot(mode, tg[0]); continue; }
          }
          if (foes.length) {
            const f = foes.sort((a, b2) => dist(a, p) - dist(b2, p))[0];
            const dx = Math.sign(f.x - p.x), dy = Math.sign(f.y - p.y);
            if (w.walkable(p.x + dx, p.y + dy) && !w.actorAt(p.x + dx, p.y + dy)) tryMove(dx, dy); else endTurn();
          } else {
            // Рядом опасность, но на нас не идёт — уйти краем.
            tryMove(p.x < w.w / 2 ? -1 : 1, 0);
          }
        }
        if (G.mode === 'local' && p.hp > 0) leaveLocal();
      };
      // В городе: поручения, сдача, припасы, ночлег.
      const inTown = place => {
        const v = G.world.villages[0];
        if (!v) return;
        for (const n of v.npcs) {
          const opts = TH.options(n);
          const turn = opts.find(l => /^Работа сделана|^Передать|^Вот:/.test(l));
          if (turn) { const c0 = p.coins; TH.ask(n, turn); if (p.coins > c0) R.quests++; }
        }
        if (p.quests.length < 2) for (const n of v.npcs.filter(n => ['elder', 'innkeeper', 'herbalist', 'smith'].includes(n.role))) {
          n.offer = null;
          if (!TH.options(n).includes('Нет ли для меня работы?')) continue;
          TH.ask(n, 'Нет ли для меня работы?');
          const o = n.offer;
          if (o && ['kill', 'deliver', 'work'].includes(o.type) && !o.story) TH.ask(n, o.accept);
          else n.offer = null;
        }
        // Работа на месте — сделать сразу.
        for (const q of p.quests.filter(q => q.type === 'work' && !q.done && q.from === place.id)) {
          const w = G.world;
          for (const [i, id] of [...(w.work || new Map())]) if (id === q.id) { questWorkStep(i % w.w, (i / w.w) | 0); close(); if (p.hp <= 0) return; }
          const n = v.npcs.find(x => x.role !== 'priest' && TH.options(x).some(l => /^Работа сделана/.test(l)));
          if (n) { TH.ask(n, 'Работа сделана'); R.quests++; }
        }
        // Еда и отвары.
        const seller = v.npcs.find(n => ['innkeeper', 'elder', 'merchant'].includes(n.role) && traderGoods(n) && traderGoods(n).rations);
        if (seller && p.rations < 3) { const tr = new TradeScreen(seller); tr.buy('ration', 3 - p.rations, p.priceBuy(RATION_PRICE)); }
        const herb = v.npcs.find(n => n.role === 'herbalist');
        if (herb && p.potions < 2 && p.coins > 30) { const tr = new TradeScreen(herb); tr.buy(null, 2 - p.potions, p.priceBuy(POTION_PRICE)); }
        // Ночлег: устал, ранен или ночь — в трактире.
        const inn = v.npcs.find(n => n.role === 'innkeeper');
        if (inn && (p.fatigue > 55 || p.hp < p.maxHp * 0.6 || isNight())) {
          const lbl = TH.options(inn).find(l => /^Ночлег/.test(l));
          if (lbl) { const d = new DialogScreen(inn); pushScreen(d); d.choose(d.options.findIndex(o => o.label === lbl));
            const j = d.options.findIndex(o => /^Снять угол/.test(o.label)); if (j >= 0) d.choose(j); close(); }
        }
      };
      while (dayNow() < DAYS && p.hp > 0 && guard++ < 4000 && Date.now() - t0 < 25000) {
        close();
        if (G.mode === 'local') {
          if (G.world.kind === 'city') { inTown(G.world.city); if (p.hp > 0 && G.mode === 'local') leaveLocal(); continue; }
          localFight(); continue;
        }
        if (p.food < 45) eat();
        if (p.fatigue > 80 || (isNight() && p.fatigue > 40)) {
          // В трактир, если он тут есть и сегодня ещё не пробовали; иначе — костёр.
          const here = ow.placeAt(G.ox, G.oy);
          if (here && here.type === 'city' && triedInn !== G.ox + ',' + G.oy + ':' + dayNow()) { triedInn = G.ox + ',' + G.oy + ':' + dayNow(); overEnter(); }
          else { p.fatigue = Math.max(p.fatigue, 40); camp(); }
          close(); continue;
        }
        // Цель: место задания или ближайший непосещённый город.
        if (!goal || (G.ox === goal.x && G.oy === goal.y)) {
          const q = p.quests.find(q => q.type === 'deliver' || q.done);
          const t = q && (q.type === 'deliver' ? placeById(q.to) : placeById(q.from));
          goal = t || ow.cities.filter(c => ['city', 'town', 'village'].includes(c.kind) && !visitedAt[c.id] && landmass(c.region) === landmass(ow.regionAt(G.ox, G.oy)))
            .sort((a, b2) => Math.hypot(a.x - G.ox, a.y - G.oy) - Math.hypot(b2.x - G.ox, b2.y - G.oy))[0];
          if (!goal) break;
          goal.path = overPath(G.ox, G.oy, goal.x, goal.y) || [];
          goal.i = 0;
        }
        if (G.ox === goal.x && G.oy === goal.y || !goal.path.length) {
          visitedAt[goal.id] = dayNow();
          if (ow.placeAt(G.ox, G.oy)) { overEnter(); close(); }
          // Охота: побродить по глуши у города, пока звери выходят.
          const hunt = p.quests.find(q => q.type === 'kill' && !q.done);
          if (hunt && G.mode === 'over') { for (let k = 0; k < 3 && G.mode === 'over' && p.hp > p.maxHp * 0.6; k++) { G.oy += 1; enterWild(false); localFight(); G.oy -= 1; } }
          goal = null;
          continue;
        }
        // Шаг по пути.
        goal.i = goal.path.findIndex(i => i === ow.idx(G.ox, G.oy));
        const next = goal.path[goal.i + 1];
        if (next === undefined) { goal = null; continue; }
        overMove((next % ow.w) - G.ox, ((next / ow.w) | 0) - G.oy);
        close();
      }
      R.level = p.level; R.coins = p.coins; R.day = dayNow(); R.stuck = dayNow() < DAYS && p.hp > 0;
      if (p.hp <= 0) {
        R.died = true; R.cause = G.deathCause || '?'; R.where = REGIONS[ow.regionAt(G.ox, G.oy)].name;
        const w = G.world;
        R.scene = `${R.weapon}, ур. ${p.level}, ${isNight() ? 'ночь' : 'день'}, ${G.mode === 'local' ? (w.kind || '') : 'карта'}; рядом: `
          + (G.mode === 'local' ? w.actors.filter(a => a.kind === 'beast' && dist(a, p) <= 6).map(a => `${a.name} ${a.hp}/${a.maxHp}`).join(', ') : '—')
          + `; отваров ${p.potions}, сбегал ${R.fled}, боёв ${R.fights}, спал: ${p.asleep ? 'да' : 'нет'}`;
      }
      return R;
    }, DAYS).catch(e => ({ error: e.message.slice(0, 300) }));
    runs.push(r);
    process.stdout.write(r.error ? 'E' : r.died ? '†' : '.');
  }
  console.log('');
  const ok = runs.filter(r => !r.error), dead = ok.filter(r => r.died);
  const pct = (a, b2) => b2 ? Math.round(a / b2 * 100) + '%' : '—';
  console.log(`\nГероев ${ok.length}, за ${DAYS} дней погибли ${dead.length} (${pct(dead.length, ok.length)})`);
  const byDay = {}; for (const r of dead) byDay[r.day] = (byDay[r.day] || 0) + 1;
  console.log('День гибели:', Object.entries(byDay).map(([d, n]) => `${d}-й: ${n}`).join(', ') || '—');
  const by = (k) => { const g = {}; for (const r of ok) { const x = g[r[k]] = g[r[k]] || [0, 0]; x[0]++; if (r.died) x[1]++; } return Object.entries(g).sort((a, b2) => b2[1][0] - a[1][0]).map(([n, [a, d]]) => `${n} ${d}/${a}`).join(', '); };
  const causes = {}; for (const r of dead) causes[r.cause] = (causes[r.cause] || 0) + 1;
  console.log('Кто убил:', Object.entries(causes).sort((a, b2) => b2[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', ') || '—');
  console.log('Где:', Object.entries(dead.reduce((m, r) => (m[r.where] = (m[r.where] || 0) + 1, m), {})).map(([c, n]) => `${c} ${n}`).join(', ') || '—');
  console.log('По оружию (погибли/всего):', by('weapon'));
  console.log('По предыстории:', by('bg'));
  const stuck = ok.filter(r => r.stuck).length;
  if (stuck) console.log(`Бот застрял (не дожил до конца срока по времени): ${stuck}`);
  const avg = k => (ok.reduce((s, r) => s + r[k], 0) / ok.length).toFixed(1);
  console.log(`В среднем у выживших и погибших: уровень ${avg('level')}, монет ${avg('coins')}, боёв ${avg('fights')}, сбежал ${avg('fled')}, поручений ${avg('quests')}, отваров выпито ${avg('potionsUsed')}`);
  console.log('\nКак погибли (первые 12):\n  ' + dead.slice(0, 12).map(r => `${r.day}-й день, ${r.cause}: ${r.scene}`).join('\n  '));
  const bad = runs.filter(r => r.error);
  if (bad.length) console.log('Ошибки симуляции:', bad.slice(0, 3).map(r => r.error));
  if (errs.length) console.log('Ошибки страницы:', [...new Set(errs)].slice(0, 5));
  await b.close();
})();
