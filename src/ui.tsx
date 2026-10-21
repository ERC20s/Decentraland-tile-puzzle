import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs';
import { Reward } from './reward';
import { GridSize, GRID_SIZES, dealBoard, solvedBoard, tileUvs } from './puzzle';
import { Deal, Round, SwapResult, newRound, isWon, playSwap, restartRound, elapsedMs, roundScore, formatTime } from './game';
import { PUZZLE_IMAGES } from './images';

// A new player starts on the full 5x5 board, as before difficulty levels.
export const DEFAULT_SIZE: GridSize = 5;

// The board geometry lives in these numbers. The board is BOARD_PX square at
// any difficulty and each tile is BOARD_PX / size (rounded down), laid out on
// a pitch equal to its own size so neighbours touch edge to edge and a solved
// board reads as one continuous picture: 100px at 5x5, 125px at 4x4 and 166px
// at 3x3. The board spans top 50..550 and left 100..600, entirely inside the
// 800x600 panel below.
export const BOARD_PX = 500;
export const BOARD_TOP = 50;
export const BOARD_LEFT = 100;

export const tileSizeFor = (size: GridSize): number => Math.floor(BOARD_PX / size);

// The panel the board is drawn in. Named here so the layout test can assert
// containment against the same numbers the renderer uses.
export const PANEL_WIDTH = 800;
export const PANEL_HEIGHT = 600;

// The column right of the board (600..800) holds difficulty, moves and time.
const SIDE_LEFT = 615;

// Padding used when computing whether the whole panel fits the canvas.
const PANEL_PAD = 16;

// The selected tile is tinted instead of sitting on an underlay: with no
// gutters left, an underlay drawn behind the tiles would be completely covered.
const SELECTED_TINT = Color4.create(0.5, 0.3, 0.7, 1);

// Behind the win screen, so its text reads over the finished picture.
const WIN_BACKDROP = Color4.create(0, 0, 0, 0.8);

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

// Unscaled slot geometry for a size x size board, row-major. `index` is the
// 1-based slot number a click carries.
export function slotLayout(size: GridSize) {
  const tile = tileSizeFor(size);
  const slots = [] as { index: number; top: number; left: number; width: number; height: number }[];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      slots.push({ index: row * size + col + 1, top: BOARD_TOP + row * tile, left: BOARD_LEFT + col * tile, width: tile, height: tile });
    }
  }
  return slots;
}

// Module-local active session so repeated calls to setupUi (every click on the
// machine) reopen the same UI and do not reshuffle the live board. The first
// call's injected deps win. setupUi creates no scene entities: the board is
// drawn by one renderer function from the session's state, so changing size
// or picture redraws in place rather than adding tiles.
let activeSession: any = null;

