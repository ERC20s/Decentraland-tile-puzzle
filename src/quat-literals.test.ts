import { describe, it } from 'vitest'
import fs from 'fs'
import path from 'path'

// Conservative source scan for quaternion object literals in src/*.ts and src/*.tsx.
// We only attempt to interpret simple numeric literals; anything more complex
// (Math.cos(...), variables, function calls) is skipped so the test stays
// noise-free.

type Occurrence = { file: string; snippet: string; x: string; y: string; z: string; w: string }

function isNumericLiteralToken(s: string): boolean {
  const t = s.trim()
  // Matches decimals, integers, optional sign and exponent, or the identifiers Infinity/NaN
  return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(t) || /^Infinity$/.test(t) || /^-Infinity$/.test(t) || /^NaN$/.test(t)
}

function toNumberSafe(s: string): number {
  // Number('Infinity') => Infinity, Number('NaN') => NaN
  return Number(s.trim())
}

function findQuatObjectLiterals(src: string): Array<{ snippet: string; x: string; y: string; z: string; w: string }> {
  const out: Array<{ snippet: string; x: string; y: string; z: string; w: string }> = []
  // Non-greedy capture of an object literal that contains x:, y:, z:, w:
  const re = /\{[\s\S]*?\bx\s*:\s*([^,\n\}\)]+)[\s\S]*?\by\s*:\s*([^,\n\}\)]+)[\s\S]*?\bz\s*:\s*([^,\n\}\)]+)[\s\S]*?\bw\s*:\s*([^,\n\}\)]+)[\s\S]*?\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const snippet = m[0]
    const x = m[1]
    const y = m[2]
    const z = m[3]
    const w = m[4]
    out.push({ snippet, x, y, z, w })
  }
  return out
}

describe('source quaternion literals should not be all-zero or non-finite', () => {
  it('scans src/**/*.ts and src/**/*.tsx for quaternion object literals and flags invalid ones', () => {
    const srcDir = path.join(__dirname)
    const entries = fs.readdirSync(srcDir)
    const srcFiles = entries.filter((n) => n.endsWith('.ts') || n.endsWith('.tsx')).map((n) => path.join(srcDir, n))

    const found: Occurrence[] = []

    for (const file of srcFiles) {
      const raw = fs.readFileSync(file, 'utf8')
      const quats = findQuatObjectLiterals(raw)
      for (const q of quats) {
        found.push({ file, snippet: q.snippet, x: q.x.trim(), y: q.y.trim(), z: q.z.trim(), w: q.w.trim() })
      }
    }

    const invalids: Array<{ file: string; snippet: string; reason: string }> = []

    for (const occ of found) {
      const { x, y, z, w } = occ
      // Only interpret simple numeric literals; skip otherwise to avoid false positives
      if (!isNumericLiteralToken(x) || !isNumericLiteralToken(y) || !isNumericLiteralToken(z) || !isNumericLiteralToken(w)) {
        continue
      }

      const nx = toNumberSafe(x)
      const ny = toNumberSafe(y)
      const nz = toNumberSafe(z)
      const nw = toNumberSafe(w)

      if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz) || !Number.isFinite(nw)) {
        invalids.push({ file: occ.file, snippet: occ.snippet, reason: 'non-finite component (NaN or Infinity) or non-number' })
        continue
      }

      const normSq = nx * nx + ny * ny + nz * nz + nw * nw
      if (!Number.isFinite(normSq) || normSq <= Number.EPSILON) {
        invalids.push({ file: occ.file, snippet: occ.snippet, reason: `zero-length quaternion (normSq=${String(normSq)})` })
      }
    }

    if (invalids.length > 0) {
      const lines = invalids.map((iv, i) => `${i + 1}) file=${path.relative(process.cwd(), iv.file)} reason=${iv.reason} snippet=${iv.snippet}`)
      throw new Error(`Found invalid quaternion literals in source files:\n${lines.join('\n\n')}`)
    }
  })
})
