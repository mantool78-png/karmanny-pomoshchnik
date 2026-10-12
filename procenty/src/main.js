import { World, cellPos } from './world.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const rect = (r0, r1, c0, c1) => {
  const out = [];
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) out.push(r * 10 + c);
  return out;
};

const PERCENT_SIGN = [0, 1, 10, 11, 9, 18, 27, 36, 45, 54, 63, 72, 81, 90, 88, 89, 98, 99];
const SHAPES = {
  full: range(0, 100),
  half: range(0, 50),
  quarter: rect(0, 5, 0, 5),
  tenth: range(0, 10),
  one: [0],
  m35: range(0, 35),
  m90: range(0, 90),
};

const VIEWS = {
  hero: { px: 6, py: 20, pz: 19, tx: 0, ty: -1.6, tz: 0.6, side: 'far', msy: -0.23 },
  top: { px: 0.01, py: 25, pz: 12.5, tx: 0.4, ty: -0.4, tz: 0.8, side: 'right' },
  corner: { px: -7, py: 13, pz: 9, tx: -2, ty: 0.3, tz: -3.2, side: 'right' },
  play: { px: 9, py: 18, pz: 15, tx: 0, ty: 0, tz: 0.3, side: 'right' },
  ch2: { px: -11, py: 19, pz: 16, tx: 0, ty: -0.2, tz: 0.3, side: 'left' },
  bonus: { px: 11, py: 19, pz: 16, tx: 0, ty: -0.2, tz: 0.3, side: 'right' },
  bonusTop: { px: 8, py: 27, pz: 14, tx: 0, ty: -0.2, tz: 0.6, side: 'right', msy: 0.22 },
  shopTop: { px: -8, py: 27, pz: 14, tx: 0, ty: 0.2, tz: 0.6, side: 'left', msy: 0.22 },
  outro: { px: 0.01, py: 8, pz: 27, tx: 0, ty: -1, tz: 0, side: 'center', msy: -0.3 },
};

const isWide = () => window.innerWidth > 860;
function viewFor(name) {
  const { side, msy = 0.17, ...v } = VIEWS[name];
  const sx = isWide() ? { far: 0.27, right: 0.2, left: -0.2, center: 0 }[side] : 0;
  const sy = isWide() ? (side === 'center' ? -0.32 : 0) : msy;
  return { ...v, sx, sy };
}

const lbl = (x, z, text, extra = {}) => ({ x, y: 1.9, z, text, ...extra });
function pieceLabel(cells, text, extra = {}) {
  const ps = cells.map(cellPos);
  const x = ps.reduce((a, p) => a + p.x, 0) / ps.length;
  const z = ps.reduce((a, p) => a + p.z, 0) / ps.length;
  return { ...lbl(x, z, text, extra), y: cells.some((i) => i >= 100) ? 2.9 : 1.9 };
}
const rows = (r0, r1) => range(r0 * 10, r1 * 10);
const rowLabel = (r, x, text, extra) => lbl(x, r - 4.5, text, extra);

const world = new World($('#world'), $('#labels'), { reduceMotion });
let current = null;

/* ---------- battery ---------- */
const battery = { v: 100 };
function renderBattery() {
  const v = Math.round(battery.v);
  $$('.battery').forEach((b) => {
    b.style.setProperty('--b', battery.v / 100);
    b.classList.toggle('low', v <= 20);
  });
  $$('.pb-pct').forEach((el) => (el.textContent = `${v} %`));
}
function setBattery(v) {
  gsap.to(battery, { v, duration: reduceMotion ? 0 : 1.2, ease: 'power2.inOut', onUpdate: renderBattery, overwrite: true });
}
renderBattery();

/* ---------- play (песочница) ---------- */
const slider = $('#pSlider');
let playSet = range(0, Number(slider.value));

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function fractionText(p) {
  if (p === 0) return '0/100 = 0';
  if (p === 100) return '100/100 = 1';
  const g = gcd(p, 100);
  return g > 1 ? `${p}/100 = ${p / g}/${100 / g}` : `${p}/100`;
}
const decimalText = (p) => String(p / 100).replace('.', ',');
const num = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

const QUESTS = [
  { target: 42, text: 'Поставь ровно 42 %.' },
  { target: 5, text: 'Поставь на острове 5 %.' },
  { target: 75, text: 'Закрой три четверти площадки. Сколько получилось процентов?' },
  { target: 100, text: 'Заполни всю площадку.' },
  { target: 0, text: 'А теперь убери всё. Сколько процентов осталось?' },
];
let questIdx = 0;
let questDone = false;

function renderQuest() {
  const q = QUESTS[questIdx];
  $('#questStep').textContent = `${questIdx + 1} из ${QUESTS.length}`;
  $('#questText').textContent = q ? q.text : '';
  $('#questNext').hidden = true;
  $('#quest').classList.remove('done');
  questDone = false;
}

function checkQuest(n) {
  const q = QUESTS[questIdx];
  if (!q || questDone || n !== q.target) return;
  questDone = true;
  $('#quest').classList.add('done');
  const last = questIdx === QUESTS.length - 1;
  $('#questText').textContent = last
    ? 'Все задания пройдены. Это 5 из 5, то есть 100 %!'
    : `Есть! ${n} ${plural(n, 'блок', 'блока', 'блоков')} из 100 — это ${n} %.`;
  $('#questNext').hidden = last;
  world.bump();
  gsap.fromTo('#quest', { scale: 1 }, { scale: 1.04, duration: 0.15, yoyo: true, repeat: 1 });
}

$('#questNext').addEventListener('click', () => {
  questIdx = Math.min(questIdx + 1, QUESTS.length - 1);
  renderQuest();
});

