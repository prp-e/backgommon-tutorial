'use strict';

const $ = id => document.getElementById(id);
const fa = number => number.toLocaleString('fa-IR');
const colors = ['روشن', 'تیره'];
const names = ['شما', 'بزرگمهر'];
const gradeLabels = ['خیلی بد', 'بد', 'متوسط', 'خوب', 'بی‌نقص'];
const computerTurn = () => !tutorial && player === 1;
let feedback, turnChoices, openingDice;
const randomDie = () => 1 + Math.floor(Math.random() * 6);
const { BAR, OFF } = Rules;
let lesson = 0;
let tutorial = true;
let state, player, phase, selected, dice, remaining, options, message;
const setupOrder = [23, 12, 7, 5];
const setupCounts = Rules.initial().points;
const questions = [
  {
    prompt: 'حریف هیچ مهره‌ای خارج نکرده و مهره‌ای روی خط وسط دارد. برد چند امتیاز پایه دارد؟',
    options: ['۱ امتیاز', '۲ امتیاز', '۳ امتیاز'], answer: 2,
    explanation: 'برد سه‌امتیازی است، چون حریف هنوز مهره‌ای روی خط وسط دارد.',
  },
  {
    prompt: 'ارزش مکعب ۲ است. اگر حریف پیشنهاد دوبل را رد کند، چند امتیاز می‌گیرید؟',
    options: ['۱ امتیاز', '۲ امتیاز', '۴ امتیاز'], answer: 1,
    explanation: 'با رد دوبل، امتیاز برابر با ارزش قبلی مکعب است.',
  },
];
let setupIndex, quizIndex, solved;
let scores, goal, cube, owner, usedCrawford, isCrawford, animation;

function start() {
  clearTimeout(animation);
  player = 0;
  const current = Lessons[lesson];
  phase = tutorial ? (current.setup ? 'setup' : current.quiz ? 'quiz' : 'ready') : 'opening';
  setupIndex = quizIndex = 0;
  solved = false;
  feedback = null;
  turnChoices = [];
  openingDice = false;
  state = tutorial && Lessons[lesson].position ? Lessons[lesson].position() : Rules.initial();
  if (phase === 'setup') {
    state.points = setupCounts.map(count => Math.min(0, count));
  }
  selected = null;
  dice = [];
  remaining = [];
  options = [];
  cube = 1;
  owner = null;
  isCrawford = !tutorial && Rules.crawford(scores, goal, usedCrawford);
  if (isCrawford) usedCrawford = true;
  message = tutorial ? (Lessons[lesson].task || Lessons[lesson].extra) :
    'برای شروع، شما و بزرگمهر هر کدام یک تاس می‌ریزید. تاس کوچک‌تر شروع می‌کند.';
  if (phase === 'setup') message = setupHint();
  if (phase === 'quiz') message = 'یک گزینه را انتخاب کنید.';
  render();
}

function setupHint() {
  const point = setupOrder[setupIndex];
  const missing = setupCounts[point] - state.points[point];
  return 'خانهٔ ' + fa(point + 1) + ' را بزنید. ' + fa(missing) + ' مهرهٔ روشن دیگر اینجا قرار می‌گیرد.';
}

function placeChecker(point) {
  const target = setupOrder[setupIndex];
  if (point !== target) {
    message = 'خانهٔ ' + fa(point + 1) + ' جای این مهره نیست. ' + setupHint();
    render();
    return;
  }
  state.points[point]++;
  if (state.points[point] === setupCounts[point]) setupIndex++;
  solved = setupIndex === setupOrder.length;
  if (solved) phase = 'done';
  message = solved ? 'هر ۱۵ مهرهٔ روشن سر جای خود است. می‌توانید اولین حرکت را تمرین کنید.' : setupHint();
  render();
  (solved ? nextLessonControl() : boardButtons.get(setupOrder[setupIndex])).focus({ preventScroll: true });
}

