import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPhaseCycleDecision } from '../src/sic/phase-cycle-child.ts';

const folder = process.argv[2];
if (!folder) throw Error('Expected the directory of the six DC22 replay receipts');

function rows(file) {
  return readFileSync(join(folder, file + '.jsonl'), 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
}

function read(arm) {
  const receipts = rows(arm);
  assert.equal(receipts.length, 1);
  const [result] = receipts;
  assert.equal(result.code, 'DC22');
  assert.equal(result.target, 4);
  assert.equal(result.mode, 'sic');
  assert.equal(result.parallelWorkers, 1);
  assert.equal(result.authority, result.actions);
  assert.equal(result.effects.length, result.actions);
  const trace = rows(arm + '-phase');
  const at = (event, revision) => trace.find(row => row.event === event && row.revision === revision);
  return { result, at, trace };
}

const base = read('base');
const nominal = read('active');
const switchedOff = read('off');
assert.deepEqual(switchedOff.result.effects, base.result.effects);
assert.deepEqual(switchedOff.result.levelStats.map(level => level.prefixHash), base.result.levelStats.map(level => level.prefixHash));
assert.ok(switchedOff.trace.every(row => !row.phaseCycle));
assert.equal(nominal.result.levels, 4);
assert.equal(nominal.result.actions, 187);
assert.deepEqual(nominal.result.effects, base.result.effects);
assert.deepEqual(nominal.result.levelStats.map(level => level.prefixHash), base.result.levelStats.map(level => level.prefixHash));
assert.deepEqual(nominal.result.levelStats.map(level => level.budget), base.result.levelStats.map(level => level.budget));

const first = nominal.at('authorize', 112);
const closing = nominal.at('return', 125);
const resume = nominal.at('authorize', 126);
const resumeReturn = nominal.at('return', 126);
assert.equal(base.at('authorize', 112).need.kind, 'reach_target_on_observed_support_phases');
assert.equal(first.need.kind, 'measure_support_phase_cycle');
assert.equal(first.checkpoint.status, 'open');
assert.equal(first.checkpoint.opening, first.observation);
assert.equal(first.phaseCycle.actionBudget, 12);
assert.equal(first.need.parentObjective, resume.need.id);
assert.equal(nominal.at('return', 112).checkpoint.status, 'assigned');
assert.equal(closing.checkpoint.status, 'satisfied');
assert.equal(closing.outcome.reason, 'support_phase_measured');
const proof = closing.checkpoint.closure;
assert.equal(proof.need.id, closing.need);
assert.deepEqual(closing.command.data, { x: 56, y: 28 });
assert.equal(proof.beforeRef, nominal.at('authorize', 125).observation);
assert.equal(proof.afterRef, closing.outcome.after);
assert.equal(proof.afterRef, resume.observation);
assert.equal(resume.prerequisite, proof.need.id);
assert.equal(resume.admitted, true);
assert.equal(resume.command.action_ref, 'ACTION2');
assert.equal(resume.dependencies.length, 2);
assert.ok(resume.dependencies.every(item => item.status === 'satisfied'));
assert.deepEqual(resume.phaseCycle.closures.at(-1), proof);
assert.deepEqual(resumeReturn.checkpoint.links, resume.phaseCycle.closures.map(closure => ({ relation: 'requires', target: closure.need.id })));
assert.equal(resumeReturn.outcome.reason, 'landing_on_phase_support_confirmed');

function samePrefix(variant) {
  assert.deepEqual(variant.result.effects.slice(0, 125), nominal.result.effects.slice(0, 125));
  assert.deepEqual(variant.result.levelStats.slice(0, 3).map(level => level.prefixHash),
    nominal.result.levelStats.slice(0, 3).map(level => level.prefixHash));
}

const reopened = read('reopen');
samePrefix(reopened);
const retry = reopened.at('authorize', 126);
const retryReturn = reopened.at('return', 126);
assert.deepEqual(reopened.at('reopen', 126).closed, [true, false]);
assert.equal(retry.observation, resume.observation);
assert.equal(retry.admitted, true);
assert.equal(retry.command.action_ref, 'ACTION6');
assert.deepEqual(retry.command.data, { x: 56, y: 28 });
assert.equal(retry.phaseCycle.kind, 'measure');
assert.equal(retry.need.id, proof.need.id);
assert.equal(retry.checkpoint.status, 'open');
assert.equal(retry.checkpoint.closure, null);
assert.equal(retryReturn.outcome.reason, 'support_phase_measured');
assert.equal(retryReturn.checkpoint.status, 'assigned');

const denied = [];
for (const arm of ['wrong-control', 'stale']) {
  const variant = read(arm);
  samePrefix(variant);
  const injection = variant.at(arm, 126);
  const decision = variant.at('authorize', 126);
  assert.equal(injection.original.afterRef, proof.afterRef);
  assert.notEqual(injection.replacement.afterRef, proof.afterRef);
  const restoredShape = readPhaseCycleDecision({ kind: 'resume',
    closures: [resume.phaseCycle.closures[0], { ...injection.original, ...injection.replacement }],
  }, decision.need, { observation_ref: decision.observation, revision: decision.revision }, decision.command);
  assert.equal(restoredShape?.kind, 'resume');
  assert.equal(decision.observation, resume.observation);
  assert.equal(decision.command.action_ref, 'ACTION2');
  assert.equal(decision.admitted, false);
  assert.equal(decision.guard, 'phase_cycle_prerequisite_unattested');
  assert.equal(variant.at('return', 126), undefined);
  assert.equal(variant.result.authority, 125);
  assert.equal(variant.result.reason, 'no_admissible_prefix');
  denied.push({ arm, proposed: decision.command.action_ref, guard: decision.guard,
    replacement: injection.replacement, authorizedCommands: variant.result.authority });
}

console.log(JSON.stringify({
  base: 'b0574d0d45d3253c38fd6a72e52074874b6a0da6', game: 'DC22',
  nominal: { sameCommandsAndEffects: 187, completed: 4, optionOffIdentical: true, prefixHashes: nominal.result.levelStats.map(level => level.prefixHash) },
  firstChange: { level: 4, turn: 1, need: first.need.id, parent: first.need.parentObjective,
    statusBeforeTicket: first.checkpoint.status, command: first.command, budget: first.phaseCycle.actionBudget },
  closing: { level: 4, turn: 14, status: closing.checkpoint.status, control: proof.control,
    need: proof.need.id, beforeRef: proof.beforeRef, afterRef: proof.afterRef },
  resume: { level: 4, turn: 15, command: resume.command, prerequisite: resume.prerequisite,
    requires: resumeReturn.checkpoint.links.map(link => link.target), observed: resumeReturn.outcome.reason },
  variants: { commonCommands: 125, reopened: { command: retry.command, measureBudget: retry.phaseCycle.actionBudget,
    observed: retryReturn.outcome.reason, finalStatus: reopened.result.reason, authorizedCommands: reopened.result.authority }, denied },
}, null, 2));
