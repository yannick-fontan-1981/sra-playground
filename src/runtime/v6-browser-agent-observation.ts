import { PROTOCOL_VERSION, type ActionId, type AgentObservation } from './contracts.ts';
import type { GameObservation } from './browser-games.ts';

const PUBLIC_WIDTH = 64;
const PUBLIC_HEIGHT = 64;
const PUBLIC_PIXELS = PUBLIC_WIDTH * PUBLIC_HEIGHT;

function validateIdentity(sessionId: string, sequence: number): void {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new TypeError('sessionId must be a non-empty string');
  }
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new RangeError('sequence must be a non-negative integer');
  }
}

function publicPixels(frame: number[][]): Uint8Array {
  if (!Array.isArray(frame) || frame.length !== PUBLIC_HEIGHT) {
    throw new RangeError(`game observation frame must contain exactly ${PUBLIC_HEIGHT} rows`);
  }

  const pixels = new Uint8Array(PUBLIC_PIXELS);
  let offset = 0;
  for (const row of frame) {
    if (!Array.isArray(row) || row.length !== PUBLIC_WIDTH) {
      throw new RangeError(`each game observation row must contain exactly ${PUBLIC_WIDTH} pixels`);
    }
    for (const value of row) {
      if (!Number.isInteger(value) || value < 0 || value > 15) {
        throw new RangeError('game observation pixels must be palette indices in [0, 15]');
      }
      pixels[offset] = value;
      offset += 1;
    }
  }
  return pixels;
}

function publicActions(values: readonly number[]): ActionId[] {
  if (!Array.isArray(values)) throw new TypeError('availableActionIds must be an array');
  const actions: ActionId[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    if (!Number.isInteger(value) || value < 0 || value > 7) {
      throw new RangeError('available action ids must be integers in [0, 7]');
    }
    if (!seen.has(value)) {
      seen.add(value);
      actions.push(value as ActionId);
    }
  }
  return actions;
}

function publicState(value: string): AgentObservation['state'] {
  if (value === 'NOT_FINISHED' || value === 'WIN') return value;
  throw new Error(`game observation state ${value} is not representable by the agent protocol`);
}

/**
 * Convert the browser game's public observation into the agent protocol.
 *
 * The adapter copies only the visible 64x64 palette frame, public action
 * availability and public progression. No engine object, mask, fixture or
 * hidden coordinate is retained.
 */
export function toAgentObservationFromGame(
  observation: GameObservation,
  sessionId: string,
  sequence: number,
): AgentObservation {
  validateIdentity(sessionId, sequence);
  if (!Number.isInteger(observation.level) || observation.level < 0) {
    throw new RangeError('game observation level must be a non-negative integer');
  }
  if (!Number.isInteger(observation.levelsCompleted) || observation.levelsCompleted < 0) {
    throw new RangeError('game observation levelsCompleted must be a non-negative integer');
  }

  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sequence,
    image: {
      width: PUBLIC_WIDTH,
      height: PUBLIC_HEIGHT,
      pixelFormat: 'palette-index-u8',
      pixels: publicPixels(observation.frame),
    },
    availableActionIds: publicActions(observation.availableActionIds),
    state: publicState(observation.state),
    level: observation.level,
    levelsCompleted: observation.levelsCompleted,
  };
}

export interface BrowserAgentObservationStreamOptions {
  sessionId: string;
  gameCode: string;
  initialSequence?: number;
}

/** Assign a monotonic agent sequence to successive observations of one game session. */
export class BrowserAgentObservationStream {
  readonly sessionId: string;
  readonly gameCode: string;
  #nextSequence: number;

  constructor(options: BrowserAgentObservationStreamOptions) {
    validateIdentity(options.sessionId, options.initialSequence ?? 0);
    if (typeof options.gameCode !== 'string' || options.gameCode.length === 0) {
      throw new TypeError('gameCode must be a non-empty string');
    }
    this.sessionId = options.sessionId;
    this.gameCode = options.gameCode;
    this.#nextSequence = options.initialSequence ?? 0;
  }

  next(observation: GameObservation): AgentObservation {
    if (observation.gameCode !== this.gameCode) {
      throw new Error('game observation does not belong to the stream game');
    }
    const converted = toAgentObservationFromGame(
      observation,
      this.sessionId,
      this.#nextSequence,
    );
    this.#nextSequence += 1;
    return converted;
  }

  get nextSequence(): number {
    return this.#nextSequence;
  }
}
