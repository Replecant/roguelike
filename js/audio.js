'use strict';

// ─── Звуки мира ────────────────────────────────────────────────────
// Всё синтезируется в браузере (Web Audio), без звуковых файлов: дождь и гроза, ветер, капель и гул
// подземелий, гомон города и рыночный шум, набат и погребальный звон. Что звучит — решает audioScene()
// по месту, погоде и часу; синтезатор плавно подводит каждый слой к нужной громкости.
// Браузер не даёт звучать, пока игрок не нажал клавишу или кнопку, — звук просыпается с первым действием.
// D — громкость: полная → тихо → выкл. Настройка хранится в браузере.

const AUDIO = { ctx: null, on: true, vol: 0.7, layers: null, scene: null, timers: {}, lastScene: 0 };

try {
  const s = JSON.parse(localStorage.getItem('anno-sound') || 'null');
  if (s) { AUDIO.on = s.on !== false; AUDIO.vol = typeof s.vol === 'number' ? s.vol : 0.7; }
} catch (e) { /* хранилище недоступно — звук по умолчанию */ }

function audioSaveSettings() {
  try { localStorage.setItem('anno-sound', JSON.stringify({ on: AUDIO.on, vol: AUDIO.vol })); } catch (e) { /* не страшно */ }
}

// D: полная громкость → тихо → без звука → полная.
function audioCycle() {
  if (AUDIO.on && AUDIO.vol > 0.5) AUDIO.vol = 0.3;
  else if (AUDIO.on) AUDIO.on = false;
  else { AUDIO.on = true; AUDIO.vol = 0.7; }
  audioSaveSettings();
  audioUnlock();
  if (AUDIO.layers) AUDIO.layers.master.gain.setTargetAtTime(AUDIO.on ? AUDIO.vol : 0, AUDIO.ctx.currentTime, 0.1);
  log(AUDIO.on ? `Звук: ${AUDIO.vol > 0.5 ? 'громко' : 'тихо'}.` : 'Звук выключен.', C.dim);
}

// ─── Что звучит здесь и сейчас ─────────────────────────────────────
// Возвращает целевые громкости слоёв (0..1) и колокол: null | 'tocsin' (набат) | 'knell' (погребальный звон).
function audioScene() {
  const z = { rain: 0, storm: 0, wind: 0, drips: 0, hum: 0, crowd: 0, market: 0, bell: null };
  if (!G.player || !G.over || G.player.hp <= 0 || !(topScreen() instanceof PlayScreen || G.screens.some(s => s instanceof PlayScreen))) return z;
  const ow = G.over, local = G.mode === 'local' && G.world, w = local ? G.world : null;
  const hour = timeInfo().hour, day = hour >= 7 && hour < 20;
  // Подземелье: ни погоды, ни ветра — капель и гул.
  if (w && w.kind === 'dungeon') { z.drips = 0.8; z.hum = 0.55 + Math.min(0.35, (w.depth || 0) * 0.1); return z; }
  // Погода (под открытым небом).
  const wk = G.weather ? G.weather.kind : 'clear';
  if (wk === 'rain') z.rain = 0.6;
  if (wk === 'storm') { z.rain = 1; z.storm = 1; }
  // Ветер: горы и перевалы, равнина, лес; в городе за стенами — едва.
  const t = ow.get(G.ox, G.oy);
  const byTerrain = { [OT.PEAK]: 0.85, [OT.MOUNT]: 0.75, [OT.PINE]: 0.5, [OT.HILL]: 0.45, [OT.FOREST]: 0.3, [OT.MARSH]: 0.3, [OT.PLAIN]: 0.35, [OT.FIELD]: 0.3 };
  z.wind = byTerrain[t] ?? 0.35;
  if (w && w.kind === 'city') z.wind *= 0.3;
  if (wk === 'blizzard') z.wind = 1;
  else if (wk === 'snow') z.wind = Math.max(z.wind, 0.5);
  else if (wk === 'storm') z.wind = Math.max(z.wind, 0.7);
  else if (wk === 'fog' || wk === 'heat') z.wind *= 0.4;
  // Поселение: гомон днём, рынок, ярмарка; беда — колокол.
  const place = w && w.kind === 'city' ? w.city : null;
  if (place) {
    const crowd = { city: 0.75, town: 0.55, village: 0.25, castle: 0.3, monastery: 0.12, inn: 0.35, pagan: 0.15 }[place.kind] ?? 0.3;
    z.crowd = day ? crowd : (place.kind === 'city' || place.kind === 'town' ? 0.06 : 0);
    if (day && (place.kind === 'city' || place.kind === 'town')) z.market = 0.45;
    if (day && activeFair(place)) { z.crowd = 1; z.market = 0.9; }
    const haps = happeningsAt(place);
    const raid = (G.happenings || []).some(h => h.kind === 'raid' && h.place === place.id && !(h.done && h.done.cleared) && timeInfo().day >= h.start && timeInfo().day <= h.end);
    if (raid || (place.id === 'parma' && typeof parmaSiege === 'function' && parmaSiege())) { z.bell = 'tocsin'; z.crowd = Math.max(z.crowd, 0.5); z.market = 0; }
    else if (haps.some(h => h.kind === 'plague' || h.kind === 'execution')) { z.bell = 'knell'; z.market = 0; z.crowd *= 0.5; }
  }
  return z;
}

