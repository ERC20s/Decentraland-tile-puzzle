import { vi, afterEach, test, expect } from 'vitest';

// src/ui.tsx imports the SDK7 renderer and ECS, whose real modules load
// '~system/*' bindings that only exist inside the Decentraland client. Every
// test here injects its own setUiRenderer, so the real renderer is never
// called. JSX compiles to ReactEcs.createElement (jsxFactory in the SDK
// tsconfig); the mock returns a plain { type, props, children } tree so a test
// can call the registered renderer and inspect what it would draw.
vi.mock('@dcl/sdk/react-ecs', () => ({
  default: {
    createElement: vi.fn((type: any, props: any, ...children: any[]) => ({ type, props: props || {}, children: children.flat() }))
  },
  Button: vi.fn(),
  Label: vi.fn(),
  UiEntity: vi.fn(),
  ReactEcsRenderer: { setUiRenderer: vi.fn() }
}));
vi.mock('@dcl/sdk/ecs', () => ({
  // addEntity is a spy so the idempotency test can prove setupUi builds no
  // scene entities, however often the machine is clicked.
  engine: { RootEntity: 0, addEntity: vi.fn(() => 1) },
  UiCanvasInformation: { getOrNull: vi.fn(() => null) },
  InputAction: { IA_POINTER: 0 },
  ColliderLayer: { CL_POINTER: 1 },
  Animator: {},
  AudioSource: {},
  AvatarAttach: {},
  GltfContainer: {},
  Material: {},
  Transform: {},
  VideoPlayer: {},
  VisibilityComponent: {},
  pointerEventsSystem: {}
}));
// Every test injects onWin; the real Reward must never run here.
vi.mock('./reward', () => ({ Reward: vi.fn() }));

import { Button, Label, UiEntity } from '@dcl/sdk/react-ecs';
import { engine } from '@dcl/sdk/ecs';
import { setupUi, __resetSetupUiForTests, BOARD_PX, tileSizeFor } from './ui';
import { GRID_SIZES, GridSize, solvedBoard, isSolvable, isSolved, tileUvs } from './puzzle';
import { scoreFor } from './game';
import { PUZZLE_IMAGES } from './images';

// Minimal mock types to track calls
let calledDeal = false;
let calledSetUi = false;
let registeredRenderer: any = null;
let calledOnWin = false;

// A deal that leaves the board one swap from solved: array slots 1 and 2,
// i.e. 1-based tiles 2 and 3 (the indices simulateSwap / clicks take), are
// exchanged. Works at any size.
function makeNearSolvedDeal(shouldThrow = false) {
  return (size: GridSize) => {
    calledDeal = true;
    if (shouldThrow) throw new Error('deal failed');
    const board = solvedBoard(size);
    [board[1], board[2]] = [board[2], board[1]];
    return board;
  };
}

// A deal that is visibly DIFFERENT on every call: the solved board rotated by
// the call number. Needed by the reset tests, where the point is that a second
// deal must not look like the first one.
function makeRotatingDeal() {
  let call = 0;
  return (size: GridSize) => {
    calledDeal = true;
    call++;
    const solved = solvedBoard(size);
    return solved.map((_, i) => solved[(i + call) % solved.length]);
  };
}

function makeSetUiRendererMock() {
  return (renderer: any) => {
    calledSetUi = true;
    registeredRenderer = renderer;
  };
}

function makeOnWinSpy() {
  return () => { calledOnWin = true };
}

// A clock the test moves by hand.
function makeClock(start = 0) {
  const clock = { t: start, now: () => clock.t };
  return clock;
}

// Every node of a rendered tree, depth first.
function flatten(node: any): any[] {
  if (!node || typeof node !== 'object') return [];
  return [node, ...(node.children || []).flatMap(flatten)];
}

afterEach(() => {
  calledDeal = false;
  calledSetUi = false;
  registeredRenderer = null;
  calledOnWin = false;
  (engine.addEntity as any).mockClear();
  __resetSetupUiForTests();
});

test('setupUi calls the injected deal and registers renderer', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  setupUi({ deal: dealMock, setUiRenderer: setUiMock });
  expect(calledDeal).toBe(true);
  expect(calledSetUi).toBe(true);
  expect(typeof registeredRenderer).toBe('function');
});

