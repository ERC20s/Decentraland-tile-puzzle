// A tile "face" is what a box shows: a source image plus, optionally, the
// rectangle of that image the box shows (uvs). When uvs are present the whole
// board can share ONE source image and still show a different piece per box,
// which is how the puzzle slices a picture at runtime instead of relying on
// pre-cut assets. `id` is the identity used for shuffling and win detection,
// because with a sliced image every box has the same `src`.
export interface TileFace {
  id: string;
  src: string;
  uvs?: number[];
}

// Legacy callers pass plain image URLs; both forms are accepted everywhere.
export type FaceLike = string | TileFace;

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
    // Present only for sliced boards.
    uvs?: number[];
    faceId?: string;
  };
}

export interface CreateBoxOptions {
  width?: number;
  height?: number;
  uvs?: number[];
  faceId?: string;
}

export const createBox = (
  index: number,
  top: number,
  left: number,
  image: string,
  opts?: CreateBoxOptions
): BoxInfo => ({
  box: {
    index: index,
    height: opts && typeof opts.height === 'number' ? opts.height : 100,
    width: opts && typeof opts.width === 'number' ? opts.width : 100,
    text: "",
    image: image,
    top: top,
    left: left,
    click: "",
    uvs: opts ? opts.uvs : undefined,
    faceId: opts ? opts.faceId : undefined,
  },
});

// The identity of what a box currently shows. For a sliced board that is the
// face id (same src, different uvs); for a legacy board it is the image URL,
// so existing behaviour is unchanged.
export const tileKey = (box: BoxInfo): string =>
  box.box.faceId !== undefined ? box.box.faceId : box.box.image;

export const normalizeFace = (face: FaceLike): TileFace =>
  typeof face === 'string' ? { id: face, src: face } : face;

// Put a face on a box. A plain string clears the slicing fields so a legacy
// board never grows a stale faceId/uvs pair.
export const applyFace = (box: BoxInfo, face: FaceLike): void => {
  const f = normalizeFace(face);
  box.box.image = f.src;
  if (typeof face === 'string') {
    box.box.uvs = undefined;
    box.box.faceId = undefined;
  } else {
    box.box.uvs = f.uvs;
    box.box.faceId = f.id;
  }
};

// In-place Fisher-Yates shuffle with injectable RNG (defaults to Math.random)
export const shuffleArray = <T>(array: T[], rng?: () => number): void => {
  const _rng = rng ? rng : Math.random;
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(_rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

// Return true iff the boxes show, in order, the keys given as solved order.
// `originalKeys` are image URLs for a legacy board and face ids for a sliced one.
export const checkIfOriginalImages = (boxes: BoxInfo[], originalKeys: string[]): boolean => {
  if (boxes.length !== originalKeys.length) return false;
  for (let i = 0; i < boxes.length; i++) {
    if (tileKey(boxes[i]) !== originalKeys[i]) return false;
  }
  return true;
};

// Shuffle the faces without mutating the supplied array and assign them to the
// boxes. Accepts image URLs (legacy) or TileFace objects (sliced board).
// Accepts an optional rng to make shuffling deterministic for tests.
export const resetPuzzle = (boxes: BoxInfo[], faces: FaceLike[], rng?: () => number): void => {
  // Fail fast if there are not enough faces for the boxes
  if (faces.length < boxes.length) {
    throw new Error('resetPuzzle requires imageUrls.length >= boxes.length');
  }

  const keyOf = (face: FaceLike): string => normalizeFace(face).id;

  // Work on a copy so callers' arrays are not mutated
  const maxAttempts = 10;
  let shuffled = faces.slice();
  let toAssign: FaceLike[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // copy here so each shuffle attempt starts from the original faces
    shuffled = faces.slice();
    shuffleArray(shuffled, rng);
    toAssign = shuffled.slice(0, boxes.length);

    // check if this assignment is identical to what the boxes already show
    let identical = true;
    for (let i = 0; i < boxes.length; i++) {
      if (tileKey(boxes[i]) !== keyOf(toAssign[i])) {
        identical = false;
        break;
      }
    }

    if (!identical) break;
    // otherwise retry up to maxAttempts
  }

  // If after retries we still have an assignment identical to the current board,
  // and there exists at least one different-permutation possible, make a
  // deterministic minimal change so the Shuffle action is not a silent no-op.
  let stillIdentical = true;
  for (let i = 0; i < boxes.length; i++) {
    if (tileKey(boxes[i]) !== keyOf(toAssign[i])) {
      stillIdentical = false;
      break;
    }
  }

  if (stillIdentical && boxes.length >= 2) {
    // Try to find two indices with differing faces to swap.
    let swapped = false;
    for (let a = 0; a < toAssign.length - 1 && !swapped; a++) {
      for (let b = a + 1; b < toAssign.length; b++) {
        if (keyOf(toAssign[a]) !== keyOf(toAssign[b])) {
          const tmp = toAssign[a];
          toAssign[a] = toAssign[b];
          toAssign[b] = tmp;
          swapped = true;
          break;
        }
      }
    }
    // If no swap found, all faces are identical and we leave toAssign as-is.
  }

  // assign whatever toAssign we have (may be identical if all attempts matched)
  for (let i = 0; i < boxes.length; i++) {
    applyFace(boxes[i], toAssign[i]);
  }
};

// Swap the faces of two boxes by 1-based index i and j (matches existing ui behavior).
// The whole face travels: image, uvs and face id, so a sliced board swaps pieces
// rather than just image URLs.
export const swapTiles = (boxes: BoxInfo[], iIndex: number, jIndex: number): void => {
  const i = iIndex - 1;
  const j = jIndex - 1;
  if (i < 0 || j < 0 || i >= boxes.length || j >= boxes.length) return;
  [boxes[i].box.image, boxes[j].box.image] = [boxes[j].box.image, boxes[i].box.image];
  [boxes[i].box.uvs, boxes[j].box.uvs] = [boxes[j].box.uvs, boxes[i].box.uvs];
  [boxes[i].box.faceId, boxes[j].box.faceId] = [boxes[j].box.faceId, boxes[i].box.faceId];
};
