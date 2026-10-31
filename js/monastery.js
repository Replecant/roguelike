'use strict';

// ─── Монастыри ─────────────────────────────────────────────────────
// У каждой обители своё лицо: Монтекассино с больницей, бедные братья
// Ассизи, книжное Бобьо, певчие Помпозы, пещера Архангела в Монте-Сант-Анджело,
// богатая имперская Фарфа, приют на горе Сакра-ди-Сан-Микеле.
// Во всякой есть библиотекарь: он покупает книги и свитки (их находят
// в тайниках и кладах), платит за работу в скриптории, пускает почитать.
// У аббата можно исповедаться — это гасит дурную молву (см. инквизицию).

const BOOKS = {
  book_psalter:   { name: 'Псалтирь в окладе', value: 40 },
  book_isidore:   { name: '«Этимологии» Исидора Севильского', value: 55 },
  book_boethius:  { name: '«Утешение философией» Боэция', value: 50 },
  book_vegetius:  { name: 'Вегеций, «О военном деле»', value: 45 },
  book_avicenna:  { name: 'Список «Канона» Авиценны', value: 90 },
  book_astrolabe: { name: 'Арабский трактат об астролябии', value: 70 },
  book_herbal:    { name: 'Травник Псевдо-Апулея с рисунками', value: 50 },
  book_gospels:   { name: 'Евангелие лангобардского письма', value: 85 },
  book_solinus:   { name: 'Солин, «Собрание достопамятного»', value: 45 },
};
const isBook = id => !!BOOKS[id];

function findBook() {
  const id = rng.pick(Object.keys(BOOKS)), b = BOOKS[id], p = G.player;
  const tr = p.trophies[id] || (p.trophies[id] = { name: b.name, value: b.value, count: 0 });
  tr.count++;
  log(`Среди прочего — книга: ${b.name}. Монахи за такое платят хорошо.`, C.gold);
}

// Лицо обители. lib — сколько платят за книги (доля цены); scr — плата за день в скриптории.
const MONASTERY_TRAITS = {
  'Монтекассино': { order: 'бенедиктинцы', lib: 1.2, scr: 1.1, service: 'hospital',
    lore: ['Здесь святой Бенедикт написал устав: «Молись и трудись». Восемь веков мы так и живём.',
      'Десять лет назад император выгнал отсюда половину братии — за то, что аббат держал сторону папы. Вернулись не все.'] },
  'Ассизи': { order: 'францисканцы', lib: 0.6, scr: 0.7, service: 'portiuncula',
    lore: ['Брат Франциск не велел нам держать ни денег, ни книг. Книги мы всё же держим. Деньги — стараемся не держать.',
      'Второго августа в Порциункуле — великое прощение: кто придёт с покаянием, тому отпустятся грехи.'] },
  'Бобьо': { order: 'бенедиктинцы', lib: 1.4, scr: 1.3, service: null,
    lore: ['Святой Колумбан пришёл сюда из Ирландии с сумкой книг. С тех пор мы собираем их шесть веков.',
      'У нас есть книги, которых больше нет нигде — даже в Риме. Мы стираем с пергамента старые слова и пишем новые, но самое ценное бережём.'] },
  'Помпоза': { order: 'бенедиктинцы', lib: 1.2, scr: 1.1, service: 'choir',
    lore: ['Здесь брат Гвидо придумал писать звуки на линейках: ut, re, mi, fa, sol, la. Теперь певчий выучивает гимн за дни, а не за годы.',
      'Наш аббат Иероним составил список библиотеки ещё полтора века назад. Шестьдесят три книги! Теперь их втрое больше.'] },
  'Монте-Сант-Анджело': { order: 'бенедиктинцы', lib: 0.8, scr: 0.9, service: 'grotto',
    lore: ['В этой пещере явился архангел Михаил. Ангелы сами освятили её — епископу не пришлось.',
      'Сюда шли норманны, крестоносцы, лангобарды. Все оставляли на камне кресты — смотри, вся стена исчерчена.'] },
  'Фарфа': { order: 'бенедиктинцы', lib: 1.1, scr: 1.0, service: 'refuge',
    lore: ['Фарфа — имперское аббатство: мы подчиняемся императору, а не епископу. Инквизиторы сюда не ходят.',
      'Когда-то у нас было больше земли, чем у иного герцога. Теперь меньше — но вина хватает.'] },
  'Сакра-ди-Сан-Микеле': { order: 'бенедиктинцы', lib: 0.9, scr: 0.9, service: 'hospice',
    lore: ['Мы стоим на дороге франков — из Франции в Рим. Кто идёт через перевал, ночует у нас, и мы никого не гоним.',
      'Двести сорок ступеней высечены в скале. Их зовут «лестницей мертвецов»: раньше по сторонам лежали покойники братии.'] },
};
const DEFAULT_TRAITS = { order: 'бенедиктинцы', lib: 1.0, scr: 1.0, service: null,
  lore: ['Обитель маленькая, но книги есть и у нас: Псалтирь, Устав и пара отцов Церкви.', 'Пишем, молимся, пашем. Больше ничего не умеем — и не надо.'] };