test('setupUi swallows deal exceptions but still registers a renderer and a playable board', () => {
  const dealMock = makeNearSolvedDeal(true);
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock });
  expect(calledDeal).toBe(true);
  expect(calledSetUi).toBe(true);
  expect(typeof registeredRenderer).toBe('function');
  // the built-in dealer stepped in: a real, unsolved 5x5 board
  expect(isSolvable(api.getBoard(), 5)).toBe(true);
  expect(isSolved(api.getBoard())).toBe(false);
  expect(api.getLog()).toBe('Shuffle failed: deal failed');
});

test('setupUi onWin injection and simulateSwap trigger win', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  // the dealMock swapped tiles 2 and 3; swapping them back should win
  const result = api.simulateSwap(2, 3);
  expect(result).toBe(true);
  expect(calledOnWin).toBe(true);
});

test('setupUi resetToOriginal undoes the round without dealing a new board or winning', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  calledDeal = false;
  // Reset restores the round's own starting scramble: it must NOT deal a new
  // board (so the injected deal is not called) and must never auto-win.
  const result = api.resetToOriginal();
  expect(calledDeal).toBe(false);
  expect(result).toBe(false);
  expect(calledOnWin).toBe(false);
});

test('reset puts back exactly the board captured at the start of the round', () => {
  const api = setupUi({
    deal: makeRotatingDeal(),
    setUiRenderer: makeSetUiRendererMock(),
    onWin: makeOnWinSpy() as any
  });
  const start = api.getBoard();
  expect(api.getRoundStart()).toEqual(start);

  // Make a mess of it.
  api.simulateSwap(1, 7);
  api.simulateSwap(3, 19);
  api.simulateSwap(11, 24);
  expect(api.getBoard()).not.toEqual(start);

  api.resetToOriginal();
  expect(api.getBoard()).toEqual(start);
  expect(api.getMoveCount()).toBe(0);
  expect(calledOnWin).toBe(false);
});

test('reset after a shuffle restores the new scramble, not the previous round', () => {
  const api = setupUi({
    deal: makeRotatingDeal(),
    setUiRenderer: makeSetUiRendererMock(),
    onWin: makeOnWinSpy() as any
  });
  const firstRound = api.getBoard();
  api.simulateShuffle();
  const secondRound = api.getBoard();
  expect(secondRound).not.toEqual(firstRound);
  expect(api.getRoundStart()).toEqual(secondRound);

  api.simulateSwap(2, 15);
  api.resetToOriginal();
  expect(api.getBoard()).toEqual(secondRound);
  expect(api.getBoard()).not.toEqual(firstRound);
});

test('reset never leaves the board solved, so it cannot fire the win reward', () => {
  const dealMock = makeNearSolvedDeal(false);
  const api = setupUi({
    deal: dealMock,
    setUiRenderer: makeSetUiRendererMock(),
    onWin: makeOnWinSpy() as any
  });
  // The mock leaves the board one swap from solved; solve it, then reset.
  expect(api.simulateSwap(2, 3)).toBe(true);
  calledOnWin = false;
  api.resetToOriginal();
  // Back to the unsolved starting scramble, and no second win fired.
  expect(api.getBoard()).toEqual(api.getRoundStart());
  expect(api.getBoard()).not.toEqual(api.getSolvedBoard());
  expect(calledOnWin).toBe(false);
});

test('setupUi move counter increments on simulateSwap', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock });
  expect(api.getMoveCount()).toBe(0);
  // 1-based tiles, like clicks. (This used to pass 0, which is not a tile: the
  // old swapTiles ignored it but the move was counted anyway.)
  api.simulateSwap(1, 2);
  expect(api.getMoveCount()).toBe(1);
  api.simulateSwap(1, 2);
  expect(api.getMoveCount()).toBe(2);
});

test('a swap with a tile index that does not exist is not counted as a move', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const before = api.getBoard();
  api.simulateSwap(0, 1);
  api.simulateSwap(1, 26);
  expect(api.getMoveCount()).toBe(0);
  expect(api.getBoard()).toEqual(before);
});

test('setupUi move counter resets to 0 on simulateShuffle', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock });
  api.simulateSwap(1, 2);
  expect(api.getMoveCount()).toBe(1);
  api.simulateShuffle();
  expect(api.getMoveCount()).toBe(0);
});

