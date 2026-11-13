import { V6AgentError } from './v6-agent-protocol.ts';
import type { V6AgentOperation, V6AgentResult, V6AgentTransport, V6WorkerResponse } from './v6-agent-protocol.ts';

interface Pending {
  operation: V6AgentOperation;
  resolve: (result: V6AgentResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** A separate solver worker. Pause preserves it; invalidation terminates it. */
export class BrowserV6WorkerClient implements V6AgentTransport {
  private readonly factory: () => Worker;
  private readonly timeoutMs: number;
  private worker: Worker | null = null;
  private nextId = 0;
  private pending = new Map<number, Pending>();
  private disposed = false;

  constructor(factory: () => Worker = () => new Worker(new URL('./v6-agent-worker.ts', import.meta.url), { type: 'module', name: 'logos-engine-v6' }), timeoutMs = 420_000) {
    this.factory = factory; this.timeoutMs = timeoutMs;
  }

  private getWorker(): Worker {
    if (this.disposed) throw new V6AgentError('cancelled', 'The V6 solver is closed.');
    if (this.worker) return this.worker;
    const worker = this.factory();
    worker.addEventListener('message', (event: MessageEvent<V6WorkerResponse>) => {
      if (this.worker !== worker) return;
      const response = event.data;
      if (!response || typeof response !== 'object') return;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id); clearTimeout(pending.timer);
      if (response.sessionId !== pending.operation.sessionId || response.sequence !== pending.operation.sequence) {
        pending.reject(new V6AgentError('stale', 'A V6 response belongs to another session or observation.'));
      } else if ('error' in response) {
        pending.reject(new V6AgentError(response.error.code, response.error.message, response.snapshot));
      } else if (response.result?.ok === true && response.result.sessionId === pending.operation.sessionId) pending.resolve(response.result);
      else pending.reject(new V6AgentError('invalid', 'The V6 solver returned an invalid response.'));
    });
    worker.addEventListener('error', () => { if (this.worker === worker) this.fail(new V6AgentError('internal', 'The V6 solver worker stopped. Start a new session to retry.')); });
    worker.addEventListener('messageerror', () => { if (this.worker === worker) this.fail(new V6AgentError('internal', 'The V6 solver response could not be read.')); });
    this.worker = worker;
    return worker;
  }

  request(operation: V6AgentOperation): Promise<V6AgentResult> {
    return new Promise((resolve, reject) => {
      if (this.pending.size) { reject(new V6AgentError('invalid', 'The V6 solver already has a pending operation.')); return; }
      const worker = this.getWorker();
      const id = ++this.nextId;
      const timer = setTimeout(() => this.fail(new V6AgentError('timeout', 'The V6 solver exceeded its response deadline. Start a new session to retry.')), this.timeoutMs);
      this.pending.set(id, { operation, resolve, reject, timer });
      try { worker.postMessage({ id, operation }); }
      catch (error) {
        this.pending.delete(id); clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private fail(error: Error): void {
    this.worker?.terminate(); this.worker = null;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }
  reset(reason: string): void { this.fail(new V6AgentError('cancelled', reason)); }
  dispose(): void { this.disposed = true; this.reset('The V6 solver was closed.'); }
}
