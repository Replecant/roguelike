'use strict';

// ─── Спросить дорогу ───────────────────────────────────────────────
// Карт с отметками у путника нет: дорогу спрашивают у людей. Житель
// объясняет по-старому — по римским дорогам и городам на пути, в днях
// ходьбы. Купец, корабельщик, трактирщик бывали везде; крестьянин знает
// только свою округу и отправит к тем, кто знает больше. Услышанное
// записывается в журнал при задании.

const DIRS_RU = ['на восток', 'на северо-восток', 'на север', 'на северо-запад', 'на запад', 'на юго-запад', 'на юг', 'на юго-восток'];

// Как далеко (км) житель знает дороги.
const ROAD_KNOWLEDGE = {
  merchant: 2000, boatman: 2000, innkeeper: 2000, knight: 900, noble: 900, priest: 400, elder: 300,
  guard: 200, smith: 150, herbalist: 100, peasant: 120, hermit: 60,
};

function placeById(id) { return G.over.cities.find(c => c.id === id) || G.over.sites.find(s => s.id === id); }

function kmBetween(a, b) { return Math.hypot((a.x - b.x) * GEO.kmX, (a.y - b.y) * GEO.kmY); }

function dirTo(a, b) {
  const dx = (b.x - a.x) * GEO.kmX, dy = (b.y - a.y) * GEO.kmY;
  return DIRS_RU[(Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) + 8) % 8];
}

// «полдня», «день», «дня три», «с неделю» (пешком — вёрст тридцать в день).
function daysText(km) {
  const d = km / 30;
  if (d < 0.6) return 'полдня';
  if (d < 1.4) return 'день';
  if (d < 2.5) return 'дня два';
  if (d < 4.5) return 'дня три-четыре';
  if (d < 6.5) return 'дней пять-шесть';
  if (d < 10) return 'с неделю';
  return 'недели две';
}

// Первое слово составных названий: «Селение Ларов» → «Селения Ларов».
const FIRST_GEN = { 'Селение': 'Селения', 'Роща': 'Рощи', 'Святилище': 'Святилища', 'Источник': 'Источника', 'Пещера': 'Пещеры',
  'Жерло': 'Жерла', 'Аббатство': 'аббатства', 'Рокка': 'Рокки', 'Постоялый двор': 'постоялого двора', 'Озеро': 'Озера', 'Замок': 'замка' };
const FIRST_DAT = { 'Селение': 'Селению', 'Роща': 'Роще', 'Святилище': 'Святилищу', 'Источник': 'Источнику', 'Пещера': 'Пещере',
  'Жерло': 'Жерлу', 'Аббатство': 'аббатству', 'Рокка': 'Рокке', 'Постоялый двор': 'постоялому двору', 'Озеро': 'Озеру', 'Замок': 'замку' };
function compound(name, table) {
  for (const [k, v] of Object.entries(table)) if (name.startsWith(k + ' ')) return v + name.slice(k.length);
  return null;
}

// «до Сиены», «до Перуджи», «до Рима», «до Неаполя», «до Витербо».
function cityGen(name) {
  const c = compound(name, FIRST_GEN);
  if (c) return c;
  if (name.includes(' ') || name.includes('-')) return name;
  if (/[кгхжшчщ]а$/.test(name)) return name.slice(0, -1) + 'и';
  if (name.endsWith('а')) return name.slice(0, -1) + 'ы';
  if (name.endsWith('я')) return name.slice(0, -1) + 'и';
  if (name.endsWith('ь') || name.endsWith('й')) return name.slice(0, -1) + 'я';
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(name)) return name + 'а';
  return name;
}

// «к Сиене», «к Генуе», «к Риму», «к Неаполю», «к Витербо».
function cityDat(name) {
  const c = compound(name, FIRST_DAT);
  if (c) return c;
  if (name.includes(' ') || name.includes('-')) return name;
  if (name.endsWith('а') || name.endsWith('я')) return name.slice(0, -1) + 'е';
  if (name.endsWith('ь') || name.endsWith('й')) return name.slice(0, -1) + 'ю';
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(name)) return name + 'у';
  return name;
}