function renderPlay(n) {
  const big = $('#pv');
  if (big.textContent !== String(n)) {
    big.textContent = n;
    gsap.fromTo(big, { y: -6 }, { y: 0, duration: 0.25, ease: 'back.out(3)' });
  }
  $('#pBlocks').textContent = `${n} ${plural(n, 'блок', 'блока', 'блоков')} из 100`;
  $('#pFrac').textContent = fractionText(n);
  $('#pDec').textContent = decimalText(n);
  slider.value = n;
  slider.style.setProperty('--p', `${n}%`);
  checkQuest(n);
}

function setPlayCount(n) {
  n = Math.max(0, Math.min(100, n));
  playSet = range(0, n);
  if (current === 'play') world.setGold(playSet, { maxTotal: 0.3 });
  renderPlay(n);
}

slider.addEventListener('input', () => setPlayCount(Number(slider.value)));
$$('[data-delta]').forEach((b) => b.addEventListener('click', () => setPlayCount(playSet.length + Number(b.dataset.delta))));

world.onCellClick = (i) => {
  if (current !== 'play') return;
  playSet = playSet.includes(i) ? playSet.filter((x) => x !== i) : [...playSet, i];
  world.setGold(playSet);
  renderPlay(playSet.length);
};

renderQuest();
renderPlay(playSet.length);

/* ---------- quiz ---------- */
const QUIZ = [
  { q: 'Заряд телефона — 50 %. Какая часть батареи осталась?', opts: ['пятая часть', 'половина', 'пятьдесят батарей'], a: 1, shape: 'half', why: '50 % — это 50 из 100, то есть ровно половина.' },
  { q: 'Скин стоит 400 монет. Сколько монет — это 25 %?', opts: ['25', '100', '40'], a: 1, shape: 'quarter', why: '25 % — это четверть. 400 : 4 = 100 монет.' },
  { q: '10 % от 70 подписчиков — это сколько человек?', opts: ['7', '10', '60'], a: 0, shape: 'tenth', why: '10 % — делим на 10. 70 : 10 = 7 человек.' },
  { q: '35 % от 200 монет — это сколько?', opts: ['35', '70', '135'], a: 1, shape: 'm35', why: '35 % = 10 % + 10 % + 10 % + 5 %. Это 20 + 20 + 20 + 10 = 70 монет.' },
  { q: 'Как проще всего найти 90 % от 70 монет?', opts: ['70 − 7 = 63', '70 : 90', '90 − 70 = 20'], a: 0, shape: 'm90', why: '90 % = 100 % − 10 %. 10 % от 70 — это 7, значит 70 − 7 = 63.' },
];
const BOSS = [
  { q: 'Скин стоит 300 монет, скидка 10 %. Сколько он стоит со скидкой?', opts: ['290', '270', '30'], a: 1, shape: range(0, 90), why: '10 % от 300 = 30. Платишь 300 − 30 = 270 монет.' },
  { q: 'Цену 200 монет подняли на 25 %. Какая цена теперь?', opts: ['225', '250', '50'], a: 1, shape: range(0, 125), why: '25 % от 200 — это четверть, 50 монет. 200 + 50 = 250.' },
  { q: 'В тесте 20 вопросов, верно — 15. Сколько это процентов?', opts: ['15 %', '75 %', '5 %'], a: 1, shape: range(0, 75), why: 'Один вопрос = 100 : 20 = 5 %. 15 × 5 % = 75 %.' },
  { q: 'Из 4 сундуков ты открыл 1. Это сколько процентов?', opts: ['25 %', '4 %', '1 %'], a: 0, shape: rect(0, 5, 0, 5), why: '1 : 4 × 100 = 25 %. Это четверть.' },
  { q: 'Цену 100 монет подняли на 10 %, а потом снизили на 10 %. Сколько теперь?', opts: ['100', '99', '110'], a: 1, shape: range(0, 99), why: '+10 % → 110. А −10 % считаем уже от 110: это 11. 110 − 11 = 99.' },
];

