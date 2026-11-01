// Аудит генерации: проходимость (жители, двери, тайники), одинокие пашни, логика расположения сёл,
// особые места и дикая местность. Дополняет audit-cities.js (декор, мосты, дома) и audit-map.js (места на карте).
// Запуск: node tools/audit-gen.js [число миров]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + __dirname + '/../index.html');
  await pg.addScriptTag({ path: __dirname + '/../tests/helpers.js' });
  const N = +(process.argv[2] || 1);
  const out = await pg.evaluate(N => {
    const R = {}, stat = {};
    const add = (k, s) => { (R[k] = R[k] || { n: 0, ex: [] }).n++; if (R[k].ex.length < 8) R[k].ex.push(s); };
    const CROP = new Set([T.FIELD, T.VINEYARD, T.CROP, T.GRAPES, T.STUBBLE]);
    const DOORS = new Set([T.DOOR, T.HOUSEDOOR]);
    // Заливка проходимого от клетки (двери проходимы, вода — нет).
    const flood = (w, sx, sy) => {
      const seen = new Uint8Array(w.tiles.length), st = [w.idx(sx, sy)];
      seen[st[0]] = 1;
      while (st.length) {
        const j = st.pop(), x = j % w.w, y = (j / w.w) | 0;
        for (const [dx, dy] of DIRS8) {
          const nx = x + dx, ny = y + dy;
          if (!w.inside(nx, ny)) continue;
          const k = w.idx(nx, ny);
          if (seen[k] || !TILES[w.tiles[k]].walk) continue;
          seen[k] = 1; st.push(k);
        }
      }
      return seen;
    };
    const reachNear = (w, seen, x, y) => seen[w.idx(x, y)] || DIRS8.some(([dx, dy]) => w.inside(x + dx, y + dy) && seen[w.idx(x + dx, y + dy)]);

    for (let s = 1; s <= N; s++) {
      TH.start();
      const ow = G.over;
      // ── 1. Поселения ──
      for (const c of ow.cities) {
        delete G.cityMaps[c.id];
        const w = buildPlace('city:' + c.id);
        stat[c.kind] = (stat[c.kind] || 0) + 1;
        const v = w.villages[0];
        // Откуда входит герой: с четырёх сторон.
        const entries = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(d => cityEdgeSpot(w, d)).filter(Boolean);
        if (!entries.length) { add('нет входа в поселение', c.name); continue; }
        const seen = flood(w, entries[0][0], entries[0][1]);
        for (const e of entries.slice(1)) if (!seen[w.idx(e[0], e[1])]) add('вход с одной стороны не связан с другим', `${c.name} (${c.kind}) @${e}`);
        for (const n of v.npcs) if (!reachNear(w, seen, n.x, n.y)) add('житель недостижим', `${c.name} (${c.kind}): ${n.title} @${n.x},${n.y}`);
        // Двери: снаружи к каждой можно подойти.
        let doors = 0, bad = 0;
        for (let i = 0; i < w.tiles.length; i++) {
          if (!DOORS.has(w.tiles[i])) continue;
          doors++;
          const x = i % w.w, y = (i / w.w) | 0;
          // Дверь дома — сама непроходима (в дома не входят): к ней должно быть можно подойти вплотную.
          const ok = seen[i] || DIRS4.some(([dx, dy]) => w.inside(x + dx, y + dy) && seen[w.idx(x + dx, y + dy)]);
          if (!ok) { bad++; if (bad <= 2) add('к двери не подойти', `${c.name} (${c.kind}) @${x},${y}`); }
        }
        stat.doors = (stat.doors || 0) + doors;
        // Сундуки, колодцы, алтари у дороги — достижимы.
        for (let i = 0; i < w.tiles.length; i++) {
          if (![T.WELL, T.CHEST, T.ALTAR, T.SHRINE].includes(w.tiles[i])) continue;
          const x = i % w.w, y = (i / w.w) | 0;
          if (!reachNear(w, seen, x, y)) add('колодец/алтарь/сундук недостижим', `${c.name} (${c.kind}): ${TILES[w.tiles[i]].name} @${x},${y}`);
        }
        // Пашни: клочки и поля в отрыве от жилья.
        const cs = new Uint8Array(w.tiles.length);
        const roofs = [];
        for (let i = 0; i < w.tiles.length; i++) if (w.building[i] !== -1 && !TILES[w.tiles[i]].walk) roofs.push(i);
        for (let i = 0; i < w.tiles.length; i++) {
          if (cs[i] || !CROP.has(w.tiles[i]) || w.building[i] !== -1) continue;
          const st = [i], cells = []; cs[i] = 1;
          while (st.length) { const j = st.pop(); cells.push(j); const x = j % w.w, y = (j / w.w) | 0;
            for (const [dx, dy] of DIRS4) { const nx = x + dx, ny = y + dy; if (!w.inside(nx, ny)) continue; const k = w.idx(nx, ny);
              if (!cs[k] && CROP.has(w.tiles[k]) && w.building[k] === -1) { cs[k] = 1; st.push(k); } } }
          if (cells.length <= 3) add('клочок пашни (1–3 клетки)', `${c.name} (${c.kind}) @${cells[0] % w.w},${(cells[0] / w.w) | 0}: ${TILES[w.tiles[cells[0]]].name}`);
          else {
            const cx = cells.reduce((a, j) => a + j % w.w, 0) / cells.length, cy = cells.reduce((a, j) => a + ((j / w.w) | 0), 0) / cells.length;
            let near = Infinity;
            for (const j of roofs) { const d = Math.hypot(j % w.w - cx, (((j / w.w) | 0) - cy) * 2); if (d < near) near = d; }
            // У городов поля — пригородная округа за стенами, у краёв карты: так и должно быть.
            if (near > 40 && !['city', 'town'].includes(c.kind)) add('поле далеко от жилья', `${c.name} (${c.kind}): ${cells.length} кл. в ${Math.round(near)} кл. от домов`);
          }
        }
      }
      // ── 2. Карта мира: сёла и пашни ──
      const good = { village: [OT.PLAIN, OT.FIELD, OT.FOREST, OT.HILL] };
      const settled = ow.cities;
      for (const c of settled) {
        const t = c.terrain;
        if (c.kind === 'village' && !c.famous && !good.village.includes(t)) add('село на неподходящей местности', `${c.name}: ${OTILES[t].name}`);
        if (['village', 'castle', 'monastery', 'inn'].includes(c.kind)) {
          const linked = DIRS8.concat([[0, 0]]).some(([dx, dy]) => ow.inside(c.x + dx, c.y + dy)
            && (ow.road[ow.idx(c.x + dx, c.y + dy)] >= 0 || (ow.track && ow.track[ow.idx(c.x + dx, c.y + dy)])));
          if (!linked) add('к месту не ведёт ни дорога, ни проселок', `${c.name} (${c.kind})`);
        }
        for (const d of settled) {
          if (d === c || d.id < c.id) continue;
          const dd = Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y));
          if (dd <= 1 && c.kind !== 'city' && d.kind !== 'city') add('поселения вплотную', `${c.name} (${c.kind}) и ${d.name} (${d.kind})`);
        }
        if (c.kind === 'village' && ['sea', 'lake'].includes(OT_LOCAL[t])) add('село в воде', c.name);
      }
      // Пашни на карте мира — только при жилье.
      const fs = new Uint8Array(ow.tiles.length);
      for (let i = 0; i < ow.tiles.length; i++) {
        if (fs[i] || ow.tiles[i] !== OT.FIELD) continue;
        const st = [i], cells = []; fs[i] = 1;
        while (st.length) { const j = st.pop(); cells.push(j); const x = j % ow.w, y = (j / ow.w) | 0;
          for (const [dx, dy] of DIRS8) { const nx = x + dx, ny = y + dy; if (!ow.inside(nx, ny)) continue; const k = ow.idx(nx, ny);
            if (!fs[k] && ow.tiles[k] === OT.FIELD) { fs[k] = 1; st.push(k); } } }
        let near = Infinity;
        for (const j of cells) for (const c of settled) { const d = Math.max(Math.abs(c.x - j % ow.w), Math.abs(c.y - ((j / ow.w) | 0))); if (d < near) near = d; }
        if (near > 4) add('пашня на карте мира без жилья рядом', `${cells.length} кл. @${cells[0] % ow.w},${(cells[0] / ow.w) | 0}, до жилья ${near} кл. (${REGIONS[ow.regionAt(cells[0] % ow.w, (cells[0] / ow.w) | 0)].name})`);
      }
      // ── 3. Особые места и дикая местность ──
      const checkLocal = (w, label, x0, y0) => {
        const seen = flood(w, x0, y0);
        let walk = 0, reach = 0;
        for (let i = 0; i < w.tiles.length; i++) if (TILES[w.tiles[i]].walk && !SWIM_TILES.has(w.tiles[i])) { walk++; if (seen[i]) reach++; }
        if (reach < walk * 0.6) add('дикая карта: большая часть недостижима', `${label}: ${Math.round(reach / walk * 100)}%`);
        for (const a of w.actors) if (a.kind === 'npc' && !reachNear(w, seen, a.x, a.y)) add('на особом месте житель недостижим', `${label}: ${a.title || a.name}`);
        if (w.containers) for (const i of w.containers.keys()) if (!reachNear(w, seen, i % w.w, (i / w.w) | 0)) add('тайник недостижим', label);
        let edge = false;
        for (let x = 0; x < w.w && !edge; x++) edge = seen[w.idx(x, 0)] || seen[w.idx(x, w.h - 1)];
        for (let y = 0; y < w.h && !edge; y++) edge = seen[w.idx(0, y)] || seen[w.idx(w.w - 1, y)];
        if (!edge) add('с дикой карты не уйти через край', label);
      };
      for (const site of ow.sites.filter(s => !s.dungeon && !s.prison && s.type === 'site')) {
        const old = site.hidden; site.hidden = false;
        G.ox = site.x; G.oy = site.y; G.mode = 'over';
        enterSite(site);
        checkLocal(G.world, site.name, G.player.x, G.player.y);
        leaveLocal();
        site.hidden = old;
      }
      let wild = 0;
      for (let t = 0; t < 4000 && wild < 60; t++) {
        const x = rng.int(2, ow.w - 3), y = rng.int(2, ow.h - 3);
        if (!ow.passable(x, y) || ow.placeAt(x, y) || ow.get(x, y) === OT.RIVER) continue;
        G.ox = x; G.oy = y; G.mode = 'over';
        enterWild(false);
        checkLocal(G.world, `${OTILES[ow.get(x, y)].name} (${REGIONS[ow.regionAt(x, y)].name})`, G.player.x, G.player.y);
        leaveLocal();
        wild++;
      }
      stat.wild = (stat.wild || 0) + wild;
    }
    return { R, stat };
  }, N);
  console.log('Проверено:', JSON.stringify(out.stat));
  const keys = Object.keys(out.R);
  if (!keys.length) console.log('Замечаний нет.');
  for (const k of keys) console.log(`\n${k}: ${out.R[k].n}\n  ${out.R[k].ex.join('\n  ')}`);
  if (errs.length) console.log('ОШИБКИ', errs.slice(0, 5));
  await b.close();
})();
