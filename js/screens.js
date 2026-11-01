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
    this.step = 0;           // 0 титул, 1 народ, 2 предыстория, 3 характеристики, 4 имя, 5 итог
    this.peopleIdx = 0;
    this.bgIdx = 0;
    this.statIdx = 0;
    this.alloc = Object.fromEntries(STATS.map(s => [s.key, STAT_BASE]));
    this.name = '';
    this.warn = '';
  }

  get people() { return PEOPLES[this.peopleIdx]; }
  get bg() { return BACKGROUNDS[this.bgIdx]; }
  get pointsLeft() {
    return STAT_POINTS - STATS.reduce((s, st) => s + this.alloc[st.key] - STAT_BASE, 0);
  }
  finalStat(k) { return this.alloc[k] + (this.people.mods[k] || 0); }

  // Быстрый старт для проверки: случайный народ, характеристики и имя.
  quickStart() {
    this.peopleIdx = rng.int(0, PEOPLES.length - 1);
    this.bgIdx = rng.int(0, BACKGROUNDS.length - 1);
    this.randomize();
    this.name = rng.pick(peopleNames(this.people).m);
    const stats = {};
    for (const s of STATS) stats[s.key] = this.finalStat(s.key);
    startGame(new Player(this.name, this.people, stats, this.bg));
    log(`Быстрый старт: ${this.people.name.toLowerCase()} ${this.name}, ${this.bg.name.toLowerCase()}.`, C.dim);
  }

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
    if (this.step === 0) {
      if (k.code === 'KeyQ') return this.quickStart();
      if (G.saveMeta && isEnter(k)) { loadGame(); return; }
      if (G.saveMeta && k.code !== 'KeyN') return;
      this.step = 1;
      return;
    }
    if (isEsc(k) && this.step > 1) { this.step--; return; }

    if (this.step === 1) {
      if (isUp(k)) this.peopleIdx = (this.peopleIdx + PEOPLES.length - 1) % PEOPLES.length;
      else if (isDown(k)) this.peopleIdx = (this.peopleIdx + 1) % PEOPLES.length;
      else if (digitOf(k) && digitOf(k) <= PEOPLES.length) this.peopleIdx = digitOf(k) - 1;
      else if (isEnter(k)) this.step = 2;
    } else if (this.step === 2) {
      if (isUp(k)) this.bgIdx = (this.bgIdx + BACKGROUNDS.length - 1) % BACKGROUNDS.length;
      else if (isDown(k)) this.bgIdx = (this.bgIdx + 1) % BACKGROUNDS.length;
      else if (digitOf(k) && digitOf(k) <= BACKGROUNDS.length) this.bgIdx = digitOf(k) - 1;
      else if (isEnter(k)) this.step = 3;
    } else if (this.step === 3) {
      const s = STATS[this.statIdx].key;
      if (isUp(k)) this.statIdx = (this.statIdx + STATS.length - 1) % STATS.length;
      else if (isDown(k)) this.statIdx = (this.statIdx + 1) % STATS.length;
      else if (isLeft(k) || k.key === '-') {
        if (this.alloc[s] > STAT_MIN) this.alloc[s]--;
      } else if (isRight(k) || k.key === '+' || k.key === '=') {
        if (this.alloc[s] < STAT_MAX && this.pointsLeft > 0) this.alloc[s]++;
      } else if (k.code === 'KeyR') this.randomize();
      else if (isEnter(k)) {
        if (this.pointsLeft > 0) this.warn = `Осталось нераспределённых очков: ${this.pointsLeft}.`;
        else this.step = 4;
      }
    } else if (this.step === 4) {
      if (isEnter(k)) {
        if (!this.name.trim()) this.name = rng.pick(peopleNames(this.people).m);
        this.name = this.name.trim();
        this.step = 5;
      } else if (k.code === 'Backspace') this.name = this.name.slice(0, -1);
      else if (k.code === 'Tab') this.name = rng.pick(peopleNames(this.people).m);
      else if (k.key && k.key.length === 1 && this.name.length < 20 && /[\p{L}\- ']/u.test(k.key))
        this.name += k.key;
    } else if (this.step === 5) {
      if (isEnter(k)) {
        const stats = {};
        for (const s of STATS) stats[s.key] = this.finalStat(s.key);
        startGame(new Player(this.name, this.people, stats, this.bg));
      }
    }
  }

  wantsText() { return this.step === 4; }

  render(t) {
    if (this.step === 0) return this.renderTitle(t);
    const steps = ['Народ', 'Предыстория', 'Характеристики', 'Имя', 'Итог'];
    let x = 3;
    t.print(2, 1, 'СОЗДАНИЕ ГЕРОЯ', C.gold);
    x = 20;
    steps.forEach((s, i) => {
      const cur = i + 1 === this.step;
      x += t.print(x, 1, `${i + 1}. ${s}`, cur ? C.gold : i + 1 < this.step ? C.text : C.dark) + 4;
    });
    for (let i = 0; i < t.cols; i++) t.put(i, 2, '─', C.dark);

    if (this.step === 1) this.renderPeople(t);
    else if (this.step === 2) this.renderBackground(t);
    else if (this.step === 3) this.renderStats(t);
    else if (this.step === 4) this.renderName(t);
    else this.renderSummary(t);

    if (this.warn) t.printCenter(t.rows - 3, this.warn, C.red);
  }

  renderTitle(t) {
    const y0 = 7;
    TITLE_ART.forEach((line, i) => t.printCenter(y0 + i, line, C.gold));
    t.printCenter(y0 + 3, 'Италия, лето Господне 1247-е', C.dim);
    const intro = 'Италия разорвана надвое. Император Фридрих II, отлучённый от церкви, осаждает Парму; '
      + 'папа бежал в Лион; гвельфы и гибеллины режут друг друга на дорогах. Пока люди воюют, '
      + 'в Апеннинах воют лупо маннаро, ведьмы слетаются к ореху Беневенто, а в озере Джерундо '
      + 'просыпается змей. Ты — чужеземец без господина и без дома, и тебе предстоит пройти эту землю насквозь.';
    const lines = wrapText(intro, 70);
    lines.forEach((l, i) => t.print(15, y0 + 6 + i, l, C.text));
    t.printCenter(y0 + 7 + lines.length + 2, '†', C.gold);
    if (Math.floor(Date.now() / 600) % 2 === 0)
      t.printCenter(t.rows - 5, G.saveMeta ? '' : '— нажми любую клавишу —', C.dim);
    t.printCenter(t.rows - 3, 'Q — быстрый старт: случайный герой', C.dim);
    const m = G.saveMeta;
    if (m) {
      t.printCenter(t.rows - 7, `Enter — продолжить: ${m.name}, ${m.people.toLowerCase()}, ${m.level}-й ур., день ${m.day}, ${m.region}`, C.gold);
      t.printCenter(t.rows - 5, 'N — новый герой (сохранение перезапишется)', C.dim);
    }
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
    t.print(bx + 2, y++, 'Начало пути:', C.dim);
    t.printWrap(bx + 4, y, 43, p.perk, C.gold);
    t.print(3, t.rows - 2, '↑↓ выбор   Enter — далее', C.dim);
  }

  renderBackground(t) {
    t.print(3, 4, 'Чем ты жил раньше?', C.text);
    BACKGROUNDS.forEach((b, i) => {
      const sel = i === this.bgIdx;
      t.print(3, 6 + i * 2, sel ? '►' : ' ', C.gold);
      t.print(5, 6 + i * 2, `${i + 1}. ${b.name}`, sel ? C.gold : C.text);
    });
    const b = this.bg, bx = 34;
    t.box(bx, 4, 63, 20, C.dark, b.name);
    let y = 6;
    y += t.printWrap(bx + 2, y, 59, b.lore, C.text) + 1;
    t.print(bx + 2, y++, 'Навыки:', C.dim);
    for (const [k, v] of Object.entries(b.skills)) {
      t.print(bx + 4, y, `${SKILLS[k].name} ${v}`, C.green);
      y += t.printWrap(bx + 24, y, 37, SKILLS[k].desc, C.dim);
    }
    const extra = [...(b.gear || []).map(k => ITEMS[k].name.toLowerCase()), ...Object.entries(b.ammo || {}).map(([a, n]) => `${AMMO[a].name.toLowerCase()} ×${n}`),
      b.coins && `+${b.coins} мон.`, b.rations && `+${b.rations} дн. провианта`, b.piety && `+${b.piety} благочестия`].filter(Boolean);
    if (extra.length) { y++; t.print(bx + 2, y++, 'С собой:', C.dim); t.printWrap(bx + 4, y, 57, extra.join(', '), C.gold); }
    t.print(3, t.rows - 2, '↑↓ выбор   Enter — далее   Esc — назад   Навыки растут от дела: кто рубит — лучше рубит', C.dim);
  }

  renderStats(t) {
    const left = this.pointsLeft;
    t.print(3, 4, 'Распредели очки. Свободных очков: ', C.text);
    t.print(37, 4, String(left), left ? C.gold : C.green);
    STATS.forEach((s, i) => {
      const y = 6 + i * 3, sel = i === this.statIdx;
      const base = this.alloc[s.key], mod = this.people.mods[s.key] || 0;
      t.print(3, y, sel ? '►' : ' ', C.gold);
      t.print(5, y, s.name, sel ? C.gold : C.text);
      t.print(17, y, '◄', base > STAT_MIN ? C.text : C.dark);
      t.print(19, y, String(base).padStart(2), C.white);
      t.print(22, y, '►', base < STAT_MAX && left > 0 ? C.text : C.dark);
      if (mod) t.print(25, y, signed(mod), mod > 0 ? C.green : C.red);
      t.print(29, y, '= ' + this.finalStat(s.key), C.gold);
      for (let k = 0; k < 14; k++) t.put(35 + k, y, k < this.finalStat(s.key) ? '■' : '·', k < this.finalStat(s.key) ? C.brown : C.dark);
      t.printWrap(7, y + 1, 48, s.desc, C.dim, 2);
    });

    // Предпросмотр производных значений.
    const tmp = new Player('', this.people, Object.fromEntries(STATS.map(s => [s.key, this.finalStat(s.key)])));
    const bx = 56;
    t.box(bx, 4, 41, 23, C.dark, 'Что это даст');
    const rows = [
      ['Здоровье', tmp.maxHp],
      ['Благодать', tmp.maxGrace],
      ['Зрение днём', tmp.sightDay],
      ['Зрение ночью', tmp.sightNight],
      ['Меткость', tmp.hit],
      ['Уклонение', tmp.ev],
      ['Бонус к урону', signed(tmp.dmgBonus(null))],
      ['Сила молитвы', `${2 + Math.floor(tmp.stats.fai / 2) + prayerPower(tmp)}–${5 + Math.floor(tmp.stats.fai / 2) + prayerPower(tmp)}`],
      ['Благочестие', `${tmp.piety} (${pietyRank(tmp.piety).toLowerCase()})`],
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
    t.print(3, 11, 'Пустое имя — выберем сами. Tab — случайное имя, как зовут в твоих краях.', C.dim);
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
    t.print(3, 15, 'Начало пути:', C.dim);
    t.printWrap(3, 16, 60, p.perk, C.text);
    t.print(3, 18, `Предыстория: ${this.bg.name} (${bgSkillsText(this.bg)})`, C.text);
    t.print(3, 19, 'С собой: дубина, нож, факел, 15 монет, 2 целебных отвара — и то, что дала предыстория.', C.dim);
    const city = CITY_BY_ID[p.start];
    t.printWrap(3, 21, 90, `Твой путь начинается в городе ${city.name}. Поговори с горожанами, загляни в палаццо — `
      + 'у властей может найтись работа. За стенами — вся Италия: дороги, леса, горы и то, что в них водится.', C.text);
    t.print(3, t.rows - 2, 'Enter — начать путь   Esc — назад', C.gold);
  }
}

// ─── Диалог с жителем ──────────────────────────────────────────────

// Простой выбор из нескольких действий.
class ChoiceScreen {
  constructor(title, options) {
    this.overlay = true;
    this.title = title;
    this.options = options;
    this.sel = 0;
  }

  key(k) {
    const d = digitOf(k), n = this.options.length;
    if (isEsc(k)) return popScreen();
    if (isUp(k)) this.sel = (this.sel + n - 1) % n;
    else if (isDown(k)) this.sel = (this.sel + 1) % n;
    else if (isEnter(k)) this.choose(this.sel);
    else if (d && d <= n) this.choose(d - 1);
  }

  choose(i) {
    popScreen();
    this.options[i].act();
  }

  render(t) {
    const w = Math.max(30, ...this.options.map(o => o.label.length + 10)), h = this.options.length + 5;
    const x = Math.floor((MAP_W - w) / 2) + 1, y = Math.max(1, Math.floor((MAP_H - h) / 2));
    t.box(x, y, w, h, C.dim, this.title);
    this.options.forEach((o, i) => {
      const sel = i === this.sel;
      t.print(x + 3, y + 2 + i, `${sel ? '►' : ' '} ${i + 1}. ${o.label}`, sel ? C.gold : C.text);
    });
    t.print(x + 3, y + h - 2, 'Esc — отмена', C.dim);
  }
}

class DialogScreen {
  constructor(npc) {
    this.overlay = true;
    this.npc = npc;
    this.text = speak(npc, greetingFor(npc));
    this.sel = 0;
    this.sub = null;   // открытый раздел меню (пожертвования, просьбы, ночлег)
    this.build();
  }

  build() {
    this.options = npcOptions(this.npc, this);
    if (this.sel >= this.options.length) this.sel = 0;
  }

  key(k) {
    const d = digitOf(k);
    if (isEsc(k)) return this.npc.noEscape ? null : popScreen();
    if (isUp(k)) this.sel = (this.sel + this.options.length - 1) % this.options.length;
    else if (isDown(k)) this.sel = (this.sel + 1) % this.options.length;
    else if (isEnter(k)) this.choose(this.sel);
    else if (d && d <= this.options.length) this.choose(d - 1);
  }

  choose(i) {
    const res = this.options[i].act();
    if (res === null) return popScreen();
    if (typeof res === 'string') this.text = speak(this.npc, res);
    this.build();
  }

  render(t) {
    const w = 70;
    const textLines = wrapText(this.text, w - 6);
    const h = 7 + textLines.length + this.options.length;
    const x = Math.floor((MAP_W - w) / 2) + 1, y = Math.max(1, Math.floor((MAP_H - h) / 2));
    const n = this.npc;
    t.box(x, y, w, h, C.dim, `${n.name}, ${n.title.toLowerCase()} (${n.village.city.name})`);
    textLines.forEach((l, i) => t.print(x + 3, y + 2 + i, l, C.text));
    const oy = y + 3 + textLines.length;
    this.options.forEach((o, i) => {
      const sel = i === this.sel;
      t.print(x + 3, oy + i, `${sel ? '►' : ' '} ${i + 1}. ${o.label}`, o.disabled ? C.dark : sel ? C.gold : C.text);
    });
    t.print(x + 3, y + h - 2, `Монеты: ${G.player.coins}`, C.dim);
  }
}

// Имам Лючеры: ни мессы, ни реликвий, ни святых — разговор о вере, лекарь, милостыня.
function imamOptions(npc) {
  const p = G.player;
  const opts = [{ label: 'Что нового в округе?', act: () => newsReply(npc) }, { label: 'Как живёт ваша община?', act: () => lifeReply(npc) },
    ...questOptions(npc), ...wayOptions(npc),
    { label: p.is('saracen') ? 'Поговорить о вере' : 'Расскажи о вашей вере', act: () => '«' + rng.pick(IMAM_LORE) + '»' }, ...lettersLesson(npc)];
  if (p.is('saracen')) {
    const { day } = timeInfo(), friday = today().wd === 5;
    opts.push({ label: friday ? 'Пятничная молитва в мечети' : 'Помолиться в мечети', act: () => {
      if (p.mosqueDay === day) return '«Ты уже молился с нами сегодня, брат. Ступай с миром».';
      p.mosqueDay = day;
      p.lastPractice = day;
      passTime(30);
      p.grace = friday ? p.maxGrace : Math.min(p.maxGrace, p.grace + Math.ceil(p.maxGrace / 2));
      if (p.piety < 80) addPiety(friday ? 2 : 1, friday ? 'Пятничная молитва.' : 'Молитва в мечети.');
      return friday ? 'Мечеть полна: весь город на пятничной молитве. Имам читает хутбу — и поминает в ней императора. Выходишь, будто умытый.'
        : 'Ты совершаешь омовение и встаёшь в ряд с другими. Тишина, шорох циновок, слова, которые знаешь с детства.';
    } });
  }
  const price = p.priceBuy(9);
  opts.push({ label: `Позвать лекаря при мечети (${price} мон.)`, act: () => {
    if (p.coins < price) return 'Лекарю надо платить, путник. Приходи, когда будут деньги.';
    p.coins -= price;
    p.hp = p.maxHp; p.poison = 0; p.fever = 0;
    return 'Лекарь-сарацин промывает раны уксусом, прикладывает травы и что-то тихо говорит по-арабски. Боль уходит.';
  } });
  opts.push({ label: 'Подать милостыню бедным общины (3 мон.)', act: () => {
    if (p.coins < 3) return 'Имам качает головой: «Сперва накорми себя, путник».';
    p.coins -= 3;
    const week = Math.floor(timeInfo().day / 7);
    if (p.almsImam !== week) { p.almsImam = week; addPiety(1, 'Милостыня — добро при любой вере.'); }
    return '«Да вознаградит тебя Аллах. Милостыня не спрашивает, какой веры рука, что её подаёт».';
  } });
  return opts;
}

function npcOptions(npc, dlg) {
  const p = G.player, opts = [];
  const pay = (price, fn) => () => {
    if (p.coins < price) return 'Денег не хватает. ' + (npc.role === 'priest' ? 'Храм живёт лептой прихожан, сын мой. Приходи, когда будет чем пожертвовать.' : 'В долг не даю.');
    p.coins -= price;
    return fn();
  };

  if (npc.emperor) return emperorOptions(npc);
  if (npc.fairRole) return fairOptions(npc);
  if (npc.hap && npc.hapRole) return happeningOptions(npc) || [];
  if (npc.special === 'traveler') return travelerOptions(npc);
  if (npc.role === 'alchemist') return alchemistOptions(npc);
  if (npc.teacher) return teacherOptions(npc);
  if (npc.fib) return fibOptions(npc);
  if (npc.verona) return veronaOptions(npc);
  if (npc.louis) return louisOptions(npc);
  if (npc.inquisitor) return inquisitorOptions(npc);
  if (npc.librarian) return [{ label: 'Что нового?', act: () => newsReply(npc) }, ...libraryOptions(npc), { label: 'Уйти', act: () => null }];
  if (cultNpc(npc)) return cultNpcOptions(npc);
  if (npc.role === 'legate') return legateOptions(npc);
  if (npc.role === 'spirit') return spiritOptions(npc);
  if (npc.role === 'priest' && isSaracen(npc)) return imamOptions(npc);
  if (npc.role === 'pope') return popeOptions(npc);
  if (npc.role === 'flamen')
    return [{ label: 'Что нового в округе?', act: () => newsReply(npc) }, { label: 'Как вы здесь живёте?', act: () => lifeReply(npc) },
      ...flamenOptions(npc)];
  // Отшельник ушёл от мира — вестей не знает и не ищет.
  if (npc.role === 'hermit')
    return [{ label: 'Как живёшь здесь, отче?', act: () => lifeReply(npc) }, ...hermitOptions(npc)];
  // Разделы меню (пожертвования, просьбы, ночлег): внутри — варианты и «Назад».
  const back = { label: 'Назад', act: () => { if (dlg) { dlg.sub = null; dlg.sel = 0; } } };
  const open = (label, key) => ({ label, act: () => { if (dlg) { dlg.sub = key; dlg.sel = 0; } } });
  if (dlg && dlg.sub) {
    const list = dlg.sub === 'donate' ? donationOptions(npc)
      : dlg.sub === 'help' ? priestHelp(npc, pay)
        : dlg.sub === 'inn' ? innServices(npc, pay) : [];
    if (list.length) return [...list, back];
    dlg.sub = null;
  }
  opts.push({
    label: 'Что нового в округе?',
    act: () => newsReply(npc),
  });
  opts.push({ label: 'Как жизнь?', act: () => lifeReply(npc) });
  if (['elder', 'merchant', 'innkeeper', 'peasant', 'boatman', 'smith'].includes(npc.role) && ['city', 'town', 'village'].includes(npc.village.city.kind))
    opts.push({ label: 'Чем славятся ваши края?', act: () => localGoodsTalk(npc) });
  opts.push(...questOptions(npc));
  opts.push(...wayOptions(npc), ...castellanOptions(npc), ...bountyOptions(npc), ...happeningExtraOptions(npc), ...veronaExtraOptions(npc));

  switch (npc.role) {
    case 'priest': {
      if (p.is('saracen')) {
        // Мусульманину в церкви — только поговорить и попросить помощи.
        const price = p.priceBuy(12);
        opts.push({ label: `Попросить исцеления (пожертвовать ${price} мон.)`, act: pay(price, () => {
          p.hp = p.maxHp; p.poison = 0; p.fever = 0;
          passTime(30);
          return 'Священник смотрит на тебя с сомнением, но всё же перевязывает раны. «Господь милостив и к неверным. Подумай об этом».';
        }) });
        break;
      }
      { const mass = massOption(npc); if (mass) opts.splice(2, 0, mass); }
      opts.push(...crusadeOptions(npc), ...shrineOptions(npc));
      opts.push(tradeOption(npc, 'Святыни и реликвии'));
      opts.push(open('Попросить о помощи…', 'help'));
      if (donationOptions(npc).length) opts.push(open('Пожертвовать…', 'donate'));
      break;
    }
    case 'innkeeper': {
      opts.push(tradeOption(npc, 'Торговать: еда, вино, трофеи'));
      opts.push(open('Ночлег, еда и вино…', 'inn'));
      break;
    }
    case 'smith':
      opts.push(tradeOption(npc, 'Торговать: оружие, доспехи, железо'));
      break;
    case 'herbalist': {
      opts.push(...honeyOption(npc));
      opts.push(tradeOption(npc, `Торговать: отвары (у тебя ${p.potions}), травы, снадобья`));
      if (p.poison > 0) opts.push({ label: 'Вывести яд (2 мон.)', act: pay(2, () => {
        p.poison = 0;
        return 'Знахарка поит тебя чем-то горьким. Через минуту дурнота отступает.';
      }) });
      break;
    }
  }

  if (npc.role === 'merchant') {
    opts.splice(1, 0, tradeOption(npc, 'Посмотреть товар'),
      { label: 'Дашь совет, где торговать?', act: () => merchantAdvice(npc) });
  }
  if (npc.role === 'elder' && npc.village.city.kind === 'village')
    opts.splice(1, 0, tradeOption(npc, 'Купить у деревни припасов'));

  if (npc.role === 'boatman') {
    const id = npc.village.city.id;
    for (const [a, b, days, cost] of SEA_ROUTES) {
      if (a !== id && b !== id) continue;
      const dest = CITY_BY_ID[a === id ? b : a], price = p.priceBuy(cost);
      const time = days < 1 ? 'полдня' : `${days} дн.`;
      opts.push({ label: `Отплыть в ${cityAcc(dest.name)} (${time}, ${price} мон.)`, act: pay(price, () => {
        sailTo(dest.id, days);
        return null;
      }) });
    }
  }

  opts.push({ label: 'Уйти', act: () => null });
  return opts;
}

// Трактир: ночлег, еда, вино (раздел меню трактирщика).
function innServices(npc, pay) {
  const p = G.player, opts = [];
  opts.push(...stableOptions(npc));
      const room = p.priceBuy(p.mount ? 9 : 6);
      opts.push({ label: `Снять угол и выспаться (${room} мон.${p.mount ? ', с конюшней' : ''})`, act: pay(room, () => {
        if (p.mount) p.mount.stabled = timeInfo().day;
        sleepUntilMorning();
        return 'Ты спишь как убитый. Утром тебя будит петух и запах похлёбки.';
      }) });
      opts.push(tavernMealOption(npc, pay));
      if (isSaracen(npc)) opts.push({ label: 'Чашку шербета (1 мон.)', act: pay(1, () => {
        passTime(30);
        p.hp = Math.min(p.maxHp, p.hp + 2);
        return rng.pick(['Шербет из розовой воды с лимоном, холодный, как родник. За соседним ковром старики играют в шахматы — тоже сарацинская выдумка.',
          'Ты пьёшь сладкий шербет. Сарацинский лучник рассказывает, как под Пармой видел самого императора — с соколом на руке.']);
      }) });
      else opts.push({ label: 'Кружку вина (1 мон.)', act: pay(1, () => {
        passTime(30);
        p.hp = Math.min(p.maxHp, p.hp + 2);
        return rng.pick([
          'Вино молодое, разбавленное водой. За соседним столом спорят, чей святой сильнее.',
          'Ты пьёшь. Старик у очага вполголоса рассказывает, что на старом кладбище за рекой по ночам горит свет.',
          'Вино терпкое, деревенское. Жонглёр в углу поёт о рыцаре, что взял в жёны речную деву и сгинул вместе с ней.',
        ]);
      }) });
  return opts;
}

// Просьбы к священнику: исцеление, молитва, грамота, служба братьев.
function priestHelp(npc, pay) {
  const p = G.player, opts = [];
  const price = p.priceBuy(8);
  opts.push({ label: `Попросить исцеления (пожертвовать ${price} мон.)`, act: pay(price, () => {
    p.hp = p.maxHp; p.poison = 0; p.fever = 0;
    passTime(30);
    return 'Священник возлагает руки тебе на голову и читает молитву. Раны затягиваются.';
  }) });
  opts.push({ label: 'Помолиться вместе', act: () => {
    const day = timeInfo().day;
    if (p.prayedWithPriest === day) return 'Мы уже молились сегодня. Господь слышал нас — приходи завтра.';
    p.prayedWithPriest = day;
    p.lastPractice = day;
    passTime(30);
    p.grace = Math.min(p.maxGrace, p.grace + Math.ceil(p.maxGrace / 2));
    return 'Вы молитесь вместе у алтаря. В груди разгорается тихий тёплый свет.';
  } });
  opts.push(...lettersLesson(npc), ...abbotOptions(npc));
  return opts;
}

function tradeOption(npc, label) {
  return { label, act: () => {
    pushScreen(new TradeScreen(npc));
    return rng.pick(['Смотри, выбирай.', 'Цены честные, клянусь святым Николаем.', 'Товар добрый, смотри не спеша.']);
  } };
}

// ─── Лист персонажа (+ повышение характеристик) ────────────────────

class CharacterScreen {
  constructor() { this.overlay = false; this.sel = 0; }

  key(k) {
    const p = G.player;
    if (isEsc(k) || k.code === 'KeyC') return popScreen();
    if (isUp(k)) this.sel = (this.sel + STATS.length - 1) % STATS.length;
    else if (isDown(k)) this.sel = (this.sel + 1) % STATS.length;
    else if (isEnter(k) && p.statPoints > 0) {
      const s = STATS[this.sel];
      const oldHp = p.maxHp, oldGrace = p.maxGrace;
      p.base[s.key]++;
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
      const y = 6 + i * 2, sel = p.statPoints > 0 && i === this.sel;
      t.print(3, y, sel ? '►' : ' ', C.gold);
      t.print(5, y, s.name, sel ? C.gold : C.text);
      t.print(17, y, String(p.stats[s.key]).padStart(2), C.white);
      t.printWrap(21, y, 38, s.desc, C.dim, 2);
    });

    const bx = 62;
    t.print(bx, 4, 'Показатели', C.gold);
    const w = p.weaponDef;
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

    t.print(bx, 15, 'Вера', C.gold);
    const saint = p.patron && SAINTS[p.patron];
    t.print(bx, 16, 'Благочестие', C.dim);
    t.print(bx + 20, 16, `${p.piety} · ${pietyRank(p.piety).toLowerCase()}`, C.text);
    t.print(bx, 17, 'Молитву услышат', C.dim);
    t.print(bx + 20, 17, `${Math.round(prayerChance(p) * 100)}%`, C.text);
    t.print(bx, 18, 'Покровитель', C.dim);
    t.print(bx + 20, 18, saint ? saint.name.replace('Святой ', 'св. ') : 'нет', saint ? saint.color : C.dark);
    if (saint) {
      t.print(bx, 19, 'Милость святого', C.dim);
      t.print(bx + 20, 19, `${p.favor}/${FAVOR_COST} на чудо`, p.favor >= FAVOR_COST ? C.gold : C.text);
      t.printWrap(bx, 20, 36, saint.passiveText, C.green, 2);
    } else t.printWrap(bx, 19, 36, 'Обретается паломничеством к мощам святого.', C.dark, 2);

    t.print(3, 21, 'Народ', C.gold);
    t.print(3, 22, `${p.people.name} (${p.people.land})`, C.text);
    t.printWrap(3, 23, 92, p.people.perk, C.green, 2);
    t.printWrap(3, 25, 92, p.people.lore, C.dim, 3);

    t.print(3, 29, 'Задания', C.gold);
    if (!p.quests.length) t.print(3, 30, 'Нет. Спроси работу у старост, трактирщиков, кузнецов, травниц и священников.', C.dark);
    p.quests.forEach((q, i) => {
      t.print(3, 30 + i, questLine(q).slice(0, 94),
        q.done ? C.green : C.text);
    });
    t.print(2, t.rows - 1, 'Esc — назад', C.dim);
  }
}