test('setupUi preview starts off and toggles on and off', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock });
  expect(api.isPreviewOn()).toBe(false);
  api.togglePreview();
  expect(api.isPreviewOn()).toBe(true);
  api.togglePreview();
  expect(api.isPreviewOn()).toBe(false);
});

test('setupUi preview shows the solved picture and hiding it shows the board again', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock });
  const board = api.getBoard();
  // preview off: the slots draw the player's own board
  expect(api.getVisibleBoard()).toEqual(board);
  api.togglePreview();
  // preview on: every slot draws the tile that belongs there
  expect(api.getVisibleBoard()).toEqual(api.getSolvedBoard());
  // the underlying board is untouched by looking at it
  expect(api.getBoard()).toEqual(board);
  api.togglePreview();
  expect(api.getVisibleBoard()).toEqual(board);
});

test('setupUi swap attempted while preview is on changes nothing', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  const before = api.getBoard();
  const movesBefore = api.getMoveCount();
  api.togglePreview();
  // the mock leaves the board one swap from solved: this swap would win if it
  // were allowed to happen at all.
  const result = api.simulateSwap(2, 3);
  expect(result).toBe(false);
  expect(api.getBoard()).toEqual(before);
  expect(api.getMoveCount()).toBe(movesBefore);
  expect(calledOnWin).toBe(false);
});

test('setupUi toggling preview back restores the shuffled board and the move count', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  api.simulateSwap(3, 4);
  const before = api.getBoard();
  const moves = api.getMoveCount();
  api.togglePreview();
  api.togglePreview();
  expect(api.isPreviewOn()).toBe(false);
  expect(api.getBoard()).toEqual(before);
  expect(api.getMoveCount()).toBe(moves);
});

test('setupUi shuffle and reset are refused while the preview is on', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  api.simulateSwap(3, 4);
  const before = api.getBoard();
  api.togglePreview();
  calledDeal = false;
  api.simulateShuffle();
  api.resetToOriginal();
  expect(calledDeal).toBe(false);
  expect(api.getBoard()).toEqual(before);
  api.togglePreview();
  api.simulateShuffle();
  expect(calledDeal).toBe(true);
});

test('tiles are laid out edge to edge: pitch equals tile size on both axes', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const layout = api.getTileLayout();
  expect(layout.length).toBe(25);

  // Row by row: each tile starts exactly where its left neighbour ends, and
  // shares the same top. No gutter anywhere.
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      const a = layout[row * 5 + col];
      const b = layout[row * 5 + col + 1];
      expect(b.left - a.left).toBe(a.width);
      expect(b.top).toBe(a.top);
    }
  }

  // Column by column: each tile starts exactly where the tile above it ends.
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 4; row++) {
      const a = layout[row * 5 + col];
      const b = layout[(row + 1) * 5 + col];
      expect(b.top - a.top).toBe(a.height);
      expect(b.left).toBe(a.left);
    }
  }
});

test('the whole board fits inside the panel', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const layout = api.getTileLayout();
  const panel = api.getPanelSize();
  for (const tile of layout) {
    expect(tile.top).toBeGreaterThanOrEqual(0);
    expect(tile.left).toBeGreaterThanOrEqual(0);
    expect(tile.top + tile.height).toBeLessThanOrEqual(panel.height);
    expect(tile.left + tile.width).toBeLessThanOrEqual(panel.width);
  }
});

// New tests for scaling behaviour
test('scale is 1 on a 1920x1080 canvas', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const scaled = (api as any).getScaledTileLayout(1920, 1080);
  expect(scaled.scale).toBe(1);
});

test('at 1024x600 every scaled tile lies inside the canvas and inside the panel', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const scaled = (api as any).getScaledTileLayout(1024, 600);
  // every tile is inside panel bounds
  for (const tile of scaled.tiles) {
    expect(tile.left).toBeGreaterThanOrEqual(0);
    expect(tile.top).toBeGreaterThanOrEqual(0);
    expect(tile.left + tile.width).toBeLessThanOrEqual(scaled.panel.width);
    expect(tile.top + tile.height).toBeLessThanOrEqual(scaled.panel.height);
    // tiles stay square
    expect(tile.width).toBe(tile.height);
  }
});

