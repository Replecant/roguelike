'use strict';

// ─── Путники на карте Италии ───────────────────────────────────────
// По дорогам идут паломники к святыням, крестьяне везут припасы на рынок,
// купеческие обозы тянутся от города к городу, бредут нищенствующие братья,
// скачут гонцы, под Парму идут имперские отряды. Разбойничьи шайки рыщут
// у дорог и нападают на путников — а заодно и на героя. С путником можно
// заговорить (Enter на его клетке): новости, торговля, молитва.

const TRAVELER_KINDS = {
  pilgrims: { name: 'Паломники', glyph: 'p', color: '#f0e4b8', count: 4, pace: 1.1, role: 'peasant', title: 'Паломник', portrait: 'pilgrim',
    greeting: 'Мир тебе, путник! Идём поклониться мощам. Господь даст — дойдём.' },
  peasants: { name: 'Крестьяне с повозкой', glyph: 'p', color: '#b8a070', count: 7, pace: 1.2, role: 'peasant', title: 'Крестьянин',
    greeting: 'Доброго дня. Везём на рынок что уродилось. Не надо ли чего? Отдадим дешевле, чем в городе.' },
  caravan: { name: 'Купеческий обоз', glyph: 'c', color: '#f0b040', count: 4, pace: 1.3, role: 'merchant', title: 'Купец', portrait: 'merchant',
    greeting: 'Здравствуй, добрый человек. Товар везём — смотри, если есть деньги. Охрана у нас крепкая, так что без глупостей.' },
  friars: { name: 'Нищенствующие братья', glyph: 'f', color: '#a89070', count: 3, pace: 1.1, role: 'priest', title: 'Брат-францисканец', portrait: 'monk',
    greeting: 'Мир и благо! Мы братья святого Франциска — идём босыми от города к городу, проповедуем и просим хлеба.' },
  messenger: { name: 'Гонец', glyph: 'g', color: '#70b0f0', count: 2, pace: 0.45, role: 'guard', title: 'Гонец', portrait: 'armed_sword',
    greeting: 'С дороги! …А, путник. Некогда мне, везу письма. Если коротко — спрашивай.' },
  soldiers: { name: 'Имперский отряд', glyph: 's', color: '#e0c050', count: 2, pace: 1.0, role: 'knight', title: 'Сержант', portraits: ['armed_vet', 'armed_lion'],
    greeting: 'Стой. Мы люди императора, идём под Парму. Дорогу не загораживай — и иди своей.' },
  guelfs: { name: 'Отряд гвельфов', glyph: 'W', color: '#60a8ff', count: 3, pace: 1.1, role: 'knight', title: 'Сержант гвельфов', portraits: ['armed_militia', 'armed_xbow'],
    greeting: 'Стой! Мы люди коммуны, за папу и за свободу. Ты не из имперских? Нет? Тогда проходи с миром.' },
  ghibs: { name: 'Отряд гибеллинов', glyph: 'W', color: '#f0c040', count: 3, pace: 1.1, role: 'knight', title: 'Сержант гибеллинов', portraits: ['armed_vet', 'armed_lion'],
    greeting: 'Именем императора — стой. Кто таков? Не гвельфский лазутчик? Ладно, иди своей дорогой, пока не передумали.' },
  brigands: { name: 'Шайка разбойников', glyph: 'b', color: '#ff5040', count: 4, pace: 1.0, hostile: true },
};

const PILGRIM_SHRINES = ['rome', 'bari', 'padua', 'venice'];
const PILGRIM_SHRINE_NAMES = ['Ассизи', 'Монте-Сант-Анджело', 'Монтекассино'];