// ─── Синтезатор ────────────────────────────────────────────────────

function noiseBuffer(ctx, seconds, brown) {
  const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; } else d[i] = white;
  }
  return buf;
}

function loopNoise(ctx, buf, dest) {
  const s = ctx.createBufferSource();
  s.buffer = buf; s.loop = true; s.loopStart = Math.random(); s.connect(dest); s.start();
  return s;
}

function filter(ctx, type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  return f;
}

function gainNode(ctx, v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }

// Собрать постоянные слои один раз.
function audioBuild() {
  const ctx = AUDIO.ctx, white = noiseBuffer(ctx, 3, false), brown = noiseBuffer(ctx, 4, true);
  const master = gainNode(ctx, AUDIO.on ? AUDIO.vol : 0);
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp); comp.connect(ctx.destination);
  const L = { master, white, brown };
  // Дождь: шипение высоко и шорох пониже.
  L.rain = gainNode(ctx); L.rain.connect(master);
  const hiss = filter(ctx, 'highpass', 2500), body = filter(ctx, 'bandpass', 900, 0.6);
  hiss.connect(L.rain); body.connect(L.rain);
  const hissG = gainNode(ctx, 0.22), bodyG = gainNode(ctx, 0.35);
  hissG.connect(hiss); bodyG.connect(body);
  loopNoise(ctx, white, hissG); loopNoise(ctx, white, bodyG);
  // Ветер: бурый шум через полосу, частота и сила гуляют порывами.
  L.wind = gainNode(ctx); L.windBand = filter(ctx, 'bandpass', 420, 1.1); L.windGust = gainNode(ctx, 0.6);
  loopNoise(ctx, brown, L.windGust); L.windGust.connect(L.windBand); L.windBand.connect(L.wind); L.wind.connect(master);
  // Гул подземелья: два низких тона и рокот.
  L.hum = gainNode(ctx); L.hum.connect(master);
  for (const f of [49, 49.7]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = gainNode(ctx, 0.18); o.connect(g); g.connect(L.hum); o.start(); }
  const rumbleLp = filter(ctx, 'lowpass', 140), rumbleG = gainNode(ctx, 0.5);
  loopNoise(ctx, brown, rumbleG); rumbleG.connect(rumbleLp); rumbleLp.connect(L.hum);
  // Эхо пещеры — для капель.
  L.drips = gainNode(ctx); L.echo = ctx.createDelay(1); L.echo.delayTime.value = 0.23;
  const fb = gainNode(ctx, 0.38), echoLp = filter(ctx, 'lowpass', 2200);
  L.drips.connect(master); L.drips.connect(L.echo); L.echo.connect(echoLp); echoLp.connect(fb); fb.connect(L.echo); echoLp.connect(master);
  // Гомон: несколько «голосов» — шум через две гласные полосы (форманты), слогами.
  L.crowd = gainNode(ctx); const crowdLp = filter(ctx, 'lowpass', 2600); L.crowd.connect(crowdLp); crowdLp.connect(master);
  L.voices = [];
  for (let i = 0; i < 7; i++) {
    const g = gainNode(ctx), f1 = filter(ctx, 'bandpass', 500, 6), f2 = filter(ctx, 'bandpass', 1500, 8), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const src = gainNode(ctx, 1); loopNoise(ctx, white, src);
    src.connect(f1); src.connect(f2); f1.connect(g); f2.connect(g);
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); pan.connect(L.crowd); } else g.connect(L.crowd);
    L.voices.push({ g, f1, f2, next: 0 });
  }
  // Рынок и колокол — одиночные удары, слой громкости общий.
  L.market = gainNode(ctx); L.market.connect(master);
  L.bell = gainNode(ctx, 0.9); L.bell.connect(master);
  L.storm = gainNode(ctx, 0.9); L.storm.connect(master);
  AUDIO.layers = L;
}

