import { test, expect, beforeEach, afterEach } from 'vitest';
import { setupUi, __resetUiSessionForTests } from './ui';

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

function makeSetUiRendererMock() {
  return (renderer: any) => {
    calledSetUi = true;
    registeredRenderer = renderer;
  };
}

function makeOnWinSpy() {
  return () => { calledOnWin = true };
}

// setupUi now keeps a module-level session, so each test must start from a
// clean one or it would receive the previous test's injected dependencies.
beforeEach(() => {
  __resetUiSessionForTests();
});

afterEach(() => {
  __resetUiSessionForTests();
  calledReset = false;
  calledSetUi = false;
  registeredRenderer = null;
  calledOnWin = false;
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

test('setupUi resetToOriginal restarts the puzzle without triggering win', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  calledReset = false;
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  calledReset = false;
  // resetToOriginal should re-run resetPuzzle (like Shuffle) and must never
  // auto-win, since the mock always leaves the board unsolved (one swap away).
  const result = api.resetToOriginal();
  expect(calledReset).toBe(true);
  expect(result).toBe(false);
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

test('a second setupUi call re-opens the panel without shuffling the board', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock });
  expect(calledReset).toBe(true);

  calledReset = false;
  calledSetUi = false;
  registeredRenderer = null;

  // Clicking the machine again calls setupUi() a second time: it must only
  // re-register the existing renderer, never re-run resetPuzzle.
  setupUi();
  expect(calledReset).toBe(false);
  expect(calledSetUi).toBe(true);
  expect(typeof registeredRenderer).toBe('function');
});

test('move count survives a second setupUi call', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const api = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock });
  api.simulateSwap(0, 1);
  expect(api.getMoveCount()).toBe(1);

  const again = setupUi();
  expect(again.getMoveCount()).toBe(1);
  expect(again).toBe(api);
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
