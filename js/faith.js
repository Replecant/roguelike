'use strict';

// ─── Вера ──────────────────────────────────────────────────────────
// Благочестие (piety, 0–100) не купишь: лепта раз в неделю и по доле от
// кошелька, месса по воскресеньям, молитва у алтаря; без храма оно тает,
// грехи его отнимают. Святого покровителя обретают в паломничестве к мощам.
// Чудо стоит милости святого (favor), которую копят угодными ему делами.

/** @type {[number, string][]} */
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
    shrine: place => place.id === 'venice', where: 'Венеция: мощи в монастыре Сан-Джорджо Маджоре',
    deeds: 'бить сильных зверей и нечисть',
    name: 'Святой Георгий', acc: 'святого Георгия', dat: 'святому Георгию', glyph: '†', color: '#e05040',
    who: 'Победоносец, покровитель воинов и рыцарей. Поразил змея копьём.',
    passive: { acc: 1, vsUnholy: 1 }, passiveText: '+1 к меткости, +1 к урону по нечисти',
    miracle: 'Копьё Георгия', miracleText: '20 ходов каждый удар сильнее на 3 и точнее',
  },
  michael: {
    shrine: place => place.name === 'Монте-Сант-Анджело', where: 'пещера на горе Гаргано (Монте-Сант-Анджело)',
    deeds: 'изгонять и убивать нечисть; не носить языческих оберегов',
    name: 'Архангел Михаил', acc: 'архангела Михаила', dat: 'архангелу Михаилу', glyph: '†', color: '#f0d070',
    who: 'Архистратиг небесного воинства, низвергший Люцифера. Его святилище — на горе Гаргано.',
    passive: { unholyArmor: 1 }, passiveText: '+1 к защите от нечисти',
    miracle: 'Меч Архангела', miracleText: 'вся нечисть в поле зрения получает тяжёлый урон',
  },
  francis: {
    shrine: place => place.name === 'Ассизи', where: 'Ассизи: гробница святого',
    deeds: 'жертвовать и помогать людям на месте; не убивать мирных зверей',
    name: 'Святой Франциск', acc: 'святого Франциска', dat: 'святому Франциску', glyph: '†', color: '#a08050',
    who: 'Бедняк из Ассизи, проповедовал птицам и усмирил волка из Губбио. Умер двадцать лет назад.',
    passive: {}, passiveText: 'дикие звери (не нечисть) реже нападают в пути',
    miracle: 'Слово к братьям меньшим', miracleText: 'звери в поле зрения успокаиваются и не нападают',
  },
  christopher: {
    shrine: place => place.kind === 'inn', where: 'часовня при любом постоялом дворе — у капеллана',
    deeds: 'странствовать и доставлять грузы',
    name: 'Святой Христофор', acc: 'святого Христофора', dat: 'святому Христофору', glyph: '†', color: '#60a0c0',
    who: 'Великан, перенёсший младенца Христа через реку. Хранит путников от внезапной смерти.',
    passive: {}, passiveText: 'в пути на десятую часть быстрее',
    miracle: 'Посох Христофора', miracleText: 'два дня никто не нападёт в пути',
  },
  benedict: {
    shrine: place => place.name === 'Монтекассино', where: 'аббатство Монтекассино',
    deeds: 'молиться у алтаря, ходить к мессе, помогать монастырям; не тревожить могил',
    name: 'Святой Бенедикт', acc: 'святого Бенедикта', dat: 'святому Бенедикту', glyph: '†', color: '#c0c0c0',
    who: 'Отец западного монашества из Монтекассино. Его крест отгоняет бесов, а чаша с ядом разбилась от его благословения.',
    passive: { poisonRes: 0.3 }, passiveText: 'яд берёт на треть реже',
    miracle: 'Vade retro, Satana', miracleText: 'нечисть рядом в ужасе бежит, яд и морок уходят',
  },
  nicholas: {
    shrine: place => place.id === 'bari', where: 'Бари: базилика Святого Николая',
    deeds: 'доставлять грузы, плавать по морю, подавать бедным',
    name: 'Святой Николай', acc: 'святого Николая', dat: 'святому Николаю', glyph: '†', color: '#60c0a0',
    who: 'Чудотворец из Мир Ликийских, чьи мощи покоятся в Бари. Покровитель моряков, купцов и бедняков.',
    passive: { price: 0.95 }, passiveText: 'покупка у торговцев на 5% дешевле',
    miracle: 'Милость Николая', miracleText: 'полное исцеление и очищение от яда',
  },
  antony: {
    shrine: place => place.id === 'padua', where: 'Падуя: церковь Святого Антония',
    deeds: 'проверять слухи и находить потерянное',
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
  if (p.solInvictus) out.push({ light: 2, acc: 1, vsUnholy: 1 });   // благословение Непобедимого Солнца (js/mithras.js)
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
    text: p => `лечит ${1 + Math.floor(p.stats.fai / 3) + prayerPower(p)}–${4 + Math.floor(p.stats.fai / 3) + prayerPower(p)} здоровья, ослабляет яд, снимает морок`,
    act(p) {
      const heal = 1 + Math.floor(p.stats.fai / 3) + prayerPower(p) + rng.int(0, 3);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      if (p.poison) p.poison = Math.floor(p.poison / 2);
      p.confused = 0;
      log(`Тепло разливается по телу: +${heal} здоровья.`, C.gold);
    },
  },
  {
    id: 'exorcism', name: 'Изгнание нечисти', cost: 5, fai: 0,
    text: p => `опаляет нечисть в 5 шагах: ${1 + Math.floor(p.stats.fai / 3) + prayerPower(p)}–${3 + Math.floor(p.stats.fai / 3) + prayerPower(p)}`,
    ready: () => unholyNear(5).length ? '' : 'рядом нет нечисти',
    act(p) {
      for (const m of unholyNear(5)) {
        const dmg = Math.floor(p.stats.fai / 3) + prayerPower(p) + rng.int(1, 3);
        m.hp -= dmg;
        m.provoked = true;
        if (p.patron === 'michael') addFavor(1);
        log(`Слово Божие опаляет ${m.def.acc}: −${dmg}.`, C.violet);
        if (m.hp <= 0) killBeast(m, true);
      }
    },
  },
  {
    id: 'light', name: 'Свет веры', cost: 3, fai: 5, order: true,
    text: () => 'на 60 ходов видно дальше — во тьме катакомб и ночью',
    act(p) { addBuff(p, 'light', 60); log('Вокруг тебя разливается тихий свет, как от лампады.', C.gold); },
  },
  {
    id: 'bless', name: 'Благословение оружия', cost: 6, fai: 6, order: true,
    text: p => `на 30 ходов урон +1, по нечисти ещё +${2 + (p.base.fai >> 2)}`,
    act(p) { addBuff(p, 'bless', 30); log('Ты осеняешь крестом своё оружие. Железо теплеет в руке.', C.gold); },
  },
  {
    id: 'mantle', name: 'Покров Богородицы', cost: 6, fai: 7, order: true,
    text: () => 'на 25 ходов защита +2',
    act(p) { addBuff(p, 'mantle', 25); log('Ты чувствуешь на плечах невидимый покров. Удары будто вязнут в нём.', C.gold); },
  },
  {
    id: 'ward', name: 'Молитва путника', cost: 8, fai: 8, order: true,
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

const MIRACLE_COST = 6;     // благодати
const FAVOR_COST = 10;      // милости святого
const FAVOR_MAX = 20;

function addFavor(n) {
  const p = G.player;
  if (!p.patron || n <= 0) return;
  const old = p.favor;
  p.favor = Math.min(FAVOR_MAX, p.favor + n);
  if (old < FAVOR_COST && p.favor >= FAVOR_COST) log(`${SAINTS[p.patron].name} благоволит тебе: можно воззвать о чуде (P).`, SAINTS[p.patron].color);
}

// Нарушен запрет святого — милость сгорает.
function breakTaboo(text) {
  const p = G.player;
  if (!p.patron || !p.favor) return;
  p.favor = 0;
  log(`${text} ${SAINTS[p.patron].name} отворачивается от тебя: милость утрачена.`, C.red);
}

// Дела, угодные святым (и благочестию).
function faithDeed(kind, info = {}) {
  const p = G.player, s = p.patron;
  switch (kind) {
    case 'kill': {
      const d = info.def;
      if (d.unholy) addFavor(s === 'michael' ? 2 : s === 'george' ? 1 : 0);
      if (s === 'george' && d.hp >= 20) addFavor(2);
      if (s === 'francis' && d.behavior === 'flee' && !d.unholy) breakTaboo(`Ты убил безобидного зверя.`);
      break;
    }
    case 'quest': {
      const q = info.q;
      if (q.type === 'deliver' && info.late) { addPiety(-2, 'Ты не сдержал слова — опоздал с доставкой.'); return; }
      addFavor(1);
      if (q.type === 'deliver' && (s === 'nicholas' || s === 'christopher')) addFavor(2);
      if (q.type === 'work' && s === 'francis') addFavor(2);
      if (s === 'benedict' && info.place && info.place.kind === 'monastery') addFavor(3);
      break;
    }
    case 'refuse': addPiety(-1, 'Ты не сдержал данного слова.'); break;
    case 'donate': addFavor(s === 'francis' ? 3 : s === 'nicholas' ? 2 : 0); break;
    case 'altar': addFavor(s === 'benedict' ? 1 : 0); break;
    case 'mass': addFavor(s === 'benedict' ? 2 : 1); break;
    case 'lead': addFavor(s === 'antony' ? 4 : s === 'george' && ['camp', 'den'].includes(info.lead.kind) ? 2 : 0); break;
    case 'sail': addFavor(s === 'nicholas' ? 2 : 0); break;
    case 'travel':
      if (s !== 'christopher') return;
      p.miles = (p.miles || 0) + 1;
      if (p.miles % 15 === 0) addFavor(1);
      break;
    case 'grave': if (s === 'benedict') breakTaboo('Ты потревожил покой мёртвых.'); break;
  }
}

// Раз в сутки: без храма благочестие тает, языческие обереги — грех.
function faithDaily(day) {
  const p = G.player;
  if (!p) return;
  if (day - (p.lastPractice || 1) > 3 && !p.is('saracen')) addPiety(-1, 'Ты давно не был в храме.');   // мусульманин молится где придётся
  const pagan = equippedItems(p).filter(it => it.pagan);
  if (pagan.length) {
    addPiety(-pagan.length, `Ты носишь языческое: ${pagan.map(it => lower(it.name)).join(', ')}.`);
    if (p.patron === 'michael') breakTaboo('Языческий оберег на груди.');
  }
  const dt = dateOfDay(day), feasts = feastsOn(dt);
  for (const f of feasts) log(`${f.name}.${f.text ? ' ' + f.text : ''}`, C.gold);
  if (isMassDay(dt)) log(dt.wd === 0 ? 'Воскресенье. Колокола зовут к мессе.' : 'Праздник — в храмах служат мессу.', C.gold);
  if (p.patron && feasts.some(f => f.saint === p.patron)) log(`Сегодня день твоего покровителя! Помолись у алтаря или отстой мессу.`, SAINTS[p.patron].color);
}

function isSunday() { return today().wd === 0; }

// В день своего святого молитва в храме приносит его милость.
function patronFeastBonus() {
  const p = G.player;
  if (!p.patron || p.feastFavorDay === timeInfo().day) return;
  if (!feastsOn(today()).some(f => f.saint === p.patron)) return;
  p.feastFavorDay = timeInfo().day;
  addFavor(3);
  log(`${SAINTS[p.patron].name} рад тебе в свой праздник (+3 милости).`, SAINTS[p.patron].color);
}

function castMiracle() {
  const p = G.player, s = SAINTS[p.patron], day = timeInfo().day;
  if (p.favor < FAVOR_COST) { log(`Ты ещё не заслужил чуда. Милость святого: ${p.favor}/${FAVOR_COST} — ${s.deeds}.`, C.dark); return; }
  if (p.grace < MIRACLE_COST) { log('Благодати не хватает, чтобы воззвать к святому.', C.dark); return; }
  p.grace -= MIRACLE_COST;
  p.favor -= FAVOR_COST;
  if (!rng.chance(prayerChance(p))) log(`Ты взываешь к ${s.dat} — но ответа нет.`, C.dark);
  else { log(`Ты взываешь: «${s.miracle}»!`, s.color); miracle(p); }
  afterAction();
}

// ─── Алтарь и пожертвования ────────────────────────────────────────

function altarPray() {
  const p = G.player, day = timeInfo().day;
  if (p.is('saracen')) { log('Христианский алтарь. Ты молишься по-своему, обратясь к югу, — но благодати здесь не ищешь.', C.dim); return; }
  if (p.altarDay === day) { log('Ты уже молился у алтаря сегодня. Свеча догорает.', C.dim); return; }
  p.altarDay = day;
  p.lastPractice = day;
  p.grace = Math.min(p.maxGrace, p.grace + Math.ceil(p.maxGrace / 2));
  log('Ты преклоняешь колени у алтаря. Часть благодати возвращается.', C.gold);
  // Тихая молитва делает прихожанином, но не праведником.
  if (p.piety < 40) addPiety(1, 'Молитва у алтаря.');
  faithDeed('altar');
  patronFeastBonus();
  afterAction();
}

// Лепта: важна доля от кошелька, а не сумма. Раз в неделю в одном храме.
/** @type {[number, string, number][]} */
const DONATIONS = [[0.1, 'десятую часть', 2], [0.25, 'четверть', 4], [0.5, 'половину', 7]];

function donationOptions(npc) {
  const p = G.player, place = npc.village.city, day = timeInfo().day;
  p.donated = p.donated || {};
  const recent = p.donated[place.id] && day - p.donated[place.id] < 7;
  const give = (sum, gain) => () => {
    if (recent) return 'Ты уже жертвовал нашему храму на этой неделе. Господь не торгуется — приходи в другой раз.';
    p.coins -= sum;
    p.donated[place.id] = day;
    addPiety(gain, 'Пожертвование.');
    faithDeed('donate');
    return rng.pick(['Да воздаст тебе Господь сторицей.', 'На эти деньги починим кровлю. Помолюсь за тебя.',
      'Щедрость — лучшая молитва. Ступай с миром.']);
  };
  if (!p.coins) return [];
  if (p.coins <= 5) return [{ label: `Отдать храму всё, что есть (${p.coins} мон.)`, act: give(p.coins, 4) }];
  return DONATIONS.map(([k, what, gain]) => {
    const sum = Math.max(1, Math.round(p.coins * k));
    return { label: `Пожертвовать ${what} кошелька (${sum} мон.)`, act: give(sum, gain) };
  });
}

// Месса — по воскресеньям, утром.
function massOption(npc) {
  const p = G.player, { day, hour } = timeInfo();
  if (!isMassDay() || hour < 6 || hour >= 13) return null;
  const feast = feastsOn(today()).find(f => f.major || f.saint);
  return { label: feast ? `Отстоять праздничную мессу (${feast.name})` : 'Отстоять воскресную мессу', act: () => {
    if (p.massDay === day) return 'Месса уже отслужена. Ступай с миром — ite, missa est.';
    p.massDay = day;
    p.lastPractice = day;
    passTime(60);
    p.grace = p.maxGrace;
    if (p.piety < 80) addPiety(2, 'Воскресная месса.');
    faithDeed('mass');
    patronFeastBonus();
    return 'Ты стоишь мессу среди прихожан. Латынь, ладан, колокольчик на возношении. Выходишь, будто умытый.';
  } };
}

// У мощей: паломничество и выбор покровителя.
function shrineOptions(npc) {
  const p = G.player, place = npc.village.city, opts = [];
  const id = Object.keys(SAINTS).find(k => SAINTS[k].shrine(place));
  if (!id) {
    if (npc.role === 'priest' && !p.patron)
      opts.push({ label: 'Как обрести святого покровителя?', act: () =>
        { log('Святилища: ' + Object.values(SAINTS).map(s => `${s.name.replace('Святой ', 'св. ')} — ${s.where}`).join('; ') + '.', C.dim);
          return 'Заступника не выбирают, сын мой, — его обретают у святых мощей. Поклонись святому Николаю в Бари, '
            + 'святому Франциску в его Ассизи, святому Бенедикту на Монтекассино, архангелу Михаилу в пещере на горе Гаргано, '
            + 'святому Антонию в Падуе, святому Георгию в Венеции, у монахов Сан-Джорджо. А святой Христофор, хранитель путников, '
            + 'ждёт тебя в любой придорожной часовне. Иди с чистым сердцем — и святой сам услышит тебя.'; } });
    return opts;
  }
  const s = SAINTS[id];
  p.pilgrimages = p.pilgrimages || {};
  const key = place.kind === 'inn' ? 'christopher_' + place.id : id;
  if (!p.pilgrimages[key] && place.kind !== 'inn')
    opts.push({ label: `Поклониться мощам ${s.acc} (паломничество)`, act: () => {
      p.pilgrimages[key] = true;
      chronicle(`Поклонился мощам ${s.acc} (${place.name}).`, 'faith');
      p.lastPractice = timeInfo().day;
      addPiety(5, 'Паломничество к мощам.');
      if (p.patron === id) addFavor(5);
      return `Ты опускаешься на колени у раки. ${s.who} Камень у раки стёрт коленями тысяч паломников.`;
    } });
  if (p.patron !== id)
    opts.push({ label: `Избрать покровителем: ${s.name}`, act: () => {
      if (p.piety < 25) {
        log(`Нужно благочестие 25, у тебя ${p.piety}.`, C.dim);
        return 'Не торопись, сын мой. Святые слышат тех, чьё сердце очищено. Походи к мессе, помоги ближним — и возвращайся.';
      }
      if (p.patron) { p.piety = Math.floor(p.piety / 2); log('Ты отрекаешься от прежнего заступника. Благочестие падает вдвое.', C.dark); }
      p.patron = id;
      chronicle(`Избрал небесным покровителем: ${s.name.replace(/^Святой/, 'святого').replace(/^Архангел/, 'архангела')}.`, 'faith');
      p.favor = 0;
      log(`Отныне твой покровитель — ${s.name}. Милость копится делами: ${s.deeds}.`, s.color);
      log(`Милость: ${s.passiveText}. Чудо «${s.miracle}» — когда накопишь милость святого.`, C.dim);
      return `Отныне ${s.name.replace(/^Святой/, 'святой').replace(/^Архангел/, 'архангел')} — твой небесный заступник. Молись ему в беде и в радости, и он не оставит тебя на дорогах этого мира.`;
    } });
  return opts;
}

// ─── Экраны ────────────────────────────────────────────────────────

class PrayerScreen {
  constructor() { this.overlay = true; this.sel = 0; }

  list() {
    const p = G.player;
    /** @type {{ pr?: typeof PRAYERS[number], saint?: typeof SAINTS[string] }[]} */
    const out = PRAYERS.map(pr => ({ pr }));
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
        if (e.pr.order) { log('Эта молитва открывается лишь членам духовных орденов.', C.dark); return; }
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
        const locked = e.pr.order || p.stats.fai < e.pr.fai;
        t.print(x + 2, yy, `${sel ? '►' : ' '} ${i + 1}. ${e.pr.name}`, locked ? C.dark : sel ? C.gold : C.text);
        t.print(x + w - 14, yy, e.pr.order ? 'орден' : locked ? `Вера ${e.pr.fai}` : `${e.pr.cost} благ.`, locked ? C.dark : p.grace >= e.pr.cost ? C.sky : C.red);
        t.print(x + 7, yy + 1, (e.pr.order ? 'откроется в духовном ордене' : locked ? 'ещё не постиг' : e.pr.text(p)).slice(0, w - 10), locked ? C.dark : C.dim);
      } else {
        const used = p.favor < FAVOR_COST;
        t.print(x + 2, yy, `${sel ? '►' : ' '} ${i + 1}. ${e.saint.miracle}`, used ? C.dark : sel ? C.gold : e.saint.color);
        t.print(x + w - 18, yy, `милость ${p.favor}/${FAVOR_COST}`, used ? C.dark : C.sky);
        t.print(x + 7, yy + 1, `чудо: ${e.saint.miracleText}`.slice(0, w - 10), C.dim);
      }
    });
    t.print(x + 3, y + h - 2, p.patron ? 'Enter — молиться   Esc — назад' : 'Святого покровителя обретают в паломничестве к его мощам.', C.dim);
  }
}

