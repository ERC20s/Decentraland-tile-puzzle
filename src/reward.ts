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

export function Reward() {
  if (rewardEntity !== null) {
    // Guard access to the AudioSource component so a missing or invalid
    // component does not throw and crash the scene for players.
    try {
      const audioSource = AudioSource.getMutable(rewardEntity)
      if (audioSource && typeof audioSource.playing === 'boolean') {
        audioSource.playing = true
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
}
