'use strict';

// Общие клавиши (по e.code — работают при любой раскладке, в т.ч. русской).
const KEY_DIRS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  KeyK: [0, -1], KeyJ: [0, 1], KeyH: [-1, 0], KeyL: [1, 0],
  KeyY: [-1, -1], KeyU: [1, -1], KeyB: [-1, 1], KeyN: [1, 1],
  Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
  Home: [-1, -1], PageUp: [1, -1], End: [-1, 1], PageDown: [1, 1],
};

const isUp = k => k.code === 'ArrowUp' || k.code === 'Numpad8' || k.code === 'KeyK';
const isDown = k => k.code === 'ArrowDown' || k.code === 'Numpad2' || k.code === 'KeyJ';
const isLeft = k => k.code === 'ArrowLeft' || k.code === 'Numpad4' || k.code === 'KeyH';
const isRight = k => k.code === 'ArrowRight' || k.code === 'Numpad6' || k.code === 'KeyL';
const isEnter = k => k.code === 'Enter' || k.code === 'NumpadEnter';
const isEsc = k => k.code === 'Escape';
const digitOf = k => {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(k.code);
  return m ? +m[1] : 0;
};

function signed(n) { return n > 0 ? '+' + n : n < 0 ? '−' + -n : '0'; }

// ─── Создание персонажа ────────────────────────────────────────────

const TITLE_ART = [
  '▄▀▄ █▄ █ █▄ █ ▄▀▄   ▀█▀ █▀▀ █▄ █ █▀▀ █▄▄ █▀▄ █ █▀▀',
  '█▀█ █ ▀█ █ ▀█ ▀▄▀    █  ██▄ █ ▀█ ██▄ █▄█ █▀▄ █ ▄▄█',
];

class CreationScreen {
  constructor() {
    this.step = 0;           // 0 титул, 1 народ, 2 характеристики, 3 имя, 4 итог
    this.peopleIdx = 0;
    this.statIdx = 0;
    this.alloc = { str: STAT_BASE, con: STAT_BASE, wis: STAT_BASE, fai: STAT_BASE };
    this.name = '';
    this.warn = '';
  }

  get people() { return PEOPLES[this.peopleIdx]; }
  get pointsLeft() {
    return STAT_POINTS - STATS.reduce((s, st) => s + this.alloc[st.key] - STAT_BASE, 0);
  }
  finalStat(k) { return this.alloc[k] + (this.people.mods[k] || 0); }

  randomize() {
    for (const s of STATS) this.alloc[s.key] = STAT_BASE;
    let left = STAT_POINTS;
    while (left > 0) {
      const s = rng.pick(STATS).key;
      if (this.alloc[s] < STAT_MAX) { this.alloc[s]++; left--; }
    }
  }

