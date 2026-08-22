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

test('shuffleArray permutes elements', () => {
  const arr = [1,2,3,4,5];
  const before = arr.slice();
  shuffleArray(arr);
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

test('resetPuzzle reshuffles and assigns images and does not mutate input array', () => {
  const {boxes, images, original} = makeBoxesAndImages();
  const imagesBefore = images.slice();
  resetPuzzle(boxes, images);
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
  resetPuzzle(boxes, longImages);
  const after = boxes.map(b => b.box.image);
  // boxes should have length 5 and be made from first 7 values (but exactly 5 assigned)
  expect(after.length).toBe(5);
  // Each assigned image must be one of the provided images
  for (const img of after) {
    expect(longImages.includes(img)).toBe(true);
  }
});
