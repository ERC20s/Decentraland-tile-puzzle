import { describe, it } from 'vitest'
import fs from 'fs'
import path from 'path'

function collectSourceFiles(dir: string, out: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      collectSourceFiles(full, out)
    } else if (e.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      out.push(full)
    }
  }
}

const NUMERIC_RE = /[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/g
const NUMERIC_SINGLE_RE = new RegExp(`^[+-]?(?:\\d+\\.\\d*|\\.\\d+|\\d+)(?:[eE][+-]?\\d+)?$`)

function extractBracedBlocks(content: string): string[] {
  const blocks: string[] = []
  // naive scan for {...} blocks up to a reasonable depth; this is simple and good enough for small source files
  let i = 0
  while (i < content.length) {
    const open = content.indexOf('{', i)
    if (open === -1) break
    let depth = 1
    let j = open + 1
    while (j < content.length && depth > 0) {
      const ch = content[j]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      j++
    }
    if (depth === 0) {
      blocks.push(content.slice(open, j))
      i = j
    } else break
  }
  return blocks
}

function findNumericQuatInBlock(block: string): { x: number; y: number; z: number; w: number } | null {
  // quick check for presence of keys
  if (!/\bx\s*:\s*/.test(block) || !/\by\s*:\s*/.test(block) || !/\bz\s*:\s*/.test(block) || !/\bw\s*:\s*/.test(block)) {
    return null
  }

  // try to extract numeric literal for each component; we only accept plain numeric literals
  function getNum(key: string): number | null {
    const re = new RegExp(`\\b${key}\\s*:\\s*(${NUMERIC_RE.source})`)
    const m = block.match(re)
    if (!m) return null
    const s = m[1]
    if (!NUMERIC_SINGLE_RE.test(s)) return null
    const v = Number(s)
    return Number.isFinite(v) ? v : v // allow non-finite here; caller will detect
  }

  const x = getNum('x')
  const y = getNum('y')
  const z = getNum('z')
  const w = getNum('w')
  if (x === null || y === null || z === null || w === null) return null
  return { x, y, z, w }
}

describe('source quaternion literals should be finite and non-zero', () => {
  it('scans src/**/*.ts and src/**/*.tsx for quaternion object literals and rejects invalid ones', () => {
    const srcDir = path.join(__dirname)
    const files: string[] = []
    collectSourceFiles(srcDir, files)

    const candidates: Array<{ file: string; q: any; snippet: string; context: string }> = []

    for (const f of files) {
      const raw = fs.readFileSync(f, 'utf8')
      // prefer explicit rotation: contexts to reduce false positives
      const rotationRe = /rotation\s*:\s*\{([\s\S]*?)\}/g
      let m: RegExpExecArray | null
      let foundAny = false
      while ((m = rotationRe.exec(raw)) !== null) {
        foundAny = true
        const block = '{' + m[1] + '}'
        const q = findNumericQuatInBlock(block)
        if (q) {
          candidates.push({ file: path.relative(process.cwd(), f), q, snippet: block, context: 'rotation' })
        }
      }

      if (!foundAny) {
        // fallback: scan all braced blocks and look for numeric x/y/z/w
        const blocks = extractBracedBlocks(raw)
        for (const b of blocks) {
          const q = findNumericQuatInBlock(b)
          if (q) candidates.push({ file: path.relative(process.cwd(), f), q, snippet: b.slice(0, 200), context: 'any' })
        }
      }
    }

    const invalids: Array<{ file: string; q: any; reason: string; context: string }> = []

    for (const c of candidates) {
      const q = c.q
      // check each component is a number and finite
      if (typeof q.x !== 'number' || typeof q.y !== 'number' || typeof q.z !== 'number' || typeof q.w !== 'number' || !Number.isFinite(q.x) || !Number.isFinite(q.y) || !Number.isFinite(q.z) || !Number.isFinite(q.w)) {
        invalids.push({ file: c.file, q, reason: 'non-finite component or non-number', context: c.context })
        continue
      }

      const normSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w
      const norm = Math.sqrt(normSq)
      if (!Number.isFinite(norm) || norm <= Number.EPSILON) {
        invalids.push({ file: c.file, q, reason: 'zero-length quaternion (all-zero) or non-finite norm', context: c.context })
      }
    }

    if (invalids.length > 0) {
      const lines = invalids.map((iv, i) => `${i + 1}) file=${iv.file} context=${iv.context} reason=${iv.reason} q=${JSON.stringify(iv.q)}`)
      throw new Error('Found invalid quaternion literals in source:\n' + lines.join('\n'))
    }
  })
})
