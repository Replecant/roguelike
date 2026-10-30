'use strict';

// ─── Вера ──────────────────────────────────────────────────────────
// Благочестие (piety, 0–100) растёт от пожертвований, молитвы у алтаря и
// изгнания нечисти, падает от разорения могил. От него зависит, услышат ли
// молитву. Святой покровитель даёт постоянную милость и раз в день — чудо.

const PIETY_RANKS = [
  [0, 'Грешник'], [10, 'Прихожанин'], [25, 'Благочестивый'], [50, 'Набожный'], [80, 'Праведник'],
];

function pietyRank(n) {
  let r = PIETY_RANKS[0][1];
  for (const [min, name] of PIETY_RANKS) if (n >= min) r = name;
  return r;
}

const SAINTS = {
  george: {
    name: 'Святой Георгий', acc: 'святого Георгия', dat: 'святому Георгию', glyph: '†', color: '#e05040',
    who: 'Победоносец, покровитель воинов и рыцарей. Поразил змея копьём.',
    passive: { acc: 1, vsUnholy: 1 }, passiveText: '+1 к меткости, +1 к урону по нечисти',
    miracle: 'Копьё Георгия', miracleText: '20 ходов каждый удар сильнее на 3 и точнее',
  },
  michael: {
    name: 'Архангел Михаил', acc: 'архангела Михаила', dat: 'архангелу Михаилу', glyph: '†', color: '#f0d070',
    who: 'Архистратиг небесного воинства, низвергший Люцифера. Его святилище — на горе Гаргано.',
    passive: { unholyArmor: 1 }, passiveText: '+1 к защите от нечисти',
    miracle: 'Меч Архангела', miracleText: 'вся нечисть в поле зрения получает тяжёлый урон',
  },
  francis: {
    name: 'Святой Франциск', acc: 'святого Франциска', dat: 'святому Франциску', glyph: '†', color: '#a08050',
    who: 'Бедняк из Ассизи, проповедовал птицам и усмирил волка из Губбио. Умер двадцать лет назад.',
    passive: {}, passiveText: 'дикие звери (не нечисть) реже нападают в пути',
    miracle: 'Слово к братьям меньшим', miracleText: 'звери в поле зрения успокаиваются и не нападают',
  },
  christopher: {
    name: 'Святой Христофор', acc: 'святого Христофора', dat: 'святому Христофору', glyph: '†', color: '#60a0c0',
    who: 'Великан, перенёсший младенца Христа через реку. Хранит путников от внезапной смерти.',
    passive: {}, passiveText: 'в пути на десятую часть быстрее',
    miracle: 'Посох Христофора', miracleText: 'два дня никто не нападёт в пути',
  },
  benedict: {
    name: 'Святой Бенедикт', acc: 'святого Бенедикта', dat: 'святому Бенедикту', glyph: '†', color: '#c0c0c0',
    who: 'Отец западного монашества из Монтекассино. Его крест отгоняет бесов, а чаша с ядом разбилась от его благословения.',
    passive: { poisonRes: 0.3 }, passiveText: 'яд берёт на треть реже',
    miracle: 'Vade retro, Satana', miracleText: 'нечисть рядом в ужасе бежит, яд и морок уходят',
  },
  nicholas: {
    name: 'Святой Николай', acc: 'святого Николая', dat: 'святому Николаю', glyph: '†', color: '#60c0a0',
    who: 'Чудотворец из Мир Ликийских, чьи мощи покоятся в Бари. Покровитель моряков, купцов и бедняков.',
    passive: { price: 0.95 }, passiveText: 'покупка у торговцев на 5% дешевле',
    miracle: 'Милость Николая', miracleText: 'полное исцеление и очищение от яда',
  },
  antony: {
    name: 'Святой Антоний', acc: 'святого Антония', dat: 'святому Антонию', glyph: '†', color: '#b080e0',
    who: 'Проповедник из Падуи, канонизирован пятнадцать лет назад. Помогает найти потерянное.',
    passive: { sell: 1.1 }, passiveText: 'трофеи и товар продаются на 10% дороже',
    miracle: 'Обретение', miracleText: 'указывает место из слухов поблизости — или находку',
  },
};

