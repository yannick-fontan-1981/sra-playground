/** Public game/agent boundary. Native game state never crosses this interface. */
import type { GameObservation } from './browser-games.ts';

export const AGENT_STATUS = Object.freeze({ available: true, name: 'SRA', status: 'experimental' } as const);
export const PROTOCOL_VERSION = 2 as const;
export type ActionId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type SupportedAgentActionId = 1 | 2 | 3 | 4 | 5;
export type GameState = 'NOT_FINISHED' | 'WIN' | 'GAME_OVER' | 'LEVEL_COMPLETE';
export type AgentAction =
  | { id: Exclude<ActionId, 6> }
  | { id: 6; data: { x: number; y: number } };

export interface AgentObservation {
  protocolVersion: typeof PROTOCOL_VERSION;
  sessionId: string;
  /** Advances for every completed native action, even when pixels do not change. */
  sequence: number;
  gameCode: string;
  image: { width: 64; height: 64; pixelFormat: 'palette-index-u8'; pixels: Uint8Array };
  availableActionIds: ActionId[];
  state: GameState;
  level: number;
  levelsCompleted: number;
}

export function isTerminalState(state: string): boolean {
  return state === 'WIN' || state === 'LEVEL_COMPLETE' || state === 'GAME_OVER' || state === 'GAMEOVER';
}

export function isSupportedAgentActionId(value: unknown): value is SupportedAgentActionId {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

function integer(value: unknown, minimum: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new TypeError(`Invalid ${label}.`);
  return value;
}

/** An explicit allowlist and fresh pixel copy; no engine object or undo history. */
export function toAgentObservation(observation: GameObservation, sessionId: string, sequence: number): AgentObservation {
  if (!sessionId || typeof sessionId !== 'string') throw new TypeError('An agent session identity is required.');
  integer(sequence, 0, 'observation sequence');
  if (typeof observation.gameCode !== 'string' || !observation.gameCode) throw new TypeError('A public game code is required.');
  if (!['NOT_FINISHED', 'WIN', 'GAME_OVER', 'LEVEL_COMPLETE'].includes(observation.state)) throw new TypeError('Unsupported public game state.');
  if (observation.frame.length !== 64 || observation.frame.some(row => !Array.isArray(row) || row.length !== 64)) throw new TypeError('The public game frame must be 64 × 64.');
  const pixels = new Uint8Array(4096);
  for (let y = 0; y < 64; y += 1) for (let x = 0; x < 64; x += 1) {
    const value = observation.frame[y]![x];
    if (!Number.isInteger(value) || value! < 0 || value! > 15) throw new TypeError('A public pixel is not a palette index.');
    pixels[y * 64 + x] = value!;
  }
  if (!Array.isArray(observation.availableActionIds) || observation.availableActionIds.some(id => !Number.isInteger(id) || id < 1 || id > 7)
    || new Set(observation.availableActionIds).size !== observation.availableActionIds.length) throw new TypeError('Invalid public action vocabulary.');
  return {
    protocolVersion: PROTOCOL_VERSION, sessionId, sequence, gameCode: observation.gameCode,
    image: { width: 64, height: 64, pixelFormat: 'palette-index-u8', pixels },
    availableActionIds: [...observation.availableActionIds] as ActionId[],
    state: observation.state as GameState,
    level: integer(observation.level, 1, 'level'),
    levelsCompleted: integer(observation.levelsCompleted, 0, 'completed levels'),
  };
}

/** Validate copied worker input as well as host input; types are not a runtime gate. */
export function frameFromAgentObservation(observation: AgentObservation): number[][] {
  if (observation.protocolVersion !== PROTOCOL_VERSION || observation.image?.width !== 64 || observation.image.height !== 64
    || observation.image.pixelFormat !== 'palette-index-u8' || !(observation.image.pixels instanceof Uint8Array)
    || observation.image.pixels.length !== 4096) throw new TypeError('Invalid agent image packet.');
  const frame = Array.from({ length: 64 }, (_, y) => Array.from(observation.image.pixels.slice(y * 64, (y + 1) * 64)));
  toAgentObservation({
    gameCode: observation.gameCode, frame, frames: [], state: observation.state,
    availableActionIds: observation.availableActionIds, level: observation.level,
    levelsCompleted: observation.levelsCompleted, levelCount: observation.level,
    canUndo: false, canSelectLevel: false, defaultFps: 10,
  }, observation.sessionId, observation.sequence);
  return frame;
}

export function matchesPublicObservation(expected: AgentObservation, actual: GameObservation | null): boolean {
  if (!actual) return false;
  try {
    const current = toAgentObservation(actual, expected.sessionId, expected.sequence);
    return current.gameCode === expected.gameCode && current.level === expected.level
      && current.levelsCompleted === expected.levelsCompleted && current.state === expected.state
      && current.availableActionIds.length === expected.availableActionIds.length
      && current.availableActionIds.every((id, index) => id === expected.availableActionIds[index])
      && current.image.pixels.every((pixel, index) => pixel === expected.image.pixels[index]);
  } catch { return false; }
}

export function isAgentAction(value: unknown): value is AgentAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (typeof action.id !== 'number' || !Number.isInteger(action.id) || action.id < 1 || action.id > 7) return false;
  if (action.id !== 6) return Object.keys(action).length === 1;
  if (Object.keys(action).length !== 2 || !action.data || typeof action.data !== 'object' || Array.isArray(action.data)) return false;
  const data = action.data as Record<string, unknown>;
  return Object.keys(data).length === 2 && [data.x, data.y].every(coordinate => typeof coordinate === 'number' && Number.isInteger(coordinate) && coordinate >= 0 && coordinate < 64);
}
