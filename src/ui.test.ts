import { setupUi } from './ui';

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

afterEach(() => {
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

test('setupUi resetToOriginal triggers win and returns true', () => {
  const resetMock = makeResetPuzzleMock(false);
  const setUiMock = makeSetUiRendererMock();
  const onWinSpy = makeOnWinSpy();
  const api: any = setupUi({ resetPuzzle: resetMock, setUiRenderer: setUiMock, onWin: onWinSpy as any });
  // the resetMock swapped positions 1 and 2; calling resetToOriginal() should restore solved board and win
  const result = api.resetToOriginal();
  expect(result).toBe(true);
  expect(calledOnWin).toBe(true);
});