// Временные благословения: значения, которые добавляются к снаряжению.
function faithItems(p) {
  const out = [];
  if (p.patron) out.push(SAINTS[p.patron].passive);
  if (!p.buffs) return out;
  const fai = p.base.fai;
  if (buffOn(p, 'bless')) out.push({ vsUnholy: 2 + (fai >> 2), dmgBonus: 1 });
  if (buffOn(p, 'mantle')) out.push({ armor: 2 });
  if (buffOn(p, 'light')) out.push({ light: 3 });
  if (buffOn(p, 'spear')) out.push({ dmgBonus: 3, acc: 2 });
  return out;
}

function buffOn(p, k) { return p.buffs && p.buffs[k] > G.minutes; }
function addBuff(p, k, turns) { p.buffs = p.buffs || {}; p.buffs[k] = G.minutes + turns * MINUTES_PER_TURN; }

function addPiety(n, why) {
  const p = G.player, old = p.piety;
  p.piety = Math.max(0, Math.min(100, p.piety + n));
  if (p.piety === old) return;
  if (why) log(`${why} (благочестие ${n > 0 ? '+' : ''}${p.piety - old})`, n > 0 ? C.gold : C.dark);
  if (pietyRank(old) !== pietyRank(p.piety)) log(`Теперь ты — ${pietyRank(p.piety).toLowerCase()}.`, n > 0 ? C.gold : C.red);
}

// Будет ли молитва услышана.
function prayerChance(p) {
  return Math.max(0.25, Math.min(1, 0.35 + p.piety / 150 + p.stats.fai * 0.03));
}
function prayerPower(p) { return Math.floor(p.piety / 25); }

// ─── Молитвы ───────────────────────────────────────────────────────

function unholyNear(r) {
  const p = G.player;
  if (G.mode !== 'local') return [];
  return visibleBeasts().filter(m => m.def.unholy && dist(m, p) <= r);
}

const PRAYERS = [
  {
    id: 'heal', name: 'Молитва об исцелении', cost: 4, fai: 0,
    text: p => `лечит ${2 + (p.stats.fai >> 1) + prayerPower(p)}–${5 + (p.stats.fai >> 1) + prayerPower(p)} здоровья, ослабляет яд, снимает морок`,
    act(p) {
      const heal = 2 + Math.floor(p.stats.fai / 2) + prayerPower(p) + rng.int(0, 3);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      if (p.poison) p.poison = Math.floor(p.poison / 2);
      p.confused = 0;
      log(`Тепло разливается по телу: +${heal} здоровья.`, C.gold);
    },
  },
  {
    id: 'exorcism', name: 'Изгнание нечисти', cost: 5, fai: 0,
    text: p => `опаляет нечисть в 5 шагах: ${1 + (p.stats.fai >> 1) + prayerPower(p)}–${4 + (p.stats.fai >> 1) + prayerPower(p)}`,
    ready: () => unholyNear(5).length ? '' : 'рядом нет нечисти',
    act(p) {
      for (const m of unholyNear(5)) {
        const dmg = Math.floor(p.stats.fai / 2) + prayerPower(p) + rng.int(1, 4);
        m.hp -= dmg;
        m.provoked = true;
        log(`Слово Божие опаляет ${m.def.acc}: −${dmg}.`, C.violet);
        if (m.hp <= 0) killBeast(m, true);
      }
    },
  },
  {
    id: 'light', name: 'Свет веры', cost: 3, fai: 5,
    text: () => 'на 60 ходов видно дальше — во тьме катакомб и ночью',
    act(p) { addBuff(p, 'light', 60); log('Вокруг тебя разливается тихий свет, как от лампады.', C.gold); },
  },
  {
    id: 'bless', name: 'Благословение оружия', cost: 6, fai: 6,
    text: p => `на 30 ходов урон +1, по нечисти ещё +${2 + (p.base.fai >> 2)}`,
    act(p) { addBuff(p, 'bless', 30); log('Ты осеняешь крестом своё оружие. Железо теплеет в руке.', C.gold); },
  },
  {
    id: 'mantle', name: 'Покров Богородицы', cost: 6, fai: 7,
    text: () => 'на 25 ходов защита +2',
    act(p) { addBuff(p, 'mantle', 25); log('Ты чувствуешь на плечах невидимый покров. Удары будто вязнут в нём.', C.gold); },
  },
  {
    id: 'ward', name: 'Молитва путника', cost: 8, fai: 8,
    text: () => 'полдня в пути никто не нападёт',
    act(p) { G.wardUntil = Math.max(G.wardUntil || 0, G.minutes + 12 * 60); log('«Господи, сохрани входящего и исходящего». Дорога кажется светлее.', C.gold); },
  },
];

