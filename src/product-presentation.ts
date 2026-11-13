import type { GameObservation } from './runtime/browser-games';

export function isPresentationCurrent(
  selectedGeneration: number,
  currentSelectionGeneration: number,
  nextGameCode: string,
  selectedGameCode: string,
): boolean {
  return selectedGeneration === currentSelectionGeneration && nextGameCode === selectedGameCode;
}

export function presentationFrames(
  observation: Pick<GameObservation, 'frames' | 'frame'>,
): readonly number[][][] {
  return observation.frames.length ? observation.frames : [observation.frame];
}

export function presentationFrameDurationMs(
  observation: Pick<GameObservation, 'frameDurationsMs' | 'defaultFps'>,
  frameIndex: number,
): number {
  const requestedDuration = observation.frameDurationsMs?.[frameIndex];
  if (requestedDuration !== undefined && Number.isFinite(requestedDuration) && requestedDuration >= 0) {
    return requestedDuration;
  }
  return 1000 / Math.max(1, Math.min(60, observation.defaultFps || 10));
}

export function presentationFeedback(
  observation: Pick<GameObservation, 'state' | 'level'>,
): string {
  if (observation.state === 'WIN' || observation.state === 'LEVEL_COMPLETE') {
    return `Level ${observation.level} complete.`;
  }
  if (observation.state === 'GAME_OVER' || observation.state === 'GAMEOVER') {
    return 'Game over. Undo or reset to continue.';
  }
  return '';
}