function makeQuiz(name, items) {
  const card = $(`[data-quiz="${name}"]`);
  const box = $('.q-body', card);
  const stepEl = $('.q-step', card);
  const quiz = { shape: [] };
  let idx = 0;
  let score = 0;
  const show = (shape) => {
    quiz.shape = shape;
    if (current === name) world.setGold(shape);
  };

  function render() {
    const item = items[idx];
    stepEl.textContent = `Вопрос ${idx + 1} из ${items.length}`;
    box.innerHTML = '';
    const q = document.createElement('p');
    q.className = 'quiz-q';
    q.textContent = item.q;
    const opts = document.createElement('div');
    opts.className = 'quiz-opts';
    item.opts.forEach((text, k) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', () => answer(k, b));
      opts.appendChild(b);
    });
    const why = document.createElement('p');
    why.className = 'quiz-why';
    const next = document.createElement('button');
    next.className = 'pxbtn wide';
    next.type = 'button';
    next.textContent = idx === items.length - 1 ? 'Узнать результат' : 'Дальше';
    next.hidden = true;
    next.addEventListener('click', () => {
      idx++;
      if (idx < items.length) render();
      else result();
    });
    box.append(q, opts, why, next);
    gsap.from(box.children, { y: 16, opacity: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out' });
  }

  function answer(k, btn) {
    const item = items[idx];
    const all = $$('.opt', box);
    if (all.some((b) => b.disabled)) return;
    all.forEach((b) => (b.disabled = true));
    const ok = k === item.a;
    all[item.a].classList.add('right');
    if (ok) {
      score++;
      world.bump();
    } else {
      btn.classList.add('wrong');
      gsap.fromTo(btn, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
    }
    const why = $('.quiz-why', box);
    why.textContent = (ok ? 'Верно! ' : 'Не совсем. ') + item.why;
    gsap.fromTo(why, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35 });
    $('.pxbtn.wide', box).hidden = false;
    show(Array.isArray(item.shape) ? item.shape : SHAPES[item.shape]);
  }

  function result() {
    const pct = Math.round((score / items.length) * 100);
    let comment = 'Пока 0 %. Пролистай уровень ещё раз и попробуй снова.';
    if (pct === 100) comment = 'Вся площадка золотая. Ты узнаёшь проценты в лицо!';
    else if (pct >= 80) comment = 'Почти вся площадка! Отличный результат.';
    else if (pct >= 60) comment = 'Больше половины. Ещё немного, и будет 100 %.';
    else if (pct > 0) comment = 'Пролистай уровень ещё раз, и получится лучше.';
    stepEl.textContent = 'Результат';
    box.innerHTML = `
      <p class="quiz-score"><span class="pix">${pct} %</span></p>
      <p class="quiz-q">Ты ответил верно на ${score} из ${items.length}. ${score} из ${items.length} — это ${pct} %.</p>
      <p class="quiz-why">${comment}</p>
      <button class="pxbtn wide" type="button">Пройти ещё раз</button>`;
    $('.pxbtn', box).addEventListener('click', () => {
      idx = 0;
      score = 0;
      show([]);
      render();
    });
    show(range(0, pct));
    gsap.from($('.quiz-score', box), { scale: 0.4, opacity: 0, duration: 0.7, ease: 'back.out(2.5)' });
  }

  render();
  return quiz;
}

const quiz1 = makeQuiz('quiz', QUIZ);
const quizBoss = makeQuiz('boss', BOSS);

/* ---------- задания в песочницах ---------- */
function makeQuests(name, list) {
  const box = $(`[data-quest="${name}"]`);
  const q = { idx: 0, done: false };
  q.current = () => list[q.idx];
  q.render = () => {
    $('.q-step', box).textContent = `${q.idx + 1} из ${list.length}`;
    $('.q-text', box).textContent = list[q.idx].text;
    $('.q-next', box).hidden = true;
    box.classList.remove('done');
    q.done = false;
  };
  q.win = (msg) => {
    if (q.done) return;
    q.done = true;
    const last = q.idx === list.length - 1;
    box.classList.add('done');
    const n = list.length;
    $('.q-text', box).textContent = last ? `${msg} Все ${n} ${plural(n, 'задание', 'задания', 'заданий')} пройдены!` : msg;
    $('.q-next', box).hidden = last;
    world.bump();
    gsap.fromTo(box, { scale: 1 }, { scale: 1.04, duration: 0.15, yoyo: true, repeat: 1 });
  };
  $('.q-next', box).addEventListener('click', () => {
    q.idx = Math.min(q.idx + 1, list.length - 1);
    q.render();
    if (q.onNext) q.onNext();
  });
  q.render();
  return q;
}

/* ---------- ценник ---------- */
const plSlider = $('#plSlider');
const PL_BASE = 200;
const plQuests = makeQuests('pricelab', [
  { text: 'Сделай скидку, чтобы меч стоил 150 монет.', v: -25 },
  { text: 'Подними цену до 260 монет.', v: 30 },
  { text: 'Сдвинь ползунок так, чтобы меч стоил 180 монет.', v: -10 },
  { text: 'Сделай цену ровно в два раза меньше.', v: -50 },
]);
let plValue = 0;
const plCells = () => range(0, 100 + plValue);

function renderPricelab() {
  const v = plValue;
  const delta = (PL_BASE * Math.abs(v)) / 100;
  const price = PL_BASE + Math.sign(v) * delta;
  const badge = $('#plBadge');
  badge.textContent = v === 0 ? '0 %' : `${v > 0 ? '+' : '-'}${Math.abs(v)} %`;
  badge.classList.toggle('up', v > 0);
  badge.classList.toggle('off', v === 0);
  $('#plPrice').innerHTML = v === 0 ? String(PL_BASE) : `<s>${PL_BASE}</s> ${price}`;
  $('#plLine').innerHTML = v === 0
    ? 'Цена без изменений: <b>100 % = 200 монет</b>. Один блок — 2 монеты.'
    : v < 0
      ? `Скидка ${-v}&nbsp;% от&nbsp;200 = <b>${delta}</b>. Цена: 200 − ${delta} = <b>${price}&nbsp;монет</b>`
      : `Наценка ${v}&nbsp;% от&nbsp;200 = <b>${delta}</b>. Цена: 200 + ${delta} = <b>${price}&nbsp;монет</b>`;
  plSlider.value = v;
  plSlider.style.setProperty('--p', `${((v + 50) / 100) * 100}%`);
  if (plQuests.current().v === v) plQuests.win(`Есть! ${v < 0 ? 'Скидка' : 'Наценка'} ${Math.abs(v)} % — и цена ${price} монет.`);
}

function setPricelab(v) {
  plValue = Math.max(-50, Math.min(50, v));
  if (current === 'pricelab') world.setGold(plCells(), { maxTotal: 0.3 });
  renderPricelab();
}
plSlider.addEventListener('input', () => setPricelab(Number(plSlider.value)));
$$('[data-pl]').forEach((b) => b.addEventListener('click', () => setPricelab(plValue + Number(b.dataset.pl))));
renderPricelab();

/* ---------- процентомер ---------- */
function groupsFor(total) {
  const size = 100 / total;
  const out = [];
  if (total === 4) return [rect(0, 5, 0, 5), rect(0, 5, 5, 10), rect(5, 10, 0, 5), rect(5, 10, 5, 10)];
  if (total === 25) {
    for (let r = 0; r < 10; r += 2) for (let c = 0; c < 10; c += 2) out.push(rect(r, r + 2, c, c + 2));
    return out;
  }
  for (let k = 0; k < total; k++) out.push(range(k * size, (k + 1) * size));
  return out;
}
const checker = (groups) => {
  const cols = { 4: 2, 20: 2, 25: 5, 50: 5 }[groups.length] || 1;
  return groups.filter((_, k) => (Math.floor(k / cols) + (k % cols)) % 2 === 1).flat();
};

const fd = { total: 10, part: 0 };
const fdQuests = makeQuests('finder', [
  { text: 'Из 2 жизней осталась 1. Нажми «2» сверху и поставь «1» снизу.', total: 2, part: 1 },
  { text: 'Ты открыл 3 сундука из 4. Сколько процентов?', total: 4, part: 3 },
  { text: 'Из 5 звёзд уровня собрано 2. Сколько процентов?', total: 5, part: 2 },
  { text: 'Собрано 15 кристаллов из 25. Сколько процентов?', total: 25, part: 15 },
  { text: 'Из 50 подписчиков лайк поставил 1. Сколько процентов?', total: 50, part: 1 },
]);
const fdCells = () => groupsFor(fd.total).slice(0, fd.part).flat();

function renderFinder() {
  const { total: t, part: p } = fd;
  const size = 100 / t;
  const pct = p * size;
  $$('[data-total]').forEach((b) => b.classList.toggle('sel', Number(b.dataset.total) === t));
  $('#fdPart').textContent = p;
  $('#fdFormula').textContent = `Всего ${t} → режем остров на ${t} ${plural(t, 'кусок', 'куска', 'кусков')}. В одном куске 100 : ${t} = ${size} ${plural(size, 'блок', 'блока', 'блоков')}.`;
  $('#fdResult').innerHTML = `${p} ${plural(p, 'кусок', 'куска', 'кусков')} × ${size} = ${pct} ${plural(pct, 'блок', 'блока', 'блоков')} = <b>${pct}&nbsp;%</b>`;
  const q = fdQuests.current();
  if (q.total === fd.total && q.part === fd.part) fdQuests.win(`Верно! ${fd.part} из ${fd.total} — это ${num(pct)} %.`);
}

function finderWorld(regrid) {
  if (current !== 'finder') return;
  world.setGold(fdCells(), { maxTotal: 0.35 });
  if (regrid) {
    world.clearGlow();
    world.glowCells(checker(groupsFor(fd.total)), 0.3);
  }
}
$$('[data-total]').forEach((b) => b.addEventListener('click', () => {
  fd.total = Number(b.dataset.total);
  fd.part = Math.min(fd.part, fd.total);
  finderWorld(true);
  renderFinder();
}));
$$('[data-part]').forEach((b) => b.addEventListener('click', () => {
  fd.part = Math.max(0, Math.min(fd.total, fd.part + Number(b.dataset.part)));
  finderWorld(false);
  renderFinder();
}));
renderFinder();

/* ---------- ловушка: голосование ---------- */
$$('[data-vote]').forEach((b) => b.addEventListener('click', () => {
  const all = $$('[data-vote]');
  if (all.some((x) => x.disabled)) return;
  all.forEach((x) => (x.disabled = true));
  b.classList.add(b.dataset.vote === '1' ? 'right' : 'picked');
  $('#voteWhy').textContent = b.dataset.vote === '1'
    ? 'Смелая догадка! Листай дальше: проверим блоками, сколько именно.'
    : 'Так думает почти каждый. Листай дальше: проверим блоками!';
  gsap.fromTo('#voteWhy', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35 });
}));

