import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs';

export function Reward() {
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
  Transform.create(reward, { 
    position: { x: 16, y: 0.02, z: 16 }, 
    scale: { x: 2, y: 2, z: 2 }, 
    rotation: { x: 0, y: 0, z: 0, w: 1 } // w should be 1 for a valid quaternion
  })
  function stopSound(entity: Entity) {
    const audioSource = AudioSource.getMutable(entity)
  
    audioSource.playing != audioSource.playing
  }


  pointerEventsSystem.onPointerDown(
    {
      entity: reward,
      opts: { button: InputAction.IA_POINTER, hoverText: 'Play song again!', maxDistance: 100 },
    },
    () => {   stopSound(reward) }
  )
}