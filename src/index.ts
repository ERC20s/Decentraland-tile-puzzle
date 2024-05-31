// We define the empty imports so the auto-complete feature works as expected.
import { } from '@dcl/sdk/math'
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs'
import { initAssetPacks } from '@dcl/asset-packs/dist/scene-entrypoint'
import { setupUi } from './ui'
import { openExternalUrl, movePlayerTo } from '~system/RestrictedActions'
import { Reward } from './reward'

initAssetPacks(engine, pointerEventsSystem, {
  Animator,
  AudioSource,
  AvatarAttach,
  Transform,
  VisibilityComponent,
  GltfContainer,
  Material,
  VideoPlayer
})



export async function main() {
  const grass = engine.addEntity();
  GltfContainer.create(grass, {
    src: 'models/grass/FloorBaseGrass_01.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
  });
  Transform.create(grass, { 
    position: { x: 16, y: 0.01, z: 16 }, 
    scale: { x: 2, y: 2, z: 2 }, 
    rotation: { x: 0, y: 0, z: 0, w: 0 } 
  });


  const machine = engine.addEntity();
  GltfContainer.create(machine, {
    src: 'models/machine.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
  });
  Transform.create(machine, { 
    position: { x: 8, y: 0, z: 8 }, 
    scale: { x: 0.75, y: 0.75, z: 0.75 }, 
    rotation: { x: 0, y: Math.sin(3 * Math.PI / 4), z: 0, w: Math.cos(3 * Math.PI / 4) }
  });

  pointerEventsSystem.onPointerDown(
    {
      entity: machine,
      opts: { button: InputAction.IA_POINTER, hoverText: 'Enter the Machine', maxDistance: 100,  },
    },
    () => { setupUi();}
  );

}
