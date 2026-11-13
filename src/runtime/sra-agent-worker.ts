import { createV7Runtime } from '../logos-engine/create-runtime.ts';
import { loadV7Bundle } from '../logos-engine/bundle.ts';
import { SraAgentService } from './sra-agent-service.ts';
import { SraAgentError } from './sra-agent-protocol.ts';
import type { SraAgentErrorCode, SraWorkerRequest, SraWorkerResponse } from './sra-agent-protocol.ts';

let bundle: ReturnType<typeof loadV7Bundle> | null = null;
const service = new SraAgentService(async () => {
  bundle ??= loadV7Bundle().catch(error => { bundle = null; throw error; });
  return createV7Runtime(await bundle);
});
let active: { sessionId: string; controller: AbortController } | null = null;

function send(response: SraWorkerResponse): void { self.postMessage(response); }
function errorCode(error: unknown, cancelled: boolean): SraAgentErrorCode {
  if (cancelled || error instanceof Error && error.name === 'AbortError') return 'cancelled';
  if (error instanceof SraAgentError) return error.code;
  const message = error instanceof Error ? error.message : String(error);
  return /budget|deadline|instruction limit/i.test(message) ? 'budget' : 'internal';
}

self.onmessage = (event: MessageEvent<SraWorkerRequest>): void => {
  const request = event.data;
  if (request.type === 'cancel') {
    if (active?.sessionId === request.sessionId) active.controller.abort();
    return;
  }
  const identity = { id: request.id, sessionId: request.sessionId, sequence: request.sequence };
  if (active) {
    send({ ...identity, error: { code: 'invalid', message: 'The reasoning worker is already busy.' } });
    return;
  }
  const operation = { sessionId: request.sessionId, controller: new AbortController() };
  active = operation;
  void service.handle(request, operation.controller.signal).then(
    result => send({ ...identity, result }),
    error => send({ ...identity, error: { code: errorCode(error, operation.controller.signal.aborted), message: error instanceof Error ? error.message : String(error) } }),
  ).finally(() => { if (active === operation) active = null; });
};
