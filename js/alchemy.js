'use strict';

// ─── Алхимия ───────────────────────────────────────────────────────
// Травы растут в глуши (ψ на местной карте): наступи — сорвёшь. Сушёные
// продают травницы. Зелья варят на алхимическом столе (A): у героя есть
// инструменты — ступка, котелок, перегонный куб; в каждый кладут реагенты
// и растирают, варят или перегоняют. Совпало с рецептом — зелье; нет —
// бурая жижа, реагенты пропали. Рецепты базовых зелий известны всем
// (их знает любая деревенская знахарка); навык «Алхимия» растёт от дела
// и даёт вторую порцию.

// Травы Италии из средневековых травников (Tacuinum sanitatis, Circa instans).
const HERBS = {
  plantain:  { name: 'Подорожник', color: '#7ac050', hab: ['field', 'road', 'hill'], months: [3, 4, 5, 6, 7, 8, 9, 10], value: 2,
    desc: 'Растёт у каждой дороги, потому и зовётся так. Лист прикладывают к ранам.' },
  chamomile: { name: 'Ромашка', color: '#f0eccc', hab: ['field'], months: [5, 6, 7, 8, 9], value: 2,
    desc: 'Аптечная ромашка. Успокаивает, снимает жар.' },
  sage:      { name: 'Шалфей', color: '#9ab89a', hab: ['hill', 'field'], months: [4, 5, 6, 7, 8, 9, 10], value: 3,
    desc: '«Cur moriatur homo, cui salvia crescit in horto?» — зачем умирать тому, у кого в саду растёт шалфей? (Салернская школа)' },
  rue:       { name: 'Рута', color: '#b8c040', hab: ['hill'], months: [5, 6, 7, 8, 9], value: 3,
    desc: 'Горькая трава против ядов и дурного глаза. Её кладут в противоядия со времён Митридата.' },
  stjohn:    { name: 'Зверобой', color: '#f0c030', hab: ['field', 'forest', 'hill'], months: [6, 7, 8, 9], value: 4,
    desc: 'Fuga daemonum — «гонящий бесов». Цветёт к Иванову дню; масло из него красное, как кровь.' },
  wormwood:  { name: 'Полынь', color: '#b4b4a4', hab: ['field', 'hill', 'shore', 'road'], months: [6, 7, 8, 9, 10], value: 2,
    desc: 'Горше всего на свете. Гонит лихорадку, глистов и ядовитые соки.' },
  mint:      { name: 'Мята', color: '#50d090', hab: ['marsh', 'field', 'forest'], months: [5, 6, 7, 8, 9], value: 2,
    desc: 'Растёт у ручьёв и в сырых низинах. Освежает голову и бодрит.' },
};
const herbId = k => 'herb_' + k;

// Инструменты: сколько реагентов в них помещается и что ими делают.
const ALC_TOOLS = {
  mortar:  { name: 'Ступка с пестиком', slots: 2, verb: 'Растереть', time: 20, price: 20,
    art: ['    \\  ', ' \\__\\_/', '  \\___/ '] },
  kettle:  { name: 'Медный котелок', slots: 3, verb: 'Сварить', time: 60, price: 35,
    art: ['  __|__ ', ' (_____)', '  ^^^^^ '] },
  alembic: { name: 'Перегонный куб', slots: 2, verb: 'Перегнать', time: 120, price: 150, city: true,
    art: ['  _     ', ' ( )___ ', ' |_|   \\o'] },
};

// Реагенты: травы, вино с рынка, алхимические трофеи (на будущее).
function reagentName(id) {
  if (id.startsWith('herb_')) return HERBS[id.slice(5)].name;
  if (GOODS[id]) return GOODS[id].name;
  const t = G.player.trophies[id];
  return t ? t.name : id;
}
function reagentColor(id) {
  if (id.startsWith('herb_')) return HERBS[id.slice(5)].color;
  if (id === 'wine') return '#b04060';
  return '#c07050';
}
function reagentCount(p, id) {
  if (GOODS[id]) return p.goods[id] || 0;
  return (p.trophies[id] && p.trophies[id].count) || 0;
}
function takeReagent(p, id) {
  if (GOODS[id]) { p.goods[id]--; return; }
  const t = p.trophies[id];
  t.count--;
  if (!t.count) delete p.trophies[id];
}
const REAGENT_IDS = () => [...Object.keys(HERBS).map(herbId), 'wine'];

