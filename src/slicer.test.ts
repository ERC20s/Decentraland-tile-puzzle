import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  DIFFICULTIES,
  PUZZLE_IMAGES,
  computeTileUvs,
  buildFaces,
  buildBoard,
  fillBoard,
  tileSize,
  findDifficulty,
  findImage,
  DEFAULT_LAYOUT
} from './slicer'
import { BoxInfo, TileFace, checkIfOriginalImages, resetPuzzle, swapTiles, tileKey } from './puzzle'

describe('computeTileUvs', () => {
  it('returns the whole texture for a 1x1 grid', () => {
    expect(computeTileUvs(0, 0, 1, 1)).toEqual([0, 0, 0, 1, 1, 1, 1, 0])
  })

  it('maps the top-left cell of a 2x2 grid to the top-left quarter of the image', () => {
    // order is bottom-left, top-left, top-right, bottom-right; v = 0 is the
    // bottom of the texture, so the top row of the puzzle uses v in [0.5, 1]
    expect(computeTileUvs(0, 0, 2, 2)).toEqual([0, 0.5, 0, 1, 0.5, 1, 0.5, 0.5])
  })

  it('maps the bottom-right cell of a 2x2 grid to the bottom-right quarter', () => {
    expect(computeTileUvs(1, 1, 2, 2)).toEqual([0.5, 0, 0.5, 0.5, 1, 0.5, 1, 0])
  })

  it('keeps every uv inside [0,1] and every cell distinct for each difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const seen = new Set<string>()
      for (let row = 0; row < difficulty.rows; row++) {
        for (let col = 0; col < difficulty.cols; col++) {
          const uvs = computeTileUvs(row, col, difficulty.rows, difficulty.cols)
          expect(uvs.length).toBe(8)
          for (const v of uvs) {
            expect(Number.isFinite(v)).toBe(true)
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThanOrEqual(1)
          }
          seen.add(uvs.join(','))
        }
      }
      expect(seen.size).toBe(difficulty.rows * difficulty.cols)
    }
  })

  it('rejects cells outside the grid and impossible grids', () => {
    expect(() => computeTileUvs(3, 0, 3, 3)).toThrow()
    expect(() => computeTileUvs(0, -1, 3, 3)).toThrow()
    expect(() => computeTileUvs(0, 0, 0, 3)).toThrow()
  })
})

describe('buildFaces / buildBoard', () => {
  it('produces one unique face per cell, all from the same source image', () => {
    const faces = buildFaces('scene.png', 4, 4)
    expect(faces.length).toBe(16)
    expect(new Set(faces.map((f: TileFace) => f.id)).size).toBe(16)
    for (const face of faces) expect(face.src).toBe('scene.png')
  })

  it('builds a solved board whose size and positions come from the grid', () => {
    for (const difficulty of DIFFICULTIES) {
      const board = buildBoard('scene.png', difficulty.rows, difficulty.cols)
      expect(board.length).toBe(difficulty.rows * difficulty.cols)

      const width = tileSize(DEFAULT_LAYOUT.boardSize, difficulty.cols, DEFAULT_LAYOUT.gap)
      expect(board[0].box.width).toBe(width)
      expect(board[0].box.top).toBe(DEFAULT_LAYOUT.originTop)
      expect(board[0].box.left).toBe(DEFAULT_LAYOUT.originLeft)

      // indices are 1-based and contiguous, as swapTiles expects
      board.forEach((box: BoxInfo, i: number) => expect(box.box.index).toBe(i + 1))

      // the board fits the panel it is drawn in
      const last = board[board.length - 1]
      expect(last.box.left + last.box.width).toBeLessThanOrEqual(DEFAULT_LAYOUT.originLeft + DEFAULT_LAYOUT.boardSize)
      expect(last.box.top + last.box.height).toBeLessThanOrEqual(DEFAULT_LAYOUT.originTop + DEFAULT_LAYOUT.boardSize)
      expect(last.box.top + last.box.height).toBeLessThanOrEqual(600)
    }
  })

  it('fillBoard replaces the contents of the board array in place', () => {
    const board: BoxInfo[] = []
    fillBoard(board, buildBoard('scene.png', 3, 3))
    const sameArray = board
    expect(board.length).toBe(9)
    fillBoard(board, buildBoard('scene.png', 5, 5))
    expect(board.length).toBe(25)
    expect(board).toBe(sameArray)
  })
})

