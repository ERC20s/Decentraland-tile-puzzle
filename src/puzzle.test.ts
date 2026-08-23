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
  const before = arr.slice();
  shuffleArray(arr, makeCycleRng([0.5, 0.4, 0.3, 0.2]));
  expect(arr.sort()).toEqual(before.sort());
  expect(arr.length).toBe(before.length);
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
  const rngValues = [0.0, 0.2, 0.4, 0.6, 0.8, // first attempt yields identity-like picks
                     0.5, 0.4, 0.3, 0.2, 0.1]; // second attempt different
  resetPuzzle(boxes, images, makeCycleRng(rngValues));
  const after = boxes.map(b => b.box.image);
  // Assert that at least one tile changed from original (i.e., retry succeeded)
  let changed = false;
  for (let i = 0; i < after.length; i++) {
    if (after[i] !== original[i]) {
      changed = true;
      break;
    }
  }
  expect(changed).toBe(true);
});

// New deterministic fallback test: RNG that always produces identical shuffles
// ensures resetPuzzle makes a minimal deterministic change instead of no-op.

test('resetPuzzle makes minimal deterministic change when repeated shuffles match current board', () => {
  const {boxes, images, original} = makeBoxesAndImages();
  // Force boxes to a known state equal to original
  for (let i = 0; i < boxes.length; i++) boxes[i].box.image = original[i];

  // RNG that always returns 0 causes identical shuffle attempts every time
  const alwaysZeroRng = makeCycleRng([0]);
  resetPuzzle(boxes, images, alwaysZeroRng);
  const after = boxes.map(b => b.box.image);

  // Because images include at least two distinct values, the deterministic
  // fallback should have swapped two differing entries so board must change.
  let changed = false;
  for (let i = 0; i < after.length; i++) {
    if (after[i] !== original[i]) {
      changed = true;
      break;
    }
  }
  expect(changed).toBe(true);
});
