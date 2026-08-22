import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs';

// The reward is ONE scene entity, created on the first win and reused on every
// win after it. Building it per win stacked another grass mesh and another
// AudioSource on the same spot each time the puzzle was re-solved, and left the
// old pointer handlers registered.
let rewardEntity: Entity | null = null

export function Reward(track?: string) {
  const selectedTrack = track ?? 'music/champ2.mp3'

  if (rewardEntity !== null) {
    // Preserve the current playing state if possible, then replace the AudioSource
    let existingPlaying = true
    try {
      existingPlaying = AudioSource.getMutable(rewardEntity).playing
    } catch {
      // If we cannot read the mutable component, assume it was playing to avoid
      // silently muting the reward when updating the clip.
      existingPlaying = true
    }

    // Safely replace the AudioSource component so we don't call create on an
    // entity that already has the component and risk throwing.
    AudioSource.createOrReplace(rewardEntity, {
      audioClipUrl: selectedTrack,
      loop: false,
      playing: existingPlaying,
    })

    return
  }

  const reward = engine.addEntity()
  AudioSource.create(reward, {
    audioClipUrl: selectedTrack,
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
  // Guard reads/updates to AudioSource so we don't crash if the component is
  // missing or the mutable accessor throws.
  try {
    const audioSource = AudioSource.getMutable(entity)
    audioSource.playing = !audioSource.playing
  } catch {
    // If we cannot access the AudioSource, do nothing rather than throw.
    return
  }
}
