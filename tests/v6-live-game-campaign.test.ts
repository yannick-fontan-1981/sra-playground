import assert from 'node:assert/strict';
import test from 'node:test';
import { PROTOCOL_VERSION, type AgentAction, type AgentObservation } from '../src/runtime/contracts.ts';
import { AgentWorkerCore, type AgentDecisionPort } from '../src/runtime/v6-agent-worker-core.ts';
import { runLiveGameCampaign, type LiveCampaignGamePort } from './helpers/v6-live-game-campaign.ts';

function observation(sequence: number, state: 'NOT_FINISHED' | 'WIN' = 'NOT_FINISHED', sessionId = 'campaign-1'): AgentObservation {
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

class SequencePort implements AgentDecisionPort {
  index = 0;
  constructor(readonly actions: Array<AgentAction | undefined>) {}
  decide(): AgentAction | undefined {
    const action = this.actions[this.index];
    this.index += 1;
    return action;
  }
}

class Game implements LiveCampaignGamePort {
  sequence = 0;
  actions: AgentAction[] = [];
  constructor(readonly winAfter = Number.POSITIVE_INFINITY, readonly sessionId = 'campaign-1') {}
  initialObservation() { return observation(this.sequence, 'NOT_FINISHED', this.sessionId); }
  action(action: AgentAction) {
    this.actions.push(structuredClone(action));
    this.sequence += 1;
    return observation(this.sequence, this.actions.length >= this.winAfter ? 'WIN' : 'NOT_FINISHED', this.sessionId);
  }
}

function core(port: AgentDecisionPort) {
  return new AgentWorkerCore(port, { implementationRevision: 'campaign-test' });
}

const options = { sessionId: 'campaign-1', seed: 7, budgetMs: 50, maxSteps: 10 };

test('campaign executes actions until worker observes WIN and stops complete', async () => {
  const game = new Game(2);
  const result = await runLiveGameCampaign(game, core(new SequencePort([{ id: 1 }, { id: 2 }])), options);
  assert.equal(result.status, 'complete');
  assert.equal(result.reason, 'complete');
  assert.equal(result.actionsExecuted, 2);
  assert.equal(result.finalObservation.state, 'WIN');
  assert.equal(result.steps.length, 3);
  assert.deepEqual(game.actions, [{ id: 1 }, { id: 2 }]);
});

test('campaign preserves ACTION6 coordinates exactly', async () => {
  const game = new Game(1);
  const action: AgentAction = { id: 6, data: { x: 21, y: 20 } };
  const result = await runLiveGameCampaign(game, core(new SequencePort([action])), options);
  assert.equal(result.status, 'complete');
  assert.deepEqual(game.actions, [action]);
});

test('no decision within budget stops campaign without executing game action', async () => {
  const game = new Game();
  const result = await runLiveGameCampaign(game, core(new SequencePort([undefined])), options);
  assert.equal(result.status, 'stopped');
  assert.equal(result.reason, 'budget');
  assert.equal(result.actionsExecuted, 0);
  assert.deepEqual(game.actions, []);
});

test('maxSteps is a hard campaign bound', async () => {
  const game = new Game();
  const result = await runLiveGameCampaign(
    game,
    core(new SequencePort([{ id: 1 }, { id: 1 }])),
    { ...options, maxSteps: 1 },
  );
  assert.equal(result.status, 'max_steps');
  assert.equal(result.actionsExecuted, 1);
  assert.equal(game.actions.length, 1);
});

test('campaign rejects observation from another session', async () => {
  const game = new Game(1, 'wrong-session');
  await assert.rejects(
    runLiveGameCampaign(game, core(new SequencePort([{ id: 1 }])), options),
    /session does not match/,
  );
});

test('campaign rejects a game return whose sequence does not advance', async () => {
  const game: LiveCampaignGamePort = {
    initialObservation: () => observation(0),
    action: () => observation(0),
  };
  await assert.rejects(
    runLiveGameCampaign(game, core(new SequencePort([{ id: 1 }])), options),
    /sequence did not advance/,
  );
});

test('worker action error is retained as campaign error without dispatch', async () => {
  const game: LiveCampaignGamePort & { actions: AgentAction[] } = {
    actions: [],
    initialObservation: () => ({ ...observation(0), availableActionIds: [1] }),
    action(action) { this.actions.push(action); return observation(1); },
  };
  const result = await runLiveGameCampaign(game, core(new SequencePort([{ id: 2 }])), options);
  assert.equal(result.status, 'error');
  assert.match(result.reason ?? '', /unavailable/);
  assert.deepEqual(game.actions, []);
});
