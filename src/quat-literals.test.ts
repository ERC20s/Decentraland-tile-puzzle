import { describe, it, expect } from 'vitest'

// Regex that matches an object literal of the form: { x: <num>, y: <num>, z: <num>, w: <num> }
// The numeric token allows signed numbers, decimals, exponents and the words Infinity/NaN
const NUM = '[+-]?(?:Infinity|NaN|(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)'
const QUAT_RE = new RegExp(`\{\s*x\s*:\s*(?<x>${NUM})\s*,\s*y\s*:\s*(?<y>${NUM})\s*,\s*z\s*:\s*(?<z>${NUM})\s*,\s*w\s*:\s*(?<w>${NUM})\s*\}`, 'g')

function parseNumToken(tok: string): number {
  if (tok === 'Infinity' || tok === '+Infinity') return Infinity
  if (tok === '-Infinity') return -Infinity
  if (tok === 'NaN') return NaN
  return Number(tok)
}

function quatIsInvalid(q: { x: number; y: number; z: number; w: number }): boolean {
  const { x, y, z, w } = q
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(w)) return true
  const norm = Math.hypot(x, y, z, w)
  if (!Number.isFinite(norm) || norm <= Number.EPSILON) return true
  return false
}

describe('quaternion-literal detection regexp should be correctly escaped and functional', () => {
  it('matches the inline all-zero fixture and flags it as invalid', () => {
    const fixture = 'const bad = { x: 0, y: 0, z: 0, w: 0 }'
    const m = QUAT_RE.exec(fixture)
    expect(m).not.toBeNull()
    if (!m || !m.groups) throw new Error('expected regexp to capture groups')

    const q = {
      x: parseNumToken(m.groups.x),
      y: parseNumToken(m.groups.y),
      z: parseNumToken(m.groups.z),
      w: parseNumToken(m.groups.w),
    }

    expect(quatIsInvalid(q)).toBe(true)
  })

  it('parses a valid identity quaternion and does not flag it', () => {
    const fixture = 'const ok = { x: 0, y: 0, z: 0, w: 1 }'
    const m = QUAT_RE.exec(fixture)
    expect(m).not.toBeNull()
    if (!m || !m.groups) throw new Error('expected regexp to capture groups')

    const q = {
      x: parseNumToken(m.groups.x),
      y: parseNumToken(m.groups.y),
      z: parseNumToken(m.groups.z),
      w: parseNumToken(m.groups.w),
    }

    expect(quatIsInvalid(q)).toBe(false)
  })
})
