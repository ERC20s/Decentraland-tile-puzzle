import { afterEach, test, expect } from 'vitest';
import { setupUi, __resetSetupUiForTests } from './ui';

// Minimal mock types to track calls
let calledReset = false;
let calledSetUi = false;
let registeredRenderer: any = null;
let calledOnWin = false;

function makeResetPuzzleMock(shouldThrow = false) {
  return (boxes: any, images: any) => {
    calledReset = true;
    // leave the board nearly solved: swap two tiles so one swap wins
    if (Array.isArray(boxes) && boxes.length >= 3) {
      // ensure board is one swap from solved by swapping positions 1 and 2
      const tmp = boxes[1].box.image;
      boxes[1].box.image = boxes[2].box.image;
      boxes[2].box.image = tmp;
    }
    if (shouldThrow) throw new Error('reset failed');
  };
}

// A reset mock that deals a visibly DIFFERENT board on every call: it rotates
// the current images by the call number. Needed by the reset tests, where the
// point is that a second deal must not look like the first one.
function makeRotatingResetMock() {
  let call = 0;
  return (boxes: any, _images?: any) => {
    calledReset = true;
    call++;
    const current = boxes.map((b: any) => b.box.image);
    for (let i = 0; i < boxes.length; i++) {
      boxes[i].box.image = current[(i + call) % current.length];
    }
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

afterEach(() => {
  calledReset = false;
  calledSetUi = false;
  registeredRenderer = null;
  calledOnWin = false;
  __resetSetupUiForTests();
});

test('setupUi calls injected resetPuzzle and registers renderer', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock });
  expect(calledReset).toBe(true);
  expect(calledSetUi).toBe(true);
  expect(typeof registeredRenderer).toBe('function');
});

test('setupUi swallows resetPuzzle exceptions but still registers renderer', () => {
  const resetMock = makeResetPuzzleMock(true);
  const setUiMock = makeSetUiRendererMock();
  expect(() => setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock })).not.toThrow();
  expect(calledReset).toBe(true);
  expect(calledSetUi).toBe(true);
  expect(typeof registeredRenderer).toBe('function');
});

test('setupUi onWin injection and simulateSwap trigger win', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  // the resetMock swapped positions 1 and 2; calling simulateSwap(1,2) should win
  const result = api.simulateSwap(1, 2);
  expect(result).toBe(true);
  expect(calledOnWin).toBe(true);
});

test('setupUi resetToOriginal undoes the round without dealing a new board or winning', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  calledReset = false;
  // Reset restores the round's own starting scramble: it must NOT deal a new
  // board (so the injected resetPuzzle is not called) and must never auto-win.
  const result = api.resetToOriginal();
  expect(calledReset).toBe(false);
  expect(result).toBe(false);
  expect(calledOnWin).toBe(false);
});

test('reset puts back exactly the board captured at the start of the round', () => {
  const api = setupUi({
    resetPuzzle: makeRotatingResetMock(),
    setUiRenderer: makeSetUiRendererMock(),
    onWin: makeOnWinSpy() as any
  });
  const start = api.getBoardImages();
  expect(api.getRoundStartImages()).toEqual(start);

  // Make a mess of it.
  api.simulateSwap(0, 7);
  api.simulateSwap(3, 19);
  api.simulateSwap(11, 24);
  expect(api.getBoardImages()).not.toEqual(start);

  api.resetToOriginal();
  expect(api.getBoardImages()).toEqual(start);
  expect(api.getMoveCount()).toBe(0);
  expect(calledOnWin).toBe(false);
});

test('reset after a shuffle restores the new scramble, not the previous round', () => {
  const api = setupUi({
    resetPuzzle: makeRotatingResetMock(),
    setUiRenderer: makeSetUiRendererMock(),
    onWin: makeOnWinSpy() as any
  });
  const firstRound = api.getBoardImages();
  api.simulateShuffle();
  const secondRound = api.getBoardImages();
  expect(secondRound).not.toEqual(firstRound);
  expect(api.getRoundStartImages()).toEqual(secondRound);

  api.simulateSwap(2, 15);
  api.resetToOriginal();
  expect(api.getBoardImages()).toEqual(secondRound);
  expect(api.getBoardImages()).not.toEqual(firstRound);
});

