import {
  browserGameRuntimeObservationIdentity,
  parseBrowserGameRuntimeCheckpoint,
  type BrowserGameRuntimeCheckpointV1,
} from './browser-games.ts';
import {
  parseBrowserAgentControllerCheckpoint,
  type BrowserAgentControllerCheckpointV1,
} from './v6-browser-agent-controller.ts';

export const BROWSER_DURABLE_SESSION_STORAGE_KEY =
  'sra-playground:v6-browser-durable-session:v1';
export const BROWSER_DURABLE_SESSION_COMPATIBILITY_REF =
  'op01-op31-browser-runtime-agent-journal-v1';
export const BROWSER_DURABLE_SESSION_DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
export const BROWSER_DURABLE_SESSION_MAX_TTL_MS = 24 * 60 * 60 * 1000;
export const BROWSER_DURABLE_SESSION_MAX_BYTES = 4_500_000;

const UINT8_MARKER = '__sra_uint8_v1__';

export interface BrowserDurableSessionCheckpointV1 {
  version: 1;
  compatibilityRef: typeof BROWSER_DURABLE_SESSION_COMPATIBILITY_REF;
  replayPolicy: 'deterministic-command-journal';
  savedAtMs: number;
  expiresAtMs: number;
  gameCode: string;
  selectionGeneration: number;
  mode: 'manual' | 'agent';
  observationIdentity: string;
  runtime: BrowserGameRuntimeCheckpointV1;
  agent: BrowserAgentControllerCheckpointV1;
}

export interface BrowserDurableSessionCheckpointInput {
  runtime: BrowserGameRuntimeCheckpointV1;
  agent: BrowserAgentControllerCheckpointV1;
  selectionGeneration: number;
  mode: 'manual' | 'agent';
  savedAtMs?: number;
  ttlMs?: number;
}

export interface BrowserSessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type BrowserDurableSessionSaveResult =
  | { status: 'saved'; bytes: number }
  | { status: 'too-large'; bytes: number }
  | { status: 'unavailable'; error: unknown };

export type BrowserDurableSessionLoadResult =
  | { status: 'ready'; checkpoint: BrowserDurableSessionCheckpointV1; bytes: number }
  | { status: 'empty' }
  | { status: 'expired' }
  | { status: 'game-mismatch'; gameCode: string }
  | { status: 'invalid'; error: unknown }
  | { status: 'unavailable'; error: unknown };

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function sameActionRequest(
  request: BrowserGameRuntimeCheckpointV1['pending'] extends infer T
    ? T extends { request: infer R } ? R : never
    : never,
  checkpoint: BrowserAgentControllerCheckpointV1,
): boolean {
  const pendingReturn = checkpoint.host.session?.pendingReturn;
  if (!pendingReturn || request.type !== 'action') return false;
  const action = pendingReturn.preparation.action;
  if (request.actionId !== action.id) return false;
  if (action.id !== 6) return request.data === undefined;
  return request.data?.x === action.data.x && request.data?.y === action.data.y;
}

function encodeDurableCheckpoint(value: BrowserDurableSessionCheckpointV1): string {
  return JSON.stringify(value, function replacer(this: Record<string, unknown>, key, encoded) {
    const original = key === '' ? value : this[key];
    if (original instanceof Uint8Array) {
      return { [UINT8_MARKER]: [...original] };
    }
    return encoded;
  });
}

function decodeDurableCheckpoint(serialized: string): unknown {
  return JSON.parse(serialized, (_key, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const record = value as Record<string, unknown>;
    if (!Object.hasOwn(record, UINT8_MARKER)) return value;
    const keys = Object.keys(record);
    if (keys.length !== 1 || !Array.isArray(record[UINT8_MARKER])) {
      throw new TypeError('invalid durable Uint8Array encoding');
    }
    const values = record[UINT8_MARKER] as unknown[];
    if (values.some(item => typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item > 255)) {
      throw new RangeError('durable Uint8Array values must be bytes');
    }
    return Uint8Array.from(values as number[]);
  });
}

export function createBrowserDurableSessionCheckpoint(
  input: BrowserDurableSessionCheckpointInput,
): BrowserDurableSessionCheckpointV1 {
  const runtime = parseBrowserGameRuntimeCheckpoint(input.runtime);
  const agent = parseBrowserAgentControllerCheckpoint(input.agent);
  const session = agent.host.session;
  if (!session) throw new Error('durable browser session requires an active Agent session');
  if (runtime.gameCode !== session.gameCode) {
    throw new Error('durable browser runtime and Agent checkpoints belong to different games');
  }

  const runtimeIdentity = runtime.entries.at(-1)?.observationIdentity;
  if (!runtimeIdentity || runtimeIdentity !== session.observationIdentity) {
    throw new Error('durable browser runtime and Agent checkpoints are bound to different observations');
  }
  const computedAgentIdentity = browserGameRuntimeObservationIdentity(session.gameObservation);
  if (computedAgentIdentity !== session.observationIdentity) {
    throw new Error('durable browser Agent observation identity is not reproducible');
  }

  const runtimePending = runtime.pending;
  const agentPending = session.pendingReturn;
  if (Boolean(runtimePending) !== Boolean(agentPending)) {
    throw new Error('durable browser runtime and Agent pending-return boundaries differ');
  }
  if (runtimePending && !sameActionRequest(runtimePending.request, agent)) {
    throw new Error('durable browser pending runtime request does not match the Agent action');
  }

  const selectionGeneration = nonNegativeInteger(
    input.selectionGeneration,
    'durable browser selection generation',
  );
  if (input.mode !== 'manual' && input.mode !== 'agent') {
    throw new TypeError('durable browser mode must be manual or agent');
  }
  const savedAtMs = finite(input.savedAtMs ?? Date.now(), 'durable browser savedAtMs');
  const ttlMs = finite(
    input.ttlMs ?? BROWSER_DURABLE_SESSION_DEFAULT_TTL_MS,
    'durable browser ttlMs',
  );
  if (ttlMs <= 0 || ttlMs > BROWSER_DURABLE_SESSION_MAX_TTL_MS) {
    throw new RangeError('durable browser ttlMs is outside the supported range');
  }

  return {
    version: 1,
    compatibilityRef: BROWSER_DURABLE_SESSION_COMPATIBILITY_REF,
    replayPolicy: 'deterministic-command-journal',
    savedAtMs,
    expiresAtMs: savedAtMs + ttlMs,
    gameCode: runtime.gameCode,
    selectionGeneration,
    mode: input.mode,
    observationIdentity: session.observationIdentity,
    runtime,
    agent,
  };
}

