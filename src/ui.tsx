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

// Padding used when computing whether the whole panel fits the canvas.
const PANEL_PAD = 16;

// The selected tile is tinted instead of sitting on an underlay: with no
// gutters left, an underlay drawn behind the tiles would be completely covered.
const SELECTED_TINT = Color4.create(0.5, 0.3, 0.7, 1);

// Compute a clamped scale so the panel never exceeds the canvas. Returns a
// value in (0.35..1] — never above 1, never below 0.35. If the canvas sizes
// are not finite the function returns 1.
export function computeBoardScale(canvasWidth: number, canvasHeight: number) {
  if (!isFinite(canvasWidth) || !isFinite(canvasHeight)) return 1;
  const byWidth = (canvasWidth - 2 * PANEL_PAD) / PANEL_WIDTH;
  const byHeight = (canvasHeight - 2 * PANEL_PAD) / PANEL_HEIGHT;
  const raw = Math.min(1, byWidth, byHeight);
  return Math.max(0.35, raw);
}

// Compute the panel's left margin so the panel is centred inside the canvas.
// If canvasWidth is not finite the old hard-coded 300px is returned.
export function computeBoardLeft(canvasWidth: number, scale: number) {
  if (!isFinite(canvasWidth) || !isFinite(scale)) return 300;
  return Math.max(0, Math.round((canvasWidth - PANEL_WIDTH * scale) / 2));
}

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

  // The scramble THIS round started from, in slot order. Reset restores this,
  // which is the one thing a Reset button is expected to do: undo the round.
  // It is deliberately NOT originalImages — handing the player the solved
  // picture would satisfy checkIfOriginalImages and fire the win reward.
  let roundStart: string[] = [];

  // Take the snapshot straight from the board, so it always matches the tiles
  // the player is actually looking at (even if resetPuzzle threw and left the
  // board as it was: that board is still the one the round starts from).
  const captureRoundStart = () => {
    roundStart = boxes.map(b => b.box.image);
  };

  // Put the captured scramble back into the live boxes. Returns false when
  // there is nothing usable to restore, so callers can leave the board alone
  // instead of writing undefined into a tile.
  const restoreRoundStart = () => {
    if (roundStart.length !== boxes.length) return false;
    for (let i = 0; i < boxes.length; i++) {
      boxes[i].box.image = roundStart[i];
    }
    return true;
  };

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

  // Whatever the board holds after setup IS this round's starting position.
  captureRoundStart();

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
    // Reset UNDOES the round: it puts back the scramble this round started
    // from, so a player forty moves deep gets their board back instead of a
    // brand new deal (that is what Shuffle is for). It must never leave the
    // board solved, so it never calls checkIfOriginalImages / runOnWin — and
    // it cannot, because roundStart is a scramble, not originalImages.
    if (!restoreRoundStart()) {
      log = "Nothing to reset to yet. Click Shuffle to start a round.";
      resetHighlight();
      return;
    }
    resetHighlight();
    moveCount = 0;
    log = "Board reset to how this round started. Click a tile to select it.";
  };

  const ShuffleBoard = () => {
    if (showPreview) {
      log = "Preview is on. Click Preview again before shuffling.";
      return;
    }
    try {
      runResetPuzzle(boxes, imageUrls.slice());
      // A shuffle starts a NEW round: from here on Reset restores this deal,
      // not the one before it.
      captureRoundStart();
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

  const getCanvasSize = () => {
    try {
      const info = typeof UiCanvasInformation !== 'undefined' && UiCanvasInformation.getOrNull ? UiCanvasInformation.getOrNull((engine as any).RootEntity) : null;
      if (!info) return { width: NaN, height: NaN };
      // the engine's canvas info shapes vary; try common property names
      const width = (info as any).width ?? (info as any).pixelWidth ?? (info as any).canvasWidth ?? NaN;
      const height = (info as any).height ?? (info as any).pixelHeight ?? (info as any).canvasHeight ?? NaN;
      return { width, height };
    } catch (e) {
      return { width: NaN, height: NaN };
    }
  };

  const getScaledTileLayoutInternal = (canvasWidth: number, canvasHeight: number) => {
    // If canvas sizes are not finite, signal caller to use unscaled geometry
    if (!isFinite(canvasWidth) || !isFinite(canvasHeight)) {
      return {
        tiles: boxes.map(b => ({ index: b.box.index, top: b.box.top, left: b.box.left, width: b.box.width, height: b.box.height })),
        scale: 1,
        panel: { left: 300, top: 16, width: PANEL_WIDTH, height: PANEL_HEIGHT }
      };
    }

    const scale = computeBoardScale(canvasWidth, canvasHeight);
    const panelLeft = computeBoardLeft(canvasWidth, scale);
    const panelTop = 16; // unchanged top margin
    const panelWidth = Math.round(PANEL_WIDTH * scale);
    const panelHeight = Math.round(PANEL_HEIGHT * scale);

    const scaledTile = Math.max(1, Math.round(TILE * scale));
    const scaledBoardTop = Math.round(BOARD_TOP * scale);
    const scaledBoardLeft = Math.round(BOARD_LEFT * scale);
    const pitch = scaledTile; // enforce edge-to-edge by using rounded pitch

    const tiles = [] as any[];
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const index = row * gridCols + col;
        const left = scaledBoardLeft + col * pitch;
        const top = scaledBoardTop + row * pitch;
        tiles.push({ index: boxes[index].box.index, left, top, width: scaledTile, height: scaledTile });
      }
    }

    return { tiles, scale, panel: { left: panelLeft, top: panelTop, width: panelWidth, height: panelHeight } };
  };

  const uiComponent = () => {
    const canvas = getCanvasSize();
    const scale = computeBoardScale(canvas.width, canvas.height);
    const panelLeft = computeBoardLeft(canvas.width, scale);
    const panelTop = 16;
    const panelWidthScaled = Math.round(PANEL_WIDTH * scale);
    const panelHeightScaled = Math.round(PANEL_HEIGHT * scale);

    const closeSize = Math.max(1, Math.round(25 * scale));
    const buttonW = Math.max(1, Math.round(90 * scale));
    const buttonH = Math.max(1, Math.round(25 * scale));
    const resetLeft = Math.round(100 * scale);
    const previewLeft = Math.round(200 * scale);
    const labelLeft = Math.round(110 * scale);

    const scaled = getScaledTileLayoutInternal(canvas.width, canvas.height);

    return (
      <UiEntity
        uiTransform={{
          width: panelWidthScaled,
          height: panelHeightScaled,
          margin: `16px 0 8px ${panelLeft}px`,
        }}
      >
        <Button
          key={"close"}
          value={"X"}
          uiTransform={{
            width: closeSize,
            height: closeSize,
            margin: { top: 0, right: Math.round(25 * scale) },
          }}
          onMouseDown={() => runSetUiRenderer(close)}
        />
        <Button
          key={"shuffle"}
          value={"Shuffle"}
          uiTransform={{
            width: buttonW,
            height: buttonH,
            margin: { top: 0, left: 0 },
          }}
          onMouseDown={() => ShuffleBoard()}
        />
        <Button
          key={"reset"}
          value={"Reset"}
          uiTransform={{
            width: buttonW,
            height: buttonH,
            margin: { top: 0, left: resetLeft },
          }}
          onMouseDown={() => ResetBoard()}
        />
        <Button
          key={"preview"}
          value={showPreview ? "Hide" : "Preview"}
          uiTransform={{
            width: buttonW,
            height: buttonH,
            margin: { top: 0, left: previewLeft },
          }}
          onMouseDown={() => TogglePreview()}
        />
        {scaled.tiles.map((tile: any, i: number) => (
          <Button
            key={`box${tile.index}`}
            value={boxes[i].box.text?.toString()}
            uiTransform={{
              width: tile.width,
              height: tile.height,
              margin: { top: tile.top, left: tile.left },
              positionType: 'absolute',
            }}
            uiBackground={{
              textureMode: 'stretch',
              texture: {
                src: showPreview ? originalImages[i] : boxes[i].box.image,
              },
              color: dragIndex === boxes[i].box.index ? SELECTED_TINT : Color4.White(),
            }}
            onMouseDown={() => handleClick(boxes[i], boxes[i].box.index)}
          />
        ))}
        <Label
          value={log}
          uiTransform={{
            width: 'auto',
            height: 'auto',
            margin: { top: Math.round(10 * scale), left: labelLeft },
            positionType: 'absolute',
          }}
        />
        <Label
          value={`Moves: ${moveCount}`}
          uiTransform={{
            width: 'auto',
            height: 'auto',
            margin: { top: Math.round(35 * scale), left: labelLeft },
            positionType: 'absolute',
          }}
        />
      </UiEntity>
    );
  };

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
      // Mirrors ResetBoard: restores the scramble the round started from, not
      // originalImages, so it can never trivially satisfy checkIfOriginalImages
      // and fire runOnWin on its own. Always returns false (never a win).
      if (showPreview) return false;
      if (!restoreRoundStart()) return false;
      moveCount = 0;
      return false;
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
    // New: return the scaled tile layout for a given canvas size so tests can
    // assert the scaled geometry without invoking the renderer.
    getScaledTileLayout: (canvasWidth: number, canvasHeight: number) => {
      const scaled = getScaledTileLayoutInternal(canvasWidth, canvasHeight);
      return { tiles: scaled.tiles.map(t => ({ index: t.index, top: t.top, left: t.left, width: t.width, height: t.height })), scale: scaled.scale, panel: scaled.panel };
    },
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
    // The scramble this round started from — what Reset puts back.
    getRoundStartImages: () => roundStart.slice(),
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
