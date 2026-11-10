import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { FeedbackSequences } from '../src/logos-engine/v6-feedback-sequences.ts';
import { chooseFeedbackTrial } from '../src/logos-engine/v6-feedback-sequences-finite.ts';
import { initialFeedbackLayout, feedbackPalette } from '../src/logos-engine/v6-feedback-sequences-visual.ts';
import { ObservedInputDomain, measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-feedback-sequences-reference.json.gz', import.meta.url))).toString('utf8'));
const root = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test('FeedbackSequences oracle pins the unchanged V6 family and consumed V5 sources', async () => {
  for (const [name, expected] of Object.entries(fixture.provenance.sources) as [string, { bytes: number; sha256: string }][]) {
    const bytes = await readFile(new URL(name, root));
    assert.equal(bytes.length, expected.bytes, name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, name);
  }
  assert.match(fixture.provenance.scope, /not router\/game parity/);
});

for (const row of fixture.finite) test(`V5 ordered feedback discrimination matches the original: ${row.id}`, () => {
  const a = row.arguments;
  assert.deepEqual(chooseFeedbackTrial(a.alphabet, a.length, a.prefix, a.history, a.revealed, a.repeatable, a.observation, a.budget, a.configuration), row.expected);
});

test('two source-observed discriminating returns produce different justified next trials', () => {
  const [left, right] = fixture.finite.filter((x: any) => x.id.startsWith('discriminating-public-return-'));
  assert.notDeepEqual(left.arguments.history, right.arguments.history);
  assert.notDeepEqual(left.expected.trial, right.expected.trial);
  for (const row of [left, right]) {
    const a = row.arguments, result = chooseFeedbackTrial(a.alphabet, a.length, a.prefix, a.history, a.revealed, a.repeatable, a.observation, a.budget, a.configuration);
    assert.equal(result.status, 'proposed');
    assert.deepEqual(result.evidence, ['public-feedback-1']);
    assert.deepEqual(result.trial, row.expected.trial);
  }
});

for (const row of fixture.initial) test(`original public interface recognition and acquisition: ${row.id}`, async () => {
  const family = new FeedbackSequences();
  assert.deepEqual(await measureNativeObservation(row.public, row.public.step_index, 'original-feedback-synthetic'), row.observation);
  assert.deepEqual(initialFeedbackLayout(row.observation), row.layout);
  assert.deepEqual(feedbackPalette(row.observation, row.layout), row.palette);
  assert.deepEqual(await family.propose(row.observation, row.public.frame_rows, row.inputs, 80), row.proposal);
  assert.deepEqual(family.state(), row.state);
});

for (const session of fixture.sessions) test(`source acquisition, conditional prefix and response history: ${session.id}`, async () => {
  const family = new FeedbackSequences();
  for (const [index, row] of session.steps.entries()) {
    const label = `${session.id} primitive ${index}`;
    assert.deepEqual(family.state(), row.stateBefore, `${label} starts from retained acquired state`);
    const restored = new FeedbackSequences();
    restored.restore(clone(family.state()));
    const proposal = await family.propose(row.beforeObservation, row.beforePublic.frame_rows, row.inputs, row.remaining);
    assert.deepEqual(proposal, row.proposal, `${label} proposal`);
    assert.deepEqual(await restored.propose(row.beforeObservation, row.beforePublic.frame_rows, row.inputs, row.remaining), proposal, `${label} restored decision`);
    assert.deepEqual(family.state(), row.stateAfterPropose, `${label} proposal state`);
    if (!row.command) continue;
    if (proposal) {
      const domain = new ObservedInputDomain(250);
      assert.deepEqual(domain.candidates(row.beforeObservation), row.inputs, `${label} public inputs`);
      await family.bind(proposal, domain);
      assert.deepEqual(proposal, row.boundProposal, `${label} point bindings`);
      assert.deepEqual(family.before(proposal, 0, row.beforePublic, row.beforeObservation), row.beforeGuard, `${label} current guards`);
      if (row.afterGuard) assert.deepEqual(family.after(proposal, 0, row.beforeObservation, row.afterObservation, row.beforePublic.frame_rows, row.afterPublic.frame_rows), row.afterGuard, `${label} response guards`);
    }
    assert.deepEqual(await family.record(row.beforeObservation, row.afterObservation, row.command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, row.passive ? undefined : proposal ?? undefined, 0), row.record, `${label} source acquisition`);
    assert.deepEqual(family.state(), row.stateAfter, `${label} retained evidence`);
  }
  if (!session.id.startsWith('passive-')) {
    const statuses = session.steps.map((x: any) => x.record?.status);
    assert.ok(statuses.includes('observed_submission_feedback'), 'a measured submission must influence the next source decision');
    assert.ok(session.steps.some((x: any) => x.proposal?.feedback_plan?.selection?.evidence?.length), 'the next decision cites actual feedback');
  }
});

for (const row of fixture.records) test(`source feedback refusal, scope and evidence restoration: ${row.id}`, async () => {
  const family = new FeedbackSequences();
  family.restore(clone(row.stateBefore));
  if (row.methodOnlyState) {
    const recalled = new FeedbackSequences();
    recalled.restore(clone(row.methodOnlyState));
    assert.equal(recalled.state().layout, null);
    assert.ok(recalled.state().entry_method);
    assert.deepEqual(await recalled.propose(row.beforeObservation, row.beforePublic.frame_rows, row.recalledInputs, 80), row.proposal);
    assert.deepEqual(recalled.state(), row.stateAfterRecallPropose);
  }
  assert.deepEqual(await family.record(row.beforeObservation, row.afterObservation, row.command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, row.proposal ?? undefined, 0), row.record);
  assert.deepEqual(family.state(), row.stateAfter);
  const restored = new FeedbackSequences();
  restored.restore(clone(family.state()));
  assert.deepEqual(restored.state(), row.stateAfter);
  if (row.nextInputs) {
    const next = await family.propose(row.afterObservation, row.afterPublic.frame_rows, row.nextInputs, row.nextRemaining);
    assert.deepEqual(next, row.nextProposal);
    assert.deepEqual(await restored.propose(row.afterObservation, row.afterPublic.frame_rows, row.nextInputs, row.nextRemaining), next);
    assert.deepEqual(family.state(), row.stateAfterNext);
  }
});

for (const row of fixture.guards.cases) test(`original current-interface guard: ${row.id}`, async () => {
  const context = fixture.guards, family = new FeedbackSequences();
  family.restore(clone(context.stateBefore));
  const current = fixture.sessions.flatMap((s: any) => s.steps).find((x: any) => x.beforeObservation.observation_ref === context.observation.observation_ref);
  assert.ok(current, 'guard source observation belongs to the acquired public session');
  const proposal = await family.propose(context.observation, current.beforePublic.frame_rows, context.inputs, context.remaining);
  assert.deepEqual(proposal, context.proposal);
  assert.ok(proposal);
  assert.deepEqual(family.before(proposal, 0, row.public, context.observation), row.expected);
  assert.equal(row.expected.admitted, row.id === 'current');
});

test('source memory excludes caches and rejects unknown persisted owner fields', () => {
  const family = new FeedbackSequences();
  assert.throws(() => family.restore({ unexpected: true }), /Unknown memory field/);
  assert.ok(!('last_diagnostic' in family.state()));
});