function renderPractice() {
  const area = $('practice');
  area.hidden = !tutorial || phase !== 'quiz';
  area.replaceChildren();
  if (area.hidden) return;
  const question = questions[quizIndex];
  const prompt = document.createElement('strong');
  prompt.textContent = question.prompt;
  area.append(prompt);
  const choices = document.createElement('div');
  choices.className = 'quiz-choices';
  question.options.forEach((label, index) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.onclick = () => {
      if (index !== question.answer) {
        $('status').textContent = 'یک بار دیگر امتحان کنید.';
        return;
      }
      quizIndex++;
      solved = quizIndex === questions.length;
      if (solved) phase = 'done';
      message = question.explanation + (solved ? ' تمرین امتیازدهی کامل شد.' : '');
      render();
      (solved ? nextLessonControl() : area.querySelector('button')).focus({ preventScroll: true });
    };
    choices.append(button);
  });
  area.append(choices);
}

function newMatch() {
  scores = [0, 0];
  goal = Number($('goal').value);
  usedCrawford = false;
  start();
}

function updateMoves() {
  if (!tutorial) {
    turnChoices = Opponent.rank(state, player, remaining);
    options = turnChoices.map(choice => choice.move);
    return;
  }
  const firstMoves = Rules.sequences(state, player, remaining).flatMap(sequence => sequence.slice(0, 1));
  options = [...new Map(firstMoves.map(move => [JSON.stringify(move), move])).values()];
}

