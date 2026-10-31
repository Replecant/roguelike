'use strict';

// ─── Путники на карте Италии ───────────────────────────────────────
// По дорогам идут паломники к святыням, крестьяне везут припасы на рынок,
// купеческие обозы тянутся от города к городу, бредут нищенствующие братья,
// скачут гонцы, под Парму идут имперские отряды. Разбойничьи шайки рыщут
// у дорог и нападают на путников — а заодно и на героя. С путником можно
// заговорить (Enter на его клетке): новости, торговля, молитва.

const TRAVELER_KINDS = {
  pilgrims: { name: 'Паломники', glyph: 'p', color: '#f0e4b8', count: 6, pace: 1.1, role: 'peasant', title: 'Паломник', portrait: 'pilgrim',
    greeting: 'Мир тебе, путник! Идём поклониться мощам. Господь даст — дойдём.' },
  peasants: { name: 'Крестьяне с повозкой', glyph: 'p', color: '#b8a070', count: 10, pace: 1.2, role: 'peasant', title: 'Крестьянин',
    greeting: 'Доброго дня. Везём на рынок что уродилось. Не надо ли чего? Отдадим дешевле, чем в городе.' },
  caravan: { name: 'Купеческий обоз', glyph: 'c', color: '#f0b040', count: 6, pace: 1.3, role: 'merchant', title: 'Купец', portrait: 'merchant',
    greeting: 'Тпру! Здравствуй, добрый человек. Товар везём — смотри, если есть деньги. Охрана у нас крепкая, так что без глупостей.' },
  friars: { name: 'Нищенствующие братья', glyph: 'f', color: '#a89070', count: 3, pace: 1.1, role: 'priest', title: 'Брат-францисканец', portrait: 'monk',
    greeting: 'Мир и благо! Мы братья святого Франциска — идём босыми от города к городу, проповедуем и просим хлеба.' },
  messenger: { name: 'Гонец', glyph: 'g', color: '#70b0f0', count: 2, pace: 0.45, role: 'guard', title: 'Гонец', portrait: 'guard',
    greeting: 'С дороги! …А, путник. Некогда мне, везу письма. Если коротко — спрашивай.' },
  soldiers: { name: 'Имперский отряд', glyph: 's', color: '#e0c050', count: 2, pace: 1.0, role: 'knight', title: 'Сержант', portrait: 'guard',
    greeting: 'Стой. Мы люди императора, идём под Парму. Дорогу не загораживай — и иди своей.' },
  brigands: { name: 'Шайка разбойников', glyph: 'b', color: '#ff5040', count: 4, pace: 1.0, hostile: true },
};

const PILGRIM_SHRINES = ['rome', 'bari', 'padua', 'venice'];
const PILGRIM_SHRINE_NAMES = ['Ассизи', 'Монте-Сант-Анджело', 'Монтекассино'];

const TRAVELER_LIFE = {
  pilgrims: ['Ноги стёрты в кровь, но до мощей осталось немного. Святой видит каждую мозоль.', 'Я дал обет: если сын выздоровеет — дойду пешком. Он выздоровел.',
    'В трактирах с паломников дерут втрое. Хорошо, что монастыри пускают даром.'],
  peasants: ['Цены на рынке нынче — грабёж. Но сидеть дома ещё хуже: подать-то платить надо.', 'Колесо скрипит третий день. Довезём — и смажем.',
    'Сеньор берёт треть, церковь — десятую, а что останется — нам. Немного.'],
  caravan: ['Пошлины на каждом мосту! До Генуи доедем — товар вдвое дороже станет.', 'Охрана берёт по солиду в день. Зато живы.',
    'Шёлк из Лукки, пряности из Венеции, соль из Червии — всё везём, всё продаём.'],
  friars: ['Брат Франциск учил: бедность — невеста, и мы ей верны.', 'Нас гонят из одних городов и зовут в другие. Так и ходим.',
    'Проповедуем птицам, когда люди не слушают. Птицы — слушают.'],
  messenger: ['Три коня загнал за неделю. Письма ждать не любят.', 'Что в письмах — не знаю. Меньше знаешь — дольше живёшь.'],
  soldiers: ['Парма держится — но ненадолго. Император поклялся.', 'Жалованье задерживают, а кормят бобами. Солдатское дело.'],
};

function travelerKm(a, b) { return Math.hypot((a.x - b.x) * GEO.kmX, (a.y - b.y) * GEO.kmY); }

// ─── Пути ──────────────────────────────────────────────────────────

