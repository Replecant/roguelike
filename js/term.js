'use strict';

// Палитра: выцветший пергамент, сажа, кровь и золото.
const C = {
  bg:      '#0c0b09',
  panel:   '#14120f',
  text:    '#d9d0bc',
  dim:     '#8a8272',
  dark:    '#4a453c',
  memory:  '#2c2b31',
  gold:    '#e0b04a',
  red:     '#c8463c',
  blood:   '#8c2a24',
  green:   '#7fae5a',
  leaf:    '#4f8a3c',
  pine:    '#2f6b3f',
  water:   '#3f78b8',
  deep:    '#2a4f86',
  brown:   '#9a6a3c',
  wood:    '#7a5230',
  stone:   '#a39d92',
  sky:     '#7fb6d8',
  violet:  '#a57fd0',
  cyan:    '#6fd0c8',
  orange:  '#d8843a',
  white:   '#f2ecdc',
  night:   '#1a2440',
};

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

const _mixCache = new Map();
// Смешать цвет a с цветом b в пропорции t (0..1).
function mix(a, b, t) {
  const key = a + b + t;
  let v = _mixCache.get(key);
  if (v) return v;
  const A = hexToRgb(a), B = hexToRgb(b);
  v = rgbToHex(
    Math.round(A[0] + (B[0] - A[0]) * t),
    Math.round(A[1] + (B[1] - A[1]) * t),
    Math.round(A[2] + (B[2] - A[2]) * t),
  );
  _mixCache.set(key, v);
  return v;
}

const BLOCK_SHADE = { '█': 1, '▓': 0.75, '▒': 0.5, '░': 0.28 };

