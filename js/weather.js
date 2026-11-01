'use strict';

// ─── Погода ────────────────────────────────────────────────────────
// Погода меняется каждые несколько часов и зависит от времени года и места:
// в Альпах и на севере зимой снег, на юге — дожди, летом в долинах зной,
// осенью и зимой по утрам туманы. Погода сужает обзор, замедляет путь,
// мочит тетивы луков и выстуживает ночёвку под открытым небом.

const WEATHER = {
  clear:    { name: 'ясно', icon: '☼', color: '#e0c060' },
  cloudy:   { name: 'пасмурно', icon: '☁', color: '#a0a0a0' },
  rain:     { name: 'дождь', icon: '☂', color: '#6a90c0', sight: 2, travel: 1.1, mud: 1.25, ranged: 1,
              drops: { ch: ["'", ','], fg: '#5a7aa8', n: 70 } },
  storm:    { name: 'гроза', icon: '≈', color: '#8080e0', sight: 3, travel: 1.25, mud: 1.4, ranged: 2,
              drops: { ch: ["'", '/'], fg: '#7090c8', n: 140 }, lightning: true },
  fog:      { name: 'туман', icon: '░', color: '#b0b0b0', sight: 5, travel: 1.1, hide: true },
  snow:     { name: 'снег', icon: '*', color: '#e0e8f0', sight: 2, travel: 1.25, ranged: 1, cold: 1,
              drops: { ch: ['*', '.'], fg: '#e8eef4', n: 60 } },
  blizzard: { name: 'метель', icon: '❄', color: '#ffffff', sight: 5, travel: 1.8, ranged: 2, cold: 2,
              drops: { ch: ['*', '-', '.'], fg: '#f0f4f8', n: 160 } },
  heat:     { name: 'зной', icon: '☀', color: '#f08030', travel: 1.1, hot: true },
};

// Вероятности по времени года (для тёплых и холодных мест).
/** @type {Record<string, Record<string, number>>} */
const WEATHER_ODDS = {
  winter: { clear: 3, cloudy: 4, rain: 3, storm: 0.3, fog: 2.5 },
  spring: { clear: 4, cloudy: 3, rain: 3, storm: 1, fog: 0.7 },
  summer: { clear: 7, cloudy: 1.5, rain: 0.8, storm: 1.2, heat: 3 },
  autumn: { clear: 3, cloudy: 3, rain: 4, storm: 0.8, fog: 2 },
};

function rollWeather() {
  const s = seasonOf(), odds = { ...WEATHER_ODDS[s] };
  const cold = snowyHere(G.ox, G.oy, true);
  if (cold) { odds.snow = (odds.rain || 0) + 1.5; odds.blizzard = 0.8; delete odds.rain; delete odds.storm; }
  const [, lat] = xyToGeo(G.ox, G.oy);
  if (lat < 40.5 && s === 'summer') { odds.heat *= 1.6; odds.rain *= 0.4; }   // юг выжжен солнцем
  if (lat > 44.5 && (s === 'autumn' || s === 'winter')) odds.fog = (odds.fog || 0) * 1.8;   // туманы Паданской равнины
  // Погода любит держаться: прежняя — с удвоенным весом.
  if (G.weather && odds[G.weather.kind]) odds[G.weather.kind] *= 2;
  const kind = rng.weighted(Object.entries(odds).map(([k, w]) => ({ k, w }))).k;
  const hours = kind === 'fog' ? rng.int(2, 5) : kind === 'storm' ? rng.int(1, 4) : rng.int(4, 14);
  return { kind, until: G.minutes + hours * 60 };
}

function weatherTick() {
  if (!G.over) return;
  if (G.weather && G.weather.until > G.minutes) return;
  const old = G.weather && G.weather.kind;
  G.weather = rollWeather();
  // Туман рассеивается к полудню, зной бывает только днём.
  const h = timeInfo().hour;
  if (G.weather.kind === 'heat' && (h < 9 || h > 18)) G.weather.kind = 'clear';
  const k = G.weather.kind;
  if (old && k !== old && G.player) log(WEATHER_SAYS[k] || `Погода: ${WEATHER[k].name}.`, WEATHER[k].color);
}

