'use strict';

const $ = id => document.getElementById(id);
const fa = number => number.toLocaleString('fa-IR');
const colors = ['روشن', 'تیره'];
const names = ['شما', 'بزرگمهر'];
const scoringReasons = ['برد عادی', 'مارس', 'برد سه‌امتیازی'];
const gradeLabels = ['خیلی بد', 'بد', 'متوسط', 'خوب', 'بی‌نقص'];
const computerTurn = () => player === 1;
let feedback, turnChoices, openingDice, gameResult;
const randomDie = () => 1 + Math.floor(Math.random() * 6);
const { BAR, OFF } = Rules;
let guided = true;
let state, player, phase, selected, dice, remaining, options, message;
const setupOrder = [23, 12, 7, 5];
const setupCounts = Rules.initial().points;
let setupIndex;
let scores, goal, cube, owner, usedCrawford, isCrawford, animation;

function openingHint() {
  return 'برای شروع، شما و بزرگمهر هر کدام یک تاس می‌ریزید. تاس کوچک‌تر شروع می‌کند.';
}

function start(phaseAtStart = 'opening') {
  clearTimeout(animation);
  player = 0;
  phase = phaseAtStart;
  setupIndex = 0;
  feedback = null;
  gameResult = null;
  turnChoices = [];
  openingDice = false;
  state = Rules.initial();
  if (phase === 'setup') state.points = setupCounts.map(count => Math.min(0, count));
  selected = null;
  dice = [];
  remaining = [];
  options = [];
  cube = 1;
  owner = null;
  isCrawford = Rules.crawford(scores, goal, usedCrawford);
  if (isCrawford) usedCrawford = true;
  message = phase === 'name' ? 'نامتان را وارد کنید و بازی را شروع کنید.' :
    phase === 'setup' ? 'مهره‌های تیره چیده شده‌اند. ' + setupHint() :
    openingHint() + (guided && isCrawford ? ' در این بازی کرافورد، دوبل مجاز نیست.' : '');
  render();
}

function setupHint() {
  const point = setupOrder[setupIndex];
  return 'خانهٔ ' + fa(point + 1) + ' را بزنید تا ' + fa(setupCounts[point]) + ' مهرهٔ روشن آنجا بچینید.';
}

function placeChecker(point) {
  if (point !== setupOrder[setupIndex]) {
    message = 'این خانه جای دستهٔ بعدی نیست. ' + setupHint();
    render();
    return;
  }
  state.points[point] = setupCounts[point];
  setupIndex++;
  if (setupIndex === setupOrder.length) {
    phase = 'opening';
    message = 'مهره‌ها آماده‌اند. ' + openingHint();
  } else {
    message = setupHint();
  }
  render();
  focusTurnStart();
}

function focusTurnStart() {
  (phase === 'setup' ? boardButtons.get(setupOrder[setupIndex]) : $('roll')).focus();
}

function newMatch(phaseAtStart = guided ? 'setup' : 'opening') {
  scores = [0, 0];
  goal = Number($('goal').value);
  usedCrawford = false;
  start(phaseAtStart);
}

function updateMoves() {
  turnChoices = Opponent.rank(state, player, remaining);
  options = turnChoices.map(choice => choice.move);
}