const TRAVELER_LIFE = {
  pilgrims: ['Ноги стёрты в кровь, но до мощей осталось немного. Святой видит каждую мозоль.', 'Я {дал|дала} обет: если сын выздоровеет — дойду пешком. Он выздоровел.',
    'В трактирах с паломников дерут втрое. Хорошо, что монастыри пускают даром.'],
  peasants: ['Цены на рынке нынче — грабёж. Но сидеть дома ещё хуже: подать-то платить надо.', 'Колесо скрипит третий день. Лишь бы ось выдержала до города.',
    'Сеньор берёт треть, церковь — десятую, а что останется — нам. Немного.'],
  caravan: ['Пошлины на каждом мосту! До Генуи доедем — товар вдвое дороже станет.', 'Охрана берёт по солиду в день. Без неё на этой дороге не доехать.',
    'Шёлк из Лукки, пряности из Венеции, соль из Червии — всё везём, всё продаём.'],
  friars: ['Брат Франциск учил: бедность — невеста, и мы ей верны.', 'Нас гонят из одних городов и зовут в другие. Так и ходим.',
    'Проповедуем птицам, когда люди не слушают. Птицы — слушают.'],
  guelfs: ['Сапоги стоптаны, жалованья третий месяц нет, а коммуна всё шлёт и шлёт в поход.', 'Говорят, гибеллины рядом. Хорошо бы встретить их на открытом поле, а не в лесу.'],
  ghibs: ['Император платит исправно — не то что коммуны своим ополченцам.', 'Вчера сожгли гвельфскую мельницу. Мельник плакал. Война.'],
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
  } else if (kind === 'guelfs' || kind === 'ghibs') {
    return spawnWarband(kind);
  } else if (kind === 'brigands') {
    const x = cx + rng.int(-40, 40), y = cy + rng.int(-25, 25);
    if (!ow.passable(x, y) || ow.placeAt(x, y) || nearSettlement(x, y)) return null;
    const band = { id: `tr${G.travelerN = (G.travelerN || 0) + 1}`, kind, x, y, path: [], i: 0, acc: 0, n: rng.int(3, 6) };
    if (rng.chance(0.25) && eliteAllowed(x, y)) makeEliteBand(band);   // шайка с атаманом, за голову которого назначена награда
    return band;
  } else {
    from = rng.pick(nearPlaces(['city', 'town'], cx, cy, 60).filter(same));
    const far = from && G.over.cities.filter(c => same(c) && ['city', 'town'].includes(c.kind) && c !== from
      && Math.hypot(c.x - from.x, c.y - from.y) > 15 && Math.hypot(c.x - from.x, c.y - from.y) < 90
      && !(c.id === 'parma' && parmaSiege()));   // в осаждённую Парму обозы и паломники не идут
    to = far && far.length && rng.pick(far);
  }
  if (!from || !to || from === to) return null;
  const path = overPath(from.x, from.y, to.x, to.y);
  if (!path || path.length < 4) return null;
  // Новые путники «входят» в округу уже в дороге — где-то на пути, вне поля зрения героя
  // и не там, где уже стоит другая группа (иначе у ближней деревни скапливается толпа).
  const W = ow.w, busy = new Set((G.travelers || []).map(o => `${o.x},${o.y}`));
  let i = -1;
  for (let k = 0; k < 12 && i < 0; k++) {
    const j = rng.int(1, path.length - 2), x = path[j] % W, y = (path[j] / W) | 0;
    const far = Math.max(Math.abs(x - G.ox), Math.abs(y - G.oy)) > (midway ? 0 : 8);
    if (far && !busy.has(`${x},${y}`) && !ow.placeAt(x, y)) i = j;
  }
  if (i < 0) return null;
  const t = { id: `tr${G.travelerN = (G.travelerN || 0) + 1}`, kind, from: from.id, to: to.id, path, i, acc: 0,
    x: path[i] % W, y: (path[i] / W) | 0, n: kind === 'caravan' ? rng.int(3, 6) : rng.int(2, 5) };
  if (kind === 'peasants') t.goods = rng.shuffle(['grain', 'cheese', 'wine', 'oil']).slice(0, 2);
  return t;
}

// Сколько вокруг героя обжитой суши его острова или материка (1 — глубь Италии; Мальта — крохи).
// Путников — по земле: где земли мало, там и дорог мало.
const ROAD_KINDS = ['pilgrims', 'peasants', 'caravan', 'friars', 'messenger', 'brigands'];
function travelerDensity(cx, cy) {
  const ow = G.over, land = landmass(ow.regionAt(cx, cy));
  const key = `${cx >> 3},${cy >> 3}`;
  if (G.densityAt && G.densityAt.key === key) return G.densityAt.k;
  let n = 0;
  for (let y = cy - 30; y <= cy + 30; y++)
    for (let x = cx - 60; x <= cx + 60; x++)
      if (ow.inside(x, y) && ow.passable(x, y) && landmass(ow.regionAt(x, y)) === land) n++;
  const k = Math.max(0.1, Math.min(1, n / 4500));
  G.densityAt = { key, k };
  return k;
}

