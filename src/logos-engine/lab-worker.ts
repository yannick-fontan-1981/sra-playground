import type { CycleReceipt, V7Runtime } from './v7-runtime.ts';
import { createV7Runtime } from './create-runtime.ts';
import type { LabRequest, LabResponse, LabSnapshot } from './lab-protocol.ts';

let runtime: V7Runtime | null = null;
let controller: AbortController | null = null;
let busy = false;

function reply(message: LabResponse): void { self.postMessage(message); }

function snapshot(receipt: CycleReceipt | null = null): LabSnapshot {
  if (!runtime) throw new Error('Initialize the engine before running an observation.');
  // The worker boundary serializes immutable engine values to presentation data.
  return {
    sequence: runtime.sequence,
    memory: { ...runtime.memory, nodes: Object.values(runtime.memory.nodes) },
    trace: runtime.lastTrace,
    receipt,
  };
}

self.onmessage = (message: MessageEvent<LabRequest>): void => {
  const request = message.data;
  if (request.type === 'cancel') {
    controller?.abort();
    return;
  }
  if (busy) {
    reply({ id: request.id, type: 'error', message: 'The engine is already running.', cancelled: false });
    return;
  }
  busy = true;
  const operationController = new AbortController();
  controller = operationController;
  void (async () => {
    try {
      if (request.type === 'initialize') {
        const { bundle } = request;
        const nextRuntime = await createV7Runtime(bundle);
        if (operationController.signal.aborted) throw new DOMException('Initialization cancelled.', 'AbortError');
        runtime = nextRuntime;
        reply({ id: request.id, type: 'result', snapshot: snapshot() });
        return;
      }
      if (!runtime) throw new Error('The engine has not been initialized.');
      const receipt = await runtime.advance(request.event, {
        maxInstructions: 8192,
        yieldEvery: 64,
        deadlineMs: 5000,
        signal: operationController.signal,
      });
      reply({ id: request.id, type: 'result', snapshot: snapshot(receipt) });
    } catch (error) {
      reply({
        id: request.id,
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
        cancelled: operationController.signal.aborted,
      });
    } finally {
      controller = null;
      busy = false;
    }
  })();
};
