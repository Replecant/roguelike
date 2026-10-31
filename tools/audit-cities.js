// Аудит генерации поселений: перегораживающие объекты, мосты, одинокие колонны, странные дома.
const { chromium } = require('playwright');
// Запуск: node tools/audit-cities.js [city,town | village,castle,monastery,inn]
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///home/user/roguelike/index.html');
  await pg.addScriptTag({ path: '/home/user/roguelike/tests/helpers.js' });
  const kinds = (process.argv[2] || 'city,town').split(',');
  const res = await pg.evaluate(kinds => {
    TH.start();
    const R = { choke: [], bridge: [], column: [], house: [], stats: { places: 0, houses: 0 } };
    const DECOR = new Set([T.WELL, T.COLUMN, T.STALL, T.FONT, T.TROUGH, T.HAY, T.CART, T.BARREL, T.CRATE, T.WAGON, T.BENCH, T.TABLE, T.ANVIL, T.SHRINE, T.TENT, T.CAMPFIRE, T.STONES, T.RUBBLE]);
    for (const c of G.over.cities.filter(c => kinds.includes(c.kind))) {
      delete G.cityMaps[c.id];
      const w = buildPlace('city:' + c.id); R.stats.places++;
      const P = cityPlan(c);
      // 1. Перегораживающие объекты снаружи построек.
      for (let i = 0; i < w.tiles.length; i++) {
        const t = w.tiles[i]; if (!DECOR.has(t) || TILES[t].walk) continue;
        if (w.building[i] !== -1) continue;
        const x = i % w.w, y = (i / w.w) | 0;
        const open = DIRS8.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, bb]) => w.walkable(a, bb));
        if (open.length < 2) continue;
        const seen = new Set([0]), st = [0];
        while (st.length) { const a = open[st.pop()]; open.forEach((q, j) => { if (!seen.has(j) && Math.max(Math.abs(a[0] - q[0]), Math.abs(a[1] - q[1])) === 1) { seen.add(j); st.push(j); } }); }
        if (seen.size !== open.length) R.choke.push(`${c.name}: ${TILES[t].name} @${x},${y}`);
      }
      // 2. Реки: берега связаны посуху?
      if (P.river) {
        const nBr = w.tiles.reduce((s, t) => s + (t === T.BRIDGE ? 1 : 0), 0);
        const comp = new Int32Array(w.tiles.length).fill(-1); const sizes = [];
        for (let i = 0; i < w.tiles.length; i++) {
          const x = i % w.w, y = (i / w.w) | 0;
          if (comp[i] >= 0 || !w.walkable(x, y) || SWIM_TILES.has(w.tiles[i])) continue;
          let n = 0; const st = [i]; comp[i] = sizes.length;
          while (st.length) { const j = st.pop(); n++; const jx = j % w.w, jy = (j / w.w) | 0;
            for (const [dx, dy] of DIRS8) { const nx = jx + dx, ny = jy + dy; if (!w.inside(nx, ny)) continue; const k = w.idx(nx, ny);
              if (comp[k] >= 0 || !w.walkable(nx, ny) || SWIM_TILES.has(w.tiles[k])) continue; comp[k] = sizes.length; st.push(k); } }
          sizes.push(n);
        }
        const big = sizes.filter(s => s > 300).length;
        const names = (P.river.bridges || []).map(br => br.name);
        const regs = w.buildings.filter(bb => names.includes(bb.name));
        const missing = regs.filter(bb => w.get(bb.x, bb.y) !== T.BRIDGE).map(bb => bb.name);
        if (big > 1 || missing.length || nBr === 0) R.bridge.push(`${c.name}: мостовых клеток ${nBr}, больших берегов ${big}${missing.length ? ', нет моста: ' + missing.join(', ') : ''}`);
      }
      // 3. Одинокие колонны вне построек.
      let lone = 0;
      for (let i = 0; i < w.tiles.length; i++) {
        if (w.tiles[i] !== T.COLUMN || w.building[i] !== -1) continue;
        const x = i % w.w, y = (i / w.w) | 0;
        if (!DIRS8.some(([dx, dy]) => [T.COLUMN, T.MARBLE, T.RUBBLE].includes(w.get(x + dx, y + dy)))) lone++;
      }
      if (lone) R.column.push(`${c.name}: ${lone}`);
      // 4б. Дома как пятна одной крыши.
      { const ROOF = new Set([T.HOUSE, T.HOUSE2, T.HOUSE3]); const seen = new Uint8Array(w.tiles.length);
        for (let i = 0; i < w.tiles.length; i++) {
          if (seen[i] || !ROOF.has(w.tiles[i])) continue;
          const t = w.tiles[i], st = [i]; seen[i] = 1; const cells = [];
          while (st.length) { const j = st.pop(); cells.push(j); const jx = j % w.w, jy = (j / w.w) | 0;
            for (const [dx, dy] of DIRS4) { const nx = jx + dx, ny = jy + dy; if (!w.inside(nx, ny)) continue; const k = w.idx(nx, ny);
              if (!seen[k] && (w.tiles[k] === t || (w.tiles[k] === T.HOUSEDOOR && w.tiles[j] !== T.HOUSEDOOR))) { seen[k] = 1; st.push(k); } } }
          const xs = cells.map(j => j % w.w), ys = cells.map(j => (j / w.w) | 0);
          const bw = Math.max(...xs) - Math.min(...xs) + 1, bh = Math.max(...ys) - Math.min(...ys) + 1;
          R.stats.houses++;
          const why = [];
          const n = cells.length;
          if (n <= 2) why.push(`крошечный: ${n} кл.`);
          if (cells.length / (bw * bh) < 0.6) why.push(`рваный: ${Math.round(cells.length / (bw * bh) * 100)}% рамки ${bw}×${bh}`);
          if (Math.min(bw, bh) === 1 && Math.max(bw, bh) >= 5) why.push(`полоса ${bw}×${bh}`);
          if (n > 40) why.push(`огромный ${bw}×${bh}`);
          if (why.length) R.house.push(`${c.name}: дом @${Math.min(...xs)},${Math.min(...ys)} — ${why.join('; ')}`);
        } }
      // 4. Дома: крошечные и странной формы.
      for (const bb of []) {
        if (bb.landmark || bb.w <= 1) continue;
        let cells = 0, inner = 0;
        for (let y = bb.y; y < bb.y + bb.h; y++) for (let x = bb.x; x < bb.x + bb.w; x++) {
          const i = w.idx(x, y); if (w.building[i] !== bb.id) continue; cells++;
          if (TILES[w.tiles[i]].walk) inner++;
        }
        R.stats.houses++;
        const fill = cells / (bb.w * bb.h);
        const why = [];
        if (Math.min(bb.w, bb.h) < 2) why.push('в одну клетку толщиной');
        if (cells && cells < 4) why.push(`всего ${cells} клеток`);
        if (fill < 0.6) why.push(`форма: заполнено ${Math.round(fill * 100)}% рамки`);
        if (Math.max(bb.w, bb.h) >= 4 * Math.min(bb.w, bb.h) && Math.min(bb.w, bb.h) <= 2) why.push(`вытянут ${bb.w}×${bb.h}`);
        if (why.length) R.house.push(`${c.name}: ${bb.name || bb.kind || 'дом'} ${bb.w}×${bb.h} @${bb.x},${bb.y} — ${why.join('; ')}`);
      }
    }
    return R;
  }, kinds);
  console.log(JSON.stringify({ stats: res.stats, choke: res.choke.length, bridge: res.bridge, column: res.column, house: res.house.length }, null, 1));
  console.log('--- перегораживает (первые 30):\n' + res.choke.slice(0, 30).join('\n'));
  const kinds2 = {}; for (const h of res.house) for (const k of ['крошечный', 'рваный', 'полоса', 'огромный']) if (h.includes(k)) kinds2[k] = (kinds2[k] || 0) + 1; console.log('виды:', kinds2); console.log('--- дома (первые 40):\n' + res.house.slice(0, 40).join('\n'));
  console.log(errs);
  await b.close();
})();
