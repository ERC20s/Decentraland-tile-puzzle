import { vi, describe, it, beforeEach, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// What the mocked SDK saw the scene build.
let nextEntityId = 1
let gltfCreateCalls: Array<{ entity: any; opts: any }> = []
let transformCreateCalls: Array<{ entity: any; opts: any }> = []

// One mock of '@dcl/sdk/ecs' for both modules under test: src/index.ts builds
// the grass and the machine, src/reward.ts builds the win reward.
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
import {
  Reward,
  __resetRewardEntityForTests,
  GRASS_TILE_SIZE,
  REWARD_POSITION,
  REWARD_SCALE
} from './reward'

// The side, in metres at scale 1, of each model the scene places on the ground.
//
// FloorBaseGrass_01.glb is GRASS_TILE_SIZE, exported from src/reward.ts, where
// the reasoning for that number lives. models/machine.glb is not measured
// anywhere in the repository, so this is a deliberately generous upper bound:
// if the real machine is smaller the test is still correct, only less tight. If
// a model is ever swapped, correct the number here (and GRASS_TILE_SIZE there).
const MACHINE_SIZE_UPPER_BOUND = 8

const MODEL_SIZES: Record<string, number> = {
  'models/grass/FloorBaseGrass_01.glb': GRASS_TILE_SIZE,
  'models/machine.glb': MACHINE_SIZE_UPPER_BOUND
}

const PARCEL_SIZE = 16

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

// The playable footprint, in scene coordinates, derived from scene.json rather
// than hard-coded: scene coordinates start at 0 on the corner of the base
// parcel, and each parcel is 16 by 16 metres.
function sceneBounds(): Bounds {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'scene.json'), 'utf8')
  const scene = JSON.parse(raw)
  const parcels: string[] = scene.scene.parcels
  expect(Array.isArray(parcels)).toBe(true)
  expect(parcels.length).toBeGreaterThan(0)

  const coords = parcels.map((p) => {
    const [x, z] = String(p).split(',').map((n) => Number(n.trim()))
    expect(Number.isFinite(x)).toBe(true)
    expect(Number.isFinite(z)).toBe(true)
    return { x, z }
  })

  const [baseX, baseZ] = String(scene.scene.base).split(',').map((n) => Number(n.trim()))
  const xs = coords.map((c) => c.x - baseX)
  const zs = coords.map((c) => c.z - baseZ)

  return {
    minX: Math.min(...xs) * PARCEL_SIZE,
    maxX: (Math.max(...xs) + 1) * PARCEL_SIZE,
    minZ: Math.min(...zs) * PARCEL_SIZE,
    maxZ: (Math.max(...zs) + 1) * PARCEL_SIZE
  }
}

// Join the GltfContainer and Transform calls by entity, so each placed model is
// checked with the size of the mesh it actually loads.
function placements(): Array<{ src: string; position: any; scale: any }> {
  const out: Array<{ src: string; position: any; scale: any }> = []
  for (const gltf of gltfCreateCalls) {
    const transform = transformCreateCalls.find((t) => t.entity === gltf.entity)
    if (!transform) continue
    out.push({
      src: gltf.opts.src,
      position: transform.opts.position,
      scale: transform.opts.scale
    })
  }
  return out
}

function footprint(src: string, position: any, scale: any) {
  const size = MODEL_SIZES[src]
  return {
    minX: position.x - (size * scale.x) / 2,
    maxX: position.x + (size * scale.x) / 2,
    minZ: position.z - (size * scale.z) / 2,
    maxZ: position.z + (size * scale.z) / 2
  }
}

beforeEach(async () => {
  __resetMainForTests()
  __resetRewardEntityForTests()
  nextEntityId = 1
  gltfCreateCalls = []
  transformCreateCalls = []

  await main()
  Reward()
})

describe('scene footprints stay inside the declared parcels', () => {
  it('derives the bounds from scene.json', () => {
    // Four parcels, base "0,0" — x 0..32 by z 0..32.
    expect(sceneBounds()).toEqual({ minX: 0, maxX: 32, minZ: 0, maxZ: 32 })
  })

  it('places the grass, the machine and the reward, and knows how big each model is', () => {
    const placed = placements()
    expect(placed.length).toBe(3)
    for (const p of placed) {
      expect(MODEL_SIZES[p.src], `no size recorded for ${p.src}`).toBeDefined()
    }
  })

  it('keeps every placed model inside the scene', () => {
    const bounds = sceneBounds()
    const problems: string[] = []

    for (const p of placements()) {
      const box = footprint(p.src, p.position, p.scale)
      if (box.minX < bounds.minX || box.maxX > bounds.maxX || box.minZ < bounds.minZ || box.maxZ > bounds.maxZ) {
        problems.push(
          `${p.src} spans x ${box.minX}..${box.maxX}, z ${box.minZ}..${box.maxZ}, ` +
          `outside x ${bounds.minX}..${bounds.maxX}, z ${bounds.minZ}..${bounds.maxZ}`
        )
      }
    }

    expect(problems, problems.join('\n')).toEqual([])
  })

  it('keeps the reward a small patch rather than a second floor', () => {
    const bounds = sceneBounds()
    const sceneArea = (bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ)
    const rewardSide = GRASS_TILE_SIZE * REWARD_SCALE

    // The regression this guards: the reward used to be the 16m grass tile at
    // scale 2, a 32x32m plate — the whole scene — centred at z 18, two metres
    // past the north edge.
    expect(rewardSide * rewardSide).toBeLessThan(sceneArea / 16)

    const box = footprint('models/grass/FloorBaseGrass_01.glb', REWARD_POSITION, {
      x: REWARD_SCALE,
      y: REWARD_SCALE,
      z: REWARD_SCALE
    })
    expect(box.minX).toBeGreaterThanOrEqual(bounds.minX)
    expect(box.maxX).toBeLessThanOrEqual(bounds.maxX)
    expect(box.minZ).toBeGreaterThanOrEqual(bounds.minZ)
    expect(box.maxZ).toBeLessThanOrEqual(bounds.maxZ)
  })

  it('does not park the reward on top of the machine', () => {
    const machine = placements().find((p) => p.src === 'models/machine.glb')
    expect(machine).toBeDefined()

    const machineBox = footprint('models/machine.glb', machine!.position, machine!.scale)
    const rewardBox = footprint('models/grass/FloorBaseGrass_01.glb', REWARD_POSITION, {
      x: REWARD_SCALE,
      y: REWARD_SCALE,
      z: REWARD_SCALE
    })

    const overlaps =
      rewardBox.minX < machineBox.maxX &&
      rewardBox.maxX > machineBox.minX &&
      rewardBox.minZ < machineBox.maxZ &&
      rewardBox.maxZ > machineBox.minZ
    expect(overlaps).toBe(false)
  })
})