// Базовые зелья.
const RECIPES = {
  heal:     { name: 'Целебный отвар', tool: 'kettle', need: ['herb_plantain', 'herb_sage'], effect: '+9–14 здоровья, выводит яд' },
  antidote: { name: 'Противоядие', tool: 'kettle', need: ['herb_rue', 'herb_wormwood', 'herb_plantain'], effect: 'выводит яд; полдня яд не берёт' },
  tonic:    { name: 'Бодрящий настой', tool: 'kettle', need: ['herb_mint', 'herb_sage'], effect: 'снимает усталость (−40)' },
  fever:    { name: 'Отвар от лихорадки', tool: 'kettle', need: ['herb_chamomile', 'herb_wormwood'], effect: 'сбивает лихорадку, +3 здоровья' },
  salve:    { name: 'Ранозаживляющая мазь', tool: 'mortar', need: ['herb_plantain', 'herb_chamomile'], effect: '+5–8 здоровья' },
  fuga:     { name: 'Масло зверобоя', tool: 'mortar', need: ['herb_stjohn', 'herb_stjohn'], effect: 'натереть оружие: полдня +3 урона по нечисти' },
  aqua:     { name: 'Aqua vitae', tool: 'alembic', need: ['wine', 'herb_sage'], effect: '+15 здоровья, −20 усталости, сбивает лихорадку' },
};

function brewEffect(id) {
  const p = G.player;
  switch (id) {
    case 'antidote': p.poison = 0; p.poisonWard = G.minutes + 720; return 'Горечь сводит скулы. Яд тебе теперь не страшен — до вечера.';
    case 'tonic': p.fatigue = Math.max(0, p.fatigue - 40); return 'Мятная свежесть бьёт в голову. Усталость как рукой сняло.';
    case 'fever': p.fever = 0; p.hp = Math.min(p.maxHp, p.hp + 3); return 'Жар спадает, озноб уходит.';
    case 'salve': { const h = rng.int(5, 8); p.hp = Math.min(p.maxHp, p.hp + h); return `Мазь холодит раны и стягивает их (+${h}).`; }
    case 'fuga': p.anointUntil = G.minutes + 720; return 'Ты натираешь клинок красным маслом зверобоя. Нечисть почует его издалека.';
    case 'aqua': p.hp = Math.min(p.maxHp, p.hp + 15); p.fatigue = Math.max(0, p.fatigue - 20); p.fever = 0;
      return 'Огненная вода обжигает горло — и по жилам разливается сила. Недаром её зовут «водой жизни».';
  }
  return '';
}

function brewCount(p, id) { return id === 'heal' ? p.potions : (p.brews && p.brews[id]) || 0; }

function drinkBrew(id) {
  const p = G.player;
  if (id === 'heal') { quaff(); return 'Ты пьёшь целебный отвар.'; }
  if (!brewCount(p, id)) return 'Такого зелья не осталось.';
  p.brews[id]--;
  const text = brewEffect(id);
  log(`${RECIPES[id].name}: ${text}`, C.green);
  afterAction();
  return text;
}

// Совпадает ли содержимое инструмента с рецептом (порядок не важен).
function matchRecipe(tool, items) {
  const key = items.slice().sort().join('+');
  return Object.keys(RECIPES).find(id => RECIPES[id].tool === tool && RECIPES[id].need.slice().sort().join('+') === key) || null;
}

function hasTool(p, t) { return !!(p.alchemy && p.alchemy[t]); }

