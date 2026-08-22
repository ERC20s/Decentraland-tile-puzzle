Decentraland Tile Puzzle

A Decentraland SDK7 scene that renders an image tile-swap puzzle in-world, with a shuffle control and a win reward.

Setup

- npm i
- npm run start

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