/* ---------- хитрый магазин ---------- */
const tg = { ops: [] };
const tgQuests = makeQuests('trapgame', [
  { text: 'Сделай так, чтобы цена стала 99 монет.', target: 99 },
  { text: 'Получи цену 75 монет.', target: 75 },
  { text: 'Найди два изменения, после которых цена 108.', target: 108 },
  { text: 'Сделай 96. А потом попробуй в обратном порядке!', target: 96 },
]);
const tgPrices = () => tg.ops.reduce((list, op) => [...list, (list[list.length - 1] * (100 + op)) / 100], [100]);
const tgCells = () => {
  const p = Math.round(tgPrices().slice(-1)[0]);
  return range(0, Math.min(200, p));
};
const opText = (op) => `${op > 0 ? '+' : '-'}${Math.abs(op)} %`;

function renderTrapgame() {
  const prices = tgPrices();
  const chain = $('#tgChain');
  let html = `<span class="tg-price pix">100</span>`;
  tg.ops.forEach((op, k) => {
    const from = prices[k];
    const diff = (from * Math.abs(op)) / 100;
    html += `<span class="tg-op ${op > 0 ? 'up' : ''}"><span class="pix">${opText(op)}</span><small>${Math.abs(op)}&nbsp;% от&nbsp;${num(from)} = ${num(diff)}</small></span><span class="tg-price pix">${num(prices[k + 1])}</span>`;
  });
  if (tg.ops.length < 2) html += `<span class="tg-slot pix">?</span>`;
  chain.innerHTML = html;
  $$('[data-op]').forEach((b) => (b.disabled = tg.ops.length >= 2));
  const q = tgQuests.current();
  const end = prices[prices.length - 1];
  if (tg.ops.length === 2 && end === q.target) {
    const msg = q.target === 96
      ? 'Есть 96! Порядок не важен: +20 % и −20 % в любом порядке дают 96.'
      : `Есть! ${opText(tg.ops[0])}, потом ${opText(tg.ops[1])} — и цена ${q.target}.`;
    tgQuests.win(msg);
  }
}

