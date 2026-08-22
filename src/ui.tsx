import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs';
import { Reward } from './reward';




export interface BoxInfo {
  box: {
    index: number;
    height: number;
    width: number;
    text: string;
    image: string;
    top: number;
    left: number;
    click: string;
  };
}

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

const createBox = (index: number, top: number, left: number, image: string): BoxInfo => ({
  box: {
    index: index,
    height: 100,
    width: 100,
    text: "",
    image: image,
    top: top,
    left: left,
    click: "",
  },
});

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

const shuffleArray = (array: string[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

shuffleArray(imageUrls);
for (let i = 0; i < boxes.length; i++) {
  boxes[i].box.image = imageUrls[i];
}

const checkIfOriginalImages = () => {
  for (let i = 0; i < boxes.length; i++) {
    if (boxes[i].box.image !== originalImages[i]) {
      return false;
    }
  }
  return true;
};

const resetPuzzle = () => {
  shuffleArray(imageUrls);
  for (let i = 0; i < boxes.length; i++) {
    boxes[i].box.image = imageUrls[i];
  }
};

export function setupUi() {
  let dragIndex = -1;
  let log = "Click and drag to move the boxes.";
  let dragger = false

  // Track the selected song (1..3). Default to 2 to match previous default champ2.mp3
  let selectedTrack = 2

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
    dragger = false
  };

  const getTrackPath = (n: number) => {
    if (n === 1) return 'music/champ.mp3'
    if (n === 3) return 'music/champ3.mp3'
    return 'music/champ2.mp3'
  }

  const selectTrack = (n: number) => {
    selectedTrack = n
    // Re-render the UI so the selected button can reflect the change if desired
    ReactEcsRenderer.setUiRenderer(uiComponent)
  }

  const DragThis = (boxData: BoxInfo, index: number) => {
    if (dragger) {
      return;
    }else {
    if (dragIndex !== -1) {
      log = "You've already clicked a box. Click another to complete the drop.";
      return;
    } else {
      highlight.box.height = boxData.box.height + 10;
      highlight.box.width = boxData.box.width + 10;
      highlight.box.top = boxData.box.top - 5;
      highlight.box.left = boxData.box.left - 5;
      log = "Box is highlighted. Dragging started from box " + index;
    }
    dragIndex = index;
  }
  };

  const DropThat = (index: number) => {
    if (dragger) {
      if (dragIndex === index) {
        log = "You clicked the same box twice.";
        resetHighlight();
        return;
      } else {
        log = "You swapped tiles!";
    }
  }
    else {
    if (dragIndex === -1) {
      log = "You need to click a box to drag first.";
      return;
    } else if (dragIndex === index) {
      log = "Click another box to swap.";
      dragger = true
      return;
    }
  }

    const dragBox = boxes[dragIndex - 1];
    const dropBox = boxes[index - 1];

    [dragBox.box.image, dropBox.box.image] = [dropBox.box.image, dragBox.box.image];

    log = `Dropped box ${dragIndex} on box ${index}.`;

    if (checkIfOriginalImages()) {
      log = "Congratulations! The images are back in the original positions! Turn your sound on!";
      Reward(getTrackPath(selectedTrack));
    }

    resetHighlight();
  };

  const ShuffleBoard = () => {
    resetPuzzle();
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

      {/* Song selector buttons placed next to Shuffle to keep UI compact */}
      <Button
        key={"song1"}
        value={"1"}
        uiTransform={{
          width: 22,
          height: 22,
          margin: { top: 0, left: 100 },
        }}
        onMouseDown={() => selectTrack(1)}
      />
      <Button
        key={"song2"}
        value={"2"}
        uiTransform={{
          width: 22,
          height: 22,
          margin: { top: 0, left: 130 },
        }}
        onMouseDown={() => selectTrack(2)}
      />
      <Button
        key={"song3"}
        value={"3"}
        uiTransform={{
          width: 22,
          height: 22,
          margin: { top: 0, left: 160 },
        }}
        onMouseDown={() => selectTrack(3)}
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
