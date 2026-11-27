'use strict';

const $ = id => document.getElementById(id);
const fa = number => number.toLocaleString('fa-IR');
const colors = ['روشن', 'تیره'];
const names = ['شما', 'بزرگمهر'];
const scoringReasons = ['برد عادی', 'مارس', 'برد سه‌امتیازی'];
const gradeLabels = ['خیلی بد', 'بد', 'متوسط', 'خوب', 'بی‌نقص'];
const computerTurn = () => !tutorial && player === 1;
let feedback, turnChoices, openingDice, gameResult;
const randomDie = () => 1 + Math.floor(Math.random() * 6);
const { BAR, OFF } = Rules;
let lesson = 0;
let tutorial = true;
let state, player, phase, selected, dice, remaining, options, message;
const setupOrder = [23, 12, 7, 5];
const setupCounts = Rules.initial().points;
let setupIndex, solved;
let scores, goal, cube, owner, usedCrawford, isCrawford, animation;

function start() {
  clearTimeout(animation);
  player = 0;
  const current = Lessons[lesson];
  phase = !tutorial || current.opening ? 'opening' : current.setup ? 'setup' : 'ready';
  setupIndex = 0;
  solved = false;
  feedback = null;
  gameResult = null;
  turnChoices = [];
  openingDice = false;
  state = tutorial && Lessons[lesson].position ? Lessons[lesson].position() : Rules.initial();
  if (phase === 'setup') {
    state.points = setupCounts.map(count => count > 0 ? count - 1 : count);
  }
  selected = null;
  dice = [];
  remaining = [];
  options = [];
  const redoubling = tutorial && current.double === 'decline';
  cube = redoubling ? 2 : 1;
  owner = redoubling ? 0 : null;
  isCrawford = tutorial ? !!current.crawford : Rules.crawford(scores, goal, usedCrawford);
  if (!tutorial && isCrawford) usedCrawford = true;
  message = tutorial ? current.task :
    'برای شروع، شما و بزرگمهر هر کدام یک تاس می‌ریزید. تاس کوچک‌تر شروع می‌کند.';
  if (phase === 'setup') message += ' ' + setupHint();
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
  (solved ? $('continue-lesson') : boardButtons.get(setupOrder[setupIndex])).focus({ preventScroll: true });
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
  const firstMoves = Rules.sequences(state, player, remaining)
    .flatMap(sequence => sequence.slice(0, 1))
    .filter(move => !Lessons[lesson].bearOff || move.to === OFF);
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
  if (!['ready', 'opening', 'done'].includes(phase) || tutorial && canDouble()) return;
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
      tutorial ? Lessons[lesson].afterRoll :
      computerTurn() ? 'بزرگمهر حرکتش را انتخاب می‌کند.' :
      state.bar[player] ? 'ابتدا مهرهٔ خط وسط را وارد کنید.' : 'یک مهره و سپس مقصد آن را انتخاب کنید.';
    if (!options.length) {
      phase = 'pass';
      message = computerTurn() ? 'بزرگمهر حرکت مجازی ندارد.' : 'با این تاس‌ها هیچ حرکت مجازی ندارید. نوبت را واگذار کنید.';
    }
    render();
    if (tutorial) $('board').querySelector('.origin')?.focus();
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
    const current = Lessons[lesson];
    if (state.off[player] === 15) {
      const multiplier = Rules.multiplier(state, player);
      message = (current.complete || scoringReasons[multiplier - 1]) +
        ' ' + fa(cube * multiplier) + ' امتیاز گرفتید.';
    } else {
      message = current.complete;
    }
  } else if (!tutorial && state.off[player] === 15) {
    const multiplier = Rules.multiplier(state, player);
    finish(player, cube * multiplier, scoringReasons[multiplier - 1]);
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
  if (gameResult) {
    $('result-action').focus();
    return;
  }
  queueComputer();
  if (computerTurn()) return;
  const focus = tutorial && solved ? $('continue-lesson') :
    options.length && phase === 'moving' ? $('board').querySelector('.origin') : $('roll');
  focus?.focus();
}

function finish(winner, points, reason) {
  const announcement = names[winner] === 'شما' ? 'شما برنده شدید' : names[winner] + ' برنده شد';
  gameResult = { announcement, points, reason };
  scores[winner] += points;
  phase = scores[winner] >= goal ? 'finished' : 'next';
  message = announcement + '. ' + fa(points) + ' امتیاز، ' + reason + '. ' +
    (phase === 'finished' ? 'مسابقه به پایان رسید.' : 'برای ادامه، بازی بعدی را شروع کنید.');
}

