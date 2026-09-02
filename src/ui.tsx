import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs';
import { Reward } from './reward';
import { createBox, shuffleArray, checkIfOriginalImages, resetPuzzle, swapTiles, BoxInfo } from './puzzle';


const imageUrls = [
  'images/image1x1.png',
  'images/image2x1.png',
  'images/image3x1.png',
  'images/image4x1.png',
  'images/image5x1.png',
  'images/image1x2.png',
  'images/image2x2.png',
  'images/image3x2.png',
  'images/image4x2.png',
  'images/image5x2.png',
  'images/image1x3.png',
  'images/image2x3.png',
  'images/image3x3.png',
  'images/image4x3.png',
  'images/image5x3.png',
  'images/image1x4.png',
  'images/image2x4.png',
  'images/image3x4.png',
  'images/image4x4.png',
  'images/image5x4.png',
  'images/image1x5.png',
  'images/image2x5.png',
  'images/image3x5.png',
  'images/image4x5.png',
  'images/image5x5.png'
];

const boxes: BoxInfo[] = [];
const gridRows = 5;
const gridCols = 5;

// The board geometry lives in exactly these three numbers. TILE is BOTH the
// tile size and the pitch between neighbours: laying tiles out on any pitch
// larger than TILE is what used to leave a 20px gutter between every pair of
// tiles, so a solved board was 25 separated crops instead of one picture.
// 5 * 100 = 500, so the board spans top 50..550 and left 100..600 and sits
// entirely inside the 800x600 panel below (the old 120px pitch pushed the last
// row to top 530 + 100 = 630, i.e. 30px past the bottom of the panel).
export const TILE = 100;
export const BOARD_TOP = 50;
export const BOARD_LEFT = 100;

// The panel the board is drawn in. Named here so the layout test can assert
// containment against the same numbers the renderer uses.
export const PANEL_WIDTH = 800;
export const PANEL_HEIGHT = 600;

// The selected tile is tinted instead of sitting on an underlay: with no
// gutters left, an underlay drawn behind the tiles would be completely covered.
const SELECTED_TINT = Color4.create(0.5, 0.3, 0.7, 1);

for (let i = 0; i < gridRows; i++) {
  for (let j = 0; j < gridCols; j++) {
    const index = i * gridCols + j;
    boxes.push(
      createBox(index + 1, BOARD_TOP + i * TILE, BOARD_LEFT + j * TILE, imageUrls[index], TILE)
    );
  }
}

const originalImages = boxes.map(box => box.box.image);

// Module-local active session so repeated calls to setupUi reopen the same
// UI and do not reshuffle the live board. The first call's injected deps win.
let activeSession: any = null;