test('null canvas info leaves geometry unchanged', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  // pass non-finite values to simulate missing canvas info
  const scaled = (api as any).getScaledTileLayout(NaN, NaN);
  const base = api.getTileLayout();
  expect(scaled.scale).toBe(1);
  // layout should equal the base layout
  expect(scaled.tiles.map((t: any) => ({ top: t.top, left: t.left, width: t.width, height: t.height }))).toEqual(base.map((b: any) => ({ top: b.top, left: b.left, width: b.width, height: b.height })));
});

// New tests for the closed-panel 'open' button's scaling (mirrors the
// getScaledTileLayout tests above): the button must track the same
// computeBoardScale/computeBoardLeft the open panel uses, instead of sitting
// at a fixed left:300px regardless of canvas size.
test('close layout is unscaled (30x25 at left 300) on a 1920x1080 canvas', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const closeLayout = (api as any).getCloseLayout(1920, 1080);
  expect(closeLayout.scale).toBe(1);
  expect(closeLayout.width).toBe(30);
  expect(closeLayout.height).toBe(25);
  expect(closeLayout.left).toBeGreaterThanOrEqual(0);
  expect(closeLayout.left + closeLayout.width).toBeLessThanOrEqual(1920);
});

test('at a small canvas the close button shrinks and stays within the canvas bounds', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const smallWidth = 400;
  const smallHeight = 300;
  const closeLayout = (api as any).getCloseLayout(smallWidth, smallHeight);
  // scale must match computeBoardScale's floor/behaviour for this canvas
  expect(closeLayout.scale).toBeLessThan(1);
  expect(closeLayout.width).toBeLessThan(30);
  expect(closeLayout.height).toBeLessThan(25);
  // the button must be fully inside the canvas, not pinned at a fixed 300px
  expect(closeLayout.left).toBeGreaterThanOrEqual(0);
  expect(closeLayout.left + closeLayout.width).toBeLessThanOrEqual(smallWidth);
});

test('close button left/width scale down consistently with the open panel at the same canvas size', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const width = 500;
  const height = 400;
  const closeLayout = (api as any).getCloseLayout(width, height);
  const scaled = (api as any).getScaledTileLayout(width, height);
  // both derive left from the same computeBoardLeft(canvasWidth, scale) call
  expect(closeLayout.scale).toBe(scaled.scale);
  expect(closeLayout.left).toBe(scaled.panel.left);
});

test('non-finite canvas size falls back to the old unscaled close geometry', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const closeLayout = (api as any).getCloseLayout(NaN, NaN);
  expect(closeLayout.scale).toBe(1);
  expect(closeLayout.width).toBe(30);
  expect(closeLayout.height).toBe(25);
  expect(closeLayout.left).toBe(300);
});

test('every tile is square and the same size', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const layout = api.getTileLayout();
  const first = layout[0];
  for (const tile of layout) {
    expect(tile.width).toBe(tile.height);
    expect(tile.width).toBe(first.width);
  }
});

test('clicking selects exactly one tile and clicking it again clears the selection', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  expect(api.getSelectedIndex()).toBe(-1);
  api.simulateClick(7);
  expect(api.getSelectedIndex()).toBe(7);
  api.simulateClick(7);
  expect(api.getSelectedIndex()).toBe(-1);
});

test('clicking a second tile swaps and leaves nothing selected', () => {
  const api = setupUi({
    deal: makeNearSolvedDeal(false),
    setUiRenderer: makeSetUiRendererMock(),
    onWin: makeOnWinSpy() as any
  });
  const before = api.getBoard();
  api.simulateClick(4);
  expect(api.getSelectedIndex()).toBe(4);
  api.simulateClick(9);
  expect(api.getSelectedIndex()).toBe(-1);
  const after = api.getBoard();
  expect(after[3]).toBe(before[8]);
  expect(after[8]).toBe(before[3]);
  expect(api.getMoveCount()).toBe(1);
});

test('a click while the preview is on selects nothing', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const before = api.getBoard();
  api.togglePreview();
  api.simulateClick(2);
  expect(api.getSelectedIndex()).toBe(-1);
  expect(api.getBoard()).toEqual(before);
});

test('shuffling clears any pending selection', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  api.simulateClick(11);
  expect(api.getSelectedIndex()).toBe(11);
  api.simulateShuffle();
  expect(api.getSelectedIndex()).toBe(-1);
});

test('setupUi move counter stays 0 after resetToOriginal', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ deal: dealMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  api.simulateSwap(1, 2);
  expect(api.getMoveCount()).toBe(1);
  api.resetToOriginal();
  expect(api.getMoveCount()).toBe(0);
  expect(calledOnWin).toBe(false);
});