// A* по карте Италии: дороги дешевле, бездорожье дороже.
function overPath(sx, sy, tx, ty) {
  const ow = G.over, W = ow.w, N = W * ow.h, goal = ty * W + tx;
  const g = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [], push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const h = i => Math.max(Math.abs(i % W - tx), Math.abs(((i / W) | 0) - ty)) * 0.5;
  const s = sy * W + sx;
  g[s] = 0; push(s, h(s));
  let steps = 0;
  while (heap.length && steps++ < 60000) {
    const [, i] = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === goal) break;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS8) {
      const X = x + dx, Y = y + dy;
      if (!ow.passable(X, Y)) continue;
      const j = Y * W + X;
      if (closed[j]) continue;
      const c = ow.road[j] >= 0 ? 0.5 : (ow.cost(X, Y) / 60);
      if (g[i] + c < g[j]) { g[j] = g[i] + c; prev[j] = i; push(j, g[j] + h(j)); }
    }
  }
  if (prev[goal] < 0) return null;
  const path = [];
  for (let i = goal; i >= 0; i = prev[i]) { path.unshift(i); if (i === s) break; }
  return path;
}

// ─── Появление ─────────────────────────────────────────────────────

function nearPlaces(kinds, cx, cy, maxD) {
  return G.over.cities.filter(c => kinds.includes(c.kind) && !c.razed && Math.max(Math.abs(c.x - cx), Math.abs(c.y - cy)) <= maxD);
}

function spawnTraveler(kind, cx, cy, midway) {
  const def = TRAVELER_KINDS[kind], ow = G.over, land = landmass(ow.regionAt(cx, cy));
  const same = c => landmass(c.region) === land;
  let from, to;
  if (kind === 'pilgrims') {
    from = rng.pick(nearPlaces(['city', 'town', 'village'], cx, cy, 60).filter(same));
    const shrines = G.over.cities.filter(c => same(c) && (PILGRIM_SHRINES.includes(c.id) || PILGRIM_SHRINE_NAMES.includes(c.name)) && c !== from);
    to = shrines.length && rng.pick(shrines);
  } else if (kind === 'peasants') {
    from = rng.pick(nearPlaces(['village'], cx, cy, 50).filter(same));
    const towns = from && nearPlaces(['town', 'city'], from.x, from.y, 30).filter(same);
    to = towns && towns.length && rng.pick(towns);
  } else if (kind === 'soldiers') {
    if (!parmaSiege()) return null;
    from = G.over.cities.find(c => c.id === rng.pick(['cremona', 'verona', 'pavia']));
    to = vittoriaPlace();
  } else if (kind === 'brigands') {
    const x = cx + rng.int(-40, 40), y = cy + rng.int(-25, 25);
    if (!ow.passable(x, y) || ow.placeAt(x, y) || nearSettlement(x, y)) return null;
    return { id: `tr${G.travelerN = (G.travelerN || 0) + 1}`, kind, x, y, path: [], i: 0, acc: 0, n: rng.int(3, 6) };
  } else {
    from = rng.pick(nearPlaces(['city', 'town'], cx, cy, 60).filter(same));
    const far = from && G.over.cities.filter(c => same(c) && ['city', 'town'].includes(c.kind) && c !== from
      && Math.hypot(c.x - from.x, c.y - from.y) > 15 && Math.hypot(c.x - from.x, c.y - from.y) < 90);
    to = far && far.length && rng.pick(far);
  }
  if (!from || !to || from === to) return null;
  const path = overPath(from.x, from.y, to.x, to.y);
  if (!path || path.length < 4) return null;
  const i = midway ? rng.int(1, path.length - 2) : 0, W = ow.w;
  const t = { id: `tr${G.travelerN = (G.travelerN || 0) + 1}`, kind, from: from.id, to: to.id, path, i, acc: 0,
    x: path[i] % W, y: (path[i] / W) | 0, n: kind === 'caravan' ? rng.int(3, 6) : rng.int(2, 5) };
  if (kind === 'peasants') t.goods = rng.shuffle(['grain', 'cheese', 'wine', 'oil']).slice(0, 2);
  return t;
}

// Поддерживать на дорогах нужное число путников (больше — рядом с героем).
function fillTravelers(midway) {
  G.travelers = G.travelers || [];
  for (const [kind, def] of Object.entries(TRAVELER_KINDS)) {
    let have = G.travelers.filter(t => t.kind === kind).length;
    for (let k = 0; k < (def.hostile ? 40 : 8) && have < def.count; k++) {
      const t = spawnTraveler(kind, G.ox, G.oy, midway);
      if (t) { G.travelers.push(t); have++; }
    }
  }
}

// ─── Движение ──────────────────────────────────────────────────────

