import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ObservedObjectBindingContinuity,
  type BindingTrackerLike,
  type ObjectBindingAttention,
  type ObjectBindingEvent,
  type ObjectBindingProposal,
} from '../src/logos-engine/observed-object-binding.ts';
import type { PublicObservationLike } from '../src/logos-engine/linked-preparation.ts';

const rows = [[0]] as const;
const obs = (ref: string, level = 1, completed = 0): PublicObservationLike => ({
  observation_ref: ref,
  revision: 1,
  level_epoch: level,
  levels_completed: completed,
  state: 'NOT_FINISHED',
  frame_hash: ref,
  available_action_refs: ['ACTION1'],
  entities: [],
});

function fixture(options: {
  focus?: { target_ref: string; binding?: { frame?: unknown } } | null;
  refutations?: Array<{ frame_ref?: string; evidence: readonly string[] }>;
  contradiction?: unknown;
  event?: ObjectBindingEvent | null;
} = {}) {
  const attentionCalls: unknown[][] = [];
  let restored: unknown;
  const tracker: BindingTrackerLike = {
    contextRefutations: options.refutations ?? [],
    admitContext() { return true; },
    frameContradiction() { return options.contradiction ?? null; },
    record() { return options.event ?? null; },
    state() { return { tracker: 'state' }; },
    restore(value) { restored = value; },
  };
  const attention: ObjectBindingAttention = {
    compositionFor() { return options.focus ?? null; },
    returnComposition(owner, target, outcome, evidence, observation) {
      attentionCalls.push(['return', owner, target, outcome, [...evidence], observation.observation_ref]);
    },
    retainComposition(owner, target, question, evidence, observation, details) {
      attentionCalls.push(['retain', owner, target, question, [...evidence], observation.observation_ref, details]);
    },
  };
  const continuity = new ObservedObjectBindingContinuity(tracker, attention, {
    question: 'Can the controlled body bind this object?',
    continuity: { retain_selected_frame_until_effect_or_refutation: true },
  });
  return { continuity, attentionCalls, restored: () => restored };
}

test('a current-frame contradiction refutes the retained parent composition', () => {
  const f = fixture({
    focus: { target_ref: 'frame-1', binding: { frame: { ref: 'frame-1' } } },
    contradiction: ['corner changed'],
    refutations: [{ frame_ref: 'frame-1', evidence: ['old-evidence'] }],
  });
  assert.equal(f.continuity.reconcileBeforeProposal(obs('current'), rows), true);
  assert.deepEqual(f.attentionCalls, [[
    'return', 'object_frame_binding', 'frame-1', 'refuted',
    ['current', 'old-evidence', 'current'], 'current',
  ]]);
});

test('a confirmed reception separation returns the selected frame as achieved', () => {
  const f = fixture({
    focus: { target_ref: 'frame-1' },
    event: { status: 'reception_confirmed_by_separation', frame_ref: 'frame-1', evidence: ['a', 'b'] },
  });
  const event = f.continuity.record(obs('before'), obs('after'), { action_ref: 'ACTION1' }, rows, rows);
  assert.equal(event?.status, 'reception_confirmed_by_separation');
  assert.deepEqual(f.attentionCalls, [[
    'return', 'object_frame_binding', 'frame-1', 'achieved', ['a', 'b'], 'after',
  ]]);
});

test('an official boundary closes the retained parent with boundary evidence', () => {
  const f = fixture({ focus: { target_ref: 'frame-2' } });
  f.continuity.record(obs('before', 1, 0), obs('after', 2, 1), { action_ref: 'ACTION1' }, rows, rows);
  assert.deepEqual(f.attentionCalls, [[
    'return', 'object_frame_binding', 'frame-2', 'boundary', ['before', 'after'], 'after',
  ]]);
});

test('pending selected frame is retained with deduplicated evidence and frozen binding snapshot', () => {
  const f = fixture();
  const proposal: ObjectBindingProposal = {
    binding_plan: {
      offer: {
        target: { frame: { ref: 'frame-3', corners: [1, 2, 3, 4] } },
        evidence: ['seed', 'before'],
      },
    },
  };
  f.continuity.record(obs('before'), obs('after'), { action_ref: 'ACTION1' }, rows, rows, proposal);
  assert.deepEqual(f.attentionCalls, [[
    'retain', 'object_frame_binding', 'frame-3', 'Can the controlled body bind this object?',
    ['seed', 'before', 'after'], 'after',
    { binding: { frame: { ref: 'frame-3', corners: [1, 2, 3, 4] } } },
  ]]);
});

test('state and restore stay owned by the binding tracker', () => {
  const f = fixture();
  assert.deepEqual(f.continuity.state(), { tracker: 'state' });
  f.continuity.restore({ restored: true });
  assert.deepEqual(f.restored(), { restored: true });
});