test('calling setupUi twice reopens without reshuffling', () => {
  const dealMock = makeNearSolvedDeal(false);
  const setUiMock = makeSetUiRendererMock();
  const api1 = setupUi({ deal: dealMock, setUiRenderer: setUiMock });
  const boardBefore = api1.getBoard();
  const movesBefore = api1.getMoveCount();
  // second call should not run the deal again nor change move count or board
  calledDeal = false;
  calledSetUi = false;
  const api2 = setupUi({ deal: makeNearSolvedDeal(true), setUiRenderer: setUiMock });
  expect(calledDeal).toBe(false); // second call's injected deal shouldn't be invoked
  expect(api2.getBoard()).toEqual(boardBefore);
  expect(api2.getMoveCount()).toBe(movesBefore);
  expect(calledSetUi).toBe(true); // renderer was registered again
});

// ---- Rendering helpers: call the registered renderer and look at its tree.

function render() {
  expect(typeof registeredRenderer).toBe('function');
  return flatten(registeredRenderer());
}

function tileButtons(nodes: any[]) {
  return nodes.filter(n => n.type === Button && typeof n.props.key === 'string' && n.props.key.startsWith('box'));
}

function buttonLabelled(nodes: any[], value: string) {
  return nodes.find(n => n.type === Button && n.props.value === value);
}

// ---- Difficulty

test('every difficulty deals a solvable board of its own size, laid out edge to edge inside the panel', () => {
  const api = setupUi({ setUiRenderer: makeSetUiRendererMock(), onWin: makeOnWinSpy() as any });
  for (const size of GRID_SIZES) {
    api.setDifficulty(size);
    expect(api.getSize()).toBe(size);
    expect(isSolvable(api.getBoard(), size)).toBe(true);
    expect(isSolved(api.getBoard())).toBe(false);
    expect(api.getMoveCount()).toBe(0);

    const layout = api.getTileLayout();
    const panel = api.getPanelSize();
    expect(layout).toHaveLength(size * size);
    for (let slot = 0; slot < layout.length; slot++) {
      const tile = layout[slot];
      expect(tile.width).toBe(tileSizeFor(size));
      expect(tile.height).toBe(tileSizeFor(size));
      expect(tile.left + tile.width).toBeLessThanOrEqual(panel.width);
      expect(tile.top + tile.height).toBeLessThanOrEqual(panel.height);
      if (slot % size < size - 1) expect(layout[slot + 1].left - tile.left).toBe(tile.width);
      if (slot + size < layout.length) expect(layout[slot + size].top - tile.top).toBe(tile.height);
    }
    // the board fills its BOARD_PX square (to within rounding: 3 x 166 = 498)
    expect(tileSizeFor(size) * size).toBeGreaterThan(BOARD_PX - size);
  }
});

test('the difficulty buttons deal a new board at their size and mark the current one', () => {
  setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  let nodes = render();
  expect(buttonLabelled(nodes, '5x5').props.variant).toBe('primary');
  expect(buttonLabelled(nodes, '3x3').props.variant).toBe('secondary');

  calledDeal = false;
  buttonLabelled(nodes, '3x3').props.onMouseDown();
  expect(calledDeal).toBe(true);
  nodes = render();
  expect(buttonLabelled(nodes, '3x3').props.variant).toBe('primary');
  expect(buttonLabelled(nodes, '5x5').props.variant).toBe('secondary');
  expect(tileButtons(nodes)).toHaveLength(9);
});

test('changing size redraws in place: the renderer draws exactly size x size tiles, no leftovers', () => {
  const api = setupUi({ setUiRenderer: makeSetUiRendererMock() });
  expect(tileButtons(render())).toHaveLength(25);
  api.setDifficulty(3);
  expect(tileButtons(render())).toHaveLength(9);
  api.setDifficulty(4);
  const tiles = tileButtons(render());
  expect(tiles).toHaveLength(16);
  expect(new Set(tiles.map(t => t.props.key)).size).toBe(16);
});

test('the size cannot change while the preview is on', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const before = api.getBoard();
  api.togglePreview();
  calledDeal = false;
  api.setDifficulty(3);
  expect(calledDeal).toBe(false);
  expect(api.getSize()).toBe(5);
  expect(api.getBoard()).toEqual(before);
});

