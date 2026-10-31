'use strict';

// ─── Режим отладки ─────────────────────────────────────────────────
// Окно для проверки всего подряд: характеристики, деньги, вера, время,
// предметы, перенос в любое место, стадии сквозных заданий, звери.
// Открывается клавишей ` (Ё) или F9. Всё, что сделано отсюда, честно
// помечается в журнале сообщений.

const DEBUG_TABS = ['Герой', 'Мир', 'Задания'];

class DebugScreen {
  constructor() { this.overlay = true; this.tab = 0; G.debug = G.debug || { god: false }; }
  key(k) {
    if (isEsc(k) || k.code === 'Backquote' || k.code === 'F9') return popScreen();
    if (k.code === 'ArrowRight' || k.code === 'Tab') this.tab = (this.tab + 1) % DEBUG_TABS.length;
    if (k.code === 'ArrowLeft') this.tab = (this.tab + DEBUG_TABS.length - 1) % DEBUG_TABS.length;
  }
  render() {}
}

function dbgLog(text) { log(`[отладка] ${text}`, C.violet); }

const dbgBtn = (act, label, data = {}) =>
  `<button class="dbg-b" data-act="${act}"${Object.entries(data).map(([k, v]) => ` data-${k}="${esc(String(v))}"`).join('')}>${label}</button>`;

