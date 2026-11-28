import assert from 'node:assert/strict';
import test from 'node:test';
import { P05AcquisitionLedger, p05Conditions, p05ConditionsHold, ablateP05Return,
  type P05Observation, type P05PublicReturn, type P05AcquiredEffect } from '../src/sic/p05-acquisition.ts';
import { FrozenP05MotionAdapter, frozenP05Provenance } from '../src/sic/p05-frozen-adapter.ts';

type EpisodeOptions = {
  epoch: string; command?: string; selected?: string; delta?: readonly [number, number]; delay?: number;
  cost?: number; remote?: number; ambient?: number; reserve?: number; maxLatency?: number;
  context?: Record<string, string | number | boolean>;
};

function episode(options: EpisodeOptions): P05PublicReturn[] {
  const selected = options.selected ?? 'body-a', latency = options.maxLatency ?? 2;
  const initialReserve = options.reserve ?? 10;
  const context = options.context ?? { terrain: 'floor', support: true, blocked: false, phase: 0 };
  function observation(tick: number): P05Observation {
    const fired = Boolean(options.command) && tick >= 1 + (options.delay ?? 0);
    const d = fired ? options.delta ?? [0, 0] : [0, 0];
    return { ref: options.epoch + ':t' + tick, epoch: options.epoch, tick, selected,
      subjects: [{ id: 'body-a', position: [3 + (selected === 'body-a' ? d[0]! : 0), 4 + (selected === 'body-a' ? d[1]! : 0)] },
        { id: 'body-b', position: [9 + (selected === 'body-b' ? d[0]! : 0), 8 + (selected === 'body-b' ? d[1]! : 0)] }],
      context, reserve: initialReserve - (options.command && tick > 0 ? options.cost ?? 0 : 0),
      remote: (options.ambient ?? 0) * tick + (fired ? options.remote ?? 0 : 0) };
  }
  return Array.from({ length: latency + 1 }, (_, index) => ({
    id: options.epoch + ':return:' + (index + 1),
    kind: options.command && index === 0 ? 'command' as const : 'wait' as const,
    command: options.command && index === 0 ? options.command : 'WAIT',
    before: observation(index), after: observation(index + 1), elapsed: 1,
  }));
}

function add(learner: { addReturn(receipt: P05PublicReturn): void }, receipts: readonly P05PublicReturn[]) {
  for (const receipt of receipts) learner.addReturn(receipt);
}

test('P05 measures an opaque command, onset, reserve and causal distant change against WAIT', () => {
  const learner = new P05AcquisitionLedger({ maxLatency: 2 });
  add(learner, episode({ epoch: 'control', ambient: 7 }));
  add(learner, episode({ epoch: 'trial', command: 'violet-key', delta: [-5, 0], delay: 2, cost: 3, remote: 11, ambient: 7 }));
  const [claim] = learner.claims();
  assert.equal(learner.claims().length, 1);
  assert.deepEqual(claim!.delta, [-5, 0]);
  assert.equal(claim!.delay, 2);
  assert.equal(claim!.resourceCost, 3);
  assert.equal(claim!.remoteDelta, 11);
  assert.equal(claim!.supportingReturnIds[0], 'trial:return:3');
  assert.ok(claim!.supportingReturnIds.includes('control:return:3'));
  assert.equal(claim!.effectKind, 'combined');
  assert.equal(claim!.status, 'restricted');
});

test('P05 does not attribute an ambient remote change to a command', () => {
  const learner = new P05AcquisitionLedger({ maxLatency: 2 });
  add(learner, episode({ epoch: 'control', ambient: 9 }));
  add(learner, episode({ epoch: 'trial', command: 'q', delta: [0, 2], ambient: 9 }));
  assert.equal(learner.claims()[0]!.remoteDelta, 0);
});

test('P05 keeps missing public controls and a stationary attempt distinct', () => {
  const learner = new P05AcquisitionLedger({ maxLatency: 2 });
  add(learner, episode({ epoch: 'uncontrolled', command: 'q', delta: [2, 0] }));
  assert.deepEqual(learner.claims(), []);
  assert.deepEqual(learner.diagnostics().uncontrolledEpochs, ['uncontrolled']);
  add(learner, episode({ epoch: 'control' }));
  add(learner, episode({ epoch: 'blocked-control', context: { terrain: 'wall', blocked: true } }));
  add(learner, episode({ epoch: 'blocked', command: 'q', context: { terrain: 'wall', blocked: true } }));
  const [claim] = learner.claims();
  assert.deepEqual(claim!.delta, [2, 0]);
  assert.ok(claim!.limitingReturnIds.includes('blocked:return:1'));
  assert.ok(learner.diagnostics().stationaryReturnIds.includes('blocked:return:1'));
  assert.equal(learner.claims().length, 1);
});