test('reset never leaves the board solved, so it cannot fire the win reward', () => {
  const resetMock = makeResetPuzzleMock(false);
  const api = setupUi({
    resetPuzzle: resetMock,
    setUiRenderer: makeSetUiRendererMock(),
    onWin: makeOnWinSpy() as any
  });
  // The mock leaves the board one swap from solved; solve it, then reset.
  expect(api.simulateSwap(1, 2)).toBe(true);
  calledOnWin = false;
  api.resetToOriginal();
  // Back to the unsolved starting scramble, and no second win fired.
  expect(api.getBoardImages()).toEqual(api.getRoundStartImages());
  expect(api.getBoardImages()).not.toEqual(api.getSolvedImages());
  expect(calledOnWin).toBe(false);
});

test('setupUi move counter increments on simulateSwap', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock });
  expect(api.getMoveCount()).toBe(0);
  api.simulateSwap(0, 1);
  expect(api.getMoveCount()).toBe(1);
  api.simulateSwap(0, 1);
  expect(api.getMoveCount()).toBe(2);
});

test('setupUi move counter resets to 0 on simulateShuffle', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock });
  api.simulateSwap(0, 1);
  expect(api.getMoveCount()).toBe(1);
  api.simulateShuffle();
  expect(api.getMoveCount()).toBe(0);
});

test('setupUi preview starts off and toggles on and off', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock });
  expect(api.isPreviewOn()).toBe(false);
  api.togglePreview();
  expect(api.isPreviewOn()).toBe(true);
  api.togglePreview();
  expect(api.isPreviewOn()).toBe(false);
});

test('setupUi preview shows the solved picture and hiding it shows the board again', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock });
  const board = api.getBoardImages();
  // preview off: the slots draw the player's own board
  expect(api.getVisibleImages()).toEqual(board);
  api.togglePreview();
  // preview on: every slot draws the tile that belongs there
  expect(api.getVisibleImages()).toEqual(api.getSolvedImages());
  // the underlying board is untouched by looking at it
  expect(api.getBoardImages()).toEqual(board);
  api.togglePreview();
  expect(api.getVisibleImages()).toEqual(board);
});

test('setupUi swap attempted while preview is on changes nothing', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  const before = api.getBoardImages();
  const movesBefore = api.getMoveCount();
  api.togglePreview();
  // the mock leaves the board one swap from solved: this swap would win if it
  // were allowed to happen at all.
  const result = api.simulateSwap(1, 2);
  expect(result).toBe(false);
  expect(api.getBoardImages()).toEqual(before);
  expect(api.getMoveCount()).toBe(movesBefore);
  expect(calledOnWin).toBe(false);
});

test('setupUi toggling preview back restores the shuffled board and the move count', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  api.simulateSwap(3, 4);
  const before = api.getBoardImages();
  const moves = api.getMoveCount();
  api.togglePreview();
  api.togglePreview();
  expect(api.isPreviewOn()).toBe(false);
  expect(api.getBoardImages()).toEqual(before);
  expect(api.getMoveCount()).toBe(moves);
});

test('setupUi shuffle and reset are refused while the preview is on', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  api.simulateSwap(3, 4);
  const before = api.getBoardImages();
  api.togglePreview();
  calledReset = false;
  api.simulateShuffle();
  api.resetToOriginal();
  expect(calledReset).toBe(false);
  expect(api.getBoardImages()).toEqual(before);
  api.togglePreview();
  api.simulateShuffle();
  expect(calledReset).toBe(true);
});

test('tiles are laid out edge to edge: pitch equals tile size on both axes', () => {
  const api = setupUi({ resetPuzzle: makeResetPuzzleMock(false), setUiRenderer: makeSetUiRendererMock() });
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
  const api = setupUi({ resetPuzzle: makeResetPuzzleMock(false), setUiRenderer: makeSetUiRendererMock() });
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
  const api = setupUi({ resetPuzzle: makeResetPuzzleMock(false), setUiRenderer: makeSetUiRendererMock() });
  const scaled = (api as any).getScaledTileLayout(1920, 1080);
  expect(scaled.scale).toBe(1);
});

