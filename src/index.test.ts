import { vi, describe, it, beforeEach, expect } from 'vitest'

// Capture state created by the mocked SDK so tests can inspect calls
let createdEntities: number[] = []
let nextEntityId = 1
let gltfCreateCalls: any[] = []
let transformCreateCalls: any[] = []
let lastPointerOpts: any = null
let lastPointerHandler: (() => void) | null = null
let setupUiCalled = false

// Mock the '@dcl/sdk/ecs' module before importing the module-under-test
vi.mock('@dcl/sdk/ecs', () => {
  return {
    engine: {
      addEntity: vi.fn(() => {
        const id = nextEntityId++
        createdEntities.push(id)
        return id
      })
    },
    GltfContainer: {
      create: vi.fn((entity: any, opts: any) => { gltfCreateCalls.push({ entity, opts }) })
    },
    Transform: {
      create: vi.fn((entity: any, opts: any) => { transformCreateCalls.push({ entity, opts }) })
    },
    pointerEventsSystem: {
      onPointerDown: vi.fn((opts: any, handler: () => void) => {
        lastPointerOpts = opts
        lastPointerHandler = handler
        // return an unregister function
        return () => {}
      })
    },
    // Small shims used by src/index.ts
    InputAction: { IA_POINTER: 0 },
    ColliderLayer: { CL_POINTER: 1 }
  }
})

// src/index.ts calls initAssetPacks(...) at module load time with the mocked ECS
// objects above. The real '@dcl/asset-packs' entrypoint expects a live engine,
// so it is stubbed out; nothing in this file asserts on it.
vi.mock('@dcl/asset-packs/dist/scene-entrypoint', () => {
  return {
    initAssetPacks: vi.fn()
  }
})

// Mock './ui' so we can assert setupUi is invoked by the pointer handler
vi.mock('./ui', () => {
  return {
    setupUi: vi.fn(() => { setupUiCalled = true })
  }
})

// Import the module under test after mocks are in place
import { main } from './index'

beforeEach(() => {
  createdEntities = []
  nextEntityId = 1
  gltfCreateCalls = []
  transformCreateCalls = []
  lastPointerOpts = null
  lastPointerHandler = null
  setupUiCalled = false
})

describe('scene entry (src/index.ts)', () => {
  it('creates grass and machine gltf containers with expected src values', async () => {
    await main()
    expect(gltfCreateCalls.length).toBe(2)
    expect(gltfCreateCalls[0].opts.src).toBe('models/grass/FloorBaseGrass_01.glb')
    expect(gltfCreateCalls[1].opts.src).toBe('models/machine.glb')
  })

  it('creates Transforms with a valid identity quaternion for grass and a normalized quaternion for machine', async () => {
    await main()
    expect(transformCreateCalls.length).toBe(2)

    const grassTransform = transformCreateCalls[0].opts
    expect(grassTransform.rotation).not.toBeNull()
    expect(grassTransform.rotation.x).toBe(0)
    expect(grassTransform.rotation.y).toBe(0)
    expect(grassTransform.rotation.z).toBe(0)
    expect(grassTransform.rotation.w).toBe(1)

    const machineTransform = transformCreateCalls[1].opts
    const r = machineTransform.rotation
    const norm = r.x * r.x + r.y * r.y + r.z * r.z + r.w * r.w
    // Expect the quaternion to be normalized (||q|| ≈ 1)
    expect(norm).toBeCloseTo(1, 6)
  })

  it('registers a pointer handler on the machine entity and invoking it calls setupUi', async () => {
    await main()
    // pointer registration should have been called with the machine entity id
    expect(lastPointerOpts).not.toBeNull()
    expect(lastPointerOpts.entity).toBe(createdEntities[1])

    // invoking the registered handler should call the mocked setupUi
    expect(setupUiCalled).toBe(false)
    if (lastPointerHandler) lastPointerHandler()
    expect(setupUiCalled).toBe(true)
  })
})
