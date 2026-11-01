'use strict';

// ─── Бестиарий Италии ──────────────────────────────────────────────
// behavior: flee — бежит; hostile — нападает; territorial — нападает вблизи;
//           ambush — сидит в засаде; scavenger — падальщик: бежит, но нападает на ослабевшего.
// under: поведение под землёй (в склепах и подземельях), если оно другое.
// habitat (местность на местной карте): field, forest, pine, marsh, hill, road, shore.
// regions: регионы или группы регионов из content/italy/realms.js (по умолчанию — везде).
// speed: 100 — как человек. lore — какая Мудрость нужна, чтобы знать повадки
// без убийства. max — сколько таких может бродить на одной карте. minLvl — с какого уровня героя встречается
// (и с какого его посылают на этого зверя). warn — чем предостерегают о чудище местные (слух в разговоре).
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
    habitat: ['hill', 'pine'], regions: ['alps', 'piedmont', 'helvetia', 'carantania', 'provence', 'languedoc', 'lyonnais', 'savoy', 'tyrol'], weight: 6, group: [1, 3],
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
    cat: 'Звери', name: 'Волк', acc: 'волка', g: 'm', glyph: 'w', color: '#a8a8a8',
    hp: 9, hit: 2, ev: 3, dmg: [1, 5], armor: 0, speed: 110,
    behavior: 'hostile', verb: 'кусает', xp: 5, sight: 9,
    habitat: ['forest', 'pine', 'hill'], regions: ['mainland', 'sicily', 'helvetia', 'carantania', 'provence', 'languedoc', 'lyonnais', 'savoy', 'tyrol', 'dalmatia'], weight: 5, group: [1, 3], nightWeight: 2,
    loot: { id: 'wolf_pelt', name: 'Волчья шкура', value: 6 }, lore: 5,
    quest: 'Волки режут наших овец прямо у загонов.',
    desc: 'Серый разбойник гор и лесов, от Апеннин до Альп и Пиренеев. Ходит стаями, зимой спускается к деревням. Ночью волков вдвое больше — или так кажется.',
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
    habitat: ['pine', 'hill', 'forest'], regions: ['alps', 'abruzzo', 'friuli', 'veneto', 'helvetia', 'carantania', 'provence', 'languedoc', 'lyonnais', 'savoy', 'tyrol', 'dalmatia'], weight: 2, group: [1, 1],
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
    behavior: 'scavenger', erratic: 0.5, verb: 'клюёт', xp: 1, sight: 6, pest: true,
    habitat: ['field'], weight: 4, group: [1, 3],
    loot: { id: 'crow_feather', name: 'Вороньи перья', value: 1 }, lore: 3,
    quest: 'Вороньё клюёт посевы, да и примета дурная.',
    desc: 'Падальщик и вестник. Здорового человека сторонится, но кружит над раненым — и, если тот совсем ослаб, слетается клевать.',
  },
  rat: {
    cat: 'Звери', name: 'Крыса', acc: 'крысу', g: 'f', glyph: 'r', color: '#8a7a6a',
    hp: 2, hit: 1, ev: 4, dmg: [1, 2], armor: 0, speed: 110,
    behavior: 'flee', under: 'hostile', verb: 'кусает', xp: 1, sight: 5, pest: true,
    habitat: ['field', 'road', 'marsh', 'tomb'], weight: 4, group: [2, 4],
    loot: { id: 'rat_tail', name: 'Крысиные хвосты', value: 1 }, lore: 2,
    quest: 'Крысы прогрызли амбар насквозь.',
    desc: 'Под открытым небом крыса юркнет в нору. Но в склепах и подземельях голодные стаи сами бросаются на живых. Вместе с ними, говорят, ходит и мор.',
  },
  bat: {
    cat: 'Звери', name: 'Летучая мышь', acc: 'летучую мышь', g: 'f', glyph: 'v', color: '#6a5a6a',
    hp: 3, hit: 2, ev: 7, dmg: [1, 2], armor: 0, speed: 160,
    behavior: 'flee', under: 'hostile', erratic: 0.6, verb: 'кусает', xp: 1, sight: 6, pest: true,
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
  imperial_soldier: {
    cat: 'Люди', name: 'Имперский латник', acc: 'имперского латника', g: 'm', glyph: 'p', color: '#d8c060',
    hp: 18, hit: 5, ev: 3, dmg: [3, 8], armor: 2, speed: 100,
    behavior: 'hostile', verb: 'рубит мечом', xp: 14, sight: 9,
    habitat: [], weight: 0, group: [2, 4], coins: [4, 14], lore: 3,
    gear: { chance: 0.25, items: ['nasal', 'gambeson', 'shield', 'axe', 'mail'] },
    desc: 'Немецкий или апулийский латник из войска императора под Пармой. Дозоры стерегут подступы к городу днём и ночью.',
  },
  guelf_militia: {
    cat: 'Люди', name: 'Гвельфский ополченец', acc: 'гвельфского ополченца', g: 'm', glyph: 'p', color: '#6a9ae0',
    hp: 15, hit: 4, ev: 3, dmg: [2, 7], armor: 2, speed: 100,
    behavior: 'hostile', verb: 'колет копьём', xp: 12, sight: 9,
    habitat: [], weight: 0, group: [2, 4], coins: [3, 12], lore: 3,
    gear: { chance: 0.25, items: ['spear', 'gambeson', 'cap', 'shield', 'crossbow'] },
    desc: 'Горожанин из ополчения коммуны под знаменем с ключами святого Петра или с лилией. Днём ткач или кожевник, в походе — копейщик.',
  },
  jailer: {
    cat: 'Люди', name: 'Тюремщик Эццелино', acc: 'тюремщика', g: 'm', glyph: 'p', color: '#a04848',
    hp: 16, hit: 4, ev: 3, dmg: [2, 7], armor: 2, speed: 100, prisonGuard: true,
    behavior: 'hostile', verb: 'бьёт дубинкой', xp: 12, sight: 8,
    habitat: [], weight: 0, group: [1, 1], coins: [2, 10], lore: 3,
    gear: { chance: 0.2, items: ['club', 'gambeson', 'cap', 'knife'] },
    desc: 'Тюремщик замка Сан-Пьетро в Вероне. Служит Эццелино да Романо и знает в лицо каждого, кто ходит по этим подвалам.',
  },
  prison_warden: {
    cat: 'Люди', name: 'Гуэцелло, начальник тюрьмы', acc: 'Гуэцелло', g: 'm', glyph: 'P', color: '#d04040',
    hp: 38, hit: 6, ev: 3, dmg: [3, 10], armor: 3, speed: 100, prisonGuard: true, max: 1,
    behavior: 'hostile', verb: 'рубит фальшионом', xp: 45, sight: 9,
    habitat: [], weight: 0, group: [1, 1], coins: [15, 40], lore: 5,
    gear: { chance: 0.6, items: ['sword', 'mail', 'nasal'] },
    desc: 'Начальник тюрьмы Сан-Пьетро, человек Эццелино. О нём говорят, что он ни разу не спросил у узника имени — только сколько тот протянет.',
  },
  brigand: {
    cat: 'Люди', name: 'Разбойник', acc: 'разбойника', g: 'm', glyph: 'p', color: '#c86a50',
    hp: 12, hit: 3, ev: 3, dmg: [2, 6], armor: 1, speed: 100,
    behavior: 'hostile', verb: 'бьёт дубьём', xp: 8, sight: 8,
    habitat: ['road', 'forest'], weight: 3, group: [1, 3],
    coins: [3, 12], lore: 2, gear: { chance: 0.3, items: ['knife', 'dagger', 'axe', 'cap', 'gambeson', 'bracers', 'buckler', 'boots', 'sling', 'shortbow'] },
    quest: 'На дороге засели разбойники. Купцы боятся ехать.',
    desc: 'Беглый крепостной, дезертир из имперского войска или разорённый гвельф. Кошелёк или жизнь — обычно и то и другое.',
  },

  bandit_lord: {
    cat: 'Люди', name: 'Атаман', acc: 'атамана', g: 'm', glyph: 'P', color: '#ff7040',
    hp: 48, hit: 6, ev: 5, dmg: [4, 11], armor: 3, speed: 100,
    behavior: 'hostile', verb: 'рубит фальшионом', xp: 80, sight: 10, max: 1,
    habitat: [], weight: 0, group: [1, 1], coins: [30, 70], lore: 6,
    gear: { chance: 0.9, items: ['sword', 'mail', 'kite', 'nasal', 'crossbow', 'greaves'] },
    desc: 'Знаменитый атаман, о котором поют в тавернах и за голову которого подеста обещает серебро. '
      + 'Бывший рыцарь, лишённый земли, или беглый кондотьер — дерётся как рыцарь, а жалости не знает.',
  },
  // Бывший солдат в шайке — из-под Пармы, из королевских дозоров, из отрядов коммун (вместо одного разбойника).
  deserter: {
    cat: 'Люди', name: 'Дезертир', acc: 'дезертира', g: 'm', glyph: 'p', color: '#b8a070',
    hp: 16, hit: 4, ev: 3, dmg: [2, 7], armor: 2, speed: 100,
    behavior: 'hostile', verb: 'рубит по-солдатски', xp: 15, sight: 9,
    habitat: [], weight: 0, group: [1, 1], coins: [5, 16], lore: 3,
    gear: { chance: 0.65, items: ['mail', 'nasal', 'crossbow', 'spear', 'shield', 'gambeson', 'kite', 'axe'] },
    desc: 'Солдат, бросивший знамя: из-под Пармы, из коммунального ополчения, из королевского дозора. '
      + 'Дерётся умело, носит то, что унёс из лагеря, и знает, что пощады ему не будет — ни от своих, ни от чужих.',
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
    habitat: ['pine', 'forest'], regions: ['alps', 'friuli', 'veneto', 'helvetia', 'carantania', 'tyrol'], weight: 2, group: [1, 1], max: 1,
    loot: { id: 'salvan_hair', name: 'Клок шерсти сальвана', value: 15 }, lore: 7,
    desc: 'Дикий человек альпийских лесов, заросший шерстью. Научил людей варить сыр и масло — и не простил, что они вырубают его лес.',
  },
  anguana: {
    cat: 'Дивные', name: 'Ангуана', acc: 'ангуану', g: 'f', glyph: 'n', color: '#60b0c0',
    hp: 8, hit: 3, ev: 5, dmg: [2, 4], armor: 0, speed: 100,
    behavior: 'hostile', verb: 'тянет тебя к воде', lure: 6, xp: 8, sight: 8,
    habitat: ['marsh', 'shore'], regions: ['alps', 'veneto', 'friuli', 'lombardy', 'tyrol'], weight: 3, group: [1, 1], night: true,
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
  // Тени сожжённых — только на Поле сожжённых у Монсегюра (js/cathars.js).
  burned_shade: {
    cat: 'Нечисть', name: 'Тень сожжённого', acc: 'тень сожжённого', g: 'f', glyph: 'G', color: '#e07040',
    hp: 12, hit: 4, ev: 5, dmg: [2, 5], armor: 0, speed: 100,
    behavior: 'hostile', erratic: 0.25, verb: 'обжигает тебя холодным пламенем', graceDrain: 1, xp: 10, sight: 8,
    habitat: [], weight: 0, group: [1, 1], unholy: true, lore: 6,
    desc: 'Тень одного из тех, кого сожгли под Монсегюром. Не злоба держит её здесь, а боль: костёр был долгим, '
      + 'а молитвы за них никто не читал. Она горит и не сгорает и гонит живых от пепла.',
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
    habitat: ['forest', 'field', 'road'], regions: ['mainland', 'helvetia', 'carantania', 'provence', 'languedoc', 'lyonnais', 'savoy', 'tyrol', 'dalmatia'],
    weight: 1, group: [1, 1], night: true, unholy: true,
    regionWeight: { campania: 4 },
    // Везде своё имя и свои поверья.
    local: {
      'helvetia,tyrol': { name: 'Хексе', acc: 'хексе',
        desc: 'Так в немецких долинах Гельвеции и Тироля зовут ведьму. Варит в котле град и сбрасывает его на чужие поля, '
          + 'доит соседских коров, не подходя к хлеву, а по ночам летает в горы на сходки. Пьёт силу из своих жертв.' },
      carantania: { name: 'Вешча', acc: 'вешчу',
        desc: 'Ведьма словен. Днём — соседка как соседка, а ночью душа её вылетает изо рта бабочкой или огоньком '
          + 'и летит на сходку. Перевернёшь спящее тело — душа не найдёт дороги назад. Пьёт силу из своих жертв.' },
      dalmatia: { name: 'Вештица', acc: 'вештицу',
        desc: 'Ведьма Далмации. Ночью снимает с себя кожу, оставляет её в углу и вылетает в трубу — мухой, бабочкой или курицей; '
          + 'на перекрёстках вештицы пляшут и сговариваются, у кого съесть сердце. Пьёт силу из своих жертв.' },
      'lyonnais,savoy': { name: 'Ведьма', acc: 'ведьму',
        desc: 'Так в Лионне зовут колдунью, что сквашивает молоко и насылает град на виноградники Божоле. Говорят, ведьмы '
          + 'собираются в Домбе, на островках среди прудов, и туманы над водой — их рук дело. Пьёт силу из своих жертв.' },
      'provence,languedoc': { name: 'Маска', acc: 'маску',
        desc: 'Так в Провансе и Лангедоке зовут ведьму. Оборачивается чёрной кошкой, сквашивает молоко и путает пряжу, '
          + 'по ночам собирается с подругами на перекрёстках. От неё вешают над дверью пучок зверобоя. Пьёт силу из своих жертв.' },
    },
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
    habitat: ['forest', 'pine', 'field'], regions: ['mainland', 'sicily', 'helvetia', 'carantania', 'provence', 'languedoc', 'lyonnais', 'savoy', 'tyrol', 'dalmatia'],
    weight: 1, group: [1, 1], night: true, unholy: true, max: 1, minLvl: 3,
    loot: { id: 'werewolf_claw', name: 'Коготь оборотня', value: 35 }, lore: 9,
    local: {
      'helvetia,tyrol': { name: 'Вервольф', acc: 'вервольфа',
        desc: 'Оборотень немецких долин: человек, что надел волчий пояс, полученный от нечистого. Снять пояс можно, '
          + 'лишь трижды назвав зверя крестильным именем. Днём человек, ночью зверь; раны затягиваются на глазах.' },
      dalmatia: { name: 'Вукодлак', acc: 'вукодлака',
        desc: 'Так в Далмации зовут оборотня — и того, кто встаёт из могилы. Днём он может быть соседом, ночью рыщет волком '
          + 'по каменным оградам; против него — терновый кол и чеснок над дверью. Раны затягиваются на глазах.' },
      carantania: { name: 'Волкодлак', acc: 'волкодлака',
        desc: 'Так словене зовут оборотня. Родился в сорочке под худой звездой или проклят — и рыщет ночами волком. '
          + 'Говорят, после смерти он встаёт упырём, если не пронзить его колом. Раны затягиваются на глазах.' },
      'provence,languedoc,lyonnais,savoy': { name: 'Лу-гару', acc: 'лу-гару',
        desc: 'Оборотень Прованса и Лангедока — грешник, обречённый семь лет бегать волком: каждую ночь он ныряет '
          + 'в источник и выходит зверем. Пустишь ему кровь — снимешь проклятье. Раны затягиваются на глазах.' },
    },
    quest: 'В полнолуние у нас пропадают люди. Пастух клянётся, что видел волка на двух ногах.',
    desc: 'Итальянский оборотень. Родился в Рождественскую ночь или проклят. Днём человек, ночью зверь; раны затягиваются на глазах.',
  },

  // ── Обитатели римских подземелий ──
  nuraghe_dead: {
    cat: 'Нечисть', name: 'Мертвец нурага', acc: 'мертвеца нурага', g: 'm', glyph: 'x', color: '#c8b088',
    hp: 12, hit: 3, ev: 2, dmg: [2, 6], armor: 1, speed: 90,
    behavior: 'hostile', verb: 'бьёт бронзовым кинжалом', xp: 8, sight: 7, unholy: true,
    habitat: [], weight: 0, group: [1, 2], lore: 5,
    loot: { id: 'bronze_dagger', name: 'Бронзовый кинжал', value: 8 },
    desc: 'Кости древнего воина в истлевшей коже, с бронзовым кинжалом за поясом. Кто клал их в нураги — сарды не помнят; '
      + 'помнят только, что тревожить их нельзя.',
  },
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
  nuraghe_guardian: {
    cat: 'Нечисть', name: 'Страж нурага', acc: 'стража нурага', g: 'm', glyph: 'N', color: '#c0a060',
    hp: 62, hit: 6, ev: 3, dmg: [4, 12], armor: 3, speed: 100,
    behavior: 'hostile', verb: 'бьёт бронзовым мечом', xp: 70, sight: 9,
    ranged: { range: 5, dmg: [2, 6], verb: 'мечет в тебя бронзовый дротик' },
    habitat: ['tomb'], weight: 0, group: [1, 1], unholy: true, max: 1,
    loot: { id: 'horned_helm', name: 'Рогатый бронзовый шлем', value: 70 }, lore: 8,
    desc: 'Тень воина из народа, что сложил нураги: рогатый шлем, круглый щит, бронзовый меч. '
      + 'Его поставили сторожить башню — и он сторожит её до сих пор, хотя ни башне, ни ему уже некому служить.',
  },
  proconsul: {
    cat: 'Чудовища', name: 'Тень проконсула', acc: 'тень проконсула', g: 'f', glyph: 'P', color: '#e0b040',
    hp: 80, hit: 7, ev: 3, dmg: [5, 13], armor: 2, speed: 100,
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
    hp: 75, hit: 5, ev: 1, dmg: [5, 15], armor: 2, speed: 90,
    behavior: 'hostile', verb: 'бьёт дубиной', xp: 40, sight: 8,
    habitat: ['pine', 'hill', 'forest'], regions: ['calabria', 'abruzzo', 'campania'], weight: 0.6, group: [1, 1], max: 1, minLvl: 4,
    gear: { chance: 0.5, items: ['greataxe', 'mail', 'nasal', 'kite'] },
    loot: { id: 'orco_tooth', name: 'Зуб орко', value: 40 }, coins: [10, 40], lore: 8,
    quest: 'В горах поселился орко. Ест овец, а вчера унёс дровосека.',
    desc: 'Людоед из неаполитанских сказок: ростом с дуб, глуп и вечно голоден. В пещере у него, говорят, полно золота съеденных купцов.',
    warn: [
      'В горах за деревней живёт орко. Детей им пугаем, да только он не сказка. Охотники в ту сторону не ходят.',
      'Если в лесу услышишь, как кто-то зовёт тебя по имени, — не откликайся и не ходи на голос. Это орко. Беги к дороге, туда он не выходит.',
    ],
  },
  giant: {
    cat: 'Чудовища', name: 'Великан', acc: 'великана', g: 'm', glyph: 'O', color: '#d8ccaa',
    hp: 68, hit: 5, ev: 0, dmg: [6, 14], armor: 3, speed: 85,
    behavior: 'territorial', verb: 'бьёт каменной глыбой', xp: 45, sight: 7,
    habitat: ['hill'], regions: ['malta'], weight: 0.4, group: [1, 1], max: 1,
    loot: { id: 'giant_marrow', name: 'Мозг из кости великана', value: 45 }, lootN: 2, coins: [0, 12], lore: 8,
    quest: 'На холмах опять видели великана. Овцы пропадают, а пастухи боятся выходить.',
    desc: 'Последний из тех, кто, по словам островитян, сложил храмы Джгантии. Медлителен, но камень в его руке ломает щит. '
      + 'Старики шепчут: кто сварит мозг из его кости с травами, сам на время станет силён, как великан.',
    warn: [
      'На холмах за Джгантией бродит великан — из тех, что сложили храмы. Камни ворочает, как мы хлебы. Пастухи гоняют коз в обход — и тебе советую.',
      'Видели на холме след: ступня в два локтя. Великан. Пока его не трогаешь — не тронет. А тронешь — бежать поздно будет, хоть он и неповоротлив.',
    ],
  },
  // Гельвеция: святой Беат, говорят, выгнал змея из пещеры над Тунским озером, а на горе над Люцерном змеи живут и поныне.
  alp_dragon: {
    cat: 'Чудовища', name: 'Горный змей', acc: 'горного змея', g: 'm', glyph: 'D', color: '#8a9a70',
    hp: 80, hit: 6, ev: 2, dmg: [5, 13], armor: 3, speed: 90,
    behavior: 'territorial', verb: 'хлещет хвостом', xp: 60, sight: 8,
    habitat: ['pine', 'hill'], regions: ['helvetia'], weight: 0.35, group: [1, 1], max: 1,
    loot: { id: 'dragon_stone', name: 'Драконий камень', value: 50 }, coins: [0, 20], lore: 8,
    quest: 'Пастухи видели в горах змея с крыльями. Он спускается к пастбищам, и коровы перестали давать молоко.',
    desc: 'Чешуйчатый змей альпийских пещер, толщиной с бревно, с короткими лапами и крыльями, на которых он не столько летает, сколько прыгает со скал. '
      + 'Горцы говорят: в голове у старого змея растёт камень, что останавливает кровь и лечит от лихорадки.',
    warn: [
      'В горах над перевалом живёт змей. Пастухи гонят стада в обход его ущелья. Полезешь наверх — не говори потом, что не предупреждали.',
      'Увидишь в камнях блеск чешуи — уходи тихо и не оборачивайся. Змей с горы ленив и медлителен, но кто подошёл к нему близко, тот назад не приходил.',
    ],
  },
  // Карантания: белая серна с золотыми рогами с Триглава, змей болот и водяной.
  zlatorog: {
    cat: 'Дивные', name: 'Златорог', acc: 'Златорога', g: 'm', glyph: 'g', color: '#f0e0a0',
    hp: 26, hit: 4, ev: 6, dmg: [2, 6], armor: 0, speed: 135,
    behavior: 'flee', verb: 'бьёт золотым рогом', xp: 30, sight: 10, curse: true,
    habitat: ['hill', 'pine'], regions: ['carantania'], weight: 0.25, group: [1, 1], max: 1,
    loot: { id: 'golden_horn', name: 'Золотой рог', value: 70 }, lore: 7,
    desc: 'Белая серна с золотыми рогами, хозяйка горных садов Триглава. Бежит от людей быстрее ветра. '
      + 'Говорят, где упадёт её кровь, вырастают розы, а кто её убьёт — тот проклят: горы его не отпустят.',
    warn: [
      'Встретишь в горах белую серну с золотыми рогами — не стреляй. Это Златорог. Охотник, что ранил его, сорвался в пропасть, и с каждым так будет.',
    ],
  },
  lindwurm: {
    cat: 'Чудовища', name: 'Линдвурм', acc: 'линдвурма', g: 'm', glyph: 'D', color: '#6a8a50',
    hp: 90, hit: 6, ev: 1, dmg: [5, 14], armor: 3, speed: 85,
    behavior: 'territorial', verb: 'хватает пастью', xp: 65, sight: 7,
    habitat: ['marsh', 'shore', 'forest'], regions: ['carantania'], weight: 0.3, group: [1, 1], max: 1,
    loot: { id: 'dragon_stone', name: 'Драконий камень', value: 50 }, coins: [0, 25], lore: 8,
    quest: 'В болотах опять пропал вол. Следы — как от бревна, что ползло само, а по краям — когти.',
    desc: 'Бескрылый змей болот и озёрных берегов, с двумя когтистыми лапами и пастью, что заглатывает телёнка. '
      + 'Из-за такого, говорят, герцог и перенёс Клагенфурт на сухое место.',
    warn: [
      'В болотах за рекой живёт линдвурм — такой, какого, говорят, убили, когда ставили Клагенфурт. Видно, не последнего. Дети туда не ходят, и ты не ходи.',
      'Кто бродит по топям, пусть смотрит под ноги: линдвурм лежит в трясине, как бревно. Наступишь — пожалеешь, да недолго.',
    ],
  },
  // Вуивра — крылатая змея франко-провансальских преданий (Домб, Бюже, Бресс, Юра), с карбункулом во лбу.
  vouivre: {
    cat: 'Чудовища', name: 'Вуивра', acc: 'вуивру', g: 'f', glyph: 'D', color: '#c06070',
    hp: 60, hit: 6, ev: 4, dmg: [4, 11], armor: 2, speed: 95, poison: 3,
    behavior: 'territorial', verb: 'бьёт хвостом и жалит', xp: 55, sight: 9,
    habitat: ['marsh', 'forest', 'hill'], regions: ['lyonnais', 'savoy', 'helvetia'], weight: 0.25, group: [1, 1], max: 1,
    loot: { id: 'vouivre_gem', name: 'Карбункул вуивры', value: 80 }, coins: [0, 20], lore: 8,
    quest: 'Над прудами по ночам летает огонь — вуивра ищет воду. Вчера она унесла ягнёнка прямо со двора.',
    desc: 'Крылатая змея с женской головой, вместо глаза — карбункул, что светит в темноте ярче факела. '
      + 'Камень она снимает, лишь когда пьёт или купается; кто успеет схватить его — разбогатеет, кого она догонит — умрёт.',
    warn: [
      'Если ночью над прудами Домба увидишь огонёк, что летит, а не мерцает, — это вуивра. Не гонись за её камнем: кто гнался, того находили в камышах.',
      'Вуивра живёт у воды в горах Бюже. Пьёт она — камень лежит на берегу. Многие думали, что успеют. Ни один не успел.',
    ],
  },
  povodni: {
    cat: 'Дивные', name: 'Водяной', acc: 'водяного', g: 'm', glyph: 'n', color: '#4a8a9a',
    hp: 14, hit: 4, ev: 3, dmg: [2, 5], armor: 0, speed: 100,
    behavior: 'hostile', verb: 'тянет тебя под воду', lure: 5, xp: 12, sight: 7,
    habitat: ['shore', 'marsh'], regions: ['carantania'], weight: 2, group: [1, 1], night: true,
    loot: { id: 'river_pearl', name: 'Речная жемчужина', value: 12 }, lore: 6,
    desc: 'Водяной из Любляницы и Савы: юноша с мокрыми волосами и в зелёном кафтане. Зовёт плясать у воды — '
      + 'и кто пойдёт за ним в танце, того найдут утопленным.',
  },
  // Прованс: Тараска у Тараскона и драки Роны (о них писал Гервасий Тильберийский).
  tarasque: {
    cat: 'Чудовища', name: 'Тараска', acc: 'Тараску', g: 'f', glyph: 'T', color: '#8a7a4a',
    hp: 120, hit: 6, ev: 0, dmg: [6, 15], armor: 5, speed: 80,
    behavior: 'territorial', verb: 'хлещет хвостом-жалом', poison: 4, xp: 110, sight: 7,
    habitat: ['shore', 'marsh'], regions: ['provence'], weight: 0.15, group: [1, 1], max: 1,
    loot: { id: 'tarasque_scale', name: 'Чешуя Тараски', value: 60 }, coins: [5, 40], lore: 9,
    quest: 'У брода опять пропали люди. Рыбаки видели на отмели панцирь — огромный, как перевёрнутая лодка.',
    desc: 'Чудище Роны: львиная голова, панцирь как у черепахи, шесть медвежьих лап и хвост со жалом скорпиона. '
      + 'Святая Марфа усмирила одну — но, говорят, в болотах Камарга осталось её потомство.',
    warn: [
      'Ты к Роне? Держись подальше от камышей: там опять видели Тараску. Святая Марфа её усмирила, да, видно, не насовсем.',
      'Рыбаки говорят: в заводях что-то ворочается — панцирь как опрокинутая лодка, хвост как у змея. Тараска. Меч её не берёт, если сам ты не святой.',
    ],
  },
  drac: {
    cat: 'Дивные', name: 'Драк', acc: 'драка', g: 'm', glyph: 'n', color: '#5a8aa0',
    hp: 12, hit: 4, ev: 4, dmg: [2, 5], armor: 0, speed: 105,
    behavior: 'hostile', verb: 'тянет тебя в омут', lure: 6, xp: 11, sight: 8,
    habitat: ['shore', 'marsh'], regions: ['provence', 'languedoc'], weight: 2, group: [1, 1], night: true,
    loot: { id: 'river_pearl', name: 'Речная жемчужина', value: 12 }, lore: 6,
    desc: 'Водяной дух Роны. Плывёт по воде золотым кольцом или кубком: кто наклонится поднять — того утащит на дно, '
      + 'в свои подводные покои под Бокером.',
  },
  // Чудовища из бестиариев — «Физиолога», Исидора Севильского и книг о дивах земли: водятся где угодно,
  // но редко, и не попадаются, пока герой не окреп (minLvl).
  amphisbaena: {
    cat: 'Чудовища', name: 'Амфисбена', acc: 'амфисбену', g: 'f', glyph: 's', color: '#80a040',
    hp: 18, hit: 4, ev: 5, dmg: [2, 6], armor: 1, speed: 110, poison: 4,
    behavior: 'hostile', verb: 'кусает обеими головами', xp: 18, sight: 7,
    habitat: ['marsh', 'field'], weight: 0.25, group: [1, 1], max: 1, minLvl: 2,
    loot: { id: 'amphisbaena_skin', name: 'Кожа амфисбены', value: 18 }, lore: 6,
    desc: 'Змея с головой на каждом конце: ползёт в обе стороны и никогда не спит — одна голова сторожит, пока другая дремлет. '
      + 'Её кожа, говорят, спасает от простуды, если обернуть ею шею.',
  },
  basilisk: {
    cat: 'Чудовища', name: 'Василиск', acc: 'василиска', g: 'm', glyph: 'c', color: '#c8c040',
    hp: 28, hit: 5, ev: 4, dmg: [3, 8], armor: 2, speed: 95, poison: 5,
    behavior: 'territorial', verb: 'жалит', xp: 40, sight: 8,
    ranged: { range: 5, dmg: [2, 6], verb: 'смотрит на тебя смертоносным взглядом', poison: 4 },
    habitat: ['field', 'hill'], weight: 0.15, group: [1, 1], max: 1, minLvl: 4,
    loot: { id: 'basilisk_eye', name: 'Глаз василиска', value: 45 }, lore: 8,
    quest: 'В старом колодце за околицей поселился василиск. Двое заглянули туда — и не вернулись.',
    desc: 'Царь змей с петушиным гребнем: вылупляется, говорят, из яйца, что снёс старый петух, а высидела жаба. '
      + 'Взгляд его убивает траву, дыхание — птиц на лету. Боится лишь ласки и петушиного крика.',
    warn: [
      'За холмами в одном селе колодец засыпали камнями: там завёлся василиск. Увидишь в поле круг выжженной травы — поворачивай, не поднимая глаз.',
    ],
  },
  griffin: {
    cat: 'Чудовища', name: 'Грифон', acc: 'грифона', g: 'm', glyph: 'G', color: '#c8a060',
    hp: 55, hit: 6, ev: 4, dmg: [4, 11], armor: 2, speed: 130,
    behavior: 'territorial', verb: 'рвёт орлиными когтями', xp: 60, sight: 10,
    habitat: ['hill', 'pine'], weight: 0.1, group: [1, 1], max: 1, minLvl: 5,
    loot: { id: 'griffin_claw', name: 'Коготь грифона', value: 60 }, lore: 8,
    quest: 'Грифон уносит овец прямо из стада. Пастухи клянутся, что однажды он унёс и пастушонка.',
    desc: 'Тело льва, голова и крылья орла. Стережёт золото в горах и уносит в когтях быка. Его когти, оправленные в серебро, '
      + 'хранят в соборных ризницах как кубки: нальёшь в такой яд — он помутнеет.',
    warn: [
      'Пастухи видели над скалами грифона: крылья как парус, а в когтях нёс телка. К гнёздам наверх не лазь — он стережёт их пуще золота.',
    ],
  },
  manticore: {
    cat: 'Чудовища', name: 'Мантикора', acc: 'мантикору', g: 'f', glyph: 'M', color: '#b04030',
    hp: 50, hit: 6, ev: 3, dmg: [4, 10], armor: 2, speed: 115, poison: 5,
    behavior: 'hostile', verb: 'бьёт хвостом-жалом', xp: 55, sight: 9,
    ranged: { range: 5, dmg: [2, 6], verb: 'мечет в тебя шипы с хвоста' },
    habitat: ['forest', 'hill'], weight: 0.1, group: [1, 1], max: 1, minLvl: 5,
    loot: { id: 'manticore_sting', name: 'Жало мантикоры', value: 50 }, lore: 8,
    quest: 'В лесу завёлся зверь с человечьим лицом и тремя рядами зубов. Охотники слышали его голос — будто флейта и труба разом.',
    desc: 'Лев с лицом человека, три ряда зубов, хвост скорпиона, голос — как флейта и труба разом. '
      + 'Прыгает дальше, чем бросают копьё, и любит человечье мясо. Так пишут бестиарии — а бестиарии не лгут.',
    warn: [
      'Говорят, в чаще завелась мантикора: лицо человечье, а голос как у флейты. Если в лесу кто-то играет, а людей нет, — не иди на звук.',
    ],
  },
  chimera: {
    cat: 'Чудовища', name: 'Химера', acc: 'химеру', g: 'f', glyph: 'X', color: '#d06030',
    hp: 75, hit: 6, ev: 2, dmg: [5, 13], armor: 3, speed: 100,
    behavior: 'territorial', verb: 'рвёт львиной пастью', xp: 75, sight: 8,
    ranged: { range: 4, dmg: [3, 8], verb: 'дышит на тебя пламенем из козьей головы' },
    habitat: ['hill', 'pine'], weight: 0.08, group: [1, 1], max: 1, minLvl: 6,
    loot: { id: 'chimera_horn', name: 'Рог химеры', value: 55 }, lore: 9,
    quest: 'В горах видели зверя о трёх головах — львиной, козьей и змеиной. Он выжигает пастбища огнём.',
    desc: 'Спереди лев, посредине коза, сзади змей, и из пасти — огонь: так её описал Гомер, а за ним Исидор Севильский. '
      + 'Беллерофонт убил одну, сидя на крылатом коне. Говорят, не последнюю.',
    warn: [
      'Старики рассказывают: в горах видели химеру — три головы, и одна дышит огнём. Где пастбище выгорело посреди лета, туда не ходи.',
    ],
  },
  tarantasio: {
    cat: 'Чудовища', name: 'Змей Тарантазио', acc: 'змея Тарантазио', g: 'm', glyph: 'D', color: '#7ab040',
    hp: 135, hit: 7, ev: 2, dmg: [5, 16], armor: 3, speed: 95,
    behavior: 'hostile', verb: 'терзает зубами', xp: 150, sight: 10,
    ranged: { range: 5, dmg: [3, 6], verb: 'дышит на тебя смрадом', poison: 6 },
    habitat: ['marsh'], weight: 0, group: [1, 1], site: 'gerundo', max: 1,
    loot: { id: 'dragon_bone', name: 'Кость Тарантазио', value: 150 }, lore: 10,
    desc: 'Дракон озера Джерундо. Его дыхание отравляет воздух лихорадкой, он топит лодки и ест детей. Того, кто его убьёт, будут помнить веками.',
  },

  // ── Обитатели подземелий (только под землёй) ──
  etruscan_shade: {
    cat: 'Нечисть', name: 'Тень этруска', acc: 'тень этруска', g: 'f', glyph: 'e', color: '#d88a5a',
    hp: 14, hit: 4, ev: 3, dmg: [2, 6], armor: 1, speed: 100,
    behavior: 'hostile', verb: 'хлещет бронзовой плетью', xp: 11, sight: 7, unholy: true,
    habitat: ['tomb'], weight: 0, group: [1, 2],
    loot: { id: 'bronze_mirror', name: 'Этрусское бронзовое зеркало', value: 18 }, lore: 6,
    desc: 'Тень знатного этруска, что пировал на ложе в своей расписной гробнице и пирует там до сих пор. '
      + 'Не любит, когда незваные гости трогают его урны.',
  },
  charun: {
    cat: 'Чудовища', name: 'Харун', acc: 'Харуна', g: 'm', glyph: 'C', color: '#5a8ac8',
    hp: 90, hit: 7, ev: 2, dmg: [6, 16], armor: 3, speed: 90,
    behavior: 'hostile', verb: 'бьёт тяжёлым молотом', xp: 95, sight: 9, unholy: true, max: 1,
    habitat: ['tomb'], weight: 0, group: [1, 1], confuse: 3,
    loot: { id: 'charun_hammer', name: 'Молот Харуна', value: 90 }, lore: 9,
    desc: 'Этрусский демон смерти с синей кожей, крючковатым носом и молотом, которым добивает умирающих. '
      + 'Сторожит двери загробного мира — и не любит, когда в них стучат с этой стороны.',
  },
  pagan_guard: {
    cat: 'Люди', name: 'Страж рощи', acc: 'стража рощи', g: 'm', glyph: 'p', color: '#c87a3a',
    hp: 16, hit: 4, ev: 4, dmg: [2, 8], armor: 1, speed: 100,
    behavior: 'hostile', verb: 'бьёт копьём', xp: 12, sight: 9,
    habitat: [], weight: 0, group: [1, 1], coins: [1, 8], lore: 3,
    gear: { chance: 0.3, items: ['spear', 'cap', 'gambeson', 'knife'] },
    desc: 'Язычник из горного селения, взявшийся за копьё, когда пришли опрокинуть его богов. '
      + 'Дерётся за то же, за что дрались его предки при Феодосии.',
  },
  pagan_flamen: {
    cat: 'Люди', name: 'Фламин', acc: 'фламина', g: 'm', glyph: 'P', color: '#e0a050',
    hp: 30, hit: 4, ev: 3, dmg: [2, 6], armor: 0, speed: 100,
    behavior: 'hostile', verb: 'бьёт жертвенным ножом', xp: 40, sight: 9, graceDrain: 1,
    ranged: { range: 6, dmg: [2, 6], verb: 'призывает на тебя гнев подземных богов' },
    habitat: [], weight: 0, group: [1, 1], coins: [10, 30], lore: 5,
    desc: 'Жрец старых богов. Помнит молитвы, которые читали в Риме до Константина, и проклятия, которые читали после.',
  },
  grave_robber: {
    cat: 'Люди', name: 'Расхититель могил', acc: 'расхитителя могил', g: 'm', glyph: 'p', color: '#8a7a5a',
    hp: 11, hit: 3, ev: 4, dmg: [1, 6], armor: 0, speed: 110,
    behavior: 'hostile', verb: 'бьёт киркой', xp: 7, sight: 8,
    habitat: ['tomb'], weight: 0, group: [1, 3], coins: [3, 15], lore: 2,
    gear: { chance: 0.3, items: ['dagger', 'torch', 'knife', 'cap'] },
    desc: 'Ищет в катакомбах мощи, чтобы продать их как святые, и всё, что блестит. Свидетелей не оставляет.',
  },
  necromancer: {
    cat: 'Люди', name: 'Чернокнижник', acc: 'чернокнижника', g: 'm', glyph: 'P', color: '#a060d0',
    hp: 40, hit: 5, ev: 4, dmg: [2, 7], armor: 1, speed: 100,
    behavior: 'hostile', verb: 'бьёт посохом из кости', xp: 85, sight: 9, unholy: true, max: 1, graceDrain: 2,
    ranged: { range: 6, dmg: [3, 8], verb: 'шепчет проклятие над твоей тенью' },
    habitat: ['tomb'], weight: 0, group: [1, 1], coins: [30, 70],
    loot: { id: 'grimoire', name: 'Гримуар в переплёте из кожи', value: 80 }, lore: 8,
    desc: 'Еретик, бежавший от инквизиции под землю. Учится у мёртвых тому, чему не учат живые, '
      + 'и для этого ему нужны кости мучеников.',
  },
  mithras_bull: {
    cat: 'Чудовища', name: 'Бык Митры', acc: 'быка Митры', g: 'm', glyph: 'B', color: '#f0ece0',
    hp: 105, hit: 6, ev: 1, dmg: [6, 15], armor: 3, speed: 110,
    behavior: 'hostile', verb: 'бьёт рогами', xp: 120, sight: 12, max: 1,
    habitat: [], weight: 0, group: [1, 1], lore: 9,
    loot: { id: 'bull_horn', name: 'Рог быка Митры', value: 70 },
    desc: 'Белый бык из таинства Митры, вышедший из тьмы за рельефом. Митра заклал его в пещере по велению Солнца, '
      + 'и из крови быка выросли колосья и лоза. Тысячу лет он ждал, когда таинство довершат.',
  },
  imp: {
    cat: 'Нечисть', name: 'Бес', acc: 'беса', g: 'm', glyph: 'i', color: '#e04030',
    hp: 9, hit: 5, ev: 6, dmg: [1, 5], armor: 0, speed: 130,
    behavior: 'hostile', verb: 'рвёт когтями', xp: 10, sight: 9, unholy: true,
    habitat: [], weight: 0, group: [2, 3], lore: 5, graceDrain: 1,
    loot: { id: 'imp_horn', name: 'Рожки беса', value: 12 },
    desc: 'Мелкий бес, вызванный кровью и вывернутой наизнанку молитвой. Хохочет, кусается и норовит вцепиться в лицо. '
      + 'Боится креста больше, чем меча.',
  },
  cult_villager: {
    cat: 'Люди', name: 'Одержимый селянин', acc: 'одержимого селянина', g: 'm', glyph: 'p', color: '#b07060',
    hp: 13, hit: 3, ev: 2, dmg: [2, 6], armor: 0, speed: 100,
    behavior: 'hostile', verb: 'бьёт серпом', xp: 8, sight: 9,
    habitat: [], weight: 0, group: [1, 2], coins: [0, 6], lore: 3,
    desc: 'Крестьянин из «тихой деревни». Пустые глаза, молчаливая ярость. Утром он пахал поле, ночью поёт в пещерах.',
  },
  cult_leader: {
    cat: 'Люди', name: 'Настоятель Ансельмо', acc: 'настоятеля Ансельмо', g: 'm', glyph: 'P', color: '#d02040',
    hp: 55, hit: 5, ev: 4, dmg: [3, 9], armor: 1, speed: 100,
    behavior: 'hostile', verb: 'бьёт ритуальным ножом', xp: 110, sight: 10, max: 1, graceDrain: 2,
    ranged: { range: 6, dmg: [3, 9], verb: 'выкрикивает имя, от которого стынет кровь' },
    habitat: [], weight: 0, group: [1, 1], coins: [30, 60], lore: 9,
    loot: { id: 'black_book', name: 'Чёрная книга настоятеля', value: 90 },
    desc: 'Пропавший деревенский священник. Голод, неурожай и страх привели его к другому хозяину — и деревня пошла за ним. '
      + 'Обещал им хлеб и спокойные ночи. Сдержал обещание. Цену он не называл.',
  },
  cultist: {
    cat: 'Люди', name: 'Посвящённый Митры', acc: 'посвящённого Митры', g: 'm', glyph: 'p', color: '#d0504a',
    hp: 13, hit: 4, ev: 3, dmg: [2, 7], armor: 1, speed: 100,
    behavior: 'hostile', verb: 'бьёт жертвенным ножом', xp: 9, sight: 8,
    habitat: ['tomb'], weight: 0, group: [1, 3], coins: [2, 10], lore: 4,
    gear: { chance: 0.2, items: ['dagger', 'cap', 'gambeson'] },
    desc: 'Тайный поклонник непобедимого Солнца. Через тысячу лет после Рима в пещерах всё ещё режут быка — '
      + 'и не любят свидетелей.',
  },
  pater: {
    cat: 'Люди', name: 'Отец посвящённых', acc: 'Отца посвящённых', g: 'm', glyph: 'P', color: '#f0a040',
    hp: 45, hit: 6, ev: 4, dmg: [3, 9], armor: 2, speed: 100,
    behavior: 'hostile', verb: 'разит серпом Сатурна', xp: 85, sight: 9, max: 1,
    ranged: { range: 5, dmg: [3, 7], verb: 'слепит тебя огнём жертвенника' },
    habitat: ['tomb'], weight: 0, group: [1, 1], coins: [40, 90],
    loot: { id: 'mithras_crown', name: 'Лучистый венец Митры', value: 90 }, lore: 8,
    desc: 'Pater — высшая ступень посвящения. Носит фригийский колпак и посох, говорит от имени бога-быкоборца '
      + 'и не сомневается, что старые боги вернутся.',
  },
  grotto_crab: {
    cat: 'Звери', name: 'Гигантский краб', acc: 'гигантского краба', g: 'm', glyph: 'c', color: '#d06040',
    hp: 13, hit: 3, ev: 1, dmg: [2, 6], armor: 3, speed: 80,
    behavior: 'territorial', verb: 'стискивает клешнёй', xp: 8, sight: 5,
    habitat: ['tomb'], weight: 0, group: [1, 3],
    loot: { id: 'crab_claw', name: 'Клешня гигантского краба', value: 5 }, lore: 2,
    desc: 'Краб величиной с собаку. Живёт в гротах, где прилив приносит утопленников, и не брезгует ими.',
  },
  sea_serpent: {
    cat: 'Чудовища', name: 'Морской змей', acc: 'морского змея', g: 'm', glyph: 'S', color: '#4ab0a0',
    hp: 100, hit: 7, ev: 3, dmg: [5, 14], armor: 2, speed: 100, poison: 4,
    behavior: 'hostile', verb: 'хлещет хвостом', xp: 100, sight: 9, max: 1,
    habitat: ['tomb'], weight: 0, group: [1, 1],
    loot: { id: 'serpent_scale', name: 'Чешуя морского змея', value: 95 }, lore: 8,
    desc: 'Змей, что топит рыбачьи лодки у мыса. В грот заплывает в бурю — и там, говорят, спит на сундуках '
      + 'с затонувших галер.',
  },
  miner_ghost: {
    cat: 'Нечисть', name: 'Призрак рудокопа', acc: 'призрак рудокопа', g: 'm', glyph: 'g', color: '#a0b0a0',
    hp: 10, hit: 3, ev: 4, dmg: [1, 6], armor: 0, speed: 100,
    behavior: 'hostile', verb: 'бьёт призрачным кайлом', xp: 9, sight: 7, unholy: true,
    habitat: ['tomb'], weight: 0, group: [1, 2],
    loot: { id: 'miner_lamp', name: 'Лампа рудокопа', value: 6 }, lore: 5,
    desc: 'Каторжник, заваленный в штольне ещё при римлянах. Всё ещё ищет выход — и путь наверх ему загораживаешь ты.',
  },
  mine_spirit: {
    cat: 'Чудовища', name: 'Хозяин горы', acc: 'Хозяина горы', g: 'm', glyph: 'M', color: '#c0a860',
    hp: 90, hit: 6, ev: 3, dmg: [5, 14], armor: 4, speed: 90, regen: 1,
    behavior: 'hostile', verb: 'обрушивает на тебя камни', xp: 95, sight: 8, unholy: true, max: 1,
    habitat: ['tomb'], weight: 0, group: [1, 1],
    loot: { id: 'silver_heart', name: 'Серебряное сердце горы', value: 100 }, lore: 9,
    desc: 'Дух рудных жил, старше римлян и пунийцев. Позволяет брать серебро, пока в шахте поют и не ругаются. '
      + 'Здесь давно никто не поёт.',
  },
  crusader_ghost: {
    cat: 'Нечисть', name: 'Призрак крестоносца', acc: 'призрак крестоносца', g: 'm', glyph: 'K', color: '#e0e0f0',
    hp: 55, hit: 6, ev: 3, dmg: [4, 10], armor: 4, speed: 100, unholy: true, max: 1,
    behavior: 'hostile', verb: 'рубит длинным мечом', xp: 90, sight: 9,
    habitat: ['tomb'], weight: 0, group: [1, 1], graceDrain: 1,
    loot: { id: 'crusader_cross', name: 'Нашитый крест из Святой земли', value: 70 },
    gear: { chance: 0.7, items: ['sword', 'greathelm', 'mail', 'kite'] }, lore: 8,
    desc: 'Хозяин замка, вернувшийся из похода в Святую землю с чужим золотом на совести. Похоронен без покаяния '
      + 'и до сих пор охраняет то, что привёз.',
  },
  great_bear: {
    cat: 'Звери', name: 'Медведь-шатун', acc: 'медведя-шатуна', g: 'm', glyph: 'B', color: '#8a5a3a',
    hp: 48, hit: 5, ev: 1, dmg: [4, 12], armor: 3, speed: 95,
    behavior: 'hostile', verb: 'ломает лапой', xp: 55, sight: 9, max: 1,
    habitat: ['forest'], weight: 0, group: [1, 1],
    loot: { id: 'great_bear_pelt', name: 'Шкура медведя-шатуна', value: 40 }, lore: 5,
    desc: 'Медведь, поднятый из берлоги среди зимы — голодом, болезнью или чьей-то злой волей. Шатун не боится ни огня, '
      + 'ни людей; за ним тянется след из разорённых пасек и пропавших пастухов.',
  },

  // ── Пещера Сивиллы и подземный мир (Этна) ──
  hecate_hound: {
    cat: 'Чудовища', name: 'Пёс Гекаты', acc: 'пса Гекаты', g: 'm', glyph: 'H', color: '#8a8ad0',
    hp: 75, hit: 7, ev: 4, dmg: [5, 13], armor: 2, speed: 120, unholy: true, max: 1,
    behavior: 'hostile', verb: 'рвёт призрачными клыками', xp: 90, sight: 10, confuse: 2,
    habitat: ['tomb'], weight: 0, group: [1, 1],
    loot: { id: 'hecate_collar', name: 'Ошейник пса Гекаты', value: 60 }, lore: 9,
    desc: 'Чёрная гончая богини перекрёстков. Сторожит рощу Прозерпины и золотую ветвь — и лает так, что у живых стынет кровь.',
  },
  cyclops: {
    cat: 'Чудовища', name: 'Киклоп', acc: 'киклопа', g: 'm', glyph: 'O', color: '#d0a070',
    hp: 70, hit: 5, ev: 1, dmg: [5, 15], armor: 2, speed: 90,
    behavior: 'hostile', verb: 'бьёт кузнечным молотом', xp: 32, sight: 7,
    habitat: ['tomb'], weight: 0, group: [1, 1],
    loot: { id: 'cyclops_eye', name: 'Глаз киклопа', value: 30 }, lore: 7,
    desc: 'Одноглазый кузнец Вулкана. Куёт в недрах Этны громовые стрелы — и злится, когда отвлекают.',
  },
  salamander: {
    cat: 'Чудовища', name: 'Саламандра', acc: 'саламандру', g: 'f', glyph: 's', color: '#f08030',
    hp: 14, hit: 4, ev: 4, dmg: [2, 6], armor: 1, speed: 110, poison: 2,
    behavior: 'hostile', verb: 'жжёт огненной пастью', xp: 12, sight: 7,
    ranged: { range: 4, dmg: [2, 5], verb: 'плюётся огнём' },
    habitat: ['tomb'], weight: 0, group: [1, 3],
    loot: { id: 'salamander_skin', name: 'Шкурка саламандры', value: 14 }, lore: 6,
    desc: 'Ящерица, что живёт в огне и не горит. Алхимики дают за её шкурку хорошие деньги — если донесёшь не обжёгшись.',
  },
  shade: {
    cat: 'Нечисть', name: 'Тень умершего', acc: 'тень умершего', g: 'f', glyph: 'g', color: '#9090b0',
    hp: 12, hit: 4, ev: 5, dmg: [1, 6], armor: 0, speed: 100, unholy: true, graceDrain: 1,
    behavior: 'hostile', verb: 'касается ледяной рукой', xp: 10, sight: 7,
    habitat: ['tomb'], weight: 0, group: [2, 4],
    lore: 5,
    desc: 'Душа без погребения, что бродит по асфоделевым лугам. Тянется к живым — к их теплу, крови и памяти.',
  },
  cerberus: {
    cat: 'Чудовища', name: 'Цербер', acc: 'Цербера', g: 'm', glyph: 'C', color: '#d04030',
    hp: 120, hit: 8, ev: 3, dmg: [6, 17], armor: 3, speed: 110, unholy: true, max: 1, poison: 3,
    behavior: 'hostile', verb: 'кусает тремя пастями', xp: 140, sight: 10,
    habitat: ['tomb'], weight: 0, group: [1, 1],
    loot: { id: 'cerberus_fang', name: 'Клык Цербера', value: 90 }, lore: 9,
    desc: 'Трёхглавый пёс у переправы через Стикс. Впускает всех, не выпускает никого.',
  },
  fury: {
    cat: 'Нечисть', name: 'Эриния', acc: 'эринию', g: 'f', glyph: 'F', color: '#d050a0',
    hp: 24, hit: 5, ev: 5, dmg: [3, 8], armor: 1, speed: 115, unholy: true, confuse: 3,
    behavior: 'hostile', verb: 'хлещет змеиной плетью', xp: 28, sight: 9,
    habitat: ['tomb'], weight: 0, group: [1, 2],
    loot: { id: 'fury_torch', name: 'Факел эринии', value: 25 }, lore: 8,
    desc: 'Богиня мщения со змеями в волосах. В Тартаре она ищет виновных — а виновен всякий живой.',
  },
  dis_pater: {
    cat: 'Чудовища', name: 'Дит, владыка мёртвых', acc: 'Дита', g: 'm', glyph: 'D', color: '#e0c060',
    hp: 160, hit: 8, ev: 4, dmg: [6, 15], armor: 4, speed: 100, unholy: true, max: 1, drain: true, graceDrain: 2,
    behavior: 'hostile', verb: 'бьёт двузубцем', xp: 400, sight: 12, regen: 1,
    ranged: { range: 6, dmg: [4, 9], verb: 'изрекает твоё имя, и холод сжимает сердце' },
    habitat: ['tomb'], weight: 0, group: [1, 1],
    loot: { id: 'dis_crown', name: 'Чёрный венец Дита', value: 300 }, lore: 10,
    desc: 'Римляне звали его Дит Патер — Отец богатств, ибо всё золото земли лежит в его владениях. Церковь зовёт его иначе. '
      + 'Он правит тенями с тех пор, как первый человек закрыл глаза.',
  },
};

const BEHAVIOR_TEXT = {
  flee: 'пуглив, убегает',
  hostile: 'нападает сам',
  territorial: 'нападает, если подойти близко',
  ambush: 'сидит в засаде',
  scavenger: 'сторонится живых, но клюёт ослабевших',
};