function setTrap(ops) {
  tg.ops = ops;
  if (current === 'trapgame') world.setGold(tgCells(), { maxTotal: 0.35 });
  renderTrapgame();
}
$$('[data-op]').forEach((b) => b.addEventListener('click', () => {
  if (tg.ops.length < 2) setTrap([...tg.ops, Number(b.dataset.op)]);
}));
$('#tgReset').addEventListener('click', () => setTrap([]));
tgQuests.onNext = () => setTrap([]);
renderTrapgame();

/* ---------- иконка меча ---------- */
(function buildSword() {
  const px = new Map();
  const set = (x, y, c) => x >= 0 && x < 16 && y >= 0 && y < 16 && px.set(`${x},${y}`, c);
  for (let y = 1; y <= 9; y++) {
    set(14 - y, y, '#1b1206');
    set(15 - y, y, '#bfe3ff');
    set(16 - y, y, '#ffffff');
    set(17 - y, y, '#1b1206');
  }
  set(14, 0, '#1b1206'); set(15, 0, '#1b1206'); set(15, 1, '#ffffff');
  for (let t = -3; t <= 3; t++) { set(6 + t, 9 + t, '#ffc93c'); set(5 + t, 9 + t, '#c98a12'); }
  [[4, 11], [3, 12], [2, 13]].forEach(([x, y]) => { set(x, y, '#7a4e10'); set(x + 1, y, '#4a2e08'); });
  set(1, 14, '#ffc93c'); set(2, 14, '#c98a12'); set(1, 13, '#ffe9a0'); set(0, 15, '#7a4e10');
  $('#i-sword').innerHTML = [...px].map(([k, c]) => {
    const [x, y] = k.split(',');
    return `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`;
  }).join('');
})();

/* ---------- craft (мастерская) ---------- */
const CRAFT = [
  { p: 75, of: 80, text: 'Скидка 75 % на скин за 80 монет. Собери 75 % из кусочков и узнай, сколько сэкономишь.' },
  { p: 35, of: 200, text: 'Собери 35 % от 200 монет.' },
  { p: 60, of: 50, text: 'Собери 60 % от 50 монет. Хватит двух кусочков!' },
  { p: 12, of: 300, text: 'Собери 12 % от 300 монет. Тут пригодится 1 %.' },
];
let craftIdx = 0;
let craftParts = [];
let craftDone = false;
const craftSum = () => craftParts.reduce((a, b) => a + b, 0);
const craftCells = () => range(0, Math.min(100, craftSum()));

function craftLabels(delay = 0) {
  const out = [];
  let start = 0;
  for (let k = 0; k < craftParts.length; k++) {
    const p = craftParts[k];
    let n = 1;
    while (p < 5 && craftParts[k + n] === p) n++;
    const size = p * n;
    const cells = range(start, Math.min(100, start + size));
    const label = cells.length && pieceLabel(cells, `${k ? '+' : ''}${p} %${n > 1 ? ` ×${n}` : ''}`, { delay, cls: p < 5 ? 'small' : '' });
    if (label && cells.length >= 10 && cells.length <= 30) label.x = ((out.length % 3) - 1) * 3;
    if (label) out.push(label);
    start += size;
    k += n - 1;
  }
  return out;
}

function renderCraft() {
  const task = CRAFT[craftIdx];
  const sum = craftSum();
  const coins = craftParts.map((p) => (task.of * p) / 100);
  const total = (task.of * sum) / 100;
  const unit = (n) => (Number.isInteger(n) ? plural(n, 'монета', 'монеты', 'монет') : 'монеты');
  $('#craftStep').textContent = `${craftIdx + 1} из ${CRAFT.length}`;
  $('#craftTask').textContent = task.text;
  $('#craftGoal').textContent = `${task.p} %`;
  $('#craftPct').textContent = `${sum} %`;

  const formula = $('#craftFormula');
  const coinLine = $('#craftCoins');
  const lines = $('.craft-lines');
  lines.classList.toggle('over', sum > task.p);
  if (!craftParts.length) {
    formula.textContent = 'Нажимай на кусочки внизу.';
    coinLine.textContent = `1 % от ${task.of} — это ${num(task.of / 100)}, а 10 % — это ${num(task.of / 10)}.`;
  } else {
    const nb = '\u00a0';
    formula.textContent = craftParts.length > 1 ? `${craftParts.map((p) => `${p}${nb}%`).join(' + ')} =${nb}${sum}${nb}%` : `${sum}${nb}%`;
    const sumText = craftParts.length > 1 ? `${coins.map(num).join(' + ')} =${nb}${num(total)}` : num(total);
    if (sum > task.p) coinLine.textContent = `Перебор! Нужно ${task.p}${nb}%, а собрано ${sum}${nb}%. Нажми «Убрать».`;
    else if (sum === task.p) coinLine.textContent = `Готово! ${task.p}${nb}% от ${task.of} = ${sumText}${nb}${unit(total)}`;
    else coinLine.textContent = `${sumText}${nb}${unit(total)}`;
  }

  craftDone = sum === task.p;
  $('#craft').classList.toggle('done', craftDone);
  $$('[data-piece]').forEach((b) => (b.disabled = craftDone || sum + Number(b.dataset.piece) > 100));
  $('#craftUndo').disabled = !craftParts.length;
  const last = craftIdx === CRAFT.length - 1;
  $('#craftNext').hidden = !craftDone;
  $('#craftNext').textContent = last ? 'Собрать заново' : 'Следующее задание';
  if (craftDone && last) coinLine.textContent += '. Все 4 задания из 4 — это 100 %!';
}

