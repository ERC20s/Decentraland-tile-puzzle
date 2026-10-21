Decentraland Tile Puzzle

A Decentraland SDK7 scene that renders an image tile-swap puzzle in-world, with a shuffle control and a win reward.

Setup

Requirements: Node.js >=16.0.0, npm >=6.0.0 (declared in package.json)

- npm i
- npm run start    (runs the scene locally with the Decentraland SDK dev server)
- npm run build    (compiles the scene; runs "sdk-commands build" as declared in package.json)
- npm run deploy   (publishes the scene; runs "sdk-commands deploy" as declared in package.json)

Features

- 3x3, 4x4 and 5x5 difficulty. The 3x3 / 4x4 / 5x5 buttons right of the board deal a new board at that size (5x5 is the default); the current size is highlighted.
- One picture, split at runtime. Each puzzle picture is a single square PNG in images/puzzles/ (listed in src/images.ts). The board crops it into 9, 16 or 25 tiles with uiBackground UVs (tileUvs in src/puzzle.ts), so there are no per-tile files. To add a picture, drop a square PNG in images/puzzles/ and add its path to PUZZLE_IMAGES; src/assets.test.ts fails if the folder and the list disagree. With more than one picture a "Next picture" button appears.
- Gapless board. The board is BOARD_PX = 500 square at BOARD_TOP = 50, BOARD_LEFT = 100 in src/ui.tsx (top 50..550, left 100..600, entirely inside the 800x600 panel, PANEL_WIDTH / PANEL_HEIGHT). Each tile is tileSizeFor(size) = floor(500 / size) px — 100 at 5x5, 125 at 4x4, 166 at 3x3 — laid out on a pitch equal to its own size, so a solved board reads as one continuous picture.
- Solvable deals. dealBoard in src/puzzle.ts deals a shuffled permutation of the tiles, checked by isSolvable (every tile exactly once), never already solved and at least minScramble(size) = floor(size² / 2) swaps from solved. Because any two tiles may be swapped, every permutation is solvable; the sliding-puzzle parity rule does not restrict deals here. Parity is still what fixes the fewest possible swaps (minSwapsToSolve, tiles minus permutation cycles), which the score uses.
- Moves, timer and score. The side column shows Moves and Time (m:ss). The clock starts on the first swap and stops on the winning one. A solved board shows a win screen with the score — 1000 / 2000 / 3000 for 3x3 / 4x4 / 5x5, minus 20 per move beyond the fewest possible and 1 per second, never below 0 — and a "Play again" button that deals a new board. The rules live in src/game.ts and src/puzzle.ts, which import no SDK code and are unit-tested in plain Node.
- Click-and-drag tile swapping. Click a tile to pick it up — the selected tile is drawn through a purple tint (SELECTED_TINT) rather than an underlay, since there is no gutter for an underlay to show in — then click a second tile to swap the two tile images in place, or click the same tile again to cancel.
- Shuffle / New Game button. The Shuffle button in the UI calls ShuffleBoard, which deals a new board at the current size, clears any in-progress drag and zeroes the moves and the clock, so a fresh puzzle can be played without reloading the scene. "Play again" on the win screen does the same.
- Reset button. The Reset button in src/ui.tsx calls ResetBoard, which undoes the round: it puts back the exact scramble the current round started from (the round's start, captured at every deal), clears the selection and zeroes the moves and the clock. It never deals a new board — that is what Shuffle is for — and never restores the solved board, so it cannot hand the player a solved picture or fire the win reward.
- Preview button. The Preview button in src/ui.tsx flips the board to the finished picture (every slot cropped to the tile that belongs there) so a player can see what they are working towards; the button reads "Hide" while it is on, tile clicks and the Shuffle/Reset/size buttons are refused during the peek so nothing moves by accident, and pressing it again returns the same scramble with the move count unchanged.
- Win detection and reward. When every tile is back in its own slot (isSolved), the puzzle calls Reward() in src/reward.ts, which spawns a single reusable reward entity, plays a win song (music/champ2.mp3), and shows a grass model. The song restarts on every win, not only the first: the reused entity's AudioSource is set to playing = false and back to playing = true on the next engine frame (a one-shot system that removes itself), because writing true over an already-true field is a no-op the runtime never hears. The reward is a small 4x4 metre grass patch near the north-east corner (REWARD_POSITION { x: 24, y: 0.02, z: 24 } and REWARD_SCALE 0.25 in src/reward.ts), not the scene-wide plate it used to be; src/scene-bounds.test.ts derives the playable footprint from the parcels in scene.json and checks the grass, the machine and the reward all fall inside it.
- Mute / replay toggle. Clicking the reward entity in-world calls toggleSound, which flips the win song between playing and paused, so players can silence it or play it again on demand.
- Close / reopen panel. The X button hides the puzzle UI; the resulting "open" button brings it back.
- Re-clicking the machine reopens the same board instead of reshuffling; use Shuffle to start a brand new puzzle. setupUi keeps one session and creates no scene entities, so clicking the machine any number of times never stacks a second UI or extra tiles.

Roadmap

The following are proposed but not yet merged into this repository. They are tracked as open governance proposals in the Decentraland Tile Puzzle group and will be reflected here once code lands:

- In-scene chatbox (proposal #2): add a chat UI element to the puzzle scene.

Project layout

- src/index.ts: scene entry point.
- src/ui.tsx: puzzle grid, drag-and-drop, difficulty, timer and win screen UI (draws the state in src/game.ts).
- src/game.ts: one round — moves, clock, win state and score (no SDK imports).
- src/puzzle.ts: board rules — deal, solvability, swap, win check and tile UVs (no SDK imports).
- src/images.ts: the list of puzzle pictures.
- src/reward.ts: win song and reward entity, including the mute/replay toggle.
- scene.json: the SDK7 scene manifest (metadata, main entry point, permissions) that Decentraland reads to load the scene.
- main.crdt: the compiled scene/entity state SDK7 generates from the composite, used at runtime.
- assets/scene/main.composite: the composite entity layout authored in the Decentraland builder that produces main.crdt.
- models/machine.glb: the 3D model used for the reward entity referenced in src/reward.ts.
- models/grass/FloorBaseGrass_01.glb and models/grass/Floor_Grass01.png.png: the grass floor model and its texture, shown as part of the win reward.
- images/puzzles/: the puzzle pictures, one square PNG each (genesis-city.png is the 25 original tiles stitched together).
- images/: the 25 numbered tile images (image1x1.png through image5x5.png) the board used before runtime splitting; the board no longer reads them, and image3x3.png is still the navmap thumbnail in scene.json.
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