export interface ProductObservation {
  gameCode: string;
  state: string;
  availableActionIds: readonly number[];
}

export interface ProductReadinessState {
  observation: ProductObservation | null;
  selectedGameCode: string;
  busy: boolean;
  loading: boolean;
  failed: boolean;
}

export interface XYActionData {
  x: number;
  y: number;
}

export type ActionData = XYActionData | undefined;

export interface DispatchPorts {
  action(action: number, data?: XYActionData): Promise<ProductObservation>;
  present(observation: ProductObservation, generation: number): Promise<void>;
  now(): number;
  generation(): number;
  setBusy(value: boolean): void;
  onDispatchMeasured?(elapsedMs: number): void;
  onError?(error: unknown, generation: number): void;
}

export interface DispatchResult {
  accepted: boolean;
  stale: boolean;
  elapsedMs: number | null;
}

export function ready(state: ProductReadinessState): boolean {
  return Boolean(
    state.observation
    && state.observation.gameCode === state.selectedGameCode
    && !state.busy
    && !state.loading
    && !state.failed
  );
}

export function actionArguments(action: number, data?: XYActionData): readonly [number, ActionData] {
  if (action === 6) return [action, data];
  return [action, undefined];
}

export function canDispatchAction(state: ProductReadinessState, action: number): boolean {
  if (!ready(state)) return false;
  const observation = state.observation!;
  if (!observation.availableActionIds.includes(action)) return false;
  return !['WIN', 'LEVEL_COMPLETE', 'GAME_OVER', 'GAMEOVER'].includes(observation.state);
}

/**
 * Product action dispatch extracted from the main-page semantics.
 *
 * Important timing contract: elapsedMs measures only the action request. It stops
 * before presentation begins. A response from an older selection generation is
 * rejected and never presented.
 */
export async function dispatchProductAction(
  state: ProductReadinessState,
  action: number,
  data: XYActionData | undefined,
  ports: DispatchPorts,
): Promise<DispatchResult> {
  if (!canDispatchAction(state, action)) {
    return { accepted: false, stale: false, elapsedMs: null };
  }

  const generation = ports.generation();
  ports.setBusy(true);
  const startedAt = ports.now();

  try {
    const [mappedAction, mappedData] = actionArguments(action, data);
    const next = await ports.action(mappedAction, mappedData);
    const finishedAt = ports.now();
    const elapsedMs = Math.max(0, finishedAt - startedAt);
    ports.onDispatchMeasured?.(elapsedMs);

    if (generation !== ports.generation() || next.gameCode !== state.selectedGameCode) {
      ports.setBusy(false);
      return { accepted: false, stale: true, elapsedMs };
    }

    await ports.present(next, generation);
    ports.setBusy(false);
    return { accepted: true, stale: false, elapsedMs };
  } catch (error) {
    ports.setBusy(false);
    ports.onError?.(error, generation);
    throw error;
  }
}