function updateCraftWorld(relabel) {
  if (current !== 'craft') return;
  world.setGold(craftCells(), { maxTotal: 0.4 });
  if (relabel) world.setLabels(craftLabels());
  else world.addLabels(craftLabels(0.2).slice(-1));
}

$$('[data-piece]').forEach((b) => b.addEventListener('click', () => {
  const p = Number(b.dataset.piece);
  const prev = craftParts[craftParts.length - 1];
  craftParts.push(p);
  updateCraftWorld(p < 5 && prev === p);
  renderCraft();
  if (craftDone) {
    world.bump();
    gsap.fromTo('#craft .craft-lines', { scale: 1 }, { scale: 1.04, duration: 0.15, yoyo: true, repeat: 1 });
  }
}));
$('#craftUndo').addEventListener('click', () => {
  craftParts.pop();
  updateCraftWorld(true);
  renderCraft();
});
$('#craftNext').addEventListener('click', () => {
  craftIdx = (craftIdx + 1) % CRAFT.length;
  craftParts = [];
  updateCraftWorld(true);
  renderCraft();
});
renderCraft();

/* ---------- пошаговая сборка ---------- */
let seqTimers = [];
let seqRan = null;
const stepCard = (name) => $(`main .step[data-state="${name}"]:not(.chapter-title) .card`);

function stopSeq() {
  seqTimers.forEach((t) => t.kill());
  seqTimers = [];
}

function runSeq(name) {
  const s = STATES[name];
  stopSeq();
  seqRan = name;
  const lines = $$('.calc li', stepCard(name));
  lines.forEach((l) => l.classList.remove('on'));
  world.clearGlow();
  world.setGold(s.gold());
  world.setLabels([]);
  if (s.reset) s.reset();
  s.seq.forEach((it, k) => {
    seqTimers.push(gsap.delayedCall(0.4 + k * 1.35, () => {
      if (it.gold) world.setGold(it.gold, { maxTotal: 0.45 });
      if (it.setLabels) world.setLabels(it.setLabels);
      if (it.labels) world.addLabels(it.labels.map((l) => ({ delay: 0.45, ...l })));
      if (it.glow) world.glowCells(it.glow);
      if (it.do) it.do();
      if (it.line != null && lines[it.line]) lines[it.line].classList.add('on');
      if (it.bump) seqTimers.push(gsap.delayedCall(0.5, () => world.bump()));
    }));
  });
}

function maybeRunSeq() {
  if (!current || seqRan === current || !STATES[current].seq) return;
  const r = stepCard(current).getBoundingClientRect();
  if (r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15) runSeq(current);
}

$$('.replay').forEach((b) => b.addEventListener('click', () => {
  const name = b.closest('.step').dataset.state;
  if (name === current) runSeq(name);
}));

const loadState = { v: 0 };
function loadTo(v, instant) {
  const el = $('#loadbar');
  gsap.to(loadState, {
    v, duration: instant || reduceMotion ? 0 : 1.1, ease: 'power1.inOut', overwrite: true,
    onUpdate: () => {
      el.style.setProperty('--v', loadState.v / 100);
      $('span', el).textContent = `${Math.round(loadState.v)} %`;
    },
  });
}

const ghost = (cells, text) => ({ ...pieceLabel(cells, text, { cls: 'ghost', delay: 0.3 }), y: 0.9 });
const G4 = groupsFor(4);
const G5 = groupsFor(5);
const G20 = groupsFor(20);
const setChests = (n) => $$('#chests i').forEach((c, k) => c.classList.toggle('open', k < n));

const B75_HALF = range(0, 50);
const B75_QUARTER = rect(5, 10, 0, 5);
const B35_HALFROW = range(30, 35);

/* ---------- states ---------- */
const rowLabels = range(0, 10).map((r) => ({ x: 5.6, y: 0.6, z: r - 4.5, text: String((r + 1) * 10), cls: 'small', delay: 0.4 + r * 0.24 }));

