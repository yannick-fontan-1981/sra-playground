import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  type AgentAction,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import { V6CommonCampaignDecisionPort } from '../src/runtime/v6-common-campaign-decision-port.ts';
import type { RetainedAddressedFieldPrior } from '../src/logos-engine/field-stock.ts';
import type {
  CommonCampaignObservation,
  CommonCampaignOwner,
  CommonCampaignProposalPayload,
} from '../src/logos-engine/v6-common-campaign-contracts.ts';
import type {
  CollectedProposal,
  CommonCallerAcquisition,
  CommonCallerProposal,
} from '../src/logos-engine/v6-neutral-common-caller.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';

function blankFrame(): number[][] {
  return Array.from({ length: 64 }, () => Array(64).fill(0));
}

function fillRect(
  frame: number[][],
  x: number,
  y: number,
  width: number,
  height: number,
  value: number,
): void {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      frame[row]![column] = value;
    }
  }
}

function fieldFrame(): number[][] {
  const frame = blankFrame();
  fillRect(frame, 1, 1, 2, 2, 1);
  fillRect(frame, 4, 1, 2, 2, 2);
  fillRect(frame, 7, 1, 2, 2, 3);
  fillRect(frame, 1, 5, 2, 2, 2);
  for (let offset = 0; offset < 3; offset += 1) {
    frame[4]![10 + offset] = 9;
    frame[6]![10 + offset] = 9;
    frame[4 + offset]![10] = 9;
    frame[4 + offset]![12] = 9;
  }
  frame[20]![20] = 1;
  frame[20]![24] = 1;
  return frame;
}

function agentObservation(
  sequence: number,
  frame: readonly (readonly number[])[],
  availableActionIds: AgentObservation['availableActionIds'],
  level = 2,
  levelsCompleted = 1,
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'campaign-session',
    sequence,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: Uint8Array.from(frame.flat()),
    },
    availableActionIds: [...availableActionIds],
    state: 'NOT_FINISHED',
    level,
    levelsCompleted,
  };
}

const prior: RetainedAddressedFieldPrior = {
  action_ref: 'ACTION6',
  lower_squared: 4,
  upper_squared: 9,
  boundary: 'retained-boundary',
  request_row: 5,
  goal_region: {
    size: [3, 3],
    envelope: [
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2],
    ],
  },
  class_templates: {
    '1': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
    '2': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
    '3': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
  },
  qualification: 'retained local hypothesis; new occurrence and field require revalidation',
};

const signal = new AbortController().signal;

test('common campaign keeps the bounded sole public action path through OP28', () => {
  const trace = new OperationTraceSink();
  const port = new V6CommonCampaignDecisionPort({ trace });
  port.initialize('campaign-session');
  const action = port.decide(agentObservation(0, blankFrame(), [4]), 50, signal);
  assert.deepEqual(action, { id: 4 });
  assert.equal(port.pendingDecision?.selected.ownerId, 'public_single_action');
  assert.equal(port.lastSelection.status, 'selected');
  assert.deepEqual(trace.snapshot().events.map(event => event.kind), [
    'need', 'operation', 'consumption',
  ]);
});

test('FieldStock return keeps the OP18 needId and changes the next addressed decision', () => {
  const trace = new OperationTraceSink();
  const port = new V6CommonCampaignDecisionPort({
    trace,
    fieldStock: { initialPrior: prior },
  });
  port.initialize('campaign-session');
  const frame = fieldFrame();

  const first = port.decide(agentObservation(0, frame, [6]), 50, signal);
  assert.deepEqual(first, { id: 6, data: { x: 22, y: 20 } });
  const firstPending = port.pendingDecision;
  assert.equal(firstPending?.selected.ownerId, 'addressed_field_stock');
  assert.match(firstPending?.needId ?? '', /:OP18:/);

  const second = port.decide(agentObservation(1, frame, [6]), 50, signal);
  assert.deepEqual(second, { id: 6, data: { x: 21, y: 20 } });
  assert.notDeepEqual(second, first);
  assert.equal(port.fieldStockOwner.runtime.field.stock?.failures.size, 1);

  const selectedReceipt = port.lastFeedbackReceipts.find(receipt => receipt.ownerId === 'addressed_field_stock');
  const result = selectedReceipt?.result as {
    needId: string;
    record?: { status: string; events: readonly Record<string, unknown>[] };
  } | undefined;
  assert.equal(selectedReceipt?.source, 'selected');
  assert.equal(result?.needId, firstPending?.needId);
  assert.equal(result?.record?.status, 'material_observation_recorded');
  assert.equal(result?.record?.events[0]?.kind, 'material_response_unresolved');

  const events = trace.snapshot().events;
  assert.deepEqual(events.map(event => event.kind), [
    'need', 'operation', 'consumption',
    'need', 'operation', 'consumption',
  ]);
  assert.equal(new Set(events.slice(0, 3).map(event => event.needId)).size, 1);
  assert.equal(new Set(events.slice(3).map(event => event.needId)).size, 1);
  assert.notEqual(events[0]?.needId, events[3]?.needId);
});

test('ACTION6 remains unknown when no retained addressed knowledge was supplied', () => {
  const port = new V6CommonCampaignDecisionPort();
  port.initialize('campaign-session');
  const action = port.decide(agentObservation(0, fieldFrame(), [6]), 50, signal);
  assert.equal(action, undefined);
  assert.equal(port.lastSelection.status, 'none');
  assert.equal(port.pendingDecision, undefined);
});

class RivalOwner implements CommonCampaignOwner {
  readonly id = 'rival';
  authorizeCalls = 0;

  propose(context: unknown): CommonCallerProposal | undefined {
    if (!context || typeof context !== 'object') return undefined;
    return {
      ownerId: this.id,
      proposalRef: 'rival:proposal',
      actionRef: 'ACTION1',
      payload: { candidate: true },
    };
  }

  authorize(
    _proposal: CollectedProposal,
    _context: CommonCampaignObservation,
  ): CommonCampaignProposalPayload {
    this.authorizeCalls += 1;
    const action: AgentAction = { id: 1 };
    return {
      version: 1,
      kind: 'public_single_action',
      action,
      needId: 'rival-need',
      bundleId: 'rival-bundle',
      ownerData: {},
    };
  }

  acquire(_event: CommonCallerAcquisition): unknown {
    return null;
  }
}

test('ambiguous proposals invoke neither owner authorization nor Logos operation', () => {
  const trace = new OperationTraceSink();
  const rival = new RivalOwner();
  const port = new V6CommonCampaignDecisionPort({ trace, additionalOwners: [rival] });
  port.initialize('campaign-session');
  const action = port.decide(agentObservation(0, blankFrame(), [4]), 50, signal);
  assert.equal(action, undefined);
  assert.equal(port.lastSelection.status, 'ambiguous');
  assert.deepEqual(port.lastSelection.proposals.map(proposal => proposal.ownerId), [
    'public_single_action',
    'rival',
  ]);
  assert.equal(rival.authorizeCalls, 0);
  assert.deepEqual(trace.snapshot().events, []);
});
