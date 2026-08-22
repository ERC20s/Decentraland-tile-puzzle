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

// Shuffle imageUrls in-place and assign to boxes images
export const resetPuzzle = (boxes: BoxInfo[], imageUrls: string[]): void => {
  shuffleArray(imageUrls);
  for (let i = 0; i < boxes.length; i++) {
    boxes[i].box.image = imageUrls[i];
  }
};

// Swap images between two boxes by 1-based index i and j (matches existing ui behavior)
export const swapTiles = (boxes: BoxInfo[], iIndex: number, jIndex: number): void => {
  const i = iIndex - 1;
  const j = jIndex - 1;
  if (i < 0 || j < 0 || i >= boxes.length || j >= boxes.length) return;
  [boxes[i].box.image, boxes[j].box.image] = [boxes[j].box.image, boxes[i].box.image];
};
