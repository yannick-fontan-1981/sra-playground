import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import {
  CommonCampaignOwner,
} from '../src/logos-engine/v6-common-campaign-owner.ts';
import {
  PublicSingleActionCallerOwnerAdapter,
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
} from '../src/logos-engine/v6-public-single-action-caller-adapter.ts';
import {
  NeutralCommonCaller,
  type CommonCallerOwner,
  type CommonCallerProposal,
} from '../src/logos-engine/v6-neutral-common-caller.ts';

class TrackingOwner implements CommonCallerOwner {
  readonly id = 'tracking';
  lastPayload: Record<string, unknown> | undefined;

  propose(): CommonCallerProposal {
    this.lastPayload = { nested: { value: 3 } };
    return {
      ownerId: this.id,
      proposalRef: 'tracking:proposal',
      actionRef: 'ACTION1',
      payload: this.lastPayload,
    };
  }

  acquire(): undefined {
    return undefined;
  }
}

function observation(): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'owned-campaign',
    sequence: 0,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: new Uint8Array(64 * 64),
    },
    availableActionIds: [1],
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
  };
}

test('detached collection clones payload while owned collection transfers it once', () => {
  const caller = new NeutralCommonCaller();
  const owner = new TrackingOwner();
  caller.register(owner);

  const detached = caller.collect();
  assert.ok(owner.lastPayload);
  assert.notEqual(detached[0]?.payload, owner.lastPayload);
  const detachedSelection = caller.select(detached);
  assert.notEqual(detachedSelection.selected?.payload, detached[0]?.payload);

  const owned = caller.collectOwned();
  assert.ok(owner.lastPayload);
  assert.equal(owned[0]?.payload, owner.lastPayload);
  const ownedSelection = caller.selectOwned(owned);
  assert.equal(ownedSelection.selected, owned[0]);
  assert.equal(ownedSelection.selected?.payload, owner.lastPayload);
});

test('common campaign exposes proposal identity without leaking transferred payload', () => {
  const campaign = new CommonCampaignOwner([new PublicSingleActionCallerOwnerAdapter()]);
  const current = observation();
  const result = campaign.prepare(current, {
    [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: { observation: current },
  });
  assert.equal(result.status, 'action');
  if (result.status !== 'action') return;
  assert.equal(result.proposals.length, 1);
  assert.equal(Object.hasOwn(result.proposals[0]!, 'payload'), false);
  assert.deepEqual(result.proposals[0], {
    ownerId: PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
    proposalRef: result.proposalRef,
    actionRef: 'ACTION1',
  });
});