// Гласные (F1, F2) — для бормотания толпы.
const VOWELS = [[730, 1090], [570, 840], [300, 2300], [440, 1020], [520, 1190], [660, 1700], [390, 2000]];

// Один слог одного голоса.
function speakSyllable(v, t, level) {
  const [a, b] = VOWELS[(Math.random() * VOWELS.length) | 0], k = 0.85 + Math.random() * 0.3, len = 0.09 + Math.random() * 0.16;
  v.f1.frequency.setValueAtTime(a * k, t); v.f2.frequency.setValueAtTime(b * k, t);
  v.g.gain.setValueAtTime(0, t);
  v.g.gain.linearRampToValueAtTime(level * (0.5 + Math.random() * 0.5), t + len * 0.3);
  v.g.gain.linearRampToValueAtTime(0, t + len);
  return len;
}

// Капля: короткий тон, падающий вниз, — в эхо пещеры.
function dropAt(t, level) {
  const ctx = AUDIO.ctx, o = ctx.createOscillator(), g = gainNode(ctx), f0 = 1100 + Math.random() * 1500;
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.07);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25 * level, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
  o.connect(g); g.connect(AUDIO.layers.drips); o.start(t); o.stop(t + 0.2);
}

// Гром: рокот бурого шума, нарастает и долго катится.
function thunderAt(t) {
  const ctx = AUDIO.ctx, L = AUDIO.layers, s = ctx.createBufferSource(), lp = filter(ctx, 'lowpass', 300 + Math.random() * 300), g = gainNode(ctx);
  s.buffer = L.brown; s.connect(lp); lp.connect(g); g.connect(L.storm);
  const dur = 2.5 + Math.random() * 3, near = Math.random() < 0.35;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(near ? 1.1 : 0.6, t + (near ? 0.05 : 0.4));
  for (let k = 1; k < 5; k++) g.gain.linearRampToValueAtTime((near ? 0.9 : 0.5) * Math.random(), t + dur * k / 5);
  g.gain.linearRampToValueAtTime(0, t + dur);
  lp.frequency.setValueAtTime(near ? 900 : 350, t); lp.frequency.exponentialRampToValueAtTime(120, t + dur);
  s.start(t, Math.random() * 2); s.stop(t + dur + 0.1);
}

// Удар колокола: негармонические обертоны с долгим затуханием.
function bellAt(t, f0, level) {
  const ctx = AUDIO.ctx, L = AUDIO.layers;
  for (const [ratio, amp, dec] of [[0.5, 0.5, 4.5], [1, 0.8, 3.2], [1.19, 0.45, 2.4], [1.5, 0.35, 2.0], [2, 0.55, 1.8], [2.52, 0.25, 1.2], [3.01, 0.2, 0.9], [4.17, 0.12, 0.6]]) {
    const o = ctx.createOscillator(), g = gainNode(ctx);
    o.type = 'sine'; o.frequency.value = f0 * ratio * (1 + (Math.random() - 0.5) * 0.004);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * level * 0.18, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0003, t + dec);
    o.connect(g); g.connect(L.bell); o.start(t); o.stop(t + dec + 0.05);
  }
}

// Рыночный стук и звон: ящики, наковальня, монеты.
function marketAt(t, level) {
  const ctx = AUDIO.ctx, L = AUDIO.layers, r = Math.random();
  if (r < 0.5) {   // деревянный стук
    const s = ctx.createBufferSource(), bp = filter(ctx, 'bandpass', 500 + Math.random() * 600, 3), g = gainNode(ctx);
    s.buffer = L.white; s.connect(bp); bp.connect(g); g.connect(L.market);
    g.gain.setValueAtTime(0.5 * level, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
    s.start(t, Math.random()); s.stop(t + 0.08);
  } else if (r < 0.75) {   // наковальня вдалеке
    for (const [f, a] of [[880, 0.4], [2330, 0.25], [3710, 0.15]]) {
      const o = ctx.createOscillator(), g = gainNode(ctx);
      o.frequency.value = f; g.gain.setValueAtTime(a * level * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0003, t + 0.6);
      o.connect(g); g.connect(L.market); o.start(t); o.stop(t + 0.65);
    }
  } else {   // звон монет
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator(), g = gainNode(ctx), tt = t + k * (0.04 + Math.random() * 0.05);
      o.frequency.value = 3200 + Math.random() * 2400; g.gain.setValueAtTime(0.12 * level, tt); g.gain.exponentialRampToValueAtTime(0.0003, tt + 0.12);
      o.connect(g); g.connect(L.market); o.start(tt); o.stop(tt + 0.15);
    }
  }
}

