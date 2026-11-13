import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import type { AgentObservation } from '../src/runtime/contracts.ts';
import {
  CommonCampaignOwner,
  type CampaignLogosActionPayload,
} from '../src/logos-engine/v6-common-campaign-owner.ts';
import {
  PublicSingleActionCallerOwnerAdapter,
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
} from '../src/logos-engine/v6-public-single-action-caller-adapter.ts';
import {
  type CommonCallerAcquisition,
  type CommonCallerOwner,
  type CommonCallerProposal,
} from '../src/logos-engine/v6-neutral-common-caller.ts';
import {
  BrowserCommonCampaignHost,
  createPublicSingleActionBrowserCampaignHost,
  type BrowserCampaignOwnerTransport,
} from '../src/runtime/v6-browser-common-campaign-host.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';

function observation(
  availableActionIds: number[] = [1],
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    gameCode: 'TEST',
    frame: Array.from({ length: 64 }, () => Array(64).fill(3)),
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds,
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 3,
    levelsCompleted: 0,
    defaultFps: 5,
    ...overrides,
  };
}

function productState(
  current: GameObservation,
  overrides: Partial<ProductReadinessState> = {},
): ProductReadinessState {
  return {
    observation: current,
    selectedGameCode: current.gameCode,
    busy: false,
    loading: false,
    failed: false,
    ...overrides,
  };
}

function publicHostWithCampaign(): {
  campaign: CommonCampaignOwner;
  host: BrowserCommonCampaignHost;
} {
  const owner = new PublicSingleActionCallerOwnerAdapter();
  const campaign = new CommonCampaignOwner([owner]);
  const transport: BrowserCampaignOwnerTransport = {
    ownerId: PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
    context: input => ({ observation: input.agentObservation }),
    returnPayload: input => ({ observation: input.afterAgentObservation }),
  };
  return {
    campaign,
    host: new BrowserCommonCampaignHost({ campaign, ownerTransports: [transport] }),
  };
}

class AddressedOwner implements CommonCallerOwner {
  readonly id = 'addressed-owner';
  readonly acquired: CommonCallerAcquisition[] = [];

  propose(value: unknown): CommonCallerProposal | undefined {
    if (!value || typeof value !== 'object' || !('observation' in value)) return undefined;
    const current = (value as { observation: AgentObservation }).observation;
    const action = { id: 6 as const, data: { x: 0, y: 9 } };
    const observationRef = `observation:${current.sessionId}:${current.sequence}`;
    const compositionRef = `composition:${current.sessionId}:${current.sequence}`;
    const objectiveRef = `objective:${current.sessionId}`;
    const bundleId = `bundle:${current.sessionId}:${current.sequence}`;
    const payload: CampaignLogosActionPayload = {
      action,
      bundle: {
        id: bundleId,
        operation_key: 'OP28',
        composition_ref: compositionRef,
        objective_ref: objectiveRef,
        preserve_refs: [observationRef],
        observation_revision: current.sequence,
        kind: 'realize',
        actions: [action],
        purpose: 'exercise addressed product transport',
        preconditions: { addressed_action_available: true },
        evidence: [observationRef],
        preservation_evidence: {
          [observationRef]: 'public-observation-contract-v1',
        },
        outcome_guard: { path: ['value'], contains: bundleId },
      },
      state: {
        compositions: [
          { id: observationRef, observed: true },
          { id: compositionRef, observed: true },
          { id: objectiveRef, observed: true },
        ],
        facts: { addressed_action_available: true },
        bundles: [{
          id: bundleId,
          composition_ref: compositionRef,
          admitted: true,
          actions: [action],
          evidence: observationRef,
        }],
      },
      identity: {
        episodeId: current.sessionId,
        levelEpoch: `${current.sessionId}:level:${current.level}`,
        observationId: observationRef,
        observationRevision: current.sequence,
      },
    };
    return {
      ownerId: this.id,
      proposalRef: compositionRef,
      actionRef: 'ACTION6',
      payload,
    };
  }

  acquire(event: CommonCallerAcquisition): unknown {
    this.acquired.push(structuredClone(event));
    return { acquired: true, eventRef: event.eventRef };
  }
}

class StaticOwner implements CommonCallerOwner {
  readonly acquired: CommonCallerAcquisition[] = [];

  constructor(
    readonly id: string,
    readonly proposal: CommonCallerProposal | undefined,
  ) {}

  propose(): CommonCallerProposal | undefined {
    return this.proposal ? structuredClone(this.proposal) : undefined;
  }

  acquire(event: CommonCallerAcquisition): unknown {
    this.acquired.push(structuredClone(event));
    return { ownerId: this.id, eventRef: event.eventRef };
  }
}