// Поддерживать на дорогах нужное число путников (рядом с героем, по плотности земли).
function fillTravelers(midway) {
  G.travelers = G.travelers || [];
  const dens = travelerDensity(G.ox, G.oy), land = landmass(G.over.regionAt(G.ox, G.oy));
  // Простые шайки далеко от героя рассеиваются (атаман со своей наградой — остаётся).
  G.travelers = G.travelers.filter(t => t.kind !== 'brigands' || t.elite || Math.max(Math.abs(t.x - G.ox), Math.abs(t.y - G.oy)) <= 150);
  for (const [kind, def] of Object.entries(TRAVELER_KINDS)) {
    const road = ROAD_KINDS.includes(kind);
    // Мирных путников считаем только поблизости и на той же земле — дальние своё дойдут сами.
    let have = G.travelers.filter(t => t.kind === kind && (!road || (Math.max(Math.abs(t.x - G.ox), Math.abs(t.y - G.oy)) <= 60
      && landmass(G.over.regionAt(t.x, t.y)) === land))).length;
    const want = Math.round((def.count + (kind === 'brigands' ? famineBrigands() : 0)) * (road ? dens : 1));
    for (let k = 0; k < (def.hostile ? 40 : 8) && have < want; k++) {
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
    if (t.escorted && escortOf(t)) continue;   // идут с героем
    t.acc += minutes / def.pace;
    while (t.i < t.path.length - 1) {
      const nx = t.path[t.i + 1] % W, ny = (t.path[t.i + 1] / W) | 0, c = ow.cost(nx, ny);
      if (t.acc < c) break;
      t.acc -= c; t.i++; t.x = nx; t.y = ny;
    }
    if (t.i >= t.path.length - 1) G.travelers = G.travelers.filter(x => x !== t);   // дошли
  }
  G.clashClock = (G.clashClock || 0) + minutes;
  if (G.clashClock >= 60) { G.clashClock = 0; warbandsClash(); }
  if (G.travelerClock >= 120) { G.travelerClock = 0; fillTravelers(false); }
}

// Разбойники бродят у дорог и подкрадываются к добыче.
function brigandsMove(b, minutes) {
  const ow = G.over, W = ow.w, p = G.player;
  b.acc += minutes;
  if (b.acc < 90) return;   // шайка движется рывками — раз в полтора часа
  b.acc = 0;
  // Цель: ближайший беззащитный путник или герой на карте Италии.
  const prey = G.travelers.filter(t => !TRAVELER_KINDS[t.kind].hostile && t.kind !== 'soldiers' && !t.faction && !escortOf(t)
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
  if (fameScaresBrigands(b)) {
    log(`Из-за кустов выходят люди с дубинами — и замирают. «Это же ${G.player.name}…» Шайка разбегается, не дожидаясь драки.`, C.gold);
    return;
  }
  const q = escortQuest();
  if (q && (G.travelers.find(t => t.id === q.traveler) || {}).waiting === false) G.escortFight = q.id;
  log(b.elite ? `Из-за кустов выходят люди с дубинами и ножами — шайка атамана ${b.elite.name}!` : 'Из-за кустов выходят люди с дубинами и ножами. «Кошелёк или жизнь!» — Шайка разбойников!', C.red);
  enterWild('brigand');
  spawnEliteLord(b);
}

// ─── На карте ──────────────────────────────────────────────────────

function travelersAt(x, y) { return (G.travelers || []).filter(t => t.x === x && t.y === y); }

// Кого видно: днём — дальше, ночью — только рядом; разбойники прячутся.
function travelerVisible(t) {
  const d = Math.max(Math.abs(t.x - G.ox), Math.abs(t.y - G.oy)), night = isNight();
  if (TRAVELER_KINDS[t.kind].hostile) return d <= (night ? 1 : 3);
  if (t.escorted && escortOf(t)) return true;
  return d <= (night ? 3 : 10);
}

function drawTravelers(t, cx, cy) {
  for (const tr of G.travelers || []) {
    if (!travelerVisible(tr)) continue;
    const sx = tr.x - cx, sy = tr.y - cy;
    if (sx < 0 || sy < 0 || sx >= MAP_W || sy >= MAP_H) continue;
    const def = TRAVELER_KINDS[tr.kind];
    t.put(sx, sy, def.glyph, def.color, def.hostile ? '#3a0c08' : PLATE);
    t.mark(sx, sy, 2);
  }
}

function describeTravelers(x, y) {
  return travelersAt(x, y).filter(travelerVisible).map(t => {
    const def = TRAVELER_KINDS[t.kind], to = G.over.cities.find(c => c.id === t.to);
    return [`${t.elite ? `Шайка атамана ${t.elite.name}` : def.name}${t.n ? ` (${t.n})` : ''}${to ? ` → ${placeTitle(to)}` : ''}${escortOf(t) ? ' · твои подопечные' : ''}`, def.hostile ? 'bad' : 'good'];
  });
}

// Путники рядом (на соседней клетке или на той же): с ними можно заговорить.
function travelersNear(withEscort = false, x = G.ox, y = G.oy) {
  return (G.travelers || []).filter(t => !TRAVELER_KINDS[t.kind].hostile && Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) <= 1
    && (withEscort || !(t.escorted && escortOf(t))));
}

// Встреча в пути: игру не останавливает — в журнале строка «Рядом: …», Enter — подойти.
// Первый разговор с группой начинается со сценки, а в ней — выборы, которые бывают раз на группу.
const MEET_SCENES = {
  pilgrims: ['По дороге бредут паломники с посохами и котомками, на плащах нашиты раковины и кресты. Старший поднимает руку в приветствии.',
    'У придорожного креста отдыхают паломники: кто перематывает обмотки, кто молится. Увидев тебя, они встают.'],
  peasants: ['Навстречу скрипит повозка, запряжённая волом. Крестьянин шагает рядом, жена сидит на мешках, мальчишка гонит хворостиной гусей.',
    'Мимо тянется воз, гружённый мешками. Крестьянин косится на тебя и придерживает вола — мало ли кто бродит по дорогам.'],
  caravan: ['Купеческий обоз тянется по дороге: мулы под тюками, впереди и позади — конные охранники с копьями. Один из них уже смотрит на тебя.',
    'Обоз встал на привал у ручья. Погонщики поят мулов, купец в добротном плаще пересчитывает тюки и окликает тебя.'],
  friars: ['Двое босых братьев в серых рясах, подпоясанных верёвкой, идут, напевая псалом. Завидев тебя, умолкают и улыбаются.'],
  messenger: ['Мимо галопом несётся всадник с сумкой на груди — и вдруг осаживает коня: дорогу хочет спросить или напоить лошадь.'],
  soldiers: ['Навстречу идёт колонна: арбалетчики, копейщики, впереди конный сержант с имперским орлом на щите. Тебя окликают: «Стой! Кто таков?»'],
  guelfs: ['Из-за поворота выходит отряд: пехота с павезами, несколько всадников, над ними знамя с ключами святого Петра. Сержант загораживает дорогу: «Стой! Кто таков и чей будешь?»'],
  ghibs: ['На дороге — отряд под знаменем с чёрным орлом. Всадники в стёганках, лучники, обоз с бочками. Сержант подъезжает к тебе: «Стой! Кто таков и чей будешь?»'],
};

const MEET_STUCK = 'Повозка с припасами застряла колесом в колее. Крестьянин ругается, вол равнодушно жуёт. Завидев тебя, мужик снимает шапку.';
const MEET_HUNGRY = {
  pilgrims: 'У придорожного креста сидят паломники — исхудавшие, в пыли. Котомки пусты: последний сухарь съели вчера. Старший с надеждой смотрит на тебя.',
  friars: 'Двое босых братьев в серых рясах сидят у обочины. Сегодня им не подали ни корки, но они всё равно улыбаются тебе.',
};

function meetTravelers() {
  const b = travelersAt(G.ox, G.oy).find(t => TRAVELER_KINDS[t.kind].hostile);
  if (b) { brigandsAttackHero(b); return true; }
  const ts = travelersNear();
  if (!ts.length) return false;
  const unseen = ts.filter(t => !t.noted);
  ts.forEach(t => { t.noted = true; });
  if (unseen.length) log(`Рядом: ${unseen.map(t => TRAVELER_KINDS[t.kind].name.toLowerCase()).join(', ')}. Enter — заговорить.`, C.gold);
  return false;
}

// ─── Разговор ──────────────────────────────────────────────────────

// Нрав группы — бросается один раз: не каждому нужна помощь и не каждый
// станет продавать с воза то, что везёт в город за хорошую цену.
function travelerTraits(t) {
  if (!t.traits) t.traits = {
    trades: t.kind === 'peasants' ? rng.chance(0.35) : t.kind === 'caravan' ? rng.chance(0.7) : false,
    stuck: t.kind === 'peasants' && rng.chance(0.2),
    hungry: (t.kind === 'pilgrims' && rng.chance(0.35)) || (t.kind === 'friars' && rng.chance(0.5)),
  };
  return t.traits;
}

function travelerNpc(t) {
  const def = TRAVELER_KINDS[t.kind], ow = G.over, to = ow.cities.find(c => c.id === t.to);
  t.place = t.place || { id: t.id, name: 'в пути', kind: 'road', region: ow.regionAt(t.x, t.y), x: t.x, y: t.y, market: {} };
  t.place.x = t.x; t.place.y = t.y; t.place.region = ow.regionAt(t.x, t.y);
  const pool = namePool(t.place), female = t.kind === 'pilgrims' && rng.chance(0.3);
  t.who = t.who || { name: rng.pick(pool[female ? 'f' : 'm']), female };
  const npc = {
    kind: 'npc', role: def.role, special: 'traveler', traveler: t, village: { city: t.place, npcs: [] }, home: { x: 0, y: 0, w: 1, h: 1, building: -1 },
    x: G.ox, y: G.oy, name: t.who.name, title: t.who.female ? 'Паломница' : def.title, female: t.who.female, glyph: '@', color: def.color,
    greeting: def.greeting + (to ? ` Путь держим в ${placeAcc(to)}.` : ''), portrait: def.portrait || (def.portraits && def.portraits[[...t.id].reduce((h, c) => h + c.charCodeAt(0), 0) % def.portraits.length]) || (t.who.female ? 'peasant_f1' : 'peasant_m1'),
  };
  if (t.kind === 'peasants') npc.deal = { rations: true, sells: t.goods || ['grain'], buys: [], trophies: 0 };
  return npc;
}

function travelerOptions(npc) {
  const p = G.player, t = npc.traveler, opts = [];
  opts.push({ label: 'Что слышно в дороге?', act: () => newsReply(npc) });
  opts.push({ label: 'Как дорога?', act: () => rng.pick(TRAVELER_LIFE[t.kind] || TRAVELER_LIFE.peasants) });
  if (t.faction) opts.push({ label: 'За кого воюете?', act: () => {
    const to = G.over.cities.find(c => c.id === t.to), foe = to && cityFaction(to) === enemyOf(t.faction);
    return `«${rng.pick(WARBAND_TALK[t.faction])}»${to ? ` Идём ${foe ? 'на' : 'в'} ${placeAcc(to)}${foe ? ' — проучить их как следует' : ''}.` : ''}`;
  } });
  const tr = travelerTraits(t);
  if (t.kind === 'peasants' || t.kind === 'caravan') {
    if (tr.trades) opts.push(tradeOption(npc, t.kind === 'peasants' ? 'Купить припасов с повозки' : 'Посмотреть товар обоза'));
    else if (!t.refusedTrade) opts.push({ label: t.kind === 'peasants' ? 'Продадите что-нибудь с воза?' : 'Можно взглянуть на товар?', act: () => {
      t.refusedTrade = true;
      return t.kind === 'peasants'
        ? rng.pick(['«Не, добрый человек. Всё сочтено — в городе на рынке дадут больше, а подать платить надо».',
          '«Это не на продажу. Мельнику должны, остальное — на рынок. Не обессудь».'])
        : rng.pick(['«Товар заказан и оплачен вперёд — ни тюка не отдам. Ищи лавки в городе».',
          '«На дороге не торгуем: распакуй тюк — и до вечера не соберёшь. Приходи на рынок».']);
    } });
  }
  opts.push(...escortOption(npc));
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
    if (p.friarBlessed === week) return '«Мы уже благословили тебя, брат. Иди с миром и неси его другим».';
    p.friarBlessed = week;
    addPiety(1, 'Благословение странствующих братьев.');
    return 'Брат крестит тебя и делится коркой хлеба. «Мир тебе. Будь добр к тварям Божьим — и к людям тоже».';
  } });
  opts.push(...meetingChoices(npc));
  opts.push({ label: 'Пройти мимо', act: () => null });
  return opts;
}