// «по Виа Аврелия», «по дороге на Милан», «по Адриатической дороге».
function roadDat(road) {
  if (road.startsWith('Виа ')) return road;
  if (road.startsWith('Дорога ')) return 'дороге ' + road.slice(7);
  return road.replace(/ая дорога$/, 'ой дороге').replace(/^./, c => c.toLowerCase());
}

// Где лежит цель задания: { x, y, name, id } или null (охота — где угодно).
function questTarget(q) {
  const back = () => placeById(q.from);
  if (q.type === 'deliver') return placeById(q.to);
  if (q.type === 'lair') {
    if (q.done) return back();
    const l = (G.leads || []).find(l => l.id === q.lead);
    return l && { x: l.x, y: l.y, name: l.name, id: l.id, near: l.anchor };
  }
  if (q.type === 'kill') return q.done ? back() : null;
  if (q.type === 'relic') return q.done ? back() : placeById(q.site);
  if (q.type === 'work') return back();
  if (q.id === 'crusade') {
    const st = crusadeStage();
    if (st === 1 || st === 3) return placeById(LEGATE_CITY);
    if (st === 4) return placeById(POPE_CITY);
    if (st === 2) return nearestPlace(paganSites().filter(s => !s.razed && !s.hidden));
  }
  if (q.id === 'mithras') {
    const s = placeById(G.player.story.mithrasSite);
    return s && !s.hidden ? s : null;
  }
  if (q.id === 'inferi') {
    const st = storyStage();
    if (st === 1 || st === 3) return nearestPlace(paganSites().filter(s => !s.hidden && !s.razed));
    const s = placeById(st === 2 ? 'sibyl' : st === 4 ? 'inferi' : '');
    return s && !s.hidden ? s : null;
  }
  return null;
}

function nearestPlace(list) {
  const here = { x: G.ox, y: G.oy };
  return list.reduce((a, b) => !a || kmBetween(b, here) < kmBetween(a, here) ? b : a, null);
}

// ─── Путь по дорогам ───────────────────────────────────────────────

function roadGraph() {
  const g = new Map();
  for (const [road, chain] of ROADS)
    for (let i = 0; i + 1 < chain.length; i++) {
      const a = placeById(chain[i]), b = placeById(chain[i + 1]);
      if (!a || !b) continue;
      for (const [u, v] of [[a, b], [b, a]]) {
        if (!g.has(u.id)) g.set(u.id, []);
        g.get(u.id).push({ to: v, road, km: kmBetween(u, v) });
      }
    }
  return g;
}

function nearestRoadCity(pt, g) {
  let best = null;
  for (const id of g.keys()) {
    const c = placeById(id);
    if (landmass(c.region) !== landmass(G.over.regionAt(pt.x, pt.y))) continue;
    if (!best || kmBetween(c, pt) < kmBetween(best, pt)) best = c;
  }
  return best;
}

// Маршрут по отрезкам: [{ road?, to?, km, text? }] — от города к городу.
function routeLegs(from, dest) {
  const g = roadGraph(), legs = [];
  const a = g.has(from.id) ? from : nearestRoadCity(from, g), b = g.has(dest.id) ? dest : nearestRoadCity(dest, g);
  if (!a || !b) return legs;
  if (a !== from && kmBetween(a, from) > 8) legs.push({ km: kmBetween(a, from), text: `сперва к ${cityDat(a.name)} — это ${dirTo(from, a)}` });
  // Дейкстра по дорогам.
  const dist = new Map([[a.id, 0]]), prev = new Map(), todo = new Set([a.id]);
  while (todo.size) {
    const u = [...todo].reduce((x, y) => dist.get(x) <= dist.get(y) ? x : y);
    todo.delete(u);
    if (u === b.id) break;
    for (const e of g.get(u) || []) {
      const nd = dist.get(u) + e.km;
      if (nd < (dist.has(e.to.id) ? dist.get(e.to.id) : Infinity)) { dist.set(e.to.id, nd); prev.set(e.to.id, { from: u, e }); todo.add(e.to.id); }
    }
  }
  const road = [];
  for (let id = b.id; prev.has(id); id = prev.get(id).from) road.unshift(prev.get(id).e);
  legs.push(...road.map(e => ({ road: e.road, to: e.to, km: e.km })));
  if (b !== dest && kmBetween(b, dest) > 8)
    legs.push({ km: kmBetween(b, dest), text: `а оттуда — ${dirTo(b, dest)}${dest.type === 'city' ? '' : ', без дороги'}, ещё ${daysText(kmBetween(b, dest))}` });
  return legs;
}

