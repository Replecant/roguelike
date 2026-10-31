// Помощники, которые тесты используют внутри страницы игры.
/* global G */
window.TH = {
  // Новый герой без экрана создания.
  start(peopleIdx = 0, stats = { str: 7, con: 6, dex: 6, wis: 6, fai: 6 }) {
    const people = PEOPLES[peopleIdx];
    const s = {};
    for (const st of STATS) s[st.key] = stats[st.key] + (people.mods[st.key] || 0);
    startGame(new Player('Тест', people, s), people.start);   // в тестах — предсказуемый город
    return G.player;
  },
  immortal() {
    const p = G.player;
    Object.defineProperty(p, 'maxHp', { get: () => 9999, configurable: true });
    p.hp = 9999;
  },
  go(place) {
    if (G.mode === 'local') leaveLocal();
    G.ox = place.x; G.oy = place.y;
    enterCity(place);
  },
  city(id) { return G.over.cities.find(c => c.id === id); },
  npc(role) { return G.world.villages[0].npcs.find(n => n.role === role); },
  // Выбрать пункт диалога по началу или регулярке; вернуть ответ.
  // Просить работу, пока не предложат особое дело (story), и взяться за него.
  storyWork(npc, story) {
    for (let i = 0; i < 80; i++) {
      npc.offer = null; npc.noWorkUntil = 0;
      this.ask(npc, 'Нет ли для меня работы');
      if (npc.offer && npc.offer.story === story) return this.ask(npc, npc.offer.accept);
    }
    return null;
  },
  // Enter на карте, когда рядом нет путников (иначе — выбор «войти или заговорить»).
  enter() {
    const near = travelersNear(true);
    G.travelers = (G.travelers || []).filter(t => !near.includes(t) || (t.escorted && escortOf(t)));
    overEnter();
  },
  ask(npc, label) {
    const d = new DialogScreen(npc);
    pushScreen(d);
    const i = d.options.findIndex(o => label instanceof RegExp ? label.test(o.label) : o.label.startsWith(label));
    if (i < 0) { popScreen(); return null; }
    d.choose(i);
    const text = d.text;
    while (G.screens.length > 1) popScreen();
    return text;
  },
  options(npc) { return new DialogScreen(npc).options.map(o => o.label); },
  lastLog(n = 1) { return G.messages.slice(-n).map(m => m.text).join(' / '); },
  // Поставить зверя рядом с игроком (в поле зрения).
  spawn(key, dx = 2, dy = 0) {
    const p = G.player, w = G.world;
    for (let r = 0; r < 6; r++)
      for (const [ax, ay] of [[dx + r, dy], [dx, dy + r], [-dx - r, dy], [dx, -dy - r]]) {
        const x = p.x + ax, y = p.y + ay;
        if (w.free(x, y)) { const m = makeBeast(key, x, y); w.actors.push(m); refreshFov(); return m; }
      }
    return null;
  },
  // Открытое место в дикой местности.
  wild() {
    if (G.mode === 'local') leaveLocal();
    enterWild(false);
    const w = G.world, p = G.player;
    for (const a of w.actors.slice()) if (a.kind === 'beast') w.actors.splice(w.actors.indexOf(a), 1);
    for (let y = p.y - 4; y <= p.y + 4; y++) for (let x = p.x - 10; x <= p.x + 10; x++) if (w.inside(x, y) && !(x === p.x && y === p.y)) w.set(x, y, 0);
    refreshFov();
    return w;
  },
};

window.assert = (cond, msg) => { if (!cond) throw new Error(msg); };
