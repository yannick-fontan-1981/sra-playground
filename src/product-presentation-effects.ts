import type { GameObservation } from './runtime/browser-games';
import {
  isPresentationCurrent,
  isPresentationLoopCurrent,
  presentationFeedback,
  presentationFrameDurationMs,
  presentationFrames,
} from './product-presentation';

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
 * The ordering mirrors the historical main.ts flow: accept the observation,
 * synchronize location and controls, paint animation frames, paint the final
 * frame, optionally release busy, then publish terminal feedback.
 */
export async function presentProductObservation(
  next: GameObservation,
  selectedGeneration: number,
  ports: ProductPresentationEffectPorts,
  options: ProductPresentationEffectOptions,
): Promise<ProductPresentationEffectResult> {
  if (!isPresentationCurrent(
    selectedGeneration,
    ports.currentSelectionGeneration(),
    next.gameCode,
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

  const presentationGeneration = ports.nextPresentationGeneration();
  const palette = next.palette ?? options.fallbackPalette;
  let animationFramesPainted = 0;

  ports.setObservation(next);
  ports.setLoading(false);
  ports.setFailed(false);
  ports.syncLocation(next);
  ports.updateInterface();

  const frames = presentationFrames(next);
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    if (!isPresentationLoopCurrent(
      presentationGeneration,
      ports.currentPresentationGeneration(),
      selectedGeneration,
      ports.currentSelectionGeneration(),
    )) {
      return {
        accepted: false,
        stale: true,
        presentationGeneration,
        animationFramesPainted,
        finalFramePainted: false,
      };
    }

    ports.paint(frames[frameIndex]!, palette);
    animationFramesPainted += 1;

    if (frameIndex < frames.length - 1) {
      await ports.wait(presentationFrameDurationMs(next, frameIndex));
    }
  }

  if (!isPresentationLoopCurrent(
    presentationGeneration,
    ports.currentPresentationGeneration(),
    selectedGeneration,
    ports.currentSelectionGeneration(),
  )) {
    return {
      accepted: false,
      stale: true,
      presentationGeneration,
      animationFramesPainted,
      finalFramePainted: false,
    };
  }

  ports.paint(next.frame, palette);

  if (options.releaseBusy ?? true) {
    ports.setBusy(false);
    ports.updateInterface();
  }

  const feedback = presentationFeedback(next);
  if (feedback) ports.setFeedback(feedback);

  return {
    accepted: true,
    stale: false,
    presentationGeneration,
    animationFramesPainted,
    finalFramePainted: true,
  };
}