  key(k) {
    this.warn = '';
    if (this.step === 0) { this.step = 1; return; }
    if (isEsc(k) && this.step > 1) { this.step--; return; }

    if (this.step === 1) {
      if (isUp(k)) this.peopleIdx = (this.peopleIdx + PEOPLES.length - 1) % PEOPLES.length;
      else if (isDown(k)) this.peopleIdx = (this.peopleIdx + 1) % PEOPLES.length;
      else if (digitOf(k) && digitOf(k) <= PEOPLES.length) this.peopleIdx = digitOf(k) - 1;
      else if (isEnter(k)) this.step = 2;
    } else if (this.step === 2) {
      const s = STATS[this.statIdx].key;
      if (isUp(k)) this.statIdx = (this.statIdx + 3) % 4;
      else if (isDown(k)) this.statIdx = (this.statIdx + 1) % 4;
      else if (isLeft(k) || k.key === '-') {
        if (this.alloc[s] > STAT_MIN) this.alloc[s]--;
      } else if (isRight(k) || k.key === '+' || k.key === '=') {
        if (this.alloc[s] < STAT_MAX && this.pointsLeft > 0) this.alloc[s]++;
      } else if (k.code === 'KeyR') this.randomize();
      else if (isEnter(k)) {
        if (this.pointsLeft > 0) this.warn = `Осталось нераспределённых очков: ${this.pointsLeft}.`;
        else this.step = 3;
      }
    } else if (this.step === 3) {
      if (isEnter(k)) {
        if (!this.name.trim()) this.name = rng.pick(NAMES_M);
        this.name = this.name.trim();
        this.step = 4;
      } else if (k.code === 'Backspace') this.name = this.name.slice(0, -1);
      else if (k.code === 'Tab') this.name = rng.pick(NAMES_M);
      else if (k.key && k.key.length === 1 && this.name.length < 20 && /[\p{L}\- ']/u.test(k.key))
        this.name += k.key;
    } else if (this.step === 4) {
      if (isEnter(k)) {
        const stats = {};
        for (const s of STATS) stats[s.key] = this.finalStat(s.key);
        startGame(new Player(this.name, this.people, stats));
      }
    }
  }

  wantsText() { return this.step === 3; }

  render(t) {
    if (this.step === 0) return this.renderTitle(t);
    const steps = ['Народ', 'Характеристики', 'Имя', 'Итог'];
    let x = 3;
    t.print(2, 1, 'СОЗДАНИЕ ГЕРОЯ', C.gold);
    x = 20;
    steps.forEach((s, i) => {
      const cur = i + 1 === this.step;
      x += t.print(x, 1, `${i + 1}. ${s}`, cur ? C.gold : i + 1 < this.step ? C.text : C.dark) + 4;
    });
    for (let i = 0; i < t.cols; i++) t.put(i, 2, '─', C.dark);

    if (this.step === 1) this.renderPeople(t);
    else if (this.step === 2) this.renderStats(t);
    else if (this.step === 3) this.renderName(t);
    else this.renderSummary(t);

    if (this.warn) t.printCenter(t.rows - 3, this.warn, C.red);
  }

  renderTitle(t) {
    const y0 = 7;
    TITLE_ART.forEach((line, i) => t.printCenter(y0 + i, line, C.gold));
    t.printCenter(y0 + 3, 'Европа, лето Господне 1247-е', C.dim);
    const intro = 'Татары прошли огнём через Польшу и Венгрию и ушли так же внезапно, как явились. '
      + 'Но с востока пришло не только войско. В лесах снова шепчутся старые боги, на перекрёстках '
      + 'ждут чёрные псы, над болотами пляшут огни, а церковные колокола звонят всё тревожнее. '
      + 'Ты — путник без господина и без дома. Мир большой, тёмный, и ему всё равно, доживёшь ли ты до утра.';
    const lines = wrapText(intro, 70);
    lines.forEach((l, i) => t.print(15, y0 + 6 + i, l, C.text));
    t.printCenter(y0 + 7 + lines.length + 2, '†', C.gold);
    if (Math.floor(Date.now() / 600) % 2 === 0)
      t.printCenter(t.rows - 5, '— нажми любую клавишу —', C.dim);
  }

  renderPeople(t) {
    t.print(3, 4, 'Откуда ты родом?', C.text);
    PEOPLES.forEach((p, i) => {
      const sel = i === this.peopleIdx;
      t.print(3, 6 + i * 2, sel ? '►' : ' ', C.gold);
      t.print(5, 6 + i * 2, `${i + 1}. ${p.name}`, sel ? C.gold : C.text);
      t.print(20, 6 + i * 2, p.land, sel ? C.dim : C.dark);
    });
    const p = this.people, bx = 48;
    t.box(bx, 4, 49, 22, C.dark, p.name);
    t.print(bx + 2, 6, p.land, C.dim);
    let y = 8;
    y += t.printWrap(bx + 2, y, 45, p.lore, C.text) + 1;
    t.print(bx + 2, y++, 'Поправки:', C.dim);
    let x = bx + 4;
    for (const s of STATS) {
      const m = p.mods[s.key] || 0;
      if (!m) continue;
      x += t.print(x, y, `${s.name} ${signed(m)}`, m > 0 ? C.green : C.red) + 3;
    }
    y += 2;
    t.print(bx + 2, y++, 'Особенность:', C.dim);
    t.printWrap(bx + 4, y, 43, p.perk, C.gold);
    t.print(3, t.rows - 2, '↑↓ выбор   Enter — далее', C.dim);
  }

  renderStats(t) {
    const left = this.pointsLeft;
    t.print(3, 4, 'Распредели очки. Свободных очков: ', C.text);
    t.print(37, 4, String(left), left ? C.gold : C.green);
    STATS.forEach((s, i) => {
      const y = 7 + i * 4, sel = i === this.statIdx;
      const base = this.alloc[s.key], mod = this.people.mods[s.key] || 0;
      t.print(3, y, sel ? '►' : ' ', C.gold);
      t.print(5, y, s.name, sel ? C.gold : C.text);
      t.print(17, y, '◄', base > STAT_MIN ? C.text : C.dark);
      t.print(19, y, String(base).padStart(2), C.white);
      t.print(22, y, '►', base < STAT_MAX && left > 0 ? C.text : C.dark);
      if (mod) t.print(25, y, signed(mod), mod > 0 ? C.green : C.red);
      t.print(29, y, '= ' + this.finalStat(s.key), C.gold);
      for (let k = 0; k < 14; k++) t.put(35 + k, y, k < this.finalStat(s.key) ? '■' : '·', k < this.finalStat(s.key) ? C.brown : C.dark);
      t.printWrap(7, y + 1, 44, s.desc, C.dim, 2);
    });

    // Предпросмотр производных значений.
    const tmp = new Player('', this.people, Object.fromEntries(STATS.map(s => [s.key, this.finalStat(s.key)])));
    const bx = 56;
    t.box(bx, 4, 41, 19, C.dark, 'Что это даст');
    const rows = [
      ['Здоровье', tmp.maxHp],
      ['Благодать', tmp.maxGrace],
      ['Зрение днём', tmp.sightDay],
      ['Зрение ночью', tmp.sightNight],
      ['Меткость', tmp.hit],
      ['Бонус к урону', signed(tmp.dmgBonus(null))],
      ['Сила молитвы', `${3 + Math.floor(tmp.stats.fai / 2)}–${6 + Math.floor(tmp.stats.fai / 2)}`],
      ['Цены у торговцев', Math.round(tmp.priceBuy(100)) + '%'],
    ];
    rows.forEach(([k, v], i) => {
      t.print(bx + 2, 6 + i * 2, k, C.dim);
      t.print(bx + 24, 6 + i * 2, String(v), C.text);
    });
    t.print(3, t.rows - 2, '↑↓ выбор   ←→ изменить   R — случайно   Enter — далее   Esc — назад', C.dim);
  }

  renderName(t) {
    t.print(3, 5, 'Как тебя зовут, путник?', C.text);
    t.box(3, 7, 30, 3, C.dim);
    const cursor = Math.floor(Date.now() / 500) % 2 ? '_' : ' ';
    t.print(5, 8, this.name + cursor, C.gold);
    t.print(3, 11, 'Пустое имя — выберем сами. Tab — случайное имя.', C.dim);
    t.print(3, t.rows - 2, 'Enter — далее   Esc — назад', C.dim);
  }

  renderSummary(t) {
    const p = this.people;
    t.print(3, 5, this.name, C.gold);
    t.print(3, 6, `${p.name}, ${p.land}`, C.dim);
    STATS.forEach((s, i) => {
      t.print(3, 9 + i, s.name, C.text);
      t.print(16, 9 + i, String(this.finalStat(s.key)), C.gold);
    });
    t.print(3, 14, 'Особенность:', C.dim);
    t.printWrap(3, 15, 60, p.perk, C.text);
    t.print(3, 18, 'С собой: дубина, рубаха, 15 монет, 2 целебных отвара.', C.dim);
    t.printWrap(3, 21, 90, 'Ты стоишь у колодца незнакомой деревни. Поговори с жителями, '
      + 'загляни к старосте — у него может найтись работа. За околицей — лес. Звери в деревни не заходят.', C.text);
    t.print(3, t.rows - 2, 'Enter — начать путь   Esc — назад', C.gold);
  }
}

// ─── Диалог с жителем ──────────────────────────────────────────────

class DialogScreen {
  constructor(npc) {
    this.overlay = true;
    this.npc = npc;
    this.text = npc.greeting;
    this.sel = 0;
    this.build();
  }

  build() {
    this.options = npcOptions(this.npc, this);
    if (this.sel >= this.options.length) this.sel = 0;
  }

  key(k) {
    const d = digitOf(k);
    if (isEsc(k)) return popScreen();
    if (isUp(k)) this.sel = (this.sel + this.options.length - 1) % this.options.length;
    else if (isDown(k)) this.sel = (this.sel + 1) % this.options.length;
    else if (isEnter(k)) this.choose(this.sel);
    else if (d && d <= this.options.length) this.choose(d - 1);
  }

  choose(i) {
    const res = this.options[i].act();
    if (res === null) return popScreen();
    if (typeof res === 'string') this.text = res;
    this.build();
  }

  render(t) {
    const w = 70;
    const textLines = wrapText(this.text, w - 6);
    const h = 7 + textLines.length + this.options.length;
    const x = Math.floor((MAP_W - w) / 2) + 1, y = Math.max(1, Math.floor((MAP_H - h) / 2));
    const n = this.npc;
    t.box(x, y, w, h, C.dim, `${n.name}, ${n.title.toLowerCase()} (${n.village.name})`);
    textLines.forEach((l, i) => t.print(x + 3, y + 2 + i, l, C.text));
    const oy = y + 3 + textLines.length;
    this.options.forEach((o, i) => {
      const sel = i === this.sel;
      t.print(x + 3, oy + i, `${sel ? '►' : ' '} ${i + 1}. ${o.label}`, o.disabled ? C.dark : sel ? C.gold : C.text);
    });
    t.print(x + 3, y + h - 2, `Монеты: ${G.player.coins}`, C.dim);
  }
}

function npcOptions(npc, dlg) {
  const p = G.player, opts = [];
  const pay = (price, fn) => () => {
    if (p.coins < price) return 'Денег не хватает. ' + (npc.role === 'priest' ? 'Господь простит, но я — не Господь.' : 'В долг не даю.');
    p.coins -= price;
    return fn();
  };

  opts.push({
    label: 'Что нового в округе?',
    act: () => '«' + rng.pick(RUMORS.common.concat(RUMORS[npc.role], RUMORS[npc.role])) + '»',
  });

  switch (npc.role) {
    case 'elder': {
      const v = npc.village;
      const q = p.quests.find(q => q.villageId === v.id);
      if (q && q.done) {
        opts.push({ label: 'Работа сделана. Где моя награда?', act: () => {
          p.quests = p.quests.filter(x => x !== q);
          p.coins += q.reward;
          v.questsDone = (v.questsDone || 0) + 1;
          log(`Получено: ${q.reward} монет.`, C.gold);
          p.gainXp(q.xp);
          return `Спасибо тебе, добрый человек. Вот ${q.reward} монет, как уговаривались. Заходи ещё.`;
        } });
      } else if (q) {
        opts.push({ label: 'Насчёт работы...', act: () =>
          `${BEASTS[q.target].name}: убито ${q.have} из ${q.need}. Ступай, ${p.name}, деревня ждёт.` });
      } else if (npc.offer) {
        const o = npc.offer;
        opts.push({ label: `Берусь! (${BEASTS[o.target].name} ×${o.need})`, act: () => {
          p.quests.push({ villageId: v.id, villageName: v.name, target: o.target, need: o.need, have: 0,
            reward: o.reward, xp: o.xp, done: false });
          npc.offer = null;
          log(`Новое задание: ${BEASTS[o.target].name} ×${o.need} (${v.name}).`, C.gold);
          return 'Вот и славно. Да хранит тебя Бог.';
        } });
        opts.push({ label: 'Не сейчас.', act: () => { npc.offer = null; return 'Как знаешь. Надумаешь — приходи.'; } });
      } else {
        opts.push({ label: 'Нет ли для меня работы?', act: () => {
          const pool = QUEST_TEMPLATES.filter(t => t.target !== v.lastTarget);
          npc.offer = rng.pick(pool);
          v.lastTarget = npc.offer.target;
          return npc.offer.text;
        } });
      }
      break;
    }
    case 'priest': {
      opts.push({ label: 'Помолиться вместе (восстановить благодать)', act: () => {
        p.grace = p.maxGrace;
        return 'Вы долго молитесь вместе у алтаря. В груди разгорается тихий тёплый свет.';
      } });
      const price = p.priceBuy(5);
      opts.push({ label: `Попросить исцеления (пожертвовать ${price} мон.)`, act: pay(price, () => {
        p.hp = p.maxHp; p.poison = 0;
        return 'Священник возлагает руки тебе на голову и читает молитву. Раны затягиваются.';
      }) });
      break;
    }
    case 'innkeeper': {
      const total = Object.values(p.trophies).reduce((s, t) => s + p.priceSell(t.value) * t.count, 0);
      if (total > 0) opts.push({ label: `Продать трофеи (${total} мон.)`, act: () => {
        p.coins += total;
        p.trophies = {};
        log(`Трофеи проданы за ${total} монет.`, C.gold);
        return `${npc.title} придирчиво щупает шкуры, ворчит, но платит.`;
      } });
      const room = p.priceBuy(4);
      opts.push({ label: `Снять угол и выспаться (${room} мон.)`, act: pay(room, () => {
        sleepUntilMorning();
        return 'Ты спишь как убитый. Утром тебя будит петух и запах похлёбки.';
      }) });
      opts.push({ label: 'Кружку эля (1 мон.)', act: pay(1, () => {
        p.hp = Math.min(p.maxHp, p.hp + 2);
        return rng.pick([
          'Эль кислый, но тёплый. За соседним столом спорят, чей святой сильнее.',
          'Ты пьёшь. Какой-то пьяница шепчет тебе, что видел, как мельник вылизывал миску по-собачьи.',
          'Эль сносный. Менестрель в углу поёт про рыцаря, который женился на русалке. Кончилось плохо.',
        ]);
      }) });
      break;
    }
    case 'smith': {
      for (const [id, w] of Object.entries(WEAPONS)) {
        if (w.dmg[1] <= WEAPONS[p.weapon].dmg[1] || !w.price) continue;
        const price = p.priceBuy(w.price);
        opts.push({ label: `${w.name} (урон ${w.dmg[0]}–${w.dmg[1]}${w.acc ? ', меткость +' + w.acc : ''}) — ${price} мон.`,
          act: pay(price, () => { p.weapon = id; return `Держи. ${w.name} — добрая работа, не подведёт.`; }) });
      }
      for (const [id, a] of Object.entries(ARMORS)) {
        if (a.armor <= ARMORS[p.armorId].armor || !a.price) continue;
        const price = p.priceBuy(a.price);
        opts.push({ label: `${a.name} (защита ${a.armor}) — ${price} мон.`,
          act: pay(price, () => { p.armorId = id; return `${a.name} сидит как влитая. Носи на здоровье.`; }) });
      }
      break;
    }
    case 'herbalist': {
      const price = p.priceBuy(POTION_PRICE);
      opts.push({ label: `Целебный отвар — ${price} мон. (у тебя: ${p.potions})`, act: pay(price, () => {
        p.potions++;
        return 'Вот, держи. Пей, когда кровь пойдёт. Яд тоже снимает.';
      }) });
      if (p.poison > 0) opts.push({ label: 'Вывести яд (2 мон.)', act: pay(2, () => {
        p.poison = 0;
        return 'Знахарка поит тебя чем-то горьким. Через минуту дурнота отступает.';
      }) });
      break;
    }
  }

  opts.push({ label: 'Уйти', act: () => null });
  return opts;
}

// ─── Лист персонажа (+ повышение характеристик) ────────────────────

class CharacterScreen {
  constructor() { this.overlay = false; this.sel = 0; }

  key(k) {
    const p = G.player;
    if (isEsc(k) || k.code === 'KeyC') return popScreen();
    if (isUp(k)) this.sel = (this.sel + 3) % 4;
    else if (isDown(k)) this.sel = (this.sel + 1) % 4;
    else if (isEnter(k) && p.statPoints > 0) {
      const s = STATS[this.sel];
      const oldHp = p.maxHp, oldGrace = p.maxGrace;
      p.stats[s.key]++;
      p.statPoints--;
      p.hp += p.maxHp - oldHp;
      p.grace += p.maxGrace - oldGrace;
      log(`${s.name} растёт: теперь ${p.stats[s.key]}.`, C.gold);
    }
  }

  render(t) {
    const p = G.player;
    t.print(2, 1, p.name, C.gold);
    t.print(2 + p.name.length + 2, 1, `${p.people.name} · ${p.level}-й уровень`, C.dim);
    for (let i = 0; i < t.cols; i++) t.put(i, 2, '─', C.dark);

    t.print(3, 4, 'Характеристики', C.gold);
    if (p.statPoints > 0) t.print(20, 4, `(свободных очков: ${p.statPoints} — ↑↓ и Enter)`, C.green);
    STATS.forEach((s, i) => {
      const y = 6 + i * 3, sel = p.statPoints > 0 && i === this.sel;
      t.print(3, y, sel ? '►' : ' ', C.gold);
      t.print(5, y, s.name, sel ? C.gold : C.text);
      t.print(17, y, String(p.stats[s.key]).padStart(2), C.white);
      t.printWrap(5, y + 1, 52, s.desc, C.dim, 1);
    });

    const bx = 62;
    t.print(bx, 4, 'Показатели', C.gold);
    const w = WEAPONS[p.weapon];
    const rows = [
      ['Здоровье', `${p.hp}/${p.maxHp}`],
      ['Благодать', `${p.grace}/${p.maxGrace}`],
      ['Опыт', `${p.xp}/${p.xpNext}`],
      ['Меткость', p.hit],
      ['Уклонение', p.ev],
      ['Урон', `${Math.max(1, w.dmg[0] + p.dmgBonus(null))}–${w.dmg[1] + p.dmgBonus(null)}`],
      ['Защита', p.armor],
      ['Зрение день/ночь', `${p.sightDay}/${p.sightNight}`],
    ];
    rows.forEach(([k, v], i) => {
      t.print(bx, 6 + i, k, C.dim);
      t.print(bx + 20, 6 + i, String(v), C.text);
    });

    t.print(3, 19, 'Народ', C.gold);
    t.print(3, 20, `${p.people.name} (${p.people.land})`, C.text);
    t.printWrap(3, 21, 92, p.people.perk, C.green, 2);
    t.printWrap(3, 23, 92, p.people.lore, C.dim, 3);

    t.print(3, 27, 'Задания', C.gold);
    if (!p.quests.length) t.print(3, 28, 'Нет. Спроси у старост в деревнях.', C.dark);
    p.quests.forEach((q, i) => {
      t.print(3, 28 + i, `${q.villageName}: ${BEASTS[q.target].name} ${q.have}/${q.need}` + (q.done ? ' — выполнено!' : ''),
        q.done ? C.green : C.text);
    });
    t.print(2, t.rows - 1, 'Esc — назад', C.dim);
  }
}

// ─── Инвентарь ─────────────────────────────────────────────────────

class InventoryScreen {
  constructor() { this.overlay = false; }
  key(k) { if (isEsc(k) || k.code === 'KeyI') popScreen(); }

  render(t) {
    const p = G.player, w = WEAPONS[p.weapon], a = ARMORS[p.armorId];
    t.print(2, 1, 'Котомка', C.gold);
    for (let i = 0; i < t.cols; i++) t.put(i, 2, '─', C.dark);
    t.print(3, 4, 'Снаряжение', C.gold);
    t.print(5, 6, `Оружие: ${w.name} (урон ${w.dmg[0]}–${w.dmg[1]})`, C.text);
    t.print(5, 7, `Броня:  ${a.name} (защита ${a.armor})`, C.text);
    t.print(5, 9, `Монеты: ${p.coins}`, C.gold);
    t.print(5, 10, `Целебные отвары: ${p.potions}  (Q — выпить)`, C.text);

    t.print(3, 13, 'Трофеи', C.gold);
    const list = Object.values(p.trophies);
    if (!list.length) t.print(5, 15, 'Пусто. Трофеи со зверей можно продать в трактире.', C.dark);
    list.forEach((tr, i) => {
      t.print(5, 15 + i, `${tr.name} ×${tr.count}`, C.text);
      t.print(40, 15 + i, `${p.priceSell(tr.value)} мон./шт.`, C.dim);
    });
    t.print(2, t.rows - 1, 'Esc — назад', C.dim);
  }
}

// ─── Бестиарий ─────────────────────────────────────────────────────

class BestiaryScreen {
  constructor() { this.overlay = false; this.sel = 0; }

  key(k) {
    if (isEsc(k) || k.code === 'KeyX') return popScreen();
    if (isUp(k)) this.sel = (this.sel + BEAST_ORDER.length - 1) % BEAST_ORDER.length;
    else if (isDown(k)) this.sel = (this.sel + 1) % BEAST_ORDER.length;
  }

  render(t) {
    const p = G.player;
    const known = BEAST_ORDER.filter(k => p.seen[k]).length;
    t.print(2, 1, 'Бестиарий', C.gold);
    t.print(14, 1, `записей: ${known} из ${BEAST_ORDER.length}`, C.dim);
    for (let i = 0; i < t.cols; i++) t.put(i, 2, '─', C.dark);

    BEAST_ORDER.forEach((key, i) => {
      const d = BEASTS[key], seen = p.seen[key], sel = i === this.sel, y = 4 + i * 2;
      t.print(2, y, sel ? '►' : ' ', C.gold);
      t.put(4, y, seen ? d.glyph : '?', seen ? d.color : C.dark);
      t.print(6, y, seen ? d.name : '???', sel ? C.gold : seen ? C.text : C.dark);
      if (seen && d.unholy) t.print(26, y, '†', C.violet);
    });

    const key = BEAST_ORDER[this.sel], d = BEASTS[key], bx = 32, bw = 65;
    t.box(bx, 3, bw, 30, C.dark);
    if (!p.seen[key]) {
      t.print(bx + 3, 5, 'Ты ещё не встречал это существо.', C.dim);
      if (d.night) t.print(bx + 3, 7, 'Говорят, оно выходит лишь по ночам.', C.dark);
      return;
    }
    const kills = p.kills[key] || 0;
    const knows = kills > 0 || p.stats.wis >= d.lore;
    t.put(bx + 3, 5, d.glyph, d.color);
    t.print(bx + 5, 5, d.name, C.gold);
    if (d.unholy) t.print(bx + 5 + d.name.length + 2, 5, '† нечисть', C.violet);
    let y = 7;
    y += t.printWrap(bx + 3, y, bw - 6, d.desc, C.text) + 1;
    t.print(bx + 3, y, 'Обитает:', C.dim);
    t.print(bx + 14, y++, d.habitat.map(h => HABITAT[h]).join(', ') + (d.night ? ' (ночью)' : ''), C.text);
    t.print(bx + 3, y, 'Убито:', C.dim);
    t.print(bx + 14, y++, String(kills), C.text);
    y++;
    if (knows) {
      t.print(bx + 3, y++, 'Повадки', C.gold);
      t.print(bx + 3, y, 'Нрав:', C.dim); t.print(bx + 16, y++, BEHAVIOR_TEXT[d.behavior], C.text);
      t.print(bx + 3, y, 'Здоровье:', C.dim); t.print(bx + 16, y++, String(d.hp), C.text);
      t.print(bx + 3, y, 'Урон:', C.dim); t.print(bx + 16, y++, `${d.dmg[0]}–${d.dmg[1]}` + (d.poison ? ', ядовит' : ''), C.text);
      t.print(bx + 3, y, 'Шкура:', C.dim); t.print(bx + 16, y++, d.armor ? `толстая (${d.armor})` : 'обычная', C.text);
      t.print(bx + 3, y, 'Скорость:', C.dim);
      t.print(bx + 16, y++, d.speed > 105 ? 'быстрее человека' : d.speed < 95 ? 'медленнее человека' : 'как у человека', C.text);
      if (d.regen) { t.print(bx + 3, y, 'Особое:', C.dim); t.print(bx + 16, y++, 'раны затягиваются сами', C.text); }
      t.print(bx + 3, y, 'Трофей:', C.dim); t.print(bx + 16, y++, `${d.loot.name} (~${d.loot.value} мон.)`, C.text);
    } else {
      t.printWrap(bx + 3, y, bw - 6,
        `Повадки неизвестны. Убей такого зверя или развивай Мудрость (нужно ${d.lore}).`, C.dark);
    }
    t.print(2, t.rows - 1, '↑↓ выбор   Esc — назад', C.dim);
  }
}

// ─── Справка ───────────────────────────────────────────────────────

class HelpScreen {
  constructor() { this.overlay = false; }
  key() { popScreen(); }
  render(t) {
    t.print(2, 1, 'Управление', C.gold);
    for (let i = 0; i < t.cols; i++) t.put(i, 2, '─', C.dark);
    const lines = [
      ['Стрелки / цифры NumPad', 'ходьба (NumPad 7 9 1 3 — по диагонали)'],
      ['H J K L  Y U B N', 'ходьба в стиле vi'],
      ['Пробел / . / NumPad 5', 'ждать ход'],
      ['Идти на зверя', 'атаковать'],
      ['Идти на жителя', 'поговорить'],
      ['P', 'молитва: лечит и опаляет нечисть рядом (4 благодати)'],
      ['Q', 'выпить целебный отвар'],
      ['R', 'отдыхать, пока не восстановишься'],
      ['C', 'лист персонажа, повышение характеристик'],
      ['I', 'котомка: снаряжение и трофеи'],
      ['X', 'бестиарий'],
      ['? / F1', 'эта справка'],
    ];
    lines.forEach(([k, v], i) => {
      t.print(4, 4 + i * 2, k, C.gold);
      t.print(32, 4 + i * 2, v, C.text);
    });
    t.printWrap(4, 29, 92, 'Советы: звери не заходят в деревни. Ночью зрение слабеет, а из болот и чащи '
      + 'выходит нечисть — тогда лучше снять угол в трактире. Трофеи продаются трактирщику, '
      + 'оружие и броню куёт кузнец, отвары варит знахарка, а священник восстанавливает благодать.', C.dim);
    t.print(2, t.rows - 1, 'Любая клавиша — назад', C.dim);
  }
}

// ─── Смерть ────────────────────────────────────────────────────────

class DeathScreen {
  constructor() { this.overlay = false; this.time = Date.now(); }
  key(k) {
    if (Date.now() - this.time < 800) return;
    if (isEnter(k)) { G.screens = [new CreationScreen()]; G.screens[0].step = 1; }
  }
  render(t) {
    const p = G.player, ti = timeInfo();
    const totalKills = Object.values(p.kills).reduce((a, b) => a + b, 0);
    const art = [
      '      ┌───┐      ',
      '      │ † │      ',
      '  ┌───┘   └───┐  ',
      '  │  R. I. P. │  ',
      '  └───┐   ┌───┘  ',
      '      │   │      ',
      '      │   │      ',
      ' ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ ',
    ];
    art.forEach((l, i) => t.printCenter(3 + i, l, C.stone));
    t.printCenter(13, `Здесь покоится ${p.name}, ${p.people.name.toLowerCase()}.`, C.gold);
    t.printCenter(15, `Погиб на ${ti.day}-й день странствий. Причина: ${G.deathCause || 'неизвестна'}.`, C.text);
    t.printCenter(16, `Уровень: ${p.level}.   Зверей убито: ${totalKills}.   Монет: ${p.coins}.`, C.dim);
    const lines = BEAST_ORDER.filter(k => p.kills[k]).map(k => `${BEASTS[k].name}: ${p.kills[k]}`);
    if (lines.length) t.printCenter(18, lines.join(' · '), C.dim);
    t.printCenter(22, 'Requiescat in pace.', C.violet);
    t.printCenter(t.rows - 4, 'Enter — новый путник', C.gold);
  }
}
