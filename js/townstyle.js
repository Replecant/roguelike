'use strict';

// ─── Облик городов по землям ───────────────────────────────────────
// Один и тот же план города в разных краях выглядит по-своему: в долине По строят из кирпича,
// в Далмации — из белого известняка, в Овернь — из чёрного вулканического камня, в Альпах кроют
// крыши дранкой, в Валенсии и на Балеарах белят стены и делают плоские кровли. Здесь — только
// цвета: подмена fg/bg плиток при отрисовке местной карты (сама карта и сохранения не меняются).

// Крыша рисуется заливкой «▒» — полупрозрачный fg поверх bg; k — насколько темнее фон.
const roof = (col, k = 0.68) => ({ fg: [col, mix(col, '#000000', 0.06)], bg: mix(col, '#000000', k) });
const stone = (col, bg) => ({ fg: [col, mix(col, '#000000', 0.07)], bg });
const paving = (col, bg) => ({ fg: [col, mix(col, '#000000', 0.08), mix(col, '#ffffff', 0.06)], bg });

const TOWN_STYLES = {
  // Кирпичные города долины По, Сиены и Тулузы: стены, башни и ограды — красный кирпич.
  brick: {
    [T.STONEWALL]: stone('#ac6a4e', '#2a1a14'), [T.WALL]: stone('#a26048', '#22140e'),
    [T.TOWER]: stone('#b8735a', '#3a2418'), [T.WALLTOWER]: stone('#bc7a5c', '#2a1a14'),
    [T.YARDWALL]: stone('#9c5c44', '#24160f'), [T.HOUSE3]: roof('#9a6a58'),
  },
  // Далмация, Истрия, Апулия, Мальта: белый известняк и яркая черепица; на островах кроют каменной плитой.
  karst: {
    [T.HOUSE]: roof('#cc6a3e'), [T.HOUSE2]: roof('#dc9c5a'), [T.HOUSE3]: roof('#cfcab8', 0.55),
    [T.STONEWALL]: stone('#dcd6c6', '#2c2a25'), [T.WALL]: stone('#cec4ae', '#24211b'),
    [T.TOWER]: stone('#e4dcc8', '#46423a'), [T.WALLTOWER]: stone('#e8e0d0', '#2c2a25'),
    [T.YARDWALL]: stone('#c8c0ac', '#26231d'), [T.COBBLE]: paving('#c6c0b2', '#2a2824'),
  },
  // Овернь: чёрный вулканический камень, крыши из тёмной плиты-лозы.
  basalt: {
    [T.HOUSE]: roof('#8c4c36'), [T.HOUSE2]: roof('#6a6462'), [T.HOUSE3]: roof('#55524f', 0.6),
    [T.STONEWALL]: stone('#74706b', '#1a1918'), [T.WALL]: stone('#68645f', '#171615'),
    [T.TOWER]: stone('#7e7a74', '#2a2826'), [T.WALLTOWER]: stone('#86827b', '#1a1918'),
    [T.YARDWALL]: stone('#6c6862', '#191816'), [T.COBBLE]: paving('#7e7a74', '#1b1a18'),
  },
  // Альпы, Тироль, Каринтия, Босния, Загорье: дома из бруса под дранкой, плетни, утоптанные улицы.
  timber: {
    [T.HOUSE]: roof('#7c5436'), [T.HOUSE2]: roof('#9c6e42'), [T.HOUSE3]: roof('#6e675e'),
    [T.WALL]: stone('#80664a', '#1c150d'), [T.YARDWALL]: stone('#8c6c46', '#1e170e'),
    [T.TOWER]: stone('#a89c86', '#2e2a22'), [T.COBBLE]: paving('#9a8e78', '#221e17'),
  },
  // Валенсия, Майорка, Менорка: белёные стены, плоские кровли, глинобитные ограды и песчаные улицы.
  whitewash: {
    [T.HOUSE]: roof('#ece6d6', 0.42), [T.HOUSE2]: roof('#dcc69e', 0.5), [T.HOUSE3]: roof('#c8784e'),
    [T.STONEWALL]: stone('#ccb68e', '#2a2418'), [T.WALL]: stone('#ddd5c2', '#2a2720'),
    [T.TOWER]: stone('#d6c29a', '#40382a'), [T.WALLTOWER]: stone('#d8c49c', '#2a2418'),
    [T.YARDWALL]: stone('#e2dccc', '#2a2720'), [T.COBBLE]: paving('#c6b692', '#2a2418'),
  },
  // Арагон: глинобитные стены-тапиаль и кирпич мудехаров, земляные тона.
  adobe: {
    [T.HOUSE]: roof('#b4643e'), [T.HOUSE2]: roof('#c6a06c'), [T.HOUSE3]: roof('#a88c6c'),
    [T.STONEWALL]: stone('#bc9c72', '#2a2216'), [T.WALL]: stone('#b08c66', '#241c12'),
    [T.TOWER]: stone('#c08a64', '#3a2a1c'), [T.WALLTOWER]: stone('#c4a276', '#2a2216'),
    [T.YARDWALL]: stone('#b09470', '#241d13'), [T.COBBLE]: paving('#b4a684', '#26211a'),
  },
  // Бургундия и Лионне: светлый известняк, плоская бурая черепица и сланец.
  slate: {
    [T.HOUSE]: roof('#8e4a34'), [T.HOUSE2]: roof('#6c707a'), [T.HOUSE3]: roof('#a48e6c'),
    [T.STONEWALL]: stone('#c6bba0', '#28251e'), [T.WALL]: stone('#b4a88c', '#211e17'),
    [T.TOWER]: stone('#d0c4a8', '#3c3628'), [T.WALLTOWER]: stone('#d2c8ae', '#28251e'),
  },
  // Генуя и Корсика: крыши из лигурийского сланца, серый камень.
  ardesia: {
    [T.HOUSE]: roof('#6a6e78'), [T.HOUSE2]: roof('#c8904a'), [T.HOUSE3]: roof('#5c5e64'),
    [T.STONEWALL]: stone('#a29e96', '#24231f'), [T.WALL]: stone('#8e8a82', '#1d1c19'),
  },
  // Прованс, Лангедок, Каталония: тёплый охристый камень.
  ochre: {
    [T.HOUSE2]: roof('#d09a50'), [T.STONEWALL]: stone('#c8b290', '#28231b'), [T.WALL]: stone('#a88a68', '#201810'),
    [T.TOWER]: stone('#d4c09c', '#3c3428'), [T.WALLTOWER]: stone('#d6c4a0', '#28231b'),
    [T.COBBLE]: paving('#b4a890', '#24211b'),
  },
};

const REGION_STYLE = {
  lombardy: 'brick', emilia: 'brick', veneto: 'brick',
  dalmatia: 'karst', istria: 'karst', apulia: 'karst', malta: 'karst',
  auvergne: 'basalt',
  alps: 'timber', tyrol: 'timber', helvetia: 'timber', carantania: 'timber', savoy: 'timber', bosnia: 'timber', croatia: 'timber',
  valencia: 'whitewash', baleares: 'whitewash', menorca: 'whitewash',
  aragon: 'adobe',
  burgundy: 'slate', lyonnais: 'slate',
  liguria: 'ardesia', corsica: 'ardesia',
  provence: 'ochre', languedoc: 'ochre', catalonia: 'ochre',
};
// Отдельные города, что строились не так, как соседи.
const CITY_STYLE = { siena: 'brick', toulouse: 'brick', ragusa: 'karst', cattaro: 'karst' };

// Таблица подмен для места: city — город (если стоим в нём), region — земля.
function townStyle(region, cityId) {
  const name = (cityId && CITY_STYLE[cityId]) || REGION_STYLE[region] || (LAND_DEFS[region] && LAND_DEFS[region].style);
  return name ? TOWN_STYLES[name] || null : null;
}