test('P05 learns the selected receiver only through different observed selections and preserves scope', () => {
  const learner = new P05AcquisitionLedger({ maxLatency: 2 });
  for (const selected of ['body-a', 'body-b']) {
    add(learner, episode({ epoch: selected + '-control', selected }));
    add(learner, episode({ epoch: selected + '-trial', selected, command: 'q', delta: [0, -3] }));
  }
  const claims = learner.claims();
  assert.equal(claims.length, 2);
  assert.ok(claims.every(claim => claim.receiver === 'selected'));
  assert.deepEqual(claims.map(claim => claim.conditions.find(condition => condition.field === 'selected')!.equals).sort(),
    ['body-a', 'body-b']);
  assert.ok(claims.every(claim => claim.supportingReturnIds.includes('body-a-trial:return:1')
    && claim.supportingReturnIds.includes('body-b-trial:return:1')));
});

test('P05 conditions include reserve even at identical geometry and distinguish context key collisions', () => {
  const learner = new P05AcquisitionLedger({ maxLatency: 2 });
  const context = { reserve: 'visible-marker', selected: 'texture-label', terrain: 'same-floor' };
  add(learner, episode({ epoch: 'full-control', context, reserve: 6 }));
  add(learner, episode({ epoch: 'full', context, reserve: 6, command: 'q', cost: 2, delta: [4, 0] }));
  add(learner, episode({ epoch: 'empty-control', context, reserve: 0 }));
  add(learner, episode({ epoch: 'empty', context, reserve: 0, command: 'q' }));
  const [claim] = learner.claims();
  assert.equal(claim!.conditions.find(condition => condition.field === 'reserve')!.equals, 6);
  assert.equal(claim!.conditions.find(condition => condition.field === 'context.reserve')!.equals, 'visible-marker');
  assert.equal(claim!.conditions.find(condition => condition.field === 'selected')!.equals, 'body-a');
  assert.ok(!p05ConditionsHold(claim!.conditions, episode({ epoch: 'empty-read', context, reserve: 0 })[0]!.before));
  assert.ok(claim!.limitingReturnIds.includes('empty:return:1'));
});

test('P05 preserves resource-only and remote-only effects despite stationary geometry', () => {
  const learner = new P05AcquisitionLedger({ maxLatency: 2 });
  add(learner, episode({ epoch: 'control', ambient: 2 }));
  add(learner, episode({ epoch: 'resource', command: 'use', cost: 4, ambient: 2 }));
  add(learner, episode({ epoch: 'remote', command: 'send', remote: 8, delay: 1, ambient: 2 }));
  const claims = learner.claims();
  assert.equal(claims.length, 2);
  assert.equal(claims.find(claim => claim.command === 'use')!.effectKind, 'resource');
  assert.equal(claims.find(claim => claim.command === 'use')!.resourceCost, 4);
  assert.equal(claims.find(claim => claim.command === 'send')!.effectKind, 'remote');
  assert.equal(claims.find(claim => claim.command === 'send')!.delay, 1);
  assert.ok(learner.diagnostics().stationaryReturnIds.includes('resource:return:1'));
});

test('P05 ablates only the decisive return and does not reconstruct it from a later before snapshot', () => {
  const learner = new P05AcquisitionLedger({ maxLatency: 2 });
  add(learner, episode({ epoch: 'control' }));
  add(learner, episode({ epoch: 'trial', command: 'q', delta: [2, 0], delay: 1 }));
  const decisive = learner.claims()[0]!.supportingReturnIds[0]!;
  assert.equal(decisive, 'trial:return:2');
  const ablated = learner.withoutReturn(decisive);
  assert.deepEqual(ablated.claims(), []);
  assert.deepEqual(ablated.diagnostics().missingReturnIds, [decisive]);
  assert.deepEqual(ablated.diagnostics().missingLinkEpochs, ['trial']);
  assert.equal(ablated.diagnostics().receipts, learner.diagnostics().receipts);
  assert.ok(!ablated.diagnostics().stationaryReturnIds.includes(decisive));
  add(ablated, episode({ epoch: 'reacquired', command: 'q', delta: [2, 0], delay: 1 }));
  assert.equal(ablated.claims()[0]!.supportingReturnIds[0], 'reacquired:return:2');
});

