import { vi, describe, it, beforeEach, expect } from 'vitest'

// Prepare variables that will be captured by the module mock so tests can
// observe what the mocked SDK functions did.
let createdEntities: number[] = []
let nextEntityId = 1
let lastCreateArgs: any = null
let fakeGetMutable: (entity: any) => any = () => ({ playing: true })
let lastRewardPointerUnregisterCalled = false
// Systems the module handed to the fake engine, and the ones it took back.
let addedSystems: Array<(dt: number) => void> = []
let removedSystems: Array<(dt: number) => void> = []

// Mock the '@dcl/sdk/ecs' module before importing the reward module so that
// reward.ts receives our fakes for engine, AudioSource, pointerEventsSystem, etc.
vi.mock('@dcl/sdk/ecs', () => {
  return {
    engine: {
      addEntity: vi.fn(() => {
        const id = nextEntityId++
        createdEntities.push(id)
        return id
      }),
      // The one-shot restart of the win song is scheduled through these; the
      // tests keep the callback so they can run it as a frame would.
      addSystem: vi.fn((system: any) => { addedSystems.push(system) }),
      removeSystem: vi.fn((system: any) => { removedSystems.push(system) })
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

  // Restore the engine and pointer fakes: individual tests replace them to
  // exercise the fallback paths.
  ;(ecs as any).engine.addSystem = (system: any) => { addedSystems.push(system) }
  ;(ecs as any).engine.removeSystem = (system: any) => { removedSystems.push(system) }
  ;(ecs as any).pointerEventsSystem.onPointerDown = vi.fn((_opts: any, _handler: () => void) => {
    return () => { lastRewardPointerUnregisterCalled = true }
  })

  // Ensure module-local rewardEntity is cleared between tests
  RewardModule.__resetRewardEntityForTests()

  // Cleared last: the reset above may hand a leftover system back to the engine.
  addedSystems = []
  removedSystems = []
  lastRewardPointerUnregisterCalled = false
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

  it('restarts the win song on a later win: playing goes false now, true on the next frame', () => {
    // First call creates it, with playing: true already on the component.
    RewardModule.Reward()

    // The clip has finished but the field is still true, as the runtime leaves it.
    const sharedAudio: any = { playing: true }
    fakeGetMutable = (_entity: any) => sharedAudio

    // Second win: reuse the entity, and write false so the next write is a change.
    RewardModule.Reward()
    expect(createdEntities.length).toBe(1)
    expect(sharedAudio.playing).toBe(false)
    expect(addedSystems.length).toBe(1)

    // The engine runs the one-shot system on the next frame.
    expect(RewardModule.__flushPendingRewardRestartForTests()).toBe(true)
    expect(sharedAudio.playing).toBe(true)

    // ...and it unregisters itself, so it does not run every frame afterwards.
    expect(removedSystems.length).toBe(1)
    expect(removedSystems[0]).toBe(addedSystems[0])
    expect(RewardModule.__flushPendingRewardRestartForTests()).toBe(false)
  })

  it('does not stack a second pending restart when wins land in the same frame', () => {
    RewardModule.Reward()

    const sharedAudio: any = { playing: true }
    fakeGetMutable = (_entity: any) => sharedAudio

    RewardModule.Reward()
    RewardModule.Reward()
    RewardModule.Reward()

    expect(addedSystems.length).toBe(1)
    expect(sharedAudio.playing).toBe(false)

    RewardModule.__flushPendingRewardRestartForTests()
    expect(sharedAudio.playing).toBe(true)
    expect(removedSystems.length).toBe(1)
  })

  it('falls back to an immediate playing = true when the runtime has no addSystem', () => {
    RewardModule.Reward()

    const sharedAudio: any = { playing: true }
    fakeGetMutable = (_entity: any) => sharedAudio
    delete (ecs as any).engine.addSystem

    RewardModule.Reward()

    // No frame will ever come, so the old behaviour stands: set it true now.
    expect(sharedAudio.playing).toBe(true)
    expect(addedSystems.length).toBe(0)
    expect(RewardModule.__flushPendingRewardRestartForTests()).toBe(false)
  })

  it('falls back to an immediate playing = true when addSystem throws', () => {
    RewardModule.Reward()

    const sharedAudio: any = { playing: true }
    fakeGetMutable = (_entity: any) => sharedAudio
    ;(ecs as any).engine.addSystem = () => { throw new Error('no systems here') }

    expect(() => RewardModule.Reward()).not.toThrow()
    expect(sharedAudio.playing).toBe(true)
    expect(RewardModule.__flushPendingRewardRestartForTests()).toBe(false)
  })

  it('a queued restart survives a missing AudioSource without throwing', () => {
    RewardModule.Reward()

    const sharedAudio: any = { playing: true }
    fakeGetMutable = (_entity: any) => sharedAudio
    RewardModule.Reward()
    expect(addedSystems.length).toBe(1)

    // The component disappears before the frame runs.
    fakeGetMutable = (_entity: any) => null
    expect(() => RewardModule.__flushPendingRewardRestartForTests()).not.toThrow()
    expect(removedSystems.length).toBe(1)
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
