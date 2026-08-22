import { beforeEach, test, expect, vi } from 'vitest'

// This test suite focuses on the runtime behaviors in src/reward.ts: creation
// and reuse of a single reward entity, safe AudioSource access, and the
// pointer-events toggle handler. We mock the minimal exports from
// '@dcl/sdk/ecs' that reward.ts uses so tests run fast and deterministically.

let storedPointerHandler: Function | null = null
let mockAddEntity: any
let mockAudioSourceCreate: any
let mockAudioSourceGetMutable: any
let mockGltfCreate: any
let mockTransformCreate: any
let mockOnPointerDown: any

beforeEach(() => {
  // reset the module registry so src/reward.ts re-evaluates and its module-scope
  // rewardEntity starts as null for each test
  vi.resetModules()
  storedPointerHandler = null

  mockAddEntity = vi.fn(() => 1) // return a simple numeric entity id
  mockAudioSourceCreate = vi.fn()
  // default getMutable returns an object with a boolean `playing` field
  mockAudioSourceGetMutable = vi.fn(() => ({ playing: true }))
  mockGltfCreate = vi.fn()
  mockTransformCreate = vi.fn()
  mockOnPointerDown = vi.fn((opts: any, handler: Function) => {
    storedPointerHandler = handler
  })

  // Provide the mock implementation for '@dcl/sdk/ecs' before importing reward
  vi.mock('@dcl/sdk/ecs', () => ({
    engine: { addEntity: mockAddEntity },
    AudioSource: { create: mockAudioSourceCreate, getMutable: (...args: any[]) => mockAudioSourceGetMutable(...args) },
    GltfContainer: { create: mockGltfCreate },
    Transform: { create: mockTransformCreate },
    pointerEventsSystem: { onPointerDown: mockOnPointerDown },
    // Minimal enum mocks used by reward.ts
    InputAction: { IA_POINTER: 1 },
    ColliderLayer: { CL_POINTER: 1 },
    // Include other names to satisfy imports (unused in reward.ts but imported)
    Entity: Object,
    Animator: {},
    AvatarAttach: {},
    Material: {},
    VideoPlayer: {},
    VisibilityComponent: {},
  }))
})

test('Reward() creates entity, AudioSource.create called with music/champ2.mp3 and playing=true, and pointer handler registered', async () => {
  const rewardMod = await import('./reward')
  // Call Reward to create the entity
  rewardMod.Reward()

  expect(mockAddEntity).toHaveBeenCalledTimes(1)
  expect(mockAudioSourceCreate).toHaveBeenCalledTimes(1)
  const [entityArg, opts] = mockAudioSourceCreate.mock.calls[0]
  expect(entityArg).toBe(1)
  expect(opts).toMatchObject({ audioClipUrl: 'music/champ2.mp3', playing: true })
  // Ensure pointer handler was registered
  expect(mockOnPointerDown).toHaveBeenCalledTimes(1)
  expect(typeof storedPointerHandler).toBe('function')
})

test('Calling Reward() a second time reuses rewardEntity and sets playing=true via AudioSource.getMutable', async () => {
  const rewardMod = await import('./reward')
  // First call creates the entity
  rewardMod.Reward()
  expect(mockAddEntity).toHaveBeenCalledTimes(1)

  // Prepare getMutable to return a mutable object with playing=false so we can
  // observe it being set to true by the reuse branch
  const mutableObj = { playing: false }
  mockAudioSourceGetMutable.mockImplementation(() => mutableObj)

  // Second call should hit the reuse branch and call getMutable
  rewardMod.Reward()
  expect(mockAudioSourceGetMutable).toHaveBeenCalledTimes(1)
  expect(mutableObj.playing).toBe(true)
  // No additional entity should have been created
  expect(mockAddEntity).toHaveBeenCalledTimes(1)
})

test('Pointer handler toggles playback and is safe when AudioSource.getMutable returns null', async () => {
  const rewardMod = await import('./reward')

  // Make getMutable return an object that starts with playing=false
  const mutableObj = { playing: false }
  mockAudioSourceGetMutable.mockImplementation(() => mutableObj)

  // Create reward and capture pointer handler
  rewardMod.Reward()
  expect(typeof storedPointerHandler).toBe('function')

  // Simulate pointer click: should toggle playing to true
  expect(mutableObj.playing).toBe(false)
  ;(storedPointerHandler as Function)()
  expect(mutableObj.playing).toBe(true)

  // Now make getMutable return null and ensure calling handler does not throw
  mockAudioSourceGetMutable.mockImplementation(() => null)
  expect(() => (storedPointerHandler as Function)()).not.toThrow()
})
