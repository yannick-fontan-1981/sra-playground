import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [directory, candidateStem = 'operateur-2'] = process.argv.slice(2);
assert.ok(directory, 'Expected the local receipt directory');
const read = name => readFileSync(resolve(directory, name));
const rows = name => read(name).toString('utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(read('variation-reservee.json')),
  '1e6ebd051af04372d04b9daac9d4b1b70ef621ad368bb2321b96e9b6d572f141');

const arm = name => ({
  trace: rows(candidateStem + '-' + name + '-trace.jsonl'),
  result: rows(candidateStem + '-' + name + '.jsonl')[0],
});
const reference = rows('reference.jsonl')[0];
const nominal = arm('nominal');
const reopened = arm('reopen');
const reserved = arm('reserved');
const one = ({ trace }, event, revision) => {
  const found = trace.filter(row => row.event === event && row.revision === revision);
  assert.equal(found.length, 1, event + ' rev ' + revision);
  return found[0];
};
const physical = result => result.effects.map(effect => effect.slice(0, 6));
const action = (row, ref, data) => {
  assert.equal(row.command.action_ref, ref);
  if (data) assert.deepEqual(row.command.data, data);
};

const first = one(nominal, 'authorize', 112);
action(first, 'ACTION6', { x: 46, y: 28 });
assert.equal(first.kind, 'measure');
assert.equal(first.admitted, true);
assert.equal(first.opened.need, first.need);
assert.equal(first.opened.parent, first.parent);
assert.equal(first.opened.status, 'open');
assert.ok(first.opened.budget > 0);
assert.equal(one(nominal, 'return', 112).status, 'assigned');

const finalMeasurement = one(nominal, 'authorize', 125);
action(finalMeasurement, 'ACTION6', { x: 56, y: 28 });
assert.equal(finalMeasurement.admitted, true);
const acquired = one(nominal, 'return', 125);
assert.equal(acquired.matched, true);
assert.equal(acquired.status, 'satisfied');
assert.equal(acquired.need, finalMeasurement.need);
assert.equal(acquired.after, 126);
assert.equal(acquired.closure.before, 125);
assert.equal(acquired.closure.after, 126);
const phase = nominal.trace.filter(r => r.event === 'phase' && r.before === 125);
assert.equal(phase.length, 1);
action(phase[0], 'ACTION6', { x: 56, y: 28 });
assert.deepEqual(phase[0].beforeClosed, [true, false]);
assert.deepEqual(phase[0].afterClosed, [true, true]);

const restored = one(nominal, 'authorize', 126);
assert.equal(restored.kind, 'resume');
assert.equal(restored.admitted, true);
assert.equal(restored.need, finalMeasurement.parent);
assert.equal(restored.need, first.parent);
assert.equal(restored.prior.length, 2);
assert.equal(new Set(restored.prior.map(proof => proof.child)).size, 2);
assert.ok(restored.prior.every(proof => proof.status === 'satisfied'));
assert.deepEqual(restored.prior.find(proof => proof.child === acquired.need).control, acquired.closure.control);
action(restored, 'ACTION2');
const crossing = one(nominal, 'return', 126);
assert.equal(crossing.need, restored.need);
assert.equal(crossing.matched, true);
assert.equal(crossing.after, 127);
assert.equal(crossing.reason, 'landing_on_phase_support_confirmed');

const removals = nominal.trace.filter(r => r.event === 'provider-without-closure');
assert.ok(removals.length > 0 && removals.every(r => !r.offered && r.retainedClosed.every(Boolean)));
const guards = nominal.trace.filter(r => r.event === 'guard');
assert.deepEqual(guards.map(r => r.name),
  ['preuve-retiree', 'ouverture-ancienne', 'controle-voisin', 'variation-reservee']);
assert.ok(guards.every(r => !r.admitted && r.pointBound === true));
assert.deepEqual(guards.map(r => r.guard), [
  'phase_cycle_prerequisite_unattested', 'phase_cycle_prerequisite_unattested',
  'phase_cycle_obligation_incomplete', 'phase_cycle_prerequisite_unattested',
]);

const remeasure = one(reopened, 'authorize', 126);
action(remeasure, 'ACTION6', { x: 56, y: 28 });
assert.equal(remeasure.kind, 'measure');
assert.equal(remeasure.admitted, true);
assert.equal(remeasure.opened.need, acquired.need);
const measured = one(reopened, 'return', 126);
assert.equal(measured.need, acquired.need);
assert.equal(measured.matched, true);
assert.equal(measured.after, 127);
assert.equal(measured.status, 'assigned');
assert.equal(measured.reason, 'support_phase_measured');

assert.ok(reserved.trace.some(r => r.event === 'reserved-claim'));
const refused = one(reserved, 'authorize', 126);
action(refused, 'ACTION2');
assert.equal(refused.admitted, false);
assert.equal(refused.guard, 'phase_cycle_prerequisite_unattested');
assert.ok(!reserved.trace.some(r => r.event === 'return' && r.revision === 126));
assert.equal(reserved.result.effects.length, 125);
assert.equal(reserved.result.reason, 'no_admissible_prefix');

assert.equal(nominal.result.actions, 187);
assert.equal(nominal.result.levels, 4);
assert.deepEqual(physical(nominal.result), physical(reference));
const prefixHashes = result => result.levelStats.map(row => row.prefixHash);
assert.deepEqual(prefixHashes(nominal.result), prefixHashes(reference));
for (const variant of [reopened, reserved]) {
  assert.deepEqual(physical(variant.result).slice(0, 125), physical(nominal.result).slice(0, 125));
}
assert.equal(reopened.result.effects.length, 126);

console.log(JSON.stringify({ physicalNominal: 187, levels: 4, sharedPhysicalPrefix: 125,
  nominal: { decision: restored.command.action_ref, return: crossing.reason, closures: restored.prior.length },
  reopened: { decision: remeasure.command.action_ref, return: measured.reason, childStatus: measured.status },
  guardControls: guards.map(({ name, guard }) => ({ name, guard })),
  reserved: { firstRefusal: 15, guard: refused.guard, stop: reserved.result.reason } }, null, 2));
