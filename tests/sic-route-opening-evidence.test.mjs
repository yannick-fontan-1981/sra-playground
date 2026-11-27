import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { captureOpeningControl, completeOpeningControl, measureOpeningReturn,
  measuredOpeningPreparation, observeOpeningContinuity, openingOwner } from '../scripts/sic-route-opening-continuity.mjs';

const witness = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-observed-route-opening-public.json.gz', import.meta.url))));
const records = witness.opening.slice(1), target = 15;
const digest = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
const proposal = () => ({ kind: openingOwner, binding: { level_epoch: 6 }, memory: structuredClone(witness.acquired.state),
  actions: records.map(record => ({ action_ref: 'ACTION' + record.command.id })),
  choice: { kind: 'open', target }, route: records.map(() => ({ actor: 99, carrier: 99 })), scene: { actor: 99, carrier: 99 } });
const ticket = index => ({ level: 6, actionIndex: index, actionRef: 'ACTION' + records[index].command.id,
  levelsCompleted: 5, observationRef: records[index].observation.observation_ref });
const afterRef = index => records[index].observation.observation_ref.replace(/:revision:\d+:frame:[0-9a-f]+$/,
  ':revision:' + (records[index].observation.revision + 1) + ':frame:' + digest(records[index].after.frame));
const receipt = index => ({ planId: 'test-native-plan', outcomeCount: 1, sealCount: Number(index === records.length - 1),
  sealed: index === records.length - 1 ? records.length : null,
  outcome: { family: openingOwner, sic_plan: 'test-native-plan', index, matched: true,
    seal_prefix: index === records.length - 1, observation_ref: afterRef(index), reason: 'projected_route_effect_observed' } });
// The frames are public observations. This synthetic owner receipt tests the
// passive collector's lifecycle; it is not a new native campaign measurement.
const acquired = () => ({ roles: structuredClone(witness.roles), state: { ...structuredClone(witness.acquired.state),
  count: witness.acquired.state.count + records.length, opening: target, lastMatched: true,
  refs: [witness.acquired.state.refs.at(-1), ...records.map((_, index) => afterRef(index))] } });
const sample = () => {
  const p = proposal(), run = { code: 'ESCT', executedTickets: [], steps: [] };
  for (const [index, record] of records.entries()) {
    const captured = captureOpeningControl(p, ticket(index), record.before.frame, () => witness.acquired);
    const measured = measureOpeningReturn(captured, record.after.frame, 5);
    run.executedTickets.push({ level: 6, actionIndex: index, action: ticket(index).actionRef, decisionRevision: 95,
      ...receipt(index), opening: completeOpeningControl(measured, acquired, receipt(index)) });
    run.steps.push({ a: record.command.id, family: openingOwner, pixels: 1,
      from: digest(record.before.frame), to: digest(record.after.frame) });
  }
  return run;
};
const measure = run => measuredOpeningPreparation(run, run.executedTickets, new Map([[95, run.executedTickets]]));

test('opening collector reads five cursor moves then removal of the target wall from actual frames', () => {
  const run = sample(), observed = run.executedTickets.map(ticket => ticket.opening);
  assert.deepEqual(observed.map(p => p.before.actor), [[5, 4], [5, 3], [5, 2], [5, 1], [4, 1], [3, 1]]);
  assert.ok(observed.every(p => p.before.wall === true));
  assert.deepEqual(observed.map(p => p.after.wall), [true, true, true, true, true, false]);
  assert.ok(observed.every(p => p.before.actorCount === 1 && p.before.carrierCount === 1));
  assert.deepEqual(measure(run), [{ kind: 'cursor preparation then observed opening', first: 0, last: 5 }]);
});

test('capture copies the acquired role before dispatch and samples acquisition only after the seal', () => {
  const owner = structuredClone(witness.acquired), p = proposal();
  const captured = captureOpeningControl(p, ticket(0), records[0].before.frame, () => owner);
  owner.roles.refs.push('late'); owner.roles.routeVerified = false; p.memory.grid.width = 99;
  assert.equal(captured.role.routeVerified, true); assert.ok(!captured.role.evidence.includes('late'));
  assert.equal(captured.grid.width, witness.grid.width);
  let reads = 0;
  const result = completeOpeningControl(captured, () => { reads++; return acquired(); }, receipt(0));
  assert.equal(reads, 0); assert.equal(result.acquisition, null);
});

