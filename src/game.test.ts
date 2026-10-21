import { test, expect } from 'vitest';
import {
  newRound,
  isWon,
  playSwap,
  restartRound,
  elapsedMs,
  scoreFor,
  roundScore,
  formatTime,
  SCORE_BASE,
  POINTS_PER_EXTRA_MOVE
} from './game';
import { dealBoard, minSwapsToSolve, solvedBoard } from './puzzle';

// 3x3 deal one swap from solved: tiles 1 and 2 (0-based) are exchanged.
const oneSwapDeal = () => [0, 2, 1, 3, 4, 5, 6, 7, 8];

// 3x3 deal two swaps from solved: a 3-cycle over slots 0, 1, 2.
const threeCycleDeal = () => [1, 2, 0, 3, 4, 5, 6, 7, 8];

test('newRound starts from the deal with no moves, no clock and the fewest swaps recorded', () => {
  const round = newRound(3, threeCycleDeal);
  expect(round.size).toBe(3);
  expect(round.board).toEqual(threeCycleDeal());
  expect(round.start).toEqual(threeCycleDeal());
  expect(round.moves).toBe(0);
  expect(round.optimal).toBe(2);
  expect(round.startedAt).toBeNull();
  expect(round.finishedAt).toBeNull();
  expect(isWon(round)).toBe(false);
});

test('newRound keeps its own copies: moving tiles never edits the deal Reset restores', () => {
  const dealt = threeCycleDeal();
  const round = newRound(3, () => dealt);
  playSwap(round, 0, 2, 0);
  expect(round.start).toEqual(threeCycleDeal());
  expect(dealt).toEqual(threeCycleDeal());
});

test('newRound refuses a deal with a duplicated tile or the wrong number of tiles', () => {
  expect(() => newRound(3, () => [0, 0, 2, 3, 4, 5, 6, 7, 8])).toThrow(/unsolvable 3x3 board/);
  expect(() => newRound(4, () => solvedBoard(3))).toThrow(/unsolvable 4x4 board/);
});

test('newRound with the default dealer deals an unsolved board of the requested size', () => {
  for (const size of [3, 4, 5] as const) {
    const round = newRound(size);
    expect(round.board).toHaveLength(size * size);
    expect(round.optimal).toBeGreaterThan(0);
  }
});

test('the first swap starts the clock and every swap counts one move', () => {
  const round = newRound(3, threeCycleDeal);
  expect(playSwap(round, 3, 4, 1000)).toBe('swapped');
  expect(round.startedAt).toBe(1000);
  expect(round.moves).toBe(1);
  expect(playSwap(round, 3, 4, 2500)).toBe('swapped');
  expect(round.startedAt).toBe(1000); // not restarted by later swaps
  expect(round.moves).toBe(2);
});

test('a refused swap counts no move and does not start the clock', () => {
  const round = newRound(3, threeCycleDeal);
  expect(playSwap(round, 0, 0, 1000)).toBe('refused');
  expect(playSwap(round, -1, 2, 1000)).toBe('refused');
  expect(playSwap(round, 0, 9, 1000)).toBe('refused');
  expect(round.moves).toBe(0);
  expect(round.startedAt).toBeNull();
  expect(round.board).toEqual(threeCycleDeal());
});

test('the winning swap stops the clock, and a won board refuses further swaps', () => {
  const round = newRound(3, oneSwapDeal);
  expect(playSwap(round, 1, 2, 5000)).toBe('won');
  expect(isWon(round)).toBe(true);
  expect(round.finishedAt).toBe(5000);
  expect(playSwap(round, 3, 4, 6000)).toBe('refused');
  expect(round.moves).toBe(1);
  expect(round.board).toEqual(solvedBoard(3));
});

test('elapsedMs is 0 before the first move, runs while playing and freezes at the win', () => {
  const round = newRound(3, threeCycleDeal);
  expect(elapsedMs(round, 99_000)).toBe(0);
  playSwap(round, 0, 1, 10_000); // [2,1,0,...]
  expect(elapsedMs(round, 12_500)).toBe(2500);
  expect(playSwap(round, 0, 2, 40_000)).toBe('won');
  expect(elapsedMs(round, 40_000)).toBe(30_000);
  expect(elapsedMs(round, 500_000)).toBe(30_000);
});

test('restartRound puts the deal back and clears the moves, the clock and the win', () => {
  const round = newRound(3, oneSwapDeal);
  playSwap(round, 1, 2, 5000);
  expect(isWon(round)).toBe(true);
  restartRound(round);
  expect(round.board).toEqual(oneSwapDeal());
  expect(round.moves).toBe(0);
  expect(round.startedAt).toBeNull();
  expect(round.finishedAt).toBeNull();
  expect(isWon(round)).toBe(false);
  // and the round can be played again from there
  expect(playSwap(round, 1, 2, 9000)).toBe('won');
});

test('scoreFor: a perfect instant solve scores the base for its size', () => {
  expect(scoreFor(3, 4, 4, 0)).toBe(1000);
  expect(scoreFor(4, 9, 9, 999)).toBe(2000); // under a second costs nothing
  expect(scoreFor(5, 20, 20, 0)).toBe(3000);
  expect(SCORE_BASE).toEqual({ 3: 1000, 4: 2000, 5: 3000 });
});

test('scoreFor takes 20 per move beyond the fewest and 1 per whole second', () => {
  // 3 extra moves and 45.9 seconds: 2000 - 60 - 45
  expect(scoreFor(4, 12, 9, 45_900)).toBe(1895);
  expect(POINTS_PER_EXTRA_MOVE).toBe(20);
});

test('scoreFor never goes below 0', () => {
  expect(scoreFor(3, 500, 4, 3_600_000)).toBe(0);
});

test('roundScore is null until the round is won, then scores the finished round', () => {
  const round = newRound(3, threeCycleDeal); // optimal 2
  expect(roundScore(round)).toBeNull();
  playSwap(round, 3, 4, 0); // a wasted move
  playSwap(round, 3, 4, 1000); // and back
  playSwap(round, 0, 1, 2000);
  expect(roundScore(round)).toBeNull();
  expect(playSwap(round, 0, 2, 12_000)).toBe('won');
  // 4 moves, 2 extra, 12 seconds: 1000 - 40 - 12
  expect(roundScore(round)).toBe(948);
});

test('formatTime renders m:ss', () => {
  expect(formatTime(0)).toBe('0:00');
  expect(formatTime(999)).toBe('0:00');
  expect(formatTime(7_000)).toBe('0:07');
  expect(formatTime(125_000)).toBe('2:05');
  expect(formatTime(3_660_000)).toBe('61:00');
  expect(formatTime(-5_000)).toBe('0:00');
});

test('a whole game: deal 4x4, solve tile by tile, win in exactly the fewest moves', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const round = newRound(4, size => dealBoard(size, rng));
  const optimal = minSwapsToSolve(round.board);
  expect(round.optimal).toBe(optimal);

  let t = 0;
  let last = 'refused';
  for (let slot = 0; slot < round.board.length; slot++) {
    if (round.board[slot] === slot) continue;
    expect(isWon(round)).toBe(false);
    t += 1000;
    last = playSwap(round, slot, round.board.indexOf(slot), t);
  }
  expect(last).toBe('won');
  expect(round.moves).toBe(optimal);
  // perfect play: only the clock costs points (first swap at 1s, last at t)
  expect(roundScore(round)).toBe(2000 - Math.floor((t - 1000) / 1000));
});
