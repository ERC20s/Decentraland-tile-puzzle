// We define the empty imports so the auto-complete feature works as expected.
import { } from '@dcl/sdk/math'
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs'
import { initAssetPacks } from '@dcl/asset-packs/dist/scene-entrypoint'
import { setupUi } from './ui'
import { openExternalUrl, movePlayerTo } from '~system/RestrictedActions'
import { Reward } from './reward'
import { normalizeQuaternionOrIdentity } from './quat'

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

// Module-local storage for the machine pointer unregister function so we
// can avoid duplicate registrations or explicitly unregister during tests.
let machinePointerUnregister: (() => void) | null = null

export async function main() {
  const grass = engine.addEntity();
  GltfContainer.create(grass, {
    src: 'models/grass/FloorBaseGrass_01.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
  });
  Transform.create(grass, { 
    position: { x: 16, y: 0.01, z: 16 }, 
    scale: { x: 2, y: 2, z: 2 }, 
    rotation: normalizeQuaternionOrIdentity({ x: 0, y: 0, z: 0, w: 1 }) // w must be 1 for a valid (identity) quaternion
  });


  const machine = engine.addEntity();
  GltfContainer.create(machine, {
    src: 'models/machine.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
  });
  Transform.create(machine, { 
    position: { x: 8, y: 0, z: 8 }, 
    scale: { x: 0.75, y: 0.75, z: 0.75 }, 
    rotation: normalizeQuaternionOrIdentity({ x: 0, y: Math.sin(3 * Math.PI / 4), z: 0, w: Math.cos(3 * Math.PI / 4) })
  });

  // If we already have an unregister function, call it to avoid stacking handlers
  if (typeof machinePointerUnregister === 'function') {
    try {
      machinePointerUnregister()
    } catch (e) {
      console.warn('[main] Error while calling previous machine pointer unregister:', e)
    }
    machinePointerUnregister = null
  }

  const unregister = pointerEventsSystem.onPointerDown(
    {
      entity: machine,
      opts: { button: InputAction.IA_POINTER, hoverText: 'Enter the Machine', maxDistance: 100,  },
    },
    () => { setupUi();}
  )

  // Store the returned cleanup function if the runtime provides one.
  if (typeof unregister === 'function') {
    machinePointerUnregister = unregister
  } else {
    machinePointerUnregister = null
  }
}

// Test-only helper: unregister the machine pointer handler and clear its storage
// NOTE: exported only for tests; do not use from production code.
export function __resetMainForTests() {
  if (typeof machinePointerUnregister === 'function') {
    try {
      machinePointerUnregister()
    } catch (e) {
      console.warn('[main] Error while calling machinePointerUnregister in reset helper:', e)
    }
  }
  machinePointerUnregister = null
}
