import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, extname } from 'path'

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

// Strip strings and comments so a naive search does not hit occurrences inside
// quoted text or comments. This is a small state machine that replaces those
// spans with spaces so indices and line numbers remain stable.
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

    // inside single-quoted string
    if (state === 'squote') {
      if (ch === "\\") { out.push('  '); i += 2; continue } // escape + char
      if (ch === "'") { out.push(' '); state = 'none'; i++; continue }
      // otherwise replace with space
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
      // Template substitutions ${...} contain code; keep the braces but space the
      // interior so we do not accidentally create a false positive.
      if (ch === '$' && s[i+1] === '{') { out.push('  '); i += 2; // enter a fake nested span
        // consume until matching '}' (not fully robust, but enough for tests)
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

describe('ban raw quaternion literals in Transform.create rotations', () => {
  it('fails when a rotation is provided as a direct object literal after the colon', () => {
    const files = walk(join(__dirname))
      .filter((f) => ['.ts', '.tsx'].includes(extname(f)))
      .filter((f) => !isTestFile(f))

    const problemLines: Array<{ file: string; line: number; col: number; snippet: string }> = []

    const pat = /rotation\s*:\s*\{/g

    for (const file of files) {
      const raw = readFileSync(file, 'utf8')
      const cleaned = stripCommentsAndStrings(raw)
      let m: RegExpExecArray | null
      while ((m = pat.exec(cleaned)) !== null) {
        const idx = m.index
        // Determine line and column
        const before = cleaned.slice(0, idx)
        const line = before.split('\n').length
        const col = idx - before.lastIndexOf('\n')
        const snippet = raw.slice(Math.max(0, idx - 40), Math.min(raw.length, idx + 120)).replace(/\n/g, '↵')
        problemLines.push({ file, line, col, snippet })
      }
    }

    if (problemLines.length > 0) {
      const msgs = problemLines.map((p) => `${p.file}:${p.line}:${p.col}: ${p.snippet}`)
      // Fail with a helpful message listing every occurrence.
      expect(problemLines.length, `Found rotation object literals:
${msgs.join('\n')}`).toBe(0)
    }
  })
})
