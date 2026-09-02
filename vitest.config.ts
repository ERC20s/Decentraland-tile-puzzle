import path from 'path'
import { defineConfig } from 'vitest/config'

// The scene is written against the Decentraland SDK7 runtime, so a plain Node
// test run needs three things that the runtime normally provides:
//
//  1. JSX: src/ui.tsx uses the ReactEcs pragma (`import ReactEcs from
//     '@dcl/sdk/react-ecs'`), not React. esbuild has to be told the factory,
//     because tsconfig.json only sets "jsx": "react" and inherits the rest from
//     @dcl/sdk/types/tsconfig.ecs7.json.
//  2. '~system/*': those modules exist only inside the Decentraland runtime and
//     cannot be resolved by Node, so they are aliased to local stubs under
//     test/stubs/system/.
//  3. Globals: src/puzzle.test.ts and src/ui.test.ts were written with bare
//     test()/expect()/afterEach(). Vitest's globals are off by default, so they
//     are switched on here (the test files also import them explicitly, which
//     keeps them type-correct for `sdk-commands build`).
//
// `process.cwd()` is the repository root when the suite is started with
// `npm test`, which is the only supported way to run it.
const rootDir = process.cwd()

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^~system\/(.*)$/,
        replacement: path.resolve(rootDir, 'test/stubs/system') + '/$1.ts'
      }
    ]
  },
  esbuild: {
    jsxFactory: 'ReactEcs.createElement',
    jsxFragment: 'ReactEcs.Fragment'
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
