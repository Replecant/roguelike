'use strict';

// ─── Звуки мира ────────────────────────────────────────────────────
// Записи под свободной лицензией лежат в sounds/ (откуда — sounds/LICENSE.md). Пока звучит один дождь:
// в дождь — вполголоса, в грозу — в полную силу; под землёй его не слышно. Громкость подводится плавно.
// Браузер не даёт звучать, пока игрок не нажал клавишу или кнопку, — звук просыпается с первым действием.
// D — громкость: громко → тихо → выкл. Настройка хранится в браузере.

const SOUND_FILES = { rain: 'rain' };
const AUDIO = { ctx: null, master: null, on: true, vol: 0.8, layers: {}, timer: 0 };

try {
  const s = JSON.parse(localStorage.getItem('anno-sound') || 'null');
  if (s) { AUDIO.on = s.on !== false; AUDIO.vol = typeof s.vol === 'number' ? s.vol : 0.8; }
} catch (e) { /* хранилище недоступно — звук по умолчанию */ }

function audioSaveSettings() {
  try { localStorage.setItem('anno-sound', JSON.stringify({ on: AUDIO.on, vol: AUDIO.vol })); } catch (e) { /* не страшно */ }
}

// Где взять запись: в однофайловой сборке — внутри страницы, иначе — рядом, в sounds/.
function soundUrl(name) {
  const ogg = typeof Audio !== 'undefined' && new Audio().canPlayType('audio/ogg; codecs="vorbis"');
  const file = `${name}.${ogg ? 'ogg' : 'mp3'}`;
  const inl = /** @type {any} */ (window).SOUNDS_INLINE;
  return (inl && inl[file]) || `sounds/${file}`;
}

// D: громко → тихо → без звука → громко.
function audioCycle() {
  if (AUDIO.on && AUDIO.vol > 0.5) AUDIO.vol = 0.4;
  else if (AUDIO.on) AUDIO.on = false;
  else { AUDIO.on = true; AUDIO.vol = 0.8; }
  audioSaveSettings();
  audioUnlock();
  if (AUDIO.master) AUDIO.master.gain.setTargetAtTime(AUDIO.on ? AUDIO.vol : 0, AUDIO.ctx.currentTime, 0.1);
  log(AUDIO.on ? `Звук: ${AUDIO.vol > 0.5 ? 'громко' : 'тихо'}.` : 'Звук выключен.', C.dim);
}

// Что должно звучать сейчас: громкость каждого слоя, 0..1.
function audioScene() {
  const z = { rain: 0 };
  if (!G.player || !G.over || G.player.hp <= 0 || !G.screens.some(s => s instanceof PlayScreen)) return z;
  if (!weatherApplies()) return z;   // под землёй дождя не слышно
  const wk = G.weather ? G.weather.kind : 'clear';
  if (wk === 'rain') z.rain = 0.6;
  if (wk === 'storm') z.rain = 1;
  return z;
}

// Слой: зацикленная запись со своей громкостью. Через Web Audio — без щелчка на стыке;
// если запись не скачать (страница открыта с диска), — обычный <audio> с повтором.
function audioLayer(name) {
  const L = { gain: AUDIO.ctx.createGain(), el: null, ready: false };
  L.gain.gain.value = 0;
  L.gain.connect(AUDIO.master);
  const url = soundUrl(SOUND_FILES[name]);
  fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.arrayBuffer(); })
    .then(b => AUDIO.ctx.decodeAudioData(b))
    .then(buf => {
      const src = AUDIO.ctx.createBufferSource();
      src.buffer = buf; src.loop = true; src.connect(L.gain); src.start();
      L.ready = true;
    })
    .catch(() => {
      const el = new Audio(url);
      el.loop = true; el.volume = 0;
      L.el = el; L.ready = true;
    });
  return L;
}

function audioUnlock() {
  if (!AUDIO.on && !AUDIO.ctx) return;
  try {
    const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!AC) return;
    if (!AUDIO.ctx) {
      AUDIO.ctx = new AC();
      AUDIO.master = AUDIO.ctx.createGain();
      AUDIO.master.gain.value = AUDIO.on ? AUDIO.vol : 0;
      AUDIO.master.connect(AUDIO.ctx.destination);
      for (const name of Object.keys(SOUND_FILES)) AUDIO.layers[name] = audioLayer(name);
      AUDIO.timer = setInterval(audioTick, 250);
    }
    if (AUDIO.ctx.state === 'suspended' && !document.hidden) AUDIO.ctx.resume();
  } catch (e) { /* без звука — так без звука */ }
}

function audioTick() {
  const z = audioScene(), now = AUDIO.ctx.currentTime;
  for (const [name, L] of Object.entries(AUDIO.layers)) {
    const v = z[name] || 0;
    if (L.el) {   // запасной путь: громкость <audio> ведём шагами
      const want = AUDIO.on ? v * AUDIO.vol : 0;
      L.el.volume = Math.max(0, Math.min(1, L.el.volume + Math.sign(want - L.el.volume) * Math.min(0.05, Math.abs(want - L.el.volume))));
      if (want > 0 && L.el.paused && !document.hidden) L.el.play().catch(() => {});
      if (want === 0 && L.el.volume === 0 && !L.el.paused) L.el.pause();
    } else L.gain.gain.setTargetAtTime(v, now, 1.2);   // дождь нарастает и стихает секунды за три
  }
}

document.addEventListener('keydown', audioUnlock, { capture: true });
document.addEventListener('pointerdown', audioUnlock, { capture: true });
// Вкладка скрыта — тишина.
document.addEventListener('visibilitychange', () => {
  if (!AUDIO.ctx) return;
  if (document.hidden) { AUDIO.ctx.suspend(); for (const L of Object.values(AUDIO.layers)) if (L.el) L.el.pause(); }
  else AUDIO.ctx.resume();
});