// Сварить: реагенты уходят в любом случае.
function brew(tool, items) {
  const p = G.player, T0 = ALC_TOOLS[tool];
  if (!hasTool(p, tool)) return { ok: false, text: `Нет инструмента: ${T0.name.toLowerCase()}. Его продают травницы.` };
  if (!items.length) return { ok: false, text: `${T0.name} пуст${tool === 'mortar' ? 'а' : ''}. Положи реагенты.` };
  if (dangerNear()) return { ok: false, text: 'Рядом опасность — не до зелий.' };
  for (const id of items) takeReagent(p, id);
  passTime(T0.time);
  const id = matchRecipe(tool, items);
  if (!id) {
    trainSkill(p, 'alchemy', 1);
    log('Вышла бурая жижа с запахом болота. Реагенты пропали.', C.dim);
    return { ok: false, text: 'Вышла бурая жижа с запахом болота. Реагенты пропали — видно, не то положил или не в тот инструмент.' };
  }
  const n = 1 + (rng.chance(skillLevel(p, 'alchemy') * 0.08) ? 1 : 0);
  if (id === 'heal') p.potions += n;
  else { p.brews = p.brews || {}; p.brews[id] = (p.brews[id] || 0) + n; }
  trainSkill(p, 'alchemy', 4);
  const r = RECIPES[id];
  log(`Готово: ${r.name}${n > 1 ? ' ×2 — рука набита, вышло на две порции' : ''}.`, C.gold);
  return { ok: true, text: `${T0.verb.replace(/ть$/, 'л')}… Готово: ${r.name}${n > 1 ? ' — на две порции' : ''}.` };
}

// ─── Травы на местной карте ────────────────────────────────────────

function placeHerbs(world, region) {
  const m = today().m, p = G.player;
  const n = rng.int(2, 5) + Math.floor(skillLevel(p, 'survival') / 2);
  for (let k = 0, tries = 0; k < n && tries < 400; tries++) {
    const x = rng.int(2, world.w - 3), y = rng.int(2, world.h - 3);
    if (!world.walkable(x, y) || world.actorAt(x, y) || world.itemsAt(x, y).length) continue;
    const hab = TILES[world.get(x, y)].hab;
    const kinds = Object.keys(HERBS).filter(h => HERBS[h].hab.includes(hab) && HERBS[h].months.includes(m));
    if (!kinds.length) continue;
    const h = rng.pick(kinds);
    world.addItem(x, y, { kind: 'herb', herb: h, id: herbId(h), name: HERBS[h].name, value: HERBS[h].value });
    k++;
  }
}

// Сорвать траву (наступил на клетку).
function pickHerb(p, it) {
  const extra = rng.chance(0.15 + skillLevel(p, 'survival') * 0.05) ? 1 : 0;
  const tr = p.trophies[it.id] || (p.trophies[it.id] = { name: it.name, value: it.value, count: 0 });
  tr.count += 1 + extra;
  trainSkill(p, 'survival', 0.5);
  log(`Ты срываешь: ${it.name.toLowerCase()}${extra ? ' — целых два пучка' : ''}. (A — алхимия)`, C.green);
}

// ─── Травница продаёт сушёные травы и инструменты ──────────────────

function alchemyShopRows(ts) {
  const p = G.player, out = [], city = ts.place.kind === 'city';
  for (const [k, t] of Object.entries(ALC_TOOLS)) {
    if (hasTool(p, k) || (t.city && !city)) continue;
    const pr = p.priceBuy(t.price);
    out.push({ label: `${t.name} (инструмент)`, qty: 1, price: pr, base: t.price, buy: () => {
      if (p.coins < pr) { ts.note = 'Не хватает монет.'; return; }
      p.coins -= pr;
      p.alchemy = p.alchemy || {};
      p.alchemy[k] = true;
      ts.note = `Куплено: ${t.name.toLowerCase()}. Варить зелья — A.`;
    } });
  }
  for (const [k, h] of Object.entries(HERBS)) {
    const pr = p.priceBuy(h.value * 2);
    out.push({ label: `${h.name} (сушёный)`, qty: '∞', price: pr, base: h.value * 2, buy: n => {
      let done = 0;
      for (; done < n && p.coins >= pr; done++) {
        p.coins -= pr;
        const tr = p.trophies[herbId(k)] || (p.trophies[herbId(k)] = { name: h.name, value: h.value, count: 0 });
        tr.count++;
      }
      ts.note = done ? `Куплено: ${h.name.toLowerCase()} ×${done}.` : 'Не хватает монет.';
    } });
  }
  return out;
}

// ─── Окно алхимии ──────────────────────────────────────────────────

class AlchemyScreen {
  constructor() {
    this.overlay = false;
    const p = G.player;
    this.tool = ['kettle', 'mortar', 'alembic'].find(t => hasTool(p, t)) || 'kettle';
    this.slots = { mortar: [], kettle: [], alembic: [] };
    this.sel = 0;
    this.msg = hasTool(p, 'mortar') || hasTool(p, 'kettle') ? 'Выбери инструмент, положи в него реагенты и приступай.'
      : 'Инструментов нет. Ступку и котелок продают травницы, перегонный куб — аптекари больших городов.';
  }