export function setupUi(deps?: { resetPuzzle?: typeof resetPuzzle; setUiRenderer?: (renderer: any) => void; onWin?: () => void }) {
  // If there is an active session already, reopen the same UI instead of
  // re-running the full initialization. reopen() calls the first call's
  // setUiRenderer so the renderer is registered again without touching the
  // module-level board state (boxes, moveCount, dragIndex, showPreview).
  if (activeSession) {
    try {
      if (typeof activeSession.reopen === 'function') activeSession.reopen();
    } catch (e) {
      console.warn('[ui] reopen failed', e);
    }
    return activeSession;
  }

  // dependency fallbacks: use injected functions for tests or fall back to runtime implementations
  const runResetPuzzle = deps && deps.resetPuzzle ? deps.resetPuzzle : resetPuzzle;
  const runSetUiRenderer = deps && deps.setUiRenderer ? deps.setUiRenderer : ((renderer: any) => ReactEcsRenderer.setUiRenderer(renderer));
  const runOnWin = deps && deps.onWin ? deps.onWin : Reward;

  let dragIndex = -1;
  let log = "Click a tile to select it, then click another to swap.";
  let moveCount = 0;
  // Preview: while true the board renders the SOLVED picture (originalImages)
  // instead of the current scramble, and every board mutation is refused so
  // peeking can never move a tile by accident. No new asset is needed — the
  // solved order is already captured in originalImages at module load.
  let showPreview = false;

  // Clearing the selection is now just clearing dragIndex: the selection is
  // drawn as a tint on the selected tile itself (see SELECTED_TINT below), so
  // there is no separate highlight entity left to reset.
  const resetHighlight = () => {
    dragIndex = -1;
  };

  // Perform the initial board assignment at runtime inside setupUi rather than
  // at module load time. Use resetPuzzle with a copied imageUrls array so the
  // canonical imageUrls order is preserved and errors are handled consistently
  // with ShuffleBoard.
  try {
    runResetPuzzle(boxes, imageUrls.slice());
  } catch (e: any) {
    // Do not allow a resetPuzzle exception to bubble into the Decentraland runtime.
    console.warn('[ui] initial resetPuzzle failed', e);
    const msg = e instanceof Error ? e.message : String(e);
    log = `Shuffle failed: ${msg}`;
  }

  // Single deterministic click handler: first click selects, same click deselects,
  // different click swaps immediately and checks for win.
  const handleClick = (boxData: BoxInfo, index: number) => {
    // While the preview is on the board is showing the finished picture, not
    // the player's board: refuse the click outright instead of swapping the
    // tile that happens to sit under the cursor.
    if (showPreview) {
      log = "Preview: this is the finished picture. Click Preview again to return.";
      return;
    }

    if (dragIndex === -1) {
      // select: the tile itself is tinted while dragIndex points at it.
      log = "Box is highlighted. Click another to swap or click again to cancel.";
      dragIndex = index;
      return;
    }

    if (dragIndex === index) {
      // deselect
      log = "Selection cleared.";
      resetHighlight();
      return;
    }

    // perform swap between dragIndex and index
    swapTiles(boxes, dragIndex, index);
    moveCount++;
    log = `Swapped box ${dragIndex} with box ${index}.`;

    if (checkIfOriginalImages(boxes, originalImages)) {
      log = "Congratulations! The images are back in the original positions! Turn your sound on!";
      runOnWin();
    }

    resetHighlight();
  };

  // The one place the preview is switched. Turning it on drops any half-made
  // selection so the highlight does not survive the peek; turning it off puts
  // the player back on exactly the board they left, move count untouched.
  const TogglePreview = () => {
    showPreview = !showPreview;
    if (showPreview) {
      resetHighlight();
      log = "Preview: this is the finished picture. Click Preview again to return.";
    } else {
      log = "Back to your board. Click a tile to select it.";
    }
    return showPreview;
  };

  const ResetBoard = () => {
    if (showPreview) {
      log = "Preview is on. Click Preview again before resetting.";
      return;
    }
    try {
      // Reset restarts the puzzle the same way Shuffle does: it must never
      // leave the board solved, so it never calls checkIfOriginalImages /
      // runOnWin. It reuses the same runResetPuzzle path as ShuffleBoard.
      runResetPuzzle(boxes, imageUrls.slice());
      resetHighlight();
      moveCount = 0;
      log = "Board reset. Click a tile to select it.";
    } catch (e: any) {
      console.warn('[ui] ResetBoard: resetPuzzle failed', e);
      const msg = e instanceof Error ? e.message : String(e);
      log = `Reset failed: ${msg}`;
      resetHighlight();
    }
  };

  const ShuffleBoard = () => {
    if (showPreview) {
      log = "Preview is on. Click Preview again before shuffling.";
      return;
    }
    try {
      runResetPuzzle(boxes, imageUrls.slice());
      resetHighlight();
      moveCount = 0;
      log = "Board shuffled. Click a tile to select it.";
    } catch (e: any) {
      // Do not allow a resetPuzzle exception to bubble into the Decentraland runtime.
      console.warn('[ui] ShuffleBoard: resetPuzzle failed', e);
      resetHighlight();
      const msg = e instanceof Error ? e.message : String(e);
      log = `Shuffle failed: ${msg}`;
    }
  };

  const uiComponent = () => (
    <UiEntity
      uiTransform={{
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        margin: '16px 0 8px 300px',
      }}
    >
      <Button
        key={"close"}
        value={"X"}
        uiTransform={{
          width: 25,
          height: 25,
          margin: { top: 0, right: 25 },
        }}
        onMouseDown={() => runSetUiRenderer(close)}
      />
      <Button
        key={"shuffle"}
        value={"Shuffle"}
        uiTransform={{
          width: 90,
          height: 25,
          margin: { top: 0, left: 0 },
        }}
        onMouseDown={() => ShuffleBoard()}
      />
      <Button
        key={"reset"}
        value={"Reset"}
        uiTransform={{
          width: 90,
          height: 25,
          margin: { top: 0, left: 100 },
        }}
        onMouseDown={() => ResetBoard()}
      />
      <Button
        key={"preview"}
        value={showPreview ? "Hide" : "Preview"}
        uiTransform={{
          width: 90,
          height: 25,
          margin: { top: 0, left: 200 },
        }}
        onMouseDown={() => TogglePreview()}
      />
      {boxes.map((box, i) => (
        <Button
          key={`box${box.box.index}`}
          value={box.box.text?.toString()}
          uiTransform={{
            width: box.box.width,
            height: box.box.height,
            margin: { top: box.box.top, left: box.box.left },
            positionType: 'absolute',
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: {
              // Preview on: this slot shows the tile that BELONGS here in the
              // solved picture. Preview off: the tile actually sitting here.
              src: showPreview ? originalImages[i] : box.box.image,
            },
            // The selection: the chosen tile is drawn through a purple tint,
            // every other tile through plain white (i.e. untinted). The board
            // has no gutters any more, so there is nowhere for an underlay to
            // show — the tile has to carry the highlight itself.
            color: dragIndex === box.box.index ? SELECTED_TINT : Color4.White(),
          }}
          onMouseDown={() => handleClick(box, box.box.index)}
        />
      ))}
      <Label
        value={log}
        uiTransform={{
          width: 'auto',
          height: 'auto',
          margin: { top: 10, left: 110 },
          positionType: 'absolute',
        }}
      />
      <Label
        value={`Moves: ${moveCount}`}
        uiTransform={{
          width: 'auto',
          height: 'auto',
          margin: { top: 35, left: 110 },
          positionType: 'absolute',
        }}
      />
    </UiEntity>
  );

  const close = () => (
    <UiEntity
      uiTransform={{
        width: 30,
        height: 25,
        margin: '16px 0 8px 300px',
      }}
    >
      <Button
        value={"open"}
        uiTransform={{
          width: 30,
          height: 25,
          margin: { top: 0, left: 0 },
        }}
        onMouseDown={() => runSetUiRenderer(uiComponent)}
      />
    </UiEntity>
  );

  runSetUiRenderer(uiComponent);

  const api = {
    simulateSwap: (i: number, j: number) => {
      // Same rule as handleClick: the board cannot move while it is being
      // previewed, so a swap attempted during a peek is a no-op.
      if (showPreview) return false;
      swapTiles(boxes, i, j);
      moveCount++;
      if (checkIfOriginalImages(boxes, originalImages)) {
        runOnWin();
        return true;
      }
      return false;
    },
    resetToOriginal: () => {
      // Mirrors ResetBoard: restarts the puzzle via runResetPuzzle instead of
      // restoring originalImages directly, so it can never trivially satisfy
      // checkIfOriginalImages and fire runOnWin on its own.
      if (showPreview) return false;
      try {
        runResetPuzzle(boxes, imageUrls.slice());
        moveCount = 0;
        return false;
      } catch (e: any) {
        console.warn('[ui] resetToOriginal: resetPuzzle failed', e);
        return false;
      }
    },
    simulateShuffle: () => ShuffleBoard(),
    // Board geometry, so a test can assert the tiles actually touch and that
    // the whole board fits inside the 800x600 panel.
    getTileLayout: () => boxes.map(b => ({
      index: b.box.index,
      top: b.box.top,
      left: b.box.left,
      width: b.box.width,
      height: b.box.height
    })),
    getPanelSize: () => ({ width: PANEL_WIDTH, height: PANEL_HEIGHT }),
    // Selection, without the renderer: takes the 1-based tile index a click
    // would carry and runs exactly the handler the Button runs.
    simulateClick: (index: number) => {
      const target = boxes[index - 1];
      if (!target) return;
      handleClick(target, target.box.index);
    },
    // -1 when nothing is selected, otherwise the 1-based index of the tinted tile.
    getSelectedIndex: () => dragIndex,
    getMoveCount: () => moveCount,
    // Preview surface, so the behaviour is testable without the SDK renderer.
    togglePreview: () => TogglePreview(),
    isPreviewOn: () => showPreview,
    // What the board is holding right now (never the preview): lets a test
    // assert that a peek left the scramble untouched.
    getBoardImages: () => boxes.map(box => box.box.image),
    // The finished picture, in slot order — what the preview draws.
    getSolvedImages: () => originalImages.slice(),
    // What the board would show right now: the preview when it is on, the
    // player's own scramble when it is off.
    getVisibleImages: () => (showPreview ? originalImages.slice() : boxes.map(box => box.box.image))
  };

  // attach reopen that calls the original runSetUiRenderer from this session
  (api as any).reopen = () => runSetUiRenderer(uiComponent);

  // publish the active session so subsequent calls reopen instead of
  // reinitialising the module-local state.
  activeSession = api;

  return api;
}

// Test-only helper: reset the setupUi session so tests can run deterministically
// without needing to reload the module.
// NOTE: exported only for tests; do not use from production code.
export function __resetSetupUiForTests() {
  activeSession = null;
}
