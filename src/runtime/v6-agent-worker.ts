/** Native TypeScript solver worker. Native games remain in their separate worker. */
import { createNativeV6Runtime } from '../logos-engine/v6-native-runtime.ts';
import { V6AgentService } from './v6-agent-service.ts';
import { defaultRecoveryPack } from '../sic/active-recovery.ts';
import { defaultBrowserFamilyAgenda } from '../sic/family-agenda.ts';
import { V6AgentError } from './v6-agent-protocol.ts';
import type { V6WorkerRequest, V6WorkerResponse } from './v6-agent-protocol.ts';

const scope = self as unknown as {
  addEventListener(type: 'message', callback: (event: MessageEvent<V6WorkerRequest>) => void): void;
  postMessage(message: V6WorkerResponse): void;
};
const service = new V6AgentService((recovery = defaultRecoveryPack) => createNativeV6Runtime(undefined, {
  recovery: { ...recovery, familyAgenda: recovery.familyAgenda ?? defaultBrowserFamilyAgenda },
}));
let active = false;
scope.addEventListener('message', event => {
  const { id, operation } = event.data;
  const identity = { id, sessionId: operation.sessionId, sequence: operation.sequence };
  if (active) { scope.postMessage({ ...identity, error: { code: 'invalid', message: 'The native V6 solver is already processing an operation.' } }); return; }
  active = true;
  void service.handle(operation).then(
    result => scope.postMessage({ ...identity, result }),
    error => scope.postMessage({ ...identity, error: {
      code: error instanceof V6AgentError ? error.code : 'internal', message: error instanceof Error ? error.message : String(error),
    }, ...(error instanceof V6AgentError && error.snapshot ? { snapshot: error.snapshot } : {}) }),
  ).finally(() => { active = false; });
});
