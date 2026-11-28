import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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
const { controlEffectReturnMatches } = await import(pathToFileURL(resolve(candidate, 'src/sic/control-effect-child.ts')).href);
const game = 'G50T', familyId = 'sic_verify_remote_replay';
function family(runtime) {
  const found = runtime.families.find(f => f.id === familyId);
  assert.ok(found);
  return found;
}
const capture = (checkout, revision, label, overrides) => captureNativeCourse(directory, checkout, revision,
  game, 'sic', label, { actionBudget: 1, cap: 16, ...overrides });
const inspect = memory => (runtime, operation) => {
  if (operation.type === 'advance' && [4, 5].includes(operation.sequence)) {
    const state = family(runtime).state().state;
    memory[operation.sequence] = { vector: state.controls.ACTION4, evidence: state.controlEvidence.ACTION4 };
  }
};
const a = await capture(reference, base, 'A');
const memory = {};
let physicalProof, rejectedForgery = false;
const b = await capture(candidate, sha, 'B', {
  onReply: inspect(memory),
  configureRuntime(runtime) {
    const producer = family(runtime);
    const record = producer.record.bind(producer);
    producer.record = async (...args) => {
      const result = await record(...args);
      const [before, after, command, , , proposal] = args;
      if (before.revision !== 5 || command.action_ref !== 'ACTION4') return result;
      const child = proposal.controlEffectChild;
      physicalProof = result?.controlEffectReturn;
      const transition = { before, after, command };
      assert.ok(child && physicalProof && controlEffectReturnMatches(child, physicalProof, transition));
      const forged = { ...physicalProof, displacement: [-6, 0], destination: [child.subject.start[0] - 6, child.subject.start[1]] };
      rejectedForgery = !controlEffectReturnMatches(child, forged, transition);
      return result;
    };
  },
});
const events = arm => readFileSync(arm.trace, 'utf8').trimEnd().split('\n').map(JSON.parse);
const before = events(a), after = events(b);
const snapshots = rows => rows.filter(e => e.kind === 'observation').map(e => e.value);
const physical = rows => rows.filter(e => e.kind === 'native' && ['before_guard', 'actual_outcome'].includes(e.value.kind))
  .map(({ level, turn, value }) => [level, turn, value.kind, value.family, value.reason, value.admitted, value.matched]);
const decision = (rows, turn) => rows.find(e => e.kind === 'decision' && e.level === 1 && e.turn === turn)?.value;
const plan = (rows, turn) => rows.find(e => e.kind === 'native' && e.level === 1 && e.turn === turn
  && e.value.kind === 'sic_native_plan')?.value;
const returns = rows => rows.filter(e => e.kind === 'native' && e.value.control_effect_return)
  .map(e => ({ turn: e.turn, result: e.value.control_effect_return }));
const native = await compareTraces(a.trace, b.trace);
assert.deepEqual(a.commands, b.commands);
assert.equal(b.commands.length, 16);
assert.deepEqual(snapshots(before), snapshots(after));
assert.deepEqual(physical(before), physical(after));
assert.equal(native.equal, false);
assert.equal(native.turn, 1);
assert.equal(returns(before).length, 0);
const received = returns(after);
assert.equal(received.length, 6);
assert.equal(received.filter(e => e.result.status === 'observed_translation').length, 4);
assert.equal(received.find(e => e.turn === 1)?.result.status, 'unresolved');
assert.equal(plan(before, 5).controlEffectChild, undefined);
const child = plan(after, 5).controlEffectChild;
assert.equal(child.status, 'awaiting_native_return');
assert.equal(child.actionBudget, 1);
assert.equal(child.opening, decision(after, 5).ticket.observationRef);
assert.equal(child.need.parentObjective, plan(after, 5).need.id);
const fifth = received.find(e => e.turn === 5).result;
assert.deepEqual(fifth, physicalProof);
assert.deepEqual(fifth.displacement, [6, 0]);
assert.equal(fifth.childId, child.need.id);
assert.equal(fifth.parentId, child.need.parentObjective);
assert.equal(fifth.subjectId, child.subject.id);
assert.equal(fifth.beforeRef, child.opening);
assert.equal(fifth.afterRef, decision(after, 6).ticket.observationRef);
assert.equal(memory[4].vector, undefined);
assert.deepEqual(memory[5], { vector: [6, 0], evidence: fifth.afterRef });
assert.equal(decision(after, 6).proposal.sicLocalDecision.strategy, 'P07');
assert.deepEqual(decision(after, 6).proposal.steps[0].expected_after, [26, 8]);
assert.ok(rejectedForgery);

const staleMemory = {};
let interventions = 0;
const stale = await capture(candidate, sha, 'stale', {
  stopAfter: 6, allowStopped: true, onReply: inspect(staleMemory),
  configureRuntime(runtime) {
    const producer = family(runtime);
    const record = producer.record.bind(producer);
    producer.record = (...args) => {
      const [before, , command, , , proposal] = args;
      if (before.revision === 5 && command.action_ref === 'ACTION4' && proposal.controlEffectChild) {
        interventions++;
        args[5] = { ...proposal, controlEffectChild: { ...proposal.controlEffectChild, opening: 'stale' } };
      }
      return record(...args);
    };
  },
});
const altered = events(stale);
assert.equal(interventions, 1);
assert.deepEqual(stale.commands.slice(0, 5), b.commands.slice(0, 5));
assert.deepEqual(snapshots(altered).slice(0, 6), snapshots(after).slice(0, 6));
assert.equal(returns(altered).find(e => e.turn === 5), undefined);
assert.equal(staleMemory[5].vector, undefined);
assert.equal(staleMemory[5].evidence, undefined);
assert.notEqual(decision(altered, 6)?.proposal.sicLocalDecision?.strategy, 'P07');
const summary = { base, sha, commands: b.commands.length, observations: snapshots(after).length, first: native,
  resultCount: received.length, observed: 4, unresolved: 2, fifth, memory, staleMemory, interventions, rejectedForgery };
writeFileSync(join(directory, 'report.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
const { event, level, turn, field } = native;
console.log(JSON.stringify({ commands: summary.commands, observations: summary.observations,
  first: { event, level, turn, field }, results: [summary.observed, summary.unresolved],
  displacement: fifth.displacement, afterRef: fifth.afterRef, interventions, rejectedForgery }));
