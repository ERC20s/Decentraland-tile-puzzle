// One round of the puzzle: the board, the move counter, the clock and the
// score. Pure like src/puzzle.ts — time comes in as a `now` argument — so the
// whole game is testable without the SDK; src/ui.tsx only draws it.
import { GridSize, dealBoard, isSolvable, isSolved, minSwapsToSolve, swapSlots } from './puzzle';

// Produces the board a round starts from. The default is dealBoard; tests
// inject fixed boards.
export type Deal = (size: GridSize) => number[];

export interface Round {
  size: GridSize;
  board: number[];
  // The deal, in slot order: what Reset puts back.
  start: number[];
  moves: number;
  // Fewest swaps that solve `start`, for the score.
  optimal: number;
  // The clock starts on the first swap (opening the panel and walking away
  // costs nothing) and stops on the winning one. Both are `now` values.
  startedAt: number | null;
  finishedAt: number | null;
}

export const newRound = (size: GridSize, deal: Deal = dealBoard): Round => {
  const board = deal(size);
  if (!isSolvable(board, size)) {
    throw new Error(`deal returned an unsolvable ${size}x${size} board: ${JSON.stringify(board)}`);
  }
  return {
    size,
    board: board.slice(),
    start: board.slice(),
    moves: 0,
    optimal: minSwapsToSolve(board),
    startedAt: null,
    finishedAt: null
  };
};

export const isWon = (round: Round): boolean => round.finishedAt !== null;

export type SwapResult = 'refused' | 'swapped' | 'won';

// Swap two 0-based slots. A finished round, an invalid slot or a tile swapped
// with itself is refused and counts no move.
export const playSwap = (round: Round, a: number, b: number, now: number): SwapResult => {
  if (isWon(round)) return 'refused';
  if (!swapSlots(round.board, a, b)) return 'refused';
  if (round.startedAt === null) round.startedAt = now;
  round.moves++;
  if (isSolved(round.board)) {
    round.finishedAt = now;
    return 'won';
  }
  return 'swapped';
};

// Reset: back to this round's own deal with the moves and clock cleared. Never
// a new deal (that is newRound) and never the solved picture.
export const restartRound = (round: Round): void => {
  round.board = round.start.slice();
  round.moves = 0;
  round.startedAt = null;
  round.finishedAt = null;
};

export const elapsedMs = (round: Round, now: number): number => {
  if (round.startedAt === null) return 0;
  const end = round.finishedAt !== null ? round.finishedAt : now;
  return Math.max(0, end - round.startedAt);
};

// Points for a perfect, instant solve at each size.
export const SCORE_BASE: Record<GridSize, number> = { 3: 1000, 4: 2000, 5: 3000 };
export const POINTS_PER_EXTRA_MOVE = 20;
export const POINTS_PER_SECOND = 1;

// The base for the size, minus 20 per move beyond the fewest possible and 1 per
// whole second, never below 0.
export const scoreFor = (size: GridSize, moves: number, optimal: number, ms: number): number => {
  const extraMoves = Math.max(0, moves - optimal);
  const seconds = Math.floor(ms / 1000);
  return Math.max(0, SCORE_BASE[size] - POINTS_PER_EXTRA_MOVE * extraMoves - POINTS_PER_SECOND * seconds);
};

// The score of a finished round; null while it is still being played.
export const roundScore = (round: Round): number | null => {
  if (round.finishedAt === null) return null;
  return scoreFor(round.size, round.moves, round.optimal, elapsedMs(round, round.finishedAt));
};

// m:ss, e.g. 0:07, 2:05, 61:00.
export const formatTime = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = total % 60;
  return `${Math.floor(total / 60)}:${seconds < 10 ? '0' : ''}${seconds}`;
};
