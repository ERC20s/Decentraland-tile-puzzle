import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs';
import { normalizeQuaternionOrIdentity } from './quat'

// The reward is ONE scene entity, created on the first win and reused on every
// win after it. Building it per win stacked another grass mesh and another
// AudioSource on the same spot each time the puzzle was re-solved, and left the
// old pointer handlers registered.
let rewardEntity: Entity | null = null

// Module-local storage for the reward pointer unregister function so we can
// avoid duplicate registrations and also allow tests to clean it up.
let rewardPointerUnregister: (() => void) | null = null

// A win song only restarts if AudioSource.playing actually CHANGES. The entity
// is created with playing: true and the runtime never clears that field when
// the clip ends, so writing true over true is a no-op for the CRDT and the
// second win is silent. The reuse path therefore writes false now and true on a
// later engine frame, through a one-shot system stored here so a burst of wins
// cannot stack several pending restarts on the same entity.
let pendingRestartSystem: ((dt: number) => void) | null = null

// Ask the engine to set playing = true on a later frame. Returns false when the
// runtime gives us no usable addSystem, so the caller can fall back to the old
// immediate write rather than leaving the song paused.
function scheduleAudioRestart(entity: Entity): boolean {
  const anyEngine = engine as any
  if (!anyEngine || typeof anyEngine.addSystem !== 'function') {
    return false
  }

  // A restart is already queued for this frame; do not stack a second one.
  if (pendingRestartSystem !== null) {
    return true
  }

  const system = (_dt: number) => {
    // Clear the slot and unregister first, so an exception below can never
    // leave a system running on every frame for the rest of the session.
    pendingRestartSystem = null
    try {
      if (typeof anyEngine.removeSystem === 'function') {
        anyEngine.removeSystem(system)
      }
    } catch (e) {
      console.warn('[reward] Error while removing the one-shot audio restart system:', e)
    }

    try {
      const audioSource = AudioSource.getMutable(entity)
      if (audioSource && typeof audioSource.playing === 'boolean') {
        audioSource.playing = true
      } else {
        console.warn('[reward] AudioSource missing or invalid when restarting the win song')
      }
    } catch (e) {
      console.warn('[reward] Exception while restarting the win song:', e)
    }
  }

  try {
    anyEngine.addSystem(system)
  } catch (e) {
    console.warn('[reward] Could not schedule the win-song restart; playing it immediately instead:', e)
    pendingRestartSystem = null
    return false
  }

  pendingRestartSystem = system
  return true
}

export function Reward() {
  if (rewardEntity !== null) {
    // Guard access to the AudioSource component so a missing or invalid
    // component does not throw and crash the scene for players.
    try {
      const audioSource = AudioSource.getMutable(rewardEntity)
      if (audioSource && typeof audioSource.playing === 'boolean') {
        // false now, true on the next frame: that transition is what makes the
        // clip play again on the second and every later win.
        audioSource.playing = false
        if (!scheduleAudioRestart(rewardEntity)) {
          audioSource.playing = true
        }
      } else {
        console.warn('[reward] AudioSource missing or invalid on reused reward entity; cannot start playback')
      }
    } catch (e) {
      console.warn('[reward] Exception while accessing AudioSource on reused reward entity:', e)
    }
    return
  }

  const reward = engine.addEntity()
  AudioSource.create(reward, {
    audioClipUrl: 'music/champ2.mp3',
    loop: false,
    playing: true,
  })
  GltfContainer.create(reward, {
    src: 'models/grass/FloorBaseGrass_01.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
  })
  // Move reward so it doesn't overlap scene grass at (16,0.01,16)
  Transform.create(reward, {
    position: { x: 16, y: 0.02, z: 18 },
    scale: { x: 2, y: 2, z: 2 },
    rotation: normalizeQuaternionOrIdentity({ x: 0, y: 0, z: 0, w: 1 }) // w should be 1 for a valid quaternion
  })

  // If we already have an unregister function, call it to avoid stacking handlers
  if (typeof rewardPointerUnregister === 'function') {
    try {
      rewardPointerUnregister()
    } catch (e) {
      console.warn('[reward] Error while calling previous reward pointer unregister:', e)
    }
    rewardPointerUnregister = null
  }

  const unregister = pointerEventsSystem.onPointerDown(
    {
      entity: reward,
      opts: { button: InputAction.IA_POINTER, hoverText: 'Play song again!', maxDistance: 100 },
    },
    () => { toggleSound(reward) }
  )

  // Store the returned cleanup function if the runtime provides one.
  if (typeof unregister === 'function') {
    rewardPointerUnregister = unregister
  } else {
    rewardPointerUnregister = null
  }

  rewardEntity = reward
}

export function toggleSound(entity: Entity) {
  // Defensive access: try/catch plus null and type checks ensure toggling
  // cannot throw if the component is missing or malformed.
  try {
    const audioSource = AudioSource.getMutable(entity)
    if (!audioSource) {
      console.warn('[reward] toggleSound: AudioSource.getMutable returned null or undefined')
      return
    }

    if (typeof audioSource.playing !== 'boolean') {
      console.warn('[reward] toggleSound: AudioSource.playing is not a boolean; skipping toggle')
      return
    }

    audioSource.playing = !audioSource.playing
  } catch (e) {
    console.warn('[reward] Exception while toggling AudioSource.playing:', e)
  }
}

// Test-only helper: reset the module-local rewardEntity so tests can run
// deterministically without needing to reload the module.
// NOTE: exported only for tests; do not use from production code.
export function __resetRewardEntityForTests() {
  // Unregister any pointer handler created for the reward and clear state.
  if (typeof rewardPointerUnregister === 'function') {
    try {
      rewardPointerUnregister()
    } catch (e) {
      console.warn('[reward] Error while calling rewardPointerUnregister in reset helper:', e)
    }
  }
  rewardPointerUnregister = null
  rewardEntity = null

  // Drop any queued win-song restart so it cannot fire into the next test.
  const pending = pendingRestartSystem
  pendingRestartSystem = null
  if (typeof pending === 'function') {
    try {
      const anyEngine = engine as any
      if (anyEngine && typeof anyEngine.removeSystem === 'function') {
        anyEngine.removeSystem(pending)
      }
    } catch (e) {
      console.warn('[reward] Error while removing a pending restart system in reset helper:', e)
    }
  }
}

// Test-only helper: run the queued one-shot restart system as the engine would
// on the next frame. Returns true when there was one to run.
// NOTE: exported only for tests; do not use from production code.
export function __flushPendingRewardRestartForTests(): boolean {
  const pending = pendingRestartSystem
  if (typeof pending !== 'function') {
    return false
  }
  pending(0)
  return true
}