test('host preserves one needId from Logos release through return acquisition before presentation', async () => {
  const host = createPublicSingleActionBrowserCampaignHost();
  const initial = observation([1]);
  const returned = observation([2], {
    frame: Array.from({ length: 64 }, (_, y) =>
      Array.from({ length: 64 }, (_, x) => x === 0 && y === 0 ? 8 : 3),
    ),
  });
  const events: string[] = [];
  let resolveAction!: (value: GameObservation) => void;
  const actionReturn = new Promise<GameObservation>(resolve => { resolveAction = resolve; });

  const firstAgent = host.begin({ sessionId: 'browser-session', observation: initial });
  assert.equal(firstAgent.sequence, 0);

  const firstRun = host.run(productState(initial), {
    action: async (action, data) => {
      events.push(`action:${action}:${JSON.stringify(data)}`);
      return actionReturn;
    },
    present: async next => { events.push(`present:${next.availableActionIds.join(',')}`); },
    now: (() => { let value = 10; return () => value++; })(),
    generation: () => 4,
    setBusy: value => events.push(`busy:${value}`),
    onCampaignAcquired: receipt => events.push(`acquired:${receipt.needId}`),
  });

  await Promise.resolve();
  const pendingRun = await host.run(productState(initial), {
    action: async () => { throw new Error('pending campaign must not dispatch twice'); },
    present: async () => {},
    now: () => 0,
    generation: () => 4,
    setBusy: () => {},
  });
  assert.equal(pendingRun.status, 'pending');
  assert.equal(pendingRun.dispatch, null);

  resolveAction(returned);
  const firstResult = await firstRun;
  assert.equal(firstResult.status, 'action');
  assert.equal(firstResult.preparation?.status, 'action');
  if (firstResult.preparation?.status !== 'action') return;
  assert.equal(firstResult.acquisition?.needId, firstResult.preparation.needId);
  assert.equal(firstResult.returnedObservation?.sequence, 1);
  assert.equal(host.currentAgentObservation?.sequence, 1);
  assert.equal(host.currentGameObservation, returned);
  assert.deepEqual(events, [
    'busy:true',
    'action:1:undefined',
    `acquired:${firstResult.preparation.needId}`,
    'present:2',
    'busy:false',
  ]);

  const third = observation([3]);
  const secondResult = await host.run(productState(returned), {
    action: async action => {
      events.push(`next-action:${action}`);
      return third;
    },
    present: async () => { events.push('next-present'); },
    now: (() => { let value = 30; return () => value++; })(),
    generation: () => 4,
    setBusy: () => {},
  });
  assert.equal(secondResult.status, 'action');
  assert.equal(secondResult.preparation?.status, 'action');
  if (secondResult.preparation?.status === 'action') {
    assert.equal(secondResult.preparation.action.id, 2);
  }
  assert.deepEqual(events.slice(-2), ['next-action:2', 'next-present']);
});

test('addressed campaign action preserves zero-valued coordinates through product dispatch', async () => {
  const owner = new AddressedOwner();
  const campaign = new CommonCampaignOwner([owner]);
  const host = new BrowserCommonCampaignHost({
    campaign,
    ownerTransports: [{
      ownerId: owner.id,
      context: input => ({ observation: input.agentObservation }),
      returnPayload: input => ({ observation: input.afterAgentObservation }),
    }],
  });
  const initial = observation([6]);
  const returned = observation([1]);
  host.begin({ sessionId: 'addressed-session', observation: initial });
  const calls: Array<{ action: number; data: unknown }> = [];

  const result = await host.run(productState(initial), {
    action: async (action, data) => {
      calls.push({ action, data });
      return returned;
    },
    present: async () => {},
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 1,
    setBusy: () => {},
  });

  assert.equal(result.status, 'action');
  assert.deepEqual(calls, [{ action: 6, data: { x: 0, y: 9 } }]);
  assert.equal(owner.acquired.length, 1);
});

test('host refuses non-ready or stale product observations before creating a Logos need', async () => {
  const { campaign, host } = publicHostWithCampaign();
  const initial = observation([1]);
  host.begin({ sessionId: 'ready-session', observation: initial });

  const ports = {
    action: async () => { throw new Error('must not dispatch'); },
    present: async () => {},
    now: () => 0,
    generation: () => 0,
    setBusy: () => {},
  };

  const notReady = await host.run(productState(initial, { busy: true }), ports);
  assert.deepEqual(notReady, {
    status: 'not-ready',
    reason: 'product-not-ready',
    preparation: null,
    dispatch: null,
    acquisition: null,
    returnedObservation: null,
  });
  assert.equal(campaign.pending('ready-session'), undefined);

  const structurallyEqualButStale = observation([1]);
  const stale = await host.run(productState(structurallyEqualButStale), ports);
  assert.equal(stale.status, 'not-ready');
  assert.equal(stale.reason, 'stale-product-observation');
  assert.equal(campaign.pending('ready-session'), undefined);
});

