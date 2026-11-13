import { digestPublicValue } from './v6-public-observation-measurement.ts';

/** Browser-only bridge. Game state and history stay inside a dedicated worker. */
export function buildActionRequest(actionId: number, data?: { x: number; y: number }): GameRuntimeRequest {
  return { type: 'action', actionId, ...(data === undefined ? {} : { data }) };
}

export interface GameObservation {
  gameCode: string;
  frame: number[][];
  frames: number[][][];
  frameDurationsMs?: number[];
  state: string;
  availableActionIds: number[];
  canUndo: boolean;
  canSelectLevel: boolean;
  level: number;
  levelCount: number;
  levelsCompleted: number;
  defaultFps: number;
  palette?: string[];
}

export type GameRuntimeRequest = { type: 'load'; code: string; level?: number }
  | { type: 'action'; actionId: number; data?: { x: number; y: number } }
  | { type: 'undo' | 'reset' | 'restart' }
  | { type: 'selectLevel'; level: number };

export interface BrowserGameRuntimeJournalEntryV1 {
  sequence: number;
  request: GameRuntimeRequest;
  observationIdentity: string;
}

export interface BrowserGameRuntimePendingRequestV1 {
  sequence: number;
  request: GameRuntimeRequest;
}

/**
 * Durable runtime state is a deterministic command journal, not a hidden Python
 * heap snapshot. Every committed observation is bound to its public digest and
 * must match again during replay before the Agent checkpoint may be restored.
 */
export interface BrowserGameRuntimeCheckpointV1 {
  version: 1;
  gameCode: string;
  entries: BrowserGameRuntimeJournalEntryV1[];
  pending: BrowserGameRuntimePendingRequestV1 | null;
}

export interface BrowserGameRuntimeRestoreResult {
  observation: GameObservation;
  replayedEntries: number;
  replayedPending: boolean;
}

interface Pending {
  resolve: (observation: GameObservation) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  request: GameRuntimeRequest;
  journalSequence: number | null;
}

export interface BrowserGameRuntimeOptions {
  workerFactory?: () => Worker;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timeout: ReturnType<typeof setTimeout>) => void;
  requestTimeoutMs?: number;
}

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

