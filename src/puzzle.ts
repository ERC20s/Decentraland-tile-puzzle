export interface BoxInfo {
  box: {
    index: number;
    height: number;
    width: number;
    text: string;
    image: string;
    top: number;
    left: number;
    click: string;
  };
}

export const createBox = (index: number, top: number, left: number, image: string): BoxInfo => ({
  box: {
    index: index,
    height: 100,
    width: 100,
    text: "",
    image: image,
    top: top,
    left: left,
    click: "",
  },
});

// In-place Fisher-Yates shuffle
export const shuffleArray = <T>(array: T[]): void => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

// Return true iff boxes' images match originalImages elementwise
export const checkIfOriginalImages = (boxes: BoxInfo[], originalImages: string[]): boolean => {
  if (boxes.length !== originalImages.length) return false;
  for (let i = 0; i < boxes.length; i++) {
    if (boxes[i].box.image !== originalImages[i]) return false;
  }
  return true;
};

// Shuffle imageUrls without mutating the supplied array and assign to boxes images
export const resetPuzzle = (boxes: BoxInfo[], imageUrls: string[]): void => {
  // Fail fast if there are not enough images for the boxes
  if (imageUrls.length < boxes.length) {
    throw new Error('resetPuzzle requires imageUrls.length >= boxes.length');
  }

  // Work on a copy so callers' arrays are not mutated
  const maxAttempts = 10;
  let shuffled = imageUrls.slice();
  let toAssign: string[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // copy here so each shuffle attempt starts from original imageUrls
    shuffled = imageUrls.slice();
    shuffleArray(shuffled);
    toAssign = shuffled.slice(0, boxes.length);

    // check if this assignment is identical to the current boxes' images
    let identical = true;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].box.image !== toAssign[i]) {
        identical = false;
        break;
      }
    }

    if (!identical) break;
    // otherwise retry up to maxAttempts
  }

  // assign whatever toAssign we have (may be identical if all attempts matched)
  for (let i = 0; i < boxes.length; i++) {
    boxes[i].box.image = toAssign[i];
  }
};

// Swap images between two boxes by 1-based index i and j (matches existing ui behavior)
export const swapTiles = (boxes: BoxInfo[], iIndex: number, jIndex: number): void => {
  const i = iIndex - 1;
  const j = jIndex - 1;
  if (i < 0 || j < 0 || i >= boxes.length || j >= boxes.length) return;
  [boxes[i].box.image, boxes[j].box.image] = [boxes[j].box.image, boxes[i].box.image];
};