// Чудо святого — раз в день.
function miracle(p) {
  const s = SAINTS[p.patron];
  switch (p.patron) {
    case 'george':
      addBuff(p, 'spear', 20);
      log('Рука наливается силой, как у воина в белых доспехах на иконе.', C.gold);
      break;
    case 'michael': {
      const foes = G.mode === 'local' ? visibleBeasts().filter(m => m.def.unholy) : [];
      if (!foes.length) { log('Пламенный меч вспыхивает в небе — но здесь некого разить. Благословение растворяется в воздухе.', C.dim); break; }
      for (const m of foes) {
        const dmg = p.stats.fai + prayerPower(p) * 2 + rng.int(1, 6);
        m.hp -= dmg;
        log(`С неба падает огненный клинок: ${lower(m.name)} −${dmg}.`, C.gold);
        if (m.hp <= 0) killBeast(m, true);
      }
      break;
    }
    case 'francis': {
      const beasts = G.mode === 'local' ? visibleBeasts().filter(m => !m.def.unholy && m.def.cat === 'Звери') : [];
      for (const m of beasts) { m.calmUntil = G.minutes + 240; m.provoked = false; m.target = null; }
      log(beasts.length ? `«Братья мои звери...» — ${beasts.length > 1 ? 'звери опускают головы и отходят' : `${lower(beasts[0].name)} опускает голову и отходит`}.`
        : 'Ты говоришь с лесом. Лес слушает.', C.gold);
      break;
    }
    case 'christopher':
      G.wardUntil = Math.max(G.wardUntil || 0, G.minutes + 48 * 60);
      log('Ты словно чувствуешь на плече тяжёлую ладонь великана. Два дня дорога будет к тебе милостива.', C.gold);
      break;
    case 'benedict': {
      p.poison = 0;
      p.confused = 0;
      const foes = unholyNear(8);
      for (const m of foes) { m.fearUntil = G.minutes + 30 * MINUTES_PER_TURN; m.target = null; }
      log(`«Vade retro, Satana!» ${foes.length ? 'Нечисть с воем отшатывается и бежит.' : 'Тьма вокруг будто становится тоньше.'}`, C.gold);
      break;
    }
    case 'nicholas':
      p.hp = p.maxHp;
      p.poison = 0;
      log('Старик в епископской митре мелькает в толпе — и раны твои закрыты.', C.gold);
      break;
    case 'antony': {
      const day = timeInfo().day;
      const near = (G.leads || []).filter(l => !l.known && !l.done && l.until >= day)
        .sort((a, b) => Math.hypot(a.x - G.ox, a.y - G.oy) - Math.hypot(b.x - G.ox, b.y - G.oy))[0];
      if (near && Math.hypot(near.x - G.ox, near.y - G.oy) < 40) {
        near.known = true;
        p.rumors = p.rumors || [];
        p.rumors.unshift({ kind: 'lead', text: near.rumor, lead: near.id, title: `${near.name}: ${near.anchor}`, day, source: 'видение от святого Антония' });
        log(`Перед глазами встаёт место: ${near.name.toLowerCase()}, близ ${near.anchor}. Отмечено на карте (!).`, C.gold);
      } else {
        const coins = rng.int(5, 15);
        p.coins += coins;
        log(`Под ногами блестит потерянный кем-то кошель: ${coins} мон.`, C.gold);
      }
      break;
    }
  }
  return s;
}

function castPrayer(pr) {
  const p = G.player;
  if (p.grace < pr.cost) { log('Слова молитвы застревают в горле. Благодати не хватает.', C.dark); return; }
  p.grace -= pr.cost;
  if (!rng.chance(prayerChance(p))) {
    p.grace += pr.cost >> 1;
    log(rng.pick(['Небеса молчат. Мысли путаются, молитва не идёт.', 'Ты молишься, но слова будто падают в пустоту.',
      'Грехи тянут к земле — молитва не услышана.']), C.dark);
  } else {
    log(`Ты молишься: «${pr.name}».`, C.text);
    pr.act(p);
  }
  afterAction();
}