const traitsOf = place => MONASTERY_TRAITS[place.name] || DEFAULT_TRAITS;

function monasteryEnter(world, city) {
  if (city.kind !== 'monastery') return;
  const v = world.villages[0];
  if (!v || v.npcs.some(n => n.librarian)) return;
  const home = { x: v.cx - 6, y: v.cy - 3, w: 13, h: 7, building: -1 };
  const spot = findFreeIn(world, home) || findFreeIn(world, { x: v.x0, y: v.y0, w: v.w, h: v.h, building: -1 });
  if (!spot) return;
  const npc = makeNpc('peasant', v, home, spot[0], spot[1]);
  const bobbio = city.name === 'Бобьо';
  Object.assign(npc, { title: bobbio ? 'Библиотекарь аббатства' : 'Брат-библиотекарь', librarian: true, portrait: 'monk', special: 'librarian',
    greeting: bobbio ? FIB_PEOPLE.librarian.greeting : rng.pick(['Тише — здесь читают. Ты с книгой или за книгой?',
      'Библиотека открыта для того, кто умеет держать книгу, не ломая переплёт. Ты умеешь?']) });
  npc.name = bobbio ? 'Брат Амброджо' : `Брат ${npc.name}`;
  if (bobbio) npc.fib = 'librarian';
  v.npcs.push(npc);
  world.actors.push(npc);
}