// Enter на карте Италии: поговорить с путниками на этой клетке.
function talkToTravelers() {
  const ts = travelersNear(true);
  if (!ts.length) return false;
  talkToTraveler(ts.find(x => !x.met) || ts[0]);
  return true;
}

function talkToTraveler(t) {
  const npc = travelerNpc(t);
  if (!t.met) {
    t.met = true;
    const tr = travelerTraits(t), sc = MEET_SCENES[t.kind] || MEET_SCENES.peasants;
    const scene = tr.stuck ? MEET_STUCK : tr.hungry ? MEET_HUNGRY[t.kind] : rng.pick(sc);
    npc.greeting = t.faction || t.kind === 'soldiers' ? scene : `${scene}\n\n«${npc.greeting}»`;
    npc.meeting = true;
  }
  pushScreen(new DialogScreen(npc));
}

// Выборы, которые бывают только при встрече (раз на группу).
function meetingChoices(npc) {
  const p = G.player, t = npc.traveler, opts = [];
  if (t.helped) return opts;
  const done = text => { t.helped = true; return text; };
  const tr = travelerTraits(t);
  if (tr.hungry) opts.push({ label: 'Поделиться провиантом', act: () => {
    if (p.rations < 1) return 'Котомка пуста — делиться нечем.';
    p.rations--;
    addPiety(1, 'Накормил странников в пути.');
    return done('Ты отдаёшь сухари и кусок сыра. Старший паломник ломает хлеб на всех и благословляет тебя: «Кто накормил странника — накормил Христа».');
  } });
  if (tr.stuck) opts.push({ label: 'Помочь с повозкой', act: () => {
    passTime(30);
    p.fatigue = Math.min(100, p.fatigue + 6);
    trainSkill(p, 'athletics', 3);
    const tip = rng.chance(0.5);
    if (tip) p.rations++;
    return done(`Вы вдвоём наваливаетесь на колесо — раз, два! — и повозка выползает из колеи. ${tip ? 'Крестьянин суёт тебе ковригу хлеба: «Бери, бери, от чистого сердца».' : 'Крестьянин долго трясёт тебе руку и зовёт в гости, если будешь в их деревне.'}`);
  } });
  if (t.faction || t.kind === 'soldiers') {
    const side = t.faction || 'ghib';
    // Потребовали пошлину: платить или нет — решает герой. Отказ — драка.
    if (t.demand) {
      const toll = t.demand;
      if (p.coins >= toll) opts.push({ label: `Заплатить пошлину (${coins(toll)})`, act: () => {
        p.coins -= toll; t.demand = 0; npc.noEscape = false;
        return done(`Ты отсчитываешь ${coins(toll)}. Сержант ссыпает их в кошель, не глядя: «Ступай. И молись, чтобы мы больше не встретились».`);
      } });
      else opts.push({ label: 'Вывернуть кошелёк: «Это всё, что есть»', act: () => {
        const all = p.coins; p.coins = 0; t.demand = 0; npc.noEscape = false;
        return done(all ? `Сержант забирает последние ${coins(all)} и сплёвывает: «Голодранец. Проваливай».`
          : 'Сержант трясёт пустой кошелёк, хмыкает и отвешивает тебе затрещину: «Проваливай, голодранец».');
      } });
      opts.push({ label: '«Ничего вы от меня не получите»', act: () => {
        t.demand = 0; npc.noEscape = false; t.helped = true;
        warbandFight(t);
        return null;
      } });
      return opts;
    }
    const answer = (mine, label) => ({ label, act: () => {
      if (mine === side) {
        // Своему — дорогу; к костру зовут редко, и это стоит времени.
        if (rng.chance(0.25)) {
          passTime(60);
          p.food = Math.min(100, p.food + 15);
          return done('Сержант кивает: «Свой. Как раз варим похлёбку — садись». Ты съедаешь миску бобов у костра, слушаешь, где стоит неприятель, и через час идёшь дальше.');
        }
        return done(rng.pick([
          'Сержант кивает: «Свой. Проходи — и держись подальше от реки, там их разъезды».',
          '«Ну, раз свой — иди с Богом. Нам стоять некогда». Отряд трогается дальше.',
          'Сержант смотрит на тебя ещё мгновение и отводит копьё: «Проходи. Увидишь их людей — дай знать в ближнем городе».',
        ]));
      }
      if (mine) {
        t.demand = rng.int(5, 15);
        npc.noEscape = true;
        return `Сержант щурится: «Вот как». Солдаты обступают тебя, кто-то кладёт руку на меч. «За проход по нашей земле — пошлина. ${coins(t.demand)[0].toUpperCase() + coins(t.demand).slice(1)}. Или хочешь поспорить?»`;
      }
      if (skillLevel(p, 'speech') >= 2 || rng.chance(0.6)) return done('«Путник, значит. Ну, иди. Только по сторонам не болтай, что нас видел».');
      return done('«Ни за кого? Так не бывает». Тебя обыскивают, ничего подозрительного не находят и отпускают с пинком.');
    } });
    opts.push(answer('guelf', '«Я за папу»'), answer('ghib', '«Я за императора»'), answer(null, '«Я просто путник»'));
  }
  return opts;
}