function queueComputer() {
  if (!computerTurn()) return;
  if (!['ready', 'moving', 'pass'].includes(phase)) return;
  animation = setTimeout(() => {
    if (phase === 'ready' && canDouble() && Opponent.evaluate(state, 1) >= 20) {
      phase = 'offer';
      message = 'بزرگمهر پیشنهاد دوبل داد. ارزش بازی به ' + fa(cube * 2) + ' می‌رسد.';
      render();
      $('accept').focus();
    } else if (phase === 'moving') {
      makeMove(options[0]);
    } else {
      roll();
    }
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 70 : 460);
}

function describeMove(move) {
  const from = move.from === BAR ? 'خط وسط' : 'خانهٔ ' + fa(move.from + 1);
  const to = move.to === OFF ? 'خارج کردن' : 'خانهٔ ' + fa(move.to + 1);
  return from + ' به ' + to + ' با تاس ' + fa(move.die);
}

function assessMove(move) {
  const best = turnChoices[0];
  const chosen = turnChoices.find(choice => choice.move === move);
  const level = Opponent.grade(best.score - chosen.score);
  const reason = level === 4 ?
    (turnChoices.length === 1 ? 'با تاس‌های باقی‌مانده همین حرکت اجباری بود.' : 'این حرکت یکی از بهترین ادامه‌ها را داشت.') :
    'پیشنهاد بهتر: ' + describeMove(best.move) + '، با در نظر گرفتن تاس‌های باقی‌مانده.';
  feedback = { level, reason };
}

function roll() {
  if (phase === 'next') {
    start();
    return;
  }
  if (phase === 'pass') {
    player = 1 - player;
    phase = 'ready';
    openingDice = false;
    selected = null;
    dice = [];
    remaining = [];
    options = [];
    message = computerTurn() ? 'بزرگمهر آمادهٔ تاس ریختن است.' : 'نوبت ' + names[player] + ' است. تاس بریزید.';
    render();
    queueComputer();
    return;
  }
  if (!['ready', 'opening', 'done'].includes(phase)) return;
  if (phase === 'done') {
    start();
    return;
  }
  const opening = phase === 'opening';
  const result = tutorial ? Lessons[lesson].dice : [randomDie(), randomDie()];
  openingDice = opening;
  if (!tutorial && !computerTurn()) feedback = null;
  phase = 'rolling';
  dice = result.map(() => randomDie());
  message = 'تاس‌ها در حال چرخش‌اند…';
  render();
  animation = setTimeout(() => {
    dice = result;
    if (opening && dice[0] === dice[1]) {
      phase = 'opening';
      message = 'هر دو تاس ' + fa(dice[0]) + ' آمد. دوباره تاس بریزید.';
      render();
      return;
    }
    if (opening) player = Opponent.openingPlayer(dice);
    remaining = dice.length === 2 && dice[0] === dice[1] ? Array(4).fill(dice[0]) : [...dice];
    phase = 'moving';
    updateMoves();
    message = opening ? names[0] + ' ' + fa(dice[0]) + ' آورد و بزرگمهر ' + fa(dice[1]) +
      ' آورد. ' + names[player] + ' با تاس کوچک‌تر شروع می‌کند و هر دو عدد را بازی می‌کند.' :
      computerTurn() ? 'بزرگمهر حرکتش را انتخاب می‌کند.' :
      state.bar[player] ? 'ابتدا مهرهٔ خط وسط را وارد کنید.' : 'یک مهره و سپس مقصد آن را انتخاب کنید.';
    if (!options.length) {
      phase = 'pass';
      message = computerTurn() ? 'بزرگمهر حرکت مجازی ندارد.' : 'با این تاس‌ها هیچ حرکت مجازی ندارید. نوبت را واگذار کنید.';
    }
    render();
    queueComputer();
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 30 : 640);
}

function select(point, button) {
  if (phase === 'setup' && point >= 0 && point < BAR) {
    placeChecker(point);
    return;
  }
  if (phase !== 'moving' || computerTurn()) return;
  const targets = options.filter(move => move.from === selected && move.to === point);
  if (targets.length === 1) {
    makeMove(targets[0]);
    return;
  }
  if (targets.length > 1) {
    message = 'برای این مقصد، یکی از تاس‌های پایین تخته را انتخاب کنید.';
    render(targets);
    $('moves').querySelector('button')?.focus();
    return;
  }
  if (options.some(move => move.from === point)) {
    selected = selected === point ? null : point;
    message = selected === null ? 'یک مهرهٔ قابل حرکت انتخاب کنید.' : 'اکنون یکی از مقصدهای مشخص‌شده را بزنید.';
    render();
    (boardButtons.get(button)?.isConnected ? boardButtons.get(button) : $('off')).focus();
  }
}

function makeMove(move) {
  if (!tutorial && !computerTurn()) assessMove(move);
  const hit = move.to >= 0 && state.points[Rules.physical(player, move.to)] === (player === 0 ? -1 : 1);
  state = Rules.apply(state, player, move);
  remaining.splice(remaining.indexOf(move.die), 1);
  selected = null;
  updateMoves();
  if (tutorial && !options.length) {
    phase = 'done';
    solved = true;
    message = 'آفرین! تمرین کامل شد. می‌توانید این تمرین را تکرار کنید یا به درس بعد بروید.';
  } else if (!tutorial && state.off[player] === 15) {
    const multiplier = Rules.multiplier(state, player);
    finish(player, cube * multiplier, ['برد عادی', 'مارس', 'برد سه‌امتیازی'][multiplier - 1]);
  } else if (!options.length) {
    phase = 'pass';
    message = (hit ? 'مهرهٔ حریف به خط وسط رفت. ' : '') +
      (remaining.length ? 'برای تاس باقی‌مانده حرکت مجازی ندارید.' : 'حرکت‌های این نوبت کامل شد.');
  } else {
    message = hit ? 'مهرهٔ حریف به خط وسط رفت. حرکت بعدی را انجام دهید.' : 'حرکت بعدی را با تاس باقی‌مانده انجام دهید.';
  }
  if (computerTurn() && ['moving', 'pass'].includes(phase)) {
    const from = move.from < BAR ? fa(Rules.physical(1, move.from) + 1) : 'خط وسط';
    const to = move.to < 0 ? 'خارج از تخته' : fa(Rules.physical(1, move.to) + 1);
    message = 'بزرگمهر با تاس ' + fa(move.die) + ' از ' + from + ' به ' + to + ' رفت.' +
      (hit ? ' مهرهٔ شما به خط وسط رفت.' : '');
  }
  render();
  queueComputer();
  if (computerTurn()) return;
  const focus = options.length && phase === 'moving' ? $('board').querySelector('.origin') : $('roll');
  focus?.focus();
}

function finish(winner, points, reason) {
  scores[winner] += points;
  phase = scores[winner] >= goal ? 'finished' : 'next';
  message = names[winner] + ' با ' + fa(points) + ' امتیاز برنده شد. ' + reason + '؛ ' +
    (phase === 'finished' ? 'مسابقه به پایان رسید.' : 'برای ادامه، بازی بعدی را شروع کنید.');
}

function canDouble() {
  return !tutorial && phase === 'ready' && !isCrawford && (owner === null || owner === player);
}

$('double').onclick = () => {
  if (!canDouble() || computerTurn()) return;
  if (Opponent.evaluate(state, 1) < -27) {
    finish(0, cube, 'بزرگمهر دوبل را رد کرد');
  } else {
    cube *= 2;
    owner = 1;
    message = 'بزرگمهر دوبل را پذیرفت. حالا تاس بریزید.';
  }
  render();
  (phase === 'finished' ? $('restart') : $('roll')).focus();
};
$('accept').onclick = () => {
  if (phase !== 'offer') return;
  cube *= 2;
  owner = 1 - player;
  phase = 'ready';
  message = 'دوبل پذیرفته شد. ' + names[player] + '، تاس بریزید.';
  render();
  queueComputer();
};
$('decline').onclick = () => {
  if (phase !== 'offer') return;
  finish(player, cube, 'رد دوبل');
  render();
  (phase === 'finished' ? $('restart') : $('roll')).focus();
};

const boardButtons = new Map();
for (const [row, points] of [[1, Array.from({length: 12}, (_, i) => i + 12)],
  [2, Array.from({length: 12}, (_, i) => 11 - i)]]) {
  points.forEach((point, column) => {
    const button = document.createElement('button');
    button.style.gridArea = row + ' / ' + (column + (column < 6 ? 1 : 2));
    button.className = 'point ' + (row === 1 ? 'top' : 'bottom') + (point % 2 ? ' warm' : '');
    button.onclick = () => select(Rules.physical(player, point), point);
    $('board').append(button);
    boardButtons.set(point, button);
  });
}
const barButton = document.createElement('button');
barButton.className = 'bar';
barButton.onclick = () => select(BAR, BAR);
$('board').append(barButton);
boardButtons.set(BAR, barButton);

function stack(count, side) {
  const element = document.createElement('span');
  element.className = 'stack';
  for (let index = 0; index < Math.min(5, count); index++) {
    const piece = document.createElement('img');
    piece.src = 'assets/' + (side === 0 ? 'ivory' : 'walnut') + '.png';
    piece.alt = '';
    element.append(piece);
  }
  if (count > 5) {
    const badge = document.createElement('span');
    badge.className = 'count';
    badge.textContent = fa(count);
    element.append(badge);
  }
  return element;
}

const pipPositions = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9] };

