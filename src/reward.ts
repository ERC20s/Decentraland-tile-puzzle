import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs';

// The reward is ONE scene entity, created on the first win and reused on every
// win after it. Building it per win stacked another grass mesh and another
// AudioSource on the same spot each time the puzzle was re-solved, and left the
// old pointer handlers registered.
let rewardEntity: Entity | null = null

export function Reward(track?: string) {
  const clip = track ?? 'music/champ2.mp3'

  // If the reward entity already exists, try to update its AudioSource in a
  // supported way. If that fails, create/replace the AudioSource on the same
  // entity so the selected clip will play. We avoid re-creating the whole
  // entity so we do not re-register pointer handlers.
  if (rewardEntity !== null) {
    try {
      const audio = AudioSource.getMutable(rewardEntity)
      if (audio) {
        // Some SDK typings can be strict about audioClipUrl; do a defensive any
        // assignment instead of relying on internal-only mutations.
        try {
          (audio as any).audioClipUrl = clip
          audio.loop = false
          audio.playing = true
          return
        } catch (e) {
          // Fall through to recreate AudioSource below
        }
      }
    } catch (e) {
      // fall back to replace the AudioSource
    }

    // Fallback: (re)create the AudioSource component on the existing entity.
    // This keeps the same entity (and its pointer handlers/transform) but
    // replaces the audio component so the chosen clip will play.
    AudioSource.create(rewardEntity, {
      audioClipUrl: clip,
      loop: false,
      playing: true,
    })
    return
  }

  // First time creation: build the reward entity with the requested clip.
  const reward = engine.addEntity()
  AudioSource.create(reward, {
    audioClipUrl: clip,
    loop: false,
    playing: true,
  })
  GltfContainer.create(reward, {
    src: 'models/grass/FloorBaseGrass_01.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
  })
  Transform.create(reward, {
    position: { x: 16, y: 0.02, z: 16 },
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
  const audioSource = AudioSource.getMutable(entity)
  if (!audioSource) return

  // Flip playback state defensively.
  audioSource.playing = !audioSource.playing
}
