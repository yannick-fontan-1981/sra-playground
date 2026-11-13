import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureLabeledSequence, labeledSequences } from '../src/logos-engine/v6-labeled-sequence-observation.ts';
import { measureOrderedPredicateFeatures, measureLabeledPredicateInduction, labeledSequenceScope,
  labeledSequenceFeatures, inferLabeledSequence } from '../src/logos-engine/v6-labeled-sequence-mechanics.ts';
import { LabeledSequenceMemory, labeledSequenceBefore, labeledSequenceAfter, commonLabeledSequenceProposal,
  bindLabeledSequence } from '../src/logos-engine/v6-labeled-sequence-access.ts';
import { SharedSeriesConstraint, SHARED_SERIES_DIGEST_SCOPE } from '../src/logos-engine/v6-shared-series.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const fixture = JSON.parse(gunzipSync(await readFile(new URL('fixtures/v6-labeled-sequence-reference.json.gz', import.meta.url))).toString()) as R;
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const restored = (events: readonly R[] = []): LabeledSequenceMemory => {
  const memory = new LabeledSequenceMemory(); for (const event of events) memory.applyEvent(clone(event)); return memory;
};
const configuration = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`, root), 'utf8')).declarations[0].configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall;

test('labeled reference pins unchanged source and distinguishes isolated component, full family and caller selection', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false);
  assert.equal(fixture.qualification.gameHostRunByExporter, false);
  assert.match(fixture.qualification.commonEnvelope, /True ObservedCompositionConstraint/);
  assert.match(fixture.qualification.mechanics, /FIT\/PREDICT\/PARTITION/);
  const probe = JSON.parse(gunzipSync(await readFile(new URL(fixture.originalPublicProbe.path, root))).toString()) as R;
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  for (const item of [fixture, probe]) {
    for (const [path, expected] of Object.entries(item.sourceHashes)) {
      assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), expected, path);
      assert.equal(manifest.files[path].sha256, expected, path);
    }
    assert.equal(hash(await readFile(new URL(item.generator, root))), item.generatorSha256);
  }
  assert.equal(hash(await readFile(new URL(fixture.originalPublicProbe.path, root))), fixture.originalPublicProbe.sha256);
  for (const item of fixture.mixedEnvelopeInputs) assert.equal(hash(await readFile(new URL(item.path, root))), item.sha256);
  for (const [name, expected] of Object.entries(probe.gameAssetHashes)) assert.equal(hash(await readFile(new URL(`public/python/${name}`, root))), expected, name);
  assert.ok(fixture.sourceMro.indexOf('CellPlacementAccess') < fixture.sourceMro.indexOf('LabeledSequenceAccess'));
  assert.ok(fixture.sourceMro.indexOf('LabeledSequenceAccess') < fixture.sourceMro.indexOf('ProductPanelAccess'));
  assert.equal(probe.targetLevels, 6); assert.equal(probe.status, 'stopped'); assert.equal(probe.reason, 'labeled_component_abstained');
  assert.equal(probe.actions, 40); assert.equal(probe.levelsCompleted, 5); assert.equal(probe.sessionCount, 1);
  assert.equal(probe.manualPrimingActions, 0); assert.equal(probe.sourceModified, false); assert.equal(probe.state, 'NOT_FINISHED');
  assert.match(probe.scope, /not original full common caller/);
  assert.deepEqual(probe.boundaries.map((value: R) => value.levelActions), [8, 8, 8, 8, 8]);
  assert.equal(probe.packets.length, 41); assert.equal(probe.prefixes.length, 40);
  assert.ok(probe.prefixes.every((value: R) => value.proposal.actions.length === 1), 'Only the current query is submitted');
  assert.ok(probe.prefixes.every((value: R) => value.steps[0].outcome.seal_prefix === true), 'Each unknown physical receipt seals its prefix');
});

for (const c of fixture.cases as R[]) test(`Python ↔ TypeScript labeled sequence: ${c.id}`, async () => {
  const a = c.arguments, scene = a.scene ? fixture.scenes[a.scene] : null, memory = restored(a.ownEvents);
  const beforeState = memory.currentState(), proposal = a.proposal ? clone(fixture.plans[a.proposal]) : null;
  let actual: any;
  switch (c.operation) {
    case 'measure': actual = measureLabeledSequence(scene.rows, clone(a.priorControls)); break;
    case 'sequences': actual = labeledSequences(clone(a.frame), clone(a.solids)); break;
    case 'scope': actual = labeledSequenceScope(clone(a.observation), clone(a.measured), a.operation); break;
    case 'features': actual = labeledSequenceFeatures(clone(a.words), clone(a.queries), clone(a.measured), clone(a.observation), 300000, () => 0); break;
    case 'infer': actual = inferLabeledSequence(clone(a.measured), clone(a.observation), 300000, clone(a.cfg), clone(a.prior), () => 0); break;
    case 'ordered': case 'induction': {
      const invoke = () => c.operation === 'ordered' ? measureOrderedPredicateFeatures(clone(a.request), () => 0)
        : measureLabeledPredicateInduction(clone(a.request), () => 0);
      if (c.expected?.rejected) { assert.throws(invoke); return; }
      actual = invoke(); break;
    }
    case 'propose':
      actual = memory.proposeLabeled(clone(scene.observation), clone(scene.rows), [], a.remaining,
        { ...clone(a.policy), remaining_level_actions: a.remaining }, 300000, () => 0);
      assert.deepEqual(memory.currentState(), beforeState, 'A proposed classification acquires no labeled receipt'); break;
    case 'common_propose': {
      const invoke = () => commonLabeledSequenceProposal(memory, clone(scene.observation), clone(scene.rows), [], a.remaining,
        clone(a.policy), a.deadlinePresent ? 300000 : null, () => 0);
      if (c.expected?.rejected) { await assert.rejects(invoke); return; }
      actual = await invoke(); assert.deepEqual(memory.currentState(), beforeState); break;
    }
    case 'bind': {
      const domain = new ObservedInputDomain(4096); if (a.observed) domain.candidates(scene.observation);
      bindLabeledSequence(proposal!, domain); actual = proposal; break;
    }
    case 'before': actual = labeledSequenceBefore({ ...proposal!, ...clone(a.patch) }, a.index, clone(scene.rows), clone(a.meta)); break;
    case 'after': actual = labeledSequenceAfter(proposal!, a.index, clone(fixture.scenes[a.before].rows), clone(fixture.scenes[a.after].rows), clone(a.meta)); break;
    case 'record': {
      const before = fixture.scenes[a.before], after = fixture.scenes[a.after];
      if (a.passive) delete proposal!.labeled_sequence_plan;
      const inputs = [clone(before.observation), clone(a.command), clone(after.observation), clone(before.rows), clone(after.rows), proposal!, a.index] as const;
      const unchanged = clone(inputs), events = memory.record(...inputs);
      assert.deepEqual(inputs, unchanged);
      assert.equal(c.expected.sourceParentRecordCalls, 1, 'Source labeled record first calls its actual Product ancestor');
      assert.deepEqual(events, c.expected.events);
      assert.deepEqual(memory.currentState(), c.expected.state.projection);
      assert.equal(memory.retainedDigest(c.expected.state.parentDigest), c.expected.state.digest);
      assert.deepEqual(restored(memory.currentState().labeled_events).currentState(), memory.currentState());
      return;
    }
    case 'shared_before': case 'shared_after': case 'shared_bind': {
      const family = new SharedSeriesConstraint(recallPolicy), first = fixture.scenes[a.before], second = fixture.scenes[a.after];
      const value = clone(a.proposalValue);
      const invoke = () => {
        if (c.operation === 'shared_before') return family.before(value, a.index, first.public, first.observation);
        if (c.operation === 'shared_after') return family.after(value, a.index, first.observation, second.observation, first.rows, second.rows);
        const domain = new ObservedInputDomain(4096); domain.candidates(first.observation);
        family.bind(value, domain); return value;
      };
      if (c.expected?.rejected) { assert.throws(invoke); return; }
      actual = invoke(); break;
    }
    default: throw new Error(`Unrecognized labeled operation ${c.operation}`);
  }
  assert.deepEqual(actual, c.expected);
});

test('all 40 true CombinedObservedCompositionMemory acquisitions match the shared journal and boundary recall', async () => {
  const family = new SharedSeriesConstraint(recallPolicy), domain = new ObservedInputDomain(4096);
  assert.deepEqual(family.state().events, []);
  let transitions = 0, official = 0, checkpoints = 0;
  for (const envelope of fixture.commonEnvelopes as R[]) {
    const view = fixture.scenes[`public:${envelope.beforeIndex}`], inputs = domain.candidates(view.observation);
    const proposal = await family.labeledPropose(view.observation, view.rows, inputs, envelope.remaining, fixture.policy, 300000, () => 0);
    assert.deepEqual(proposal, envelope.proposal);
    family.bind(proposal!, domain); assert.deepEqual(proposal, envelope.boundProposal);
    for (const item of envelope.steps as R[]) {
      const before = fixture.scenes[`public:${item.actionIndex - 1}`], after = fixture.scenes[`public:${item.actionIndex}`];
      assert.deepEqual(family.before(proposal!, item.index, before.public, before.observation), item.beforeGuard);
      assert.deepEqual(family.after(proposal!, item.index, before.observation, after.observation, before.rows, after.rows), item.outcome);
      const result = family.record(before.observation, after.observation, proposal!.actions[item.index], before.rows, after.rows, proposal!, item.index, after.public.frame_packet);
      assert.deepEqual(result, item.record, 'Complete actual source family acquisition envelope, including inherited records');
      assert.deepEqual(family.state().events, item.state.events, 'Complete supported journal equals the true original family envelope');
      assert.deepEqual(family.labeled.currentState(), item.labeledState.projection);
      const boundary = result.status === 'official_boundary_witness';
      if (item.actionIndex <= 2 || boundary) {
        const checkpoint = family.state(), rebuilt = new SharedSeriesConstraint(recallPolicy);
        rebuilt.restore(clone(checkpoint)); assert.deepEqual(rebuilt.state(), checkpoint);
        assert.deepEqual(rebuilt.labeled.currentState(), family.labeled.currentState());
        assert.notEqual(checkpoint.digest, item.state.digest, 'Native digest closure remains explicitly narrower than full source inheritance');
        checkpoints++;
      }
      transitions++; official += Number(boundary);
    }
  }
  assert.equal(transitions, 40); assert.equal(official, 5); assert.equal(checkpoints, 7);
  assert.equal(family.labeled.currentState().labeled_events.length, 40);
  assert.match(SHARED_SERIES_DIGEST_SCOPE, /labeled_sequence/);
  const checkpoint = family.state(), tampered = clone(checkpoint);
  tampered.events.find((event: R) => event.kind === 'labeled_sequence_submission').cache.context_ref = 'forged-context';
  assert.throws(() => family.restore(tampered), /changed during recall/);
  assert.deepEqual(family.state(), checkpoint, 'Rejected recall does not partially replace acquired memory');
});

test('labeled acquisition owns payloads and changes revision only on retained actual events', () => {
  const event = clone(fixture.cases.find((item: R) => item.id === 'record:stationary').expected.events[0]);
  const memory = new LabeledSequenceMemory(); memory.applyEvent(event);
  const retained = memory.currentState(), digest = memory.retainedDigest('ancestor'), revision = memory.nativeRevision;
  event.cache.controls[0].point[0] += 100; retained.labeled_cache!.controls[0].label = 999; retained.labeled_events.length = 0;
  assert.equal(memory.retainedDigest('ancestor'), digest); assert.equal(memory.nativeRevision, revision);
  assert.throws(() => memory.applyEvent({ kind: 'foreign' }), /Outside labeled-sequence/);
  assert.equal(memory.nativeRevision, revision);
});

test('the source refuses the sixth observed panel when its declared atomic grammar has no compatible law', () => {
  const value = fixture.cases.find((item: R) => item.id === 'infer:last_unresolved_query').expected;
  assert.equal(value.induction.status, 'COMPLETE'); assert.equal(value.induction.cause, 'MODEL_CONTRADICTION');
  assert.deepEqual(value.induction.values.observation_compatible_version_space, []);
  assert.equal(value.induction.values.robust_answer_and_submission_agreement, false);
  assert.equal(value.induction.values.unique_law_proved, false);
  assert.deepEqual(fixture.cases.find((item: R) => item.id === 'public:final_own_abstention').expected,
    { status: 'abstained', reason: 'labeled_predicate_domain_has_no_unique_current_answer' });
});

test('agreement, complete descriptive features and physical authorization remain distinct source contracts', () => {
  const falseReady = fixture.cases.find((item: R) => item.id === 'induction:false_submission_agrees_descriptively').expected;
  assert.equal(falseReady.values.robust_answer_and_submission_agreement, true);
  assert.equal(falseReady.values.label_predictions[0].submission_precondition, false);
  assert.equal(falseReady.values.classification_submission_authorized, false);
  assert.equal(falseReady.descriptive_facts.primitive_release_authorized, false);
  const unknownPairs = fixture.cases.find((item: R) => item.id === 'ordered:pair_rows_with_unknown_remain_descriptive_complete').expected;
  assert.equal(unknownPairs.status, 'COMPLETE');
  assert.ok(unknownPairs.values.model_feature_rows[0].features[0].value.some((row: R) => row.equal === null));
  assert.equal(unknownPairs.values.assigned_class_label, null);
});

test('both mechanical algorithms expose actual time interruption without a complete or authorized receipt', () => {
  for (const [id, method] of [['ordered:complete', measureOrderedPredicateFeatures], ['induction:complete', measureLabeledPredicateInduction]] as const) {
    const request = clone(fixture.cases.find((item: R) => item.id === id).arguments.request);
    let tick = 0;
    const result = method({ ...request, time_bound_ms: 1 }, () => tick++);
    assert.equal(result.status, 'NEEDS_EVIDENCE'); assert.equal(result.cause, 'TIME_BOUND');
    assert.equal(result.domain_complete, false); assert.equal(result.descriptive_facts.primitive_release_authorized, false);
  }
});
