import { setupUi } from './ui';

// Minimal mock types to track calls
let calledReset = false;
let calledSetUi = false;
let registeredRenderer: any = null;

function makeResetPuzzleMock(shouldThrow = false) {
  return (boxes: any, images: any) => {
    calledReset = true;
    if (shouldThrow) throw new Error('reset failed');
  };
}

function makeSetUiRendererMock() {
  return (renderer: any) => {
    calledSetUi = true;
    registeredRenderer = renderer;
  };
}

afterEach(() => {
  calledReset = false;
  calledSetUi = false;
  registeredRenderer = null;
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
