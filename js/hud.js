'use strict';

// ─── Интерфейс поверх карты ────────────────────────────────────────
// Карта остаётся ASCII на canvas, а панель героя, журнал сообщений и кнопки
// действий — обычный HTML поверх правой и нижней части холста. Мышью можно
// ходить (клик — путь до клетки), атаковать, стрелять, говорить; при
// наведении всплывает подсказка. Клавиатура работает как прежде.

const HUD = {
  stage: null, panel: null, log: null, actions: null, tip: null,
  shown: false, logCount: -1, logLast: null,
};

const ACTIONS = [
  { code: 'KeyP', key: 'P', label: 'Молитва', icon: '✝' },
  { code: 'KeyQ', key: 'Q', label: 'Отвар', icon: '⚱' },
  { code: 'KeyF', key: 'F', label: 'Стрелять', icon: '➶' },
  { code: 'KeyR', key: 'R', label: 'Отдых', icon: '☾' },
  { code: 'KeyT', key: 'T', label: 'Поесть', icon: '❧' },
  { code: 'Enter', key: '↵', label: 'Войти', icon: '⌂' },
  { code: 'KeyI', key: 'I', label: 'Котомка', icon: '⚔' },
  { code: 'KeyC', key: 'C', label: 'Герой', icon: '☺' },
  { code: 'Semicolon', key: 'Ж', label: 'Журнал', icon: '✎' },
  { code: 'KeyM', key: 'M', label: 'Карта', icon: '⌖' },
  { code: 'KeyX', key: 'X', label: 'Бестиарий', icon: '❦' },
  { code: 'KeyS', key: 'S', label: 'Сохранить', icon: '⎙' },
  { code: 'Slash', key: '?', label: 'Справка', icon: '?' },
];

function hudInit() {
  HUD.stage = document.getElementById('stage');
  HUD.panel = document.getElementById('hud-panel');
  HUD.log = document.getElementById('hud-log');
  HUD.actions = document.getElementById('hud-actions');
  HUD.tip = document.getElementById('tip');
  HUD.actions.innerHTML = ACTIONS.map(a =>
    `<button data-code="${a.code}" title="${a.label} (${a.key})"><span class="ic">${a.icon}</span><span class="lb">${a.label}</span><kbd>${a.key}</kbd></button>`).join('');
  HUD.actions.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    stopAuto();
    handleKey({ key: '', code: b.dataset.code, shift: false });
  });
  HUD.panel.addEventListener('click', e => {
    const q = e.target.closest('[data-open]');
    if (q && hudActive()) { handleKey({ key: '', code: q.dataset.open, shift: false }); }
  });
  const canvas = G.term.canvas;
  canvas.addEventListener('mousemove', e => hudHover(e));
  canvas.addEventListener('mouseleave', () => hideTip());
  canvas.addEventListener('click', e => hudClick(e));
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); stopAuto(); });
}

// Подогнать слои под размер клеток холста.
function hudLayout() {
  const t = G.term;
  if (!HUD.stage || !t.cw) return;
  const cw = t.cw, ch = t.ch, px = (PANEL_X - 1) * cw;
  HUD.stage.style.setProperty('--fs', t.fs + 'px');
  Object.assign(HUD.panel.style, { left: px + 'px', top: 0, width: (COLS * cw - px) + 'px', height: MAP_H * ch + 'px' });
  Object.assign(HUD.log.style, { left: 0, top: MAP_H * ch + 'px', width: px + 'px', height: (ROWS - MAP_H) * ch + 'px' });
  Object.assign(HUD.actions.style, { left: px + 'px', top: MAP_H * ch + 'px', width: (COLS * cw - px) + 'px', height: (ROWS - MAP_H) * ch + 'px' });
}

// Интерфейс виден, когда под всеми окнами-оверлеями лежит основной экран игры.
function hudActive() {
  let i = G.screens.length - 1;
  while (i > 0 && isLayer(G.screens[i])) i--;
  return G.screens[i] instanceof PlayScreen;
}