  // Реагенты в котомке за вычетом того, что уже лежит в инструментах.
  stock() {
    const p = G.player, used = {};
    for (const list of Object.values(this.slots)) for (const id of list) used[id] = (used[id] || 0) + 1;
    return REAGENT_IDS().map(id => ({ id, n: reagentCount(p, id) - (used[id] || 0) })).filter(r => r.n > 0 || used[r.id]);
  }

  put(id) {
    const T0 = ALC_TOOLS[this.tool], list = this.slots[this.tool];
    if (!hasTool(G.player, this.tool)) { this.msg = `Нет инструмента: ${T0.name.toLowerCase()}.`; return; }
    const r = this.stock().find(x => x.id === id);
    if (!r || r.n <= 0) { this.msg = `Больше нет: ${reagentName(id).toLowerCase()}.`; return; }
    if (list.length >= T0.slots) { this.msg = `${T0.name} полон${this.tool === 'mortar' ? 'а' : ''}.`; return; }
    list.push(id);
    this.msg = `${reagentName(id)} — в ${this.tool === 'mortar' ? 'ступку' : this.tool === 'kettle' ? 'котелок' : 'куб'}.`;
  }

  takeBack(i) { const list = this.slots[this.tool]; if (list.length) list.splice(i == null ? list.length - 1 : i, 1); }

  run() {
    const items = this.slots[this.tool].slice();
    const res = brew(this.tool, items);
    if (items.length && hasTool(G.player, this.tool) && !/опасность/.test(res.text)) this.slots[this.tool] = [];
    this.msg = res.text;
    this.ok = res.ok;
  }

  // Разложить по рецепту: выбрать инструмент и положить что есть.
  fill(id) {
    const r = RECIPES[id];
    this.tool = r.tool;
    this.slots[r.tool] = [];
    const miss = [];
    for (const x of r.need) {
      const s = this.stock().find(y => y.id === x);
      if (s && s.n > 0) this.slots[r.tool].push(x); else miss.push(reagentName(x).toLowerCase());
    }
    this.msg = !hasTool(G.player, r.tool) ? `Для этого нужен инструмент: ${ALC_TOOLS[r.tool].name.toLowerCase()}.`
      : miss.length ? `Не хватает: ${miss.join(', ')}.` : `Разложено: ${r.name.toLowerCase()}. Жми «${ALC_TOOLS[r.tool].verb}».`;
  }

  key(k) {
    const d = digitOf(k), st = this.stock();
    if (isEsc(k) || k.code === 'KeyA') return popScreen();
    if (d && d <= 3) { this.tool = Object.keys(ALC_TOOLS)[d - 1]; return; }
    if (isUp(k)) this.sel = (this.sel + st.length - 1) % Math.max(1, st.length);
    else if (isDown(k)) this.sel = (this.sel + 1) % Math.max(1, st.length);
    else if (isEnter(k) && st[this.sel]) this.put(st[this.sel].id);
    else if (k.code === 'Backspace' || k.code === 'Delete') this.takeBack();
    else if (k.code === 'Space' || k.code === 'KeyB') this.run();
  }

  render(t) {
    const p = G.player;
    t.print(2, 1, 'Алхимия', C.gold);
    let y = 3;
    for (const [k, T0] of Object.entries(ALC_TOOLS)) {
      const own = hasTool(p, k), sel = k === this.tool;
      t.print(2, y++, `${sel ? '►' : ' '} ${T0.name}${own ? '' : ' (нет)'}: ${this.slots[k].map(reagentName).join(', ') || '—'}`, sel ? C.gold : own ? C.text : C.dark);
    }
    y++;
    this.stock().forEach((r, i) => t.print(2, y++, `${i === this.sel ? '►' : ' '} ${reagentName(r.id)} ×${r.n}`, C.text));
    t.printWrap(2, y + 1, 90, this.msg, C.dim);
  }
}

