import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs';

// The reward is ONE scene entity, created on the first win and reused on every
// win after it. Building it per win stacked another grass mesh and another
// AudioSource on the same spot each time the puzzle was re-solved, and left the
// old pointer handlers registered.
let rewardEntity: Entity | null = null

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
    rotation: { x: 0, y: 0, z: 0, w: 1 } // w should be 1 for a valid quaternion
  })

  pointerEventsSystem.onPointerDown(
    {
      entity: reward,
      opts: { button: InputAction.IA_POINTER, hoverText: 'Play song again!', maxDistance: 100 },
    },
    () => { toggleSound(reward) }
  )

  rewardEntity = reward
}

function toggleSound(entity: Entity) {
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