function integer(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be an integer >= ${minimum}`);
  }
  return value;
}

function optionalCoordinateData(value: unknown, label: string): { x: number; y: number } | undefined {
  if (value === undefined) return undefined;
  const data = object(value, label);
  const x = integer(data.x, `${label}.x`);
  const y = integer(data.y, `${label}.y`);
  if (x > 63 || y > 63) throw new RangeError(`${label} coordinates must be in [0, 63]`);
  return { x, y };
}

export function parseBrowserGameRuntimeRequest(value: unknown): GameRuntimeRequest {
  const request = object(value, 'browser game runtime request');
  const type = request.type;
  if (type === 'load') {
    const code = nonEmpty(request.code, 'browser game load code');
    const level = request.level === undefined
      ? undefined
      : integer(request.level, 'browser game load level', 1);
    return { type, code, ...(level === undefined ? {} : { level }) };
  }
  if (type === 'action') {
    const actionId = integer(request.actionId, 'browser game action id');
    if (actionId > 7) throw new RangeError('browser game action id must be in [0, 7]');
    const data = optionalCoordinateData(request.data, 'browser game action data');
    return { type, actionId, ...(data === undefined ? {} : { data }) };
  }
  if (type === 'selectLevel') {
    return { type, level: integer(request.level, 'browser game selected level', 1) };
  }
  if (type === 'undo' || type === 'reset' || type === 'restart') return { type };
  throw new TypeError('unsupported browser game runtime request');
}

export function browserGameRuntimeObservationIdentity(observation: GameObservation): string {
  return `browser-game-observation:${digestPublicValue(observation)}`;
}

export function parseBrowserGameRuntimeCheckpoint(
  value: unknown,
): BrowserGameRuntimeCheckpointV1 {
  const checkpoint = object(value, 'browser game runtime checkpoint');
  if (checkpoint.version !== 1) {
    throw new TypeError('unsupported browser game runtime checkpoint version');
  }
  const gameCode = nonEmpty(checkpoint.gameCode, 'browser game runtime checkpoint gameCode');
  if (!Array.isArray(checkpoint.entries) || checkpoint.entries.length === 0) {
    throw new TypeError('browser game runtime checkpoint entries must be a non-empty array');
  }

  const entries = checkpoint.entries.map((raw, index): BrowserGameRuntimeJournalEntryV1 => {
    const entry = object(raw, `browser game runtime checkpoint entry[${index}]`);
    const sequence = integer(entry.sequence, `browser game runtime checkpoint entry[${index}].sequence`, 1);
    if (sequence !== index + 1) {
      throw new Error('browser game runtime checkpoint journal sequence is not contiguous');
    }
    return {
      sequence,
      request: parseBrowserGameRuntimeRequest(entry.request),
      observationIdentity: nonEmpty(
        entry.observationIdentity,
        `browser game runtime checkpoint entry[${index}].observationIdentity`,
      ),
    };
  });
  const first = entries[0]!.request;
  if (first.type !== 'load' || first.code !== gameCode) {
    throw new Error('browser game runtime checkpoint must begin with the matching load request');
  }
  if (entries.slice(1).some(entry => entry.request.type === 'load')) {
    throw new Error('browser game runtime checkpoint contains a second load request');
  }

  let pending: BrowserGameRuntimePendingRequestV1 | null = null;
  if (checkpoint.pending !== null) {
    const rawPending = object(checkpoint.pending, 'browser game runtime pending request');
    const sequence = integer(rawPending.sequence, 'browser game runtime pending sequence', 1);
    if (sequence !== entries.length + 1) {
      throw new Error('browser game runtime pending sequence is not contiguous');
    }
    const request = parseBrowserGameRuntimeRequest(rawPending.request);
    if (request.type === 'load') {
      throw new Error('browser game runtime pending request cannot replace the loaded session');
    }
    pending = { sequence, request };
  }

  return {
    version: 1,
    gameCode,
    entries: structuredClone(entries),
    pending: structuredClone(pending),
  };
}

export class BrowserGameRuntime {
  private worker: Worker | null = null;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private disposed = false;
  private restoring = false;
  private journalValid = false;
  private journalGameCode: string | null = null;
  private journalEntries: BrowserGameRuntimeJournalEntryV1[] = [];
  private readonly workerFactory: () => Worker;
  private readonly setTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (timeout: ReturnType<typeof setTimeout>) => void;
  private readonly requestTimeoutMs: number;

  constructor(options: BrowserGameRuntimeOptions = {}) {
    this.workerFactory = options.workerFactory
      ?? (() => new Worker(new URL('./game-worker.ts', import.meta.url), { type: 'module', name: 'sra-games' }));
    this.setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer = options.clearTimer ?? (timeout => clearTimeout(timeout));
    this.requestTimeoutMs = options.requestTimeoutMs ?? 120000;
  }

  private getWorker(): Worker {
    if (this.disposed) throw new Error('The game session is closed.');
    if (this.worker) return this.worker;
    const worker = this.workerFactory();
    worker.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as { id: number; result?: GameObservation & { code?: string }; error?: string };
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      this.clearTimer(pending.timeout);
      if (message.error) {
        if (pending.journalSequence !== null) this.invalidateJournal();
        pending.reject(new Error(message.error));
      } else if (message.result) {
        const gameCode = message.result.code ?? message.result.gameCode;
        if (typeof gameCode !== 'string' || !gameCode) {
          if (pending.journalSequence !== null) this.invalidateJournal();
          pending.reject(new Error('The game returned an invalid response.'));
        } else {
          const observation = { ...message.result, gameCode };
          if (pending.journalSequence !== null) {
            this.commitJournal(pending.journalSequence, pending.request, observation);
          }
          pending.resolve(observation);
        }
      } else {
        if (pending.journalSequence !== null) this.invalidateJournal();
        pending.reject(new Error('The game returned an invalid response.'));
      }
    });
    worker.addEventListener('error', () => this.fail(new Error('The local game runtime stopped. Please load the game again.')));
    worker.addEventListener('messageerror', () => this.fail(new Error('The game response could not be read. Please load the game again.')));
    this.worker = worker;
    return worker;
  }

  private invalidateJournal(): void {
    this.journalValid = false;
    this.journalGameCode = null;
    this.journalEntries = [];
  }

  private beginJournalRequest(request: GameRuntimeRequest): number | null {
    if (this.restoring) return null;
    if (request.type === 'load') {
      if (this.pending.size > 0) {
        this.invalidateJournal();
        return null;
      }
      this.journalValid = true;
      this.journalGameCode = request.code;
      this.journalEntries = [];
      return 1;
    }
    if (!this.journalValid || !this.journalGameCode || this.journalEntries.length === 0) {
      return null;
    }
    if (this.pending.size > 0) {
      this.invalidateJournal();
      return null;
    }
    return this.journalEntries.length + 1;
  }

  private commitJournal(
    sequence: number,
    request: GameRuntimeRequest,
    observation: GameObservation,
  ): void {
    if (!this.journalValid || !this.journalGameCode) return;
    if (sequence !== this.journalEntries.length + 1) {
      this.invalidateJournal();
      return;
    }
    if (request.type === 'load' && observation.gameCode !== request.code) {
      this.invalidateJournal();
      return;
    }
    if (observation.gameCode !== this.journalGameCode) {
      this.invalidateJournal();
      return;
    }
    this.journalEntries.push({
      sequence,
      request: structuredClone(request),
      observationIdentity: browserGameRuntimeObservationIdentity(observation),
    });
  }

  private fail(error: Error): void {
    this.worker?.terminate();
    this.worker = null;
    if (this.pending.size > 0) this.invalidateJournal();
    for (const pending of this.pending.values()) {
      this.clearTimer(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private request(request: GameRuntimeRequest, trackJournal = true): Promise<GameObservation> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      const id = ++this.nextId;
      const journalSequence = trackJournal ? this.beginJournalRequest(request) : null;
      const timeout = this.setTimer(
        () => this.fail(new Error('Loading took too long. Please try the game again.')),
        this.requestTimeoutMs,
      );
      this.pending.set(id, {
        resolve,
        reject,
        timeout,
        request: structuredClone(request),
        journalSequence,
      });
      worker.postMessage({ id, request });
    });
  }

  snapshot(): BrowserGameRuntimeCheckpointV1 {
    if (this.disposed) throw new Error('The game session is closed.');
    if (this.restoring) throw new Error('The game runtime cannot be checkpointed while replaying.');
    if (!this.journalValid || !this.journalGameCode || this.journalEntries.length === 0) {
      throw new Error('The game runtime has no deterministic journal to checkpoint.');
    }
    if (this.pending.size > 1) {
      throw new Error('The game runtime cannot checkpoint concurrent requests.');
    }
    const active = [...this.pending.values()][0];
    if (active && active.journalSequence === null) {
      throw new Error('The pending game request is not part of the deterministic journal.');
    }
    const checkpoint: BrowserGameRuntimeCheckpointV1 = {
      version: 1,
      gameCode: this.journalGameCode,
      entries: structuredClone(this.journalEntries),
      pending: active
        ? {
            sequence: active.journalSequence!,
            request: structuredClone(active.request),
          }
        : null,
    };
    return parseBrowserGameRuntimeCheckpoint(checkpoint);
  }

  async restore(value: unknown): Promise<BrowserGameRuntimeRestoreResult> {
    if (this.disposed) throw new Error('The game session is closed.');
    if (this.worker || this.pending.size > 0 || this.journalEntries.length > 0 || this.restoring) {
      throw new Error('Browser game runtime restore requires a fresh runtime.');
    }
    const checkpoint = parseBrowserGameRuntimeCheckpoint(value);
    this.restoring = true;
    let current: GameObservation | null = null;
    const restoredEntries: BrowserGameRuntimeJournalEntryV1[] = [];
    try {
      for (const entry of checkpoint.entries) {
        current = await this.request(entry.request, false);
        const identity = browserGameRuntimeObservationIdentity(current);
        if (identity !== entry.observationIdentity) {
          throw new Error(`browser game runtime replay diverged at journal sequence ${entry.sequence}`);
        }
        restoredEntries.push({
          sequence: entry.sequence,
          request: structuredClone(entry.request),
          observationIdentity: identity,
        });
      }

      let replayedPending = false;
      if (checkpoint.pending) {
        current = await this.request(checkpoint.pending.request, false);
        restoredEntries.push({
          sequence: checkpoint.pending.sequence,
          request: structuredClone(checkpoint.pending.request),
          observationIdentity: browserGameRuntimeObservationIdentity(current),
        });
        replayedPending = true;
      }
      if (!current) throw new Error('browser game runtime replay produced no observation');
      if (current.gameCode !== checkpoint.gameCode) {
        throw new Error('browser game runtime replay changed the game code');
      }

      this.journalValid = true;
      this.journalGameCode = checkpoint.gameCode;
      this.journalEntries = restoredEntries;
      return {
        observation: current,
        replayedEntries: checkpoint.entries.length,
        replayedPending,
      };
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
      this.invalidateJournal();
      throw error;
    } finally {
      this.restoring = false;
    }
  }

  load(code: string, level?: number): Promise<GameObservation> {
    return this.request({ type: 'load', code, ...(level === undefined ? {} : { level }) });
  }
  action(actionId: number, data?: { x: number; y: number }): Promise<GameObservation> {
    return this.request(buildActionRequest(actionId, data));
  }
  undo(): Promise<GameObservation> { return this.request({ type: 'undo' }); }
  reset(): Promise<GameObservation> { return this.request({ type: 'reset' }); }
  restart(): Promise<GameObservation> { return this.request({ type: 'restart' }); }
  selectLevel(level: number): Promise<GameObservation> { return this.request({ type: 'selectLevel', level }); }
  dispose(): void { this.disposed = true; this.fail(new Error('The game session was closed.')); }
}