export function parseBrowserDurableSessionCheckpoint(
  value: unknown,
): BrowserDurableSessionCheckpointV1 {
  const checkpoint = object(value, 'durable browser session checkpoint');
  if (
    checkpoint.version !== 1
    || checkpoint.compatibilityRef !== BROWSER_DURABLE_SESSION_COMPATIBILITY_REF
    || checkpoint.replayPolicy !== 'deterministic-command-journal'
  ) {
    throw new TypeError('unsupported durable browser session checkpoint');
  }
  const savedAtMs = finite(checkpoint.savedAtMs, 'durable browser checkpoint savedAtMs');
  const expiresAtMs = finite(checkpoint.expiresAtMs, 'durable browser checkpoint expiresAtMs');
  if (expiresAtMs <= savedAtMs || expiresAtMs - savedAtMs > BROWSER_DURABLE_SESSION_MAX_TTL_MS) {
    throw new RangeError('durable browser checkpoint expiration is invalid');
  }
  const gameCode = nonEmpty(checkpoint.gameCode, 'durable browser checkpoint gameCode');
  const observationIdentity = nonEmpty(
    checkpoint.observationIdentity,
    'durable browser checkpoint observation identity',
  );
  const mode = checkpoint.mode;
  if (mode !== 'manual' && mode !== 'agent') {
    throw new TypeError('durable browser checkpoint mode must be manual or agent');
  }

  const normalized = createBrowserDurableSessionCheckpoint({
    runtime: checkpoint.runtime as BrowserGameRuntimeCheckpointV1,
    agent: checkpoint.agent as BrowserAgentControllerCheckpointV1,
    selectionGeneration: nonNegativeInteger(
      checkpoint.selectionGeneration,
      'durable browser checkpoint selection generation',
    ),
    mode,
    savedAtMs,
    ttlMs: expiresAtMs - savedAtMs,
  });
  if (normalized.gameCode !== gameCode || normalized.observationIdentity !== observationIdentity) {
    throw new Error('durable browser checkpoint binding metadata changed');
  }
  return normalized;
}

export class BrowserDurableSessionStore {
  readonly #storage: BrowserSessionStorageLike;
  readonly #key: string;
  readonly #maxBytes: number;

  constructor(
    storage: BrowserSessionStorageLike,
    options: { key?: string; maxBytes?: number } = {},
  ) {
    this.#storage = storage;
    this.#key = options.key ?? BROWSER_DURABLE_SESSION_STORAGE_KEY;
    this.#maxBytes = options.maxBytes ?? BROWSER_DURABLE_SESSION_MAX_BYTES;
    if (!Number.isInteger(this.#maxBytes) || this.#maxBytes <= 0) {
      throw new RangeError('durable browser storage maxBytes must be a positive integer');
    }
  }

  save(value: BrowserDurableSessionCheckpointV1): BrowserDurableSessionSaveResult {
    try {
      const checkpoint = parseBrowserDurableSessionCheckpoint(value);
      const serialized = encodeDurableCheckpoint(checkpoint);
      const bytes = new TextEncoder().encode(serialized).byteLength;
      if (bytes > this.#maxBytes) {
        this.clear();
        return { status: 'too-large', bytes };
      }
      this.#storage.setItem(this.#key, serialized);
      return { status: 'saved', bytes };
    } catch (error) {
      return { status: 'unavailable', error };
    }
  }

  load(
    nowMs = Date.now(),
    expectedGameCode?: string,
  ): BrowserDurableSessionLoadResult {
    let serialized: string | null;
    try {
      serialized = this.#storage.getItem(this.#key);
    } catch (error) {
      return { status: 'unavailable', error };
    }
    if (serialized === null) return { status: 'empty' };

    const bytes = new TextEncoder().encode(serialized).byteLength;
    if (bytes > this.#maxBytes) {
      this.clear();
      return { status: 'invalid', error: new RangeError('durable browser checkpoint is too large') };
    }

    try {
      const checkpoint = parseBrowserDurableSessionCheckpoint(
        decodeDurableCheckpoint(serialized),
      );
      if (checkpoint.expiresAtMs <= nowMs) {
        this.clear();
        return { status: 'expired' };
      }
      if (expectedGameCode !== undefined && checkpoint.gameCode !== expectedGameCode) {
        this.clear();
        return { status: 'game-mismatch', gameCode: checkpoint.gameCode };
      }
      return { status: 'ready', checkpoint, bytes };
    } catch (error) {
      this.clear();
      return { status: 'invalid', error };
    }
  }

  clear(): boolean {
    try {
      this.#storage.removeItem(this.#key);
      return true;
    } catch {
      return false;
    }
  }
}