const WEATHER_SAYS = {
  clear: 'Тучи расходятся. Проглядывает солнце.',
  cloudy: 'Небо затягивает серой пеленой.',
  rain: 'Начинается дождь. Дорогу развозит, тетива сыреет.',
  storm: 'Гремит гроза! Ливень стеной, ничего не видно в двух шагах.',
  fog: 'Наползает густой туман. Мир сжимается до нескольких шагов.',
  snow: 'Пошёл снег. Тропы заметает.',
  blizzard: 'Поднялась метель! Идти почти невозможно.',
  heat: 'Солнце палит нещадно. Доспех раскаляется.',
};

function weatherNow() {
  if (!G.weather) weatherTick();
  return WEATHER[G.weather ? G.weather.kind : 'clear'];
}

// Под землёй и под крышей погоды нет.
function weatherApplies() {
  return !(G.mode === 'local' && G.world && G.world.kind === 'dungeon');
}

function weatherSight() { return weatherApplies() ? weatherNow().sight || 0 : 0; }
function weatherRanged() { return weatherApplies() ? weatherNow().ranged || 0 : 0; }

function weatherTravelMult(onRoad) {
  const w = weatherNow();
  let k = w.travel || 1;
  if (!onRoad && w.mud) k *= w.mud;       // распутица вне дорог
  if (w.hot && armorHeavy(G.player)) k *= 1.15;
  return k;
}

function armorHeavy(p) { return p.armor >= 4; }

// Ночёвка под открытым небом в холод или в непогоду.
function campWeatherHurt() {
  const p = G.player, w = weatherNow(), s = seasonOf();
  if (needsOff()) return;
  let dmg = 0;
  if (s === 'winter') dmg += snowyHere(G.ox, G.oy, true) ? rng.int(2, 4) : rng.int(0, 2);
  if (w.cold) dmg += w.cold * rng.int(1, 3);
  if (w === WEATHER.storm || w === WEATHER.rain) dmg += rng.int(0, 1);
  if (!dmg) return;
  p.hp = Math.max(1, p.hp - dmg);
  log(`Ночь под открытым небом выстуживает до костей: −${dmg} здоровья.`, C.sky);
}

// Капли и снежинки поверх карты (только для красоты).
function drawWeather(t, w, cx, cy) {
  const wd = weatherNow();
  if (!weatherApplies()) return;
  if (wd.drops) {
    const seed = Math.floor(G.minutes / MINUTES_PER_TURN);
    for (let i = 0; i < wd.drops.n; i++) {
      const sx = Math.floor(hash2(seed * 7 + i, i * 13) * MAP_W), sy = Math.floor(hash2(i * 3, seed * 11 + i) * MAP_H);
      if (w) { const x = cx + sx, y = cy + sy; if (!w.isVisible(x, y) || w.actorAt(x, y)) continue; }
      // На карте Италии капли реже и тусклее — местность не тонет в штриховке.
      if (!w && i % 2) continue;
      const dc = wd.drops.ch[i % wd.drops.ch.length], df = w ? wd.drops.fg : mix(wd.drops.fg, '#101418', 0.4);
      // С картинками капли ложатся поверх, не стирая местность.
      if (TILE_MODE) t.drops.push([sx, sy, dc, df]); else t.put(sx, sy, dc, df, undefined);
    }
  }
}

// Болотная лихорадка: летом в топях.
function feverRisk(ow, x, y) {
  const p = G.player, s = seasonOf();
  if (p.fever || (s !== 'summer' && !(s === 'autumn' && today().m === 9))) return;
  if (ow.get(x, y) !== OT.MARSH || !rng.chance(0.05)) return;
  p.fever = rng.int(4, 8);
  log('Тебя знобит. Болотная лихорадка! Пока она не пройдёт, раны не заживают. Помогут отвар травницы или молитва священника.', C.green);
}

function feverDaily() {
  const p = G.player;
  if (!p || !p.fever) return;
  p.fever--;
  if (!p.fever) { log('Лихорадка отступила.', C.green); return; }
  const dmg = rng.int(1, 3);
  p.hp = Math.max(1, p.hp - dmg);
  log(`Лихорадка треплет тебя: −${dmg} здоровья.`, C.green);
}