const MIRACLE_COST = 6;

function castMiracle() {
  const p = G.player, s = SAINTS[p.patron], day = timeInfo().day;
  if (p.miracleDay === day) { log(`${s.name} уже явил тебе милость сегодня.`, C.dark); return; }
  if (p.grace < MIRACLE_COST) { log('Благодати не хватает, чтобы воззвать к святому.', C.dark); return; }
  p.grace -= MIRACLE_COST;
  p.miracleDay = day;
  if (!rng.chance(prayerChance(p))) log(`Ты взываешь к ${s.dat} — но ответа нет.`, C.dark);
  else { log(`Ты взываешь: «${s.miracle}»!`, s.color); miracle(p); }
  afterAction();
}

// ─── Алтарь и пожертвования ────────────────────────────────────────

function altarPray() {
  const p = G.player, day = timeInfo().day;
  if (p.altarDay === day) { log('Ты уже молился у алтаря сегодня. Свеча догорает.', C.dim); return; }
  p.altarDay = day;
  p.grace = p.maxGrace;
  log('Ты преклоняешь колени у алтаря. Благодать возвращается.', C.gold);
  addPiety(1, 'Молитва у алтаря.');
  afterAction();
}

const DONATIONS = [[5, 1], [20, 4], [60, 10]];

function donationOptions(npc) {
  const p = G.player;
  return DONATIONS.map(([sum, gain]) => ({
    label: `Пожертвовать на храм ${sum} мон.`,
    disabled: p.coins < sum,
    act: () => {
      if (p.coins < sum) return 'Господь видит и лепту вдовы. Но у тебя и лепты нет.';
      p.coins -= sum;
      addPiety(gain, 'Пожертвование.');
      return rng.pick(['Да воздаст тебе Господь сторицей.', 'На эти деньги починим кровлю. Помолюсь за тебя.',
        'Щедрость — лучшая молитва. Ступай с миром.']);
    },
  }));
}

function patronOption(npc) {
  const p = G.player;
  return {
    label: p.patron ? `Сменить святого покровителя (сейчас: ${SAINTS[p.patron].name})` : 'Избрать святого покровителя',
    act: () => {
      if (p.piety < 25) return 'Покровителя не выбирают как лошадь на ярмарке. Походи к мессе, пожертвуй на храм — тогда и поговорим.';
      pushScreen(new SaintScreen());
      return 'Святые слышат каждого, но у каждого есть свой заступник. Выбирай сердцем.';
    },
  };
}

// ─── Экраны ────────────────────────────────────────────────────────

class PrayerScreen {
  constructor() { this.overlay = true; this.sel = 0; }

  list() {
    const p = G.player, out = PRAYERS.map(pr => ({ pr }));
    if (p.patron) out.push({ saint: SAINTS[p.patron] });
    return out;
  }

  key(k) {
    const list = this.list(), d = digitOf(k);
    if (isEsc(k) || k.code === 'KeyP') return popScreen();
    if (isUp(k)) this.sel = (this.sel + list.length - 1) % list.length;
    else if (isDown(k)) this.sel = (this.sel + 1) % list.length;
    else if (isEnter(k) || (d && d <= list.length)) {
      const e = list[d ? d - 1 : this.sel], p = G.player;
      if (e.pr) {
        if (p.stats.fai < e.pr.fai) { log(`Эту молитву ты ещё не постиг (нужна Вера ${e.pr.fai}).`, C.dark); return; }
        const why = e.pr.ready && e.pr.ready();
        if (why) { log(`Не время: ${why}.`, C.dim); return; }
        popScreen();
        castPrayer(e.pr);
      } else { popScreen(); castMiracle(); }
    }
  }

