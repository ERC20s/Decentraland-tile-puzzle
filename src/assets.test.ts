import { describe, it } from 'vitest'
import fs from 'fs'
import path from 'path'

// The 25 numbered tile images used by src/ui.tsx
const TILE_IMAGES = [
  'images/image1x1.png', 'images/image2x1.png', 'images/image3x1.png', 'images/image4x1.png', 'images/image5x1.png',
  'images/image1x2.png', 'images/image2x2.png', 'images/image3x2.png', 'images/image4x2.png', 'images/image5x2.png',
  'images/image1x3.png', 'images/image2x3.png', 'images/image3x3.png', 'images/image4x3.png', 'images/image5x3.png',
  'images/image1x4.png', 'images/image2x4.png', 'images/image3x4.png', 'images/image4x4.png', 'images/image5x4.png',
  'images/image1x5.png', 'images/image2x5.png', 'images/image3x5.png', 'images/image4x5.png', 'images/image5x5.png',
]

const expectedPaths = [
  ...TILE_IMAGES,

  // win audio referenced in src/reward.ts
  'music/champ2.mp3',

  // models referenced in src/reward.ts and README
  'models/machine.glb',
  'models/grass/FloorBaseGrass_01.glb',
]

function repoPath(rel: string): string {
  return path.join(__dirname, '..', rel)
}

// A byte that could plausibly start a line of text. Every binary asset format we
// ship (PNG, MP3, GLB) has a non-text byte inside its first eight, so a stub that
// was saved as a text file with a binary extension is caught here.
function looksLikeText(head: Buffer): boolean {
  if (head.length === 0) return false
  for (const byte of head) {
    const printable = byte >= 0x20 && byte <= 0x7e
    const whitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d
    if (!printable && !whitespace) return false
  }
  return true
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function readHead(full: string, length: number): Buffer {
  const fd = fs.openSync(full, 'r')
  try {
    const buf = Buffer.alloc(length)
    const read = fs.readSync(fd, buf, 0, length, 0)
    return buf.subarray(0, read)
  } finally {
    fs.closeSync(fd)
  }
}

function report(label: string, problems: string[]): void {
  if (problems.length === 0) return
  const lines = problems.map((p, i) => `${i + 1}) ${p}`)
  throw new Error(`${label} (${problems.length}):\n${lines.join('\n')}`)
}

describe('referenced local asset files should exist in the repository', () => {
  it('checks that images, audio and model files referenced by the scene are present', () => {
    const missing: string[] = []
    for (const rel of expectedPaths) {
      if (!fs.existsSync(repoPath(rel))) missing.push(rel)
    }
    report('Missing referenced asset files', missing)
  })

  it('checks that every referenced asset holds real bytes, not an empty or text stub', () => {
    const problems: string[] = []
    for (const rel of expectedPaths) {
      const full = repoPath(rel)
      if (!fs.existsSync(full)) continue // the existence test above already reports this

      const size = fs.statSync(full).size
      if (size === 0) {
        problems.push(`${rel} is empty (0 bytes)`)
        continue
      }

      if (looksLikeText(readHead(full, 8))) {
        problems.push(`${rel} starts with plain text — it looks like a placeholder, not a binary asset`)
      }
    }
    report('Referenced asset files that are empty or placeholder stubs', problems)
  })

  it('checks that the 25 tile images are real PNG files', () => {
    const problems: string[] = []
    for (const rel of TILE_IMAGES) {
      const full = repoPath(rel)
      if (!fs.existsSync(full)) continue // the existence test above already reports this

      const head = readHead(full, PNG_SIGNATURE.length)
      if (!head.equals(PNG_SIGNATURE)) {
        problems.push(`${rel} does not start with the PNG signature (got ${head.toString('hex')})`)
      }
    }
    report('Tile images that are not valid PNG files', problems)
  })
})