const STATES = {
  hero: { view: 'hero', gold: () => PERCENT_SIGN },
  count: {
    view: 'top',
    gold: () => [],
    labels: rowLabels,
    enter() {
      const counter = $('#counter');
      counter.textContent = '0';
      world.pulseRows((r) => {
        counter.textContent = String((r + 1) * 10);
        gsap.fromTo(counter, { scale: 1.25 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
      });
    },
  },
  one: { view: 'corner', gold: () => SHAPES.one, labels: [lbl(-4.5, -4.5, '1 %', { delay: 0.6 })] },
  seven: { view: 'corner', gold: () => range(0, 7), labels: [lbl(-1.5, -4.5, '7 %', { delay: 0.8 })] },
  play: { view: 'play', gold: () => playSet, interactive: true },
  full: { view: 'ch2', gold: () => SHAPES.full, battery: 100, labels: [lbl(0, 0, '100 %', { delay: 0.8 })] },
  half: {
    view: 'ch2', gold: () => SHAPES.half, battery: 50,
    labels: [lbl(0, -2.5, '50 %', { delay: 0.6 }), { x: 0, y: 0.9, z: 2.5, text: '50 %', cls: 'ghost', delay: 0.9 }],
  },
  quarter: { view: 'ch2', gold: () => SHAPES.quarter, battery: 25, labels: [lbl(-2.5, -2.5, '25 %', { delay: 0.6 })] },
  tenth: { view: 'ch2', gold: () => SHAPES.tenth, battery: 10, labels: [lbl(0, -4.5, '10 %', { delay: 0.5 })] },
  onepct: { view: 'ch2', gold: () => SHAPES.one, battery: 1, labels: [lbl(-4.5, -4.5, '1 %', { delay: 0.5 })] },
  awk: { view: 'bonus', gold: () => range(0, 37), labels: [pieceLabel(range(0, 37), '37 % = ?', { delay: 0.8 })] },
  b75: {
    view: 'bonus', gold: () => [],
    seq: [
      { gold: B75_HALF, labels: [pieceLabel(B75_HALF, '50 %')], line: 0 },
      { gold: [...B75_HALF, ...B75_QUARTER], labels: [pieceLabel(B75_QUARTER, '+25 %')], line: 1 },
      { line: 2, bump: true },
    ],
  },
  b30: {
    view: 'bonus', gold: () => [],
    seq: [
      { gold: rows(0, 1), labels: [rowLabel(0, -3, '10 %')], line: 0 },
      { gold: rows(0, 2), labels: [rowLabel(1, 0, '+10 %')], line: 1 },
      { gold: rows(0, 3), labels: [rowLabel(2, 3, '+10 %')], line: 2, bump: true },
    ],
  },
  b35: {
    view: 'bonus', gold: () => [],
    seq: [
      { gold: rows(0, 1), labels: [rowLabel(0, -3, '10 %')], line: 0 },
      { gold: rows(0, 3), labels: [rowLabel(1, 0, '+10 %'), rowLabel(2, 3, '+10 %', { delay: 0.65 })], line: 1 },
      { gold: range(0, 35), labels: [pieceLabel(B35_HALFROW, '+5 %')], line: 2 },
      { line: 3, bump: true },
    ],
  },
  b90: {
    view: 'bonusTop', gold: () => [],
    seq: [
      { gold: SHAPES.full, labels: [lbl(0, 0, '100 %')], line: 0 },
      { gold: SHAPES.m90, glow: rows(9, 10), setLabels: [{ ...pieceLabel(rows(9, 10), '-10 %', { cls: 'ghost', delay: 0.3 }), y: 0.9 }], line: 1 },
      { labels: [pieceLabel(SHAPES.m90, '90 %')], line: 2, bump: true },
    ],
  },
  b37: {
    view: 'bonus', gold: () => [],
    seq: [
      { gold: [0], labels: [lbl(-4.5, -4.5, '1 % = 3')], line: 0 },
      { gold: range(0, 37), setLabels: [lbl(-4.5, -4.5, '1 % = 3', { cls: 'small' }), pieceLabel(range(0, 37), '37 % = 111', { delay: 0.9 })], line: 1, bump: true },
    ],
  },
  craft: { view: 'bonus', gold: craftCells, labels: () => craftLabels(0.4) },
  quiz: { view: 'bonus', gold: () => quiz1.shape },

  shop: { view: 'ch2', gold: () => SHAPES.full, labels: [lbl(0, 0, '400 монет', { delay: 0.8 })] },
  sale: {
    view: 'shopTop', gold: () => [],
    seq: [
      { gold: SHAPES.full, labels: [lbl(0, 0, '400')], line: 0 },
      { gold: range(0, 80), glow: rows(8, 10), setLabels: [ghost(rows(8, 10), '-20 % = 80')], line: 1 },
      { labels: [pieceLabel(range(0, 80), '320')], line: 2, bump: true },
    ],
  },
  markup: {
    view: 'shopTop', gold: () => [],
    seq: [
      { gold: SHAPES.full, labels: [lbl(0, 2, '200')], line: 0 },
      { gold: range(0, 125), labels: [pieceLabel(range(100, 125), '+25 % = 50')], line: 1 },
      { setLabels: [pieceLabel(range(100, 125), '+25 % = 50', { delay: 0 }), lbl(0, 2, '250 = 125 %', { delay: 0.2 })], line: 2, bump: true },
    ],
  },
  pricelab: { view: 'shopTop', gold: plCells, interactive: false },

  load: {
    view: 'bonus', gold: () => [],
    reset: () => loadTo(0, true),
    seq: [
      { gold: range(0, 37), do: () => loadTo(37), labels: [pieceLabel(range(0, 37), '37 блоков')], line: 0 },
      { setLabels: [pieceLabel(range(0, 37), '37 %')], line: 1, bump: true },
    ],
  },
  chests: {
    view: 'bonus', gold: () => [],
    reset: () => setChests(0),
    seq: [
      { glow: checker(G4), labels: G4.map((g) => pieceLabel(g, '25', { cls: 'small' })), line: 0 },
      { gold: G4[0], do: () => setChests(1), setLabels: [pieceLabel(G4[0], '25 %')], line: 1 },
      { gold: G4.slice(0, 3).flat(), do: () => setChests(3), setLabels: [pieceLabel(G4.slice(0, 3).flat(), '75 %')], line: 2, bump: true },
    ],
  },
  test20: {
    view: 'bonus', gold: () => [],
    seq: [
      { glow: checker(G20), labels: [pieceLabel(G20[0], '5', { cls: 'small' })], line: 0 },
      { gold: G20.slice(0, 17).flat(), setLabels: [lbl(0, -0.5, '85 блоков', { delay: 0.9 })], line: 1 },
      { setLabels: [lbl(0, -0.5, '85 %')], line: 2, bump: true },
    ],
  },
  recipe: {
    view: 'bonus', gold: () => [],
    seq: [
      { glow: checker(G5), line: 0 },
      { labels: G5.map((g) => pieceLabel(g, '20', { cls: 'small' })), line: 1 },
      { gold: G5.slice(0, 3).flat(), setLabels: [pieceLabel(G5.slice(0, 3).flat(), '60 %', { delay: 0.8 })], line: 2, bump: true },
    ],
  },
  finder: {
    view: 'bonus', gold: fdCells,
    enter: () => world.glowCells(checker(groupsFor(fd.total)), 0.3),
  },

  trapq: { view: 'ch2', gold: () => SHAPES.full, labels: [lbl(0, 0, '100 монет', { delay: 0.8 })] },
  trapup: {
    view: 'shopTop', gold: () => [],
    seq: [
      { gold: SHAPES.full, labels: [lbl(0, 1, '100')], line: 0 },
      { gold: range(0, 120), labels: [pieceLabel(range(100, 120), '+20')], line: 1 },
      { labels: [lbl(0, 3, '120')], line: 2, bump: true },
    ],
  },
  trapdown: {
    view: 'shopTop', gold: () => [],
    seq: [
      { gold: range(0, 120), labels: [lbl(0, 1, '120 = 100 %')], line: 0 },
      { gold: range(0, 96), glow: range(96, 100), setLabels: [ghost(range(96, 100), '-24')], line: 1 },
      { labels: [lbl(0, 0, '96')], line: 2, bump: true },
    ],
  },
  trapwhy: {
    view: 'shopTop', gold: () => [],
    seq: [
      { gold: SHAPES.full, labels: [lbl(0, 0, '100')] },
      { gold: range(0, 50), glow: rows(5, 10), setLabels: [ghost(rows(5, 10), '-50')], line: 0 },
      { gold: range(0, 75), labels: [pieceLabel(range(50, 75), '+25')], line: 1 },
      { setLabels: [pieceLabel(range(0, 75), '75')], line: 2, bump: true },
    ],
  },
  trapgame: { view: 'shopTop', gold: tgCells },
  boss: { view: 'ch2', gold: () => quizBoss.shape },
  outro: { view: 'outro', gold: () => PERCENT_SIGN },
};

function setState(name) {
  if (name === current || !STATES[name]) return;
  current = name;
  const s = STATES[name];
  document.body.dataset.state = name;
  stopSeq();
  seqRan = null;
  world.clearGlow();
  world.setView(viewFor(s.view));
  world.setGold(s.gold());
  world.setLabels((typeof s.labels === 'function' ? s.labels() : s.labels) || []);
  world.interactive = !!s.interactive;
  world.sway = s.interactive ? 0.25 : 1;
  if (!s.interactive) world.canvas.style.cursor = 'grab';
  if (s.battery != null) setBattery(s.battery);
  if (s.enter) s.enter();
  if (s.seq) $$('.calc li', stepCard(name)).forEach((l) => l.classList.remove('on'));
  maybeRunSeq();
}

window.addEventListener('resize', () => {
  if (current) world.setView(viewFor(STATES[current].view), 0.6);
});

/* ---------- letters ---------- */
function splitLetters(el) {
  const text = el.textContent;
  el.textContent = '';
  el.setAttribute('aria-label', text);
  const chars = [];
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) {
      el.appendChild(document.createTextNode(' '));
      return;
    }
    const word = document.createElement('span');
    word.className = 'word';
    word.setAttribute('aria-hidden', 'true');
    [...part].forEach((ch) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      word.appendChild(s);
      chars.push(s);
    });
    el.appendChild(word);
  });
  return chars;
}

