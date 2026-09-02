import { BoxInfo, TileFace, createBox } from './puzzle';

// Runtime image splitting.
//
// Nothing here cuts a file on disk: a UI background in SDK7 can show a
// sub-rectangle of a texture through `uvs`, so the board is built by giving
// every tile the SAME source image and a different uv window. Adding a new
// puzzle picture is therefore "drop a png in images/ and add one line to
// PUZZLE_IMAGES" - no manual slicing, no numbered tile files.

export interface Difficulty {
  id: string;
  label: string;
  rows: number;
  cols: number;
}

// Difficulty levels offered in the UI. Add a line here to offer another size;
// every other piece of the board (layout, uvs, win check) is computed from rows/cols.
export const DIFFICULTIES: Difficulty[] = [
  { id: '3x3', label: '3x3', rows: 3, cols: 3 },
  { id: '4x4', label: '4x4', rows: 4, cols: 4 },
  { id: '5x5', label: '5x5', rows: 5, cols: 5 },
];

export interface PuzzleImage {
  id: string;
  label: string;
  src: string;
}

// Pictures the player can choose. Each one is sliced at runtime into whatever
// grid the chosen difficulty asks for. Every src below is a file that already
// ships with this scene (see .dclignore - images/, models/ and scene.png are
// all deployed).
export const PUZZLE_IMAGES: PuzzleImage[] = [
  { id: 'scene', label: 'Scene', src: 'scene.png' },
  { id: 'grass', label: 'Grass', src: 'models/grass/Floor_Grass01.png.png' },
  { id: 'mosaic', label: 'Mosaic', src: 'images/image3x3.png' },
];

export const findDifficulty = (id: string): Difficulty => {
  for (const d of DIFFICULTIES) if (d.id === id) return d;
  return DIFFICULTIES[0];
};

export const findImage = (id: string): PuzzleImage => {
  for (const img of PUZZLE_IMAGES) if (img.id === id) return img;
  return PUZZLE_IMAGES[0];
};

// uv window for one cell, in the 4-corner form SDK7 ui backgrounds expect:
// [bottom-left, top-left, top-right, bottom-right] as x,y pairs, with v = 0 at
// the BOTTOM of the texture, so row 0 (the top row of the puzzle) maps to the
// top of the image.
export const computeTileUvs = (row: number, col: number, rows: number, cols: number): number[] => {
  if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows < 1 || cols < 1) {
    throw new Error('computeTileUvs requires rows >= 1 and cols >= 1');
  }
  if (row < 0 || col < 0 || row >= rows || col >= cols) {
    throw new Error(`computeTileUvs: cell ${row}x${col} is outside a ${rows}x${cols} grid`);
  }
  const uLeft = col / cols;
  const uRight = (col + 1) / cols;
  const vTop = 1 - row / rows;
  const vBottom = 1 - (row + 1) / rows;
  return [uLeft, vBottom, uLeft, vTop, uRight, vTop, uRight, vBottom];
};

// One face per cell, in reading order (left to right, top to bottom). The id
// carries the source and the cell, so two different pictures never collide and
// win detection can compare ids instead of image URLs.
export const buildFaces = (src: string, rows: number, cols: number): TileFace[] => {
  const faces: TileFace[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      faces.push({
        id: `${src}#r${row}c${col}`,
        src: src,
        uvs: computeTileUvs(row, col, rows, cols),
      });
    }
  }
  return faces;
};

export interface BoardLayout {
  boardSize: number;
  originTop: number;
  originLeft: number;
  gap: number;
}

// Fits inside the 800x600 puzzle panel in src/ui.tsx, below the button rows.
export const DEFAULT_LAYOUT: BoardLayout = {
  boardSize: 460,
  originTop: 118,
  originLeft: 100,
  gap: 6,
};

// Pixel size of a tile so that `count` tiles plus the gaps fill boardSize.
export const tileSize = (boardSize: number, count: number, gap: number): number => {
  if (count < 1) throw new Error('tileSize requires count >= 1');
  return Math.max(1, Math.floor((boardSize - gap * (count - 1)) / count));
};

// Build a solved board: box i shows face i, positions and sizes derived from
// the grid, never hardcoded.
export const buildBoard = (
  src: string,
  rows: number,
  cols: number,
  layout: BoardLayout = DEFAULT_LAYOUT
): BoxInfo[] => {
  const faces = buildFaces(src, rows, cols);
  const width = tileSize(layout.boardSize, cols, layout.gap);
  const height = tileSize(layout.boardSize, rows, layout.gap);
  const boxes: BoxInfo[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const face = faces[index];
      boxes.push(
        createBox(index + 1, layout.originTop + row * (height + layout.gap), layout.originLeft + col * (width + layout.gap), face.src, {
          width,
          height,
          uvs: face.uvs,
          faceId: face.id,
        })
      );
    }
  }
  return boxes;
};

// Replace the contents of an existing board array in place, so callers that
// hold a reference to the board (src/ui.tsx keeps a module-level one) keep
// seeing the same array after a difficulty or picture change.
export const fillBoard = (target: BoxInfo[], next: BoxInfo[]): BoxInfo[] => {
  target.splice(0, target.length);
  for (const box of next) target.push(box);
  return target;
};
