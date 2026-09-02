Decentraland Tile Puzzle

A Decentraland SDK7 scene that renders an image tile-swap puzzle in-world, with a shuffle control and a win reward.

Setup

Requirements: Node.js >=16.0.0, npm >=6.0.0 (declared in package.json)

- npm i
- npm run start    (runs the scene locally with the Decentraland SDK dev server)
- npm run build    (compiles the scene; runs "sdk-commands build" as declared in package.json)
- npm run deploy   (publishes the scene; runs "sdk-commands deploy" as declared in package.json)

Running the tests

- npm test          (runs "vitest run" as declared in package.json; runs every src/**/*.test.ts once and exits)

The suite runs under plain Node, outside the Decentraland runtime, so vitest.config.ts supplies what the runtime normally would:

- test.globals is true, so tests may use bare test/expect/afterEach; the test files also import them from 'vitest' explicitly.
- esbuild.jsxFactory is 'ReactEcs.createElement' (jsxFragment 'ReactEcs.Fragment'), because src/ui.tsx uses the ReactEcs pragma rather than React.
- resolve.alias maps '~system/<name>' to test/stubs/system/<name>.ts. Those modules (for example '~system/RestrictedActions', imported by src/index.ts) exist only inside the scene runtime and cannot be resolved by Node. Add a new stub file to test/stubs/system/ when the scene starts importing another '~system' module.

Tests that exercise scene code mock the SDK per file with vi.mock('@dcl/sdk/ecs'), vi.mock('@dcl/sdk/react-ecs') and vi.mock('@dcl/sdk/math') — see src/index.test.ts, src/reward.test.ts and src/ui.test.ts. Keep those mocks in the test file rather than making them global, so a test can still opt into the real module.

Features

- 5x5 image tile grid. src/ui.tsx builds a fixed grid (gridRows = 5, gridCols = 5, 25 tiles) from 25 numbered tile images.
- Click-and-drag tile swapping. Click a tile to pick it up (DragThis highlights it), then click a second tile to drop it (DropThat) and the two tile images swap in place.
- Shuffle / New Game button. The Shuffle button in the UI calls ShuffleBoard, which reshuffles the tile images and clears any in-progress drag so a fresh puzzle can be played without reloading the scene.
- Win detection and reward. When every tile's image matches its original position (checkIfOriginalImages), the puzzle calls Reward() in src/reward.ts, which spawns a single reusable reward entity, plays a win song (music/champ2.mp3), and shows a grass model.
- Mute / replay toggle. Clicking the reward entity in-world calls toggleSound, which flips the win song between playing and paused, so players can silence it or play it again on demand.
- Close / reopen panel. The X button hides the puzzle UI; the resulting "open" button brings it back.

Roadmap

The following are proposed but not yet merged into this repository. They are tracked as open governance proposals in the Decentraland Tile Puzzle group and will be reflected here once code lands:

- Dynamic image-splitting and multiple difficulty levels (proposal #3): automatically slice a chosen image into tiles and support grid sizes other than the current fixed 5x5.
- In-scene chatbox (proposal #2): add a chat UI element to the puzzle scene.

Project layout

- src/index.ts: scene entry point.
- src/ui.tsx: puzzle grid, drag-and-drop, and shuffle UI.
- src/reward.ts: win song and reward entity, including the mute/replay toggle.
- scene.json: the SDK7 scene manifest (metadata, main entry point, permissions) that Decentraland reads to load the scene.
- main.crdt: the compiled scene/entity state SDK7 generates from the composite, used at runtime.
- assets/scene/main.composite: the composite entity layout authored in the Decentraland builder that produces main.crdt.
- models/machine.glb: the 3D model used for the reward entity referenced in src/reward.ts.
- models/grass/FloorBaseGrass_01.glb and models/grass/Floor_Grass01.png.png: the grass floor model and its texture, shown as part of the win reward.
- images/: the 25 numbered tile images (image1x1.png through image5x5.png) that fill the 5x5 puzzle grid built in src/ui.tsx.
- music/: the win-song audio files (champ.mp3, champ2.mp3, champ3.mp3) played by the reward entity in src/reward.ts.
- .dclignore: lists files excluded when the scene is deployed.

Troubleshooting: Creator Hub "The launch link is not trusted" / creator-hub-bin-path

Users have reported seeing the Creator Hub error: "The launch link is not trusted" that mentions creator-hub-bin-path. This error often indicates a mismatch between what Creator Hub expects in the packaged scene and what is present locally (for example the compiled runtime bundle or packaging rules), rather than a runtime bug inside this project's source code. Add these checks when you encounter the error:

- Verify scene.json points at the compiled runtime bundle. In this repository scene.json currently declares the runtime entry as: "main": "bin/index.js". If that value differs from the file you build, Creator Hub may refuse to launch.
- Ensure you have run the build step so bin/index.js exists. package.json includes the build script: "build": "sdk-commands build". Run npm run build before using Creator Hub so the bin/ bundle and other build artifacts are generated.
- Confirm bin/ and main.crdt are present in the project root and are not excluded by .dclignore. If the compiled bundle or main.crdt are missing from the upload package, Creator Hub can report trust/packaging errors.
- If the error persists, retry the Creator Hub tool and check Creator Hub's trust/permissions settings. Collect the full exact error text and the local environment details (node --version, npm --version, the SDK version from package.json or package-lock), and whether you ran npm run build immediately before launching. These details make it easier to triage whether the cause is local packaging, a Creator Hub client bug, or something else.

Why this matters

- Two members reported the same launch error in the suggestions box. Documenting the most likely local causes will reduce repeated tickets, speed onboarding, and help contributors collect reproducible diagnostics for external issues.

Risks and trade-offs

- If the root cause is a Creator Hub binary bug, this documentation will not fix the bug itself; it will, however, give steps to reproduce and gather useful information for a follow-up report.
- This is a documentation-only change; it does not modify runtime behaviour or tests.

How we will verify success

- A contributor follows the README steps on a fresh environment and either succeeds in launching Creator Hub after running npm run build or can capture the exact error text and environment details for a bug report. A reduction in repeated unclear reports about the Creator Hub launch error will also indicate this helped.

If this passes, a contributor will open a pull request that adds the Troubleshooting section to README.md; a separate Code proposal will be opened to merge that pull request.
