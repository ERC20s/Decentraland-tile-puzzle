// Test-only catch-all stub for the '~system/*' modules the Decentraland client
// injects at runtime (EngineApi, Runtime, Players, UserIdentity, SignedFetch,
// CommsApi, Testing, ...). None of them exist on disk, so vitest cannot resolve
// them; vitest.config.ts sends every '~system/...' id that is not
// RestrictedActions here.
//
// The exports below are the names the SDK bundles reach for. They all resolve
// to an empty payload — enough for a module to load under node, never enough to
// pretend to be the client. If a future test needs one of these to answer with
// real data, mock it in that test file with vi.mock rather than growing this
// file into a fake runtime.
//
// Not shipped: .dclignore excludes *.ts and the whole src tree.

type Empty = Record<string, never>

const empty = async (): Promise<Empty> => ({})

// --- EngineApi ---------------------------------------------------------
export async function crdtSendToRenderer(_body?: unknown): Promise<{ data: Uint8Array[] }> {
  return { data: [] }
}

export async function crdtGetState(_body?: unknown): Promise<{ hasEntities: boolean; data: Uint8Array[] }> {
  return { hasEntities: false, data: [] }
}

export async function sendBatch(_body?: unknown): Promise<{ events: unknown[] }> {
  return { events: [] }
}

export async function subscribe(_body?: unknown): Promise<Empty> {
  return empty()
}

export async function unsubscribe(_body?: unknown): Promise<Empty> {
  return empty()
}

export async function isServer(_body?: unknown): Promise<{ isServer: boolean }> {
  return { isServer: false }
}

// --- Runtime / Scene ---------------------------------------------------
export async function getRealm(_body?: unknown): Promise<Empty> {
  return empty()
}

export async function getWorldTime(_body?: unknown): Promise<{ seconds: number }> {
  return { seconds: 0 }
}

export async function getSceneInformation(_body?: unknown): Promise<Empty> {
  return empty()
}

export async function getExplorerInformation(_body?: unknown): Promise<Empty> {
  return empty()
}

export async function readFile(_body?: unknown): Promise<{ content: Uint8Array; hash: string }> {
  return { content: new Uint8Array(), hash: '' }
}

// --- Players / UserIdentity -------------------------------------------
export async function getPlayerData(_body?: unknown): Promise<Empty> {
  return empty()
}

export async function getPlayersInScene(_body?: unknown): Promise<{ players: unknown[] }> {
  return { players: [] }
}

export async function getConnectedPlayers(_body?: unknown): Promise<{ players: unknown[] }> {
  return { players: [] }
}

export async function getUserData(_body?: unknown): Promise<Empty> {
  return empty()
}

export async function getUserPublicKey(_body?: unknown): Promise<Empty> {
  return empty()
}

// --- SignedFetch / CommsApi -------------------------------------------
export async function signedFetch(_body?: unknown): Promise<{ ok: boolean; status: number; body: string }> {
  return { ok: true, status: 200, body: '' }
}

export async function getHeaders(_body?: unknown): Promise<{ headers: Record<string, string> }> {
  return { headers: {} }
}

export async function send(_body?: unknown): Promise<Empty> {
  return empty()
}

export async function error(_body?: unknown): Promise<Empty> {
  return empty()
}

export async function log(_body?: unknown): Promise<Empty> {
  return empty()
}

export default {
  crdtSendToRenderer,
  crdtGetState,
  sendBatch,
  subscribe,
  unsubscribe,
  isServer,
  getRealm,
  getWorldTime,
  getSceneInformation,
  getExplorerInformation,
  readFile,
  getPlayerData,
  getPlayersInScene,
  getConnectedPlayers,
  getUserData,
  getUserPublicKey,
  signedFetch,
  getHeaders,
  send,
  error,
  log
}