describe('shuffling and win detection on a sliced board', () => {
  it('shuffles pieces of one image and detects the solved order again', () => {
    const board = buildBoard('scene.png', 3, 3)
    const faces = buildFaces('scene.png', 3, 3)
    const solved = board.map((b: BoxInfo) => tileKey(b))

    expect(checkIfOriginalImages(board, solved)).toBe(true)

    resetPuzzle(board, faces.slice())
    // every tile still shows the same source image, so only the uv windows
    // (face ids) can tell a shuffled board from a solved one
    for (const box of board) expect(box.box.image).toBe('scene.png')
    expect(checkIfOriginalImages(board, solved)).toBe(false)

    // swapping back to the solved order wins
    const order = board.map((b: BoxInfo) => tileKey(b))
    for (let i = 0; i < solved.length; i++) {
      if (order[i] === solved[i]) continue
      const j = order.indexOf(solved[i], i + 1)
      swapTiles(board, i + 1, j + 1)
      const tmp = order[i]
      order[i] = order[j]
      order[j] = tmp
    }
    expect(checkIfOriginalImages(board, solved)).toBe(true)
    // the uv window travelled with the piece
    board.forEach((box: BoxInfo, i: number) => expect(box.box.uvs).toEqual(computeTileUvs(Math.floor(i / 3), i % 3, 3, 3)))
  })

  it('works the same way at 5x5', () => {
    const board = buildBoard('scene.png', 5, 5)
    const faces = buildFaces('scene.png', 5, 5)
    const solved = board.map((b: BoxInfo) => tileKey(b))
    resetPuzzle(board, faces.slice())
    expect(board.length).toBe(25)
    expect(checkIfOriginalImages(board, solved)).toBe(false)
  })
})

describe('selectable pictures', () => {
  it('offers at least two pictures and at least two grid sizes', () => {
    expect(PUZZLE_IMAGES.length).toBeGreaterThanOrEqual(2)
    expect(DIFFICULTIES.length).toBeGreaterThanOrEqual(2)
    expect(DIFFICULTIES.some((d) => d.rows === 3 && d.cols === 3)).toBe(true)
    expect(DIFFICULTIES.some((d) => d.rows > 3)).toBe(true)
  })

  it('every selectable picture is a file that exists in the repository', () => {
    for (const image of PUZZLE_IMAGES) {
      const file = path.join(__dirname, '..', ...image.src.split('/'))
      expect(fs.existsSync(file), `missing puzzle image: ${image.src}`).toBe(true)
    }
  })

  it('falls back to the first entry for unknown ids', () => {
    expect(findDifficulty('nope').id).toBe(DIFFICULTIES[0].id)
    expect(findImage('nope').id).toBe(PUZZLE_IMAGES[0].id)
  })

  it('gives different pictures different face ids at the same grid size', () => {
    const a = buildFaces(PUZZLE_IMAGES[0].src, 3, 3).map((f) => f.id)
    const b = buildFaces(PUZZLE_IMAGES[1].src, 3, 3).map((f) => f.id)
    for (const id of a) expect(b.includes(id)).toBe(false)
  })
})

describe('legacy image-url boards still behave as before', () => {
  it('resetPuzzle with plain strings leaves no slicing fields behind', () => {
    const board = buildBoard('scene.png', 3, 3)
    resetPuzzle(board, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
    for (const box of board) {
      expect(box.box.uvs).toBeUndefined()
      expect(box.box.faceId).toBeUndefined()
      expect(tileKey(box)).toBe(box.box.image)
    }
  })
})