function hudUpdate() {
  if (!HUD.stage) return;
  const on = hudActive() && !!G.player;
  if (on !== HUD.shown) {
    HUD.shown = on;
    for (const el of [HUD.panel, HUD.log, HUD.actions]) el.hidden = !on;
    if (!on) hideTip();
    HUD.logCount = -1;
  }
  if (!on) return;
  HUD.panel.innerHTML = panelHtml();
  updateLog();
  updateActions();
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function bar(label, val, max, cls) {
  const pct = Math.max(0, Math.min(100, max ? val / max * 100 : 0));
  return `<div class="bar ${cls}"><span class="bl">${label}</span><div class="track"><div class="fill" style="width:${pct}%"></div></div><span class="bv">${Math.max(0, val)}/${max}</span></div>`;
}

// Активные состояния: эффекты, болезни, благословения.
function effectChips(p) {
  const out = [], turnsLeft = k => Math.ceil((p.buffs[k] - G.minutes) / MINUTES_PER_TURN);
  if (p.poison) out.push(['bad', '☠ Отравлен', `ещё ${p.poison} ходов`]);
  if (p.confused) out.push(['bad', '✺ Морок', `${p.confused} ходов`]);
  if (p.fever) out.push(['bad', '♨ Лихорадка', `${p.fever} дн.`]);
  const hs = hungerState(p), fs = fatigueState(p);
  if (hs) out.push(['bad', hs === 1 ? '❧ Голоден' : '❧ Изголодался', hs === 1 ? 'раны не заживают' : 'теряешь силы']);
  if (fs) out.push(['bad', fs === 1 ? '☾ Устал' : '☾ Валишься с ног', 'хуже бьёшь и уворачиваешься']);
  const BUFF = { bless: '✝ Благословение', mantle: '⛨ Покров', light: '☀ Свет веры', spear: '⚔ Копьё Георгия' };
  for (const [k, name] of Object.entries(BUFF)) if (buffOn(p, k)) out.push(['good', name, `${turnsLeft(k)} ходов`]);
  if (G.wardUntil > G.minutes) out.push(['good', '☩ Под защитой в пути', `${Math.ceil((G.wardUntil - G.minutes) / 60)} ч`]);
  if (p.patron) out.push([p.favor >= FAVOR_COST ? 'good' : '', `☩ ${SAINTS[p.patron].name.replace('Святой ', 'Св. ')}`, `милость ${p.favor}/${FAVOR_COST}`]);
  if (p.mount && p.mount.hungry) out.push(['bad', '♘ Лошадь голодна', `${p.mount.hungry} дн.`]);
  if (carryLoad(p) > p.capacity) out.push(['bad', '⚖ Перегруз', `${carryLoad(p)}/${p.capacity}`]);
  const rm = rangedMode(p);
  if (rm && rm.launcher && rm.launcher.ranged.reload && !p.loaded) out.push(['', '➶ Арбалет не взведён', 'F — взвести']);
  if (isLent()) out.push(['', '✟ Великий пост', '']);
  return out.map(([c, n, d]) => `<span class="chip ${c}" title="${esc(d)}">${esc(n)}${d ? ` <i>${esc(d)}</i>` : ''}</span>`).join('');
}

function panelHtml() {
  const p = G.player, ti = timeInfo(), dt = today(), wd = weatherNow(), s = SEASONS[seasonOf(dt)];
  const ow = G.over, R = REGIONS[ow.regionAt(G.ox, G.oy)], feast = feastsOn(dt)[0];
  const clock = `${String(ti.hour).padStart(2, '0')}:${String(ti.min).padStart(2, '0')}`;
  const tod = isNight() ? '☾ ночь' : darkness() > 0 ? '◐ сумерки' : '☼ день';
  let where;
  if (G.mode === 'local') {
    const w = G.world, b = w.buildingAt(p.x, p.y), v = w.villageAt(p.x, p.y);
    where = w.kind === 'dungeon' ? `${w.site.name}, уровень ${w.depth + 1}` : b ? b.name : v ? v.name : w.site ? w.site.name : w.lead ? w.lead.name : w.def(p.x, p.y).name;
  } else {
    const place = ow.placeAt(G.ox, G.oy), road = ow.roadAt(G.ox, G.oy);
    where = place ? placeTitle(place) : road || ow.def(G.ox, G.oy).name;
  }
  const st = p.stats, w = p.weaponDef, rm = rangedMode(p);
  const dmg = w.ranged ? w.ranged.rdmg.join('–') : `${Math.max(1, w.dmg[0] + p.dmgBonus(null))}–${w.dmg[1] + p.dmgBonus(null)}`;
  const stat = (k, n) => `<div class="st"><span>${n}</span><b>${st[k]}</b></div>`;
  let html = `
    <header>
      <div class="name">${esc(p.name)}</div>
      <div class="sub">${esc(p.people.name)} · ${p.level}-й уровень${p.statPoints ? ` <a class="up" data-open="KeyC">+${p.statPoints} очк.</a>` : ''}</div>
    </header>
    ${bar('Здоровье', p.hp, p.maxHp, 'hp')}
    ${bar('Благодать', p.grace, p.maxGrace, 'gr')}
    ${bar('Сытость', Math.round(p.food), 100, 'food')}
    ${bar('Бодрость', Math.round(100 - p.fatigue), 100, 'rest')}
    ${bar('Опыт', p.xp, p.xpNext, 'xp')}
    <div class="stats">${stat('str', 'Сила')}${stat('con', 'Живуч.')}${stat('dex', 'Ловк.')}${stat('wis', 'Мудр.')}${stat('fai', 'Вера')}
      <div class="st"><span>Благоч.</span><b>${p.piety}</b></div></div>
    <div class="kv">
      <div><span>Оружие</span><b>${esc(w.name)} ${dmg}</b></div>
      <div><span>Защита / уклон.</span><b>${p.armor} / ${p.ev}</b></div>
      ${rm ? `<div><span>${rm.launcher ? 'Стрельба' : 'Метать'}</span><b>${AMMO[rm.ammo].name.toLowerCase()} ${AMMO[rm.ammo].infinite ? '∞' : p.ammo[rm.ammo]}</b></div>` : ''}
      <div><span>Монеты · отвары</span><b><em class="gold">${p.coins}</em> · ${p.potions}</b></div>
      <div><span>Провиант</span><b class="${p.rations ? '' : 'bad'}">${p.rations} дн.</b></div>
      ${p.mount ? `<div><span>Животное</span><b>${MOUNTS[p.mount.kind].name}</b></div>` : ''}
    </div>
    <div class="when">
      <div class="date${feast ? ' feast' : ''}">${dateText(dt)}${feast ? ` · <span title="${esc(feast.name)}">✝ ${esc(feast.name.split(' — ')[0])}</span>` : ''}</div>
      <div class="sky"><span>${clock}</span><span>${tod}</span><span style="color:${wd.color}">${wd.icon} ${wd.name}</span><span style="color:${s.color}">${s.name}</span></div>
      <div class="where"><b>${esc(R.name)}</b> · ${esc(where)}</div>
    </div>`;
  const chips = effectChips(p);
  if (chips) html += `<div class="chips">${chips}</div>`;
  if (p.quests.length) {
    html += `<div class="sect" data-open="Semicolon">Задания</div><ul class="quests">` + p.quests.slice(0, 3).map(q =>
      `<li class="${q.done ? 'done' : ''}" data-open="Semicolon">${esc(questLine(q))}</li>`).join('') + '</ul>';
  }
  if (G.mode === 'local') {
    const near = visibleBeasts().slice(0, 5);
    if (near.length) {
      html += '<div class="sect">Рядом</div><ul class="foes">' + near.map(m =>
        `<li><span class="g" style="color:${m.color}">${esc(m.glyph)}</span><span class="${m.def.unholy ? 'unholy' : ''}">${esc(m.name)}</span>`
        + `<div class="track"><div class="fill" style="width:${Math.max(0, m.hp / m.maxHp * 100)}%"></div></div></li>`).join('') + '</ul>';
    }
  }
  return html;
}

function updateLog() {
  const msgs = G.messages, last = msgs[msgs.length - 1];
  if (msgs.length === HUD.logCount && last === HUD.logLast) return;
  const el = HUD.log, atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
  HUD.logCount = msgs.length;
  HUD.logLast = last;
  el.innerHTML = msgs.map(m => `<p class="${m.turn < G.turn - 1 ? 'old' : ''}" style="color:${m.color}">${esc(m.text)}</p>`).join('');
  if (atBottom || HUD.logCount < 3) el.scrollTop = el.scrollHeight;
}

function updateActions() {
  const p = G.player, local = G.mode === 'local';
  for (const b of HUD.actions.querySelectorAll('button')) {
    const code = b.dataset.code, lb = b.querySelector('.lb');
    let off = false;
    if (code === 'KeyF') off = !local || !rangedMode(p);
    if (code === 'KeyQ') { off = !p.potions; lb.textContent = `Отвар ×${p.potions}`; }
    if (code === 'KeyR') lb.textContent = !local ? 'Лагерь' : G.world.kind === 'city' || G.world.kind === 'dungeon' ? 'Отдых' : 'Ночлег';
    if (code === 'KeyT') { off = !p.rations && !['cheese', 'grain', 'oil', 'wine'].some(id => p.goods[id]); lb.textContent = `Поесть ×${p.rations}`; }
    if (code === 'Enter') lb.textContent = local ? (G.world.kind === 'dungeon' ? 'Выйти' : 'На карту') : (G.over.placeAt(G.ox, G.oy) || activeLeadAt(G.ox, G.oy) ? 'Войти' : 'Осмотреться');
    b.disabled = off;
  }
}

// ─── Мышь ──────────────────────────────────────────────────────────

function cellAt(e) {
  const t = G.term, r = t.canvas.getBoundingClientRect();
  return [Math.floor((e.clientX - r.left) / t.cw), Math.floor((e.clientY - r.top) / t.ch)];
}

// Клетка экрана → клетка мира (или null, если не на карте).
function mapCell(sx, sy) {
  if (sx < 0 || sy < 0 || sx >= MAP_W || sy >= MAP_H || topScreen() !== G.screens[0] || !(G.screens[0] instanceof PlayScreen)) return null;
  const ps = G.screens[0];
  if (G.mode === 'local') {
    const w = G.world, p = G.player, [cx, cy] = ps.camera(w.w, w.h, p.x, p.y);
    return [cx + sx, cy + sy];
  }
  const ow = G.over, [cx, cy] = ps.camera(ow.w, ow.h, G.ox, G.oy);
  return [cx + sx, cy + sy];
}

function hudHover(e) {
  if (!hudActive()) return hideTip();
  const [sx, sy] = cellAt(e), c = mapCell(sx, sy);
  if (!c) return hideTip();
  const lines = G.mode === 'local' ? describeLocal(c[0], c[1]) : describeOver(c[0], c[1]);
  if (!lines.length) return hideTip();
  const tip = HUD.tip, r = HUD.stage.getBoundingClientRect();
  tip.innerHTML = lines.map(([text, cls]) => `<div class="${cls || ''}">${esc(text)}</div>`).join('');
  tip.hidden = false;
  let x = e.clientX - r.left + 16, y = e.clientY - r.top + 16;
  if (x + tip.offsetWidth > r.width) x = e.clientX - r.left - tip.offsetWidth - 12;
  if (y + tip.offsetHeight > r.height) y = e.clientY - r.top - tip.offsetHeight - 12;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

function hideTip() { if (HUD.tip) HUD.tip.hidden = true; }

function describeLocal(x, y) {
  const w = G.world, p = G.player, out = [];
  if (!w.inside(x, y) || !w.explored[w.idx(x, y)]) return [];
  const vis = w.isVisible(x, y), a = vis && w.actorAt(x, y);
  if (a === p) return [[`${p.name} — это ты`, 'h'], ['клик — ждать ход', 'hint']];
  if (a && a.kind === 'beast') {
    const d = a.def, known = p.seen[a.key];
    out.push([a.name, d.unholy ? 'h unholy' : 'h']);
    out.push([`здоровье ${a.hp}/${a.maxHp}${d.unholy ? ' · нечисть' : ''}`]);
    if (known) out.push([BEHAVIOR_TEXT[d.behavior] || '', 'dim']);
    if (a.calmUntil > G.minutes) out.push(['усмирён святым', 'good']);
    const rm = rangedMode(p);
    out.push([dist(a, p) === 1 ? 'клик — атаковать' : rm && rangedTargets(rm).includes(a) ? `клик — ${rm.launcher ? 'выстрелить' : 'метнуть'}` : 'клик — подойти', 'hint']);
    return out;
  }
  if (a && a.kind === 'npc') return [[`${a.name}`, 'h'], [a.title, 'dim'], ['клик — поговорить', 'hint']];
  const b = w.buildingAt(x, y), v = w.villageAt(x, y);
  out.push([w.def(x, y).name, 'h']);
  if (b) out.push([b.name, 'dim']);
  else if (v && v.name) out.push([v.name, 'dim']);
  const items = vis && w.items.get(`${x},${y}`);
  if (items && items.length) out.push([items.map(it => it.kind === 'coins' ? `${it.value} мон.` : it.kind === 'gear' ? it.item.name : it.name).join(', '), 'gold']);
  if (w.work && w.work.has(w.idx(x, y))) out.push(['работа по заданию — наступи', 'gold']);
  if (w.containers && w.containers.has(w.idx(x, y))) out.push(['клик — открыть', 'hint']);
  else if (w.get(x, y) === T.ALTAR) out.push(['клик — помолиться у алтаря', 'hint']);
  else if (w.get(x, y) === T.SARCOPHAGUS) out.push(['клик — вскрыть гробницу (грех)', 'hint']);
  else if (w.get(x, y) === T.URN) out.push(['клик — разбить урну (грех)', 'hint']);
  else if (w.get(x, y) === T.ORE) out.push(['клик — выбить руду (шумно)', 'hint']);
  else if (w.get(x, y) === T.SHRINE) out.push(['клик — помолиться у могилы мученика', 'hint']);
  else if (w.get(x, y) === T.STAIRS_DOWN || w.get(x, y) === T.STAIRS_UP) out.push(['клик — по лестнице', 'hint']);
  else if (w.walkable(x, y)) out.push(['клик — идти сюда', 'hint']);
  if (!vis) out.push(['(по памяти)', 'dim']);
  return out;
}

function describeOver(x, y) {
  const ow = G.over, out = [];
  if (!ow.inside(x, y)) return [];
  const km = Math.round(Math.hypot((x - G.ox) * GEO.kmX, (y - G.oy) * GEO.kmY));
  const lead = activeLeadAt(x, y), place = ow.placeAt(x, y);
  if (x === G.ox && y === G.oy) out.push(['Ты здесь', 'h']);
  if (lead) { out.push([`! ${lead.name}`, 'h gold']); out.push([`по слухам; исчезнет через ${lead.until - timeInfo().day} дн.`, 'dim']); }
  if (place) out.push([placeTitle(place), 'h gold']);
  const road = ow.roadAt(x, y);
  out.push([road || ow.def(x, y).name, place || lead ? 'dim' : 'h']);
  out.push([REGIONS[ow.regionAt(x, y)].name, 'dim']);
  if (winterBlocked(ow, x, y)) out.push(['перевал засыпан снегом', 'bad']);
  if (x === G.ox && y === G.oy) out.push([place || lead ? 'клик — войти' : 'клик — осмотреться', 'hint']);
  else if (ow.passable(x, y)) out.push([`≈${km} км · клик — идти`, 'hint']);
  return out;
}

// ─── Ходьба по клику ───────────────────────────────────────────────

let autoTimer = null;

function stopAuto() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  G.auto = null;
}

function hudClick(e) {
  if (!hudActive() || topScreen() !== G.screens[0]) return;
  const c = mapCell(...cellAt(e));
  if (!c) return;
  stopAuto();
  hideTip();
  if (G.mode === 'local') clickLocal(c[0], c[1]);
  else clickOver(c[0], c[1]);
  render();
}

function clickLocal(x, y) {
  const w = G.world, p = G.player;
  if (!w.inside(x, y) || !w.explored[w.idx(x, y)]) return;
  if (x === p.x && y === p.y) return endTurn();
  const a = w.isVisible(x, y) && w.actorAt(x, y);
  const near = Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) === 1;
  if (a && a.kind === 'beast') {
    if (near) return tryMove(x - p.x, y - p.y);
    const rm = rangedMode(p);
    if (rm && G.mode === 'local') {
      const r = rm.launcher && rm.launcher.ranged;
      if (r && r.reload && !p.loaded) return fire();
      if ((!rm.launcher || ammoLeft(p, rm.ammo)) && rangedTargets(rm).includes(a)) return shoot(rm, a);
    }
    const path = localPath(x, y, true);
    if (path && path.length) tryMove(path[0][0] - p.x, path[0][1] - p.y);
    return;
  }
  // Цель — сама клетка или соседняя с ней (житель, алтарь, сундук).
  const target = w.walkable(x, y) && !(a && a.kind === 'npc');
  if (near && !target) return tryMove(x - p.x, y - p.y);
  if (a && a.kind === 'npc' && near) return talkTo(a);   // клик по жителю — сразу разговор
  const path = localPath(x, y, !target);
  if (!path) { log('Туда не пройти.', C.dark); return; }
  walkPath(path, target ? null : a && a.kind === 'npc' ? a : [x, y]);
}

