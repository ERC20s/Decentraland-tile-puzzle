import { vi, describe, it, expect, beforeEach } from 'vitest'

// We will mock resetPuzzle from ./puzzle and ReactEcsRenderer.setUiRenderer
vi.mock('./puzzle', () => {
  return {
    resetPuzzle: vi.fn(),
    createBox: () => { throw new Error('createBox should not be called in this test') },
    shuffleArray: () => { throw new Error('shuffleArray should not be called in this test') },
    checkIfOriginalImages: () => false,
    swapTiles: () => {},
  }
})

const setUiRendererMock = vi.fn()
vi.mock('@dcl/sdk/react-ecs', () => {
  return {
    ReactEcsRenderer: {
      setUiRenderer: setUiRendererMock,
    },
    UiEntity: () => null,
    Button: () => null,
    Label: () => null,
    default: {},
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('setupUi', () => {
  it('calls resetPuzzle and registers ui renderer', () => {
    // Import after mocks so setupUi uses the mocked functions
    const { setupUi } = require('./ui')
    // Call setupUi; it should call mocked resetPuzzle and register the ui renderer
    expect(() => setupUi()).not.toThrow()
    const { resetPuzzle } = require('./puzzle')
    expect(resetPuzzle).toHaveBeenCalled()
    expect(setUiRendererMock).toHaveBeenCalled()
    // setUiRenderer should be called with a function
    const arg = setUiRendererMock.mock.calls[0][0]
    expect(typeof arg).toBe('function')
  })

  it('does not throw if resetPuzzle throws and still registers renderer', () => {
    const { resetPuzzle } = require('./puzzle')
    resetPuzzle.mockImplementationOnce(() => { throw new Error('mock failure') })
    const { setupUi } = require('./ui')
    expect(() => setupUi()).not.toThrow()
    expect(setUiRendererMock).toHaveBeenCalled()
  })
})
