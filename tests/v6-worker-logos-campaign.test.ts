import assert from 'node:assert/strict';
import test from 'node:test';
import { PROTOCOL_VERSION, type AgentAction, type AgentObservation } from '../src/runtime/contracts.ts';
import { AgentWorkerCore } from '../src/runtime/v6-agent-worker-core.ts';
import type { CompositionBundle } from '../src/logos-engine/v6-composition-engine.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import { runLiveGameCampaign, type LiveCampaignGamePort } from './helpers/v6-live-game-campaign.ts';
import { LogosDecisionPort, type PreparedLogosDecision } from './helpers/v6-logos-decision-port.ts';

function observation(
  sequence: number,
  state: 'NOT_FINISHED' | 'WIN' = 'NOT_FINISHED',
  sessionId = 'logos-campaign',
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sequence,
    image: { width: 64, height: 64, pixelFormat: 'palette-index-u8', pixels: new Uint8Array(64 * 64) },
    availableActionIds: [1, 2, 6],
    state,
    level: 1,
    levelsCompleted: state === 'WIN' ? 1 : 0,
  };
}

class OneStepGame implements LiveCampaignGamePort {
  sequence = 0;
  readonly actions: AgentAction[] = [];

  initialObservation(): AgentObservation {
    return observation(this.sequence);
  }

  action(action: AgentAction): AgentObservation {
    this.actions.push(structuredClone(action));
    this.sequence += 1;
    return observation(this.sequence, 'WIN');
  }
}

function op18Decision(obs: AgentObservation): PreparedLogosDecision {
  const action: AgentAction = { id: 1 };
  const bundle: CompositionBundle = {
    id: 'probe',
    operation_key: 'OP18',
    composition_ref: 'B',
    objective_ref: 'G',
    preserve_refs: ['A'],
    observation_revision: obs.sequence,
    kind: 'probe',
    actions: [action],
    purpose: 'measure an already-identified open question',
    preconditions: { free: true },
    evidence: [`observation:${obs.sequence}`],
    preservation_evidence: { A: 'proof' },
    outcome_guard: { path: ['value'], contains: 'B' },
  };
  return {
    bundle,
    state: {
      compositions: [
        { id: 'A', observed: true },
        { id: 'B', observed: false, open_question: 'known symbolic question' },
        { id: 'G', observed: true },
      ],
      facts: { free: true },
    },
    action,
  };
}

function op28Decision(obs: AgentObservation): PreparedLogosDecision {
  const action: AgentAction = { id: 2 };
  const bundle: CompositionBundle = {
    id: 'bundle',
    operation_key: 'OP28',
    composition_ref: 'B',
    objective_ref: 'G',
    preserve_refs: ['A'],
    observation_revision: obs.sequence,
    kind: 'realize',
    actions: [action],
    purpose: 'realize an already-selected admitted bundle',
    preconditions: { free: true },
    evidence: [`observation:${obs.sequence}`],
    preservation_evidence: { A: 'proof' },
    outcome_guard: { path: ['value'], contains: 'bundle' },
  };
  return {
    bundle,
    state: {
      compositions: [{ id: 'A' }, { id: 'B' }, { id: 'G' }],
      facts: { free: true },
      bundles: [{ id: 'bundle', composition_ref: 'B', admitted: true, actions: [action] }],
    },
    action,
  };
}

const options = { sessionId: 'logos-campaign', seed: 11, budgetMs: 50, maxSteps: 4 };

test('campaign carries an externally produced OP18 decision through worker and Logos authority', async () => {
  const trace = new OperationTraceSink();
  const game = new OneStepGame();
  const port = new LogosDecisionPort(op18Decision, { trace });
  const result = await runLiveGameCampaign(
    game,
    new AgentWorkerCore(port, { implementationRevision: 'logos-campaign-proof' }),
    options,
  );

  assert.equal(result.status, 'complete');
  assert.deepEqual(game.actions, [{ id: 1 }]);
  const events = trace.snapshot().events;
  assert.deepEqual(events.map(event => event.kind), ['need', 'operation', 'consumption']);
  assert.equal(new Set(events.map(event => event.needId)).size, 1);
});

test('campaign carries an externally produced OP28 decision through worker and Logos authority', async () => {
  const trace = new OperationTraceSink();
  const game = new OneStepGame();
  const port = new LogosDecisionPort(op28Decision, { trace });
  const result = await runLiveGameCampaign(
    game,
    new AgentWorkerCore(port, { implementationRevision: 'logos-campaign-proof' }),
    options,
  );

  assert.equal(result.status, 'complete');
  assert.deepEqual(game.actions, [{ id: 2 }]);
  assert.equal(trace.snapshot().events.some(
    event => event.kind === 'consumption' && event.op === 'OP28' && event.effectKind === 'guard',
  ), true);
});

test('campaign stops without action when no symbolic producer supplies a decision', async () => {
  const game = new OneStepGame();
  const port = new LogosDecisionPort(() => undefined);
  const result = await runLiveGameCampaign(
    game,
    new AgentWorkerCore(port, { implementationRevision: 'logos-campaign-proof' }),
    options,
  );
  assert.equal(result.status, 'stopped');
  assert.equal(result.reason, 'budget');
  assert.deepEqual(game.actions, []);
});

test('OP14 remains unreachable through native authority even when supplied by the test producer', async () => {
  const trace = new OperationTraceSink();
  const game = new OneStepGame();
  const port = new LogosDecisionPort(obs => {
    const prepared = op18Decision(obs);
    prepared.bundle.operation_key = 'OP14';
    prepared.bundle.kind = 'realize';
    return prepared;
  }, { trace });
  const result = await runLiveGameCampaign(
    game,
    new AgentWorkerCore(port, { implementationRevision: 'logos-campaign-proof' }),
    options,
  );
  assert.equal(result.status, 'stopped');
  assert.equal(result.reason, 'budget');
  assert.deepEqual(game.actions, []);
  assert.equal(trace.snapshot().events.some(
    event => event.kind === 'operation' && event.op === 'OP14' && event.mode === 'not_required',
  ), true);
});

test('test bridge rejects an action not bound to the supplied bundle', async () => {
  const game = new OneStepGame();
  const port = new LogosDecisionPort(obs => {
    const prepared = op18Decision(obs);
    prepared.action = { id: 2 };
    return prepared;
  });
  const result = await runLiveGameCampaign(
    game,
    new AgentWorkerCore(port, { implementationRevision: 'logos-campaign-proof' }),
    options,
  );
  assert.equal(result.status, 'error');
  assert.match(result.reason ?? '', /not contained/);
  assert.deepEqual(game.actions, []);
});
