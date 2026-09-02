// Test stub for the Decentraland runtime module '~system/RestrictedActions'.
//
// src/index.ts imports openExternalUrl and movePlayerTo from this module. The
// real module is injected by the scene runtime and cannot be resolved by Node,
// so vitest.config.ts aliases '~system/*' to this folder. Every export is a
// no-op that resolves, so importing the scene entry point under test does not
// crash and nothing is actually sent to a player.

export async function openExternalUrl(_body: { url: string }): Promise<Record<string, never>> {
  return {}
}

export async function movePlayerTo(_body: {
  newRelativePosition: { x: number; y: number; z: number }
  cameraTarget?: { x: number; y: number; z: number }
}): Promise<Record<string, never>> {
  return {}
}

export async function teleportTo(_body: { worldCoordinates: { x: number; y: number } }): Promise<Record<string, never>> {
  return {}
}

export async function triggerEmote(_body: { predefinedEmote: string }): Promise<Record<string, never>> {
  return {}
}

export async function triggerSceneEmote(_body: { src: string; loop?: boolean }): Promise<Record<string, never>> {
  return {}
}

export async function changeRealm(_body: { realm: string; message?: string }): Promise<Record<string, never>> {
  return {}
}

export async function openNftDialog(_body: { urn: string }): Promise<Record<string, never>> {
  return {}
}

export default {
  openExternalUrl,
  movePlayerTo,
  teleportTo,
  triggerEmote,
  triggerSceneEmote,
  changeRealm,
  openNftDialog
}