  render(t) {
    const p = G.player, list = this.list(), w = 66, h = list.length * 2 + 8;
    const x = Math.floor((MAP_W - w) / 2) + 1, y = Math.max(1, Math.floor((MAP_H - h) / 2));
    t.box(x, y, w, h, C.dim, 'Молитвы');
    t.printRich(x + 3, y + 1, `{dim}Благодать{} ${p.grace}/${p.maxGrace}   {dim}Благочестие{} ${p.piety} (${pietyRank(p.piety).toLowerCase()})   {dim}услышат:{} ${Math.round(prayerChance(p) * 100)}%`);
    list.forEach((e, i) => {
      const yy = y + 3 + i * 2, sel = i === this.sel;
      if (e.pr) {
        const locked = p.stats.fai < e.pr.fai;
        t.print(x + 2, yy, `${sel ? '►' : ' '} ${i + 1}. ${e.pr.name}`, locked ? C.dark : sel ? C.gold : C.text);
        t.print(x + w - 14, yy, locked ? `Вера ${e.pr.fai}` : `${e.pr.cost} благ.`, locked ? C.dark : p.grace >= e.pr.cost ? C.sky : C.red);
        t.print(x + 7, yy + 1, (locked ? 'ещё не постиг' : e.pr.text(p)).slice(0, w - 10), C.dim);
      } else {
        const used = p.miracleDay === timeInfo().day;
        t.print(x + 2, yy, `${sel ? '►' : ' '} ${i + 1}. ${e.saint.miracle}`, used ? C.dark : sel ? C.gold : e.saint.color);
        t.print(x + w - 14, yy, used ? 'завтра' : `${MIRACLE_COST} благ.`, used ? C.dark : C.sky);
        t.print(x + 7, yy + 1, `чудо: ${e.saint.miracleText}`.slice(0, w - 10), C.dim);
      }
    });
    t.print(x + 3, y + h - 2, p.patron ? 'Enter — молиться   Esc — назад' : 'Святого покровителя можно избрать у священника.', C.dim);
  }
}

class SaintScreen {
  constructor() { this.overlay = false; this.ids = Object.keys(SAINTS); this.sel = Math.max(0, this.ids.indexOf(G.player.patron)); }

  key(k) {
    const n = this.ids.length, p = G.player;
    if (isEsc(k)) return popScreen();
    if (isUp(k)) this.sel = (this.sel + n - 1) % n;
    else if (isDown(k)) this.sel = (this.sel + 1) % n;
    else if (isEnter(k)) {
      const id = this.ids[this.sel], s = SAINTS[id];
      if (id === p.patron) return popScreen();
      if (p.patron) {
        p.piety = Math.floor(p.piety / 2);
        log(`Ты отрекаешься от прежнего заступника. Благочестие падает вдвое.`, C.dark);
      }
      p.patron = id;
      p.miracleDay = 0;
      log(`Отныне твой покровитель — ${s.name}.`, s.color);
      popScreen();
    }
  }

  render(t) {
    const p = G.player;
    t.print(2, 1, 'Святой покровитель', C.gold);
    t.print(24, 1, p.patron ? 'Смена покровителя вдвое уменьшит благочестие.' : 'Выбирай сердцем — менять дорого.', C.dim);
    for (let i = 0; i < t.cols; i++) t.put(i, 2, '─', C.dark);
    this.ids.forEach((id, i) => {
      const s = SAINTS[id], sel = i === this.sel, y = 4 + i * 2;
      t.print(2, y, sel ? '►' : ' ', C.gold);
      t.put(4, y, s.glyph, s.color);
      t.print(6, y, s.name + (id === p.patron ? ' ✓' : ''), sel ? C.gold : C.text);
    });
    const s = SAINTS[this.ids[this.sel]], bx = 32, bw = 65;
    t.box(bx, 3, bw, 24, C.dark);
    t.put(bx + 3, 5, s.glyph, s.color);
    t.print(bx + 5, 5, s.name, s.color);
    let y = 7;
    y += t.printWrap(bx + 3, y, bw - 6, s.who, C.text) + 1;
    t.print(bx + 3, y++, 'Милость (всегда):', C.dim);
    y += t.printWrap(bx + 5, y, bw - 8, s.passiveText, C.green) + 1;
    t.print(bx + 3, y++, `Чудо (раз в день, ${MIRACLE_COST} благодати): ${s.miracle}`, C.dim);
    t.printWrap(bx + 5, y, bw - 8, s.miracleText, C.gold);
    t.print(2, t.rows - 1, '↑↓ выбор   Enter — избрать   Esc — назад', C.dim);
  }
}
