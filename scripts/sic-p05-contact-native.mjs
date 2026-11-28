import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assets, captureNativeCourse, git } from './sic-native-course.mjs';
import { compareTraces } from './compare-sic-decisions.mjs';

const [reference, candidate, base, sha, specification, output] = process.argv.slice(2);
assert.ok(reference && candidate && /^[a-f0-9]{40}$/.test(base ?? '') && /^[a-f0-9]{40}$/.test(sha ?? '') && specification && output,
  'Pass REFERENCE-CHECKOUT CANDIDATE-CHECKOUT REFERENCE-SHA CANDIDATE-SHA SEALED-CASE NEW-OUTPUT-DIRECTORY');
assert.equal(process.version, 'v24.22.3');
git(candidate, 'merge-base', '--is-ancestor', base, sha);
git(candidate, 'diff', '--quiet', base, sha, '--', ...assets);
const directory = resolve(output);
mkdirSync(directory);
const expected = JSON.parse(readFileSync(specification, 'utf8'));
const { game, mode } = expected.protocol;
const budgets = JSON.parse(readFileSync(new URL('../docs/diagnostics/sic-107-4a546a13-20261126/expected-budgets.json',
  import.meta.url))).budgets[game];
const levelActionCaps = budgets.map(budget => budget.actions);
const cap = levelActionCaps.reduce((n, actions) => n + actions, 0);
const options = { observe: true, actionBudget: 1, cap, levelActionCaps, allowStopped: true };
const run = (checkout, revision, label, overrides) =>
  captureNativeCourse(directory, checkout, revision, game, mode, label, { ...options, ...overrides });
const a = await run(reference, base, 'A');
const b = await run(candidate, sha, 'B');
const native = await compareTraces(a.trace, b.trace);
const events = arm => readFileSync(arm.trace, 'utf8').trimEnd().split('\n').map(JSON.parse);
const before = events(a), nominal = events(b);
writeFileSync(join(directory, 'nominal.json'), JSON.stringify({ a, b, native }, null, 2) + '\n', { flag: 'wx' });
const at = (rows, level, turn) => rows.filter(e => e.level === level && e.turn === turn);
const choice = rows => rows.find(e => e.kind === 'decision')?.value;
const outcome = rows => rows.find(e => e.kind === 'native' && e.value.kind === 'actual_outcome')?.value;
const witness = (arm, position) => arm.comparisons.find(e => e.level === position.level && e.levelTurn === position.turn
  && e.receipt.family === expected.governingFamily)?.receipt;
const primary = expected.primaryWitness;
const loci = [primary, expected.replicationWitness];
assert.ok(native.equal, JSON.stringify({ game: native.game, event: native.event, field: native.field }));
assert.equal(a.levels, levelActionCaps.length);
assert.equal(b.levels, levelActionCaps.length);
assert.equal(choice(at(before, primary.level, primary.approachTurn))?.proposal.sicLocalDecision?.strategy, 'P07');
for (const { level, turn } of loci) {
  const rows = at(nominal, level, turn);
  const decision = choice(rows), returned = outcome(rows);
  const comparison = witness(b, { level, turn });
  assert.equal(decision?.proposal.kind, expected.governingFamily);
  assert.equal(decision?.proposal.sicLocalDecision?.strategy, 'P05');
  assert.equal(returned?.reason, expected.expectedNativeReturnWithBudget);
  assert.equal(witness(a, { level, turn }), undefined);
  assert.ok(comparison?.shadow.selected && comparison.reference.selected);
  assert.deepEqual(comparison.shadow.evidence, comparison.reference.evidence);
  assert.equal(comparison.firstDifference, null);
}

const prior = before.findIndex(e => e.level === primary.level && e.turn === primary.turn && e.kind === 'decision');
const stopAfter = before.slice(0, prior + 1).filter(e => e.kind === 'decision').length;
const zero = await run(candidate, sha, 'zero', { actionBudget: 0, stopAfter });
const rejected = witness(zero, primary);
const first = await compareTraces(b.trace, zero.trace);
const zeroRows = at(events(zero), primary.level, primary.turn);
const nominalRows = at(nominal, primary.level, primary.turn);
const fallback = choice(zeroRows);
const actual = outcome(zeroRows);
const result = { base, sha, native, commands: [a.commands.length, b.commands.length],
  loci: loci.map(p => ({ level: p.level, turn: p.turn, receipt: witness(b, p) })),
  zero: { source: zero, first, rejected, fallback, actual, samePacket: JSON.stringify(nominalRows.findLast(e => e.kind === 'observation')?.value)
    === JSON.stringify(zeroRows.findLast(e => e.kind === 'observation')?.value) } };
writeFileSync(join(directory, 'report.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
assert.equal(rejected?.reference.selected, true);
assert.equal(rejected.shadow.selected, false);
assert.equal(rejected.firstDifference, 'selected');
assert.ok(!first.equal && first.level === primary.level && first.turn === primary.turn);
assert.notEqual(fallback?.proposal.kind, expected.governingFamily);
assert.notEqual(actual?.reason, expected.expectedNativeReturnWithBudget);
console.log(JSON.stringify({ game, native, commands: result.commands, contacts: result.loci.map(({ level, turn, receipt }) =>
  ({ level, turn, action: receipt.action, difference: receipt.firstDifference })),
  zero: { level: first.level, turn: first.turn, event: first.event, field: first.field,
    fallback: fallback?.proposal.kind, command: fallback?.command, return: actual?.reason, samePacket: result.zero.samePacket } }));
