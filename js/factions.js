'use strict';

// ─── Гвельфы и гибеллины ───────────────────────────────────────────
// Италия 1247 года расколота: гвельфы держат сторону папы, гибеллины —
// императора. Города северной и средней Италии выставляют отряды; отряды
// ходят от своих городов к вражеским, а встретившись — бьются. После
// стычки остаётся поле боя: мёртвые, брошенное оружие, вороньё и мародёры.
// Королевство Сицилия — владение императора, но своих партий там нет:
// отряды ходят только на севере и в середине Италии.

const FACTIONS = {
  guelf: { name: 'гвельфы', side: 'за папу', band: 'Отряд гвельфов', color: '#60a8ff',
    cities: ['genoa', 'milan', 'piacenza', 'brescia', 'parma', 'bologna', 'ferrara', 'lucca', 'florence', 'perugia', 'ancona', 'spoleto', 'viterbo', 'rome', 'benevento'] },
  ghib: { name: 'гибеллины', side: 'за императора', band: 'Отряд гибеллинов', color: '#f0c040',
    cities: ['cremona', 'pavia', 'verona', 'padua', 'trento', 'turin', 'pisa', 'siena', 'ravenna', 'rimini',
      'sulmona', 'capua', 'naples', 'salerno', 'lucera', 'foggia', 'bari', 'brindisi', 'taranto', 'cosenza', 'reggio',
      'messina', 'palermo', 'catania', 'syracuse', 'agrigento'] },
};
// Где ходят отряды: север и середина Италии.
const WAR_REGIONS = ['piedmont', 'lombardy', 'liguria', 'emilia', 'veneto', 'tuscany', 'papal'];

// 2 февраля 1248 года гибеллины с войском Фридриха Антиохийского изгнали гвельфов из Флоренции.
function cityFaction(c, day = timeInfo().day) {
  if (!c) return null;
  if (c.id === 'florence') return day >= dayOfDate(1248, 2, 2) ? 'ghib' : 'guelf';
  if (c.id === 'parma') return 'guelf';
  for (const [f, d] of Object.entries(FACTIONS)) if (d.cities.includes(c.id)) return f;
  return null;
}
const enemyOf = f => f === 'guelf' ? 'ghib' : 'guelf';

function factionLabel(c) {
  const f = cityFaction(c);
  return f ? `${FACTIONS[f].name} (${FACTIONS[f].side})` : '';
}

// Отряд: из своего города — к вражескому (набег) или к своему (на подмогу).
function spawnWarband(kind) {
  const f = kind === 'guelfs' ? 'guelf' : 'ghib', ow = G.over;
  const mine = ow.cities.filter(c => cityFaction(c) === f && WAR_REGIONS.includes(c.region) && Math.hypot(c.x - G.ox, c.y - G.oy) < 80);
  const from = rng.pick(mine);
  if (!from) return null;
  const foes = ow.cities.filter(c => ['city', 'town', 'village', 'castle'].includes(c.kind) && WAR_REGIONS.includes(c.region)
    && Math.hypot(c.x - from.x, c.y - from.y) > 10 && Math.hypot(c.x - from.x, c.y - from.y) < 60
    && (c.kind === 'village' || c.kind === 'castle' ? true : cityFaction(c) === enemyOf(f)));
  const friends = ow.cities.filter(c => cityFaction(c) === f && c !== from && Math.hypot(c.x - from.x, c.y - from.y) < 60);
  const to = rng.chance(0.65) && foes.length ? rng.pick(foes) : rng.pick(friends.length ? friends : foes);
  if (!to) return null;
  // Через вражеские города отряд не ходит и под их стенами не маячит — обходит полями; кроме того, на который идёт.
  const path = overPath(from.x, from.y, to.x, to.y, enemyGround(f, to));
  if (!path || path.length < 4) return null;
  const i = rng.int(0, path.length - 2), W = ow.w;
  return { id: `tr${G.travelerN = (G.travelerN || 0) + 1}`, kind, from: from.id, to: to.id, path, i, acc: 0,
    x: path[i] % W, y: (path[i] / W) | 0, n: rng.int(6, 14), faction: f };
}

// Маска для пути отряда: вражеские города и городки — не ступать (1), клетки вокруг — обходить (2).
// Город, на который отряд идёт, и всё рядом с ним — открыты.
function enemyGround(f, target) {
  const ow = G.over, m = new Uint8Array(ow.w * ow.h);
  for (const c of ow.cities) {
    if (c === target || !['city', 'town'].includes(c.kind) || cityFaction(c) !== enemyOf(f)) continue;
    for (const [tx, ty] of c.tiles || [[c.x, c.y]])
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (!ow.inside(tx + dx, ty + dy)) continue;
        const j = ow.idx(tx + dx, ty + dy);
        if (dx === 0 && dy === 0) m[j] = 1; else if (m[j] !== 1) m[j] = 2;
      }
  }
  return m;
}

