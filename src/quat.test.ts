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
})
