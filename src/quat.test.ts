import { describe, it, expect } from 'vitest'
import { normalizeQuaternionOrIdentity } from './quat'

describe('normalizeQuaternionOrIdentity', () => {
  it('returns identity for all-zero quaternion', () => {
    const q = { x: 0, y: 0, z: 0, w: 0 }
    const out = normalizeQuaternionOrIdentity(q)
    expect(out).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('normalizes non-normalized quaternion', () => {
    const q = { x: 2, y: 0, z: 0, w: 0 }
    const out = normalizeQuaternionOrIdentity(q)
    const norm = Math.sqrt(out.x * out.x + out.y * out.y + out.z * out.z + out.w * out.w)
    expect(norm).toBeGreaterThan(0.9999)
    expect(norm).toBeLessThan(1.0001)
  })

  it('returns identity for quaternion containing NaN', () => {
    const q = { x: NaN, y: 0, z: 0, w: 1 }
    const out = normalizeQuaternionOrIdentity(q)
    expect(out).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('returns identity for quaternion containing Infinity', () => {
    const q = { x: Infinity, y: 0, z: 0, w: 1 }
    const out = normalizeQuaternionOrIdentity(q)
    expect(out).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('returns identity for tiny finite-norm quaternion (below runtime MIN_NORM)', () => {
    // Construct a quaternion whose norm is finite but smaller than the runtime
    // MIN_NORM threshold used by normalizeQuaternionOrIdentity. This ensures
    // the test mirrors the library behaviour instead of relying on Number.EPSILON.
    const q = { x: 1e-13, y: 0, z: 0, w: 0 }
    const out = normalizeQuaternionOrIdentity(q)
    expect(out).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })
})
