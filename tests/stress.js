// Стресс-прогон генерации: npm run stress [число миров].
// Строит все поселения, все уровни подземелий, особые места, 250 клеток глуши
// и события из слухов; печатает найденные нарушения проходимости и расстановки.
const { chromium } = require('playwright');
const SEEDS = +(process.argv[2] || 3);
(async () => {
  const b = await chromium.launch();
  const all = {};
  for (let s = 0; s < SEEDS; s++) {
    const pg = await b.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
    await pg.addScriptTag({ path: require('path').resolve(__dirname, 'helpers.js') });
    const res = await pg.evaluate(() => {
      TH.start(); TH.immortal();
      const issues = {};
      const bad = (kind, where) => { (issues[kind] = issues[kind] || []).push(where); };
      // Проходимость от точки входа (8 направлений, как ходит игрок).
      function reach(w, sx, sy) {
        const seen = new Uint8Array(w.w * w.h), q = [w.idx(sx, sy)]; seen[q[0]] = 1;
        while (q.length) { const i = q.pop(), x = i % w.w, y = (i / w.w) | 0;
          for (const [dx, dy] of DIRS8) { const X = x + dx, Y = y + dy; if (!w.inside(X, Y)) continue; const j = w.idx(X, Y);
            if (!seen[j] && TILES[w.tiles[j]].walk) { seen[j] = 1; q.push(j); } } }
        return seen;
      }
      const nearReach = (w, seen, x, y) => DIRS8.some(([dx, dy]) => w.inside(x + dx, y + dy) && seen[w.idx(x + dx, y + dy)]);
      function check(w, label, sx, sy, opt = {}) {
        if (!TILES[w.get(sx, sy)].walk) { bad('вход в стене', label); return; }
        const seen = reach(w, sx, sy);
        const occ = new Map();
        for (const a of w.actors) {
          if (a === G.player) continue;
          const k = `${a.x},${a.y}`;
          if (occ.has(k)) bad('двое в одной клетке', `${label}: ${a.name} и ${occ.get(k)} @${k}`);
          occ.set(k, a.name);
          if (!w.inside(a.x, a.y) || !TILES[w.get(a.x, a.y)].walk) { bad('существо в стене/воде', `${label}: ${a.name} @${a.x},${a.y} на «${w.inside(a.x, a.y) ? TILES[w.get(a.x, a.y)].name : 'за картой'}»`); continue; }
          if (!seen[w.idx(a.x, a.y)] && !(a.kind === 'beast' && opt.beastsAnywhere)) bad(a.kind === 'beast' ? 'зверь недостижим' : 'житель недостижим', `${label}: ${a.name}${a.role ? ' (' + a.role + ')' : ''} @${a.x},${a.y}`);
        }
        if (w.containers) for (const [i, kind] of w.containers) { const x = i % w.w, y = (i / w.w) | 0;
          if (!nearReach(w, seen, x, y) && !(w.secrets && [...w.secrets].length) && kind !== 'vault' && kind !== 'secret') bad('сундук недоступен', `${label}: ${kind} @${x},${y}`); }
        for (const [k, list] of w.items) { const [x, y] = k.split(',').map(Number);
          if (!TILES[w.get(x, y)].walk) bad('предмет в стене', `${label}: ${list.map(i => i.name).join('/')} @${k}`);
          else if (!seen[w.idx(x, y)]) bad('предмет недостижим', `${label}: ${list.map(i => i.name).join('/')} @${k}`); }
        for (const t of opt.must || []) for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === t) {
          const x = i % w.w, y = (i / w.w) | 0;
          if (!(TILES[t].walk ? seen[i] : nearReach(w, seen, x, y))) bad(`недоступно: ${TILES[t].name}`, `${label} @${x},${y}`);
        }
        if (opt.edges) { let e = 0; for (let x = 0; x < w.w; x++) e += seen[w.idx(x, 0)] + seen[w.idx(x, w.h - 1)]; for (let y = 0; y < w.h; y++) e += seen[w.idx(0, y)] + seen[w.idx(w.w - 1, y)];
          if (!e) bad('не выйти за край', label); }
        // Большие отрезанные куски проходимой земли.
        if (opt.islands) { let lost = 0; for (let i = 0; i < w.tiles.length; i++) if (TILES[w.tiles[i]].walk && !seen[i] && w.tiles[i] !== T.WATER) lost++;
          const frac = lost / w.tiles.length; if (frac > opt.islands) bad('много отрезанной земли', `${label}: ${(frac * 100).toFixed(1)}%`); }
        return seen;
      }
      const stats = { places: 0, dungeonLevels: 0, sites: 0, wild: 0, leads: 0 };
      // 1. Поселения (города, сёла, замки, монастыри, трактиры, языческие сёла).
      for (const c of G.over.cities) {
        try {
          TH.go(c); const w = G.world, p = G.player;
          check(w, `${c.kind} ${c.name}`, p.x, p.y, { edges: true, must: [T.HOUSEDOOR, T.STAIRS_DOWN].filter(x => x !== undefined), islands: 0.02 });
          stats.places++;
        } catch (e) { bad('ошибка поселения', `${c.name}: ${e.message}`); }
      }
      // 2. Подземелья: все уровни.
      for (const site of G.over.sites.filter(s => s.dungeon)) {
        for (let d = 0; d < (site.depth || 1); d++) {
          try {
            const w = makeTombLevel(site, d);
            if (!w.up) { bad('нет лестницы вверх', `${site.type} ${site.name} ур.${d + 1}`); continue; }
            const seen = check(w, `${site.type} «${site.name}» ур.${d + 1}`, w.up[0], w.up[1], { must: [T.SARCOPHAGUS, T.URN, T.ORE, T.SHRINE, T.ALTAR, T.LOCKED] });
            if (w.down && !seen[w.idx(w.down[0], w.down[1])]) bad('лестница вниз недостижима', `${site.type} ${site.name} ур.${d + 1}`);
            if (d < site.depth - 1 && !w.down) bad('нет лестницы вниз', `${site.type} ${site.name} ур.${d + 1}/${site.depth}`);
            if (d === site.depth - 1 && !w.actors.some(a => a.bossOf === site.id) && !G.flags[`${site.id}_boss`]) bad('нет хозяина на дне', `${site.type} ${site.name}`);
            const near = w.actors.filter(a => a.kind === 'beast' && Math.max(Math.abs(a.x - w.up[0]), Math.abs(a.y - w.up[1])) < 3);
            if (near.length) bad('зверь у самой лестницы', `${site.type} ур.${d + 1}: ${near.map(a => a.name).join(',')}`);
            if (w.traps) for (const [i] of w.traps) if (!TILES[w.tiles[i]].walk) bad('ловушка в стене', `${site.type} @${i}`);
            stats.dungeonLevels++;
          } catch (e) { bad('ошибка подземелья', `${site.type} ${site.name} ур.${d + 1}: ${e.message}`); }
        }
      }
      // 3. Особые места (не подземелья).
      for (const site of G.over.sites.filter(s => !s.dungeon)) {
        try {
          if (G.mode === 'local') leaveLocal();
          G.ox = site.x; G.oy = site.y; enterSite(site);
          const w = G.world, p = G.player;
          check(w, `место «${site.name}»`, p.x, p.y, { edges: true, beastsAnywhere: true, islands: 0.1 });
          stats.sites++;
        } catch (e) { bad('ошибка места', `${site.name}: ${e.message}`); }
      }
      // 4. Дикая местность — сотни случайных клеток суши.
      const ow = G.over;
      for (let t = 0, n = 0; t < 3000 && n < 250; t++) {
        const x = rng.int(1, ow.w - 2), y = rng.int(1, ow.h - 2);
        if (!ow.passable(x, y) || ow.placeAt(x, y)) continue;
        n++;
        try {
          if (G.mode === 'local') leaveLocal();
          G.ox = x; G.oy = y; enterWild(false);
          const w = G.world, p = G.player;
          check(w, `глушь ${x},${y} (${ow.get(x, y)})`, p.x, p.y, { edges: true, beastsAnywhere: true, islands: 0.15 });
          stats.wild++;
        } catch (e) { bad('ошибка глуши', `${x},${y}: ${e.message}`); }
      }
      // 5. События из слухов — каждого вида по нескольку.
      G.leads = G.leads || [];
      for (const kind of Object.keys(LEAD_KINDS)) for (let k = 0; k < 4; k++) {
        try {
          const spot = findLeadSpot(kind); if (!spot) { bad('нет места для события', kind); continue; }
          const lead = createLead(kind, spot);
          if (G.mode === 'local') leaveLocal();
          const w = buildPlace(`lead:${lead.id}`);
          const [ex, ey] = entryPoint(w);
          check(w, `событие ${kind}`, ex, ey, { edges: true, beastsAnywhere: false, islands: 0.15 });
          stats.leads++;
        } catch (e) { bad('ошибка события', `${kind}: ${e.message}`); }
      }
      const out = {};
      for (const [k, v] of Object.entries(issues)) out[k] = { n: v.length, ex: v.slice(0, 6) };
      return { stats, out };
    }).catch(e => ({ fatal: e.message }));
    all[s] = { res, errs: errs.slice(0, 5) };
    console.log(JSON.stringify(all[s], null, 1));
    await pg.close();
  }
  await b.close();
})();
