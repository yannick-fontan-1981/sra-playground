import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import {
  CommonCampaignOwner,
  type CampaignLogosActionPayload,
} from '../src/logos-engine/v6-common-campaign-owner.ts';
import {
  PublicSingleActionCallerOwnerAdapter,
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
} from '../src/logos-engine/v6-public-single-action-caller-adapter.ts';
import {
  preparePublicSingleActionDecision,
} from '../src/logos-engine/v6-public-single-action-port.ts';
import {
  type CommonCallerAcquisition,
  type CommonCallerOwner,
  type CommonCallerProposal,
} from '../src/logos-engine/v6-neutral-common-caller.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';

function observation(
  sequence = 0,
  availableActionIds: AgentObservation['availableActionIds'] = [1],
  sessionId = 'campaign-session',
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: new Uint8Array(64 * 64),
    },
    availableActionIds,
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
  };
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

function op28Payload(
  current: AgentObservation,
  mutate?: (payload: CampaignLogosActionPayload) => void,
): CampaignLogosActionPayload {
  const prepared = preparePublicSingleActionDecision(current);
  assert.ok(prepared);
  const payload: CampaignLogosActionPayload = {
    action: prepared.action,
    bundle: prepared.bundle,
    state: prepared.state,
    identity: prepared.identity,
  };
  mutate?.(payload);
  return payload;
}

test('zero proposals produce no decision and no OP trace', () => {
  const trace = new OperationTraceSink();
  const owner = new CommonCampaignOwner(
    [new PublicSingleActionCallerOwnerAdapter()],
    { trace },
  );
  const current = observation(0, [1, 2]);
  const result = owner.prepare(current, {
    [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: { observation: current },
  });
  assert.deepEqual(result, { status: 'none', proposals: [] });
  assert.deepEqual(trace.snapshot().events, []);
});

test('one OP28 proposal is released, kept pending and routed with the same needId', () => {
  const trace = new OperationTraceSink();
  const owner = new CommonCampaignOwner(
    [new PublicSingleActionCallerOwnerAdapter()],
    { trace },
  );
  const current = observation();
  const prepared = owner.prepare(current, {
    [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: { observation: current },
  });
  assert.equal(prepared.status, 'action');
  if (prepared.status !== 'action') return;
  assert.deepEqual(prepared.action, { id: 1 });
  assert.equal(owner.pending(current.sessionId)?.needId, prepared.needId);

  const events = trace.snapshot().events;
  assert.deepEqual(events.map(event => event.kind), ['need', 'operation', 'consumption']);
  assert.equal(new Set(events.map(event => event.needId)).size, 1);
  assert.equal(events[0]?.needId, prepared.needId);

  const receipt = owner.acquire({
    sessionId: current.sessionId,
    needId: prepared.needId,
    eventRef: 'public-return:1',
    payload: { sequence: 1 },
  });
  assert.equal(receipt.routed, true);
  assert.equal(receipt.needId, prepared.needId);
  assert.equal(receipt.ownerId, PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID);
  assert.equal(owner.pending(current.sessionId), undefined);
  assert.deepEqual(receipt.result, {
    acquired: true,
    needId: prepared.needId,
    eventRef: 'public-return:1',
    proposalRef: prepared.proposalRef,
    returnPayload: { sequence: 1 },
  });
});

test('a pending action prevents a second decision before its return is acquired', () => {
  const owner = new CommonCampaignOwner([new PublicSingleActionCallerOwnerAdapter()]);
  const first = observation(0, [1]);
  const prepared = owner.prepare(first, {
    [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: { observation: first },
  });
  assert.equal(prepared.status, 'action');
  const second = observation(1, [2]);
  const pending = owner.prepare(second, {
    [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: { observation: second },
  });
  assert.equal(pending.status, 'pending');
  if (prepared.status === 'action' && pending.status === 'pending') {
    assert.equal(pending.needId, prepared.needId);
    assert.deepEqual(pending.action, prepared.action);
  }
});

test('multiple owner proposals remain ambiguous and never reach Logos', () => {
  const trace = new OperationTraceSink();
  const first = new StaticOwner('first', {
    ownerId: 'first', proposalRef: 'first:proposal', actionRef: 'ACTION1', payload: {},
  });
  const second = new StaticOwner('second', {
    ownerId: 'second', proposalRef: 'second:proposal', actionRef: 'ACTION1', payload: {},
  });
  const owner = new CommonCampaignOwner([first, second], { trace });
  const result = owner.prepare(observation());
  assert.equal(result.status, 'ambiguous');
  if (result.status === 'ambiguous') {
    assert.deepEqual(result.proposals.map(item => item.ownerId), ['first', 'second']);
  }
  assert.deepEqual(trace.snapshot().events, []);
  assert.equal(first.acquired.length, 0);
  assert.equal(second.acquired.length, 0);
});

test('native authority rejection produces blocked without creating a pending action', () => {
  const current = observation();
  const payload = op28Payload(current, candidate => {
    const bundles = candidate.state.bundles as Array<Record<string, unknown>>;
    bundles[0]!.admitted = false;
  });
  const staticOwner = new StaticOwner('blocked-owner', {
    ownerId: 'blocked-owner',
    proposalRef: 'blocked-proposal',
    actionRef: 'ACTION1',
    payload,
  });
  const trace = new OperationTraceSink();
  const owner = new CommonCampaignOwner([staticOwner], { trace });
  const result = owner.prepare(current);
  assert.equal(result.status, 'blocked');
  if (result.status === 'blocked') assert.equal(result.need.status, 'blocked');
  assert.equal(owner.pending(current.sessionId), undefined);
  assert.deepEqual(trace.snapshot().events.map(event => event.kind), ['need', 'operation']);
});

test('exact duplicate returns are ignored but mismatched settled returns are rejected', () => {
  const owner = new CommonCampaignOwner([new PublicSingleActionCallerOwnerAdapter()]);
  const current = observation();
  const prepared = owner.prepare(current, {
    [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: { observation: current },
  });
  assert.equal(prepared.status, 'action');
  if (prepared.status !== 'action') return;

  const input = {
    sessionId: current.sessionId,
    needId: prepared.needId,
    eventRef: 'public-return:dedupe',
    payload: { sequence: 1 },
  };
  assert.equal(owner.acquire(input).routed, true);
  const duplicate = owner.acquire(input);
  assert.equal(duplicate.routed, false);
  assert.equal(duplicate.duplicate, true);
  assert.throws(() => owner.acquire({
    ...input,
    eventRef: 'public-return:other',
  }), /already-settled need/);
});

test('campaign rejects a selected payload bound to another public revision', () => {
  const current = observation();
  const payload = op28Payload(current, candidate => {
    candidate.identity.observationRevision = 2;
  });
  const owner = new CommonCampaignOwner([new StaticOwner('bad-owner', {
    ownerId: 'bad-owner',
    proposalRef: 'bad-proposal',
    actionRef: 'ACTION1',
    payload,
  })]);
  assert.throws(() => owner.prepare(current), /revision does not match/);
});
