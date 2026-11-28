import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assets, captureNativeCourse, git } from './sic-native-course.mjs';
import { compareTraces } from './compare-sic-decisions.mjs';

const base = '0aef4289e97ce094782dfd03f5a79ace6eae5fd2';
const [reference, candidate, sha, output, variant] = process.argv.slice(2);
assert.ok(reference && candidate && /^[a-f0-9]{40}$/.test(sha ?? '') && output
  && (variant === undefined || variant === '--active'),
  'Pass REFERENCE-CHECKOUT CANDIDATE-CHECKOUT CANDIDATE-SHA NEW-OUTPUT-DIRECTORY [--active]');
assert.equal(process.version, 'v24.22.3');
const directory = resolve(output);
mkdirSync(directory);

git(candidate, 'merge-base', '--is-ancestor', base, sha);
git(candidate, 'diff', '--quiet', base, sha, '--', ...assets);
const capture = (...args) => captureNativeCourse(directory, ...args);

let failed = false;
for (const [game, mode] of [['AS66', 'V6'], ['G50T', 'sic']]) {
  const a = await capture(reference, base, game, mode, 'A');
  const b = await capture(candidate, sha, game, mode, 'B', { observe: true, actionBudget: variant === '--active' ? 1 : undefined });
  const native = await compareTraces(a.trace, b.trace);
  const observed = b.comparisons.map(({ turn, receipt }) => ({
    turn, observation: receipt.observationRef, family: receipt.family, action: receipt.action, reference: receipt.reference.selected,
    shadow: receipt.shadow.selected, difference: receipt.firstDifference,
    sameEvidence: JSON.stringify(receipt.reference.evidence) === JSON.stringify(receipt.shadow.evidence),
  }));
  const result = { game, mode, cap: a.cap, a, b, native, observed };
  writeFileSync(join(directory, game + '.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  const { equal, event, level, turn, kind, field, events, decisions } = native;
  console.log(JSON.stringify({ game, mode, native: { equal, event, level, turn, kind, field, events, decisions },
    shadow: observed }));
  const registered = game === 'AS66'
    ? observed.length === 2 && observed.every((x, i) =>
        x.family === 'sliding_cavity' && x.action === ['ACTION1', 'ACTION4'][i]
        && x.observation.includes(':revision:' + (6 + i) + ':'))
    : JSON.stringify(observed.map(x => x.turn)) === '[1,2,3,4,5,9]'
      && observed.every(x => x.family === 'sic_verify_remote_replay');
  failed ||= !native.equal || native.decisions !== a.cap || observed.some(x => !x.reference || !x.shadow || !x.sameEvidence || x.difference !== null)
    || !registered;
}

if (variant === '--active') {
  const one = await capture(candidate, sha, 'G50T', 'sic', 'local-one', { observe: true, cap: 1, actionBudget: 1 });
  const zero = await capture(candidate, sha, 'G50T', 'sic', 'local-zero', { observe: true, cap: 1, actionBudget: 0 });
  const records = trace => {
    const rows = readFileSync(trace, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const { value: decision } = rows.find(row => row.kind === 'decision');
    const guard = rows.find(row => row.kind === 'native' && row.value.kind === 'before_guard').value;
    const returned = rows.find(row => row.kind === 'native' && row.value.kind === 'actual_outcome').value;
    return { owner: guard.family, strategy: decision.proposal.sicLocalDecision?.strategy,
      command: decision.command, guard: guard.reason, admitted: guard.admitted, returned: returned.reason,
      matched: returned.matched, observations: rows.filter(row => row.kind === 'observation').map(row => row.value) };
  };
  const a = records(one.trace), b = records(zero.trace);
  const first = await compareTraces(one.trace, zero.trace);
  const result = { one, zero, first, before: a, after: b };
  writeFileSync(join(directory, 'budget-zero.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  assert.deepEqual(a.command, { actionRef: 'ACTION1', data: {} });
  assert.deepEqual(b.command, a.command);
  assert.deepEqual(a.observations, b.observations);
  assert.deepEqual([a.owner, b.owner], ['sic_verify_remote_replay', 'sic_public_input_exploration']);
  assert.equal(a.strategy, 'P05');
  assert.ok(a.admitted && b.admitted);
  assert.deepEqual([a.guard, b.guard], ['current_replay_and_carrier_bound', 'current_public_input_bound']);
  assert.deepEqual([a.returned, b.returned], ['compare_replayed_motion_and_remote_return', 'observed_public_input_return']);
  assert.deepEqual([a.matched, b.matched], [null, null]);
  assert.equal(one.comparisons[0]?.receipt.firstDifference, null);
  assert.equal(zero.comparisons[0]?.receipt.firstDifference, 'selected');
  assert.equal(zero.comparisons[0]?.receipt.shadow.selected, false);
  assert.deepEqual(first, { equal: false, game: 'G50T', level: 1, turn: 1, event: 2, kind: 'native',
    field: '/value/family', before: a.owner, after: b.owner });
  const compact = ({ owner, strategy, guard, returned }) => ({ owner, strategy, guard, returned });
  const { event, level, turn, field } = first;
  console.log(JSON.stringify({ budgetZero: { event, level, turn, field, before: compact(a), after: compact(b),
    command: a.command, physicalParity: true } }));
}
process.exitCode = Number(failed);
