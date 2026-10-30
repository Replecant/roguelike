'use strict';

// ─── Куда идти ─────────────────────────────────────────────────────
// У каждого задания есть цель на карте Италии: город доставки, логово,
// место сквозного задания или тот, кто дал работу. Цель видна везде:
// в панели — направление и расстояние, на карте — значок ◆ (или стрелка
// у края, если цель за краем), в атласе — подписанная точка, в журнале — строка «Куда».

const DIRS_RU = ['на восток', 'на северо-восток', 'на север', 'на северо-запад', 'на запад', 'на юго-запад', 'на юг', 'на юго-восток'];
const ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];

function placeById(id) { return G.over.cities.find(c => c.id === id) || G.over.sites.find(s => s.id === id); }

// Расстояние (км) и направление от героя до клетки Италии.
function bearing(x, y) {
  const dx = (x - G.ox) * GEO.kmX, dy = (y - G.oy) * GEO.kmY, km = Math.round(Math.hypot(dx, dy));
  const k = (Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) + 8) % 8;
  return { km, dir: DIRS_RU[k], arrow: ARROWS[k], here: Math.max(Math.abs(x - G.ox), Math.abs(y - G.oy)) === 0 };
}

// Ближайшее из мест.
function nearestPlace(list) {
  return list.reduce((a, b) => !a || Math.hypot(b.x - G.ox, b.y - G.oy) < Math.hypot(a.x - G.ox, a.y - G.oy) ? b : a, null);
}

// Цель задания: { x, y, name, why } или null (охота — где угодно).
function questTarget(q) {
  const back = () => { const pl = placeById(q.from); return pl && { x: pl.x, y: pl.y, name: pl.name, why: 'вернуться за наградой' }; };
  if (q.type === 'deliver') { const pl = placeById(q.to); return pl && { x: pl.x, y: pl.y, name: pl.name, why: `доставить: ${q.toTitle || ''}`.trim() }; }
  if (q.type === 'lair') {
    if (q.done) return back();
    const l = (G.leads || []).find(l => l.id === q.lead);
    return l && { x: l.x, y: l.y, name: l.name, why: `близ ${l.anchor}` };
  }
  if (q.type === 'kill') return q.done ? back() : null;
  if (q.type === 'work') return back();
  if (q.id === 'crusade') {
    const st = crusadeStage();
    if (st === 1 || st === 3) { const pl = placeById(LEGATE_CITY); return { x: pl.x, y: pl.y, name: pl.name, why: 'к легату Раньери Капоччи' }; }
    if (st === 4) { const pl = placeById(POPE_CITY); return { x: pl.x, y: pl.y, name: pl.name, why: 'к папе Иннокентию IV' }; }
    if (st === 2) { const s = nearestPlace(paganSites().filter(s => !s.razed)); return s && { x: s.x, y: s.y, name: s.name, why: 'ближайшее селение язычников' }; }
  }
  if (q.id === 'inferi') {
    const st = storyStage();
    if (st === 1 || st === 3) {
      const s = nearestPlace(paganSites().filter(s => !s.hidden && !s.razed));
      return s && { x: s.x, y: s.y, name: s.name, why: st === 1 ? 'к фламину с даром' : 'к фламину с ветвью' };
    }
    const id = st === 2 ? 'sibyl' : st === 4 ? 'inferi' : null, s = id && placeById(id);
    return s && !s.hidden ? { x: s.x, y: s.y, name: s.name, why: st === 2 ? 'за золотой ветвью' : 'в подземный мир' } : null;
  }
  return null;
}

// Все цели и та, за которой следим в панели.
function questTargets() {
  return G.player.quests.map(q => ({ q, t: questTarget(q) })).filter(e => e.t);
}
function trackedTarget() {
  const list = questTargets(), p = G.player;
  return list.find(e => e.q.id === p.track) || list[list.length - 1] || null;
}

// Строка «куда» для панели и журнала.
function targetText(t) {
  const b = bearing(t.x, t.y);
  return b.here ? `${t.name} — ты на месте` : `${t.name} — ${b.km} км ${b.dir}`;
}

// Значки целей на карте Италии: ◆ на месте или стрелка у края экрана.
function drawTargets(t, cx, cy) {
  const blink = Math.floor(Date.now() / 600) % 2 === 0, tr = trackedTarget();
  for (const { q, t: g } of questTargets()) {
    const main = tr && tr.q === q, col = main ? '#ffd860' : '#d0a040';
    const sx = g.x - cx, sy = g.y - cy;
    if (sx >= 0 && sy >= 0 && sx < MAP_W && sy < MAP_H) {
      if (main && blink) t.put(sx, sy, '◆', col, '#3a2a08');
      continue;
    }
    if (!main) continue;
    // За краем: стрелка на краю экрана в сторону цели.
    const hx = G.ox - cx, hy = G.oy - cy, dx = sx - hx, dy = sy - hy;
    const k = Math.min((MAP_W / 2 - 1) / Math.abs(dx || 1e-6), (MAP_H / 2 - 1) / Math.abs(dy || 1e-6));
    const ex = Math.max(0, Math.min(MAP_W - 1, Math.round(hx + dx * k))), ey = Math.max(0, Math.min(MAP_H - 1, Math.round(hy + dy * k)));
    t.put(ex, ey, bearing(g.x, g.y).arrow, col, '#3a2a08');
  }
}