// Склеить отрезки одной дороги в фразы.
function legsText(legs) {
  const parts = [];
  for (const l of legs) {
    const last = parts[parts.length - 1];
    if (l.road && last && last.road === l.road) { last.via.push(last.to); last.to = l.to; }
    else parts.push(l.road ? { road: l.road, to: l.to, via: [] } : { text: l.text });
  }
  return parts.map(s => s.text || `по ${roadDat(s.road)} до ${cityGen(s.to.name)}${s.via.length ? ` через ${s.via.map(c => cityAcc(c.name)).join(', ')}` : ''}`);
}

// Ответ жителя на «Как добраться до …?».
function askWay(npc, dest) {
  const here = npc.village.city, p = G.player;
  const name = dest.name, total = kmBetween(here, dest);
  if (total < 6) return `${name}? Да вот же, рядом. Ты почти пришёл.`;
  if (landmass(here.region) !== landmass(dest.region || G.over.regionAt(dest.x, dest.y)))
    return `${name}? Это за морем. Пешком туда не дойдёшь — ищи корабельщика в порту, он перевезёт.`;
  const hidden = dest.kind === 'pagan' || dest.dungeon;
  const know = (ROAD_KNOWLEDGE[npc.role] || 100) * (hidden ? 0.4 : 1);
  if (hidden && kmBetween(here, dest) > know)
    return 'Про такие места у нас не говорят. Спроси пастухов и угольщиков в тех горах — они знают больше, чем скажут.';
  // Близко — просто показать рукой.
  if (total <= 45) return `${name}? Это недалеко: ${dirTo(here, dest)}, ${daysText(total)} пешком`
    + (dest.type === 'city' ? '. Не заблудишься.' : ', без дороги — тропами. Держи солнце правильно и не сворачивай.');
  const legs = routeLegs(here, dest);
  if (!legs.length) return `${name} — ${dirTo(here, dest)} отсюда, ${daysText(total)} пешком. Дорог туда толком нет.`;
  // Сколько житель знает — столько и расскажет.
  const told = [];
  let km = 0;
  for (const l of legs) { if (told.length && km + l.km > know) break; told.push(l); km += l.km; }
  const parts = legsText(told);
  let ans = `${name}? Это ${dirTo(here, dest)}, ${daysText(total)} пешком. Ступай ${parts.map((t, i) => i === 0 ? t : t.startsWith('а оттуда') ? ', ' + t : ', потом ' + t).join('')}.`;
  if (told.length < legs.length) ans += ' А дальше не знаю — там спроси у людей.';
  if (p.mount) ans += ' Верхом — быстрее.';
  return ans;
}

// Варианты в разговоре: про цели взятых заданий.
function wayOptions(npc) {
  const here = npc.village.city, seen = new Set(), opts = [];
  for (const q of G.player.quests) {
    const t = questTarget(q);
    if (!t || seen.has(t.name) || kmBetween(here, t) < 6 || t.kind === 'pagan') continue;   // к язычникам дорогу не укажут
    seen.add(t.name);
    const dest = t.near ? (G.over.cities.find(c => c.name === t.near) || t) : t;
    opts.push({ label: `Как добраться до ${t.near ? `${cityGen(t.near)}` : cityGen(t.name)}?`, act: () => {
      const text = askWay(npc, dest);
      q.road = { text, who: `${npc.title} ${npc.name}`, where: here.name, day: timeInfo().day };
      return text;
    } });
    if (opts.length >= 2) break;
  }
  return opts;
}