// Герой отказался платить: отряд берётся за оружие. Отряд после стычки рассеивается.
function warbandFight(t) {
  G.travelers = G.travelers.filter(x => x !== t);
  const key = t.faction === 'guelf' ? 'guelf_militia' : 'imperial_soldier';
  log(`«Ну, сам выбрал». Солдаты обнажают оружие — ${t.faction === 'guelf' ? 'гвельфы' : 'гибеллины'} идут на тебя!`, C.red);
  if (G.mode === 'local') leaveLocal();
  enterWild(key);
}

// ─── Охрана и сопровождение ────────────────────────────────────────
// Купец нанимает охрану до города, паломники просят довести до святыни.
// Подопечные идут вместе с героем (если он рядом); в пути на них чаще
// нападают разбойники. Отбился — идёте дальше; бросил бой — их ограбят.

function escortQuest() { return G.player.quests.find(q => q.type === 'escort'); }
function escortOf(t) { const q = escortQuest(); return q && q.traveler === t.id ? q : null; }

function escortOption(npc) {
  const p = G.player, t = npc.traveler, to = G.over.cities.find(c => c.id === t.to);
  if (!to || !['caravan', 'pilgrims'].includes(t.kind)) return [];
  const q = escortOf(t);
  if (q) return [{ label: 'Идём дальше', act: () => `«Держись рядом. До ${cityGen(to.name)} ещё ${Math.round(travelerKm(t, to))} км».` }];
  if (escortQuest()) return [];
  const km = travelerKm(t, to), caravan = t.kind === 'caravan';
  // Не всем нужна защита: у богатого обоза своя стража, паломники часто идут большой толпой.
  // Решается один раз для каждой группы.
  if (t.needsGuard === undefined) t.needsGuard = km > 40 && rng.chance(caravan ? (t.n >= 5 ? 0.15 : 0.35) : 0.3);
  if (!t.needsGuard) return [{ label: caravan ? 'Не нужна ли вам охрана?' : 'Не проводить ли вас?', act: () => caravan
    ? rng.pick(['«Спасибо, у нас свои люди — видишь арбалетчиков на повозках? Им я уже заплатил».',
      '«Охрана? Дорога тут спокойная, да и ехать недалеко. Не нужно».', '«Мы едем с соседним обозом, вместе нас не тронут. Ступай с Богом».'])
    : rng.pick(['«Благодарствуй, добрый человек, но с нами идёт брат-монах, а с ним и Господь. Дойдём».',
      '«Нас много, да и брать с паломников нечего. Иди своей дорогой».']) }];
  const reward = caravan ? questPay(30 + km * 0.8) : questPay(8 + km * 0.15);
  return [{ label: caravan ? `Наняться в охрану до ${cityGen(to.name)} (${coins(reward)})` : `Проводить паломников до ${cityGen(to.name)}`, act: () => {
    if (p.quests.length >= MAX_QUESTS) return 'У тебя и так дел по горло.';
    p.quests.push({ id: `esc${G.turn}_${rng.int(0, 1e6)}`, type: 'escort', traveler: t.id, kind: t.kind, to: to.id, toName: to.name,
      reward, xp: Math.round(10 + km / 3), label: caravan ? `Охрана обоза до ${cityGen(to.name)}` : `Паломники до ${cityGen(to.name)}`,
      fromName: 'в пути', giverName: `${npc.title} ${npc.name}`, day: timeInfo().day, deadline: timeInfo().day + Math.ceil(km / 25) + 6, done: false,
      text: caravan ? `Охранять обоз купца ${npc.name} до ${cityGen(to.name)}. Плата — ${coins(reward)} по прибытии. Держаться рядом: на обозы нападают.`
        : `Довести паломников до ${cityGen(to.name)}. Платят они немного — зато за таких проводников молятся. Держаться рядом.` });
    t.escorted = true;
    log(`Новое задание: ${caravan ? 'охрана обоза' : 'сопровождение паломников'} до ${cityGen(to.name)}. Иди — они последуют за тобой.`, C.gold);
    return caravan ? `«По рукам! Плачу по прибытии, ${coins(reward)}. Только не отставай — и смотри в оба: в этих местах шалят».`
      : '«Спаси тебя Господь! С тобой и дорога короче. Мы небогаты, но за тебя помолятся у самых мощей».';
  } }];
}