// Текстовый «терминал» поверх canvas: сетка символов с цветами.
class Term {
  constructor(canvas, cols, rows) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = cols;
    this.rows = rows;
    this.size = cols * rows;
    this.chars = new Array(this.size);
    this.fgs = new Array(this.size);
    this.bgs = new Array(this.size);
    this.sprites = new Array(this.size).fill(null);   // картинка клетки местной карты (по типу клетки)
    this.marks = new Uint8Array(this.size);   // что в клетке (для простой графики): 1 — местность, 2 — живое, 3 — предмет/место
    this.fontFamily = '"DejaVu Sans Mono", "Cascadia Mono", Consolas, "Liberation Mono", "Courier New", monospace';
    this.clear();
  }

  fit(maxW, maxH) {
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;
    let fs = Math.floor(Math.min(maxW / (this.cols * 0.6), maxH / (this.rows * 1.2)));
    fs = Math.max(6, fs);
    let cw, ch;
    for (;;) {
      ctx.font = `${fs}px ${this.fontFamily}`;
      cw = Math.ceil(ctx.measureText('M').width);
      ch = Math.ceil(fs * 1.2);
      if ((cw * this.cols <= maxW && ch * this.rows <= maxH) || fs <= 6) break;
      fs--;
    }
    this.fs = fs;
    this.cw = cw;
    this.ch = ch;
    const w = cw * this.cols, h = ch * this.rows;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear() {
    this.chars.fill(' ');
    this.fgs.fill(C.text);
    this.bgs.fill(null);
    this.marks.fill(0);
    if (this.sprites) this.sprites.fill(null);
    this.drops = [];   // капли дождя и снежинки поверх картинок
  }

  sprite(x, y, name) { if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.sprites[y * this.cols + x] = name; }
  mark(x, y, k) { if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.marks[y * this.cols + x] = k; }

  put(x, y, ch, fg = C.text, bg) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.chars[i] = ch;
    this.fgs[i] = fg;
    this.marks[i] = 0;
    this.sprites[i] = null;
    if (bg !== undefined) this.bgs[i] = bg;
  }

  // Вывести строку; возвращает её длину. Без bg фон клетки сохраняется.
  print(x, y, str, fg = C.text, bg) {
    for (let i = 0; i < str.length; i++) this.put(x + i, y, str[i], fg, bg);
    return str.length;
  }

  // Строка с цветовой разметкой: "{gold}текст{} обычный".
  printRich(x, y, str, fg = C.text) {
    let cur = fg, cx = x;
    const re = /\{([#\w]*)\}/g;
    let last = 0, m;
    while ((m = re.exec(str))) {
      cx += this.print(cx, y, str.slice(last, m.index), cur);
      cur = m[1] ? (C[m[1]] || m[1]) : fg;
      last = re.lastIndex;
    }
    cx += this.print(cx, y, str.slice(last), cur);
    return cx - x;
  }

  printCenter(y, str, fg = C.text, x0 = 0, w = this.cols) {
    this.print(x0 + Math.floor((w - str.length) / 2), y, str, fg);
  }

  // Печать с переносом слов; возвращает число строк.
  printWrap(x, y, w, str, fg = C.text, maxLines = 99) {
    const lines = wrapText(str, w);
    for (let i = 0; i < lines.length && i < maxLines; i++) this.print(x, y + i, lines[i], fg);
    return Math.min(lines.length, maxLines);
  }

  fill(x, y, w, h, bg, ch = ' ') {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) this.put(i, j, ch, C.text, bg);
  }

  box(x, y, w, h, fg = C.dim, title = '', bg = C.panel) {
    this.fill(x, y, w, h, bg);
    for (let i = x + 1; i < x + w - 1; i++) {
      this.put(i, y, '─', fg, bg);
      this.put(i, y + h - 1, '─', fg, bg);
    }
    for (let j = y + 1; j < y + h - 1; j++) {
      this.put(x, j, '│', fg, bg);
      this.put(x + w - 1, j, '│', fg, bg);
    }
    this.put(x, y, '┌', fg, bg);
    this.put(x + w - 1, y, '┐', fg, bg);
    this.put(x, y + h - 1, '└', fg, bg);
    this.put(x + w - 1, y + h - 1, '┘', fg, bg);
    if (title) this.print(x + 2, y, ` ${title} `, C.gold, bg);
  }

  bar(x, y, w, val, max, fg, bgc = C.dark) {
    const n = max > 0 ? Math.round((Math.max(0, val) / max) * w) : 0;
    for (let i = 0; i < w; i++) this.put(x + i, y, i < n ? '█' : '░', i < n ? fg : bgc);
  }

  flush() {
    const ctx = this.ctx, cw = this.cw, ch = this.ch;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, cw * this.cols, ch * this.rows);
    ctx.font = `${this.fs}px ${this.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const live = [];   // живые — вторым проходом, крупнее клетки
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = y * this.cols + x;
        const bg = this.bgs[i];
        if (bg) {
          ctx.fillStyle = bg;
          ctx.fillRect(x * cw, y * ch, cw, ch);
        }
        const c = this.chars[i];
        // Блочные символы рисуем заливкой ровно по клетке: в шрифте они шире
        // клетки и наползали бы на соседей (и на героя).
        const shade = BLOCK_SHADE[c];
        if (shade) {
          ctx.globalAlpha = shade;
          ctx.fillStyle = this.fgs[i];
          ctx.fillRect(x * cw, y * ch, cw, ch);
          ctx.globalAlpha = 1;
        } else if (c !== ' ') {
          if (TILE_MODE && this.marks[i] === 2) { live.push(i); continue; }
          if (TILE_MODE && this.sprites[i] && drawTileSprite(ctx, this.sprites[i], this.fgs[i], x * cw, y * ch, cw, ch, i)) continue;
          if (TILE_MODE && this.marks[i] && drawSprite(ctx, c, this.fgs[i], bg, x * cw, y * ch, cw, ch, this.marks[i], i)) continue;
          ctx.fillStyle = this.fgs[i];
          ctx.fillText(c, x * cw + cw / 2, y * ch + ch / 2 + 1);
        }
      }
    }
    for (const i of live) {
      const x = i % this.cols, y = (i / this.cols) | 0;
      drawSprite(ctx, this.chars[i], this.fgs[i], this.bgs[i], x * cw, y * ch, cw, ch, 2, i);
    }
    ctx.globalAlpha = 0.7;
    for (const [x, y, c, fg] of this.drops) { ctx.fillStyle = fg; ctx.fillText(c, x * cw + cw / 2, y * ch + ch / 2 + 1); }
    ctx.globalAlpha = 1;
  }
}

function wrapText(str, w) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if (!line.length) line = word;
      else if (line.length + 1 + word.length <= w) line += ' ' + word;
      else { out.push(line); line = word; }
      while (line.length > w) { out.push(line.slice(0, w)); line = line.slice(w); }
    }
    out.push(line);
  }
  return out;
}
