import { describe, it, expect } from 'vitest'
import { normalizeQuaternionOrIdentity } from './quat'

describe('normalizeQuaternionOrIdentity — boundary cases around MIN_NORM', () => {
  it('returns identity for a quaternion with norm below the practical floor (1e-12)', () => {
    const qBelow = { x: 1e-13, y: 0, z: 0, w: 0 }
    const out = normalizeQuaternionOrIdentity(qBelow)
    expect(out).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('normalizes a quaternion with norm above the practical floor (1e-12)', () => {
    const qAbove = { x: 1e-11, y: 0, z: 0, w: 0 }
    const out = normalizeQuaternionOrIdentity(qAbove)
    // The normalized result should be finite and have unit length.
    const norm = Math.sqrt(out.x * out.x + out.y * out.y + out.z * out.z + out.w * out.w)
    expect(Number.isFinite(out.x)).toBe(true)
    expect(Number.isFinite(out.y)).toBe(true)
    expect(Number.isFinite(out.z)).toBe(true)
    expect(Number.isFinite(out.w)).toBe(true)
    // Use a loose tolerance consistent with existing project tests.
    expect(norm).toBeGreaterThan(0.9999)
    expect(norm).toBeLessThan(1.0001)
  })
})
