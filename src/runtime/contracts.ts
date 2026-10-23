/**
 * Public boundary for a future, genuine SRA Web Worker.
 * This is a protocol, not an agent implementation or a solver.
 */
import type { PipesObservation } from '../games/pipes.ts';

export const AGENT_STATUS = Object.freeze({
  available: false,
  name: 'SRA',
  status: 'port-pending',
} as const);

export const PROTOCOL_VERSION = 1 as const;
export type ActionId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type AgentAction =
  | { id: Exclude<ActionId, 6> }
  | { id: 6; data: { x: number; y: number } };

/** Only public pixels, action availability, and progression enter reasoning. */
export interface AgentObservation {
  protocolVersion: typeof PROTOCOL_VERSION;
  /** Changes whenever a game, level, or manual session is restarted. */
  sessionId: string;
  /** Monotonic within a session, including actions that leave pixels unchanged. */
  sequence: number;
  /** Row-major, one public palette index (0..15) per pixel; not RGB bytes. */
  image: { width: 64; height: 64; pixelFormat: 'palette-index-u8'; pixels: Uint8Array };
  availableActionIds: ActionId[];
  state: 'NOT_FINISHED' | 'WIN';
  level: number;
  levelsCompleted: number;
}

/**
 * Explicit allowlist: never spread the engine observation into worker messages.
 * Engine boards, masks, connectivity, source coordinates and level fixtures must
 * not be available to the reasoning worker. The image owns a fresh pixel copy.
 */
export function toAgentObservation(
  observation: PipesObservation,
  sessionId: string,
  sequence: number,
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sequence,
    image: { width: 64, height: 64, pixelFormat: 'palette-index-u8', pixels: Uint8Array.from(observation.frame.flat()) },
    availableActionIds: observation.available_action_ids.filter(
      (id): id is ActionId => Number.isInteger(id) && id >= 0 && id <= 7,
    ),
    state: observation.state,
    level: observation.level,
    levelsCompleted: observation.levels_completed,
  };
}

export type AgentWorkerRequest =
  | { type: 'initialize'; protocolVersion: 1; sessionId: string; seed: number }
  | { type: 'observe'; observation: AgentObservation; budgetMs: number }
  | { type: 'cancel'; sessionId: string };

export type AgentWorkerResponse =
  | { type: 'ready'; sessionId: string; implementationRevision: string }
  | { type: 'action'; sessionId: string; sequence: number; action: AgentAction }
  | { type: 'stopped'; sessionId: string; reason: 'cancelled' | 'budget' | 'complete' }
  | { type: 'error'; sessionId: string; message: string };

/** Validate at the host boundary; TypeScript types alone do not validate messages. */
export function isAgentAction(value: unknown): value is AgentAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as Record<string, unknown>;
  if (typeof action.id !== 'number' || !Number.isInteger(action.id) || action.id < 0 || action.id > 7) return false;
  if (action.id !== 6) return true;
  if (!action.data || typeof action.data !== 'object') return false;
  const data = action.data as Record<string, unknown>;
  return [data.x, data.y].every(
    coordinate => typeof coordinate === 'number' && Number.isInteger(coordinate) && coordinate >= 0 && coordinate < 64,
  );
}
