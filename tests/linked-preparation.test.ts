import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LinkedPreparation,
  type ObservationMeasurer,
  type PhaseRelationsLike,
  type PublicFrameLike,
  type PublicObservationLike,
} from '../src/logos-engine/linked-preparation.ts';

const rows = [[0, 1], [1, 0]] as const;
const observation = (overrides: Partial<PublicObservationLike> = {}): PublicObservationLike => ({
  observation_ref: 'session:epoch:3:obs:9',
  revision: 7,
  level_epoch: 3,
  levels_completed: 1,
  state: 'NOT_FINISHED',
  frame_hash: 'abc',
  available_action_refs: ['ACTION1', 'ACTION2'],
  ...overrides,
});

function fixture(states: unknown = { phase: 1 }) {
  const calls: Array<readonly [string, ...unknown[]]> = [];
  const phase: PhaseRelationsLike = {
    states,
    linked_contact: {
      propose(_phase, obs, _rows, inputs, remaining) {
        calls.push(['propose', obs.observation_ref, inputs.length, remaining]);
        return { kind: 'temporal-contact' };
      },
    },
    before(proposal, index, publicFrame, obs) {
      calls.push(['before', proposal.kind, index, publicFrame.level, obs.observation_ref]);
      return { admitted: true };
    },
    after(proposal, index, before, after) {
      calls.push(['after', proposal.kind, index, before.observation_ref, after.observation_ref]);
      return { matched: true };
    },
    record(before, after, command) {
      calls.push(['record', before.observation_ref, after.observation_ref, command]);
      return [{ kind: 'phase-event' }];
    },
    preservation_obligations(obs) {
      calls.push(['preservation', obs.observation_ref]);
      return [{ id: 'keep-1' }];
    },
  };
  return { phase, calls };
}

const measurer = (calls: Array<readonly [string, ...unknown[]]>): ObservationMeasurer =>
  (publicFrame, revision, scope) => {
    calls.push(['measure', publicFrame.level, revision, scope]);
    return [{
      observation_ref: `${scope}:measured`,
      revision,
      level_epoch: publicFrame.level,
      levels_completed: publicFrame.levels_completed,
      state: publicFrame.state,
      frame_hash: publicFrame.frame_hash,
      available_action_refs: publicFrame.available_action_refs,
      entities: [],
    }];
  };

test('fullObservation reuses an already measured observation without remeasuring', () => {
  const { phase, calls } = fixture();
  const adapter = new LinkedPreparation(phase, measurer(calls));
  const full = observation({ entities: [{ id: 'e1' }] });
  assert.equal(adapter.fullObservation(full, rows), full);
  assert.deepEqual(calls, []);
});

test('fullObservation reconstructs public transport context and strips epoch suffix from scope', () => {
  const { phase, calls } = fixture();
  const adapter = new LinkedPreparation(phase, measurer(calls));
  const result = adapter.fullObservation(observation(), rows);
  assert.equal(result.observation_ref, 'session:measured');
  assert.deepEqual(calls, [['measure', 3, 7, 'session']]);
});

test('propose delegates only when phase state exists and marks the linked preparation plan', () => {
  const a = fixture();
  const adapter = new LinkedPreparation(a.phase, measurer(a.calls));
  assert.deepEqual(adapter.propose(observation(), rows, ['ACTION1'], 5), {
    kind: 'temporal-contact', linked_preparation_plan: true,
  });

  const b = fixture(null);
  const empty = new LinkedPreparation(b.phase, measurer(b.calls));
  assert.equal(empty.propose(observation(), rows, [], 5), null);
  assert.deepEqual(b.calls, []);
});

test('bind forwards the exact proposal to the domain', () => {
  const { phase, calls } = fixture();
  const adapter = new LinkedPreparation(phase, measurer(calls));
  const proposal = { id: 'p1' };
  let bound: unknown;
  adapter.bind(proposal, { bind_proposal(value) { bound = value; } });
  assert.equal(bound, proposal);
});

test('before and after complete observations before delegating to phase relations', () => {
  const { phase, calls } = fixture();
  const adapter = new LinkedPreparation(phase, measurer(calls));
  const publicFrame: PublicFrameLike = {
    frame_rows: rows,
    level: 3,
    levels_completed: 1,
    state: 'NOT_FINISHED',
    frame_hash: 'abc',
    available_action_refs: ['ACTION1'],
  };
  assert.deepEqual(adapter.before({ kind: 'p' }, 0, publicFrame, observation()), { admitted: true });
  assert.equal(adapter.currentObservation?.observation_ref, 'session:measured');

  calls.length = 0;
  const before = observation({ observation_ref: 'before:epoch:3:o1' });
  const after = observation({ observation_ref: 'after:epoch:3:o2' });
  assert.deepEqual(adapter.after({ kind: 'p' }, 1, before, after, rows, rows), { matched: true });
  assert.deepEqual(calls, [
    ['measure', 3, 7, 'before'],
    ['measure', 3, 7, 'after'],
    ['after', 'p', 1, 'before:measured', 'after:measured'],
  ]);
});

test('record accumulates phase events and records only completed-level boundaries', () => {
  const { phase, calls } = fixture();
  const adapter = new LinkedPreparation(phase, measurer(calls));
  const before = observation({ observation_ref: 'b', levels_completed: 1 });
  const same = observation({ observation_ref: 's', levels_completed: 1 });
  const advanced = observation({ observation_ref: 'a', levels_completed: 2 });

  assert.deepEqual(adapter.record(before, same, { action_ref: 'ACTION1' }, rows, rows), [{ kind: 'phase-event' }]);
  assert.deepEqual(adapter.passed, []);
  adapter.record(same, advanced, { action_ref: 'ACTION2' }, rows, rows);
  assert.deepEqual(adapter.events, [{ kind: 'phase-event' }, { kind: 'phase-event' }]);
  assert.deepEqual(adapter.passed, [{ score: 2, observation_ref: 'a' }]);
});

test('preservation obligations are delegated unchanged to phase relations', () => {
  const { phase, calls } = fixture();
  const adapter = new LinkedPreparation(phase, measurer(calls));
  assert.deepEqual(adapter.preservationObligations(observation(), rows), [{ id: 'keep-1' }]);
  assert.deepEqual(calls, [['preservation', 'session:epoch:3:obs:9']]);
});