// ─── Бестиарий ─────────────────────────────────────────────────────

// Где водится зверь — для бестиария.
function beastRange(d) {
  if (d.site) return SITES.find(s => s.id === d.site).name;
  if (!d.regions) return 'вся Италия';
  for (const [g, name] of [['mainland', 'вся материковая Италия'], ['north', 'Северная Италия'], ['isles', 'Сардиния и Корсика']])
    if (REGION_GROUPS[g].length === d.regions.length && REGION_GROUPS[g].every(r => d.regions.includes(r))) return name;
  return d.regions.map(r => REGIONS[r].name).join(', ');
}

// Бестиарий — книга: оглавление с главами (Звери, Люди, Дивные, Нечисть, Чудовища…),
// в главе — слева список записей, справа запись. Главы берутся из BEAST_CATS:
// новая глава появится сама, как только у существ будет новая категория.
const BEAST_CHAPTERS = {
  'Звери': 'О тварях земных, что бегают, ползают и летают, — от пугливого зайца до медведя, хозяина гор.',
  'Люди': 'О людях, что сделались хуже зверей: разбойниках, мародёрах и прочих, кто поднимает руку на путника.',
  'Дивные': 'О народце дивном, что живёт рядом с людьми: проказники, лесные хозяева и певуньи у воды. Не всякого из них должно убивать.',
  'Нечисть': 'О нечистой силе, что выходит в темноте: упырях, призраках и ведьмах. Против неё — молитва и крепкий меч.',
  'Чудовища': 'О чудовищах великих и древних, о коих поют в балладах. Встретить такое — к беде или к славе.',
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

class BestiaryScreen {
  constructor() {
    this.overlay = false;
    this.chapters = BEAST_CATS.map(c => ({ name: c, keys: BEAST_ORDER.filter(k => BEASTS[k].cat === c) })).filter(c => c.keys.length);
    this.ch = -1;       // -1 — оглавление
    this.csel = 0;      // выбранная глава в оглавлении
    this.sel = 0;       // запись в главе
  }

  open(i) { this.ch = (i + this.chapters.length) % this.chapters.length; this.csel = this.ch; this.sel = 0; }

  key(k) {
    const d = digitOf(k);
    if (this.ch < 0) {
      const n = this.chapters.length;
      if (isEsc(k) || k.code === 'KeyX') return popScreen();
      if (isUp(k)) this.csel = (this.csel + n - 1) % n;
      else if (isDown(k)) this.csel = (this.csel + 1) % n;
      else if (isEnter(k) || isRight(k)) this.open(this.csel);
      else if (d && d <= n) this.open(d - 1);
      return;
    }
    const n = this.chapters[this.ch].keys.length;
    if (k.code === 'KeyX') return popScreen();
    if (isEsc(k)) { this.ch = -1; return; }
    if (isUp(k)) this.sel = (this.sel + n - 1) % n;
    else if (isDown(k)) this.sel = (this.sel + 1) % n;
    else if (isLeft(k)) this.open(this.ch - 1);
    else if (isRight(k)) this.open(this.ch + 1);
  }

  // Разворот книги: рамка и корешок.
  spread(t, spine) {
    const X = 1, Y = 1, W = t.cols - 2, H = t.rows - 3;
    t.box(X, Y, W, H, C.dark);
    for (let y = Y + 1; y < Y + H - 1; y++) t.put(spine, y, '┃', C.dark);
    t.put(spine, Y, '┳', C.dark); t.put(spine, Y + H - 1, '┻', C.dark);
    return { X, Y, W, H };
  }

  render(t) {
    const p = G.player;
    const known = BEAST_ORDER.filter(k => p.seen[k]).length;
    const spine = 36, { Y, W, H } = this.spread(t, spine);
    if (this.ch < 0) {
      // Левая страница — оглавление.
      t.print(4, Y + 2, 'LIBER BESTIARUM', C.gold);
      t.print(4, Y + 3, 'Книга о тварях Италии', C.dim);
      t.print(4, Y + 5, 'Оглавление', C.text);
      this.chapters.forEach((c, i) => {
        const y = Y + 7 + i * 2, sel = i === this.csel, have = c.keys.filter(k => p.seen[k]).length;
        const head = `${ROMAN[i] || i + 1}. ${c.name}`, tail = `${have}/${c.keys.length}`;
        t.print(3, y, sel ? '►' : ' ', C.gold);
        t.print(5, y, head, sel ? C.gold : C.text);
        t.print(5 + head.length + 1, y, '.'.repeat(Math.max(1, spine - 9 - head.length - tail.length)), C.dark);
        t.print(spine - 2 - tail.length, y, tail, have ? C.text : C.dark);
      });
      t.print(4, Y + H - 3, `Записано: ${known} из ${BEAST_ORDER.length}`, C.dim);
      // Правая страница — о выбранной главе.
      const c = this.chapters[this.csel], rx = spine + 4, rw = W - spine - 6;
      t.print(rx, Y + 2, `Глава ${ROMAN[this.csel] || this.csel + 1}`, C.dim);
      t.print(rx, Y + 3, c.name, C.gold);
      let y = Y + 5;
      y += t.printWrap(rx, y, rw, BEAST_CHAPTERS[c.name] || '', C.text) + 1;
      const seen = c.keys.filter(k => p.seen[k]);
      if (seen.length) {
        t.print(rx, y++, 'Встречены:', C.dim);
        y += t.printWrap(rx, y, rw, seen.map(k => BEASTS[k].name).join(', '), C.text);
      } else t.print(rx, y++, 'Страницы пока чисты.', C.dark);
      t.print(2, t.rows - 1, '↑↓ глава   Enter — открыть   Esc — закрыть книгу', C.dim);
      return;
    }
    // Глава: слева — записи, справа — запись.
    const c = this.chapters[this.ch];
    t.print(4, Y + 2, `Глава ${ROMAN[this.ch] || this.ch + 1}. ${c.name}`, C.gold);
    const H2 = H - 7, top = Math.max(0, Math.min(c.keys.length - H2, this.sel - (H2 >> 1)));
    c.keys.slice(top, top + H2).forEach((k, i) => {
      const y = Y + 4 + i, d = BEASTS[k], seen = p.seen[k], sel = top + i === this.sel;
      t.print(3, y, sel ? '►' : ' ', C.gold);
      t.put(5, y, seen ? d.glyph : '?', seen ? d.color : C.dark);
      t.print(7, y, (seen ? d.name : '???').slice(0, spine - 9), sel ? C.gold : seen ? C.text : C.dark);
    });
    if (top > 0) t.print(spine - 3, Y + 4, '▲', C.dim);
    if (top + H2 < c.keys.length) t.print(spine - 3, Y + 3 + H2, '▼', C.dim);
    t.print(4, Y + H - 2, `${c.keys.filter(k => p.seen[k]).length} из ${c.keys.length}`, C.dim);
    this.entry(t, c.keys[this.sel], spine + 3, Y + 2, W - spine - 5);
    t.print(2, t.rows - 1, '↑↓ запись   ←→ листать главы   Esc — к оглавлению   X — закрыть', C.dim);
  }

  entry(t, key, bx, by, bw) {
    const p = G.player, d = BEASTS[key];
    if (!p.seen[key]) {
      t.print(bx, by, 'Ты ещё не встречал это существо.', C.dim);
      t.printWrap(bx, by + 2, bw, `Ходят слухи, что оно водится здесь: ${beastRange(d)}.`, C.dark);
      if (d.night) t.print(bx, by + 5, 'Говорят, оно выходит лишь по ночам.', C.dark);
      return;
    }
    const kills = p.kills[key] || 0;
    const knows = kills > 0 || p.stats.wis >= d.lore;
    t.put(bx, by, d.glyph, d.color);
    t.print(bx + 2, by, d.name, C.gold);
    if (d.unholy) t.print(bx + 2 + d.name.length + 2, by, '† нечисть', C.violet);
    let y = by + 2;
    y += t.printWrap(bx, y, bw, d.desc, C.text) + 1;
    t.print(bx, y, 'Обитает:', C.dim);
    y += t.printWrap(bx + 11, y, bw - 11, d.habitat.map(h => HABITAT[h]).join(', ') + (d.night ? ' (ночью)' : ''), C.text);
    t.print(bx, y, 'Где:', C.dim);
    y += t.printWrap(bx + 11, y, bw - 11, beastRange(d), C.text);
    t.print(bx, y, 'Убито:', C.dim);
    t.print(bx + 11, y++, String(kills), C.text);
    y++;
    if (knows) {
      t.print(bx, y++, 'Повадки', C.gold);
      t.print(bx, y, 'Нрав:', C.dim); y += t.printWrap(bx + 13, y, bw - 13, BEHAVIOR_TEXT[d.behavior] + (d.under ? `; под землёй — ${BEHAVIOR_TEXT[d.under]}` : ''), C.text);
      t.print(bx, y, 'Здоровье:', C.dim); t.print(bx + 13, y++, String(d.hp), C.text);
      t.print(bx, y, 'Урон:', C.dim); t.print(bx + 13, y++, d.steal ? 'не бьёт' : `${d.dmg[0]}–${d.dmg[1]}`, C.text);
      t.print(bx, y, 'Шкура:', C.dim); t.print(bx + 13, y++, d.armor ? `толстая (${d.armor})` : 'обычная', C.text);
      t.print(bx, y, 'Скорость:', C.dim);
      t.print(bx + 13, y++, d.speed > 105 ? 'быстрее человека' : d.speed < 95 ? 'медленнее человека' : 'как у человека', C.text);
      const special = [
        d.poison && 'ядовит', d.confuse && 'сводит с ума', d.drain && 'пьёт силу, исцеляясь',
        d.graceDrain && 'высасывает благодать', d.steal && 'крадёт монеты',
        d.ranged && `бьёт издалека (до ${d.ranged.range} клеток)`, d.lure && 'заманивает пением',
        d.regen && 'раны затягиваются сами', d.unholy && 'боится молитвы', d.curse && 'убийство лишает благодати',
      ].filter(Boolean);
      if (special.length) {
        t.print(bx, y, 'Особое:', C.dim);
        y += t.printWrap(bx + 13, y, bw - 13, special.join(', '), C.text);
      }
      const prize = [d.loot && `${d.loot.name} (~${d.loot.value} мон.)`, d.coins && 'монеты'].filter(Boolean).join(', ');
      t.print(bx, y, 'Добыча:', C.dim); t.printWrap(bx + 13, y, bw - 13, prize || '—', C.text);
    } else {
      t.printWrap(bx, y, bw, `Повадки неизвестны. Убей такого зверя или развивай Мудрость (нужно ${d.lore}).`, C.dark);
    }
  }
}

// ─── Карта Италии ──────────────────────────────────────────────────

// ─── Атлас ─────────────────────────────────────────────────────────
// Карта Италии в духе средневекового атласа: пергамент, чернила, латынь.

const INK = {
  parch: '#ead9ae', parch2: '#e2cfa0', coast: '#c9a86a', sea: '#9fb3aa', sea2: '#97aba2', border: '#cbbd98',
  ink: '#3a2614', brown: '#6b4a2a', red: '#9a2a1a', green: '#4e6a2a', blue: '#3a5a8a', faded: '#8a5a3a',
};

/** @type {[string, number, number][]} */
const ATLAS_LABELS = [
  ['MARE LIGVSTICVM', 8.6, 43.6], ['MARE TYRRHENVM', 11.2, 40.6], ['MARE ADRIATICVM', 15.2, 43.0],
  ['MARE IONIVM', 17.4, 38.3], ['MARE AFRICVM', 12.0, 36.9],
];

const REGION_LATIN = {
  alps: 'ALPES', piedmont: 'PEDEMONTIVM', liguria: 'LIGVRIA', lombardy: 'LOMBARDIA', veneto: 'MARCHIA',
  friuli: 'FORVM IVLII', emilia: 'AEMILIA', tuscany: 'TVSCIA', papal: 'PATRIMONIVM', abruzzo: 'APRVTIVM',
  campania: 'CAMPANIA', apulia: 'APVLIA', calabria: 'CALABRIA', sicily: 'SICILIA', sardinia: 'SARDINIA', malta: 'MELITA', helvetia: 'HELVETIA',
  corsica: 'CORSICA',
};

const COMPASS = [
  '    N    ',
  '    ▲    ',
  ' ╲  │  ╱ ',
  'W◄──*──►E',
  ' ╱  │  ╲ ',
  '    ▼    ',
  '    S    ',
];
const SHIP = ['  |\\  ', '  |_\\ ', '\\____/'];
const SERPENT = ['  _   _   _    ', ' / \\_/ \\_/ \\_ò<'];

function regionCentroids(ow) {
  if (ow.centroids) return ow.centroids;
  const acc = {};
  for (let y = 0; y < ow.h; y++)
    for (let x = 0; x < ow.w; x++) {
      const t = ow.get(x, y);
      if (t === OT.SEA || t === OT.BORDER || t === OT.LAKE) continue;
      const r = ow.regionAt(x, y), a = acc[r] || (acc[r] = [0, 0, 0]);
      a[0] += x; a[1] += y; a[2]++;
    }
  ow.centroids = Object.fromEntries(Object.entries(acc).map(([r, [sx, sy, n]]) => [r, [sx / n, sy / n]]));
  return ow.centroids;
}

class MapScreen {
  constructor() { this.overlay = false; }
  key() { popScreen(); }

  render(t) {
    const ow = G.over, H = t.rows - 3;
    const k = ow.h / (H - 2);                 // клеток Италии на символ
    const W = Math.ceil(ow.w / k) + 2;
    const ox = 1, oy = 1;                     // левый верхний угол рамки
    // Малые острова (Мальта) мельче символа атласа — их не теряем: берём сушу внутри клетки.
    const sample = (sx, sy) => {
      const x = Math.min(ow.w - 1, Math.floor((sx + 0.5) * k)), y = Math.min(ow.h - 1, Math.floor((sy + 0.5) * k));
      if (ow.get(x, y) === OT.SEA)
        for (let yy = Math.floor(sy * k); yy < Math.min(ow.h, (sy + 1) * k); yy++)
          for (let xx = Math.floor(sx * k); xx < Math.min(ow.w, (sx + 1) * k); xx++)
            if (ow.get(xx, yy) !== OT.SEA && ow.regionAt(xx, yy) === 'malta') return [xx, yy];
      return [x, y];
    };
    const isSea = (sx, sy) => {
      if (sx < 0 || sy < 0 || sx >= W - 2 || sy >= H - 2) return true;
      const [x, y] = sample(sx, sy), tt = ow.get(x, y);
      return tt === OT.SEA;
    };
    // Пергамент и местность.
    for (let sy = 0; sy < H - 2; sy++)
      for (let sx = 0; sx < W - 2; sx++) {
        const [x, y] = sample(sx, sy), tt = ow.get(x, y), i = ow.idx(x, y), h = hash2(sx, sy);
        let ch = ' ', fg = INK.ink, bg = h < 0.5 ? INK.parch : INK.parch2;
        if (tt === OT.SEA) {
          bg = h < 0.5 ? INK.sea : INK.sea2;
          if (h < 0.12) { ch = '~'; fg = INK.blue; }
        } else if (tt === OT.BORDER) { bg = INK.border; ch = h < 0.3 ? '^' : ' '; fg = INK.faded; }
        else {
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isSea(sx + dx, sy + dy))) bg = INK.coast;
          switch (tt) {
            case OT.PEAK: case OT.MOUNT: ch = '▲'; fg = INK.brown; break;
            case OT.VOLCANO: ch = '▲'; fg = INK.red; break;
            case OT.HILL: ch = h < 0.6 ? '∩' : ' '; fg = INK.faded; break;
            case OT.FOREST: case OT.PINE: ch = h < 0.6 ? '♣' : ' '; fg = INK.green; break;
            case OT.MARSH: ch = '"'; fg = INK.green; break;
            case OT.LAKE: ch = '≈'; fg = INK.blue; bg = INK.sea; break;
            case OT.RIVER: ch = '~'; fg = INK.blue; break;
          }
          if (ow.road[i] >= 0 && tt !== OT.RIVER && ch === ' ') { ch = '·'; fg = INK.red; }
        }
        t.put(ox + 1 + sx, oy + 1 + sy, ch, fg, bg);
      }

    // Рамка с картушем.
    const fx0 = ox, fy0 = oy, fx1 = ox + W - 1, fy1 = oy + H - 1;
    for (let x = fx0; x <= fx1; x++) { t.put(x, fy0, '═', INK.brown, INK.parch2); t.put(x, fy1, '═', INK.brown, INK.parch2); }
    for (let y = fy0; y <= fy1; y++) { t.put(fx0, y, '║', INK.brown, INK.parch2); t.put(fx1, y, '║', INK.brown, INK.parch2); }
    t.put(fx0, fy0, '╔', INK.brown, INK.parch2); t.put(fx1, fy0, '╗', INK.brown, INK.parch2);
    t.put(fx0, fy1, '╚', INK.brown, INK.parch2); t.put(fx1, fy1, '╝', INK.brown, INK.parch2);
    const title = ` ITALIA · ANNO DOMINI ${roman(today().y)} `;
    t.print(fx0 + Math.floor((W - title.length) / 2), fy0, title, INK.red, INK.parch);

    // Пишем чернилами только по морю (рисунки) или по пергаменту (надписи).
    const atlasXY = (lon, lat) => {
      const [x, y] = geoToXY(lon, lat);
      return [ox + 1 + Math.floor(x / k), oy + 1 + Math.floor(y / k)];
    };
    const inMap = (x, y) => x > fx0 && x < fx1 && y > fy0 && y < fy1;
    const drawOnSea = (lines, x0, y0, fg) => lines.forEach((line, j) => [...line].forEach((c, i) => {
      const x = x0 + i, y = y0 + j;
      if (c !== ' ' && inMap(x, y) && isSea(x - ox - 1, y - oy - 1)) t.put(x, y, c, fg);
    }));
    const taken = [];
    const free = (x, y, len) => inMap(x, y) && inMap(x + len - 1, y)
      && !taken.some(([tx, ty, tl]) => ty === y && x < tx + tl + 1 && tx < x + len + 1);
    const write = (x, y, text, fg, bg) => { taken.push([x, y, text.length]); t.print(x, y, text, fg, bg); };

    drawOnSea(COMPASS, fx0 + 2, fy1 - COMPASS.length - 1, INK.brown);
    const [shx, shy] = atlasXY(16.6, 42.6);
    drawOnSea(SHIP, shx, shy, INK.brown);
    const [srx, sry] = atlasXY(10.2, 39.5);
    drawOnSea(SERPENT, srx, sry, INK.green);
    for (const [name, lon, lat] of ATLAS_LABELS) {
      const [x, y] = atlasXY(lon, lat), sx = x - (name.length >> 1);
      if (free(sx, y, name.length)) write(sx, y, name, INK.blue);
    }

    // Города.
    const at = (x, y) => [ox + 1 + Math.floor(x / k), oy + 1 + Math.floor(y / k)];
    for (const s of ow.sites) { if (s.hidden) continue; const [sx, sy] = at(s.x, s.y); t.put(sx, sy, s.glyph, '#6a2a8a'); }
    for (const c of ow.cities) {
      const [sx, sy] = at(c.x, c.y);
      if (c.kind === 'city' || c.kind === 'town') t.put(sx, sy, c.kind === 'city' ? '■' : '•', c.kind === 'city' ? INK.red : INK.ink);
      else if (c.famous) t.put(sx, sy, PLACE_KINDS[c.kind].glyph, INK.brown);
    }
    for (const c of ow.cities) {
      if (c.kind !== 'city') continue;
      const [sx, sy] = at(c.x, c.y), len = c.name.length, mid = sx - (len >> 1);
      const spot = [[sx + 2, sy], [sx - len - 1, sy], [mid, sy - 1], [mid, sy + 1]].find(([x, y]) => free(x, y, len));
      if (spot) write(spot[0], spot[1], c.name, INK.ink);
    }
    // Городки — если есть место.
    for (const c of ow.cities) {
      if (c.kind !== 'town') continue;
      const [sx, sy] = at(c.x, c.y), len = c.name.length;
      const spot = [[sx + 2, sy], [sx - len - 1, sy]].find(([x, y]) => free(x, y, len));
      if (spot) write(spot[0], spot[1], c.name, INK.faded);
    }
    // Названия земель — бледными чернилами.
    for (const [r, [cx, cy]] of Object.entries(regionCentroids(ow))) {
      const name = REGION_LATIN[r], [x, y] = at(cx, cy), sx = x - (name.length >> 1);
      // Ближайшее свободное место: сперва по строкам рядом, потом со сдвигом вбок.
      const spots = [];
      for (let dy = 0; dy <= 2; dy++) for (const sy of dy ? [y + dy, y - dy] : [y])
        for (let dx = 0; dx <= 4; dx += 2) for (const xx of dx ? [sx - dx, sx + dx] : [sx]) spots.push([xx, sy]);
      const spot = spots.find(([xx, yy]) => free(xx, yy, name.length));
      if (spot) write(spot[0], spot[1], name, INK.faded);
    }
    for (const l of G.leads || []) {
      if (!l.known || l.done || l.until < timeInfo().day) continue;
      const [lx, ly] = at(l.x, l.y);
      t.put(lx, ly, '!', INK.red);
    }
    const [px, py] = at(G.ox, G.oy);
    if (Math.floor(Date.now() / 500) % 2 === 0) t.put(px, py, '@', '#f8f0e0', INK.red);
    else t.put(px, py, '@', INK.red);

    // Справа — где ты и чьи это земли.
    const x0 = fx1 + 3, here = ow.regionAt(G.ox, G.oy);
    let y = 1;
    t.printRich(x0, y++, `{${C.dim}}Ты здесь:{} {${C.gold}}${REGIONS[here].name} (${REGION_LATIN[here]}){}`);
    y += t.printWrap(x0, y, t.cols - x0 - 1, REGIONS[here].realm, C.text);
    t.print(x0, y++, 'Державы и земли', C.gold);
    const realms = new Map();
    for (const id of REGION_IDS) {
      const r = REGIONS[id];
      if (!realms.has(r.realm)) realms.set(r.realm, []);
      realms.get(r.realm).push(r.name);
    }
    for (const [realm, names] of realms) {
      if (y >= t.rows - 6) break;
      t.print(x0, y++, realm.slice(0, t.cols - x0 - 1), C.text);
      y += t.printWrap(x0 + 2, y, t.cols - x0 - 3, names.join(', '), C.dim, 2);
    }
    t.printRich(x0, t.rows - 5, `{${INK.red}}■{} город   {${INK.parch}}•{} городок   {${INK.red}}·{} дорога`);
    t.printRich(x0, t.rows - 4, `{${INK.brown}}▲{} горы   {${INK.green}}♣{} леса   {${INK.blue}}~{} реки   {#b080e0}♣ Ω{} тайны`);
    t.printRich(x0, t.rows - 3, `{${INK.parch}}† Ш{} знаменитые аббатства и замки`);
    t.print(x0, t.rows - 2, 'Любая клавиша — назад', C.dim);
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
      ['Пробел / . / NumPad 5', 'ждать ход (в пути — час)'],
      ['Идти на зверя / жителя', 'атаковать / поговорить'],
      ['Enter / E', 'войти в город или деревню, осмотреться — или выйти на карту'],
      ['P', 'молитвы и чудо святого покровителя; на алтарь — молитва у алтаря'],
      ['Q', 'выпить целебный отвар'],
      ['R', 'в глуши — заночевать; в пути — лагерь; в городе — передохнуть'],
      ['C', 'лист персонажа, повышение характеристик'],
      ['I', 'снаряжение и котомка: надеть, снять, выбросить'],
      ['X / M', 'бестиарий / карта Италии'],
      ['A', 'алхимия: варить зелья из трав'],
      ['Z', 'тайная наука: талисманы планет и операции'],
      ['V', 'прицел в ближнем бою: корпус / голова / руки / ноги'],
      ['G', 'карта: картинки или символы'],
      ['F  ·  T', 'стрелять (Tab — цель)  ·  поесть из котомки'],
      ['Ж (;) / O', 'журнал: задания, слухи, календарь; «!» на карте — место из слуха'],
      ['Ё (`) / F9', 'режим отладки: характеристики, деньги, перенос, задания, звери'],
      ['S  ·  ? / F1', 'сохранить игру (она сохраняется и сама)  ·  эта справка'],
    ];
    lines.forEach(([k, v], i) => {
      t.print(4, 4 + i * 2, k, C.gold);
      t.print(32, 4 + i * 2, v, C.text);
    });
    t.printWrap(4, 31, 92, 'По Италии ходят клетками по 5–10 км: дорогой быстрее и безопаснее, лесом и горами — дольше, '
      + 'и чаще встречаешь зверей. Звери не заходят в города. Ночью из болот и чащи выходит нечисть — '
      + 'переночуй в остерии. С местной карты уходят через её край или клавишей Enter. '
      + 'На острова — только на корабле из портового города. Работу дают старосты, кастеляны, священники, '
      + 'трактирщики, кузнецы и травницы: охота, доставка грузов и помощь на месте.', C.dim);
    t.print(2, t.rows - 1, 'Любая клавиша — назад', C.dim);
  }
}

