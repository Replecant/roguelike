// Аудит карты Италии: мосты (дорога через реку) и логика расположения мест.
// Запуск: node tools/audit-map.js [число миров]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + __dirname + '/../index.html');
  const N = +(process.argv[2] || 3);
  const out = await pg.evaluate(N => {
    const R = {};
    const add = (k, s) => { (R[k] = R[k] || { n: 0, ex: [] }).n++; if (R[k].ex.length < 6) R[k].ex.push(s); };
    for (let seed = 1; seed <= N; seed++) {
      const ow = generateItaly(new RNG(seed * 9973));
      const T = i => ow.tiles[i], road = i => ow.road[i] >= 0;
      const W = ow.w;
      // Мосты.
      for (let i = 0; i < ow.tiles.length; i++) {
        const x = i % W, y = (i / W) | 0;
        if (road(i) && (T(i) === OT.SEA || T(i) === OT.LAKE)) add('дорога по воде', `${x},${y}`);
        if (!road(i) || T(i) !== OT.RIVER) continue;
        // Мост вдоль реки: соседние по дороге клетки — тоже река с дорогой, длинной цепью.
        let run = 0;
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          let n = 1;
          for (const s of [1, -1]) for (let k = 1; k < 6; k++) { const j = ow.idx(x + dx * k * s, y + dy * k * s); if (ow.inside(x + dx * k * s, y + dy * k * s) && road(j) && T(j) === OT.RIVER) n++; else break; }
          run = Math.max(run, n);
        }
        if (run >= 4) add('мост вдоль реки (дорога по руслу)', `${x},${y} длина ${run}`);
      }
      // Места.
      const places = [...ow.cities, ...ow.sites];
      const bad = { village: [OT.MOUNT, OT.PEAK, OT.MARSH, OT.LAKE, OT.SEA, OT.VOLCANO], castle: [OT.MARSH, OT.LAKE, OT.SEA, OT.PEAK],
        monastery: [OT.MARSH, OT.LAKE, OT.SEA, OT.PEAK, OT.VOLCANO], inn: [OT.MOUNT, OT.PEAK, OT.MARSH, OT.SEA, OT.LAKE], city: [OT.SEA, OT.LAKE, OT.PEAK], town: [OT.SEA, OT.LAKE, OT.PEAK] };
      for (const p of places) {
        const t = ow.get(p.x, p.y), nm = `${p.name} (${p.kind || p.type})`;
        if ((bad[p.kind] || []).includes(t)) add(`${p.kind} на неподходящей местности`, `${nm}: ${OTILES[t].name}`);
        if (p.kind === 'inn' && !road(ow.idx(p.x, p.y))) add('двор не у дороги', nm);
        if (p.kind === 'inn') {
          const c = ow.cities.find(c => ['city', 'town'].includes(c.kind) && Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) <= 3);
          if (c) add('двор под стенами города', `${nm} — у ${c.name}`);
        }
        if (p.dungeon) {
          if (road(ow.idx(p.x, p.y))) add('подземелье на дороге', nm);
          const c = ow.cities.find(c => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) <= 1);
          if (c) add('подземелье вплотную к поселению', `${nm} — у ${c.name}`);
          const def = DUNGEON_TYPES[p.type];
          if (def && def.place === 'coast' && !DIRS8.some(([dx, dy]) => ow.get(p.x + dx, p.y + dy) === OT.SEA)) add('приморский грот не у моря', nm);
          if (def && def.place === 'mountwild' && ![OT.HILL, OT.MOUNT, OT.PINE, OT.FOREST].includes(t)) add('горное подземелье на равнине', `${nm}: ${OTILES[t].name}`);
          if (t === OT.RIVER || t === OT.LAKE || t === OT.SEA) add('подземелье в воде', nm);
        }
      }
      // Тесное соседство.
      for (let a = 0; a < places.length; a++) for (let c = a + 1; c < places.length; c++) {
        const p = places[a], q = places[c];
        if (p.hidden || q.hidden) continue;
        const d = Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
        if (d <= 1 && !(p.tiles && p.tiles.length > 1) && !(q.tiles && q.tiles.length > 1)) add('места вплотную', `${p.name} и ${q.name}`);
      }
      // Знаменитые места далеко от своих настоящих координат.
      for (const f of FAMOUS_PLACES) {
        const p = ow.cities.find(c => c.name === f.name);
        if (!p) { add('знаменитое место пропало', f.name); continue; }
        const [fx, fy] = geoToXY(f.lon, f.lat);
        if (Math.hypot(p.x - fx, (p.y - fy)) > 4) add('знаменитое место сдвинуто', `${f.name}: на ${Math.round(Math.hypot(p.x - fx, p.y - fy))} кл.`);
      }
      for (const c of CITIES) {
        const p = ow.cities.find(x => x.id === c.id); if (!p) { add('город пропал', c.name); continue; }
        const [fx, fy] = geoToXY(c.lon, c.lat);
        if (Math.hypot(p.x - fx, p.y - fy) > 3) add('город сдвинут', `${c.name}: на ${Math.round(Math.hypot(p.x - fx, p.y - fy))} кл.`);
      }
      R.stats = R.stats || { places: 0 }; R.stats.places += places.length;
    }
    return R;
  }, N);
  console.log(JSON.stringify(out, null, 1), errs);
  await b.close();
})();