// Путь до клетки или до соседней с ней.
function localPath(x, y, adjacent) {
  const w = G.world, p = G.player;
  const cost = (cx, cy) => (cx === x && cy === y) ? (adjacent ? Infinity : w.walkable(cx, cy) ? 1 : Infinity)
    : w.walkable(cx, cy) && !(w.actorAt(cx, cy) && w.actorAt(cx, cy) !== p) ? 1 : Infinity;
  // findPath отдаёт путь вместе с начальной клеткой — её отбрасываем.
  const route = (tx, ty) => { const r = findPath(w, p.x, p.y, tx, ty, cost); return r && r.slice(1); };
  if (!adjacent) return route(x, y);
  let best = null;
  for (const [dx, dy] of DIRS8) {
    const nx = x + dx, ny = y + dy;
    if (nx === p.x && ny === p.y) return [];
    if (!w.walkable(nx, ny) || w.actorAt(nx, ny)) continue;
    const path = route(nx, ny);
    if (path && (!best || path.length < best.length)) best = path;
  }
  return best;
}

// Идти по пути, пока ничего не случилось. bump — во что упереться в конце:
// клетка [x, y] или житель (за ним идём, даже если он отошёл).
function walkPath(path, bump) {
  const w = G.world, p = G.player;
  const seen = new Set(visibleBeasts().map(m => m));
  const hp0 = p.hp;
  G.auto = { path, i: 0 };
  const step = () => {
    autoTimer = null;
    const a = G.auto;
    if (!a || G.world !== w || G.mode !== 'local' || topScreen() !== G.screens[0] || p.hp <= 0) return stopAuto();
    const goal = bump && (Array.isArray(bump) ? bump : [bump.x, bump.y]);
    const adjacent = goal && Math.max(Math.abs(goal[0] - p.x), Math.abs(goal[1] - p.y)) === 1;
    if (goal && !Array.isArray(bump) && adjacent) { stopAuto(); talkTo(bump); render(); return; }
    if (a.i >= a.path.length) {
      // Житель отошёл — догоняем (несколько раз).
      if (goal && !adjacent && !Array.isArray(bump) && (a.retry = (a.retry || 0) + 1) <= 6) {
        const np = localPath(goal[0], goal[1], true);
        if (np && np.length) { a.path = np; a.i = 0; autoTimer = setTimeout(step, 45); return; }
      }
      stopAuto();
      if (adjacent) tryMove(goal[0] - p.x, goal[1] - p.y);
      render();
      return;
    }
    let [nx, ny] = a.path[a.i];
    if (!w.free(nx, ny)) {
      // Дорогу заступили — ищем обход до той же цели.
      const end = goal || a.path[a.path.length - 1];
      const np = (a.retry = (a.retry || 0) + 1) <= 8 && localPath(end[0], end[1], !!goal);
      if (!np || !np.length) { stopAuto(); render(); return; }
      a.path = np; a.i = 0;
      [nx, ny] = a.path[0];
      if (!w.free(nx, ny)) { autoTimer = setTimeout(step, 90); return; }
    }
    a.i++;
    tryMove(nx - p.x, ny - p.y);
    const fresh = visibleBeasts().find(m => !seen.has(m) && m.def.behavior !== 'flee');
    if (fresh) { stopAuto(); log(`Ты останавливаешься: рядом ${lower(fresh.name)}.`, C.orange); }
    else if (p.hp < hp0) { stopAuto(); log('Тебя ранили — ты останавливаешься.', C.orange); }
    render();
    if (G.auto) autoTimer = setTimeout(step, 45);
  };
  step();
}

