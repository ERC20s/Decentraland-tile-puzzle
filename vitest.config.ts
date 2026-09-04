import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Why this file exists
// --------------------
// The suite in src/*.test.ts is the only safety net this scene has, and until
// now it could not be started: `npm test` is `vitest run`, and vitest resolves
// imports like a normal bundler.
//
// Two module ids in the scene source are NOT npm packages:
//
//   - '~system/...'  — injected by the Decentraland client at runtime and only
//     DECLARED to TypeScript as ambient types through the tsconfig that
//     @dcl/sdk extends. Nothing on disk answers that id, so any test that
//     reaches src/index.ts or the SDK bundles fails while resolving it.
//   - '@dcl/asset-packs/dist/scene-entrypoint' — a real file, but its
//     initAssetPacks() runs at module load against the tiny engine mocks the
//     tests define.
//
// Both are aliased to the minimal, test-only stubs in test/stubs/. The stubs
// are deliberately dumb: they exist so a module can be LOADED under node, never
// to emulate client behaviour. Nothing here changes what ships to the scene —
// .dclignore already excludes *.ts, .* and src, so neither this config nor the
// stubs are deployed.
const stubs = path.resolve(__dirname, 'test/stubs')

export default defineConfig({
  // src/ui.tsx is written with the SDK's JSX runtime. Setting it here rather
  // than leaning on the tsconfig chain keeps the transform correct even when
  // esbuild does not follow the "extends": "@dcl/sdk/types/..." hop.
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'ReactEcs.createElement',
    jsxFragment: 'ReactEcs.Fragment'
  },
  resolve: {
    alias: [
      // The specific stub first: src/index.ts named openExternalUrl /
      // movePlayerTo from this one, and the SDK may pull it in as well.
      {
        find: /^~system\/RestrictedActions$/,
        replacement: path.join(stubs, 'system-restricted-actions.ts')
      },
      // Everything else the client injects (EngineApi, Runtime, Players,
      // UserIdentity, SignedFetch, ...) resolves to one permissive stub, so a
      // module the suite happens to load can never fail on an unresolvable id.
      {
        find: /^~system\/.*$/,
        replacement: path.join(stubs, 'system-module.ts')
      },
      {
        find: /^@dcl\/asset-packs\/dist\/scene-entrypoint$/,
        replacement: path.join(stubs, 'asset-packs-scene-entrypoint.ts')
      }
    ]
  },
  test: {
    // src/ui.test.ts and src/puzzle.test.ts call test/expect/afterEach without
    // importing them from 'vitest'; the other six files import explicitly.
    // Globals keeps both styles running.
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
})
