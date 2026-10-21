import { test, expect } from 'vitest';
import { createBox, shuffleArray, checkIfOriginalImages, resetPuzzle, swapTiles, BoxInfo } from './puzzle';

function makeBoxesAndImages(): {boxes: BoxInfo[]; images: string[]; original: string[]} {
  const imageUrls = [
    'a','b','c','d','e'
  ];
  const boxes: BoxInfo[] = [];
  for (let i = 0; i < 5; i++) {
    boxes.push(createBox(i+1, 0, 0, imageUrls[i]));
  }
  const original = boxes.map(b => b.box.image);
  const images = imageUrls.slice();
  return {boxes, images, original};
}

// simple deterministic RNG for tests: cycles through provided values
function makeCycleRng(values: number[]) {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
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

test('checkIfOriginalImages true only when equal', () => {
  const {boxes, images, original} = makeBoxesAndImages();
  expect(checkIfOriginalImages(boxes, original)).toBe(true);
  // change one
  boxes[0].box.image = 'z';
  expect(checkIfOriginalImages(boxes, original)).toBe(false);
});

test('swapTiles swaps exactly two tiles', () => {
  const {boxes} = makeBoxesAndImages();
  const before = boxes.map(b => b.box.image);
  swapTiles(boxes, 1, 3);
  const after = boxes.map(b => b.box.image);
  expect(after[0]).toBe(before[2]);
  expect(after[2]).toBe(before[0]);
  for (let i = 0; i < boxes.length; i++) {
    if (i !== 0 && i !== 2) expect(after[i]).toBe(before[i]);
  }
});

// New tests for swapTiles edge cases

test('swapTiles is no-op for invalid indices', () => {
  const {boxes} = makeBoxesAndImages();
  const before = boxes.map(b => b.box.image);
  // inputs are 1-based: 0, -1 and boxes.length+1 are invalid and should be ignored
  swapTiles(boxes, 0, 1);
  swapTiles(boxes, -1, 2);
  swapTiles(boxes, boxes.length + 1, 1);
  const after = boxes.map(b => b.box.image);
  expect(after).toEqual(before);
});

test('swapTiles with same indices leaves board unchanged', () => {
  const {boxes} = makeBoxesAndImages();
  const before = boxes.map(b => b.box.image);
  // swapping the same 1-based index should be a no-op
  swapTiles(boxes, 1, 1);
  swapTiles(boxes, 3, 3);
  const after = boxes.map(b => b.box.image);
  expect(after).toEqual(before);
});

test('resetPuzzle reshuffles and assigns images and does not mutate input array', () => {
  const {boxes, images, original} = makeBoxesAndImages();
  const imagesBefore = images.slice();
  resetPuzzle(boxes, images, makeCycleRng([0.6, 0.1, 0.2, 0.3]));
  // images should be a permutation of original values
  const after = boxes.map(b => b.box.image);
  expect(after.length).toBe(original.length);
  expect(after.sort()).toEqual(original.sort());
  // input images array should not have been mutated
  expect(images).toEqual(imagesBefore);
});

// New tests for resetPuzzle edge cases

test('resetPuzzle throws when imageUrls shorter than boxes', () => {
  const {boxes} = makeBoxesAndImages();
  const shortImages = ['a','b','c']; // length 3 < boxes.length 5
  expect(() => resetPuzzle(boxes, shortImages)).toThrow();
});

test('resetPuzzle accepts longer image array and uses first N shuffled images', () => {
  const {boxes, original} = makeBoxesAndImages();
  const longImages = ['a','b','c','d','e','f','g'];
  resetPuzzle(boxes, longImages, makeCycleRng([0.7, 0.4, 0.2, 0.1]));
  const after = boxes.map(b => b.box.image);
  // boxes should have length 5 and be made from first 7 values (but exactly 5 assigned)
  expect(after.length).toBe(5);
  // Each assigned image must be one of the provided images
  for (const img of after) {
    expect(longImages.includes(img)).toBe(true);
  }
});

// Deterministic test to ensure resetPuzzle avoids no-op shuffles when possible

test('resetPuzzle avoids perfect no-op shuffle when possible', () => {
  const {boxes, images, original} = makeBoxesAndImages();
  // Force boxes to a known state equal to original
  for (let i = 0; i < boxes.length; i++) boxes[i].box.image = original[i];

  // Use an RNG that will produce a shuffle identical to original on first attempt,
  // then a different shuffle on the second attempt so resetPuzzle must retry.
  // We craft values so that first shuffle picks indices producing the same order,
  // then subsequent values change it. For simplicity we use values producing j=0,1,2,3,4 etc.
  // 0.9 makes j === i at every step of a 5-element Fisher-Yates (4 draws), so
  // the first attempt reproduces the current board; the next four draws of 0
  // give a different order.
  const rngValues = [0.9, 0.9, 0.9, 0.9, // first attempt: identity
                     0.0, 0.0, 0.0, 0.0]; // second attempt: a real shuffle
  resetPuzzle(boxes, images, makeCycleRng(rngValues));
  const after = boxes.map(b => b.box.image);
  // Exactly the second attempt's order: the retry ran, and the fallback swap
  // (which would give b,a,c,d,e) did not.
  expect(after).toEqual(['b', 'c', 'd', 'e', 'a']);
});

// New deterministic fallback test: RNG that always produces identical shuffles
// ensures resetPuzzle makes a minimal deterministic change instead of no-op.

test('resetPuzzle makes minimal deterministic change when repeated shuffles match current board', () => {
  const {boxes, images, original} = makeBoxesAndImages();
  // Force boxes to a known state equal to original
  for (let i = 0; i < boxes.length; i++) boxes[i].box.image = original[i];

  // An RNG pinned just below 1 makes j === i at every step, so every shuffle
  // attempt reproduces the current (solved) board.
  const identityRng = makeCycleRng([0.999999]);
  resetPuzzle(boxes, images, identityRng);
  const after = boxes.map(b => b.box.image);

  // Because images include at least two distinct values, the deterministic
  // fallback swaps the first two differing entries.
  expect(after).toEqual(['b', 'a', 'c', 'd', 'e']);
  expect(checkIfOriginalImages(boxes, original)).toBe(false);
});

// Deterministic PRNG (mulberry32) so the property-style tests below are
// reproducible run to run.
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

function makeSolvedBoard(n: number): {boxes: BoxInfo[]; solved: string[]} {
  const solved: string[] = [];
  const boxes: BoxInfo[] = [];
  for (let i = 0; i < n; i++) {
    solved.push(`images/tile${i + 1}.png`);
    boxes.push(createBox(i + 1, 0, 0, solved[i]));
  }
  return {boxes, solved};
}

test('shuffling a solved 5x5 board never deals a solved board and keeps every tile', () => {
  const rng = mulberry32(42);
  for (let round = 0; round < 200; round++) {
    const {boxes, solved} = makeSolvedBoard(25);
    resetPuzzle(boxes, solved, rng);
    const after = boxes.map(b => b.box.image);
    expect(checkIfOriginalImages(boxes, solved)).toBe(false);
    expect([...after].sort()).toEqual([...solved].sort());
  }
});

test('a game: shuffle, then swap tiles back one move at a time until it is won', () => {
  const {boxes, solved} = makeSolvedBoard(25);
  resetPuzzle(boxes, solved, mulberry32(7));
  expect(checkIfOriginalImages(boxes, solved)).toBe(false);

  // Selection-sort the board with swapTiles (1-based, like the UI's clicks):
  // each move puts one tile home, so the win must arrive within 24 moves and
  // must not be reported before the last tile is placed.
  let moves = 0;
  for (let slot = 0; slot < boxes.length; slot++) {
    if (boxes[slot].box.image === solved[slot]) continue;
    const from = boxes.findIndex(b => b.box.image === solved[slot]);
    expect(checkIfOriginalImages(boxes, solved)).toBe(false);
    swapTiles(boxes, slot + 1, from + 1);
    moves++;
    expect(boxes[slot].box.image).toBe(solved[slot]);
  }
  expect(moves).toBeGreaterThan(0);
  expect(moves).toBeLessThanOrEqual(24);
  expect(checkIfOriginalImages(boxes, solved)).toBe(true);
});

test('a single swap away from solved is not a win, and swapping back is', () => {
  const {boxes, solved} = makeSolvedBoard(25);
  swapTiles(boxes, 12, 13);
  expect(checkIfOriginalImages(boxes, solved)).toBe(false);
  swapTiles(boxes, 13, 12);
  expect(checkIfOriginalImages(boxes, solved)).toBe(true);
});

test('checkIfOriginalImages is false when the board and the solution differ in length', () => {
  const {boxes, solved} = makeSolvedBoard(5);
  expect(checkIfOriginalImages(boxes, solved.slice(0, 4))).toBe(false);
  expect(checkIfOriginalImages(boxes.slice(0, 4), solved)).toBe(false);
});
