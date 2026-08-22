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

for (let i = 0; i < gridRows; i++) {
  for (let j = 0; j < gridCols; j++) {
    const index = i * gridCols + j;
    boxes.push(createBox(index + 1, 50 + i * 120, 100 + j * 120, imageUrls[index]));
  }
}

const originalImages = boxes.map(box => box.box.image);

let highlight = {
  box: {
    height: 0,
    width: 0,
    text: "",
    image: "",
    top: 0,
    left: 0,
    click: "",
  },
};

export function setupUi(deps?: { resetPuzzle?: typeof resetPuzzle; setUiRenderer?: (renderer: any) => void; onWin?: () => void }) {
  // dependency fallbacks: use injected functions for tests or fall back to runtime implementations
  const runResetPuzzle = deps && deps.resetPuzzle ? deps.resetPuzzle : resetPuzzle;
  const runSetUiRenderer = deps && deps.setUiRenderer ? deps.setUiRenderer : ((renderer: any) => ReactEcsRenderer.setUiRenderer(renderer));
  const runOnWin = deps && deps.onWin ? deps.onWin : Reward;

  let dragIndex = -1;
  let log = "Click a tile to select it, then click another to swap.";

  const resetHighlight = () => {
    highlight = {
      box: {
        height: 0,
        width: 0,
        text: "",
        image: "",
        top: 0,
        left: 0,
        click: "",
      },
    };
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
    if (dragIndex === -1) {
      // select
      highlight.box.height = boxData.box.height + 10;
      highlight.box.width = boxData.box.width + 10;
      highlight.box.top = boxData.box.top - 5;
      highlight.box.left = boxData.box.left - 5;
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
    log = `Swapped box ${dragIndex} with box ${index}.`;

    if (checkIfOriginalImages(boxes, originalImages)) {
      log = "Congratulations! The images are back in the original positions! Turn your sound on!";
      runOnWin();
    }

    resetHighlight();
  };

  const ShuffleBoard = () => {
    try {
      runResetPuzzle(boxes, imageUrls.slice());
      resetHighlight();
      log = "Board shuffled. Click a tile to select it.";
    } catch (e: any) {
      // Do not allow a resetPuzzle exception to bubble into the Decentraland runtime.
      console.warn('[ui] ShuffleBoard: resetPuzzle failed', e);
      resetHighlight();
      const msg = e instanceof Error ? e.message : String(e);
      log = `Shuffle failed: ${msg}`;
    }
  };

  const ResetBoard = () => {
    try {
      // Assign the canonical solved image order directly from originalImages so
      // this action always restores the solved state regardless of injected
      // resetPuzzle mocks used in tests.
      for (let i = 0; i < boxes.length && i < originalImages.length; i++) {
        boxes[i].box.image = originalImages[i];
      }
      resetHighlight();
      log = "Board reset to the solved image order.";

      if (checkIfOriginalImages(boxes, originalImages)) {
        log = "Congratulations! The images are back in the original positions! Turn your sound on!";
        runOnWin();
        return true;
      }
      return false;
    } catch (e: any) {
      console.warn('[ui] ResetBoard failed', e);
      resetHighlight();
      const msg = e instanceof Error ? e.message : String(e);
      log = `Reset failed: ${msg}`;
      return false;
    }
  };

  const uiComponent = () => (
    <UiEntity
      uiTransform={{
        width: 800,
        height: 600,
        margin: '16px 0 8px 300px',
      }}
    >
            <UiEntity
         uiTransform={{
          width: highlight.box.width, // Adjusted to add unit
          height: highlight.box.height, // Adjusted to add unit
          margin: { top: highlight.box.top, left: highlight.box.left },
          positionType: 'absolute',

        }}
        uiBackground={{ color: Color4.create(0.5, 0.3, 0.7, 0.6) }}
      >
        </UiEntity>
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
          margin: { top: 0, left: 8 },
        }}
        onMouseDown={() => ResetBoard()}
      />
      {boxes.map((box) => (
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
              src: box.box.image,
            },
            color: Color4.White(),
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

  return {
    simulateSwap: (i: number, j: number) => {
      swapTiles(boxes, i, j);
      if (checkIfOriginalImages(boxes, originalImages)) {
        runOnWin();
        return true;
      }
      return false;
    },
    resetToOriginal: () => {
      return ResetBoard();
    }
  };
}
