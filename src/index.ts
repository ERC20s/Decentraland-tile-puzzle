// We define the empty imports so the auto-complete feature works as expected.
import { } from '@dcl/sdk/math'
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs'
import { initAssetPacks } from '@dcl/asset-packs/dist/scene-entrypoint'
import { setupUi } from './ui'
import { Reward } from './reward'
import { normalizeQuaternionOrIdentity } from './quat'

// Asset-pack initialisation used to run at module scope, so merely IMPORTING
// this file (a test runner, a type check, any tool outside the Decentraland
// client) ran it as a side effect. It now runs as the first statement of
// main(), before any entity work, and only once — the same shape #200/#201
// gave the grass and machine entities.
let assetPacksInitialised = false
let assetPacksInitPromise: Promise<void> | null = null

async function initAssetPacksOnce(): Promise<void> {
  // If we've already completed initialisation, nothing to do.
  if (assetPacksInitialised) return

  // If initialisation is in progress, wait for it to finish.
  if (assetPacksInitPromise) {
    return assetPacksInitPromise
  }

  // Start initialisation and remember the promise so concurrent callers
  // can await the same work instead of invoking initAssetPacks again.
  assetPacksInitPromise = (async () => {
    try {
      await initAssetPacks(engine, pointerEventsSystem, {
        Animator,
        AudioSource,
        AvatarAttach,
        Transform,
        VisibilityComponent,
        GltfContainer,
        Material,
        VideoPlayer
      })
      assetPacksInitialised = true
    } catch (e) {
      // Clear the stored promise so callers can retry if initialisation failed.
      assetPacksInitPromise = null
      throw e
    }
  })()

  return assetPacksInitPromise
}

// Module-local storage for the machine pointer unregister function so we
// can avoid duplicate registrations or explicitly unregister during tests.
let machinePointerUnregister: (() => void) | null = null

// The scene owns ONE grass mesh and ONE machine, created on the first main()
// and reused on every call after it. Building them per call stacked another
// grass mesh at (16, 0.01, 16) and another machine inside the first, both with
// pointer colliders and neither ever removed — the same defect src/reward.ts
// already fixed for the reward entity. Positions, scales and rotations are
// constants, so a later call has nothing to refresh.
let grassEntity: Entity | null = null
let machineEntity: Entity | null = null

export async function main() {
  // First statement: the asset packs must be ready before any entity work.
  await initAssetPacksOnce()

  if (grassEntity === null) {
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
    grassEntity = grass
  }


  if (machineEntity === null) {
    const created = engine.addEntity();
    GltfContainer.create(created, {
      src: 'models/machine.glb',
      visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
    });
    Transform.create(created, {
      position: { x: 8, y: 0, z: 8 },
      scale: { x: 0.75, y: 0.75, z: 0.75 },
      rotation: normalizeQuaternionOrIdentity({ x: 0, y: Math.sin(3 * Math.PI / 4), z: 0, w: Math.cos(3 * Math.PI / 4) })
    });
    machineEntity = created
  }

  // Always the stored machine: a second call re-registers the pointer handler
  // on the entity that already exists rather than on a fresh duplicate.
  const machine = machineEntity

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
    () => {
      // setupUi() builds the UI tree; if it throws we must not let the
      // exception escape into the pointer-event callback stack, where it can
      // disrupt the rest of the scene. Log it and keep the scene running.
      try {
        setupUi()
      } catch (e) {
        console.warn('[main] setupUi() threw while handling machine pointer down:', e)
      }
    }
  )

  // Store the returned cleanup function if the runtime provides one.
  if (typeof unregister === 'function') {
    machinePointerUnregister = unregister
  } else {
    machinePointerUnregister = null
  }
}

// Test-only helper: unregister the machine pointer handler and clear the stored
// scene entities so the next main() builds a fresh grass and machine.
// NOTE: exported only for tests; do not use from production code. It does not
// call engine.removeEntity — the scene keeps one grass and one machine for its
// whole life, and the test SDK mock provides no removeEntity.
export function __resetMainForTests() {
  if (typeof machinePointerUnregister === 'function') {
    try {
      machinePointerUnregister()
    } catch (e) {
      console.warn('[main] Error while calling machinePointerUnregister in reset helper:', e)
    }
  }
  machinePointerUnregister = null
  grassEntity = null
  machineEntity = null
  assetPacksInitialised = false
  assetPacksInitPromise = null
}
