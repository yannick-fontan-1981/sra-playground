import { unmeasuredControls } from './missing-control-strategy.ts';

export interface LinkedContactStepOffer {
  readonly mode: 'access' | 'binding';
  readonly action: string;
}

/** Choose how to start an already bound path. Only the family knows which controls
 * have a vector or have already been tried at this position. */
export function selectLinkedContactStep(
  measuredAction: string | undefined,
  available: readonly string[],
  measuredOrTriedHere: (action: string) => boolean,
): LinkedContactStepOffer | null {
  if (measuredAction !== undefined && available.includes(measuredAction)) return { mode: 'access', action: measuredAction };
  const trial = unmeasuredControls(available, available, measuredOrTriedHere).next().value;
  return trial === undefined ? null : { mode: 'binding', action: trial };
}
