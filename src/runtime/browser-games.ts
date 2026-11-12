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

interface Pending {
  resolve: (observation: GameObservation) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface BrowserGameRuntimeOptions {
  workerFactory?: () => Worker;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timeout: ReturnType<typeof setTimeout>) => void;
  requestTimeoutMs?: number;
}

export class BrowserGameRuntime {
  private worker: Worker | null = null;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private disposed = false;
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
      if (message.error) pending.reject(new Error(message.error));
      else if (message.result) pending.resolve({ ...message.result, gameCode: message.result.code ?? message.result.gameCode });
      else pending.reject(new Error('The game returned an invalid response.'));
    });
    worker.addEventListener('error', () => this.fail(new Error('The local game runtime stopped. Please load the game again.')));
    worker.addEventListener('messageerror', () => this.fail(new Error('The game response could not be read. Please load the game again.')));
    this.worker = worker;
    return worker;
  }

  private fail(error: Error): void {
    this.worker?.terminate();
    this.worker = null;
    for (const pending of this.pending.values()) {
      this.clearTimer(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private request(request: GameRuntimeRequest): Promise<GameObservation> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      const id = ++this.nextId;
      const timeout = this.setTimer(
        () => this.fail(new Error('Loading took too long. Please try the game again.')),
        this.requestTimeoutMs,
      );
      this.pending.set(id, { resolve, reject, timeout });
      worker.postMessage({ id, request });
    });
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