// ---- Timer

test('the clock shows 0:00 until the first swap, then runs, and stops at the win', () => {
  const clock = makeClock(50_000);
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock(), onWin: makeOnWinSpy() as any, now: clock.now });
  clock.t = 59_000;
  expect(api.getHud()).toEqual({ moves: 'Moves: 0', time: 'Time: 0:00' });

  clock.t = 60_000;
  api.simulateSwap(1, 4);
  clock.t = 125_000;
  expect(api.getHud()).toEqual({ moves: 'Moves: 1', time: 'Time: 1:05' });

  api.simulateSwap(1, 4);
  clock.t = 130_000;
  expect(api.simulateSwap(2, 3)).toBe(true);
  clock.t = 999_000;
  expect(api.getHud()).toEqual({ moves: 'Moves: 3', time: 'Time: 1:10' });

  // and the side column draws exactly that text
  const labels = render().filter(n => n.type === Label).map(n => n.props.value);
  expect(labels).toContain('Moves: 3');
  expect(labels).toContain('Time: 1:10');
});

test('Shuffle and Reset both stop and clear the clock', () => {
  const clock = makeClock(0);
  const api = setupUi({ deal: makeRotatingDeal(), setUiRenderer: makeSetUiRendererMock(), now: clock.now });
  clock.t = 1_000;
  api.simulateSwap(1, 2);
  clock.t = 10_000;
  expect(api.getHud().time).toBe('Time: 0:09');
  api.resetToOriginal();
  expect(api.getHud().time).toBe('Time: 0:00');

  api.simulateSwap(1, 2);
  clock.t = 20_000;
  expect(api.getHud().time).toBe('Time: 0:10');
  api.simulateShuffle();
  clock.t = 30_000;
  expect(api.getHud()).toEqual({ moves: 'Moves: 0', time: 'Time: 0:00' });
});

// ---- Win screen

test('the win screen shows the score, and Play again deals a new board and clears it', () => {
  const clock = makeClock(0);
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock(), onWin: makeOnWinSpy() as any, now: clock.now });
  expect(api.getWinScreen()).toBeNull();
  expect(buttonLabelled(render(), 'Play again')).toBeUndefined();

  clock.t = 1_000;
  api.simulateSwap(1, 4); // wasted
  clock.t = 2_000;
  api.simulateSwap(1, 4); // and back
  clock.t = 31_000;
  expect(api.simulateSwap(2, 3)).toBe(true);
  expect(calledOnWin).toBe(true);

  // 3 moves where 1 would do, 30 seconds, 5x5: 3000 - 2 * 20 - 30
  expect(scoreFor(5, 3, 1, 30_000)).toBe(2930);
  expect(api.getWinScreen()).toEqual({
    title: 'Solved!',
    score: 'Score: 2930',
    detail: '3 moves (fewest possible: 1) in 0:30'
  });
  const nodes = render();
  const labels = nodes.filter(n => n.type === Label).map(n => n.props.value);
  expect(labels).toContain('Solved!');
  expect(labels).toContain('Score: 2930');
  expect(labels).toContain('3 moves (fewest possible: 1) in 0:30');
  // drawn as one overlay panel over the board
  const overlay = nodes.find(n => n.type === UiEntity && n.props.key === 'win');
  expect(overlay.children.filter((c: any) => c.type === Label).map((c: any) => c.props.value)).toEqual([
    'Solved!', 'Score: 2930', '3 moves (fewest possible: 1) in 0:30'
  ]);

  calledDeal = false;
  buttonLabelled(nodes, 'Play again').props.onMouseDown();
  expect(calledDeal).toBe(true);
  expect(api.isWon()).toBe(false);
  expect(api.getWinScreen()).toBeNull();
  expect(api.getHud()).toEqual({ moves: 'Moves: 0', time: 'Time: 0:00' });
  expect(buttonLabelled(render(), 'Play again')).toBeUndefined();
});

test('a solved board takes no more clicks until a new round', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock(), onWin: makeOnWinSpy() as any });
  expect(api.simulateSwap(2, 3)).toBe(true);
  api.simulateClick(1);
  api.simulateClick(5);
  expect(api.getSelectedIndex()).toBe(-1);
  expect(api.getMoveCount()).toBe(1);
  expect(api.getBoard()).toEqual(solvedBoard(5));
});

