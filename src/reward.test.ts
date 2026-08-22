import { vi, describe, it, beforeEach, expect } from 'vitest'

// Prepare variables that will be captured by the module mock so tests can
// observe what the mocked SDK functions did.
let createdEntities: number[] = []
let nextEntityId = 1
let lastCreateArgs: any = null
let fakeGetMutable: (entity: any) => any = () => ({ playing: true })

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
        // return a fake unregister function
        return () => {}
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

beforeEach(() => {
  createdEntities = []
  nextEntityId = 1
  lastCreateArgs = null
  fakeGetMutable = () => ({ playing: true })

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
})
