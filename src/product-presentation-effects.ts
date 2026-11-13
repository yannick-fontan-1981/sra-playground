import type { GameObservation } from './runtime/browser-games.ts';
import {
  isPresentationCurrent,
  isPresentationLoopCurrent,
  presentationFeedback,
  presentationFrameDurationMs,
  presentationFrames,
} from './product-presentation.ts';

export interface ProductPresentationEffectPorts {
  currentSelectionGeneration(): number;
  currentPresentationGeneration(): number;
  nextPresentationGeneration(): number;
  selectedGameCode(): string;
  setObservation(observation: GameObservation): void;
  setLoading(value: boolean): void;
  setFailed(value: boolean): void;
  syncLocation(observation: GameObservation): void;
  updateInterface(): void;
  paint(frame: readonly (readonly number[])[], palette: readonly string[]): void;
  wait(delayMs: number): Promise<void>;
  setBusy(value: boolean): void;
  setFeedback(message: string): void;
}

export interface ProductPresentationEffectOptions {
  fallbackPalette: readonly string[];
  releaseBusy?: boolean;
}

export interface ProductPresentationEffectResult {
  accepted: boolean;
  stale: boolean;
  presentationGeneration: number | null;
  animationFramesPainted: number;
  finalFramePainted: boolean;
}

/**
 * Execute the effectful presentation sequence behind explicit ports.
 *
 * Dispatch timing has already stopped before this function starts. The busy
 * flag remains owned by the dispatch generation until presentation and the
 * final interface update are complete.
 */
export async function presentProductObservation(
  observation: GameObservation,
  selectionGeneration: number,
  ports: ProductPresentationEffectPorts,
  options: ProductPresentationEffectOptions,
): Promise<ProductPresentationEffectResult> {
  if (!isPresentationCurrent(
    selectionGeneration,
    ports.currentSelectionGeneration(),
    observation.gameCode,
    ports.selectedGameCode(),
  )) {
    return {
      accepted: false,
      stale: true,
      presentationGeneration: null,
      animationFramesPainted: 0,
      finalFramePainted: false,
    };
  }

  ports.setObservation(observation);
  ports.setLoading(false);
  ports.setFailed(false);
  ports.syncLocation(observation);
  ports.updateInterface();

  const presentationGeneration = ports.nextPresentationGeneration();
  const frames = presentationFrames(observation);
  const delayMs = presentationFrameDurationMs(observation);
  let animationFramesPainted = 0;

  if (frames.length > 1) {
    for (const frame of frames) {
      if (!isPresentationLoopCurrent(
        presentationGeneration,
        ports.currentPresentationGeneration(),
        selectionGeneration,
        ports.currentSelectionGeneration(),
        observation.gameCode,
        ports.selectedGameCode(),
      )) {
        return {
          accepted: true,
          stale: true,
          presentationGeneration,
          animationFramesPainted,
          finalFramePainted: false,
        };
      }
      ports.paint(frame, observation.palette ?? options.fallbackPalette);
      animationFramesPainted += 1;
      if (delayMs > 0) await ports.wait(delayMs);
    }
  }

  if (!isPresentationCurrent(
    selectionGeneration,
    ports.currentSelectionGeneration(),
    observation.gameCode,
    ports.selectedGameCode(),
  )) {
    return {
      accepted: true,
      stale: true,
      presentationGeneration,
      animationFramesPainted,
      finalFramePainted: false,
    };
  }

  ports.paint(observation.frame, observation.palette ?? options.fallbackPalette);
  const feedback = presentationFeedback(observation);
  if (feedback) ports.setFeedback(feedback);
  if (options.releaseBusy !== false) ports.setBusy(false);

  return {
    accepted: true,
    stale: false,
    presentationGeneration,
    animationFramesPainted,
    finalFramePainted: true,
  };
}