function render(targets = []) {
  const current = Lessons[lesson];
  const enteringName = phase === 'name';
  const busy = computerTurn() && ['ready', 'moving', 'pass'].includes(phase);
  const active = phase === 'moving' && !busy ? options : [];
  $('learn').setAttribute('aria-pressed', tutorial);
  $('play').setAttribute('aria-pressed', !tutorial);
  $('turn').textContent = tutorial ? 'تمرین با مهرهٔ روشن' :
    enteringName || phase === 'opening' ? 'تاس شروع' : 'نوبت ' + names[player];
  const settingUp = phase === 'setup';
  const setupTarget = setupOrder[setupIndex];
  $('score').textContent = settingUp ? fa(state.points.reduce((sum, count) => sum + Math.max(0, count), 0)) + ' از ۱۵ مهره چیده شد' : tutorial ? 'درس ' + fa(lesson + 1) + ' از ' + fa(Lessons.length) :
    names[0] + ' ' + fa(scores?.[0] ?? 0) + ' · بزرگمهر ' + fa(scores?.[1] ?? 0) + ' | ' +
    (isCrawford ? 'کرافورد' : 'دوبل ' + fa(cube) + ' · ' + (owner === null ? 'وسط' : names[owner]));
  for (const [point, button] of boardButtons) {
    const local = point === BAR ? BAR : Rules.physical(player, point);
    const from = active.some(move => move.from === local);
    const to = active.some(move => move.from === selected && move.to === local);
    button.classList.toggle('origin', from);
    button.classList.toggle('target', to);
    button.classList.toggle('selected', selected === local);
    const placeHere = settingUp && point === setupTarget;
    button.classList.toggle('place-here', placeHere);
    button.disabled = !from && !to && !(settingUp && point !== BAR);
    if (point === BAR) {
      button.replaceChildren(stack(state.bar[1], 1), stack(state.bar[0], 0));
      button.setAttribute('aria-label', 'خط وسط؛ روشن ' + fa(state.bar[0]) + '، تیره ' + fa(state.bar[1]));
      continue;
    }
    const count = state.points[point];
    const number = document.createElement('span');
    number.className = 'point-number';
    number.textContent = fa(point + 1);
    button.replaceChildren(number, stack(Math.abs(count), count < 0 ? 1 : 0));
    if (placeHere) {
      const marker = document.createElement('span');
      marker.className = 'placement-count';
      marker.textContent = '+' + fa(setupCounts[point] - count);
      button.append(marker);
    }
    button.setAttribute('aria-label', 'خانهٔ ' + fa(point + 1) + '، ' +
      (count ? fa(Math.abs(count)) + ' مهرهٔ ' + colors[count < 0 ? 1 : 0] : 'خالی') + (to ? '، مقصد مجاز' : '') + (placeHere ? '، جای مهرهٔ روشن' : ''));
  }

  $('off').textContent = 'خارج‌شده: ' + fa(state.off[0]) + ' / ' + fa(state.off[1]);
  $('off').disabled = !active.some(move => move.from === selected && move.to === OFF);
  $('off').classList.toggle('target', !$('off').disabled);
  $('dice').replaceChildren(...dice.map((die, index) => {
    const tile = document.createElement('span');
    tile.className = 'die' + (phase === 'rolling' ? ' rolling' : '');
    tile.style.setProperty('--spin', index ? '-1' : '1');
    const label = 'تاس ' + fa(die);
    tile.setAttribute('aria-label', openingDice ? names[index] + ': ' + label : label);
    if (openingDice) tile.title = names[index] + ': ' + label;
    tile.setAttribute('role', 'img');
    for (const position of pipPositions[die]) {
      const pip = document.createElement('i');
      pip.style.gridArea = Math.ceil(position / 3) + '/' + ((position - 1) % 3 + 1);
      tile.append(pip);
    }
    return tile;
  }));
  $('moves').replaceChildren();
  if (remaining.length && phase === 'moving') $('moves').append('تاس‌های باقی‌مانده: ' + remaining.map(fa).join('، '));
  for (const move of targets) {
    const button = document.createElement('button');
    button.textContent = 'استفاده از تاس ' + fa(move.die);
    button.onclick = () => makeMove(move);
    $('moves').append(button);
  }
  $('roll').disabled = busy || !['opening', 'ready', 'pass', 'next', 'done'].includes(phase);
  $('roll').textContent = ({
    opening: 'تاس شروع', pass: 'پایان نوبت', next: 'بازی بعدی', done: 'تکرار تمرین', rolling: 'در حال تاس ریختن',
  })[phase] || 'تاس بریز';
  $('match-name').hidden = !enteringName;
  $('controls').hidden = tutorial || enteringName;
  $('feedback').hidden = tutorial || !feedback;
  if (feedback && !tutorial) {
    $('feedback').dataset.grade = feedback.level;
    $('feedback-grade').textContent = gradeLabels[feedback.level];
    $('feedback-detail').textContent = feedback.reason;
  }
  $('double').disabled = !canDouble() || computerTurn();
  $('offer').hidden = phase !== 'offer';
  $('lesson-nav').hidden = !tutorial;
  $('section').textContent = tutorial ? 'درس ' + fa(lesson + 1) : 'رقابت با رایانه';
  $('lesson-title').textContent = tutorial ? current.title : 'بازی با رایانه';
  $('lesson-text').textContent = tutorial ? current.text + (current.extra ? ' ' + current.extra : '') :
    'شما مهره‌های روشن را حرکت می‌دهید و بزرگمهر مهره‌های تیره را. بعد از هر حرکت، ارزیابی همان حرکت و در صورت وجود یک پیشنهاد بهتر را می‌بینید.';
  $('status').textContent = message;
  renderPractice();
  $('board').hidden = enteringName || phase === 'quiz' || (tutorial && current.quiz);
  $('game-tray').hidden = enteringName || tutorial && (current.quiz || (current.setup && !solved));
  $('previous').hidden = !tutorial || lesson === 0;
  $('next').hidden = !tutorial;
  $('next').classList.toggle('lesson-solved', tutorial && solved);
  $('next').textContent = lesson === Lessons.length - 1 ? 'شروع بازی با بزرگمهر' : 'درس بعدی';
  $('continue-lesson').hidden = !tutorial || !solved;
  $('continue-lesson').textContent = $('next').textContent;
  [...$('lesson-nav').children].forEach((button, index) => button.setAttribute('aria-current', index === lesson ? 'step' : 'false'));
}

