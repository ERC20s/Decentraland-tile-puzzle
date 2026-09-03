import { vi, describe, it, beforeEach, expect } from 'vitest'

// Prepare variables that will be captured by the module mock so tests can
// observe what the mocked SDK functions did.
let createdEntities: number[] = []
let nextEntityId = 1
let lastCreateArgs: any = null
let fakeGetMutable: (entity: any) => any = () => ({ playing: true })
let lastRewardPointerUnregisterCalled = false

// Mock the '@dcl/sdk/ecs' module before importing the reward module so that
// reward.ts receives our fakes for engine, AudioSource, pointerEventsSystem, etc.
vi.mock('@dcl/sdk/ecs', () => {
  return {
    engine: {
      addEntity: vi.fn(() => {
        const id = nextEntityId++
        createdEntities.push(id)
        return id
      })
    },
    AudioSource: {
      create: vi.fn((entity: any, opts: any) => { lastCreateArgs = { entity, opts } }),
      getMutable: vi.fn((entity: any) => fakeGetMutable(entity)),
    },
    pointerEventsSystem: {
      onPointerDown: vi.fn((_opts: any, _handler: () => void) => {
        // return a fake unregister function that sets a flag so tests can observe it
        return () => { lastRewardPointerUnregisterCalled = true }
      })
    },
    // Small shims for other imports used by reward.ts
    GltfContainer: { create: vi.fn() },
    Transform: { create: vi.fn() },
    InputAction: { IA_POINTER: 0 },
    ColliderLayer: { CL_POINTER: 1 }
  }
})

// Now import the module under test; the imports above will be used by it.
import * as RewardModule from './reward'
import * as ecs from '@dcl/sdk/ecs'

beforeEach(() => {
  createdEntities = []
  nextEntityId = 1
  lastCreateArgs = null
  fakeGetMutable = () => ({ playing: true })
  lastRewardPointerUnregisterCalled = false

  // Ensure module-local rewardEntity is cleared between tests
  RewardModule.__resetRewardEntityForTests()
})

describe('Reward', () => {
  it('creates a reward entity and calls AudioSource.create on first call', () => {
    RewardModule.Reward()

    expect(createdEntities.length).toBe(1)
    expect(lastCreateArgs).not.toBeNull()
    expect(lastCreateArgs.opts.audioClipUrl).toBe('music/champ2.mp3')
    expect(lastCreateArgs.opts.playing).toBe(true)

    // Assert that Transform.create was called and its rotation is a valid normalized quaternion
    const transformCreateMock: any = (ecs as any).Transform.create
    expect(transformCreateMock).toBeDefined()
    expect(transformCreateMock.mock).toBeDefined()
    expect(transformCreateMock.mock.calls.length).toBeGreaterThanOrEqual(1)

    const transformCallArgs = transformCreateMock.mock.calls[0]
    // transformCallArgs = [entity, opts]
    const opts = transformCallArgs[1]
    expect(opts).toBeDefined()
    const rot = opts.rotation
    expect(rot).toBeDefined()

    // All components should be numeric and finite
    for (const k of ['x', 'y', 'z', 'w']) {
      expect(typeof (rot as any)[k]).toBe('number')
      expect(Number.isFinite((rot as any)[k])).toBe(true)
    }

    // Squared norm should be approximately 1
    const norm2 = (rot.x * rot.x) + (rot.y * rot.y) + (rot.z * rot.z) + (rot.w * rot.w)
    expect(norm2).toBeCloseTo(1, 6)
  })

  it('reuses reward entity and sets AudioSource.getMutable().playing = true on subsequent calls', () => {
    // First call creates it
    RewardModule.Reward()

    // Prepare a shared audio object so we can observe mutation
    const sharedAudio: any = { playing: false }
    fakeGetMutable = (_entity: any) => sharedAudio

    // Second call should reuse the same entity and set playing = true on the shared object
    RewardModule.Reward()
    expect(createdEntities.length).toBe(1)
    expect(sharedAudio.playing).toBe(true)
  })

  it('toggleSound tolerates missing AudioSource without throwing', () => {
    // Create a reward first
    RewardModule.Reward()

    // Simulate missing AudioSource
    fakeGetMutable = (_entity: any) => null

    // Call the exported toggleSound directly; it should not throw
    expect(() => RewardModule.toggleSound(createdEntities[0])).not.toThrow()
  })

  it('reset helper calls unregister and tolerates throwing unregisters', () => {
    // First call creates reward and installs a pointer handler
    RewardModule.Reward()
    expect(lastRewardPointerUnregisterCalled).toBe(false)

    // Call reset helper which should call the stored unregister
    RewardModule.__resetRewardEntityForTests()
    expect(lastRewardPointerUnregisterCalled).toBe(true)

    // Now test that if unregister throws, the reset helper does not throw
    // Re-establish reward pointer unregister that throws when called
    // To do this we mock the pointerEventsSystem.onPointerDown to return a throwing function

    // Replace the mock to return a throwing unregister
    ;(ecs as any).pointerEventsSystem.onPointerDown = vi.fn((_opts: any, _handler: () => void) => {
      return () => { throw new Error('boom') }
    })

    // Create reward again which will store the throwing unregister
    RewardModule.Reward()

    // Now calling reset should not throw even though the unregister throws
    expect(() => RewardModule.__resetRewardEntityForTests()).not.toThrow()
  })
})
