'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Rules = require('./rules');
const Opponent = require('./opponent');

test('the smaller opening die starts, and ties require another roll', () => {
  assert.equal(Opponent.openingPlayer([1, 6]), 0);
  assert.equal(Opponent.openingPlayer([6, 1]), 1);
  assert.equal(Opponent.openingPlayer([4, 4]), null);
});

test('computer ranks only starts of legal maximum-length turns', () => {
  const position = Rules.initial();
  for (const side of [0, 1]) {
    const dice = [3, 1];
    const ranked = Opponent.rank(position, side, dice);
    const legal = Rules.sequences(position, side, dice).map(sequence => JSON.stringify(sequence[0]));
    assert.deepEqual(new Set(ranked.map(choice => JSON.stringify(choice.move))), new Set(legal));
    assert.ok(ranked.every((choice, index) => index === 0 || ranked[index - 1].score >= choice.score));
  }
});

test('feedback distinguishes five levels and prioritizes winning moves', () => {
  assert.deepEqual([8, 5, 3, 1, 0].map(Opponent.grade), [0, 1, 2, 3, 4]);
  const position = { points: Array(24).fill(0), bar: [0, 0], off: [14, 14] };
  position.points[4] = 1;
  position.points[19] = -1;
  const [best] = Opponent.rank(position, 0, [5]);
  assert.equal(best.move.to, Rules.OFF);
  assert.equal(best.move.die, 5);
});