// ─── Смерть ────────────────────────────────────────────────────────

class DeathScreen {
  constructor() {
    this.overlay = false;
    this.time = Date.now();
    chronicle(`Погиб. Причина: ${G.deathCause || 'неизвестна'}.`, 'death');
  }
  key(k) {
    if (Date.now() - this.time < 800) return;
    if (k.code === 'KeyH' || k.code === 'Semicolon' || k.code === 'KeyO') { const j = new JournalScreen(); j.tab = 3; pushScreen(j); return; }
    if (isEnter(k) && G.saveMeta) loadGame();
    else if (k.code === 'KeyN' || (isEnter(k) && !G.saveMeta)) { G.screens = [new CreationScreen()]; G.screens[0].step = 1; }
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
    const region = REGIONS[G.over.regionAt(G.ox, G.oy)].name;
    t.printCenter(15, `Погиб ${dateText(today(), false)} года, на ${ti.day}-й день странствий (${region}). Причина: ${G.deathCause || 'неизвестна'}.`, C.text);
    t.printCenter(16, `Уровень: ${p.level}.   Зверей убито: ${totalKills}.   Монет: ${p.coins}.`, C.dim);
    const lines = BEAST_ORDER.filter(k => p.kills[k]).map(k => `${BEASTS[k].name}: ${p.kills[k]}`);
    if (lines.length) t.printCenter(18, lines.join(' · '), C.dim);
    t.printCenter(22, 'Requiescat in pace.', C.violet);
    const m = G.saveMeta;
    t.printCenter(t.rows - 7, 'H — пролистать хронику твоего пути', C.text);
    if (m) {
      t.printCenter(t.rows - 5, `Enter — вернуться к последнему сохранению (день ${m.day}, ${m.region})`, C.gold);
      t.printCenter(t.rows - 3, 'N — новый путник', C.dim);
    } else t.printCenter(t.rows - 4, 'Enter — новый путник', C.gold);
  }
}