for (const [index, item] of Lessons.entries()) {
  const button = document.createElement('button');
  button.textContent = fa(index + 1);
  button.setAttribute('aria-label', item.title);
  button.onclick = () => openLesson(index);
  $('lesson-nav').append(button);
  const section = document.createElement('section');
  const heading = document.createElement('h3');
  const paragraph = document.createElement('p');
  heading.textContent = item.title;
  paragraph.textContent = item.text + (item.extra ? ' ' + item.extra : '');
  section.append(heading, paragraph);
  $('reference').append(section);
}
$('learn').onclick = () => { if (!tutorial) { tutorial = true; start(); } };
$('play').onclick = () => {
  if (!tutorial) return;
  tutorial = false;
  newMatch();
  phase = 'name';
  message = 'با مهره‌های روشن مقابل بزرگمهر بازی کنید.';
  render();
  $('player-name').focus();
};
$('match-name').onsubmit = event => {
  event.preventDefault();
  names[0] = $('player-name').value.trim() || 'شما';
  newMatch();
  $('roll').focus();
};
function nextLessonControl() {
  return matchMedia('(max-width: 790px)').matches ? $('continue-lesson') : $('next');
}

function openLesson(index) {
  lesson = index;
  start();
  $('status').focus();
}
function advanceLesson() {
  if (lesson === Lessons.length - 1) {
    $('play').click();
  } else {
    openLesson(lesson + 1);
  }
}
$('previous').onclick = () => openLesson(lesson - 1);
$('next').onclick = advanceLesson;
$('continue-lesson').onclick = advanceLesson;
$('off').onclick = () => select(OFF);
$('roll').onclick = () => { if (!computerTurn() || ['next', 'finished'].includes(phase)) roll(); };
$('restart').onclick = newMatch;
$('goal').onchange = newMatch;
start();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
