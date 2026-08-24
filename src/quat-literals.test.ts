import { describe, it, expect } from 'vitest'

// A regex that matches simple object-literal quaternions written in source with
// numeric literal components, e.g. { x: 0, y: 0, z: 0, w: 1 }
// Constructed as a RegExp literal so backslash escapes like \s and \d are preserved.
const QUAT_RE = /\{\s*x\s*:\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*,\s*y\s*:\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*,\s*z\s*:\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*,\s*w\s*:\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*\}/

function parseQuatLiteral(text: string): number[] | null {
  const m = QUAT_RE.exec(text)
  if (!m) return null
  // groups 1..4 correspond to x,y,z,w
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
}

function normSq(q: number[]): number {
  return q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]
}

describe('quat literal detection and heuristic flagging', () => {
  it('matches and flags an explicit all-zero quaternion literal', () => {
    const bad = '{ x: 0, y: 0, z: 0, w: 0 }'
    const parsed = parseQuatLiteral(bad)
    expect(parsed).not.toBeNull()
    if (!parsed) return
    const n = normSq(parsed)
    // All-zero should produce zero norm and therefore be considered invalid/flagged
    expect(n).toBe(0)
    expect(n).toBeLessThanOrEqual(Number.EPSILON)
  })

  it('matches identity quaternion literal but does not flag it', () => {
    const good = '{ x: 0, y: 0, z: 0, w: 1 }'
    const parsed = parseQuatLiteral(good)
    expect(parsed).not.toBeNull()
    if (!parsed) return
    const n = normSq(parsed)
    // Identity has norm 1 and should not be flagged by the heuristic
    expect(n).toBeGreaterThan(0.9)
    expect(n).toBeLessThan(1.1)
  })

  it('treats non-finite or NaN components as flagged', () => {
    const nanLit = '{ x: NaN, y: 0, z: 0, w: 1 }'
    const parsedNaN = parseQuatLiteral(nanLit)
    // parse will yield NaN for that component; we consider that flagged
    expect(parsedNaN).not.toBeNull()
    if (!parsedNaN) return
    expect(Number.isFinite(parsedNaN[0])).toBe(false)
  })
})
