import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assets, captureNativeCourse, git } from './sic-native-course.mjs';
import { compareTraces } from './compare-sic-decisions.mjs';

const [reference, candidate, base, sha, output] = process.argv.slice(2);
assert.ok(reference && candidate && /^[a-f0-9]{40}$/.test(base ?? '') && /^[a-f0-9]{40}$/.test(sha ?? '') && output,
  'Pass REFERENCE-CHECKOUT CANDIDATE-CHECKOUT REFERENCE-SHA CANDIDATE-SHA NEW-OUTPUT-DIRECTORY');
assert.equal(process.version, 'v24.22.3');
git(candidate, 'merge-base', '--is-ancestor', base, sha);
git(candidate, 'diff', '--quiet', base, sha, '--', ...assets);
const directory = resolve(output);
mkdirSync(directory);
const cavity = runtime => {
  const family = runtime.families.find(item => item.id === 'sliding_cavity');
  assert.ok(family);
  return family;
};
const events = arm => readFileSync(arm.trace, 'utf8').trimEnd().split('\n').map(JSON.parse);
const decisions = arm => events(arm).filter(e => e.kind === 'decision').map(e => e.value);

async function run(checkout, source, label, removeKey) {
  const views = [];
  let interventions = 0, directions;
  const captured = await captureNativeCourse(directory, checkout, source, 'AS66', 'V6', label, {
    observe: true, actionBudget: 1, cap: 7,
    configureRuntime(runtime) {
      if (removeKey === undefined) return;
      const family = cavity(runtime);
      const propose = family.propose.bind(family);
      family.propose = async (...args) => {
        const [observation] = args;
        if (observation.revision !== 6 || observation.frame_hash !== 'fb4c841eea2f859a') return propose(...args);
        const before = family.state();
        assert.ok(!before.control_questions.attempted.includes(removeKey) && before.directions.ACTION1 === undefined);
        interventions++;
        family.restore({ ...before, control_questions: { ...before.control_questions,
          attempted: [...before.control_questions.attempted, removeKey] } });
        try {
          return await propose(...args);
        } finally {
          const after = family.state();
          family.restore({ ...after, control_questions: { ...after.control_questions,
            attempted: after.control_questions.attempted.filter(question => question !== removeKey) } });
        }
      };
    },
    onReply(runtime, operation) {
      if (operation.observation) views[operation.sequence] = operation.observation;
      if (operation.type === 'advance' && operation.sequence === 6) directions = cavity(runtime).state().directions;
    },
  });
  const changedPixels = views[6].frame.reduce((total, row, y) =>
    total + row.filter((pixel, x) => pixel !== views[5].frame[y][x]).length, 0);
  const [first, next] = decisions(captured).slice(5);
  assert.equal(first.ticket.frameHash, 'fb4c841eea2f859a');
  assert.equal(interventions, removeKey === undefined ? 0 : 1);
  return { ...captured, interventions, directions, changedPixels, frameBefore: first.ticket.frameHash,
    frameAfter: next.ticket.frameHash, available: views[5].availableActionIds };
}

const a = await run(reference, base, 'A');
const b = await run(candidate, sha, 'B');
const key = decisions(b)[5].proposal.support_plan.question_key;
assert.equal(typeof key, 'string');
assert.equal(decisions(a)[5].proposal.support_plan.question_key, key);
const aReduced = await run(reference, base, 'A-sans-1', key);
const bReduced = await run(candidate, sha, 'B-sans-1', key);
const nominal = await compareTraces(a.trace, b.trace);
const reduced = await compareTraces(aReduced.trace, bReduced.trace);
const contrast = await compareTraces(b.trace, bReduced.trace);
const evaluated = (arm, turn) => arm.comparisons.find(row => row.turn === turn && row.receipt.family === 'sliding_cavity')?.receipt;
const descriptions = receipt => receipt.offers.map(({ action, cost, applicability, result }) => [action, cost, applicability, result]);
const tie = evaluated(b, 6), alternate = evaluated(bReduced, 6);
assert.ok(nominal.equal && reduced.equal && nominal.decisions === 7 && reduced.decisions === 7);
assert.deepEqual(descriptions(tie), [['ACTION1', 1, 'applicable', 'selected'], ['ACTION4', 1, 'applicable', 'lower_priority']]);
assert.deepEqual(tie.offers[0].evidence, tie.offers[1].evidence);
assert.deepEqual(descriptions(evaluated(b, 7)), [['ACTION4', 1, 'applicable', 'selected']]);
assert.deepEqual(descriptions(alternate), [['ACTION4', 1, 'applicable', 'selected']]);
assert.deepEqual(alternate.offers[0].evidence, tie.offers[1].evidence);
assert.deepEqual(b.available, bReduced.available);
assert.equal(b.frameBefore, bReduced.frameBefore);
const expectedPrefix = ['ACTION1', 'ACTION2', 'ACTION2', 'ACTION3', 'ACTION2'];
assert.deepEqual(b.commands.map(command => command.actionRef), [...expectedPrefix, 'ACTION1', 'ACTION4']);
assert.deepEqual(bReduced.commands.map(command => command.actionRef), [...expectedPrefix, 'ACTION4', 'ACTION2']);
assert.deepEqual([b.changedPixels, b.frameAfter, b.directions.ACTION1], [80, '9e25d42a95c97b84', [-1, 0]]);
assert.deepEqual([bReduced.changedPixels, bReduced.frameAfter, bReduced.directions.ACTION4], [82, '1d4db55871a6a88a', [0, 1]]);
assert.equal(bReduced.directions.ACTION1, undefined);
assert.equal(decisions(bReduced)[6].proposal.kind, 'sliding_cavity_access');
assert.equal(events(bReduced).find(e => e.level === 2 && e.turn === 2 && e.kind === 'native'
  && e.value.kind === 'actual_outcome')?.value.matched, true);
assert.ok(!contrast.equal && contrast.level === 2 && contrast.turn === 1);
const result = { base, sha, a, b, aReduced, bReduced, nominal, reduced, contrast, tie, alternate };
writeFileSync(join(directory, 'report.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ nominal, reduced, contrast: { level: contrast.level, turn: contrast.turn, event: contrast.event, field: contrast.field },
  changedPixels: [b.changedPixels, bReduced.changedPixels], acquiredDirection: bReduced.directions.ACTION4,
  alternate: bReduced.commands.slice(5), continuationMatched: true }));
