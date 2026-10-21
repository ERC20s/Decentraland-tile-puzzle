// Pure puzzle rules: no SDK imports, so everything here runs (and is tested)
// in plain Node.
//
// A board is a permutation of tile ids: board[slot] is the tile drawn in that
// slot, and tile t belongs in slot t. Slots and tiles are both 0-based and
// row-major, so on an N x N grid slot s is row floor(s / N), column s % N.

export type GridSize = 3 | 4 | 5;

// The difficulty levels the UI offers, easiest first.
export const GRID_SIZES: readonly GridSize[] = [3, 4, 5];

export const isGridSize = (n: number): n is GridSize => (GRID_SIZES as readonly number[]).includes(n);

export const solvedBoard = (size: GridSize): number[] => Array.from({ length: size * size }, (_, i) => i);

// In-place Fisher-Yates shuffle with injectable RNG (defaults to Math.random)
export const shuffleArray = <T>(array: T[], rng?: () => number): void => {
  const _rng = rng ? rng : Math.random;
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(_rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

// True iff every tile 0..length-1 appears exactly once.
export const isPermutation = (board: readonly number[]): boolean => {
  const seen = new Array<boolean>(board.length).fill(false);
  for (const tile of board) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= board.length || seen[tile]) return false;
    seen[tile] = true;
  }
  return true;
};

export const isSolved = (board: readonly number[]): boolean => board.every((tile, slot) => tile === slot);

// 0 for an even permutation, 1 for an odd one, from the inversion count.
export const permutationParity = (board: readonly number[]): 0 | 1 => {
  let inversions = 0;
  for (let i = 0; i < board.length; i++) {
    for (let j = i + 1; j < board.length; j++) {
      if (board[i] > board[j]) inversions++;
    }
  }
  return (inversions % 2) as 0 | 1;
};

// Fewest two-tile swaps that solve the board: tiles minus permutation cycles.
// Every swap flips the parity above, so this number always has that parity.
export const minSwapsToSolve = (board: readonly number[]): number => {
  const visited = new Array<boolean>(board.length).fill(false);
  let cycles = 0;
  for (let start = 0; start < board.length; start++) {
    if (visited[start]) continue;
    cycles++;
    for (let slot = start; !visited[slot]; slot = board[slot]) visited[slot] = true;
  }
  return board.length - cycles;
};

// Players may swap ANY two tiles, so every permutation can be solved (in
// minSwapsToSolve moves). Parity only rules out deals for a sliding puzzle,
// where moves are restricted to the blank. What makes a swap board unsolvable
// is a missing or duplicated tile, which is what this rejects.
export const isSolvable = (board: readonly number[], size: GridSize): boolean =>
  board.length === size * size && isPermutation(board);

// A deal must be at least this many swaps from solved, so even 3x3 never opens
// one or two moves from the finished picture.
export const minScramble = (size: GridSize): number => Math.floor((size * size) / 2);

// A fresh, solvable board at least minScramble(size) swaps from solved.
export const dealBoard = (size: GridSize, rng?: () => number): number[] => {
  const want = minScramble(size);
  for (let attempt = 0; attempt < 20; attempt++) {
    const board = solvedBoard(size);
    shuffleArray(board, rng);
    if (minSwapsToSolve(board) >= want) return board;
  }
  // A degenerate RNG (constant, or stuck near one value) can keep producing
  // near-solved boards. Rotating every tile one slot is a single cycle through
  // all of them: size * size - 1 swaps, always above the minimum.
  const solved = solvedBoard(size);
  return solved.map((_, slot) => solved[(slot + 1) % solved.length]);
};

// Swap the tiles in two 0-based slots. Returns false (and changes nothing) for
// an out-of-range slot or a slot swapped with itself.
export const swapSlots = (board: number[], a: number, b: number): boolean => {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 0 || b < 0 || a >= board.length || b >= board.length || a === b) return false;
  [board[a], board[b]] = [board[b], board[a]];
  return true;
};

// Texture coordinates of tile t's square in a size x size split of one source
// image, in the order SDK7's uiBackground.uvs expects: bottom-left, top-left,
// top-right, bottom-right (clockwise from bottom-left), with v = 1 at the TOP
// of the texture. Row 0 is the top row of the picture.
export const tileUvs = (tile: number, size: GridSize): number[] => {
  const row = Math.floor(tile / size);
  const col = tile % size;
  const u0 = col / size;
  const u1 = (col + 1) / size;
  const vTop = 1 - row / size;
  const vBottom = 1 - (row + 1) / size;
  return [u0, vBottom, u0, vTop, u1, vTop, u1, vBottom];
};