// ─── Ход звука ─────────────────────────────────────────────────────

// Первое нажатие или клик: создать звук (раньше браузер не даст).
function audioUnlock() {
  if (!AUDIO.on && !AUDIO.ctx) return;
  const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!AC) return;
  try {
    if (!AUDIO.ctx) { AUDIO.ctx = new AC(); audioBuild(); AUDIO.timer = setInterval(audioTick, 100); }
    if (AUDIO.ctx.state === 'suspended') AUDIO.ctx.resume();
  } catch (e) { AUDIO.ctx = null; }
}

// Плавно подвести слои к сцене; разыграть одиночные звуки на ближайшие доли секунды.
function audioTick() {
  const ctx = AUDIO.ctx, L = AUDIO.layers;
  if (!ctx || !L || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (!AUDIO.scene || now - AUDIO.lastScene > 0.4) { AUDIO.scene = audioScene(); AUDIO.lastScene = now; }
  audioApply(now, AUDIO.scene, AUDIO.on && !document.hidden);
}

// Один такт: слои к сцене z, одиночные звуки — на ближайшие доли секунды после now.
function audioApply(now, z, on) {
  const L = AUDIO.layers;
  const ramp = (param, v, tc = 0.8) => param.setTargetAtTime(on ? v : 0, now, tc);
  ramp(L.rain.gain, z.rain * 0.55);
  ramp(L.wind.gain, z.wind * 1.3, 1.2);
  ramp(L.hum.gain, z.hum * 0.4, 1.5);
  ramp(L.drips.gain, z.drips, 0.5);
  ramp(L.crowd.gain, z.crowd * 2.4, 1.2);
  ramp(L.market.gain, z.market * 2.5, 0.8);
  if (!on) return;
  const T = AUDIO.timers, ahead = now + 0.15;
  // Порывы ветра: новая цель каждые пару секунд.
  if (z.wind > 0 && (T.gust || 0) < ahead) {
    L.windGust.gain.setTargetAtTime(0.25 + Math.random() * 0.75, now, 0.7 + Math.random());
    L.windBand.frequency.setTargetAtTime(260 + Math.random() * 520 + z.wind * 200, now, 1.2);
    T.gust = now + 1.5 + Math.random() * 2.5;
  }
  if (z.storm && (T.thunder || 0) < ahead) { if (T.thunder) thunderAt(now + 0.05); T.thunder = now + 7 + Math.random() * 18; }
  if (z.drips > 0 && (T.drip || 0) < ahead) { dropAt(now + 0.05, z.drips); if (Math.random() < 0.3) dropAt(now + 0.2, z.drips * 0.6); T.drip = now + 0.6 + Math.random() * 2.5; }
  if (z.crowd > 0) for (const v of L.voices) if (v.next < ahead) {
    const pause = Math.random() < 0.25 ? 0.5 + Math.random() * 1.5 : 0.03;
    v.next = Math.max(v.next, now) + speakSyllable(v, Math.max(v.next, now + 0.02), 1) + pause;
  }
  if (z.market > 0 && (T.market || 0) < ahead) { marketAt(now + 0.05, z.market); T.market = now + 0.8 + Math.random() * 3 / z.market; }
  // Набат — часто и тревожно, сериями; погребальный звон — редкие низкие удары.
  if (z.bell === 'tocsin' && (T.bell || 0) < ahead) {
    bellAt(now + 0.05, 392, 1);
    T.bellN = (T.bellN || 0) + 1;
    T.bell = now + (T.bellN % 12 === 0 ? 3 : 0.42);
  } else if (z.bell === 'knell' && (T.bell || 0) < ahead) { bellAt(now + 0.05, 196, 0.9); T.bell = now + 4.5; }
}

// Звук просыпается с первым нажатием клавиши или касанием (раньше браузер не позволит).
document.addEventListener('keydown', audioUnlock, { capture: true });
document.addEventListener('pointerdown', audioUnlock, { capture: true });

// Вкладку свернули — замолчать; вернули — звучать.
document.addEventListener('visibilitychange', () => {
  if (!AUDIO.ctx) return;
  if (document.hidden) AUDIO.ctx.suspend(); else if (AUDIO.on) AUDIO.ctx.resume();
});