// ─── Журнал ────────────────────────────────────────────────────────

// Слух устаревает: новости — через три недели, наводки — когда место исчезло.
function rumorStatus(r) {
  const day = timeInfo().day;
  if (r.kind === 'lore') return { text: 'предание', color: C.violet };
  if (r.kind === 'tomb') return G.dungeons[r.tomb] ? { text: 'побывал', color: C.green } : { text: 'не проверен', color: C.gold };
  if (r.kind === 'lead') {
    const lead = (G.leads || []).find(l => l.id === r.lead);
    if (lead && lead.done) return { text: 'проверен', color: C.green };
    if (!lead || lead.until < day) return { text: 'устарел', color: C.dark, old: true };
    return { text: lead.until - day <= 2 ? 'вот-вот устареет' : 'свежий', color: lead.until - day <= 2 ? C.orange : C.gold };
  }
  // Слух стареет со дня, когда ты его услышал: «папа в Лионе» — давняя история,
  // но пока о ней говорят, это свежая весть.
  const age = day - r.day;
  if (age > 20) return { text: 'устарел', color: C.dark, old: true };
  return { text: age > 10 ? 'несвежий' : 'свежий', color: age > 10 ? C.dim : C.text };
}

class JournalScreen {
  constructor() {
    this.overlay = false;
    this.tab = 0;
    this.sel = 0;
  }