test('the win screen steps aside while the preview is on', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock(), onWin: makeOnWinSpy() as any });
  api.simulateSwap(2, 3);
  expect(api.getWinScreen()).not.toBeNull();
  api.togglePreview();
  expect(api.getWinScreen()).toBeNull();
  api.togglePreview();
  expect(api.getWinScreen()).not.toBeNull();
});

// ---- One source picture, split at runtime

test('every tile draws the one source picture, cropped to the tile that sits in its slot', () => {
  const api = setupUi({ deal: makeRotatingDeal(), setUiRenderer: makeSetUiRendererMock() });
  for (const size of [5, 3] as GridSize[]) {
    api.setDifficulty(size);
    const board = api.getBoard();
    const tiles = tileButtons(render());
    expect(tiles).toHaveLength(size * size);
    tiles.forEach((tile, slot) => {
      expect(tile.props.uiBackground.textureMode).toBe('stretch');
      expect(tile.props.uiBackground.texture.src).toBe(PUZZLE_IMAGES[0]);
      expect(tile.props.uiBackground.uvs).toEqual(tileUvs(board[slot], size));
      expect(api.getTileTexture(slot + 1)).toEqual({ src: PUZZLE_IMAGES[0], uvs: tileUvs(board[slot], size) });
    });
    // the rotating deal moved every tile, so no slot is cropped to itself
    expect(tiles.some((tile, slot) => JSON.stringify(tile.props.uiBackground.uvs) === JSON.stringify(tileUvs(slot, size)))).toBe(false);
  }
});

test('the preview crops every slot to the tile that belongs there', () => {
  const api = setupUi({ deal: makeRotatingDeal(), setUiRenderer: makeSetUiRendererMock() });
  api.togglePreview();
  tileButtons(render()).forEach((tile, slot) => {
    expect(tile.props.uiBackground.uvs).toEqual(tileUvs(slot, 5));
  });
});

test('with one picture there is no Next picture button', () => {
  setupUi({ setUiRenderer: makeSetUiRendererMock() });
  expect(buttonLabelled(render(), 'Next picture')).toBeUndefined();
});

test('with several pictures, Next picture switches the source of every tile and deals a new board', () => {
  const images = ['images/puzzles/a.png', 'images/puzzles/b.png'];
  const api = setupUi({ deal: makeRotatingDeal(), setUiRenderer: makeSetUiRendererMock(), images });
  expect(api.getImage()).toBe('images/puzzles/a.png');
  const before = api.getBoard();

  buttonLabelled(render(), 'Next picture').props.onMouseDown();
  expect(api.getImage()).toBe('images/puzzles/b.png');
  expect(api.getBoard()).not.toEqual(before);
  for (const tile of tileButtons(render())) {
    expect(tile.props.uiBackground.texture.src).toBe('images/puzzles/b.png');
  }

  api.nextPicture();
  expect(api.getImage()).toBe('images/puzzles/a.png');
});

// ---- Idempotent setupUi

test('clicking the machine again and again keeps one session and builds no scene entities', () => {
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: setUiMock });
  const firstRenderer = registeredRenderer;
  api.setDifficulty(4);
  api.simulateSwap(1, 2);
  const board = api.getBoard();

  for (let click = 0; click < 5; click++) {
    registeredRenderer = null;
    const again = setupUi({ deal: makeNearSolvedDeal(true), setUiRenderer: setUiMock });
    expect(again).toBe(api);
    // the same renderer, not a second UI tree stacked on the first
    expect(registeredRenderer).toBe(firstRenderer);
  }
  expect(api.getSize()).toBe(4);
  expect(api.getBoard()).toEqual(board);
  expect(api.getMoveCount()).toBe(1);
  expect(tileButtons(render())).toHaveLength(16);
  expect(engine.addEntity).not.toHaveBeenCalled();
});

test('the close and open buttons swap renderers without rebuilding the board', () => {
  const api = setupUi({ deal: makeNearSolvedDeal(false), setUiRenderer: makeSetUiRendererMock() });
  const board = api.getBoard();
  const panel = registeredRenderer;
  buttonLabelled(render(), 'X').props.onMouseDown();
  expect(registeredRenderer).not.toBe(panel);
  buttonLabelled(render(), 'open').props.onMouseDown();
  expect(registeredRenderer).toBe(panel);
  expect(api.getBoard()).toEqual(board);
});
