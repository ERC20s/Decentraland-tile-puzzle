// Test-only stub for '@dcl/asset-packs/dist/scene-entrypoint'.
//
// src/index.ts calls initAssetPacks(engine, pointerEventsSystem, { ...components })
// at MODULE LOAD. Under vitest the engine is whatever tiny object the test file
// mocked '@dcl/sdk/ecs' with, and the real initAssetPacks walks it expecting the
// full SDK — so importing src/index.ts blew up before a single assertion ran.
//
// The stub records nothing and does nothing: the scene-entrypoint wiring is a
// client concern the unit tests do not assert on. A test that ever needs to
// check it should mock this module itself with vi.mock.
//
// Not shipped: .dclignore excludes *.ts and the whole src tree.

export function initAssetPacks(_engine?: unknown, _pointerEventsSystem?: unknown, _components?: unknown): void {
  /* no-op under test */
}

export default { initAssetPacks }