/* ---------- boot ---------- */
function boot() {
  const heroChars = splitLetters($('.hero h1'));
  setState('hero');
  world.intro();

  if (!reduceMotion) {
    const tl = gsap.timeline({ delay: 0.3 });
    tl.from(heroChars, { y: -160, opacity: 0, rotation: () => gsap.utils.random(-25, 25), duration: 1.1, ease: 'bounce.out', stagger: 0.06 })
      .from('.hero .reveal', { y: 24, opacity: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' }, '-=0.6')
      .from('.topbar', { y: -40, opacity: 0, duration: 0.6, ease: 'power3.out' }, '-=0.6');

    $$('.chapter-title h2').forEach((h) => {
      const chars = splitLetters(h);
      gsap.from(chars, {
        scrollTrigger: { trigger: h, start: 'top 85%' },
        y: -90, opacity: 0, rotation: () => gsap.utils.random(-20, 20), duration: 0.9, ease: 'bounce.out', stagger: 0.03,
      });
    });

    $$('.card').forEach((card) => {
      gsap.from(card.querySelectorAll('.reveal'), {
        scrollTrigger: { trigger: card, start: 'top 82%' },
        y: 28, opacity: 0, duration: 0.7, stagger: 0.09, ease: 'power3.out',
      });
    });
  }

  $$('[data-state]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: el.classList.contains('hero') ? 'top top' : 'top 62%',
      end: 'bottom 38%',
      onToggle: (self) => self.isActive && setState(el.dataset.state),
    });
  });

  const at = new URLSearchParams(window.location.search).get('at');
  const target = at && ($(`main .step[data-state="${at}"]:not(.chapter-title)`) || $(`main [data-state="${at}"]`));
  if (target) window.scrollTo(0, target.offsetTop + target.offsetHeight / 2 - window.innerHeight / 2);

  const xpFill = $('.xp-bar i');
  const xpPct = $('.xp-pct');
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const p = Math.round(self.progress * 100);
      xpFill.style.width = `${p}%`;
      xpPct.textContent = `${p} %`;
      maybeRunSeq();
    },
  });
}

if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
else boot();
