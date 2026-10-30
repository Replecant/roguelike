'use strict';

// ─── Бестиарий Италии ──────────────────────────────────────────────
// behavior: flee — бежит; hostile — нападает; territorial — нападает вблизи;
//           ambush — сидит в засаде.
// habitat (местность на местной карте): field, forest, pine, marsh, hill, road, shore.
// regions: регионы или группы регионов из italy.js (по умолчанию — везде).
// speed: 100 — как человек. lore — какая Мудрость нужна, чтобы знать повадки
// без убийства. max — сколько таких может бродить на одной карте.
// g — род (для «убей одного/одну»), quest — с чего начинает староста.
//
// Особые свойства:
//   poison: N   — отравляет на N ходов;       confuse: N — сбивает с толку на N ходов;
//   drain       — лечится выпитой кровью;     graceDrain: N — высасывает благодать;
//   steal       — крадёт монеты и убегает;    regen: N — раны затягиваются;
//   ranged      — бьёт издалека;              lure: N — заманивает пением с N клеток;
//   curse       — убийство лишает благодати;  site — живёт только в особом месте.

const BEAST_CATS = ['Звери', 'Люди', 'Дивные', 'Нечисть', 'Чудовища'];

const BEASTS = {
  // ── Звери ──
  hare: {
    cat: 'Звери', name: 'Заяц', acc: 'зайца', g: 'm', glyph: 'h', color: '#c8b48a',
    hp: 3, hit: 0, ev: 4, dmg: [1, 1], armor: 0, speed: 150,
    behavior: 'flee', verb: 'царапает', xp: 1,
    habitat: ['field'], weight: 10, group: [1, 1],
    loot: { id: 'hare_pelt', name: 'Заячья шкурка', value: 2 }, lore: 3,
    desc: 'Пугливый русак. Крестьяне говорят, что ведьмы оборачиваются зайцами, чтобы доить чужих коров.',
  },
  fox: {
    cat: 'Звери', name: 'Лиса', acc: 'лису', g: 'f', glyph: 'f', color: '#d8843a',
    hp: 5, hit: 1, ev: 4, dmg: [1, 3], armor: 0, speed: 120,
    behavior: 'flee', verb: 'кусает', xp: 2,
    habitat: ['field', 'forest'], weight: 5, group: [1, 1],
    loot: { id: 'fox_fur', name: 'Лисий мех', value: 4 }, lore: 4,
    quest: 'Лисы таскают кур из каждого двора.',
    desc: 'Рыжая воровка курятников. Хитра, в бой вступает, лишь загнанная в угол.',
  },
  deer: {
    cat: 'Звери', name: 'Благородный олень', acc: 'оленя', g: 'm', glyph: 'd', color: '#b08850',
    hp: 10, hit: 1, ev: 3, dmg: [1, 4], armor: 0, speed: 140,
    behavior: 'flee', verb: 'бодает', xp: 3,
    habitat: ['forest', 'field'], weight: 6, group: [1, 3],
    loot: { id: 'deer_hide', name: 'Оленья шкура', value: 5 }, lore: 3,
    desc: 'Дичь сеньоров. Охота без дозволения карается отсечением руки. Белого оленя не трогай: он ведёт к святым — или от них.',
  },
  ibex: {
    cat: 'Звери', name: 'Альпийский козерог', acc: 'козерога', g: 'm', glyph: 'g', color: '#a8987c',
    hp: 12, hit: 2, ev: 4, dmg: [2, 5], armor: 0, speed: 130,
    behavior: 'flee', verb: 'бьёт рогами', xp: 4,
    habitat: ['hill', 'pine'], regions: ['alps', 'piedmont'], weight: 6, group: [1, 3],
    loot: { id: 'ibex_horn', name: 'Рог козерога', value: 8 }, lore: 4,
    desc: 'Скачет по отвесным скалам, где не пройдёт и коза. Толчёный рог козерога, говорят, лечит от яда.',
  },
  mouflon: {
    cat: 'Звери', name: 'Муфлон', acc: 'муфлона', g: 'm', glyph: 'g', color: '#b0603c',
    hp: 9, hit: 1, ev: 4, dmg: [1, 4], armor: 0, speed: 135,
    behavior: 'flee', verb: 'бьёт рогами', xp: 3,
    habitat: ['hill', 'field'], regions: ['isles'], weight: 7, group: [1, 3],
    loot: { id: 'mouflon_horn', name: 'Витой рог муфлона', value: 6 }, lore: 4,
    desc: 'Дикий баран Сардинии и Корсики с тяжёлыми витыми рогами. Пастухи считают его предком своих овец.',
  },
  boar: {
    cat: 'Звери', name: 'Кабан', acc: 'кабана', g: 'm', glyph: 'b', color: '#8a6040',
    hp: 14, hit: 2, ev: 1, dmg: [2, 6], armor: 1, speed: 100,
    behavior: 'territorial', verb: 'распарывает клыком', xp: 7,
    habitat: ['forest', 'marsh'], weight: 4, group: [1, 1],
    loot: { id: 'boar_tusk', name: 'Кабаний клык', value: 7 }, lore: 6,
    quest: 'Кабаны перерыли все огороды и виноградники.',
    desc: 'Толстокожий вепрь Мареммы и апеннинских дубрав. Подойди близко — и он не отступит. Раненый кабан опаснее медведя.',
  },
  wolf: {
    cat: 'Звери', name: 'Апеннинский волк', acc: 'волка', g: 'm', glyph: 'w', color: '#a8a8a8',
    hp: 9, hit: 2, ev: 3, dmg: [1, 5], armor: 0, speed: 110,
    behavior: 'hostile', verb: 'кусает', xp: 5, sight: 9,
    habitat: ['forest', 'pine', 'hill'], regions: ['mainland', 'sicily'], weight: 5, group: [1, 3], nightWeight: 2,
    loot: { id: 'wolf_pelt', name: 'Волчья шкура', value: 6 }, lore: 5,
    quest: 'Волки режут наших овец прямо у загонов.',
    desc: 'Серый разбойник Апеннин. Ходит стаями, зимой спускается к деревням. Ночью волков вдвое больше — или так кажется.',
  },
  alpha_wolf: {
    cat: 'Звери', name: 'Матёрый волк', acc: 'матёрого волка', g: 'm', glyph: 'W', color: '#e0e0e0',
    hp: 20, hit: 4, ev: 4, dmg: [2, 8], armor: 1, speed: 115,
    behavior: 'hostile', verb: 'рвёт клыками', xp: 18, sight: 10,
    habitat: ['forest'], weight: 0, group: [1, 1],
    loot: { id: 'alpha_pelt', name: 'Шкура матёрого волка', value: 22 }, lore: 4,
    desc: 'Вожак стаи с белой отметиной на груди. Старше и хитрее охотников, что за ним ходили.',
  },
  bear: {
    cat: 'Звери', name: 'Бурый медведь', acc: 'медведя', g: 'm', glyph: 'B', color: '#7a4a2a',
    hp: 28, hit: 3, ev: 0, dmg: [3, 9], armor: 2, speed: 90,
    behavior: 'territorial', verb: 'бьёт лапой', xp: 16,
    habitat: ['pine', 'hill', 'forest'], regions: ['alps', 'abruzzo', 'friuli', 'veneto'], weight: 2, group: [1, 1],
    loot: { id: 'bear_skin', name: 'Медвежья шкура', value: 20 }, lore: 7,
    quest: 'Медведь задрал пастуха у опушки.',
    desc: 'Хозяин гор Абруццо и Альп. Медленный, но один удар его лапы ломает щит.',
  },
  buffalo: {
    cat: 'Звери', name: 'Буйвол', acc: 'буйвола', g: 'm', glyph: 'q', color: '#5a5048',
    hp: 22, hit: 2, ev: 0, dmg: [2, 8], armor: 2, speed: 100,
    behavior: 'territorial', verb: 'поддевает рогами', xp: 11,
    habitat: ['marsh', 'field'], regions: ['campania', 'papal'], weight: 4, group: [1, 2],
    loot: { id: 'buffalo_horn', name: 'Рог буйвола', value: 10 }, lore: 5,
    quest: 'Одичавшие буйволы затоптали пастушонка.',
    desc: 'Чёрный водяной бык, завезённый с Востока. Пасётся в топях Кампании и Понтинских болотах. Нрав скверный.',
  },
  viper: {
    cat: 'Звери', name: 'Гадюка', acc: 'гадюку', g: 'f', glyph: 'S', color: '#8aa83c',
    hp: 4, hit: 3, ev: 5, dmg: [1, 2], armor: 0, speed: 100,
    behavior: 'ambush', verb: 'жалит', poison: 5, xp: 3,
    habitat: ['marsh', 'hill', 'field'], weight: 4, group: [1, 1],
    loot: { id: 'venom', name: 'Змеиный яд', value: 4 }, lore: 5,
    quest: 'Гадюки покусали двух жнецов.',
    desc: 'Прячется в траве и камнях. Укус ядовит: слабость накатывает волнами.',
  },
  tarantula: {
    cat: 'Звери', name: 'Тарантул', acc: 'тарантула', g: 'm', glyph: 's', color: '#9a7048',
    hp: 3, hit: 3, ev: 5, dmg: [1, 2], armor: 0, speed: 100,
    behavior: 'ambush', verb: 'кусает', confuse: 8, xp: 3,
    habitat: ['field', 'hill'], regions: ['apulia', 'calabria'], weight: 7, group: [1, 1],
    loot: { id: 'tarantula', name: 'Сушёный тарантул', value: 5 }, lore: 4,
    quest: 'Тарантулы покусали жниц — полдеревни пляшет.',
    desc: 'Паук апулийских полей. Укушенный впадает в тарантизм — пляшет до изнеможения, не владея собой. Лечат его музыкой.',
  },
  crow: {
    cat: 'Звери', name: 'Ворон', acc: 'ворона', g: 'm', glyph: 'c', color: '#7a7a8c',
    hp: 3, hit: 2, ev: 6, dmg: [1, 2], armor: 0, speed: 150,
    behavior: 'hostile', erratic: 0.5, verb: 'клюёт', xp: 1, sight: 6,
    habitat: ['field'], weight: 4, group: [1, 3],
    loot: { id: 'crow_feather', name: 'Вороньи перья', value: 1 }, lore: 3,
    quest: 'Вороньё клюёт посевы, да и примета дурная.',
    desc: 'Падальщик и вестник. Не боится живых, если те выглядят слабыми.',
  },
  rat: {
    cat: 'Звери', name: 'Крыса', acc: 'крысу', g: 'f', glyph: 'r', color: '#8a7a6a',
    hp: 2, hit: 1, ev: 4, dmg: [1, 2], armor: 0, speed: 110,
    behavior: 'hostile', verb: 'кусает', xp: 1, sight: 5,
    habitat: ['field', 'road', 'marsh', 'tomb'], weight: 4, group: [2, 4],
    loot: { id: 'rat_tail', name: 'Крысиные хвосты', value: 1 }, lore: 2,
    quest: 'Крысы прогрызли амбар насквозь.',
    desc: 'Голодные крысы бегают стаями от деревни к деревне. Вместе с ними, говорят, ходит и мор.',
  },
  bat: {
    cat: 'Звери', name: 'Летучая мышь', acc: 'летучую мышь', g: 'f', glyph: 'v', color: '#6a5a6a',
    hp: 3, hit: 2, ev: 7, dmg: [1, 2], armor: 0, speed: 160,
    behavior: 'hostile', erratic: 0.6, verb: 'кусает', xp: 1, sight: 6,
    habitat: ['forest', 'hill', 'field', 'tomb'], weight: 2, group: [2, 3], night: true,
    loot: { id: 'bat_wing', name: 'Перепонка нетопыря', value: 2 }, lore: 3,
    desc: 'Нетопырь, ночная тварь. Церковь считает их вестниками дьявола, знахарки — ингредиентом.',
  },
  wild_dog: {
    cat: 'Звери', name: 'Одичалый пёс', acc: 'одичалого пса', g: 'm', glyph: 'C', color: '#9a7a50',
    hp: 7, hit: 2, ev: 3, dmg: [1, 4], armor: 0, speed: 115,
    behavior: 'hostile', verb: 'кусает', xp: 3, sight: 8,
    habitat: ['field', 'road'], weight: 3, group: [2, 3],
    loot: { id: 'dog_pelt', name: 'Собачья шкура', value: 2 }, lore: 3,
    quest: 'Одичавшие псы нападают на путников у моста.',
    desc: 'Собаки из сожжённых войной деревень. Людей больше не любят, но помнят, где у них мягко.',
  },

  // ── Люди ──
  brigand: {
    cat: 'Люди', name: 'Разбойник', acc: 'разбойника', g: 'm', glyph: 'p', color: '#c86a50',
    hp: 12, hit: 3, ev: 3, dmg: [2, 6], armor: 1, speed: 100,
    behavior: 'hostile', verb: 'бьёт дубьём', xp: 8, sight: 8,
    habitat: ['road', 'forest'], weight: 3, group: [1, 3],
    coins: [3, 12], lore: 2, gear: { chance: 0.3, items: ['knife', 'dagger', 'axe', 'cap', 'gambeson', 'bracers', 'buckler', 'boots', 'sling', 'shortbow'] },
    quest: 'На дороге засели разбойники. Купцы боятся ехать.',
    desc: 'Беглый крепостной, дезертир из имперского войска или разорённый гвельф. Кошелёк или жизнь — обычно и то и другое.',
  },

  brigand_chief: {
    cat: 'Люди', name: 'Атаман разбойников', acc: 'атамана', g: 'm', glyph: 'P', color: '#e0583c',
    hp: 26, hit: 5, ev: 4, dmg: [3, 9], armor: 2, speed: 100,
    behavior: 'hostile', verb: 'рубит мечом', xp: 25, sight: 9,
    habitat: ['forest'], weight: 0, group: [1, 1],
    coins: [15, 40], lore: 4, gear: { chance: 0.7, items: ['sword', 'nasal', 'mail', 'kite', 'leather', 'crossbow'] },
    desc: 'Бывший наёмник, сбежавший из-под знамён кондотьера. Держит шайку страхом и долей в добыче.',
  },

  // ── Дивные ──
  munaciello: {
    cat: 'Дивные', name: 'Монаккьелло', acc: 'монаккьелло', g: 'm', glyph: 'm', color: '#a08060',
    hp: 6, hit: 5, ev: 7, dmg: [0, 0], armor: 0, speed: 140,
    behavior: 'hostile', verb: 'шарит у тебя в кошеле', steal: true, xp: 6, sight: 8,
    habitat: ['road', 'field'], regions: ['campania'], weight: 3, group: [1, 1], max: 1,
    coins: [10, 25], lore: 6,
    desc: 'Маленький монах в капюшоне, дух неаполитанских домов. Подкидывает монеты тем, кто ему по нраву, и обчищает остальных. Догони его — и заберёшь его клад.',
  },
  mazzamurello: {
    cat: 'Дивные', name: 'Маццамурелло', acc: 'маццамурелло', g: 'm', glyph: 'i', color: '#c0a050',
    hp: 5, hit: 3, ev: 6, dmg: [1, 2], armor: 0, speed: 120,
    behavior: 'hostile', erratic: 0.3, verb: 'щиплет', xp: 4, sight: 8,
    ranged: { range: 4, dmg: [1, 3], verb: 'швыряет в тебя камнем' },
    habitat: ['field', 'forest', 'hill'], regions: ['papal', 'abruzzo', 'tuscany'], weight: 3, group: [1, 1],
    loot: { id: 'pebble', name: 'Гладкий камешек', value: 3 }, lore: 5,
    quest: 'Маццамурелло бьёт нам стёкла и пугает скотину.',
    desc: 'Проказливый дух Лацио и Абруццо: стучит по ночам, двигает утварь, кидается камнями. Злобы в нём немного, но камни настоящие.',
  },
  folletto: {
    cat: 'Дивные', name: 'Фоллетто', acc: 'фоллетто', g: 'm', glyph: 'i', color: '#7ac060',
    hp: 5, hit: 4, ev: 7, dmg: [1, 2], armor: 0, speed: 140,
    behavior: 'hostile', erratic: 0.5, verb: 'дёргает тебя за волосы', confuse: 4, xp: 4, sight: 7,
    habitat: ['forest', 'field', 'pine'], regions: ['north'], weight: 3, group: [1, 1],
    loot: { id: 'elf_knot', name: 'Эльфийский узел', value: 6 }, lore: 5,
    desc: 'Лесной проказник севера. Заплетает гривы коней в узлы, сбивает путников с тропы, хохочет из кустов.',
  },
  janas: {
    cat: 'Дивные', name: 'Джанас', acc: 'джанас', g: 'f', glyph: 'n', color: '#e0c060',
    hp: 4, hit: 1, ev: 8, dmg: [1, 2], armor: 0, speed: 130,
    behavior: 'flee', verb: 'колет иглой', xp: 2, curse: true,
    habitat: ['hill', 'forest'], regions: ['sardinia'], weight: 4, group: [1, 2],
    loot: { id: 'gold_thread', name: 'Золотая нить', value: 20 }, lore: 6,
    desc: 'Крохотные феи Сардинии, живущие в скальных гробницах. Ткут на золотых станках. Убить джанас — большой грех: Бог отвернётся от убийцы.',
  },
  salvan: {
    cat: 'Дивные', name: 'Сальван', acc: 'сальвана', g: 'm', glyph: 'Y', color: '#8a7a50',
    hp: 24, hit: 3, ev: 2, dmg: [3, 8], armor: 1, speed: 100,
    behavior: 'territorial', verb: 'бьёт кулачищем', xp: 14,
    habitat: ['pine', 'forest'], regions: ['alps', 'friuli', 'veneto'], weight: 2, group: [1, 1], max: 1,
    loot: { id: 'salvan_hair', name: 'Клок шерсти сальвана', value: 15 }, lore: 7,
    desc: 'Дикий человек альпийских лесов, заросший шерстью. Научил людей варить сыр и масло — и не простил, что они вырубают его лес.',
  },
  anguana: {
    cat: 'Дивные', name: 'Ангуана', acc: 'ангуану', g: 'f', glyph: 'n', color: '#60b0c0',
    hp: 8, hit: 3, ev: 5, dmg: [2, 4], armor: 0, speed: 100,
    behavior: 'hostile', verb: 'тянет тебя к воде', lure: 6, xp: 8, sight: 8,
    habitat: ['marsh', 'shore'], regions: ['alps', 'veneto', 'friuli', 'lombardy'], weight: 3, group: [1, 1], night: true,
    loot: { id: 'river_pearl', name: 'Речная жемчужина', value: 12 }, lore: 6,
    desc: 'Водяная дева рек Венето и Фриули: прекрасна лицом, но с козьими ногами. Поёт у воды и уводит путников на дно.',
  },
  siren: {
    cat: 'Дивные', name: 'Сирена', acc: 'сирену', g: 'f', glyph: 'n', color: '#d070a0',
    hp: 14, hit: 4, ev: 4, dmg: [3, 7], armor: 0, speed: 100,
    behavior: 'hostile', verb: 'вонзает когти', lure: 8, xp: 14, sight: 10,
    habitat: ['shore'], regions: ['campania', 'calabria', 'sicily'], weight: 6, group: [1, 1], max: 2,
    loot: { id: 'siren_scale', name: 'Чешуя сирены', value: 25 }, lore: 7,
    desc: 'Дочери Ахелоя с утёсов Сорренто и Сциллы. Их пение лишает воли. Мудрый затыкает уши — или очень крепко держится за веру.',
  },

  // ── Нечисть (только ночью) ──
  wisp: {
    cat: 'Нечисть', name: 'Блуждающий огонёк', acc: 'блуждающий огонёк', g: 'm', glyph: '*', color: '#6fd0c8',
    hp: 5, hit: 4, ev: 8, dmg: [1, 4], armor: 0, speed: 120,
    behavior: 'hostile', erratic: 0.4, verb: 'обжигает холодом', xp: 6, sight: 8,
    habitat: ['marsh'], weight: 3, group: [1, 2], night: true, unholy: true,
    loot: { id: 'wisp_glass', name: 'Мерцающая склянка', value: 10 }, lore: 7,
    desc: 'Душа некрещёного младенца или утопленника. Манит путника в трясину.',
  },
  ghoul: {
    cat: 'Нечисть', name: 'Упырь', acc: 'упыря', g: 'm', glyph: 'Z', color: '#8aa080',
    hp: 13, hit: 3, ev: 1, dmg: [2, 6], armor: 1, speed: 85,
    behavior: 'hostile', verb: 'рвёт гнилыми зубами', xp: 8, sight: 7, drain: true,
    habitat: ['field', 'road', 'forest', 'tomb'], weight: 2, group: [1, 2], night: true, unholy: true,
    loot: { id: 'grave_dirt', name: 'Могильная земля', value: 6 }, lore: 5,
    quest: 'На кладбище по ночам кто-то раскапывает свежие могилы.',
    desc: 'Мертвец, которого не приняла земля. Медлителен, но не знает усталости и пьёт кровь живых.',
  },
  ghost: {
    cat: 'Нечисть', name: 'Неупокоенная душа', acc: 'неупокоенную душу', g: 'f', glyph: 'G', color: '#a0c8e8',
    hp: 8, hit: 4, ev: 6, dmg: [1, 3], armor: 0, speed: 100,
    behavior: 'hostile', erratic: 0.3, verb: 'касается тебя ледяной рукой', graceDrain: 3, xp: 9, sight: 8,
    habitat: ['field', 'road', 'forest', 'hill', 'marsh', 'tomb'], weight: 2, group: [1, 1], night: true, unholy: true,
    loot: { id: 'ectoplasm', name: 'Саван', value: 8 }, lore: 6,
    desc: 'Душа, умершая без покаяния. Её прикосновение выстуживает не тело, а веру.',
  },
  black_dog: {
    cat: 'Нечисть', name: 'Чёрный пёс', acc: 'чёрного пса', g: 'm', glyph: 'C', color: '#6a4a8a',
    hp: 16, hit: 4, ev: 3, dmg: [2, 7], armor: 1, speed: 120,
    behavior: 'hostile', verb: 'терзает', xp: 12, sight: 10,
    habitat: ['road'], weight: 2, group: [1, 1], night: true, unholy: true, max: 1,
    loot: { id: 'black_fur', name: 'Клок чёрной шерсти', value: 15 }, lore: 8,
    desc: 'Пёс величиной с телёнка, глаза как угли. Стережёт перекрёстки и висельные холмы.',
  },
  strega: {
    cat: 'Нечисть', name: 'Стрега', acc: 'стрегу', g: 'f', glyph: 'H', color: '#c060a0',
    hp: 14, hit: 4, ev: 5, dmg: [2, 5], armor: 0, speed: 110,
    behavior: 'hostile', erratic: 0.15, verb: 'царапает', xp: 15, sight: 9, drain: true,
    ranged: { range: 5, dmg: [2, 5], verb: 'насылает на тебя порчу' },
    habitat: ['forest', 'field', 'road'], regions: ['mainland'], weight: 1, group: [1, 1], night: true, unholy: true,
    regionWeight: { campania: 4 },
    loot: { id: 'witch_ointment', name: 'Ведьмина мазь', value: 18 }, lore: 7,
    quest: 'Ведьма наводит порчу на скот — коровы доятся кровью.',
    desc: 'Ведьма, натёршаяся мазью и летящая на шабаш. Больше всего их у ореха Беневенто. Пьёт силу из своих жертв.',
  },
  surbile: {
    cat: 'Нечисть', name: 'Сурбиле', acc: 'сурбиле', g: 'f', glyph: 'V', color: '#a04050',
    hp: 16, hit: 4, ev: 4, dmg: [2, 6], armor: 0, speed: 115,
    behavior: 'hostile', verb: 'впивается тебе в шею', xp: 16, sight: 9, drain: true,
    habitat: ['field', 'road', 'hill'], regions: ['sardinia'], weight: 3, group: [1, 1], night: true, unholy: true, max: 1,
    loot: { id: 'surbile_fang', name: 'Клык сурбиле', value: 22 }, lore: 7,
    desc: 'Сардинская ведьма-кровопийца. Ночью её душа выходит из тела и ищет колыбели. Боится ножниц и серпа.',
  },
  lamia: {
    cat: 'Нечисть', name: 'Ламия', acc: 'ламию', g: 'f', glyph: 'N', color: '#70a070',
    hp: 22, hit: 4, ev: 3, dmg: [2, 7], armor: 1, speed: 105,
    behavior: 'hostile', verb: 'обвивает и душит', poison: 4, xp: 20, sight: 8,
    habitat: ['hill', 'marsh', 'shore'], regions: ['calabria', 'sicily', 'apulia'], weight: 2, group: [1, 1],
    night: true, unholy: true, max: 1,
    loot: { id: 'lamia_skin', name: 'Змеиная кожа ламии', value: 28 }, lore: 8,
    desc: 'Древняя тварь Великой Греции: сверху прекрасная женщина, снизу змея. Пожирает путников у развалин храмов.',
  },
  werewolf: {
    cat: 'Нечисть', name: 'Лупо маннаро', acc: 'лупо маннаро', g: 'm', glyph: 'W', color: '#c8463c',
    hp: 30, hit: 5, ev: 4, dmg: [3, 9], armor: 1, speed: 115, regen: 1,
    behavior: 'hostile', verb: 'рвёт когтями', xp: 30, sight: 10,
    habitat: ['forest', 'pine', 'field'], regions: ['mainland', 'sicily'], weight: 1, group: [1, 1],
    night: true, unholy: true, max: 1,
    loot: { id: 'werewolf_claw', name: 'Коготь лупо маннаро', value: 35 }, lore: 9,
    quest: 'В полнолуние у нас пропадают люди. Пастух клянётся, что видел волка на двух ногах.',
    desc: 'Итальянский оборотень. Родился в Рождественскую ночь или проклят. Днём человек, ночью зверь; раны затягиваются на глазах.',
  },

  // ── Обитатели римских подземелий ──
  skeleton: {
    cat: 'Нечисть', name: 'Скелет легионера', acc: 'скелета легионера', g: 'm', glyph: 'x', color: '#e8e0d0',
    hp: 12, hit: 3, ev: 2, dmg: [2, 6], armor: 2, speed: 90,
    behavior: 'hostile', verb: 'рубит гладиусом', xp: 8, sight: 7,
    habitat: ['tomb'], weight: 5, group: [1, 3], unholy: true,
    loot: { id: 'legion_buckle', name: 'Бронзовая пряжка легионера', value: 6 }, lore: 5,
    gear: { chance: 0.15, items: ['gladius', 'galea', 'scutum'] },
    desc: 'Кости солдата, которого похоронили без положенной монеты для Харона. Всё ещё держит строй и щит — '
      + 'и всё ещё помнит, как колоть снизу.',
  },
  lemur: {
    cat: 'Нечисть', name: 'Лемур', acc: 'лемура', g: 'm', glyph: 'L', color: '#9a8ab8',
    hp: 9, hit: 4, ev: 6, dmg: [1, 4], armor: 0, speed: 110,
    behavior: 'hostile', erratic: 0.3, verb: 'шепчет тебе в ухо имена мёртвых', graceDrain: 2, xp: 9, sight: 8,
    habitat: ['tomb'], weight: 4, group: [1, 2], unholy: true,
    loot: { id: 'tomb_lamp', name: 'Погребальная лампа', value: 8 }, lore: 6,
    desc: 'Неупокоенный дух римлянина. В майские Лемурии отцы семейств бросали за спину чёрные бобы, '
      + 'чтобы откупиться от них. Здесь бобов никто не бросал уже тысячу лет.',
  },
  larva: {
    cat: 'Нечисть', name: 'Ларва', acc: 'ларву', g: 'f', glyph: 'l', color: '#90b878',
    hp: 7, hit: 4, ev: 5, dmg: [1, 3], armor: 0, speed: 120,
    behavior: 'hostile', verb: 'обдаёт тебя могильным ужасом', confuse: 5, xp: 7, sight: 8,
    habitat: ['tomb'], weight: 3, group: [1, 2], unholy: true,
    loot: { id: 'defixio', name: 'Свинцовая табличка проклятия', value: 10 }, lore: 6,
    desc: 'Злой дух преступника или убитого без погребения. Римляне клали в могилы свинцовые таблички с проклятиями, '
      + 'чтобы ларвы отнесли их адресату.',
  },
  proconsul: {
    cat: 'Чудовища', name: 'Тень проконсула', acc: 'тень проконсула', g: 'f', glyph: 'P', color: '#e0b040',
    hp: 55, hit: 6, ev: 3, dmg: [4, 10], armor: 2, speed: 100,
    behavior: 'hostile', verb: 'бьёт жезлом власти', xp: 90, sight: 10, drain: true,
    ranged: { range: 5, dmg: [3, 6], verb: 'проклинает тебя на мёртвой латыни' },
    habitat: ['tomb'], weight: 0, group: [1, 1], unholy: true, max: 1,
    loot: { id: 'gold_mask', name: 'Золотая погребальная маска', value: 100 }, lore: 9,
    desc: 'Дух наместника, правившего провинцией именем Цезаря. Его похоронили с золотом и рабами, '
      + 'и он до сих пор считает подземелье своей провинцией.',
  },

  // ── Чудовища ──
  orco: {
    cat: 'Чудовища', name: 'Орко', acc: 'орко', g: 'm', glyph: 'O', color: '#a08a5a',
    hp: 40, hit: 4, ev: 1, dmg: [4, 11], armor: 2, speed: 90,
    behavior: 'hostile', verb: 'бьёт дубиной', xp: 40, sight: 8,
    habitat: ['pine', 'hill', 'forest'], regions: ['calabria', 'abruzzo', 'campania'], weight: 0.6, group: [1, 1], max: 1,
    gear: { chance: 0.5, items: ['greataxe', 'mail', 'nasal', 'kite'] },
    loot: { id: 'orco_tooth', name: 'Зуб орко', value: 40 }, coins: [10, 40], lore: 8,
    quest: 'В горах поселился орко. Ест овец, а вчера унёс дровосека.',
    desc: 'Людоед из неаполитанских сказок: ростом с дуб, глуп и вечно голоден. В пещере у него, говорят, полно золота съеденных купцов.',
  },
  tarantasio: {
    cat: 'Чудовища', name: 'Змей Тарантазио', acc: 'змея Тарантазио', g: 'm', glyph: 'D', color: '#7ab040',
    hp: 90, hit: 6, ev: 2, dmg: [4, 12], armor: 3, speed: 95,
    behavior: 'hostile', verb: 'терзает зубами', xp: 150, sight: 10,
    ranged: { range: 5, dmg: [3, 6], verb: 'дышит на тебя смрадом', poison: 6 },
    habitat: ['marsh'], weight: 0, group: [1, 1], site: 'gerundo', max: 1,
    loot: { id: 'dragon_bone', name: 'Кость Тарантазио', value: 150 }, lore: 10,
    desc: 'Дракон озера Джерундо. Его дыхание отравляет воздух лихорадкой, он топит лодки и ест детей. Того, кто его убьёт, будут помнить веками.',
  },
};

const BEAST_ORDER = Object.keys(BEASTS);

const BEHAVIOR_TEXT = {
  flee: 'пуглив, убегает',
  hostile: 'нападает сам',
  territorial: 'нападает, если подойти близко',
  ambush: 'сидит в засаде',
};

// Развернуть группы регионов в списки.
for (const d of Object.values(BEASTS)) {
  if (!d.regions) continue;
  d.regions = [...new Set(d.regions.flatMap(r => REGION_GROUPS[r] || [r]))];
}

function beastInRegion(d, region) {
  return !d.regions || d.regions.includes(region);
}
