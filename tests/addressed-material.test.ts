import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AddressedMaterial,
  type AddressedFieldLike,
} from '../src/logos-engine/addressed-material.ts';
import type {
  PublicFrameLike,
  PublicObservationLike,
} from '../src/logos-engine/linked-preparation.ts';

const first = [[1, 2], [3, 4]] as const;
const second = [[4, 3], [2, 1]] as const;

const observation = (ref: string): PublicObservationLike => ({
  observation_ref: ref,
  revision: 1,
  level_epoch: 2,
  levels_completed: 0,
  state: 'NOT_FINISHED',
  frame_hash: ref,
  available_action_refs: ['ACTION6'],
});

const publicFrame: PublicFrameLike = {
  frame_rows: first,
  level: 2,
  levels_completed: 0,
  state: 'NOT_FINISHED',
  frame_hash: 'public',
  available_action_refs: ['ACTION6'],
};

function fixture() {
  const calls: unknown[][] = [];
  const field: AddressedFieldLike = {
    before(proposal, index, frame, obs) {
      calls.push(['before', proposal.id, index, frame.frame_hash, obs.observation_ref]);
      return { admitted: true };
    },
    after(proposal, index, before, after, a, b) {
      calls.push(['after', proposal.id, index, before.observation_ref, after.observation_ref, a === first, b === second]);
      return { matched: true };
    },
  };
  const fullCalls: unknown[][] = [];
  const fullObservation = (obs: PublicObservationLike, rows: readonly (readonly number[])[]) => {
    fullCalls.push([obs.observation_ref, rows]);
    return { ...obs, observation_ref: `${obs.observation_ref}:full`, entities: [] };
  };
  return { field, calls, fullCalls, fullObservation };
}

test('before completes the observation and delegates exactly once', () => {
  const f = fixture();
  const material = new AddressedMaterial(f.field, f.fullObservation);
  assert.deepEqual(material.before({ id: 'p1' }, 0, publicFrame, observation('before')), { admitted: true });
  assert.equal(material.currentObservation?.observation_ref, 'before:full');
  assert.deepEqual(f.calls, [['before', 'p1', 0, 'public', 'before:full']]);
  assert.equal(f.fullCalls.length, 1);
  assert.equal(f.fullCalls[0]?.[0], 'before');
  assert.equal(f.fullCalls[0]?.[1], first);
});

test('after completes both observations and forwards the original frame pairs', () => {
  const f = fixture();
  const material = new AddressedMaterial(f.field, f.fullObservation);
  const result = material.after({ id: 'p2' }, 3, observation('prior'), observation('next'), first, second);
  assert.deepEqual(result, { matched: true });
  assert.equal(material.currentObservation?.observation_ref, 'next:full');
  assert.deepEqual(f.calls, [['after', 'p2', 3, 'prior:full', 'next:full', true, true]]);
  assert.equal(f.fullCalls.length, 2);
  assert.equal(f.fullCalls[0]?.[0], 'prior');
  assert.equal(f.fullCalls[1]?.[0], 'next');
});
