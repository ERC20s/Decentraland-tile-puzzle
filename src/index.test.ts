import { vi, describe, it, beforeEach, expect } from 'vitest'

// Capture state created by the mocked SDK so tests can inspect calls
let createdEntities: number[] = []
let nextEntityId = 1
let gltfCreateCalls: any[] = []
let transformCreateCalls: any[] = []
let lastPointerOpts: any = null
let lastPointerHandler: (() => void) | null = null
let lastPointerUnregisterCalled = false
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
        // return an unregister function that sets a flag so tests can detect it was called
        return () => { lastPointerUnregisterCalled = true }
      })
    },
    // Small shims used by src/index.ts
    InputAction: { IA_POINTER: 0 },
    ColliderLayer: { CL_POINTER: 1 }
  }
})

// Mock './ui' so we can assert setupUi is invoked by the pointer handler
vi.mock('./ui', () => {
  return {
    setupUi: vi.fn(() => { setupUiCalled = true })
  }
})

// Import the module under test after mocks are in place
import { main, __resetMainForTests } from './index'
// The mocked setupUi, so tests can change its behaviour per-case
import { setupUi } from './ui'

beforeEach(() => {
  // main() now keeps its grass and machine between calls, so each test must
  // start from a cleared module state or it would see zero creations.
  __resetMainForTests()

  createdEntities = []
  nextEntityId = 1
  gltfCreateCalls = []
  transformCreateCalls = []
  lastPointerOpts = null
  lastPointerHandler = null
  lastPointerUnregisterCalled = false
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

  it('does not rethrow when setupUi throws, and warns instead', async () => {
    await main()
    expect(lastPointerHandler).not.toBeNull()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { })
    const boom = new Error('setupUi exploded')
    ;(setupUi as any).mockImplementationOnce(() => { setupUiCalled = true; throw boom })

    try {
      // Invoking the handler must be safe even though setupUi throws
      expect(() => { if (lastPointerHandler) lastPointerHandler() }).not.toThrow()
      // setupUi was still attempted
      expect(setupUiCalled).toBe(true)
      expect(setupUi).toHaveBeenCalled()
      // and the failure was reported rather than swallowed silently
      expect(warn).toHaveBeenCalled()
      const warned = warn.mock.calls.some((call: any[]) => call.includes(boom))
      expect(warned).toBe(true)
    } finally {
      warn.mockRestore()
    }

    // A later, healthy invocation still works normally
    setupUiCalled = false
    if (lastPointerHandler) lastPointerHandler()
    expect(setupUiCalled).toBe(true)
  })

  it('calls the previous unregister when main is invoked a second time', async () => {
    // First registration
    await main()
    expect(lastPointerUnregisterCalled).toBe(false)

    // Second run should call the previous unregister function
    await main()
    expect(lastPointerUnregisterCalled).toBe(true)
  })

  it('does not create a second grass or machine when main is invoked twice', async () => {
    await main()
    expect(createdEntities.length).toBe(2)
    const [grass, machine] = createdEntities

    await main()

    // No extra entities, and no extra components stacked on the scene
    expect(createdEntities.length).toBe(2)
    expect(createdEntities).toEqual([grass, machine])
    expect(gltfCreateCalls.length).toBe(2)
    expect(transformCreateCalls.length).toBe(2)

    // The pointer handler is re-registered on the machine that already exists
    expect(lastPointerOpts).not.toBeNull()
    expect(lastPointerOpts.entity).toBe(createdEntities[1])
  })

  it('rebuilds grass and machine after the reset helper clears them', async () => {
    await main()
    expect(createdEntities.length).toBe(2)

    __resetMainForTests()
    await main()

    // A cleared state means a fresh pair — four entities in total for this test
    expect(createdEntities.length).toBe(4)
    expect(gltfCreateCalls.length).toBe(4)
    expect(transformCreateCalls.length).toBe(4)
    expect(lastPointerOpts.entity).toBe(createdEntities[3])
  })

  it('reset helper calls unregister and clears stored state', async () => {
    await main()
    expect(lastPointerUnregisterCalled).toBe(false)

    // Call the exported test helper which should invoke the stored unregister
    __resetMainForTests()
    expect(lastPointerUnregisterCalled).toBe(true)

    // Running main again should work and register a new handler (no throw)
    await main()
    expect(lastPointerOpts).not.toBeNull()
  })
})
