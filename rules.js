'use strict';

const Rules = (() => {
  const BAR = 24;
  const OFF = -1;
  const opponent = player => 1 - player;
  const physical = (player, point) => player === 0 ? point : 23 - point;

  function initial() {
    const points = Array(24).fill(0);
    for (const [point, count] of [[23, 2], [12, 5], [7, 3], [5, 5]]) {
      points[point] = count;
      points[23 - point] = -count;
    }
    return { points, bar: [0, 0], off: [0, 0] };
  }

  function moves(state, player, die) {
    const sign = player === 0 ? 1 : -1;
    const occupied = Array.from({ length: 24 }, (_, point) => point)
      .filter(point => sign * state.points[physical(player, point)] > 0);
    const origins = state.bar[player] ? [BAR] : occupied;
    const home = !state.bar[player] && occupied.every(point => point < 6);
    return origins.flatMap(from => {
      const target = from - die;
      if (target >= 0 && sign * state.points[physical(player, target)] >= -1) {
        return [{ from, to: target, die }];
      }
      if (target < 0 && home && (target === -1 || occupied.every(point => point <= from))) {
        return [{ from, to: OFF, die }];
      }
      return [];
    });
  }

  function apply(state, player, { from, to }) {
    const next = { points: [...state.points], bar: [...state.bar], off: [...state.off] };
    const sign = player === 0 ? 1 : -1;
    if (from === BAR) next.bar[player]--;
    else next.points[physical(player, from)] -= sign;
    if (to === OFF) next.off[player]++;
    else {
      const point = physical(player, to);
      if (next.points[point] === -sign) {
        next.bar[opponent(player)]++;
        next.points[point] = 0;
      }
      next.points[point] += sign;
    }
    return next;
  }

  function sequences(state, player, dice) {
    const candidates = [];
    for (const die of new Set(dice)) {
      const rest = [...dice];
      rest.splice(rest.indexOf(die), 1);
      for (const move of moves(state, player, die)) {
        for (const tail of sequences(apply(state, player, move), player, rest)) {
          candidates.push([move, ...tail]);
        }
      }
    }
    if (!candidates.length) return [[]];
    const length = Math.max(...candidates.map(sequence => sequence.length));
    const best = candidates.filter(sequence => sequence.length === length);
    if (length === 1 && dice.length === 2 && dice[0] !== dice[1]) {
      const higher = Math.max(...best.map(sequence => sequence[0].die));
      return best.filter(sequence => sequence[0].die === higher);
    }
    return best;
  }

  function multiplier(state, winner) {
    const loser = opponent(winner);
    if (state.off[loser]) return 1;
    const losingSign = loser === 0 ? 1 : -1;
    const trapped = Array.from({ length: 6 }, (_, point) => point)
      .some(point => losingSign * state.points[physical(winner, point)] > 0);
    return state.bar[loser] || trapped ? 3 : 2;
  }

  function crawford(scores, goal, alreadyPlayed) {
    return goal > 1 && !alreadyPlayed && scores.includes(goal - 1);
  }

  return { BAR, OFF, initial, physical, apply, sequences, multiplier, crawford };
})();

if (typeof module !== 'undefined') module.exports = Rules;