function canDouble() {
  return phase === 'ready' && !isCrawford && (owner === null || owner === player) &&
    (!tutorial || Lessons[lesson].double);
}

function offerDouble() {
  if (!canDouble() || computerTurn()) return;
  if (tutorial && Lessons[lesson].double === 'decline') {
    phase = 'done';
    solved = true;
    message = 'بزرگمهر دوبل را رد کرد. ارزش قبلی مکعب ۲ بود و ۲ امتیاز گرفتید.';
  } else if (!tutorial && Opponent.evaluate(state, 1) < -27) {
    finish(0, cube, 'بزرگمهر دوبل را رد کرد');
  } else {
    cube *= 2;
    owner = 1;
    message = tutorial ?
      'بزرگمهر دوبل را پذیرفت. ارزش بازی ۲ شد و مکعب به او رسید. حالا تاس بریزید.' :
      'بزرگمهر دوبل را پذیرفت. حالا تاس بریزید.';
  }
  render();
  (gameResult ? $('result-action') : tutorial && solved ? $('continue-lesson') : $('roll')).focus();
}
$('double').onclick = offerDouble;
$('practice-double').onclick = offerDouble;
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
  (gameResult ? $('result-action') : $('roll')).focus();
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
  $('turn').textContent = tutorial ? current.title :
    enteringName || phase === 'opening' ? 'تاس شروع' : 'نوبت ' + names[player];
  const settingUp = phase === 'setup';
  const setupTarget = setupOrder[setupIndex];
  $('score').textContent = settingUp ? fa(state.points.reduce((sum, count) => sum + Math.max(0, count), 0)) + ' از ۱۵ مهره چیده شد' : tutorial ? fa(lesson + 1) + ' از ' + fa(Lessons.length) +
    (current.double ? ' · دوبل ' + fa(cube) : current.crawford ? ' · کرافورد' : '') :
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
  $('practice-double').hidden = !tutorial || !canDouble();
  $('roll').disabled = busy || tutorial && canDouble() || !['opening', 'ready', 'pass', 'next', 'done'].includes(phase);
  $('roll').textContent = ({
    opening: 'تاس شروع', pass: 'پایان نوبت', next: 'بازی بعدی', done: 'تکرار تمرین', rolling: 'در حال تاس ریختن',
  })[phase] || 'تاس بریز';
  $('match-name').hidden = !enteringName;
  $('controls').hidden = tutorial || enteringName || !!gameResult;
  $('game-result').hidden = !gameResult;
  if (gameResult) {
    const matchEnded = phase === 'finished';
    $('result-kind').textContent = matchEnded && goal > 1 ? 'پایان مسابقه' : 'پایان بازی';
    $('result-winner').textContent = gameResult.announcement;
    $('result-points').textContent = fa(gameResult.points) + ' امتیاز · ' + gameResult.reason;
    $('result-action').textContent = matchEnded ? 'مسابقهٔ تازه' : 'بازی بعدی';
  }
  $('feedback').hidden = tutorial || !feedback;
  if (feedback && !tutorial) {
    $('feedback').dataset.grade = feedback.level;
    $('feedback-grade').textContent = gradeLabels[feedback.level];
    $('feedback-detail').textContent = feedback.reason;
  }
  $('double').disabled = !canDouble() || computerTurn();
  $('offer').hidden = phase !== 'offer';
  $('guide').hidden = tutorial;
  $('status').textContent = message;
  $('board').hidden = enteringName;
  $('game-tray').hidden = !!gameResult || enteringName || settingUp;
  $('off').hidden = tutorial && !!current.setup;
  $('layout').classList.toggle('guided', tutorial);
  $('continue-lesson').hidden = !tutorial || !solved;
  $('continue-lesson').textContent = lesson === Lessons.length - 1 ? 'بازی با بزرگمهر' : 'موقعیت بعدی';
}

for (const item of Lessons) {
  if (!item.text) continue;
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
function advanceLesson() {
  if (!tutorial || !solved) return;
  if (lesson === Lessons.length - 1) {
    $('play').click();
  } else {
    lesson++;
    start();
    (phase === 'setup' ? boardButtons.get(setupOrder[setupIndex]) :
      $('practice-double').hidden ? $('roll') : $('practice-double')).focus();
  }
}
$('continue-lesson').onclick = advanceLesson;
$('off').onclick = () => select(OFF);
$('roll').onclick = () => { if (!computerTurn() || ['next', 'finished'].includes(phase)) roll(); };
$('restart').onclick = newMatch;
$('result-action').onclick = () => {
  if (!gameResult) return;
  if (phase === 'finished') newMatch();
  else start();
  $('roll').focus();
};
$('goal').onchange = newMatch;
start();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