export function setupUi(deps?: {
  deal?: Deal;
  setUiRenderer?: (renderer: any) => void;
  onWin?: () => void;
  now?: () => number;
  images?: readonly string[];
}) {
  // If there is an active session already, reopen the same UI instead of
  // re-running the full initialization. reopen() calls the first call's
  // setUiRenderer so the renderer is registered again without touching the
  // session state (round, dragIndex, showPreview).
  if (activeSession) {
    try {
      if (typeof activeSession.reopen === 'function') activeSession.reopen();
    } catch (e) {
      console.error('[ui] reopen failed', e);
    }
    return activeSession;
  }

  // dependency fallbacks: use injected functions for tests or fall back to runtime implementations
  const runDeal: Deal = deps && deps.deal ? deps.deal : (size: GridSize) => dealBoard(size);
  const runSetUiRenderer = deps && deps.setUiRenderer ? deps.setUiRenderer : ((renderer: any) => ReactEcsRenderer.setUiRenderer(renderer));
  const runOnWin = deps && deps.onWin ? deps.onWin : Reward;
  const now = deps && deps.now ? deps.now : () => Date.now();
  const images = deps && deps.images && deps.images.length > 0 ? deps.images : PUZZLE_IMAGES;

  let imageIndex = 0;
  let dragIndex = -1;
  let log = "Click a tile to select it, then click another to swap.";
  // Preview: while true the board renders the SOLVED picture instead of the
  // current scramble, and every board mutation is refused so peeking can never
  // move a tile by accident.
  let showPreview = false;

  // Clearing the selection is just clearing dragIndex: the selection is drawn
  // as a tint on the selected tile itself (see SELECTED_TINT below).
  const resetHighlight = () => {
    dragIndex = -1;
  };

  // The first deal happens at runtime inside setupUi, not at module load. A
  // deal that throws must not bubble into the Decentraland runtime; the player
  // still gets a board from the built-in dealer.
  let round: Round;
  try {
    round = newRound(DEFAULT_SIZE, runDeal);
  } catch (e: any) {
    console.error('[ui] initial deal failed', e);
    const msg = e instanceof Error ? e.message : String(e);
    log = `Shuffle failed: ${msg}`;
    round = newRound(DEFAULT_SIZE);
  }

  // Start a new round at `size`. On failure the current round stays as it is.
  const startRound = (size: GridSize): boolean => {
    resetHighlight();
    try {
      round = newRound(size, runDeal);
      return true;
    } catch (e: any) {
      console.error('[ui] deal failed', e);
      const msg = e instanceof Error ? e.message : String(e);
      log = `Shuffle failed: ${msg}`;
      return false;
    }
  };

  // The one path every swap takes, from a click or from the test API. Slots
  // are 1-based here, like the tile indices clicks carry.
  const doSwap = (a: number, b: number): SwapResult => {
    const result = playSwap(round, a - 1, b - 1, now());
    if (result === 'won') {
      log = "Congratulations! The images are back in the original positions! Turn your sound on!";
      runOnWin();
    } else if (result === 'swapped') {
      log = `Swapped box ${a} with box ${b}.`;
    }
    return result;
  };

  // Single deterministic click handler: first click selects, same click deselects,
  // different click swaps immediately and checks for win.
  const handleClick = (index: number) => {
    // While the preview is on the board is showing the finished picture, not
    // the player's board: refuse the click outright instead of swapping the
    // tile that happens to sit under the cursor.
    if (showPreview) {
      log = "Preview: this is the finished picture. Click Preview again to return.";
      return;
    }

    // A solved board is final until a new round or a Reset.
    if (isWon(round)) {
      log = "Solved! Click Play again or pick a size for a new round.";
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

    doSwap(dragIndex, index);
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
    // from and clears the moves and the clock, so a player forty moves deep
    // gets their board back instead of a brand new deal (that is what Shuffle
    // is for). The deal is never solved, so Reset can never fire the reward.
    restartRound(round);
    resetHighlight();
    log = "Board reset to how this round started. Click a tile to select it.";
  };

  // Shuffle, and the win screen's Play again: a new round at the same size,
  // with the moves, the clock and the win screen cleared.
  const ShuffleBoard = () => {
    if (showPreview) {
      log = "Preview is on. Click Preview again before shuffling.";
      return;
    }
    if (startRound(round.size)) log = "Board shuffled. Click a tile to select it.";
  };

  const SetDifficulty = (size: GridSize) => {
    if (showPreview) {
      log = "Preview is on. Click Preview again before changing the size.";
      return;
    }
    if (startRound(size)) log = `New ${size}x${size} board. Click a tile to select it.`;
  };

  const NextPicture = () => {
    if (showPreview) {
      log = "Preview is on. Click Preview again before changing the picture.";
      return;
    }
    imageIndex = (imageIndex + 1) % images.length;
    if (startRound(round.size)) log = "New picture. Click a tile to select it.";
  };

  // What slot `slot` (0-based) draws: the source picture, cropped by UVs to
  // the tile that sits there — or to the tile that belongs there while the
  // preview shows the finished picture.
  const tileTexture = (slot: number) => ({
    src: images[imageIndex],
    uvs: tileUvs(showPreview ? slot : round.board[slot], round.size)
  });

  // The text the side column shows; the clock is read on every frame.
  const hud = () => ({
    moves: `Moves: ${round.moves}`,
    time: `Time: ${formatTime(elapsedMs(round, now()))}`
  });

  // The win screen's text, or null when it is not showing (round not solved,
  // or the player is looking at the preview).
  const winScreen = () => {
    if (!isWon(round) || showPreview) return null;
    return {
      title: 'Solved!',
      score: `Score: ${roundScore(round)}`,
      detail: `${round.moves} moves (fewest possible: ${round.optimal}) in ${formatTime(elapsedMs(round, now()))}`
    };
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
        tiles: slotLayout(round.size),
        scale: 1,
        panel: { left: 300, top: 16, width: PANEL_WIDTH, height: PANEL_HEIGHT }
      };
    }

    const scale = computeBoardScale(canvasWidth, canvasHeight);
    const panelLeft = computeBoardLeft(canvasWidth, scale);
    const panelTop = 16; // unchanged top margin
    const panelWidth = Math.round(PANEL_WIDTH * scale);
    const panelHeight = Math.round(PANEL_HEIGHT * scale);

    const scaledTile = Math.max(1, Math.round(tileSizeFor(round.size) * scale));
    const scaledBoardTop = Math.round(BOARD_TOP * scale);
    const scaledBoardLeft = Math.round(BOARD_LEFT * scale);
    const pitch = scaledTile; // enforce edge-to-edge by using rounded pitch

    const tiles = [] as any[];
    for (let row = 0; row < round.size; row++) {
      for (let col = 0; col < round.size; col++) {
        const left = scaledBoardLeft + col * pitch;
        const top = scaledBoardTop + row * pitch;
        tiles.push({ index: row * round.size + col + 1, left, top, width: scaledTile, height: scaledTile });
      }
    }

    return { tiles, scale, panel: { left: panelLeft, top: panelTop, width: panelWidth, height: panelHeight } };
  };

  // Layout for the closed-panel 'open' button, computed the same way
  // uiComponent derives closeSize/buttonW: same computeBoardScale/computeBoardLeft
  // so the reopen button tracks wherever the panel itself would be drawn,
  // instead of sitting at a fixed left:300px regardless of canvas size.
  const getCloseLayoutInternal = (canvasWidth: number, canvasHeight: number) => {
    const scale = computeBoardScale(canvasWidth, canvasHeight);
    const left = computeBoardLeft(canvasWidth, scale);
    const width = Math.max(1, Math.round(30 * scale));
    const height = Math.max(1, Math.round(25 * scale));
    return { left, top: 16, width, height, scale };
  };

  const uiComponent = () => {
    const canvas = getCanvasSize();
    const scale = computeBoardScale(canvas.width, canvas.height);
    const panelLeft = computeBoardLeft(canvas.width, scale);
    const panelWidthScaled = Math.round(PANEL_WIDTH * scale);
    const panelHeightScaled = Math.round(PANEL_HEIGHT * scale);
    const px = (n: number) => Math.round(n * scale);

    const closeSize = Math.max(1, px(25));
    const buttonW = Math.max(1, px(90));
    const buttonH = Math.max(1, px(25));
    const resetLeft = px(100);
    const previewLeft = px(200);

    const scaled = getScaledTileLayoutInternal(canvas.width, canvas.height);
    const boardPx = scaled.tiles.length > 0 ? scaled.tiles[0].width * round.size : 0;
    const status = hud();
    const win = winScreen();

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
            margin: { top: 0, right: px(25) },
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
        {scaled.tiles.map((tile: any, slot: number) => {
          const texture = tileTexture(slot);
          return (
            <Button
              key={`box${tile.index}`}
              value={""}
              uiTransform={{
                width: tile.width,
                height: tile.height,
                margin: { top: tile.top, left: tile.left },
                positionType: 'absolute',
              }}
              uiBackground={{
                textureMode: 'stretch',
                texture: { src: texture.src },
                uvs: texture.uvs,
                color: dragIndex === tile.index ? SELECTED_TINT : Color4.White(),
              }}
              onMouseDown={() => handleClick(tile.index)}
            />
          );
        })}
        <Label
          value={"Difficulty"}
          uiTransform={{ width: 'auto', height: 'auto', margin: { top: px(55), left: px(SIDE_LEFT) }, positionType: 'absolute' }}
        />
        {GRID_SIZES.map((size, i) => (
          <Button
            key={`size${size}`}
            value={`${size}x${size}`}
            variant={size === round.size ? 'primary' : 'secondary'}
            uiTransform={{
              width: Math.max(1, px(55)),
              height: buttonH,
              margin: { top: px(80), left: px(SIDE_LEFT + i * 60) },
              positionType: 'absolute',
            }}
            onMouseDown={() => SetDifficulty(size)}
          />
        ))}
        <Label
          value={status.moves}
          uiTransform={{ width: 'auto', height: 'auto', margin: { top: px(125), left: px(SIDE_LEFT) }, positionType: 'absolute' }}
        />
        <Label
          value={status.time}
          uiTransform={{ width: 'auto', height: 'auto', margin: { top: px(150), left: px(SIDE_LEFT) }, positionType: 'absolute' }}
        />
        {images.length > 1 ? (
          <Button
            key={"picture"}
            value={"Next picture"}
            uiTransform={{
              width: Math.max(1, px(175)),
              height: buttonH,
              margin: { top: px(185), left: px(SIDE_LEFT) },
              positionType: 'absolute',
            }}
            onMouseDown={() => NextPicture()}
          />
        ) : null}
        <Label
          value={log}
          uiTransform={{
            width: 'auto',
            height: 'auto',
            margin: { top: px(BOARD_TOP + BOARD_PX + 8), left: px(BOARD_LEFT) },
            positionType: 'absolute',
          }}
        />
        {win ? (
          <UiEntity
            key={"win"}
            uiTransform={{
              width: boardPx,
              height: px(200),
              margin: { top: px(BOARD_TOP) + Math.round((boardPx - px(200)) / 2), left: px(BOARD_LEFT) },
              positionType: 'absolute',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            uiBackground={{ color: WIN_BACKDROP }}
          >
            <Label value={win.title} fontSize={px(28)} uiTransform={{ height: px(40) }} />
            <Label value={win.score} fontSize={px(20)} uiTransform={{ height: px(30) }} />
            <Label value={win.detail} fontSize={px(14)} uiTransform={{ height: px(24) }} />
            <Button
              value={"Play again"}
              uiTransform={{ width: Math.max(1, px(120)), height: Math.max(1, px(30)), margin: { top: px(10) } }}
              onMouseDown={() => ShuffleBoard()}
            />
          </UiEntity>
        ) : null}
      </UiEntity>
    );
  };

  const close = () => {
    const canvas = getCanvasSize();
    const closeLayout = getCloseLayoutInternal(canvas.width, canvas.height);
    return (
      <UiEntity
        uiTransform={{
          width: closeLayout.width,
          height: closeLayout.height,
          margin: `16px 0 8px ${closeLayout.left}px`,
        }}
      >
        <Button
          value={"open"}
          uiTransform={{
            width: closeLayout.width,
            height: closeLayout.height,
            margin: { top: 0, left: 0 },
          }}
          onMouseDown={() => runSetUiRenderer(uiComponent)}
        />
      </UiEntity>
    );
  };

  runSetUiRenderer(uiComponent);

  const api = {
    // 1-based slots, like clicks. Returns true only for the winning swap.
    simulateSwap: (i: number, j: number) => {
      // Same rule as handleClick: the board cannot move while it is being
      // previewed, so a swap attempted during a peek is a no-op.
      if (showPreview) return false;
      return doSwap(i, j) === 'won';
    },
    resetToOriginal: () => {
      // Mirrors ResetBoard: restores the scramble the round started from, not
      // the solved board, so it can never fire runOnWin on its own. Always
      // returns false (never a win).
      if (showPreview) return false;
      ResetBoard();
      return false;
    },
    simulateShuffle: () => ShuffleBoard(),
    setDifficulty: (size: GridSize) => SetDifficulty(size),
    nextPicture: () => NextPicture(),
    getSize: () => round.size,
    getImage: () => images[imageIndex],
    // Board geometry, so a test can assert the tiles actually touch and that
    // the whole board fits inside the 800x600 panel.
    getTileLayout: () => slotLayout(round.size),
    getPanelSize: () => ({ width: PANEL_WIDTH, height: PANEL_HEIGHT }),
    // The scaled tile layout for a given canvas size so tests can assert the
    // scaled geometry without invoking the renderer.
    getScaledTileLayout: (canvasWidth: number, canvasHeight: number) => {
      const scaled = getScaledTileLayoutInternal(canvasWidth, canvasHeight);
      return { tiles: scaled.tiles.map(t => ({ index: t.index, top: t.top, left: t.left, width: t.width, height: t.height })), scale: scaled.scale, panel: scaled.panel };
    },
    // The closed-panel 'open' button's computed left/width/height/scale for a
    // given canvas size, so a test can assert it stays inside the canvas and
    // scales down consistently with computeBoardScale, without invoking the
    // renderer.
    getCloseLayout: (canvasWidth: number, canvasHeight: number) => getCloseLayoutInternal(canvasWidth, canvasHeight),
    // Selection, without the renderer: takes the 1-based tile index a click
    // would carry and runs exactly the handler the Button runs.
    simulateClick: (index: number) => {
      if (index < 1 || index > round.board.length) return;
      handleClick(index);
    },
    // -1 when nothing is selected, otherwise the 1-based index of the tinted tile.
    getSelectedIndex: () => dragIndex,
    getMoveCount: () => round.moves,
    // Preview surface, so the behaviour is testable without the SDK renderer.
    togglePreview: () => TogglePreview(),
    isPreviewOn: () => showPreview,
    // The tile in each slot right now (never the preview): lets a test assert
    // that a peek left the scramble untouched.
    getBoard: () => round.board.slice(),
    // The finished picture, in slot order — what the preview draws.
    getSolvedBoard: () => solvedBoard(round.size),
    // The scramble this round started from — what Reset puts back.
    getRoundStart: () => round.start.slice(),
    // What the board would show right now: the preview when it is on, the
    // player's own scramble when it is off.
    getVisibleBoard: () => (showPreview ? solvedBoard(round.size) : round.board.slice()),
    // Exactly what the renderer hands slot `index` (1-based): source image and UVs.
    getTileTexture: (index: number) => tileTexture(index - 1),
    getHud: () => hud(),
    getWinScreen: () => winScreen(),
    isWon: () => isWon(round),
    getLog: () => log
  };

  // attach reopen that calls the original runSetUiRenderer from this session
  (api as any).reopen = () => runSetUiRenderer(uiComponent);

  // publish the active session so subsequent calls reopen instead of
  // reinitialising the session state.
  activeSession = api;

  return api;
}

// Test-only helper: reset the setupUi session so tests can run deterministically
// without needing to reload the module.
// NOTE: exported only for tests; do not use from production code.
export function __resetSetupUiForTests() {
  activeSession = null;
}