function travelersTick(minutes) {
  if (!G.travelers || !G.over) return;
  const ow = G.over, W = ow.w;
  G.travelerClock = (G.travelerClock || 0) + minutes;
  for (const t of G.travelers.slice()) {
    const def = TRAVELER_KINDS[t.kind];
    if (def.hostile) { brigandsMove(t, minutes); continue; }
    t.acc += minutes / def.pace;
    while (t.i < t.path.length - 1) {
      const nx = t.path[t.i + 1] % W, ny = (t.path[t.i + 1] / W) | 0, c = ow.cost(nx, ny);
      if (t.acc < c) break;
      t.acc -= c; t.i++; t.x = nx; t.y = ny;
    }
    if (t.i >= t.path.length - 1) G.travelers = G.travelers.filter(x => x !== t);   // дошли
  }
  if (G.travelerClock >= 120) { G.travelerClock = 0; fillTravelers(false); }
}

// Разбойники бродят у дорог и подкрадываются к добыче.
function brigandsMove(b, minutes) {
  const ow = G.over, W = ow.w, p = G.player;
  b.acc += minutes;
  if (b.acc < 90) return;   // шайка движется рывками — раз в полтора часа
  b.acc = 0;
  // Цель: ближайший беззащитный путник или герой на карте Италии.
  const prey = G.travelers.filter(t => !TRAVELER_KINDS[t.kind].hostile && t.kind !== 'soldiers'
    && Math.max(Math.abs(t.x - b.x), Math.abs(t.y - b.y)) <= 6);
  const heroNear = G.mode === 'over' && !p.asleep && Math.max(Math.abs(G.ox - b.x), Math.abs(G.oy - b.y)) <= 5 && !nearSettlement(G.ox, G.oy)
    && !rng.chance(skillLevel(p, 'stealth') * 0.08);
  const goal = heroNear ? { x: G.ox, y: G.oy } : prey.length ? prey[0] : null;
  let nx = b.x, ny = b.y;
  if (goal) { nx += Math.sign(goal.x - b.x); ny += Math.sign(goal.y - b.y); }
  else { const [dx, dy] = rng.pick(DIRS8); nx += dx; ny += dy; }
  if (!ow.passable(nx, ny) || nearSettlement(nx, ny)) return;
  b.x = nx; b.y = ny;
  for (const t of prey) if (t.x === b.x && t.y === b.y) { ambushTraveler(b, t); return; }
  if (G.mode === 'over' && !p.asleep && b.x === G.ox && b.y === G.oy) brigandsAttackHero(b);
}

function ambushTraveler(b, t) {
  const ow = G.over, near = nearPlaces(['city', 'town', 'village'], t.x, t.y, 30)[0];
  const day = timeInfo().day;
  if (t.kind === 'caravan' && rng.chance(0.4)) {
    G.travelers = G.travelers.filter(x => x !== b);
    addNews({ day, text: 'Охрана купеческого обоза отбилась от разбойников на дороге. Несколько негодяев болтаются теперь на придорожном дубе.',
      x: t.x, y: t.y, tag: 'trade' });
    return;
  }
  G.travelers = G.travelers.filter(x => x !== t);
  if (t.kind === 'caravan' && near) createLead('caravan', { x: t.x, y: t.y, anchor: near });
  else addNews({ day, text: `На дороге${near ? ` близ ${near.name}` : ''} разбойники ограбили ${TRAVELER_KINDS[t.kind].name.toLowerCase()}. Говорят, никого не пощадили.`,
    x: t.x, y: t.y, tag: 'war' });
  if (G.mode === 'over' && Math.max(Math.abs(t.x - G.ox), Math.abs(t.y - G.oy)) <= 4)
    log(`Неподалёку крики и звон железа: разбойники напали на путников (${TRAVELER_KINDS[t.kind].name.toLowerCase()}).`, C.red);
}

function brigandsAttackHero(b) {
  G.travelers = G.travelers.filter(x => x !== b);
  log('Из-за кустов выходят люди с дубинами и ножами. «Кошелёк или жизнь!» — Шайка разбойников!', C.red);
  enterWild('brigand');
}

// ─── На карте ──────────────────────────────────────────────────────

function travelersAt(x, y) { return (G.travelers || []).filter(t => t.x === x && t.y === y); }

// Кого видно: днём — дальше, ночью — только рядом; разбойники прячутся.
function travelerVisible(t) {
  const d = Math.max(Math.abs(t.x - G.ox), Math.abs(t.y - G.oy)), night = isNight();
  if (TRAVELER_KINDS[t.kind].hostile) return d <= (night ? 1 : 3);
  return d <= (night ? 3 : 10);
}

