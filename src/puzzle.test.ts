import { test, expect } from 'vitest';
import {
  GRID_SIZES,
  GridSize,
  isGridSize,
  solvedBoard,
  shuffleArray,
  isPermutation,
  isSolved,
  permutationParity,
  minSwapsToSolve,
  isSolvable,
  minScramble,
  dealBoard,
  swapSlots,
  tileUvs
} from './puzzle';

// simple deterministic RNG for tests: cycles through provided values
function makeCycleRng(values: number[]) {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

// Small seeded PRNG so the randomised tests are reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('shuffleArray permutes elements', () => {
  const arr = [1,2,3,4,5];
  shuffleArray(arr, makeCycleRng([0.5, 0.4, 0.3, 0.2]));
  // Fisher-Yates from the end: j = floor(rng * (i + 1)) for i = 4..1 gives
  // j = 2, 1, 0, 0, i.e. swaps (4,2), (3,1), (2,0), (1,0):
  // [1,2,5,4,3] -> [1,4,5,2,3] -> [5,4,1,2,3] -> [4,5,1,2,3].
  expect(arr).toEqual([4, 5, 1, 2, 3]);
  expect([...arr].sort()).toEqual([1, 2, 3, 4, 5]);
});

test('shuffleArray with j === i at every step leaves the array as it was', () => {
  const arr = ['a', 'b', 'c', 'd'];
  shuffleArray(arr, () => 0.999999);
  expect(arr).toEqual(['a', 'b', 'c', 'd']);
});

test('the difficulty levels are 3x3, 4x4 and 5x5', () => {
  expect(GRID_SIZES).toEqual([3, 4, 5]);
  expect(isGridSize(4)).toBe(true);
  expect(isGridSize(2)).toBe(false);
  expect(isGridSize(6)).toBe(false);
});

