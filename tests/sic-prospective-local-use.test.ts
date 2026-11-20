import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';
import {
  assessLocal,
  demonstratedLimit,
  stalledLocal,
  newLocalMemory,
  nextLocalLevel,
  observeLocal,
  proposeLocal,
  type LocalForecast,
} from '../src/sic/prospective-local-use.ts';
import { localPatch, type Site } from '../src/sic/local-response.ts';

const ops = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'];
function scene(shift: number, phase: number) {
  const frame = Array.from({ length: 12 }, () => Array<number>(28).fill(0));
  for (const [i, y] of [2, 5, 8].entries()) {
    for (let x = 0; x < 3; x++) frame[y]![shift + x] = phase > i ? 8 + i : 2 + i;
  }
  return { frame };
}
function observation(key: string): NativeObservation {
  return {
    frame_hash: key,
    observation_ref: 'obs/' + key,
    level_epoch: 1,
    levels_completed: 0,
    state: 'NOT_FINISHED',
    available_action_refs: ops,
  } as unknown as NativeObservation;
}
test('a second disposition inherits A, B and the distinct next use from public transitions alone', () => {
  const m = newLocalMemory();
  for (let i = 0; i < 3; i++)
    observeLocal(
      m,
      observation('t' + i),
      observation('t' + (i + 1)),
      scene(2, i).frame,
      scene(2, i + 1).frame,
      ops[i]!
    );
  const carried = nextLocalLevel(m);
  assert.ok(carried.laws.length);
  assert.equal(carried.steps.length, 0);
  const plan = proposeLocal(carried, observation('new'), scene(15, 0).frame, true);
  assert.ok(plan && plan.siteC);
  assert.equal(plan.stage, 'control');
  assert.notDeepEqual(plan.trainedSite, plan.site);
  const a = scene(15, 1),
    b = scene(15, 2),
    c = scene(15, 3);
  assert.equal(localPatch(a, plan.site), plan.firstAfter);
  assert.equal(localPatch(b, plan.siteB), plan.afterB);
  assert.equal(localPatch(c, plan.siteC), plan.afterC);
  let o = observation('new');
  assert.equal(assessLocal(carried, plan, o, o, scene(15, 0).frame, scene(15, 0).frame).matches, true);
  const prep = carried.pending!;
  assert.equal(prep.stage, 'prepare');
  assessLocal(carried, prep, o, observation('prepared'), scene(15, 0).frame, a.frame);
  o = observation('prepared');
  assert.equal(carried.pending?.stage, 'test');
  assessLocal(carried, carried.pending!, o, observation('enabled'), a.frame, b.frame);
  assert.equal(carried.pending?.stage, 'use');
  assert.ok(
    assessLocal(carried, carried.pending!, observation('enabled'), observation('used'), b.frame, c.frame)
      .matches
  );
});
test('refuting B preserves the confirmed A and allows another B at the retained disposition', () => {
  const m = newLocalMemory(),
    first = scene(12, 0),
    prepared = scene(12, 1),
    enabled = scene(12, 2);
  const site: Site = [13, 2],
    siteB: Site = [13, 5],
    old: Site = [3, 2],
    oldB: Site = [3, 5];
  const beforeA = localPatch(first, site)!,
    afterA = localPatch(prepared, site)!,
    fromB = localPatch(prepared, siteB)!,
    afterB = localPatch(enabled, siteB)!;
  const plan: LocalForecast = {
    stage: 'prepare',
    origin: 'root',
    training: 'prior',
    law: 'original',
    ref: 'observed',
    trainedSite: old,
    a: ops[0]!,
    b: ops[1]!,
    c: ops[2]!,
    site,
    siteB,
    firstBefore: beforeA,
    firstAfter: afterA,
    beforeB: fromB,
    afterB,
    revised: false,
    controlRef: 'control',
  };
  observeLocal(m, observation('root'), observation('root'), first.frame, first.frame, ops[3]!);
  assessLocal(m, plan, observation('root'), observation('prepared'), first.frame, prepared.frame);
  const failure = assessLocal(
    m,
    m.pending!,
    observation('prepared'),
    observation('prepared'),
    prepared.frame,
    prepared.frame
  );
  assert.ok(failure.retained);
  assert.deepEqual(m.facts?.[0]?.failed, [ops[1]]);
  m.laws.push({
    a: ops[0]!,
    b: ops[3]!,
    c: ops[2]!,
    first: { p: old, from: beforeA, to: afterA, n: 3 },
    second: { p: oldB, from: fromB, to: afterB, n: 3 },
    bareB: fromB,
    origin: 'prior',
    ref: 'other',
    key: 'revised',
    matchedInTraining: true,
  });
  const revision = proposeLocal(m, observation('prepared'), prepared.frame, true);
  assert.ok(revision?.revised);
  assert.equal(revision.b, ops[3]);
  assert.equal(revision.stage, 'test');
  assert.ok(
    assessLocal(m, revision, observation('prepared'), observation('enabled'), prepared.frame, enabled.frame)
      .matches
  );
  assert.ok(m.facts?.length);
});


test('a return only warrants an early experiment after prior transitions close the same space', () => {
  const m = newLocalMemory();
  for (let i = 0; i < 3; i++) {
    observeLocal(m, observation('t'+i), observation('t'+(i+1)), scene(2,i).frame, scene(2,i+1).frame, ops[i]!);
  }
  const p = proposeLocal(m, observation('here'), scene(15,0).frame, true)!;
  assert.ok(p);
  assert.equal(demonstratedLimit(m,p),false);
  const unchanged=scene(15,0).frame, ready=scene(15,2).frame;
  observeLocal(m, observation('here'), observation('here'), unchanged, unchanged, p.b);
  assert.equal(stalledLocal(m,'here'),false);
  assert.equal(demonstratedLimit(m,p),true);
  for(let k=0;k<3;k++)observeLocal(m,observation('here'),observation('here'),unchanged,unchanged,p.b);
  assert.equal(stalledLocal(m,'here'),true);
  observeLocal(m,observation('here'),observation('reachable'),unchanged,ready,'ACTION5');
  assert.equal(demonstratedLimit(m,p),false);
  assert.equal(stalledLocal(m,'reachable'),false);
});