function drawTravelers(t, cx, cy) {
  for (const tr of G.travelers || []) {
    if (!travelerVisible(tr)) continue;
    const sx = tr.x - cx, sy = tr.y - cy;
    if (sx < 0 || sy < 0 || sx >= MAP_W || sy >= MAP_H) continue;
    const def = TRAVELER_KINDS[tr.kind];
    t.put(sx, sy, def.glyph, def.color, def.hostile ? '#3a0c08' : null);
  }
}

function describeTravelers(x, y) {
  return travelersAt(x, y).filter(travelerVisible).map(t => {
    const def = TRAVELER_KINDS[t.kind], to = G.over.cities.find(c => c.id === t.to);
    return [`${def.name}${t.n ? ` (${t.n})` : ''}${to ? ` → ${placeTitle(to)}` : ''}`, def.hostile ? 'bad' : 'good'];
  });
}

// Шагнул на клетку с путниками.
function meetTravelers() {
  const ts = travelersAt(G.ox, G.oy).filter(t => !TRAVELER_KINDS[t.kind].hostile);
  if (ts.length) log(`Тебе навстречу: ${ts.map(t => TRAVELER_KINDS[t.kind].name.toLowerCase()).join(', ')}. Enter — заговорить.`, C.gold);
  const b = travelersAt(G.ox, G.oy).find(t => TRAVELER_KINDS[t.kind].hostile);
  if (b) { brigandsAttackHero(b); return true; }
  return false;
}

// ─── Разговор ──────────────────────────────────────────────────────

function travelerNpc(t) {
  const def = TRAVELER_KINDS[t.kind], ow = G.over, to = ow.cities.find(c => c.id === t.to);
  t.place = t.place || { id: t.id, name: 'в пути', kind: 'road', region: ow.regionAt(t.x, t.y), x: t.x, y: t.y, market: {} };
  t.place.x = t.x; t.place.y = t.y; t.place.region = ow.regionAt(t.x, t.y);
  const pool = namePool(t.place), female = t.kind === 'pilgrims' && rng.chance(0.3);
  t.who = t.who || { name: rng.pick(pool[female ? 'f' : 'm']), female };
  const npc = {
    kind: 'npc', role: def.role, special: 'traveler', traveler: t, village: { city: t.place, npcs: [] }, home: { x: 0, y: 0, w: 1, h: 1, building: -1 },
    x: G.ox, y: G.oy, name: t.who.name, title: t.who.female ? 'Паломница' : def.title, female: t.who.female, glyph: '@', color: def.color,
    greeting: def.greeting + (to ? ` Путь держим в ${placeAcc(to)}.` : ''), portrait: def.portrait || (t.who.female ? 'peasant_f1' : 'peasant_m1'),
  };
  if (t.kind === 'peasants') npc.deal = { rations: true, sells: t.goods || ['grain'], buys: [], trophies: 0 };
  return npc;
}

function travelerOptions(npc) {
  const p = G.player, t = npc.traveler, opts = [];
  opts.push({ label: 'Что слышно в дороге?', act: () => newsReply(npc) });
  opts.push({ label: 'Как дорога?', act: () => rng.pick(TRAVELER_LIFE[t.kind] || TRAVELER_LIFE.peasants) });
  if (t.kind === 'peasants') opts.push(tradeOption(npc, 'Купить припасов с повозки'));
  if (t.kind === 'caravan') opts.push(tradeOption(npc, 'Посмотреть товар обоза'));
  if (t.kind === 'pilgrims' && !p.is('saracen')) opts.push({ label: 'Помолиться вместе', act: () => {
    const day = timeInfo().day;
    if (p.prayedPilgrims === day) return 'Мы уже молились вместе сегодня. Иди с Богом.';
    p.prayedPilgrims = day;
    p.lastPractice = day;
    p.grace = Math.min(p.maxGrace, p.grace + Math.ceil(p.maxGrace / 2));
    return 'Вы встаёте на колени прямо у дороги и читаете «Отче наш». Паломники поют псалом — нестройно, но от души.';
  } });
  if (t.kind === 'friars' && !p.is('saracen')) opts.push({ label: 'Попросить благословения', act: () => {
    const week = Math.floor(timeInfo().day / 7);
    if (p.friarBlessed === week) return '«Мы уже благословили тебя, брат. Благословение не изнашивается».';
    p.friarBlessed = week;
    addPiety(1, 'Благословение странствующих братьев.');
    return 'Брат крестит тебя и делится коркой хлеба. «Мир тебе. Будь добр к тварям Божьим — и к людям тоже».';
  } });
  return opts;
}

// Enter на карте Италии: поговорить с путниками на этой клетке.
function talkToTravelers() {
  const ts = travelersAt(G.ox, G.oy).filter(t => !TRAVELER_KINDS[t.kind].hostile);
  if (!ts.length) return false;
  pushScreen(new DialogScreen(travelerNpc(ts[0])));
  return true;
}