// В пути: подопечные идут за героем; засады; прибытие.
function escortStep() {
  const q = escortQuest();
  if (!q) return;
  const t = (G.travelers || []).find(x => x.id === q.traveler);
  if (!t) return;
  if (Math.max(Math.abs(t.x - G.ox), Math.abs(t.y - G.oy)) <= 3) { t.x = G.ox; t.y = G.oy; t.waiting = false; }
  else if (!t.waiting) { t.waiting = true; log('Подопечные отстали и ждут тебя позади. Вернись к ним.', C.orange); }
  if (t.waiting || nearSettlement(G.ox, G.oy)) return;
  if (rng.chance(t.kind === 'caravan' ? 0.035 : 0.02)) {
    log(t.kind === 'caravan' ? 'Из оврага вылетают разбойники и бросаются к повозкам! Защищай обоз!'
      : 'Из кустов выходят разбойники: паломники — лёгкая добыча. Защищай их!', C.red);
    G.escortFight = q.id;
    enterWild('brigand');
    placeGroup('brigand', G.player.x + 5, G.player.y);
    for (const a of G.world.actors) if (a.kind === 'beast' && a.key === 'brigand') { a.provoked = true; a.target = [G.player.x, G.player.y]; }
  }
}

// Ушёл с поля боя: если разбойники живы — подопечных ограбили.
function escortFightEnd(world) {
  if (!G.escortFight) return;
  const q = G.player.quests.find(x => x.id === G.escortFight);
  G.escortFight = null;
  if (!q) return;
  if (world.actors.some(a => a.kind === 'beast' && a.key === 'brigand' && !a.dead)) {
    G.player.quests = G.player.quests.filter(x => x !== q);
    G.travelers = G.travelers.filter(x => x.id !== q.traveler);
    faithDeed('refuse');
    addFame(-3);
    log(q.kind === 'caravan' ? 'Ты бросил обоз. Разбойники забрали всё, купец проклинает тебя. Задание провалено.'
      : 'Ты бросил паломников. Их ограбили и избили. Задание провалено.', C.red);
    chronicle(`Не уберёг ${q.kind === 'caravan' ? 'обоз' : 'паломников'} от разбойников.`, 'event');
  } else log('Разбойники перебиты. Подопечные целы — можно идти дальше.', C.gold);
}