  entries() {
    const p = G.player;
    if (this.tab === 0) return p.quests;
    if (this.tab === 2) return [];
    if (this.tab === 3) return (p.chronicle || []).slice().reverse();
    const rs = (p.rumors || []).slice();
    // Сверху — живые наводки и свежие вести, ниже поверья, в самом низу — устаревшее.
    const rank = r => { const st = rumorStatus(r); return st.old ? 4 : r.kind === 'lore' ? 3 : st.text === 'проверен' ? 2 : r.kind === 'lead' ? 0 : 1; };
    return rs.sort((a, b) => rank(a) - rank(b));
  }

  key(k) {
    if (isEsc(k) || k.code === 'Semicolon' || k.code === 'KeyO') return popScreen();
    const d = digitOf(k);
    if (k.code === 'Tab' || isLeft(k) || isRight(k) || (d && d <= 4)) {
      this.tab = d && d <= 4 ? d - 1 : isLeft(k) ? (this.tab + 3) % 4 : (this.tab + 1) % 4;
      this.sel = 0;
      return;
    }
    const n = this.entries().length;
    if (!n) return;
    if (isUp(k)) this.sel = (this.sel + n - 1) % n;
    else if (isDown(k)) this.sel = (this.sel + 1) % n;
  }

  render(t) {
    const p = G.player, list = this.entries();
    this.sel = Math.min(this.sel, Math.max(0, list.length - 1));
    t.print(2, 1, 'Журнал', C.gold);
    const tabs = [`1 Задания (${p.quests.length})`, `2 Слухи (${(p.rumors || []).length})`, '3 Календарь'];
    let tx = 12;
    tabs.forEach((s, i) => {
      t.print(tx, 1, i === this.tab ? `[${s}]` : ` ${s} `, i === this.tab ? C.gold : C.dim);
      tx += s.length + 4;
    });
    t.print(t.cols - 36, 1, 'Tab — вкладка  ↑↓ — выбор  Esc', C.dark);
    for (let i = 0; i < t.cols; i++) t.put(i, 2, '─', C.dark);
    if (this.tab === 2) return renderCalendar(t);
    if (this.tab === 3) {
      list.slice(0, t.rows - 6).forEach((e, i) => t.print(2, 4 + i, `${dateText(dateOfDay(e.day), false).padEnd(16)} ${e.text}`.slice(0, t.cols - 4), e.kind === 'death' ? C.red : C.text));
      return;
    }

    if (!list.length) {
      t.print(4, 5, this.tab === 0 ? 'Заданий нет. Спроси работу у жителей.' : 'Ты пока ничего не слышал. Расспроси людей: «Что нового в округе?»', C.dim);
      return;
    }
    const H = t.rows - 6, top = Math.max(0, Math.min(list.length - H, this.sel - (H >> 1)));
    list.slice(top, top + H).forEach((e, i) => {
      const y = 4 + i, sel = top + i === this.sel;
      t.print(1, y, sel ? '►' : ' ', C.gold);
      if (this.tab === 0) {
        const icon = e.type === 'kill' ? '†' : e.type === 'work' ? '¶' : '✉';
        t.print(3, y, icon, e.done ? C.green : C.gold);
        t.print(5, y, questLine(e).slice(0, 30), sel ? C.gold : e.done ? C.green : C.text);
      } else {
        const st = rumorStatus(e);
        t.print(3, y, e.kind === 'lead' ? '!' : e.kind === 'lore' ? '~' : '·', e.kind === 'lead' ? '#ff6040' : st.color);
        t.print(5, y, (e.title || e.text).slice(0, 30), sel ? C.gold : st.old ? C.dark : C.text);
      }
    });

    const e = list[this.sel], bx = 38, bw = 60;
    t.box(bx, 3, bw, 30, C.dark);
    let y = 5;
    const row = (label, val, color = C.text) => {
      t.print(bx + 3, y, label, C.dim);
      y += t.printWrap(bx + 16, y, bw - 19, val, color);
    };
    if (this.tab === 0) {
      const kind = e.type === 'kill' ? 'Охота' : e.type === 'work' ? 'Работа на месте' : 'Доставка';
      t.print(bx + 3, y++, kind, C.gold);
      y++;
      y += t.printWrap(bx + 3, y, bw - 6, e.text || '', C.text) + 1;
      if (e.giverName) row('Дал:', `${e.giverName}`);
      row('Откуда:', e.fromName);
      if (e.day) row('Взято:', `день ${e.day}`);
      if (e.type === 'deliver') {
        const left = e.deadline - timeInfo().day;
        row('Кому:', `${e.toTitle}, ${e.toName}`);
        row('Срок:', left >= 0 ? `ещё ${left} дн. (до дня ${e.deadline})` : 'просрочено — заплатят половину', left >= 0 ? C.text : C.red);
      } else row('Ход:', `${e.have} из ${e.need}`, e.done ? C.green : C.text);
      row('Награда:', `${e.reward} мон., ${e.xp} опыта`, C.gold);
      if (e.done) { y++; t.printWrap(bx + 3, y, bw - 6, `Готово! Возвращайся: ${e.fromName}.`, C.green); }
    } else {
      const st = rumorStatus(e);
      t.print(bx + 3, y, e.kind === 'lead' ? 'Наводка' : e.kind === 'lore' ? 'Поверье' : 'Весть', C.gold);
      t.print(bx + bw - 3 - st.text.length, y++, st.text, st.color);
      y++;
      y += t.printWrap(bx + 3, y, bw - 6, `«${e.text}»`, st.old ? C.dim : C.text) + 1;
      row('Слышал от:', e.source);
      row('Когда:', `день ${e.day} (${agoText(timeInfo().day - e.day).toLowerCase()})`);
      if (e.kind === 'lead') {
        const lead = (G.leads || []).find(l => l.id === e.lead);
        y++;
        if (lead && !lead.done && lead.until >= timeInfo().day) {
          const dist = Math.round(Math.hypot((lead.x - G.ox) * GEO.kmX, (lead.y - G.oy) * GEO.kmY));
          y += t.printWrap(bx + 3, y, bw - 6, `Место отмечено на карте знаком «!». Отсюда ≈${dist} км. Поспеши — через несколько дней тут ничего не останется.`, C.gold);
        } else if (lead && lead.done) t.printWrap(bx + 3, y, bw - 6, 'Ты побывал там. Слух оказался правдой.', C.green);
        else t.printWrap(bx + 3, y, bw - 6, 'Время ушло. Что бы там ни было — теперь этого нет.', C.dark);
      } else if (e.kind === 'news' && st.old) {
        y++;
        t.printWrap(bx + 3, y, bw - 6, 'Это было давно. С тех пор всё могло перемениться.', C.dark);
      }
    }
  }
}

