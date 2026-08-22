import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs';

// The reward is ONE scene entity, created on the first win and reused on every
// win after it. Building it per win stacked another grass mesh and another
// AudioSource on the same spot each time the puzzle was re-solved, and left the
// old pointer handlers registered.
let rewardEntity: Entity | null = null

export function Reward(track?: string) {
  if (rewardEntity !== null) {
    const audio = AudioSource.getMutable(rewardEntity)
    if (track) {
      // update the audio clip if a different track is requested
      // audioClipUrl is writable on the mutable AudioSource in this SDK
      // so we can swap which file plays for subsequent wins without recreating the entity
      // (if the runtime doesn't allow changing the url, the first-selected track will still play)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      audio.audioClipUrl = track
    }
    audio.playing = true
    return
  }

  const reward = engine.addEntity()
  AudioSource.create(reward, {
    audioClipUrl: track ?? 'music/champ2.mp3',
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

  // Was `audioSource.playing != audioSource.playing` — a comparison of the field
  // with itself whose result was thrown away, so the button did nothing at all.
  audioSource.playing = !audioSource.playing
}