// Дошли до города назначения.
function escortArrive(city) {
  const q = escortQuest(), p = G.player;
  if (!q || q.to !== city.id) return;
  const t = (G.travelers || []).find(x => x.id === q.traveler);
  if (!t || t.waiting) { log('Подопечные отстали в пути — без них награды не будет. Вернись за ними.', C.orange); return; }
  p.quests = p.quests.filter(x => x !== q);
  G.travelers = G.travelers.filter(x => x !== t);
  p.coins += q.reward;
  p.gainXp(q.xp);
  if (q.kind === 'pilgrims') { addPiety(3, 'Ты довёл паломников до святыни.'); p.grace = p.maxGrace; }
  faithDeed('quest', { q, place: city });
  addFame(2, q.kind === 'caravan' ? `довёл обоз до ${cityGen(city.name)}` : `проводил паломников до ${cityGen(city.name)}`);
  log(`${q.kind === 'caravan' ? 'Обоз благополучно дошёл' : 'Паломники дошли'} до ${cityGen(city.name)}. Получено: ${coins(q.reward)}, ${q.xp} опыта.`, C.gold);
  chronicle(q.kind === 'caravan' ? `Довёл купеческий обоз до ${cityGen(city.name)}.` : `Проводил паломников до ${cityGen(city.name)}.`, 'quest');
}