// Выбор в списках помнится между нажатиями (окно перерисовывается).
const DBG_PICK = {};
function dbgSelect(id, options) {
  return `<select id="${id}" class="dbg-sel">${options.map(([v, t]) =>
    `<option value="${esc(v)}"${DBG_PICK[id] === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
}

// Все места Италии, куда можно перенестись.
function dbgPlaces() {
  const ow = G.over, kinds = { city: 'город', town: 'городок', village: 'деревня', castle: 'замок', monastery: 'монастырь', inn: 'двор', pagan: 'язычники' };
  const list = [...ow.cities, ...ow.sites].map(pl => {
    const tag = pl.dungeon ? (DUNGEON_TYPES[pl.type] ? DUNGEON_TYPES[pl.type].label.toLowerCase() : 'подземелье') : kinds[pl.kind] || pl.kind || 'место';
    return [pl.id, `${pl.name} — ${tag}${pl.hidden ? ' (скрыто)' : ''}${pl.razed ? ' (пепелище)' : ''}`];
  });
  return list.sort((a, b) => a[1].localeCompare(b[1], 'ru'));
}

DebugScreen.prototype.winClass = 'debug';
DebugScreen.prototype.html = function () {
  const p = G.player;
  const tabs = DEBUG_TABS.map((t, i) => `<button class="tab${i === this.tab ? ' on' : ''}" data-act="tab" data-i="${i}">${t}</button>`).join('');
  let body = '';
  if (this.tab === 0) {
    const stats = STATS.map(s => `<div class="dbg-row"><span>${s.name}</span><b>${p.stats[s.key]}</b>
      ${dbgBtn('stat', '−', { k: s.key, n: -1 })}${dbgBtn('stat', '+', { k: s.key, n: 1 })}${dbgBtn('stat', '+5', { k: s.key, n: 5 })}</div>`).join('');
    const res = [
      ['Уровень', p.level, [['level', '+1 уровень', {}]]],
      ['Свободные очки', p.statPoints, [['points', '+1', { n: 1 }], ['points', '+5', { n: 5 }]]],
      ['Здоровье', `${p.hp}/${p.maxHp}`, [['heal', 'вылечить', {}], ['hurt', '−10', {}]]],
      ['Благодать', `${p.grace}/${p.maxGrace}`, [['grace', 'полная', {}]]],
      ['Монеты', p.coins, [['coins', '+100', { n: 100 }], ['coins', '+1000', { n: 1000 }]]],
      ['Благочестие', p.piety, [['piety', '−10', { n: -10 }], ['piety', '+10', { n: 10 }], ['piety', '100', { n: 100 }]]],
      ['Милость святого', p.patron ? `${p.favor} (${SAINTS[p.patron].name})` : 'нет покровителя', p.patron ? [['favor', '+5', {}]] : []],
      ['Сытость / бодрость', `${Math.round(p.food)} / ${Math.round(100 - p.fatigue)}`, [['rest', 'сыт и бодр', {}]]],
      ['Провиант / отвары', `${p.rations} / ${p.potions}`, [['supplies', '+5 и +5', {}]]],
    ].map(([k, v, btns]) => `<div class="dbg-row"><span>${k}</span><b>${esc(String(v))}</b>${btns.map(([a, l, d]) => dbgBtn(a, l, d)).join('')}</div>`).join('');
    const saints = Object.entries(SAINTS).map(([id, s]) => [id, s.name]);
    const items = Object.entries(ITEMS).map(([id, it]) => [id, `${it.name} (${id})`]).sort((a, b) => a[1].localeCompare(b[1], 'ru'));
    body = `<div class="dbg-cols">
      <section><div class="sect">Характеристики</div>${stats}
        <div class="sect">Режимы</div>
        <div class="dbg-row"><span>Бессмертие</span><b>${G.debug.god ? 'вкл' : 'выкл'}</b>${dbgBtn('god', G.debug.god ? 'выключить' : 'включить')}</div>
        <div class="dbg-row"><span>Простая графика</span><b>${TILE_MODE ? 'вкл' : 'выкл'}</b>${dbgBtn('tiles', TILE_MODE ? 'выключить' : 'включить')}</div>
        <div class="dbg-row"><span>Прицельные удары</span><b>${aimOn() ? 'вкл' : 'выкл'}</b>${dbgBtn('aim', aimOn() ? 'выключить' : 'включить')}</div></section>
      <section><div class="sect">Ресурсы</div>${res}
        <div class="sect">Покровитель</div>
        <div class="dbg-row">${dbgSelect('dbg-saint', saints)}${dbgBtn('patron', 'назначить')}</div>
        <div class="sect">Навык</div>
        <div class="dbg-row">${dbgSelect('dbg-skill', Object.entries(SKILLS).map(([k, s]) => [k, `${s.name} — ${skillLevel(p, k)}`]))}${dbgBtn('skill', '+1')}${dbgBtn('skill', '10', { max: 1 })}</div>
        <div class="sect">Предмет в котомку</div>
        <div class="dbg-row">${dbgSelect('dbg-item', items)}${dbgBtn('item', 'дать')}</div></section>
    </div>`;
  } else if (this.tab === 1) {
    const beasts = Object.entries(BEASTS).map(([id, b]) => [id, `${b.name} — ${b.cat}`]).sort((a, b) => a[1].localeCompare(b[1], 'ru'));
    const w = G.world, inDungeon = G.mode === 'local' && w.kind === 'dungeon';
    const { day, hour } = timeInfo();
    body = `<div class="dbg-cols">
      <section><div class="sect">Перенестись</div>
        <div class="dbg-row">${dbgSelect('dbg-place', dbgPlaces())}${dbgBtn('go', 'войти')}</div>
        <div class="dbg-row">${dbgBtn('reveal', 'Открыть все скрытые места на карте')}</div>
        ${inDungeon ? `<div class="sect">Подземелье: ${esc(w.site.name)}, уровень ${w.depth + 1}</div>
          <div class="dbg-row">${w.down ? dbgBtn('down', 'Спуститься на уровень ниже') : '<span>это дно</span>'}${dbgBtn('secrets', 'Показать ловушки и тайники')}</div>` : ''}
        <div class="sect">Время: день ${day}, ${hour}:00</div>
        <div class="dbg-row">${dbgBtn('time', '+1 час', { m: 60 })}${dbgBtn('time', '+6 часов', { m: 360 })}${dbgBtn('time', '+1 день', { m: 1440 })}${dbgBtn('time', '+1 неделя', { m: 10080 })}</div></section>
      <section><div class="sect">Звери</div>
        <div class="dbg-row">${dbgSelect('dbg-beast', beasts)}${dbgBtn('spawn', 'поставить рядом')}</div>
        <div class="dbg-row">${dbgBtn('killall', 'Убить всех видимых')}${dbgBtn('clear', 'Убрать всех зверей с карты')}</div>
        ${G.mode !== 'local' ? '<p class="dim">Звери — только на местной карте.</p>' : ''}</section>
    </div>`;
  } else {
    const inf = storyStage(), cr = crusadeStage(), mi = mithrasStage(), cu = cultStage();
    const stages = (act, cur, names) => names.map((n, i) => `<button class="dbg-b${i === cur ? ' on' : ''}" data-act="${act}" data-n="${i}">${i}. ${n}</button>`).join('');
    body = `<div class="dbg-cols one">
      <section><div class="sect">Путь в подземный мир (фламин) — сейчас ${inf}</div>
        <div class="dbg-stages">${stages('inferi', inf, ['не начат', 'нужен дар', 'за ветвью', 'ветвь у меня', 'к Этне', 'Дит повержен'])}</div>
        <div class="sect">Последние язычники (легат) — сейчас ${cr}</div>
        <div class="dbg-stages">${stages('crusade', cr, ['не начат', 'к легату', 'разорять селения', 'к легату с докладом', 'к папе', 'исполнено'])}</div>
        <div class="dbg-row">${dbgBtn('raze', 'Разорить все селения язычников')}</div>
        <div class="sect">Непобедимое Солнце (дух митраиста) — сейчас ${mi}</div>
        <div class="dbg-stages">${stages('mithras', mi, ['не начат', 'Ворон: трапеза', 'Воин: венец', 'Лев: мёд', 'факелы', 'бык', 'исполнено'])}</div>
        <div class="sect">Тихая деревня (кастелян) — сейчас ${cu}${p.story && p.story.cultVillage ? ` · ${esc(cultVillagePlace().name)}` : ''}</div>
        <div class="dbg-stages">${stages('cult', cu, ['не начат', 'разузнать', 'спуск найден', 'глава убит', 'исполнено'])}</div>
        <p class="dim">Стадия ставится сразу, со всем нужным: открытыми местами, ветвью, записью в журнале.</p></section>
    </div>`;
  }
  return winHead('Отладка', 'проверка всего подряд · Esc или ` — закрыть', '') + `<div class="tabs">${tabs}</div>`
    + `<div class="dbg-body" data-scroll="dbg">${body}</div>`;
};

DebugScreen.prototype.act = function (a, d) {
  const p = G.player, val = id => { const el = /** @type {HTMLSelectElement} */ (document.getElementById(id)); return el && el.value; };
  for (const el of document.querySelectorAll('#win select.dbg-sel')) DBG_PICK[el.id] = /** @type {HTMLSelectElement} */ (el).value;
  const keepHp = fn => { const oh = p.maxHp, og = p.maxGrace; fn(); p.hp = Math.max(1, p.hp + p.maxHp - oh); p.grace = Math.max(0, p.grace + p.maxGrace - og); };
  switch (a) {
    case 'tab': this.tab = +d.i; break;
    case 'stat': keepHp(() => { p.base[d.k] = Math.max(1, p.base[d.k] + +d.n); }); dbgLog(`${STATS.find(s => s.key === d.k).name}: ${p.stats[d.k]}.`); break;
    case 'level': p.gainXp(p.xpNext - p.xp); break;
    case 'points': p.statPoints += +d.n; dbgLog(`Свободных очков: ${p.statPoints} (C — распределить).`); break;
    case 'heal': p.hp = p.maxHp; p.poison = 0; p.confused = 0; p.fever = 0; dbgLog('Здоров.'); break;
    case 'hurt': p.hp = Math.max(1, p.hp - 10); break;
    case 'grace': p.grace = p.maxGrace; break;
    case 'coins': p.coins += +d.n; break;
    case 'piety': p.piety = Math.max(0, Math.min(100, +d.n === 100 ? 100 : p.piety + +d.n)); dbgLog(`Благочестие ${p.piety} (${pietyRank(p.piety).toLowerCase()}).`); break;
    case 'favor': p.favor += 5; break;
    case 'skill': {
      const k = val('dbg-skill');
      p.skills = p.skills || {};
      const s = p.skills[k] || (p.skills[k] = { lvl: 0, xp: 0 });
      s.lvl = d.max ? SKILL_MAX : Math.min(SKILL_MAX, s.lvl + 1); s.xp = 0;
      dbgLog(`${SKILLS[k].name}: ${s.lvl}.`);
      break;
    }
    case 'rest': p.food = 100; p.fatigue = 0; break;
    case 'supplies': p.rations += 5; p.potions += 5; break;
    case 'god': G.debug.god = !G.debug.god; dbgLog(`Бессмертие ${G.debug.god ? 'включено' : 'выключено'}.`); break;
    case 'tiles': TILE_MODE = !TILE_MODE; dbgLog(`Простая графика ${TILE_MODE ? 'включена' : 'выключена'}.`); break;
    case 'aim': G.aimOff = !G.aimOff; dbgLog(`Прицельные удары ${aimOn() ? 'включены' : 'выключены'}.`); break;
    case 'patron': p.patron = val('dbg-saint'); p.favor = p.favor || 0; dbgLog(`Покровитель: ${SAINTS[p.patron].name}.`); break;
    case 'item': { const it = makeItem(val('dbg-item')); p.bag.push(it); dbgLog(`В котомке: ${it.name}.`); break; }
    case 'go': {
      const id = val('dbg-place'), pl = [...G.over.cities, ...G.over.sites].find(x => x.id === id);
      if (!pl) break;
      if (pl.hidden) revealTomb(pl);
      if (G.mode === 'local') leaveLocal();
      G.ox = pl.x; G.oy = pl.y;
      popScreen();
      overEnter();
      dbgLog(`Перенос: ${pl.name}.`);
      return;
    }
    case 'reveal': { let n = 0; for (const s of G.over.sites) if (s.hidden && revealTomb(s)) n++; dbgLog(`Открыто мест: ${n}.`); break; }
    case 'down': {
      const w = G.world, site = w.site;
      if (w.down) { popScreen(); goToLevel(site, G.dungeons[site.id], w.depth + 1, 'up'); dbgLog(`Уровень ${G.world.depth + 1}.`); return; }
      break;
    }
    case 'secrets': {
      const w = G.world;
      if (w.traps) for (const tr of w.traps.values()) tr.found = true;
      if (w.secrets) for (const i of [...w.secrets]) { w.secrets.delete(i); w.set(i % w.w, (i / w.w) | 0, T.DOOR); }
      w.explored.fill(1);
      dbgLog('Ловушки видны, тайные ходы открыты, уровень разведан.');
      break;
    }
    case 'time': passTime(+d.m); dbgLog(`Время: день ${timeInfo().day}, ${timeInfo().hour}:00.`); break;
    case 'spawn': {
      if (G.mode !== 'local') break;
      const w = G.world, key = val('dbg-beast');
      const spot = DIRS8.map(([dx, dy]) => [p.x + dx * 2, p.y + dy * 2]).find(([x, y]) => w.free(x, y))
        || DIRS8.map(([dx, dy]) => [p.x + dx, p.y + dy]).find(([x, y]) => w.free(x, y));
      if (!spot) { dbgLog('Некуда поставить.'); break; }
      const m = makeBeast(key, spot[0], spot[1]);
      w.actors.push(m);
      refreshFov();
      dbgLog(`Рядом: ${m.name}.`);
      break;
    }
    case 'killall': for (const m of visibleBeasts()) killBeast(m, true); break;
    case 'clear': if (G.mode === 'local') { G.world.actors = G.world.actors.filter(x => x.kind !== 'beast'); dbgLog('Зверей нет.'); } break;
    case 'inferi': dbgInferi(+d.n); break;
    case 'crusade': dbgCrusade(+d.n); break;
    case 'cult': {
      p.story = p.story || {};
      const near = kind => G.over.cities.filter(c => c.kind === kind).reduce((a, b) => Math.hypot(b.x - G.ox, b.y - G.oy) < Math.hypot(a.x - G.ox, a.y - G.oy) ? b : a);
      if (!p.story.cultVillage) { p.story.cultVillage = near('village').id; p.story.cultCastle = near('castle').id; p.story.cultSusp = 0; }
      if (+d.n === 0) { p.story.cult = 0; p.quests = p.quests.filter(q => q.id !== 'cult'); }
      else setCult(+d.n, ['', 'Разузнать, что творится в деревне {village}.', 'Под церковью деревни {village} — пещеры культа. Убить его главу.',
        'Вернуться к кастеляну.', ''][+d.n]);
      dbgLog(`Тихая деревня: стадия ${d.n}, деревня ${cultVillagePlace().name}.`);
      break;
    }
    case 'mithras': {
      p.story = p.story || {};
      if (!p.story.mithrasSite) { const s = G.over.sites.find(x => x.type === 'mithraeum'); p.story.mithrasSite = s.id; revealTomb(s); }
      if (+d.n === 0) { p.story.mithras = 0; p.quests = p.quests.filter(q => q.id !== 'mithras'); }
      else if (+d.n === 6) { p.story.mithras = 5; mithrasBullSlain(); }
      else setMithras(+d.n);
      p.story.mithrasWait = 0;
      dbgLog(`Непобедимое Солнце: стадия ${d.n}. Митреум: ${G.over.sites.find(x => x.id === p.story.mithrasSite).name}.`);
      break;
    }
    case 'raze': {
      for (const s of paganSites()) if (!s.razed) { s.razing = true; finishRaze(s); }
      break;
    }
  }
};

function dbgInferi(n) {
  const p = G.player, texts = {
    1: 'Принести фламину в дар трофей хозяина любого подземелья.',
    2: 'Добыть золотую ветвь в пещере Сивиллы в Кумах.',
    3: 'Вернуться к фламину с золотой ветвью.',
    4: 'Спуститься в подземный мир через жерло Этны.',
  };
  p.story = p.story || {};
  if (n === 0) { p.story.inferi = 0; p.quests = p.quests.filter(q => q.id !== 'inferi'); }
  else setStage(n, texts[n]);
  if (n >= 2) revealTomb(G.over.sites.find(s => s.id === 'sibyl'));
  if (n >= 3 && n < 5 && !hasItem('golden_bough')) p.bag.push(makeItem('golden_bough'));
  if (n >= 4) revealTomb(G.over.sites.find(s => s.id === 'inferi'));
  dbgLog(`Путь в подземный мир: стадия ${n}.`);
}

function dbgCrusade(n) {
  const p = G.player;
  p.story = p.story || {};
  if (n === 0) { p.story.crusade = 0; p.quests = p.quests.filter(q => q.id !== 'crusade'); }
  else if (n === 2) setCrusade(2, crusadeText());
  else setCrusade(n, ['', 'Отправиться в Витербо к легату Раньери Капоччи.', '', 'Вернуться к легату в Витербо.', 'Ехать в Перуджу к папе Иннокентию IV.'][n]);
  // Легат и папа появляются при следующем входе в Витербо и Перуджу.
  dbgLog(`Последние язычники: стадия ${n}.`);
}
