// Test stub for the Decentraland runtime module '~system/EngineApi'.
//
// Nothing in src/ imports this module directly today, but the SDK pulls it in
// whenever a real '@dcl/sdk/ecs' module is loaded outside the runtime. It is
// stubbed here so that adding such an import later does not break the suite
// again. vitest.config.ts aliases '~system/*' to this folder.

export async function crdtSendToRenderer(_body: { data: Uint8Array }): Promise<{ data: Uint8Array[] }> {
  return { data: [] }
}

export async function crdtGetState(): Promise<{ hasEntities: boolean; data: Uint8Array[] }> {
  return { hasEntities: false, data: [] }
}

export async function sendBatch(): Promise<{ events: unknown[] }> {
  return { events: [] }
}

export async function subscribe(_body: { eventId: string }): Promise<Record<string, never>> {
  return {}
}

export async function unsubscribe(_body: { eventId: string }): Promise<Record<string, never>> {
  return {}
}

export default {
  crdtSendToRenderer,
  crdtGetState,
  sendBatch,
  subscribe,
  unsubscribe
}