test('P05 information ablation removes aliases of one observation while preserving all other public values', () => {
  const history = [...episode({ epoch: 'control' }),
    ...episode({ epoch: 'trial', command: 'q', delta: [2, 0], delay: 1 })];
  const target = history.find(receipt => receipt.id === 'trial:return:2')!;
  const removedRef = target.after!.ref;
  const ablated = ablateP05Return(history, target.id);
  assert.equal(ablated.length, history.length);
  for (let index = 0; index < history.length; index++) {
    const original = history[index]!, masked = ablated[index]!;
    assert.equal(masked.id, original.id);
    assert.equal(masked.command, original.command);
    assert.equal(masked.elapsed, original.elapsed);
    assert.equal(masked.kind, original.kind);
    if (original.before?.ref === removedRef) {
      assert.equal(masked.before, null);
      assert.equal(masked.beforeRef, original.before.ref);
      assert.equal(masked.epoch, original.before.epoch);
      assert.equal(masked.tick, original.before.tick);
    } else assert.deepEqual(masked.before, original.before);
    if (original.after?.ref === removedRef) assert.equal(masked.after, null);
    else assert.deepEqual(masked.after, original.after);
    assert.ok(!masked.before || masked.before.ref !== removedRef);
    assert.ok(!masked.after || masked.after.ref !== removedRef);
  }
  assert.ok(target.after); // No mutation of the original trajectory.
  const learner = new P05AcquisitionLedger({ maxLatency: 2 });
  add(learner, ablated);
  assert.deepEqual(learner.claims(), []);
  assert.deepEqual(learner.diagnostics().rejectedReturnIds, []);
  assert.deepEqual(learner.diagnostics().missingLinkEpochs, ['trial']);
});

test('P05 prior evidence alone cannot acquire a current effect; new evidence can refute the recall', () => {
  const observation = episode({ epoch: 'new' })[0]!.before;
  const prior: P05AcquiredEffect = { effectId: 'old:effect', command: 'q', receiver: 'body-a', delta: [2, 0],
    delay: 0, resourceCost: 0, remoteDelta: 0, conditions: p05Conditions(observation),
    supportingReturnIds: ['old:return'], limitingReturnIds: [], status: 'restricted' };
  const learner = new P05AcquisitionLedger({ maxLatency: 2, priorClaims: [prior] });
  assert.deepEqual(learner.claims(), []);
  assert.deepEqual(learner.diagnostics().staleProofIds, ['old:return']);
  add(learner, episode({ epoch: 'control' }));
  add(learner, episode({ epoch: 'trial', command: 'q', delta: [0, -4] }));
  assert.equal(learner.claims()[0]!.transferStatus, 'refuted');
  assert.ok(!learner.claims()[0]!.supportingReturnIds.includes('old:return'));
});

test('P05 prior recall can be confirmed or restricted only after measurement', () => {
  const base: P05AcquiredEffect = { effectId: 'old:effect', command: 'q', receiver: 'body-a', delta: [2, 0],
    delay: 0, resourceCost: 0, remoteDelta: 0, conditions: [],
    supportingReturnIds: ['old:return'], limitingReturnIds: [], status: 'restricted' };
  for (const exact of [false, true]) {
    const prior = { ...base, conditions: exact ? p05Conditions(episode({ epoch: 'new' })[0]!.before) : [] };
    const learner = new P05AcquisitionLedger({ maxLatency: 2, priorClaims: [prior] });
    add(learner, episode({ epoch: 'control' }));
    add(learner, episode({ epoch: 'trial', command: 'q', delta: [2, 0] }));
    assert.equal(learner.claims()[0]!.transferStatus, exact ? 'confirmed' : 'restricted');
  }
});

test('P05 rejects conflicting return identities and multiple unisolated commands', () => {
  const learner = new P05AcquisitionLedger({ maxLatency: 2 });
  add(learner, episode({ epoch: 'control' }));
  const trial = episode({ epoch: 'trial', command: 'q', delta: [2, 0] });
  add(learner, [trial[0]!, { ...trial[1]!, kind: 'command', command: 'another' }, trial[2]!]);
  assert.deepEqual(learner.claims(), []);
  assert.deepEqual(learner.diagnostics().ambiguousEpochs, ['trial']);
  assert.throws(() => learner.addReturn({ ...trial[0]!, after: null }), /cannot change/);
});

test('the frozen adapter records actual source vectors without manufacturing contextual claims', () => {
  const frozen = new FrozenP05MotionAdapter({ maxLatency: 2 });
  add(frozen, episode({ epoch: 'first', command: 'q', delta: [2, 0] }));
  add(frozen, episode({ epoch: 'second', command: 'r', delta: [4, 0] }));
  assert.deepEqual(frozen.claims(), []);
  assert.equal(frozenP05Provenance.revision, '20433007224accc36e3d7976696d9ee7a783a227');
  assert.ok(frozen.vectors().some(vector => vector.command === 'q' && vector.delta[0] === 2));
  assert.ok(frozen.observedEffects().some(effect => effect.command === 'r' && effect.delta[0] === 4
    && effect.supportingReturnIds.includes('second:return:1')));
  assert.ok(frozen.vectors().every(vector => vector.selectorEvidence.length === 0));
});