test('an absent or ambiguous physical cursor cannot borrow the predicted position', () => {
  const [left, top] = witness.grid.bounds, q = witness.grid.pitch;
  for (const duplicate of [false, true]) {
    const rows = structuredClone(records[0].before.frame);
    const from = [left + 1 + 5 * q, top + 1 + 4 * q], to = [left + 1 + 6 * q, top + 1 + 4 * q];
    for (let dy = 0; dy < q; dy++) for (let dx = 0; dx < q; dx++) {
      if (duplicate) rows[to[1] + dy][to[0] + dx] = rows[from[1] + dy][from[0] + dx];
      else if (dy === 0 || dx === 0 || dy === q - 1 || dx === q - 1) rows[from[1] + dy][from[0] + dx] = witness.grid.floor;
    }
    const observed = observeOpeningContinuity(rows, witness.grid, witness.roles, target);
    assert.equal(observed.actor, null); assert.equal(observed.actorCount, duplicate ? 2 : 0);
  }
});

test('a boundary keeps positions unknown instead of measuring the next board as an opening', () => {
  const first = sample().executedTickets[0].opening;
  const measured = measureOpeningReturn(first, records[0].after.frame, 6);
  assert.equal(measured.after, null); assert.equal(measured.scoreAfter, 6);
});

test('an unknown occupant masking the wall cannot turn one exposed floor pixel into an opening', () => {
  const rows = structuredClone(records.at(-1).after.frame), { bounds, pitch, width, inset } = witness.grid;
  const x = bounds[0] + 2 + (target % width) * pitch, y = bounds[1] + 2 + Math.floor(target / width) * pitch;
  rows[y][x] = 8; rows[y][x + 1] = inset; rows[y + 1][x] = 8; rows[y + 1][x + 1] = 8;
  const observed = observeOpeningContinuity(rows, witness.grid, witness.roles, target);
  assert.equal(observed.wall, null);
});

test('opening proof rejects absent, future or foreign learned roles and detached frame evidence', () => {
  for (const corrupt of [
    p => { p.role.routeVerified = false; }, p => { p.role.evidence = []; },
    p => { p.role.evidence[0] = p.afterRef; },
    p => { p.retainedEvidence[0] = p.retainedEvidence[0].replace(/^.*?:epoch:/, 'foreign:epoch:'); },
    p => { p.before.frame = 'unrelated'; }, p => { p.beforeRef = p.beforeRef.replace(':epoch:6:', ':epoch:4:'); },
  ]) {
    const run = sample(); corrupt(run.executedTickets[0].opening);
    assert.throws(() => measure(run), /learned role, measured grid or bound return/);
  }
});

test('a moving carrier or unchanged target wall cannot pass as the measured preparation', () => {
  for (const corrupt of [
    run => { run.executedTickets[1].opening.after.carrier = [9, 9]; },
    run => { run.executedTickets[0].opening.after.actor = [9, 9]; },
    run => { run.executedTickets.at(-1).opening.after.wall = true; },
  ]) {
    const run = sample(); corrupt(run);
    assert.throws(() => measure(run), /measured cursor preparation|remove the measured target wall/);
  }
});

test('opening reconciliation covers every actual return and preserves the earlier role evidence', () => {
  for (const corrupt of [
    p => { p.acquisition.count--; }, p => { p.acquisition.evidence.pop(); },
    p => { p.acquisition.roleEvidence = []; }, p => { p.acquisition.lastMatched = false; },
  ]) {
    const run = sample(); corrupt(run.executedTickets.at(-1).opening);
    assert.throws(() => measure(run), /final reconciliation/);
  }
});

test('a continuation cannot hide a contradicted return, duplicate outcome or premature seal', () => {
  for (const corrupt of [
    ticket => { ticket.outcome.matched = false; }, ticket => { ticket.outcomeCount = 2; },
    ticket => { ticket.outcome.sic_plan = 'another-plan'; }, ticket => { ticket.sealCount = 1; },
  ]) {
    const run = sample(); corrupt(run.executedTickets[0]);
    assert.throws(() => measure(run), /confirmed return|actual return|exactly one|reconciled before/);
  }
});
