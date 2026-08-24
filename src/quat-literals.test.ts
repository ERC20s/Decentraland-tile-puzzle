import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Conservative regexp that matches object literals where x,y,z,w are numeric literals in order.
const NUM = '([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)'
const QUAT_RE = new RegExp(`\{[^}]*?\\bx\\s*:\s*${NUM}[^}]*?\\by\\s*:\s*${NUM}[^}]*?\\bz\\s*:\s*${NUM}[^}]*?\\bw\\s*:\s*${NUM}[^}]*?\}`, 'g')

function walkDir(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let files: string[] = []
  for (const e of entries) {
    const res = path.join(dir, e.name)
    if (e.isDirectory()) files = files.concat(walkDir(res))
    else files.push(res)
  }
  return files
}

describe('quat literal sanity check', () => {
  it('finds numeric quaternion literals with non-finite or tiny norms', () => {
    const srcDir = path.join(__dirname)
    const allFiles = walkDir(srcDir)
    const candidates = allFiles.filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))

    const failures: string[] = []

    for (const file of candidates) {
      const txt = fs.readFileSync(file, 'utf8')
      let m: RegExpExecArray | null
      while ((m = QUAT_RE.exec(txt)) !== null) {
        // m[1..4] are the numeric captures for x,y,z,w
        const x = Number(m[1])
        const y = Number(m[2])
        const z = Number(m[3])
        const w = Number(m[4])

        const literal = m[0]
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(w)) {
          failures.push(`${file}: quaternion contains non-finite component -> ${literal}`)
          continue
        }

        const norm = Math.sqrt(x * x + y * y + z * z + w * w)
        if (!Number.isFinite(norm) || norm <= Number.EPSILON) {
          failures.push(`${file}: quaternion has tiny or zero norm (${norm}) -> ${literal}`)
        }
      }
    }

    // If we found failures, report them in the test output
    expect(failures).toEqual([])
  })
})
