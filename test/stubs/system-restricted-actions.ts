// Test-only stub for '~system/RestrictedActions'.
//
// The real module is injected by the Decentraland client; it does not exist on
// disk, so vitest cannot resolve it. vitest.config.ts aliases the id here.
// Every function is an async no-op that resolves to an empty payload: the tests
// only ever need the module to LOAD, and a scene that really called one of
// these under test should fail loudly in review, not silently teleport.
//
// Not shipped: .dclignore excludes *.ts and the whole src tree.

export async function openExternalUrl(_body?: { url: string }): Promise<Record<string, never>> {
  return {}
}

export async function movePlayerTo(_body?: unknown): Promise<Record<string, never>> {
  return {}
}

export async function teleportTo(_body?: unknown): Promise<Record<string, never>> {
  return {}
}

export async function triggerEmote(_body?: unknown): Promise<Record<string, never>> {
  return {}
}

export async function triggerSceneEmote(_body?: unknown): Promise<Record<string, never>> {
  return {}
}

export async function changeRealm(_body?: unknown): Promise<Record<string, never>> {
  return {}
}

export async function openNftDialog(_body?: unknown): Promise<Record<string, never>> {
  return {}
}

export async function setCommunicationsAdapter(_body?: unknown): Promise<Record<string, never>> {
  return {}
}

export default {
  openExternalUrl,
  movePlayerTo,
  teleportTo,
  triggerEmote,
  triggerSceneEmote,
  changeRealm,
  openNftDialog,
  setCommunicationsAdapter
}
