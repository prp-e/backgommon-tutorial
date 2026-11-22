'use strict';

const Opponent = ((rules) => {
  function features(position, side) {
    const sign = side === 0 ? 1 : -1;
    const own = point => sign * position.points[rules.physical(side, point)];
    const back = Array.from({ length: 24 }, (_, point) => point)
      .findLast(point => own(point) > 0) ?? -1;
    return {
      back: position.bar[side] ? rules.BAR : back,
      pip: Array.from({ length: 24 }, (_, point) => Math.max(0, own(point)) * (point + 1))
        .reduce((sum, value) => sum + value, 25 * position.bar[side]),
      bar: position.bar[side],
      off: position.off[side],
      home: Array.from({ length: 6 }, (_, point) => own(point)).filter(count => count > 1).length,
      made: Array.from({ length: 18 }, (_, point) => own(point)).filter(count => count > 1).length,
      exposed: Array.from({ length: 24 }, (_, point) => point)
        .filter(point => own(point) === 1 && (
          Array.from({ length: 6 }, (_, index) => point - index - 1)
            .some(origin => origin >= 0 && own(origin) < 0) ||
          (point < 6 && position.bar[1 - side])
        )).length,
    };
  }

  function evaluate(position, side) {
    const own = features(position, side);
    const rival = features(position, 1 - side);
    if (own.off === 15) return 500 + 20 * rules.multiplier(position, side);
    if (rival.off === 15) return -500 - 20 * rules.multiplier(position, 1 - side);
    const race = own.back + rival.back < 23;
    const progress = (rival.pip - own.pip) * .28 + (own.off - rival.off) * 2;
    if (race) return progress;
    return progress + (own.home - rival.home) * 1.6 + (own.made - rival.made) * 1.2 +
      (rival.exposed - own.exposed) * 2.5 + (rival.bar - own.bar) * 3 +
      (rival.back - own.back) * .16;
  }

  function rank(position, side, dice) {
    const choices = new Map();
    for (const sequence of rules.sequences(position, side, dice)) {
      if (!sequence.length) continue;
      const move = sequence[0];
      const key = move.from + '/' + move.to + '/' + move.die;
      const end = sequence.reduce((board, step) => rules.apply(board, side, step), position);
      const score = evaluate(end, side);
      if (!choices.has(key) || choices.get(key).score < score) choices.set(key, { move, score });
    }
    return [...choices.values()].sort((a, b) => b.score - a.score);
  }

  function grade(gap) {
    if (gap < .01) return 4;
    if (gap < 1.75) return 3;
    if (gap < 4.5) return 2;
    if (gap < 8) return 1;
    return 0;
  }

  function openingPlayer(dice) {
    if (dice[0] === dice[1]) return null;
    return dice[0] < dice[1] ? 0 : 1;
  }

  return { evaluate, rank, grade, openingPlayer };
})(typeof module === 'undefined' ? Rules : require('./rules'));

if (typeof module !== 'undefined') module.exports = Opponent;
