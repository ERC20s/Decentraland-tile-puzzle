Decentraland Tile Puzzle

A Decentraland SDK7 scene that renders an image tile-swap puzzle in-world, with a shuffle control and a win reward.

Setup

Requirements: Node.js >=16.0.0, npm >=6.0.0 (declared in package.json)

- npm i
- npm run start    (runs the scene locally with the Decentraland SDK dev server)
- npm run build    (compiles the scene; runs "sdk-commands build" as declared in package.json)
- npm run deploy   (publishes the scene; runs "sdk-commands deploy" as declared in package.json)

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

Quaternion safety and tests

This project includes runtime guards and unit-tests to avoid invalid quaternions that can crash or mis-rotate scene entities. The helper that implements the guard is in src/quat.ts and is exported as normalizeQuaternionOrIdentity(q).

- What normalizeQuaternionOrIdentity does: it validates that q.x, q.y, q.z and q.w are finite numbers, computes the quaternion norm, returns a normalized quaternion when the norm is finite and larger than Number.EPSILON, and otherwise returns the identity quaternion { x:0, y:0, z:0, w:1 } to avoid divide-by-zero or non-finite results. See src/quat.ts for the exact logic.
- Where it is used: callers wrap rotation literals before passing them to Transform.create, for example in src/index.ts: Transform.create(..., rotation: normalizeQuaternionOrIdentity({ x: 0, y: 0, z: 0, w: 1 })) and in src/reward.ts: Transform.create(..., rotation: normalizeQuaternionOrIdentity({ x: 0, y: 0, z: 0, w: 1 })).
- Tests that will fail when unsafe quaternions are introduced: src/quat.test.ts (unit tests for the helper), src/scene-assets.test.ts (scans assets/scene/main.composite for all-zero or non-finite quaternion literals), plus integration checks exercised by src/index.test.ts and src/reward.test.ts.

Contributor guidance

- Always wrap literal rotation objects with normalizeQuaternionOrIdentity before passing them to Transform.create. Example: rotation: normalizeQuaternionOrIdentity({ x:0, y:0, z:0, w:1 }).
- Prefer using w = 1 for identity rotations rather than { x:0, y:0, z:0, w:0 } which is invalid.
- Run the test suite locally (npm test) before opening a PR; scene-assets.test.ts checks composite assets for quaternion literals.

Reviewer checklist

- Run npm test and verify all tests pass.
- If scene-assets.test.ts reports a bad quaternion in assets/scene/main.composite, inspect the composite and the source that authored it; fix the source rather than suppressing the test.
- Ensure code changes wrap quaternion literals with normalizeQuaternionOrIdentity.

Risks and trade-offs

- Low risk: documentation-only change. If code paths or file names change later, update this section during maintenance.

How we will verify success

- The README contains this new section and examples. Contributors follow it and fewer PR comments are required about quaternion usage; npm test still exercises the same safeguards and points to the failing test file when a bad quaternion is added.

Troubleshooting: Creator Hub "The launch link is not trusted" / creator-hub-bin-path

Users have reported seeing the Creator Hub error: "The launch link is not trusted" that mentions creator-hub-bin-path. This error often indicates a mismatch between what Creator Hub expects in the packaged scene and what is present locally (for example the compiled runtime bundle or packaging rules), rather than a runtime bug inside this project's source code. Add these checks when you encounter the error:

- Verify scene.json points at the compiled runtime bundle. In this repository scene.json currently declares the runtime entry as: "main": "bin/index.js". If that value differs from the file you build, Creator Hub may refuse to launch.
- Ensure you have run the build step so bin/index.js exists. package.json includes the build script: "build": "sdk-commands build". Run npm run build before using Creator Hub so the bin/ bundle and other build artifacts are generated.
- Confirm bin/ and main.crdt are present in the project root and are not excluded by .dclignore. If the compiled bundle or main.crdt are missing from the upload package, Creator Hub can report trust/packaging errors.
- If the error persists, retry the Creator Hub tool and check Creator Hub's trust/permissions settings. Collect the full exact error text and the local environment details (node --version, npm --version, the SDK version from package.json or package-lock), and whether you ran npm run build immediately before launching. These details make it easier to triage whether the cause is local packaging, a Creator Hub client bug, or something else.

Why this matters

- Two members reported the same launch error in the suggestions box. Documenting the most likely local causes will reduce repeated tickets, speed onboarding, and help contributors collect reproducible diagnostics for external issues.

If this passes, a contributor will open a pull request that adds the "Quaternion safety and tests" section to README.md and a separate Code proposal will be opened to merge that pull request.