function clickOver(x, y) {
  const ow = G.over;
  if (x === G.ox && y === G.oy) { overEnter(); if (G.mode === 'local') refreshFov(); return; }
  const cost = (cx, cy) => ow.passable(cx, cy) && !winterBlocked(ow, cx, cy) ? (ow.road[ow.idx(cx, cy)] >= 0 ? 1 : 2) : Infinity;
  const path = (findPath(ow, G.ox, G.oy, x, y, cost) || []).slice(1);
  if (!path.length) { log('Туда пути нет — разве что морем, из портового города.', C.dark); return; }
  G.auto = { path, i: 0 };
  const hp0 = G.player.hp, from = ow.placeAt(G.ox, G.oy);
  const step = () => {
    autoTimer = null;
    const a = G.auto;
    if (!a || G.mode !== 'over' || topScreen() !== G.screens[0] || G.player.hp <= 0) { stopAuto(); render(); return; }
    if (a.i >= a.path.length) { stopAuto(); render(); return; }
    const [nx, ny] = a.path[a.i++];
    overMove(nx - G.ox, ny - G.oy);
    if (G.mode !== 'over' || G.player.hp < hp0) { stopAuto(); render(); return; }
    // Остановиться у поселения или места из слухов по пути.
    const here = ow.placeAt(G.ox, G.oy);
    if (a.i < a.path.length && ((here && here !== from) || activeLeadAt(G.ox, G.oy))) { stopAuto(); render(); return; }
    render();
    if (G.auto) autoTimer = setTimeout(step, 30);
  };
  step();
}