test('a solved board has tile t in slot t', () => {
  expect(solvedBoard(3)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(solvedBoard(5)).toHaveLength(25);
  expect(isSolved(solvedBoard(4))).toBe(true);
  expect(isSolved([0, 2, 1, 3])).toBe(false);
});

test('isPermutation rejects a missing, duplicated, out-of-range or fractional tile', () => {
  expect(isPermutation([2, 0, 1])).toBe(true);
  expect(isPermutation([0, 0, 1])).toBe(false); // 2 missing, 0 twice
  expect(isPermutation([0, 1, 3])).toBe(false); // 3 is out of range
  expect(isPermutation([0, -1, 1])).toBe(false);
  expect(isPermutation([0, 1.5, 1])).toBe(false);
});

test('permutationParity counts inversions', () => {
  expect(permutationParity([0, 1, 2])).toBe(0);
  expect(permutationParity([1, 0, 2])).toBe(1); // one swap
  expect(permutationParity([1, 2, 0])).toBe(0); // a 3-cycle is two swaps
  expect(permutationParity([3, 2, 1, 0])).toBe(0); // 6 inversions
  expect(permutationParity([1, 2, 3, 0])).toBe(1); // a 4-cycle is three swaps
});

test('minSwapsToSolve is tiles minus cycles', () => {
  expect(minSwapsToSolve([0, 1, 2])).toBe(0);
  expect(minSwapsToSolve([1, 0, 2])).toBe(1);
  expect(minSwapsToSolve([1, 2, 0])).toBe(2);
  expect(minSwapsToSolve([1, 0, 3, 2])).toBe(2); // two 2-cycles
  expect(minSwapsToSolve([1, 2, 3, 0])).toBe(3);
});

test('the swap count always has the parity of the permutation (two independent computations agree)', () => {
  const rng = mulberry32(11);
  for (const size of GRID_SIZES) {
    for (let i = 0; i < 300; i++) {
      const board = solvedBoard(size);
      shuffleArray(board, rng);
      expect(minSwapsToSolve(board) % 2).toBe(permutationParity(board));
    }
  }
});

test('putting each tile home in turn solves the board in exactly minSwapsToSolve swaps', () => {
  const rng = mulberry32(3);
  for (let i = 0; i < 100; i++) {
    const board = solvedBoard(5);
    shuffleArray(board, rng);
    const expected = minSwapsToSolve(board);
    let swaps = 0;
    for (let slot = 0; slot < board.length; slot++) {
      if (board[slot] === slot) continue;
      expect(swapSlots(board, slot, board.indexOf(slot))).toBe(true);
      swaps++;
    }
    expect(isSolved(board)).toBe(true);
    expect(swaps).toBe(expected);
  }
});

test('isSolvable needs the right length and every tile exactly once', () => {
  expect(isSolvable([1, 0, 2, 3, 4, 5, 6, 7, 8], 3)).toBe(true);
  // Odd parity is still solvable when any two tiles may be swapped.
  expect(permutationParity([1, 0, 2, 3, 4, 5, 6, 7, 8])).toBe(1);
  expect(isSolvable(solvedBoard(4), 3)).toBe(false); // 16 tiles on a 3x3 board
  expect(isSolvable([0, 0, 2, 3, 4, 5, 6, 7, 8], 3)).toBe(false); // tile 1 missing
});

test('every deal at every size is solvable, unsolved and at least minScramble swaps away', () => {
  const rng = mulberry32(42);
  for (const size of GRID_SIZES) {
    for (let round = 0; round < 200; round++) {
      const board = dealBoard(size, rng);
      expect(isSolvable(board, size)).toBe(true);
      expect(isSolved(board)).toBe(false);
      expect(minSwapsToSolve(board)).toBeGreaterThanOrEqual(minScramble(size));
    }
  }
});

test('minScramble is half the tiles, rounded down', () => {
  expect(minScramble(3)).toBe(4);
  expect(minScramble(4)).toBe(8);
  expect(minScramble(5)).toBe(12);
});

test('an RNG that never moves a tile still gets a full scramble: every tile rotated one slot', () => {
  // floor(0.999999 * (i + 1)) === i, so every Fisher-Yates step is a no-op and
  // all 20 attempts come back solved.
  for (const size of GRID_SIZES) {
    const board = dealBoard(size, () => 0.999999);
    const n = size * size;
    expect(board).toEqual(Array.from({ length: n }, (_, slot) => (slot + 1) % n));
    expect(minSwapsToSolve(board)).toBe(n - 1);
  }
});

test('swapSlots swaps two 0-based slots', () => {
  const board = [0, 1, 2, 3];
  expect(swapSlots(board, 0, 3)).toBe(true);
  expect(board).toEqual([3, 1, 2, 0]);
});

test('swapSlots refuses an out-of-range, fractional or identical slot and changes nothing', () => {
  const board = [0, 1, 2, 3];
  expect(swapSlots(board, -1, 2)).toBe(false);
  expect(swapSlots(board, 0, 4)).toBe(false);
  expect(swapSlots(board, 0.5, 2)).toBe(false);
  expect(swapSlots(board, 2, 2)).toBe(false);
  expect(board).toEqual([0, 1, 2, 3]);
});

test('tileUvs crops the corner tiles of a 5x5 split (bottom-left vertex first, v = 1 at the top)', () => {
  // Tile 0 is the top-left fifth: u 0..0.2, v 0.8..1.
  expect(tileUvs(0, 5)).toEqual([0, 0.8, 0, 1, 0.2, 1, 0.2, 0.8]);
  // Tile 24 is the bottom-right fifth: u 0.8..1, v 0..0.2.
  const last = tileUvs(24, 5);
  const expected = [0.8, 0, 0.8, 0.2, 1, 0.2, 1, 0];
  last.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 12));
});

test('tileUvs crops the centre of a 3x3 split to the middle third', () => {
  const uv = tileUvs(4, 3);
  const expected = [1 / 3, 1 / 3, 1 / 3, 2 / 3, 2 / 3, 2 / 3, 2 / 3, 1 / 3];
  uv.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 12));
});

test('tileUvs tiles the whole texture edge to edge at every size, with no gap or overlap', () => {
  const rect = (tile: number, size: GridSize) => {
    const [u0, vBottom, , vTop, u1] = tileUvs(tile, size);
    return { u0, u1, vTop, vBottom };
  };
  for (const size of GRID_SIZES) {
    let area = 0;
    for (let tile = 0; tile < size * size; tile++) {
      const r = rect(tile, size);
      expect(r.u1).toBeGreaterThan(r.u0);
      expect(r.vTop).toBeGreaterThan(r.vBottom);
      area += (r.u1 - r.u0) * (r.vTop - r.vBottom);
      const col = tile % size;
      const row = Math.floor(tile / size);
      if (col < size - 1) expect(rect(tile + 1, size).u0).toBeCloseTo(r.u1, 12); // right neighbour
      if (row < size - 1) expect(rect(tile + size, size).vTop).toBeCloseTo(r.vBottom, 12); // neighbour below
      if (col === 0) expect(r.u0).toBe(0);
      if (col === size - 1) expect(r.u1).toBe(1);
      if (row === 0) expect(r.vTop).toBe(1);
      if (row === size - 1) expect(r.vBottom).toBeCloseTo(0, 12);
    }
    expect(area).toBeCloseTo(1, 12);
  }
});
