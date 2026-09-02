import { Color4 } from '@dcl/sdk/math';
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { UiCanvasInformation, Entity, InputAction, ColliderLayer, Animator, AudioSource, AvatarAttach, GltfContainer, Material, Transform, VideoPlayer, VisibilityComponent, engine, pointerEventsSystem } from '@dcl/sdk/ecs';
import { Reward } from './reward';
import { checkIfOriginalImages, resetPuzzle, swapTiles, tileKey, BoxInfo, TileFace } from './puzzle';
import { DIFFICULTIES, PUZZLE_IMAGES, buildBoard, buildFaces, fillBoard, findDifficulty, findImage } from './slicer';

// The board is built at runtime from a chosen picture and a chosen grid size:
// every tile is the same source image shown through its own uv window (see
// src/slicer.ts), so no picture has to be cut into numbered files by hand.
const boxes: BoxInfo[] = [];

let currentDifficultyId = DIFFICULTIES[0].id;
let currentImageId = PUZZLE_IMAGES[0].id;
let faces: TileFace[] = [];
// The solved order, as face ids. Recomputed whenever the board is rebuilt.
let originalImages: string[] = [];

// (Re)build the board for the current difficulty and picture, in solved order.
// `boxes` is mutated in place so anything holding the array keeps working.
function buildBoardState(): void {
  const difficulty = findDifficulty(currentDifficultyId);
  const image = findImage(currentImageId);
  faces = buildFaces(image.src, difficulty.rows, difficulty.cols);
  fillBoard(boxes, buildBoard(image.src, difficulty.rows, difficulty.cols));
  originalImages = boxes.map((box) => tileKey(box));
}

buildBoardState();

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
  let moveCount = 0;

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
  // at module load time. Use resetPuzzle with a copied faces array so the
  // canonical solved order is preserved and errors are handled consistently
  // with ShuffleBoard.
  try {
    runResetPuzzle(boxes, faces.slice());
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
    moveCount++;
    log = `Swapped box ${dragIndex} with box ${index}.`;

    if (checkIfOriginalImages(boxes, originalImages)) {
      log = "Congratulations! The images are back in the original positions! Turn your sound on!";
      runOnWin();
    }

    resetHighlight();
  };

  const ResetBoard = () => {
    try {
      // Reset restarts the puzzle the same way Shuffle does: it must never
      // leave the board solved, so it never calls checkIfOriginalImages /
      // runOnWin. It reuses the same runResetPuzzle path as ShuffleBoard.
      runResetPuzzle(boxes, faces.slice());
      resetHighlight();
      moveCount = 0;
      log = "Board reset. Click a tile to select it.";
    } catch (e: any) {
      console.warn('[ui] ResetBoard: resetPuzzle failed', e);
      const msg = e instanceof Error ? e.message : String(e);
      log = `Reset failed: ${msg}`;
      resetHighlight();
    }
  };

  const ShuffleBoard = () => {
    try {
      runResetPuzzle(boxes, faces.slice());
      resetHighlight();
      moveCount = 0;
      log = "Board shuffled. Click a tile to select it.";
    } catch (e: any) {
      // Do not allow a resetPuzzle exception to bubble into the Decentraland runtime.
      console.warn('[ui] ShuffleBoard: resetPuzzle failed', e);
      resetHighlight();
      const msg = e instanceof Error ? e.message : String(e);
      log = `Shuffle failed: ${msg}`;
    }
  };

  // Difficulty / picture selection. Both rebuild the board from the grid size
  // and then deal it through the same runResetPuzzle path, so a fresh board is
  // never handed to the player already solved.
  const applySelection = (difficultyId: string, imageId: string, what: string) => {
    currentDifficultyId = difficultyId;
    currentImageId = imageId;
    try {
      buildBoardState();
      runResetPuzzle(boxes, faces.slice());
      log = `${what} — new board dealt. Click a tile to select it.`;
    } catch (e: any) {
      console.warn('[ui] applySelection failed', e);
      const msg = e instanceof Error ? e.message : String(e);
      log = `New board failed: ${msg}`;
    }
    resetHighlight();
    moveCount = 0;
  };

  const SelectDifficulty = (id: string) => applySelection(id, currentImageId, `Difficulty ${findDifficulty(id).label}`);
  const SelectImage = (id: string) => applySelection(currentDifficultyId, id, `Picture ${findImage(id).label}`);

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
          margin: { top: 0, left: 100 },
        }}
        onMouseDown={() => ResetBoard()}
      />
      <Label
        value={"Difficulty"}
        uiTransform={{
          width: 'auto',
          height: 'auto',
          margin: { top: 34, left: 0 },
          positionType: 'absolute',
        }}
      />
      {DIFFICULTIES.map((difficulty, i) => (
        <Button
          key={`difficulty-${difficulty.id}`}
          value={difficulty.id === currentDifficultyId ? `[${difficulty.label}]` : difficulty.label}
          uiTransform={{
            width: 70,
            height: 25,
            margin: { top: 34, left: 100 + i * 80 },
            positionType: 'absolute',
          }}
          onMouseDown={() => SelectDifficulty(difficulty.id)}
        />
      ))}
      <Label
        value={"Picture"}
        uiTransform={{
          width: 'auto',
          height: 'auto',
          margin: { top: 66, left: 0 },
          positionType: 'absolute',
        }}
      />
      {PUZZLE_IMAGES.map((image, i) => (
        <Button
          key={`image-${image.id}`}
          value={image.id === currentImageId ? `[${image.label}]` : image.label}
          uiTransform={{
            width: 100,
            height: 25,
            margin: { top: 66, left: 100 + i * 110 },
            positionType: 'absolute',
          }}
          onMouseDown={() => SelectImage(image.id)}
        />
      ))}
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
            // uvs is the runtime slice: the same picture, one window per tile.
            uvs: box.box.uvs,
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
          margin: { top: 94, left: 0 },
          positionType: 'absolute',
        }}
      />
      <Label
        value={`Moves: ${moveCount}`}
        uiTransform={{
          width: 'auto',
          height: 'auto',
          margin: { top: 94, left: 600 },
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
      moveCount++;
      if (checkIfOriginalImages(boxes, originalImages)) {
        runOnWin();
        return true;
      }
      return false;
    },
    resetToOriginal: () => {
      // Mirrors ResetBoard: restarts the puzzle via runResetPuzzle instead of
      // restoring the solved order directly, so it can never trivially satisfy
      // checkIfOriginalImages and fire runOnWin on its own.
      try {
        runResetPuzzle(boxes, faces.slice());
        moveCount = 0;
        return false;
      } catch (e: any) {
        console.warn('[ui] resetToOriginal: resetPuzzle failed', e);
        return false;
      }
    },
    simulateShuffle: () => ShuffleBoard(),
    getMoveCount: () => moveCount,
    // Exposed so tests and future UI can drive difficulty / picture selection
    // without going through a rendered button.
    selectDifficulty: (id: string) => { SelectDifficulty(id); return boxes.length },
    selectImage: (id: string) => { SelectImage(id); return boxes.length },
    getDifficultyId: () => currentDifficultyId,
    getImageId: () => currentImageId
  };
}