test('multiple symbolic owners remain ambiguous and never reach product dispatch', async () => {
  const first = new StaticOwner('first', {
    ownerId: 'first',
    proposalRef: 'first:proposal',
    actionRef: 'ACTION1',
    payload: {},
  });
  const second = new StaticOwner('second', {
    ownerId: 'second',
    proposalRef: 'second:proposal',
    actionRef: 'ACTION1',
    payload: {},
  });
  const campaign = new CommonCampaignOwner([first, second]);
  const host = new BrowserCommonCampaignHost({
    campaign,
    ownerTransports: [first, second].map(owner => ({
      ownerId: owner.id,
      context: () => ({}),
      returnPayload: () => ({}),
    })),
  });
  const initial = observation([1]);
  host.begin({ sessionId: 'ambiguous-session', observation: initial });

  let dispatches = 0;
  const result = await host.run(productState(initial), {
    action: async () => { dispatches += 1; return observation([2]); },
    present: async () => {},
    now: () => 0,
    generation: () => 0,
    setBusy: () => {},
  });

  assert.equal(result.status, 'ambiguous');
  assert.equal(dispatches, 0);
  assert.equal(first.acquired.length, 0);
  assert.equal(second.acquired.length, 0);
});

test('stale product generation cancels the unresolved campaign need without acquiring return', async () => {
  const { campaign, host } = publicHostWithCampaign();
  const initial = observation([1]);
  const returned = observation([2]);
  host.begin({ sessionId: 'stale-session', observation: initial });
  let generation = 7;
  const events: string[] = [];

  const result = await host.run(productState(initial), {
    action: async () => {
      events.push('action');
      generation = 8;
      return returned;
    },
    present: async () => { events.push('present'); },
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => generation,
    setBusy: value => events.push(`busy:${value}`),
    onCampaignAcquired: () => events.push('acquired'),
  });

  assert.equal(result.status, 'action');
  assert.equal(result.dispatch?.stale, true);
  assert.equal(result.acquisition, null);
  assert.equal(campaign.pending('stale-session'), undefined);
  assert.equal(host.currentGameObservation, initial);
  assert.deepEqual(events, ['busy:true', 'action']);
});

test('transport failure cancels the pending campaign decision and preserves dispatch error handling', async () => {
  const { campaign, host } = publicHostWithCampaign();
  const initial = observation([4]);
  host.begin({ sessionId: 'error-session', observation: initial });
  const events: string[] = [];

  await assert.rejects(
    host.run(productState(initial), {
      action: async () => { throw new Error('synthetic transport failure'); },
      present: async () => { events.push('present'); },
      now: () => 0,
      generation: () => 2,
      setBusy: value => events.push(`busy:${value}`),
      onError: error => events.push(`error:${(error as Error).message}`),
    }),
    /synthetic transport failure/,
  );

  assert.equal(campaign.pending('error-session'), undefined);
  assert.deepEqual(events, [
    'busy:true',
    'busy:false',
    'error:synthetic transport failure',
  ]);
});

test('beginning a replacement session makes an in-flight older dispatch stale even without an external generation change', async () => {
  const { campaign, host } = publicHostWithCampaign();
  const first = observation([1]);
  const second = observation([2]);
  const firstReturn = observation([3]);
  host.begin({ sessionId: 'session-one', observation: first });
  let resolveAction!: (value: GameObservation) => void;
  const pendingAction = new Promise<GameObservation>(resolve => { resolveAction = resolve; });

  const oldRun = host.run(productState(first), {
    action: async () => pendingAction,
    present: async () => { throw new Error('old session must never present'); },
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 9,
    setBusy: () => {},
  });

  await Promise.resolve();
  host.begin({ sessionId: 'session-two', observation: second });
  resolveAction(firstReturn);
  const oldResult = await oldRun;

  assert.equal(oldResult.dispatch?.stale, true);
  assert.equal(oldResult.acquisition, null);
  assert.equal(campaign.pending('session-one'), undefined);
  assert.equal(host.sessionId, 'session-two');
  assert.equal(host.currentGameObservation, second);
  assert.equal(host.currentAgentObservation?.sequence, 0);
});

test('host validates exact owner transport coverage', () => {
  const owner = new StaticOwner('owner', undefined);
  const campaign = new CommonCampaignOwner([owner]);
  assert.throws(
    () => new BrowserCommonCampaignHost({ campaign, ownerTransports: [] }),
    /has no browser transport/,
  );
  assert.throws(
    () => new BrowserCommonCampaignHost({
      campaign,
      ownerTransports: [{
        ownerId: 'other',
        context: () => ({}),
        returnPayload: () => ({}),
      }],
    }),
    /has no registered owner/,
  );
});
