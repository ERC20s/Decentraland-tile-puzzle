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

shuffleArray(imageUrls);
for (let i = 0; i < boxes.length; i++) {
  boxes[i].box.image = imageUrls[i];
}

export function setupUi() {
  let dragIndex = -1;
  let log = "Click and drag to move the boxes.";

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

  // Deterministic selection and swap flow:
  // - First click selects and highlights a box (sets dragIndex)
  // - Clicking the same box again clears selection (no swap)
  // - Clicking a different box performs swapTiles(...), checks win, calls Reward() if solved, then clears selection
  const DragThis = (boxData: BoxInfo, index: number) => {
    // If nothing is selected, select and highlight this box
    if (dragIndex === -1) {
      highlight.box.height = boxData.box.height + 10;
      highlight.box.width = boxData.box.width + 10;
      highlight.box.top = boxData.box.top - 5;
      highlight.box.left = boxData.box.left - 5;
      log = "Box is highlighted. Click another box to swap, or click the same to cancel.";
      dragIndex = index;
      return;
    }

    // If the same box is clicked again on mousedown, do nothing here; DropThat will handle deselect
    if (dragIndex === index) {
      log = "Box already selected. Release to cancel selection or click another box to swap.";
      return;
    }

    // If another box is already selected, keep selection and wait for DropThat to perform the swap
    log = "A box is already selected. Release on another box to swap.";
  };

  const DropThat = (index: number) => {
    if (dragIndex === -1) {
      log = "You need to click a box to select it first.";
      return;
    }

    // If user released on the same box, treat as deselect
    if (dragIndex === index) {
      log = "Selection cancelled.";
      resetHighlight();
      return;
    }

    // Perform swap between dragIndex and index
    swapTiles(boxes, dragIndex, index);

    log = `Dropped box ${dragIndex} on box ${index}.`;

    if (checkIfOriginalImages(boxes, originalImages)) {
      log = "Congratulations! The images are back in the original positions! Turn your sound on!";
      Reward();
    }

    resetHighlight();
  };

  const ShuffleBoard = () => {
    resetPuzzle(boxes, imageUrls);
    resetHighlight();
    log = "Board shuffled. Click and drag to move the boxes.";
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
        onMouseDown={() => ReactEcsRenderer.setUiRenderer(close)}
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
          onMouseDown={() => DragThis(box, box.box.index)}
          onMouseUp={() => DropThat(box.box.index)}
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
        onMouseDown={() => ReactEcsRenderer.setUiRenderer(uiComponent)}
      />
    </UiEntity>
  );

  ReactEcsRenderer.setUiRenderer(uiComponent);
}