// Вкладка журнала: месяц, время года, погода, ближайшие праздники.
function renderCalendar(t) {
  const dt = today(), s = SEASONS[seasonOf(dt)], w = weatherNow(), sun = sunTimes(dt), p = G.player;
  t.print(3, 4, `${WEEKDAYS[dt.wd][0].toUpperCase() + WEEKDAYS[dt.wd].slice(1)}, ${dateText(dt, false)} года`, C.gold);
  t.printRich(3, 5, `{dim}Время года:{} ${s.icon} ${s.name}   {dim}Погода:{} ${w.icon} ${w.name}   {dim}Восход{} ${hhmm(sun.rise)}  {dim}закат{} ${hhmm(sun.set)}`);
  if (isLent(dt)) t.print(3, 6, 'Великий пост.', C.violet);

  // Сетка месяца.
  const x0 = 3, y0 = 8;
  t.print(x0, y0, `${MONTHS[dt.m - 1][0].toUpperCase() + MONTHS[dt.m - 1].slice(1)} ${dt.y}`, C.gold);
  ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].forEach((d, i) => t.print(x0 + i * 4, y0 + 2, d, i === 6 ? C.red : C.dim));
  const first = dateOfDay(timeInfo().day - dt.d + 1), col0 = (first.wd + 6) % 7;
  for (let d = 1; d <= 31; d++) {
    const cur = dateOfDay(timeInfo().day - dt.d + d);
    if (cur.m !== dt.m) break;
    const pos = col0 + d - 1, cx = x0 + (pos % 7) * 4, cy = y0 + 3 + Math.floor(pos / 7);
    const feasts = feastsOn(cur), mine = p.patron && feasts.some(f => f.saint === p.patron);
    const fg = d === dt.d ? '#000000' : mine ? SAINTS[p.patron].color : feasts.length ? C.gold : cur.wd === 0 ? C.red : C.text;
    t.print(cx, cy, String(d).padStart(2), fg, d === dt.d ? C.gold : null);
    if (feasts.length && d !== dt.d) t.put(cx + 2, cy, '†', mine ? SAINTS[p.patron].color : C.gold);
  }

  // Ближайшие праздники.
  const bx = 38;
  t.print(bx, 8, 'Ближайшие праздники', C.gold);
  let y = 10;
  for (const f of upcomingFeasts(8)) {
    if (y > 30) break;
    const when = f.inDays === 0 ? 'сегодня' : f.inDays === 1 ? 'завтра' : `через ${f.inDays} дн.`;
    const mine = p.patron && f.saint === p.patron;
    t.print(bx, y, `${f.dt.d} ${MONTHS_GEN[f.dt.m - 1]}`.padEnd(13), C.dim);
    y += t.printWrap(bx + 13, y, 46, `${f.name}${mine ? ' — твой покровитель!' : ''} (${when})`, mine ? SAINTS[p.patron].color : f.major ? C.text : C.dim);
    if (f.text) y += t.printWrap(bx + 15, y, 44, f.text, C.dark);
  }
  t.printWrap(3, 20, 32, SEASON_HINT[seasonOf(dt)], C.dim);
}

const SEASON_HINT = {
  winter: 'Зима: короткие дни, волки у деревень, змеи и медведи спят. В Альпах перевалы вне дорог засыпаны, в горах путь вдвое дольше, ночёвка в поле выстуживает. Мессу служат по воскресеньям и праздникам.',
  spring: 'Весна: дожди и распутица вне дорог, просыпаются змеи. Зерно дорожает — до нового урожая далеко. Травницы просят собирать травы.',
  summer: 'Лето: длинные дни, зной, грозы. Жатва — работа в деревнях. В болотах лихорадка, тарантулы злы. Зерно дешевеет к концу лета.',
  autumn: 'Осень: сбор винограда, кабаны на желудях, туманы на Паданской равнине, затяжные дожди. Вино дешевеет. Пора запасать дрова.',
};