// Встреча враждебных отрядов — бой. Раз в час игрового времени.
function warbandsClash() {
  // Большие стычки нечасты: между ними — затишье в несколько дней.
  const day = timeInfo().day;
  if (G.lastBattle && day - G.lastBattle < 12) return;
  const bands = (G.travelers || []).filter(t => t.faction || t.kind === 'soldiers');
  const side = t => t.faction || 'ghib';
  for (const a of bands) for (const b of bands) {
    if (a === b || side(a) === side(b) || !G.travelers.includes(a) || !G.travelers.includes(b)) continue;
    // Дозоры замечают врага за несколько миль — отряды сходятся (не всегда: иной командир уклоняется).
    const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    if (d > 6 || !rng.chance(d <= 1 ? 0.5 : 0.06)) continue;
    // Бой — посередине, на проходимой клетке.
    const mx = Math.round((a.x + b.x) / 2), my = Math.round((a.y + b.y) / 2);
    if (G.over.passable(mx, my)) { a.x = b.x = mx; a.y = b.y = my; }
    battle(a, b);
  }
}

function battle(a, b) {
  G.lastBattle = timeInfo().day;
  G.battles = (G.battles || 0) + 1;
  const sa = a.n * (0.7 + rng.next() * 0.6), sb = b.n * (0.7 + rng.next() * 0.6);
  const [win, lose] = sa >= sb ? [a, b] : [b, a];
  G.travelers = G.travelers.filter(t => t !== lose);
  const dead = rng.int(1, Math.max(1, Math.round(lose.n / 2)));
  win.n = Math.max(2, win.n - dead);
  const ow = G.over, anchor = nearPlaces(['city', 'town', 'village', 'castle'], lose.x, lose.y, 30)
    .sort((p, q) => Math.hypot(p.x - lose.x, p.y - lose.y) - Math.hypot(q.x - lose.x, q.y - lose.y))[0];
  const name = t => t.faction ? FACTIONS[t.faction].name : 'имперские латники';
  const from = t => { const c = ow.cities.find(x => x.id === t.from); return c ? ` из ${cityGen(c.name)}` : ''; };
  // Поле боя — где пал проигравший, а если там город или вода — на ближней свободной земле.
  let fx = lose.x, fy = lose.y;
  if (!ow.passable(fx, fy) || ow.placeAt(fx, fy) || activeLeadAt(fx, fy)) {
    const near = [];
    for (let r = 1; r <= 3 && !near.length; r++)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
        if (ow.passable(fx + dx, fy + dy) && !ow.placeAt(fx + dx, fy + dy) && !activeLeadAt(fx + dx, fy + dy)) near.push([fx + dx, fy + dy]);
    if (near.length) [fx, fy] = rng.pick(near); else fx = null;
  }
  if (anchor && fx !== null) {
    const lead = createLead('battlefield', { x: fx, y: fy, anchor });
    lead.until = timeInfo().day + 15;
    lead.winner = name(win); lead.loser = name(lose); lead.fallen = lose.n + dead;
    const n = G.news.find(x => x.lead === lead.id);
    if (n) n.text = `${whereText(anchor, fx, fy)} ${name(win)}${from(win)} сшиблись с ${lose.faction === 'guelf' ? 'гвельфами' : lose.faction === 'ghib' ? 'гибеллинами' : 'имперцами'}${from(lose)}. `
      + `Поле осталось за ${win.faction === 'guelf' ? 'гвельфами' : 'гибеллинами'}; мёртвых так и не убрали.`;
  }
  if (G.mode === 'over' && Math.max(Math.abs(lose.x - G.ox), Math.abs(lose.y - G.oy)) <= 4)
    log(`Неподалёку звон железа, крики и ржание: ${name(win)} бьются с ${lose.faction === 'guelf' ? 'гвельфами' : lose.faction === 'ghib' ? 'гибеллинами' : 'имперцами'}!`, C.red);
}

const WARBAND_TALK = {
  guelf: ['Император отлучён — значит, служить ему грех. Мы бьёмся за папу и за свободу наших коммун.',
    'Гибеллины жгут наши деревни именем кесаря. Пусть кесарь сам придёт — Парма ему уже показала.',
    'Нас благословил легат: кто падёт в бою с людьми императора, тому отпустятся грехи.'],
  ghib: ['Император — помазанник, а папа — генуэзский торгаш на престоле Петра. Мы бьёмся за порядок и за закон.',
    'Гвельфы — купчишки, им лишь бы не платить подати. Вот пусть и узнают, чего стоит империя.',
    'Нам платят серебром, а не отпущением грехов. За это серебро мы и стоим насмерть.'],
};
