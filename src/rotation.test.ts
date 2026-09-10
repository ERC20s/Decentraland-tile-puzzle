import { vi, describe, it, beforeEach, expect } from 'vitest'

// What the mocked SDK saw the scene build.
let nextEntityId = 1
let gltfCreateCalls: Array<{ entity: any; opts: any }> = []
let transformCreateCalls: Array<{ entity: any; opts: any }> = []

// One mock of '@dcl/sdk/ecs' matching the style used elsewhere.
vi.mock('@dcl/sdk/ecs', () => {
  return {
    engine: {
      addEntity: vi.fn(() => nextEntityId++),
      addSystem: vi.fn(),
      removeSystem: vi.fn()
    },
    GltfContainer: {
      create: vi.fn((entity: any, opts: any) => { gltfCreateCalls.push({ entity, opts }) })
    },
    Transform: {
      create: vi.fn((entity: any, opts: any) => { transformCreateCalls.push({ entity, opts }) })
    },
    AudioSource: {
      create: vi.fn(),
      getMutable: vi.fn(() => ({ playing: true }))
    },
    pointerEventsSystem: {
      onPointerDown: vi.fn(() => () => { /* unregister */ })
    },
    InputAction: { IA_POINTER: 0 },
    ColliderLayer: { CL_POINTER: 1 }
  }
})

vi.mock('./ui', () => {
  return { setupUi: vi.fn() }
})

import { main, __resetMainForTests } from './index'
import { Reward, __resetRewardEntityForTests } from './reward'

beforeEach(async () => {
  __resetMainForTests()
  __resetRewardEntityForTests()
  nextEntityId = 1
  gltfCreateCalls = []
  transformCreateCalls = []

  await main()
  Reward()
})

function quatNorm(q: any) {
  return Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)
}

describe('all Transform rotations are finite and normalized', () => {
  it('every rotation provided to Transform.create has finite components and a unit norm', () => {
    const withRotation = transformCreateCalls
      .map((c) => c.opts && c.opts.rotation ? c.opts.rotation : null)
      .filter((r) => r !== null)

    // There should be at least one rotation to check (the grass, the machine and reward expect rotations)
    expect(withRotation.length).toBeGreaterThan(0)

    for (const r of withRotation) {
      // Components must be finite numbers
      expect(Number.isFinite(r.x), `rotation.x is not finite: ${r.x}`).toBe(true)
      expect(Number.isFinite(r.y), `rotation.y is not finite: ${r.y}`).toBe(true)
      expect(Number.isFinite(r.z), `rotation.z is not finite: ${r.z}`).toBe(true)
      expect(Number.isFinite(r.w), `rotation.w is not finite: ${r.w}`).toBe(true)

      const norm = quatNorm(r)

      // Norm must be finite and not tiny (avoid subnormal / zero quaternion)
      expect(Number.isFinite(norm), `quaternion norm is not finite: ${norm}`).toBe(true)
      expect(norm).toBeGreaterThan(Number.EPSILON)

      // And approximately 1 within a loose tolerance to avoid flakiness
      expect(Math.abs(norm - 1)).toBeLessThan(1e-6)
    }
  })
})