function libraryOptions(npc) {
  const p = G.player, place = npc.village.city, tr = traitsOf(place), day = timeInfo().day, opts = [];
  opts.push({ label: 'Расскажи об обители', act: () => `«${rng.pick(tr.lore)}»` });
  // Книги.
  for (const [id, t] of Object.entries(p.trophies).filter(([id, t]) => isBook(id) && t.count)) {
    const price = Math.max(1, Math.round(p.priceSell(t.value) * tr.lib));
    opts.push({ label: `Продать: ${t.name} (${price} мон.)`, act: () => {
      t.count--; if (!t.count) delete p.trophies[id];
      p.coins += price;
      trainSkill(p, 'trade', price / 6);
      return tr.lib < 0.8 ? `«Мы бедны, брат: больше ${coins(price)} не дадим. Но книга будет в добрых руках».`
        : `Библиотекарь бережно листает, нюхает пергамент, качает головой. «${coins(price)}. Это хорошая цена — в Генуе тебе за неё дали бы вдвое меньше».`;
    } });
  }
  // Непрочитанные свитки — латынь, которую сам не понял.
  const scrolls = (p.scrolls || []).length;
  if (scrolls) {
    const each = Math.round(18 * tr.lib);
    opts.push({ label: `Продать свитки с латынью (${scrolls} шт., по ${each} мон.)`, act: () => {
      p.coins += each * scrolls;
      p.scrolls = [];
      return `«Рецепты, знаки… Мы разберёмся — или сожжём, если там бесовское». Ты получаешь ${coins(each * scrolls)}.`;
    } });
  }
  // Скрипторий: работа за плату.
  if (p.scriptoriumDay !== day) opts.push({ label: 'Поработать в скриптории (день)', act: () => {
    const lv = skillLevel(p, 'letters');
    if (lv < 1) return '«Писать не умеешь? Тогда разве что пергамент скоблить. Это работа для послушников».';
    p.scriptoriumDay = day;
    passTime(8 * 60);
    p.fatigue = Math.min(100, p.fatigue + 15);
    const pay = Math.round((5 + lv * 3) * tr.scr);
    p.coins += pay;
    trainSkill(p, 'letters', 4);
    return rng.pick(['До вечера ты переписываешь псалмы при свете из узкого окна. Пальцы немеют, но строчки ровные.',
      'Тебе дают переписывать грамоту на землю — скучно, зато платят. «Не перепутай межи, иначе будет тяжба на сто лет».',
      'Ты помогаешь брату-иллюминатору: растираешь краски, золотишь буквицы.'])
      + ` Плата — ${coins(pay)}.`;
  } });
  // Почитать: грамотный алхимик может найти рецепт в травнике.
  if (skillLevel(p, 'letters') >= 1 && !(p.readLib || {})[place.id]) opts.push({ label: 'Почитать в библиотеке', act: () => {
    p.readLib = p.readLib || {};
    p.readLib[place.id] = true;
    passTime(3 * 60);
    trainSkill(p, 'letters', 5);
    const unknown = COMMON_RECIPES().filter(id => !knowsRecipe(id));
    if (knowsAlchemy(p) && unknown.length && rng.chance(0.5)) {
      const id = rng.pick(unknown);
      learnRecipe(id, 'из монастырского травника');
      return `В старом травнике, между рисунками мандрагоры и шалфея, ты находишь пропись: ${RECIPES[id].name.toLowerCase()}. Запоминаешь.`;
    }
    return rng.pick(['Ты листаешь «Этимологии» Исидора: оказывается, слово «человек» происходит от «земли». Голова пухнет, но интересно.',
      'Тебе дают хронику обители. Пожары, голод, чудеса, споры с епископом — и всё это на одной странице, за один год.',
      'Ты читаешь бестиарий: единорога можно поймать только девицей, а пеликан кормит птенцов своей кровью. Монахи в это верят.']);
  } });
  return opts;
}

