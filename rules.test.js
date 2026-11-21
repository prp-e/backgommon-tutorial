'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');

function position(entries, bar = [0, 0], off = [0, 0]) {
  const points = Array(24).fill(0);
  for (const [point, count] of entries) points[point - 1] = count;
  return { points, bar, off };
}

test('standard opening has 15 checkers per side and mirrored directions', () => {
  const state = R.initial();
  for (const sign of [1, -1]) {
    assert.equal(state.points.filter(n => n * sign > 0).reduce((sum, n) => sum + Math.abs(n), 0), 15);
  }
  assert.deepEqual(R.sequences(state, 0, [3, 1]), R.sequences(state, 1, [3, 1]));
});

test('enter from the bar first, hit a blot, and reject a blocked entry', () => {
  const state = position([[24, -2], [22, -1], [20, -2], [5, 1]], [1, 0]);
  const paths = R.sequences(state, 0, [1, 3]);
  assert.equal(paths.length, 2);
  assert.ok(paths.every(sequence => sequence.length === 2));
  assert.ok(paths.every(([entry]) => entry.from === R.BAR && entry.to === 21 && entry.die === 3));
  const entered = R.apply(state, 0, paths[0][0]);
  assert.deepEqual(entered.bar, [0, 1]);
  assert.deepEqual(R.sequences(position([[24, -2], [22, -2]], [1, 0]), 0, [1, 3]), [[]]);
});

test('play both dice when possible and consume four moves on doubles', () => {
  const state = position([[13, 1], [10, -2]]);
  assert.deepEqual(R.sequences(state, 0, [3, 1]), [[{ from: 12, to: 11, die: 1 }, { from: 11, to: 8, die: 3 }]]);
  assert.ok(R.sequences(R.initial(), 0, [2, 2, 2, 2]).every(sequence => sequence.length === 4));
});

test('when only one of two playable dice can be used, require the higher', () => {
  const state = position([[10, 1], [5, -2]]);
  assert.deepEqual(R.sequences(state, 0, [2, 3]), [[{ from: 9, to: 6, die: 3 }]]);
});

test('bear off exactly or from the highest occupied point with an oversized die', () => {
  const state = position([[5, 1], [2, 1]], [0, 0], [13, 0]);
  assert.deepEqual(R.sequences(state, 0, [6]), [[{ from: 4, to: R.OFF, die: 6 }]]);
  assert.deepEqual(R.sequences(state, 0, [2]), [[{ from: 1, to: R.OFF, die: 2 }], [{ from: 4, to: 2, die: 2 }]]);
  assert.ok(R.sequences(position([[7, 1], [2, 1]]), 0, [2]).every(sequence => sequence[0].to !== R.OFF));
});

test('ordinary, gammon and backgammon wins use different multipliers', () => {
  assert.equal(R.multiplier(position([[2, -1]], [0, 0], [15, 1]), 0), 1);
  assert.equal(R.multiplier(position([[22, -15]], [0, 0], [15, 0]), 0), 2);
  assert.equal(R.multiplier(position([[2, -1], [22, -14]], [0, 0], [15, 0]), 0), 3);
  assert.equal(R.multiplier(position([[22, -14]], [0, 1], [15, 0]), 0), 3);
  assert.equal(R.multiplier(position([[23, 1]], [0, 0], [0, 15]), 1), 3);
});

test('Crawford is activated only once when a player is one point away', () => {
  assert.equal(R.crawford([0, 0], 1, false), false);
  assert.equal(R.crawford([2, 4], 5, false), true);
  assert.equal(R.crawford([3, 4], 5, true), false);
});
