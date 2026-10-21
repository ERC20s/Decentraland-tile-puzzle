import { defineConfig } from 'vitest/config'

// Unit tests run in plain Node. The SDK7 runtime modules ('~system/*') exist
// only inside the Decentraland client, so tests that touch scene code mock
// '@dcl/sdk/*' themselves; the puzzle rules in src/puzzle.ts need no SDK.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