test('at 1024x600 every scaled tile lies inside the canvas and inside the panel', () => {
  const api = setupUi({ resetPuzzle: makeResetPuzzleMock(false), setUiRenderer: makeSetUiRendererMock() });
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
  const api = setupUi({ resetPuzzle: makeResetPuzzleMock(false), setUiRenderer: makeSetUiRendererMock() });
  // pass non-finite values to simulate missing canvas info
  const scaled = (api as any).getScaledTileLayout(NaN, NaN);
  const base = api.getTileLayout();
  expect(scaled.scale).toBe(1);
  // layout should equal the base layout
  expect(scaled.tiles.map((t: any) => ({ top: t.top, left: t.left, width: t.width, height: t.height }))).toEqual(base.map((b: any) => ({ top: b.top, left: b.left, width: b.width, height: b.height })));
});

test('every tile is square and the same size', () => {
  const api = setupUi({ resetPuzzle: makeResetPuzzleMock(false), setUiRenderer: makeSetUiRendererMock() });
  const layout = api.getTileLayout();
  const first = layout[0];
  for (const tile of layout) {
    expect(tile.width).toBe(tile.height);
    expect(tile.width).toBe(first.width);
  }
});

test('clicking selects exactly one tile and clicking it again clears the selection', () => {
  const api = setupUi({ resetPuzzle: makeResetPuzzleMock(false), setUiRenderer: makeSetUiRendererMock() });
  expect(api.getSelectedIndex()).toBe(-1);
  api.simulateClick(7);
  expect(api.getSelectedIndex()).toBe(7);
  api.simulateClick(7);
  expect(api.getSelectedIndex()).toBe(-1);
});

test('clicking a second tile swaps and leaves nothing selected', () => {
  const api = setupUi({
    resetPuzzle: makeResetPuzzleMock(false),
    setUiRenderer: makeSetUiRendererMock(),
    onWin: makeOnWinSpy() as any
  });
  const before = api.getBoardImages();
  api.simulateClick(4);
  expect(api.getSelectedIndex()).toBe(4);
  api.simulateClick(9);
  expect(api.getSelectedIndex()).toBe(-1);
  const after = api.getBoardImages();
  expect(after[3]).toBe(before[8]);
  expect(after[8]).toBe(before[3]);
  expect(api.getMoveCount()).toBe(1);
});

test('a click while the preview is on selects nothing', () => {
  const api = setupUi({ resetPuzzle: makeResetPuzzleMock(false), setUiRenderer: makeSetUiRendererMock() });
  const before = api.getBoardImages();
  api.togglePreview();
  api.simulateClick(2);
  expect(api.getSelectedIndex()).toBe(-1);
  expect(api.getBoardImages()).toEqual(before);
});

test('shuffling clears any pending selection', () => {
  const api = setupUi({ resetPuzzle: makeResetPuzzleMock(false), setUiRenderer: makeSetUiRendererMock() });
  api.simulateClick(11);
  expect(api.getSelectedIndex()).toBe(11);
  api.simulateShuffle();
  expect(api.getSelectedIndex()).toBe(-1);
});

test('setupUi move counter stays 0 after resetToOriginal', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  api.simulateSwap(0, 1);
  expect(api.getMoveCount()).toBe(1);
  api.resetToOriginal();
  expect(api.getMoveCount()).toBe(0);
  expect(calledOnWin).toBe(false);
});

test('calling setupUi twice reopens without reshuffling', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const api1 = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock });
  const boardBefore = api1.getBoardImages();
  const movesBefore = api1.getMoveCount();
  // second call should not run resetPuzzle again nor change move count or board
  const api2 = setupUi({ resetPuzzle: makeResetPuzzleMock(true), setUiRenderer: setUiMock });
  expect(calledReset).toBe(false); // second call's injected reset shouldn't be invoked
  expect(api2.getBoardImages()).toEqual(boardBefore);
  expect(api2.getMoveCount()).toBe(movesBefore);
  expect(calledSetUi).toBe(true); // renderer was registered again
});