// Аббат: исповедь (гасит дурную молву) и служба обители.
function abbotOptions(npc) {
  const p = G.player, place = npc.village.city;
  if (place.kind !== 'monastery' || npc.role !== 'priest' || p.is('saracen')) return [];
  const tr = traitsOf(place), day = timeInfo().day, opts = [];
  const price = p.priceBuy(5);
  opts.push({ label: `Исповедаться аббату (лепта ${price} мон.)`, act: () => {
    if (p.confessDay && day - p.confessDay < 7) return '«Ты исповедовался на этой неделе. Не превращай таинство в привычку — живи так, чтобы было в чём каяться реже».';
    if (p.coins < price) return '«Лепта не плата, но обители надо жить».';
    p.coins -= price;
    p.confessDay = day;
    p.lastPractice = day;
    addPiety(2, 'Исповедь.');
    const had = p.heresy || 0;
    p.heresy = Math.max(0, had - 3);
    return had > 0 ? 'Аббат долго слушает, не перебивая. «Звёзды, печати… Брось это, сын мой. Я наложу на тебя епитимью, и пусть люди видят, что ты ходишь к исповеди». Шёпот за спиной стихнет.'
      : 'Аббат слушает, кивает, отпускает грехи. «Ступай с миром».';
  } });
  switch (tr.service) {
    case 'hospital': opts.push({ label: 'Попросить место в больнице братьев', act: () => {
      if (p.hospitalDay && day - p.hospitalDay < 7) return '«Койка нужна и другим. Приходи через неделю, если не полегчает».';
      p.hospitalDay = day;
      passTime(12 * 60);
      p.hp = p.maxHp; p.poison = 0; p.fever = 0; p.fatigue = 0;
      return 'Тебя укладывают на чистую солому в длинной палате. Брат-лекарь промывает раны вином, читает над тобой и уходит. Утром ты здоров. Платы не берут — «Христа ради».';
    } }); break;
    case 'portiuncula': {
      const dt = today(), feast = dt.m === 8 && dt.d <= 2;
      opts.push({ label: feast ? 'Получить прощение Порциункулы' : 'Попросить хлеба у братьев', act: () => {
        if (feast) {
          if (p.portiunculaYear === dt.y) return '«Ты уже получил прощение в этом году. Иди и не греши».';
          p.portiunculaYear = dt.y;
          addPiety(10, 'Прощение Порциункулы.');
          p.heresy = 0;
          return 'Толпа паломников, свечи, пение. Ты входишь в крохотную часовню Порциункулы на коленях — и выходишь, будто родился заново.';
        }
        if (p.friarBread === day) return '«Мы сами едим не досыта, брат. Приходи завтра».';
        p.friarBread = day;
        p.food = Math.min(100, p.food + 40);
        return 'Брат отламывает тебе полкраюхи и даёт луковицу. «Мир и благо». Больше у них ничего нет.';
      } });
      break;
    }
    case 'choir': opts.push({ label: 'Послушать певчих', act: () => {
      if (p.choirDay === day) return '«Вечерня уже отпета. Приходи завтра».';
      p.choirDay = day;
      passTime(60);
      p.grace = p.maxGrace;
      p.lastPractice = day;
      return 'Ut queant laxis… Монахи поют по новым нотам брата Гвидо — так стройно, что дрожат свечи. Ты выходишь, полный благодати.';
    } }); break;
    case 'grotto': opts.push({ label: 'Спуститься в пещеру Архангела', act: () => {
      if (p.grottoDay && day - p.grottoDay < 7) return '«Архангел слышит и с первого раза».';
      p.grottoDay = day;
      passTime(60);
      addPiety(3, 'Молитва в пещере Архангела Михаила.');
      if (p.patron === 'michael') addFavor(3);
      return 'Сырые ступени, холод, свечи в нишах. В глубине — каменный алтарь, где, говорят, остался след ноги Архангела. Ты молишься, и страх уходит.';
    } }); break;
    case 'refuge': opts.push({ label: 'Попросить заступничества аббата', act: () => {
      if (!(p.heresy > 0)) return '«Тебе не от кого прятаться, сын мой. И хорошо».';
      if (p.refugeDay && day - p.refugeDay < 30) return '«Я уже писал за тебя. Дважды за месяц не пишут даже императору».';
      p.refugeDay = day;
      p.heresy = Math.max(0, p.heresy - 5);
      return '«Фарфа — аббатство империи. Я напишу, что ты под нашей защитой, — и доминиканцы поостерегутся». Аббат запечатывает письмо.';
    } }); break;
    case 'hospice': opts.push({ label: 'Попроситься на ночлег для путников', act: () => {
      if (p.fatigue < 30 && !isNight()) return '«Ночлег — для усталых. Отдохни, когда устанешь, брат».';
      if (p.mount) p.mount.stabled = day;
      sleepUntilMorning();
      p.food = Math.max(p.food, 60);
      return 'Тебе дают место в странноприимном доме, миску похлёбки и одеяло. Ветер воет над скалой, а внутри тепло. Платы не берут.';
    } }); break;
  }
  return opts;
}
