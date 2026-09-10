import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, extname } from 'path'
import { normalizeQuaternionOrIdentity } from './quat'

function walk(dir: string): string[] {
  const res: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) res.push(...walk(p))
    else res.push(p)
  }
  return res
}

// copied from src/transform-rotation.test.ts to keep behaviour consistent
function stripCommentsAndStrings(s: string): string {
  const out: string[] = []
  let i = 0
  const n = s.length
  let state: 'none' | 'squote' | 'dquote' | 'bquote' | 'line' | 'block' = 'none'
  while (i < n) {
    const ch = s[i]
    if (state === 'none') {
      if (ch === "'") { out.push(' '); state = 'squote'; i++; continue }
      if (ch === '"') { out.push(' '); state = 'dquote'; i++; continue }
      if (ch === '`') { out.push(' '); state = 'bquote'; i++; continue }
      if (ch === '/' && s[i+1] === '/') { out.push('  '); state = 'line'; i += 2; continue }
      if (ch === '/' && s[i+1] === '*') { out.push('  '); state = 'block'; i += 2; continue }
      out.push(ch)
      i++
      continue
    }

    if (state === 'squote') {
      if (ch === "\\") { out.push('  '); i += 2; continue }
      if (ch === "'") { out.push(' '); state = 'none'; i++; continue }
      out.push(' ')
      i++
      continue
    }

    if (state === 'dquote') {
      if (ch === "\\") { out.push('  '); i += 2; continue }
      if (ch === '"') { out.push(' '); state = 'none'; i++; continue }
      out.push(' ')
      i++
      continue
    }

    if (state === 'bquote') {
      if (ch === "\\") { out.push('  '); i += 2; continue }
      if (ch === '`') { out.push(' '); state = 'none'; i++; continue }
      if (ch === '$' && s[i+1] === '{') { out.push('  '); i += 2;
        while (i < n && s[i] !== '}') { out.push(' '); i++ }
        if (i < n && s[i] === '}') { out.push(' '); i++ }
        continue
      }
      out.push(' ')
      i++
      continue
    }

    if (state === 'line') {
      if (ch === '\n') { out.push('\n'); state = 'none'; i++; continue }
      out.push(' ')
      i++
      continue
    }

    if (state === 'block') {
      if (ch === '*' && s[i+1] === '/') { out.push('  '); state = 'none'; i += 2; continue }
      if (ch === '\n') out.push('\n')
      else out.push(' ')
      i++
      continue
    }
  }
  return out.join('')
}

function isTestFile(path: string) {
  return /\.test\.(ts|tsx)$/.test(path)
}

describe('ban inline quaternion numeric literals with w === 0 or all-zero components', () => {
  it('scans src/ for object literals with numeric x,y,z,w and fails on offending values', () => {
    const files = walk(join(__dirname))
      .filter((f) => ['.ts', '.tsx'].includes(extname(f)))
      .filter((f) => !isTestFile(f))

    const problemLines: Array<{ file: string; line: number; col: number; snippet: string; reason: string }> = []

    // number literal matcher (simple): integers, decimals, exponents, optional sign
    const num = '([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)'
    const propRe = (name: string) => new RegExp(`\\b${name}\\s*:\\s*${num}`)

    for (const file of files) {
      const raw = readFileSync(file, 'utf8')
      const cleaned = stripCommentsAndStrings(raw)

      // find occurrences of x: ... as anchors; for each anchor, grab the surrounding {...}
      const anchor = /\bx\s*:/g
      let m: RegExpExecArray | null
      while ((m = anchor.exec(cleaned)) !== null) {
        const idx = m.index
        const openIdx = cleaned.lastIndexOf('{', idx)
        const closeIdx = cleaned.indexOf('}', idx)
        if (openIdx === -1 || closeIdx === -1) continue
        const span = cleaned.slice(openIdx, closeIdx + 1)

        const mx = propRe('x').exec(span)
        const my = propRe('y').exec(span)
        const mz = propRe('z').exec(span)
        const mw = propRe('w').exec(span)
        if (!mx || !my || !mz || !mw) continue

        const x = Number(mx[1])
        const y = Number(my[1])
        const z = Number(mz[1])
        const w = Number(mw[1])
        const originalIsIdentity = Object.is(x, 0) && Object.is(y, 0) && Object.is(z, 0) && Object.is(w, 1)
        const wZero = Object.is(w, 0)

        // Use the runtime normalization to detect tiny or otherwise invalid
        // quaternions that would be treated as the identity at runtime. Do not
        // flag the explicit identity literal {0,0,0,1} which is acceptable.
        const normalized = normalizeQuaternionOrIdentity({ x, y, z, w })
        const becameIdentity = Object.is(normalized.x, 0) && Object.is(normalized.y, 0) && Object.is(normalized.z, 0) && Object.is(normalized.w, 1)

        if (!originalIsIdentity && (wZero || becameIdentity)) {
          // Determine line and column using the cleaned buffer index of the opening brace
          const before = cleaned.slice(0, openIdx)
          const line = before.split('\n').length
          const col = openIdx - before.lastIndexOf('\n')
          const snippet = raw.slice(Math.max(0, openIdx - 40), Math.min(raw.length, closeIdx + 40)).replace(/\n/g, '↵')
          const reason = becameIdentity ? 'normalizes to identity (tiny or invalid norm)' : 'w is zero'
          problemLines.push({ file, line, col, snippet, reason })
        }

        // advance anchor position to avoid reprocessing the same brace pair
        anchor.lastIndex = closeIdx + 1
      }
    }

    if (problemLines.length > 0) {
      const msgs = problemLines.map((p) => `${p.file}:${p.line}:${p.col}: (${p.reason}) ${p.snippet}`)
      expect(problemLines.length, `Found inline quaternion numeric literal problems:\n${msgs.join('\n')}\n\nPlease replace the literal with a normalized quaternion (e.g. use normalizeQuaternionOrIdentity) or compute it at runtime. Avoid inline numeric quaternion literals.`).toBe(0)
    }
  })
})