// ─── Атаманы с наградой за голову ──────────────────────────────────

const BANDIT_LORDS = ['Гвидо Железный Зуб', 'Беппо Одноглазый', 'Рыжий Ланфранко', 'Чекко Висельник', 'Маттео по прозвищу Волк',
  'Бонифачо Безухий', 'Кривой Ринальдо', 'Нери Палач'];

// Атаман с наградой за голову — событие, а не обычай: на всю Италию не больше двух,
// рядом друг с другом — не бывает, новый — не чаще раза в три недели.
function eliteAllowed(x, y) {
  const alive = (G.travelers || []).filter(t => t.elite);
  if (alive.length >= 2) return false;
  if (alive.some(t => Math.hypot(t.x - x, (t.y - y) * 2) < 80 * MAP_SCALE)) return false;
  return G.eliteDay == null || timeInfo().day - G.eliteDay >= 21;
}

function makeEliteBand(t) {
  G.eliteDay = timeInfo().day;
  const used = new Set((G.travelers || []).filter(x => x.elite).map(x => x.elite.name));
  const name = rng.pick(BANDIT_LORDS.filter(n => !used.has(n))) || 'Безымянный';
  t.elite = { name, bounty: rng.int(120, 220), id: `head${G.travelerN}` };
  t.n += 2;
  const near = nearPlaces(['city', 'town'], t.x, t.y, 40)[0];
  if (near) addNews({ day: timeInfo().day, text: `${placeTitle(near)[0].toUpperCase() + placeTitle(near).slice(1)} обещает ${coins(t.elite.bounty)} за голову атамана ${name}: его шайка грабит путников в округе.`,
    x: near.x, y: near.y, tag: 'war' });
}

// Шайка с атаманом вышла на героя — атаман в бою.
function spawnEliteLord(b) {
  if (!b.elite) return;
  const w = G.world, p = G.player;
  const spot = DIRS8.map(([dx, dy]) => [p.x + dx * 4, p.y + dy * 4]).find(([x, y]) => w.free(x, y));
  if (!spot) return;
  const m = makeBeast('bandit_lord', spot[0], spot[1]);
  m.name = `Атаман ${b.elite.name}`;
  m.bounty = b.elite;
  m.provoked = true; m.target = [p.x, p.y];
  w.actors.push(m);
  log(`Впереди шайки — ${b.elite.name}. За его голову обещана награда.`, C.orange);
}

function bountyKill(m) {
  const b = m.bounty;
  takeTrophy({ id: b.id, name: `Голова атамана ${b.name}`, value: 1 });
  G.player.bounties = G.player.bounties || {};
  G.player.bounties[b.id] = b;
  log(`Ты сразил атамана ${b.name}. Его голова — в мешке: отнеси подесте или старосте, за неё обещано ${coins(b.bounty)}.`, C.gold);
  chronicle(`Сразил атамана разбойников ${b.name}.`, 'boss');
}

// Староста или подеста платят за голову.
function bountyOptions(npc) {
  const p = G.player;
  if (npc.role !== 'elder' || !p.bounties) return [];
  return Object.values(p.bounties).filter(b => p.trophies[b.id]).map(b => ({ label: `Принёс голову атамана ${b.name}`, act: () => {
    delete p.trophies[b.id];
    delete p.bounties[b.id];
    p.coins += b.bounty;
    addFame(5, `принёс голову атамана ${b.name}`);
    p.gainXp(40);
    log(`Получено: ${coins(b.bounty)}, 40 опыта.`, C.gold);
    chronicle(`Получил награду за голову атамана ${b.name}.`, 'quest');
    return `${npc.title} брезгливо заглядывает в мешок — и кивает. «Он самый. Сколько крови он нам попортил… Вот ${coins(b.bounty)}, как обещано. `
      + 'Голову выставим на воротах — пусть другие видят».';
  } }));
}