AlchemyScreen.prototype.winClass = 'alchemy';
AlchemyScreen.prototype.html = function () {
  const p = G.player, st = this.stock();
  this.sel = Math.min(this.sel, Math.max(0, st.length - 1));
  const reag = st.length ? st.map((r, i) => `<div class="row${i === this.sel ? ' sel' : ''}${r.n > 0 ? '' : ' off'}" data-act="put" data-id="${r.id}" data-i="${i}">`
    + `<span class="ic" style="color:${reagentColor(r.id)}">${r.id === 'wine' ? '♁' : 'ψ'}</span><span class="nm">${esc(reagentName(r.id))}</span><span class="r">×${r.n}</span></div>`).join('')
    : '<div class="dim pad">Реагентов нет. Травы (ψ) растут в глуши — наступи, чтобы сорвать. Сушёные продают травницы, вино — купцы.</div>';
  const tools = Object.entries(ALC_TOOLS).map(([k, T0], i) => {
    const own = hasTool(p, k), list = this.slots[k], sel = k === this.tool;
    const slots = Array.from({ length: T0.slots }, (_, j) => list[j]
      ? `<button class="slot-r" data-act="take" data-t="${k}" data-j="${j}" title="Вынуть" style="--c:${reagentColor(list[j])}"><b>ψ</b>${esc(reagentName(list[j]))}</button>`
      : '<span class="slot-r empty">пусто</span>').join('');
    return `<div class="tool${sel ? ' sel' : ''}${own ? '' : ' off'}" data-act="tool" data-t="${k}">
      <div class="tool-head"><kbd>${i + 1}</kbd><b>${esc(T0.name)}</b>${own ? '' : `<span class="dim"> · нет${T0.city ? ' (аптеки больших городов)' : ' (у травниц)'}</span>`}</div>
      <pre class="art">${T0.art.join('\n')}</pre>
      <div class="slots">${slots}</div>
      ${sel ? `<button class="btn main" data-act="run"${own ? '' : ' disabled'}>${esc(T0.verb)} <kbd>Пробел</kbd></button>` : ''}
    </div>`;
  }).join('');
  const book = Object.entries(RECIPES).map(([id, r]) => {
    const have = {}, chips = r.need.map(x => {
      have[x] = (have[x] || 0) + 1;
      const ok = reagentCount(p, x) >= have[x];
      return `<span class="${ok ? 'ok' : 'miss'}">${esc(reagentName(x))}</span>`;
    }).join(' + ');
    const n = brewCount(p, id);
    return `<div class="recipe${hasTool(p, r.tool) ? '' : ' off'}" data-act="fill" data-id="${id}" title="Клик — разложить по рецепту">
      <div class="rh"><b>${esc(r.name)}</b><span class="dim">${esc(ALC_TOOLS[r.tool].name.toLowerCase())}</span></div>
      <div class="ing">${chips}</div><div class="eff dim">${esc(r.effect)}</div>
      ${n ? `<div class="have">в котомке: ${n} <button class="btn" data-act="drink" data-id="${id}">Выпить</button></div>` : ''}</div>`;
  }).join('');
  return winHead('Алхимия', `Навык алхимии <b>${skillLevel(p, 'alchemy')}</b> · клик по реагенту — положить в инструмент, по реагенту в инструменте — вынуть`)
    + `<div class="alc-body">
      <section class="alc-col"><div class="sect">Реагенты</div><div class="list" data-scroll="reag">${reag}</div></section>
      <section class="alc-col bench"><div class="sect">Инструменты</div>${tools}<div class="alc-msg${this.ok ? ' good' : ''}">${esc(this.msg)}</div></section>
      <section class="alc-col"><div class="sect">Рецепты</div><div class="book" data-scroll="book">${book}</div></section>
    </div>`
    + keys([['1–3', 'инструмент'], ['↑↓ Enter', 'положить'], ['Backspace', 'вынуть'], ['Пробел', 'варить'], ['клик по рецепту', 'разложить'], ['Esc', 'закрыть']]);
};
AlchemyScreen.prototype.act = function (a, d) {
  this.ok = false;
  if (a === 'put') { this.sel = +d.i; this.put(d.id); }
  else if (a === 'take') { this.tool = d.t; this.takeBack(+d.j); }
  else if (a === 'tool') this.tool = d.t;
  else if (a === 'run') this.run();
  else if (a === 'fill') this.fill(d.id);
  else if (a === 'drink') this.msg = drinkBrew(d.id);
};
