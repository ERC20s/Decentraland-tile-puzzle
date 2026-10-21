// The puzzle pictures. Each one is a SINGLE square image: the board slices it
// into 3x3, 4x4 or 5x5 tiles at runtime (see tileUvs in src/puzzle.ts), so
// there are no per-tile files to cut by hand.
//
// To add a picture, put a square PNG in images/puzzles/ and add its path
// below; src/assets.test.ts fails if a PNG there is missing from this list.
export const PUZZLE_IMAGES: readonly string[] = ['images/puzzles/genesis-city.png'];
