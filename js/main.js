'use strict';

window.addEventListener('load', () => {
  const canvas = document.getElementById('screen');
  const touch = document.getElementById('touch');
  G.term = new Term(canvas, COLS, ROWS);
  G.screens = [new CreationScreen()];

  if (window.matchMedia('(pointer: coarse)').matches) touch.hidden = false;

  const wrap = document.getElementById('wrap');
  const fit = () => {
    const th = touch.hidden ? 0 : touch.offsetHeight;
    G.term.fit(wrap.clientWidth, window.innerHeight - th - 12);
    render();
  };
  fit();
  window.addEventListener('resize', fit);
  if (document.fonts) document.fonts.ready.then(fit);

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^F([2-9]|1\d)$/.test(e.code)) return;   // F5, F12 и т.п. — браузеру
    e.preventDefault();
    let code = e.code || '';
    if (e.key === '?') code = 'Slash';               // «?» на русской раскладке — Shift+7
    handleKey({ key: e.key, code, shift: e.shiftKey });
  });

  // Мигающий курсор и надпись на титульном экране.
  setInterval(() => { if (topScreen() instanceof CreationScreen) render(); }, 250);

  touch.addEventListener('pointerdown', e => {
    const b = e.target.closest('button');
    if (!b) return;
    e.preventDefault();
    handleKey({ key: b.dataset.key || '', code: b.dataset.code, shift: false });
  });
});
