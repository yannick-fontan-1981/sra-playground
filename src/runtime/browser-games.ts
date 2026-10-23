/** Browser-only bridge. Game state and history stay inside a dedicated worker. */
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

type Request = { type: 'load'; code: string }
  | { type: 'action'; actionId: number; data?: { x: number; y: number } }
  | { type: 'undo' | 'reset' }
  | { type: 'selectLevel'; level: number };

interface Pending {
  resolve: (observation: GameObservation) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class BrowserGameRuntime {
  private worker: Worker | null = null;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private disposed = false;

  private getWorker(): Worker {
    if (this.disposed) throw new Error('The game session is closed.');
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./game-worker.ts', import.meta.url), { type: 'module', name: 'sra-games' });
    worker.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as { id: number; result?: GameObservation & { code?: string }; error?: string };
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
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
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private request(request: Request): Promise<GameObservation> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      const id = ++this.nextId;
      const timeout = setTimeout(() => this.fail(new Error('Loading took too long. Please try the game again.')), 120000);
      this.pending.set(id, { resolve, reject, timeout });
      worker.postMessage({ id, request });
    });
  }

  load(code: string): Promise<GameObservation> { return this.request({ type: 'load', code }); }
  action(actionId: number, data?: { x: number; y: number }): Promise<GameObservation> {
    return this.request({ type: 'action', actionId, ...(data ? { data } : {}) });
  }
  undo(): Promise<GameObservation> { return this.request({ type: 'undo' }); }
  reset(): Promise<GameObservation> { return this.request({ type: 'reset' }); }
  selectLevel(level: number): Promise<GameObservation> { return this.request({ type: 'selectLevel', level }); }
  dispose(): void { this.disposed = true; this.fail(new Error('The game session was closed.')); }
}