function queueComputer() {
  if (!computerTurn()) return;
  if (!['ready', 'moving', 'pass'].includes(phase)) return;
  animation = setTimeout(() => {
    if (phase === 'ready' && canDouble() && Opponent.evaluate(state, 1) >= 20) {
      phase = 'offer';
      message = 'بزرگمهر پیشنهاد دوبل داد. با قبول، ارزش بازی به ' + fa(cube * 2) + ' می‌رسد.' +
        (guided ? ' با رد، بزرگمهر ' + fa(cube) + ' امتیاز می‌گیرد و بازی تمام می‌شود.' : '');
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
    message = computerTurn() ? 'بزرگمهر آمادهٔ تاس ریختن است.' : 'نوبت شماست. تاس بریزید.';
    if (guided && !computerTurn() && state.bar[0]) {
      message += ' ابتدا باید مهرهٔ خط وسط را برگردانید.';
    }
    render();
    if (!computerTurn()) $('roll').focus();
    queueComputer();
    return;
  }
  if (!['ready', 'opening'].includes(phase)) return;
  const opening = phase === 'opening';
  const result = [randomDie(), randomDie()];
  openingDice = opening;
  if (!computerTurn()) feedback = null;
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
    if (guided && !computerTurn() && options.length) {
      if (remaining.length === 4) message = 'جفت آوردید. اگر حرکت مجاز باشد، این عدد را چهار بار بازی کنید.';
      if (state.bar[0]) message += ' فقط مهرهٔ خط وسط می‌تواند وارد شود.';
      else if (options.some(move => move.to === OFF)) {
        message = 'همهٔ مهره‌ها در خانهٔ شما هستند. مهره‌ای را انتخاب کنید و برای برداشتن آن «خارج‌شده» را بزنید.';
      }
    }
    if (!options.length) {
      phase = 'pass';
      message = computerTurn() ? 'بزرگمهر حرکت مجازی ندارد.' : 'با این تاس‌ها هیچ حرکت مجازی ندارید. نوبت را واگذار کنید.';
    }
    render();
    if (guided && !computerTurn()) (phase === 'pass' ? $('roll') : $('board').querySelector('.origin'))?.focus();
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
    if (guided && selected !== null) {
      const blocked = remaining.some(die => selected - die >= 0 && state.points[selected - die] <= -2);
      if (blocked) message += ' خانه‌ای با دو یا چند مهرهٔ تیره بسته است.';
    }
    render();
    (boardButtons.get(button)?.isConnected ? boardButtons.get(button) : $('off')).focus();
  }
}

function makeMove(move) {
  if (!computerTurn()) assessMove(move);
  const hit = move.to >= 0 && state.points[Rules.physical(player, move.to)] === (player === 0 ? -1 : 1);
  state = Rules.apply(state, player, move);
  remaining.splice(remaining.indexOf(move.die), 1);
  selected = null;
  updateMoves();
  if (state.off[player] === 15) {
    const multiplier = Rules.multiplier(state, player);
    const reason = scoringReasons[multiplier - 1];
    const explanation = [
      'حریف دست‌کم یک مهره خارج کرده بود.',
      'حریف هیچ مهره‌ای خارج نکرده بود.',
      'حریف هیچ مهره‌ای خارج نکرده بود و هنوز روی خط وسط یا در خانهٔ برنده مهره داشت.',
    ][multiplier - 1];
    finish(player, cube * multiplier, reason, explanation);
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
  const focus = options.length && phase === 'moving' ? $('board').querySelector('.origin') : $('roll');
  focus?.focus();
}

function finish(winner, points, reason, explanation = '') {
  const announcement = names[winner] === 'شما' ? 'شما برنده شدید' : names[winner] + ' برنده شد';
  if (guided && explanation && cube > 1 && state.off[winner] === 15) {
    explanation += ' امتیاز پایه در ارزش ' + fa(cube) + ' مکعب ضرب شد.';
  }
  gameResult = { announcement, points, reason, explanation: guided ? explanation : '' };
  scores[winner] += points;
  phase = scores[winner] >= goal ? 'finished' : 'next';
  message = announcement + '. ' + fa(points) + ' امتیاز، ' + reason + '. ' +
    (phase === 'finished' ? 'مسابقه به پایان رسید.' : 'برای ادامه، بازی بعدی را شروع کنید.');
}

function canDouble() {
  return phase === 'ready' && !isCrawford && (owner === null || owner === player);
}

$('double').onclick = () => {
  if (!canDouble() || computerTurn()) return;
  if (Opponent.evaluate(state, 1) < -27) {
    finish(0, cube, 'بزرگمهر دوبل را رد کرد', 'با رد دوبل، امتیاز بازی برابر با ارزش قبلی مکعب است.');
  } else {
    cube *= 2;
    owner = 1;
    message = 'بزرگمهر دوبل را پذیرفت. ' +
      (guided ? 'ارزش بازی ' + fa(cube) + ' شد و مکعب به او رسید. ' : '') + 'حالا تاس بریزید.';
  }
  render();
  (gameResult ? $('result-action') : $('roll')).focus();
};
$('accept').onclick = () => {
  if (phase !== 'offer') return;
  cube *= 2;
  owner = 1 - player;
  phase = 'ready';
  message = guided ? 'ارزش بازی ' + fa(cube) + ' شد و مکعب در اختیار شماست.' :
    'دوبل پذیرفته شد. ' + names[player] + '، تاس بریزید.';
  render();
  queueComputer();
};
$('decline').onclick = () => {
  if (phase !== 'offer') return;
  finish(player, cube, 'رد دوبل', 'با رد دوبل، امتیاز بازی برابر با ارزش قبلی مکعب است.');
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
  const enteringName = phase === 'name';
  const busy = computerTurn() && ['ready', 'moving', 'pass'].includes(phase);
  const active = phase === 'moving' && !busy ? options : [];
  const settingUp = phase === 'setup';
  const setupTarget = setupOrder[setupIndex];
  $('learn').setAttribute('aria-pressed', guided);
  $('play').setAttribute('aria-pressed', !guided);
  $('turn').textContent = enteringName ? (guided ? 'بازی با راهنما' : 'بازی با رایانه') :
    settingUp ? 'چیدن مهره‌ها' : phase === 'opening' ? 'تاس شروع' : 'نوبت ' + names[player];
  $('score').textContent = enteringName ? '' :
    settingUp ? fa(state.points.reduce((sum, count) => sum + Math.max(0, count), 0)) + ' از ۱۵ مهره چیده شد' :
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
  $('roll').disabled = busy || !['opening', 'ready', 'pass', 'next'].includes(phase);
  $('roll').textContent = ({
    opening: 'تاس شروع', pass: 'پایان نوبت', next: 'بازی بعدی', rolling: 'در حال تاس ریختن',
  })[phase] || 'تاس بریز';
  $('match-name').hidden = !enteringName;
  $('controls').hidden = enteringName || settingUp || !!gameResult;
  $('game-result').hidden = !gameResult;
  if (gameResult) {
    const matchEnded = phase === 'finished';
    $('result-kind').textContent = matchEnded && goal > 1 ? 'پایان مسابقه' : 'پایان بازی';
    $('result-winner').textContent = gameResult.announcement;
    $('result-points').textContent = fa(gameResult.points) + ' امتیاز · ' + gameResult.reason;
    $('result-explanation').textContent = gameResult.explanation;
    $('result-explanation').hidden = !gameResult.explanation;
    $('result-action').textContent = matchEnded ? 'مسابقهٔ تازه' : 'بازی بعدی';
  }
  $('feedback').hidden = !feedback;
  if (feedback) {
    $('feedback').dataset.grade = feedback.level;
    $('feedback-grade').textContent = gradeLabels[feedback.level];
    $('feedback-detail').textContent = feedback.reason;
  }
  $('double').disabled = !canDouble() || computerTurn();
  $('offer').hidden = phase !== 'offer';
  $('guide').hidden = guided || enteringName;
  $('status').textContent = message;
  $('board').hidden = enteringName;
  $('game-tray').hidden = !!gameResult || enteringName || settingUp;
  $('layout').classList.toggle('guided', guided || enteringName);
}

for (const item of ReferenceRules) {
  const section = document.createElement('section');
  const heading = document.createElement('h3');
  const paragraph = document.createElement('p');
  heading.textContent = item.title;
  paragraph.textContent = item.text + (item.extra ? ' ' + item.extra : '');
  section.append(heading, paragraph);
  $('reference').append(section);
}
function selectMode(useGuide) {
  if (guided === useGuide) return;
  guided = useGuide;
  if (phase === 'name') {
    render();
    $('player-name').focus();
  } else {
    newMatch();
    focusTurnStart();
  }
}

$('learn').onclick = () => selectMode(true);
$('play').onclick = () => selectMode(false);
$('match-name').onsubmit = event => {
  event.preventDefault();
  names[0] = $('player-name').value.trim() || 'شما';
  newMatch();
  focusTurnStart();
};
$('off').onclick = () => select(OFF);
$('roll').onclick = () => { if (!computerTurn() || ['next', 'finished'].includes(phase)) roll(); };
$('restart').onclick = () => { newMatch(); focusTurnStart(); };
$('result-action').onclick = () => {
  if (!gameResult) return;
  if (phase === 'finished') newMatch();
  else start();
  focusTurnStart();
};
$('goal').onchange = () => { newMatch(); focusTurnStart(); };
newMatch('name');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
