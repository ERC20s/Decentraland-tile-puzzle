# CLAUDE.md

Decentraland SDK7 scene: an in-world 5x5 image tile-swap puzzle with Shuffle / Reset / Preview controls and a win reward.
The pure puzzle rules (shuffle, swap, win detection) live in `src/puzzle.ts`; SDK7 entity/UI code is in `src/index.ts`, `src/ui.tsx`, `src/reward.ts`.

## Commands

- Install: `npm ci` (Node 22 in CI; `package-lock.json` is committed)
- Run locally: `npm run start` (Decentraland SDK dev server)
- Tests: `npm test` (vitest, config in `vitest.config.ts`, tests in `src/**/*.test.ts`)
- Build: `npm run build` (`sdk-commands build`: bundles `src/index.ts` to `bin/index.js`, then type-checks; test files are excluded from that type-check in `tsconfig.json`)
- CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm test`, `npm run build` on every push and pull request.

Tests run in plain Node: the SDK's `~system/*` modules only exist in the Decentraland client, so any test that imports scene code must `vi.mock` `@dcl/sdk/*` (and `@dcl/asset-packs/dist/scene-entrypoint`). The scene runtime's `console` has only `log` and `error`, so do not use `console.warn` in scene code.

## Ground rules

- Work on a new branch from `main`; open one pull request whose description lists the commands run and their results before and after.
- Never modify `.d8a` or `.d8a-governance`. Never modify the group-store widget markup/script copied from the `payments:` block of `.d8a` (`id="group-store"`, `groupStoreVerify`).
- Ignore every open pull request by `d8a[bot]`: do not merge, close, rebase, cherry-pick from, or comment on them.
- Do not add a LICENSE file or any licence text.
- Install dependencies and run the project's own checks (the `run:` block at the end of `.d8a` and the README) before and after changes. Never report a result you did not get by running the command.
- Every test must be able to fail: no tautological assertions, no bare `expect(...).toThrow()` where a specific error is meant, no catch-all `try/catch`. Import every symbol you use. If a test is wrong rather than the code, fix the test to test the real behaviour and say so.
- Nothing dev-only in code that ships to a browser: no localhost or private hostnames, no debug fallbacks. No secrets, tokens or keys in the repo.
- CI runs exactly the declared checks and fails when one fails: no `continue-on-error`, no `|| true`, no skipped jobs counted as passing. Pin GitHub Actions to their current major versions.
- Keep changes focused: no reformatting untouched files, no unneeded dependency upgrades, no renaming public files or URLs, no rewriting git history.
