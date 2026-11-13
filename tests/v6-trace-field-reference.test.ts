import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureTraceField, traceFieldCenter, traceFieldRingMatches } from '../src/logos-engine/v6-trace-field-observation.ts';
import { constructTraceField, measureSingleVisitResidual } from '../src/logos-engine/v6-trace-field-mechanics.ts';
import { TraceFieldMemory, traceFieldBefore, traceFieldAfter, localTraceEffect, traceFieldCommand,
  commonTraceFieldProposal, bindTraceField } from '../src/logos-engine/v6-trace-field-access.ts';
import { SharedSeriesConstraint, SHARED_SERIES_DIGEST_SCOPE } from '../src/logos-engine/v6-shared-series.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const fixture = JSON.parse(gunzipSync(await readFile(new URL('fixtures/v6-trace-field-reference.json.gz', import.meta.url))).toString()) as R;
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const restored = (events: readonly R[] = []): TraceFieldMemory => {
  const memory = new TraceFieldMemory(); for (const event of events) memory.applyEvent(clone(event)); return memory;
};
const configuration = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`, root), 'utf8')).declarations[0].configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall;

test('trace reference pins unchanged source, the target-six attempt and its explicit four-level result', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false);
  assert.equal(fixture.qualification.gameHostRunByExporter, false);
  assert.match(fixture.qualification.commonEnvelope, /True ObservedCompositionConstraint/);
  assert.match(fixture.qualification.commonEnvelope, /not original full common caller/);
  assert.match(fixture.qualification.mechanics, /EVALUATE\/PROPAGATE/);
  const probe = JSON.parse(gunzipSync(await readFile(new URL(fixture.originalPublicProbe.path, root))).toString()) as R;
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  for (const item of [fixture, probe]) {
    assert.equal(item.pinnedSourceFilesVerifiedBeforeImport, Object.keys(manifest.files).length);
    for (const [path, expected] of Object.entries(item.sourceHashes)) {
      assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), expected, path);
      assert.equal(manifest.files[path].sha256, expected, path);
    }
    assert.equal(hash(await readFile(new URL(item.generator, root))), item.generatorSha256);
  }
  assert.equal(hash(await readFile(new URL(fixture.originalPublicProbe.path, root))), fixture.originalPublicProbe.sha256);
  for (const [name, expected] of Object.entries(probe.gameAssetHashes)) assert.equal(hash(await readFile(new URL(`public/python/${name}`, root))), expected, name);
  assert.ok(fixture.sourceMro.indexOf('CellPlacementAccess') < fixture.sourceMro.indexOf('TraceFieldAccess'));
  assert.ok(fixture.sourceMro.indexOf('TraceFieldAccess') < fixture.sourceMro.indexOf('LabeledSequenceAccess'));
  assert.equal(probe.targetLevels, 6); assert.equal(probe.status, 'stopped'); assert.equal(probe.reason, 'trace_component_abstained');
  assert.equal(probe.actions, 53); assert.equal(probe.levelsCompleted, 4); assert.equal(probe.sessionCount, 1);
  assert.equal(probe.manualPrimingActions, 0); assert.equal(probe.resets, 0); assert.equal(probe.levelJumps, 0);
  assert.equal(probe.sourceModified, false); assert.equal(probe.state, 'NOT_FINISHED');
  assert.deepEqual(probe.boundaries.map((value: R) => value.levelActions), [8, 15, 15, 15]);
  assert.equal(probe.packets.length, 54); assert.equal(probe.prefixes.length, 12);
  assert.equal(probe.requests.length, 54); assert.equal(probe.requests.filter((r: R) => r.type === 'load').length, 1);
  assert.ok(probe.requests.slice(1).every((r: R) => r.type === 'action'));
  assert.deepEqual(probe.prefixes.map((p: R) => p.steps.length), [1, 1, 6, 1, 1, 13, 1, 1, 13, 1, 1, 13]);
});

for (const c of fixture.cases as R[]) test(`Python ↔ TypeScript trace field: ${c.id}`, async () => {
  const a = c.arguments, scene = a.scene ? fixture.scenes[a.scene] : null, memory = restored(a.ownEvents);
  const beforeState = memory.currentState(), proposal = a.proposal ? clone(fixture.plans[a.proposal]) : null;
  let actual: any;
  switch (c.operation) {
    case 'measure': actual = measureTraceField(clone(scene.rows), clone(a.retainedGeometry)); break;
    case 'center': actual = traceFieldCenter(clone(a.geometry), clone(a.cell)); break;
    case 'command': actual = traceFieldCommand(clone(a.geometry), clone(a.cell)); break;
    case 'ring': actual = traceFieldRingMatches(clone(scene.rows), clone(a.geometry), clone(a.mark), clone(a.cell)); break;
    case 'effect': actual = localTraceEffect(clone(a.measured), clone(a.source), clone(a.target),
      clone(fixture.scenes[a.before].rows), clone(fixture.scenes[a.after].rows)); break;
    case 'construct': actual = constructTraceField(clone(a.measured), clone(a.observation), a.remaining, a.expired ? -1 : 300000, () => 0); break;
    case 'residual': {
      const invoke = () => measureSingleVisitResidual(clone(a.request), () => 0);
      if (c.expected?.rejected) { assert.throws(invoke); return; }
      actual = invoke(); break;
    }
    case 'propose':
      actual = memory.proposeTrace(clone(scene.observation), clone(scene.rows), [], a.maxPrefix,
        { ...clone(a.policy), remaining_level_actions: a.remaining }, 300000, () => 0);
      assert.deepEqual(memory.currentState(), beforeState, 'A proposed trace acquires no physical receipt'); break;
    case 'common_propose': {
      const invoke = () => commonTraceFieldProposal(memory, clone(scene.observation), clone(scene.rows), [], a.remaining,
        clone(a.policy), a.deadlinePresent ? 300000 : null, () => 0);
      if (c.expected?.rejected) { await assert.rejects(invoke); return; }
      actual = await invoke(); assert.deepEqual(memory.currentState(), beforeState); break;
    }
    case 'bind': {
      const domain = new ObservedInputDomain(4096); if (a.observed) domain.candidates(scene.observation);
      bindTraceField(proposal!, domain); actual = proposal; break;
    }
    case 'before': actual = traceFieldBefore({ ...proposal!, ...clone(a.patch) }, a.index, clone(scene.rows), clone(a.meta)); break;
    case 'after': actual = traceFieldAfter(proposal!, a.index, clone(fixture.scenes[a.before].rows), clone(fixture.scenes[a.after].rows), clone(a.meta)); break;
    case 'record': {
      const before = fixture.scenes[a.before], after = fixture.scenes[a.after];
      if (a.passive) delete proposal!.trace_field_plan;
      const inputs = [clone(before.observation), clone(a.command), clone(after.observation), clone(before.rows), clone(after.rows), proposal!, a.index] as const;
      const unchanged = clone(inputs), invoke = () => memory.record(...inputs);
      if (c.expected?.rejected) { assert.throws(invoke); assert.deepEqual(memory.currentState(), beforeState); return; }
      const events = invoke();
      assert.deepEqual(inputs, unchanged);
      assert.equal(c.expected.sourceParentRecordCalls, 1, 'Source trace record invokes its actual Labeled ancestor first');
      assert.deepEqual(events, c.expected.events);
      assert.deepEqual(memory.currentState(), c.expected.state.projection);
      assert.equal(memory.retainedDigest(c.expected.state.parentDigest), c.expected.state.digest);
      assert.deepEqual(restored(memory.currentState().trace_events).currentState(), memory.currentState());
      return;
    }
    default: throw new Error(`Unrecognized trace operation ${c.operation}`);
  }
  assert.deepEqual(actual, c.expected);
});

test('all 53 actual source-family acquisitions match the shared journal with atomic boundary recall', async () => {
  const family = new SharedSeriesConstraint(recallPolicy), domain = new ObservedInputDomain(4096);
  assert.deepEqual(family.state().events, []);
  let transitions = 0, official = 0, checkpoints = 0;
  for (const envelope of fixture.commonEnvelopes as R[]) {
    const view = fixture.scenes[`public:${envelope.beforeIndex}`], inputs = domain.candidates(view.observation);
    const proposal = await family.tracePropose(view.observation, view.rows, inputs, envelope.remaining, fixture.policy, 300000, () => 0);
    assert.deepEqual(proposal, envelope.proposal);
    family.bind(proposal!, domain); assert.deepEqual(proposal, envelope.boundProposal);
    for (const item of envelope.steps as R[]) {
      const before = fixture.scenes[`public:${item.actionIndex - 1}`], after = fixture.scenes[`public:${item.actionIndex}`];
      assert.deepEqual(family.before(proposal!, item.index, before.public, before.observation), item.beforeGuard);
      assert.deepEqual(family.after(proposal!, item.index, before.observation, after.observation, before.rows, after.rows), item.outcome);
      const result = family.record(before.observation, after.observation, proposal!.actions[item.index], before.rows, after.rows, proposal!, item.index, after.public.frame_packet);
      assert.deepEqual(result, item.record, 'Complete actual source family acquisition envelope, including inherited events');
      assert.deepEqual(family.state().events, item.state.events, 'Complete supported journal equals the true original family envelope');
      assert.deepEqual(family.trace.currentState(), item.traceState.projection);
      const boundary = result.status === 'official_boundary_witness';
      if (item.actionIndex <= 2 || boundary) {
        const checkpoint = family.state(), rebuilt = new SharedSeriesConstraint(recallPolicy);
        rebuilt.restore(clone(checkpoint)); assert.deepEqual(rebuilt.state(), checkpoint);
        assert.deepEqual(rebuilt.trace.currentState(), family.trace.currentState());
        assert.notEqual(checkpoint.digest, item.state.digest, 'Native closure is explicitly narrower than complete original inheritance');
        checkpoints++;
      }
      transitions++; official += Number(boundary);
    }
  }
  assert.equal(transitions, 53); assert.equal(official, 4); assert.equal(checkpoints, 6);
  assert.equal(family.trace.currentState().trace_events.length, 53);
  assert.match(SHARED_SERIES_DIGEST_SCOPE, /trace_field/);
  const checkpoint = family.state(), tampered = clone(checkpoint);
  tampered.events.find((event: R) => event.kind === 'observed_trace_extension').state.geometry_ref = 'forged-geometry';
  assert.throws(() => family.restore(tampered), /changed during recall/);
  assert.deepEqual(family.state(), checkpoint, 'Rejected recall does not partially replace acquired memory');
});

test('trace acquisition owns payloads and revisions only change on retained actual events', () => {
  const event = clone(fixture.cases.find((item: R) => item.id === 'public:prefix:0:record:0').expected.events[0]);
  const memory = new TraceFieldMemory(); memory.applyEvent(event);
  const retained = memory.currentState(), digest = memory.retainedDigest('ancestor'), revision = memory.nativeRevision;
  event.state.geometry.bbox[0] += 100; retained.trace_state!.successes.length = 0; retained.trace_events.length = 0;
  assert.equal(memory.retainedDigest('ancestor'), digest); assert.equal(memory.nativeRevision, revision);
  assert.throws(() => memory.applyEvent({ kind: 'foreign' }), /Outside trace-field/);
  assert.equal(memory.nativeRevision, revision);
});

test('local ring motion, ordered trace acquisition and official progress remain distinct', () => {
  const local = fixture.cases.find((item: R) => item.id === 'effect:controlled:missing_connecting_trace');
  const recorded = fixture.cases.find((item: R) => item.id === 'record:controlled:missing_connecting_trace');
  assert.equal(local.expected, true);
  assert.equal(recorded.expected.events[0].transition.outcome, 'ordered_trace_projection_refuted');
  assert.equal(recorded.expected.state.projection.trace_state.successes.length, 0);
  assert.equal(recorded.expected.state.projection.trace_state.failures.length, 1);
  const outside = fixture.cases.find((item: R) => item.id === 'record:controlled:outside_support_change');
  assert.equal(outside.expected.events[0].transition.outcome, 'local_extension_observed');
  assert.ok(outside.expected.events[0].transition.outside_support_changed_pixels > 0);
  assert.equal(outside.expected.events[0].transition.outside_support_effect_role, 'unknown');
  const stateOnly = fixture.cases.find((item: R) => item.id === 'after:official_state_alone');
  assert.equal(stateOnly.expected.official_progress, false);
});

test('a finite residual receipt and a constructed experimental path never authorize primitive dispatch', () => {
  for (const item of fixture.cases.filter((item: R) => item.operation === 'residual' && !item.expected.rejected)) {
    assert.equal(item.expected.descriptive_facts.primitive_release_authorized, false);
    if (item.expected.values.covering_suffix_witness_present !== undefined) assert.equal(item.expected.values.covering_suffix_witness_present, false);
  }
  const contradicts = fixture.cases.find((item: R) => item.id === 'residual:even_graph_same_partition_contradiction').expected;
  assert.equal(contradicts.status, 'COMPLETE'); assert.equal(contradicts.domain_complete, true);
  assert.ok(contradicts.values.contradiction_certificates.some((item: R) => item.code === 'UNFINISHED_SUFFIX_PARITY_CONTRADICTION'));
  const path = fixture.cases.find((item: R) => item.id === 'construct:public:0').expected;
  assert.equal(path.path.length, 9); assert.match(path.scope, /not an environment terminal proof/);
  assert.equal(path.receipt.descriptive_facts.primitive_release_authorized, false);
});

test('real time interruption produces no complete or dispatch-authorizing receipt', () => {
  const request = clone(fixture.cases.find((item: R) => item.id === 'residual:line_propagation').arguments.request);
  let tick = 0;
  const result = measureSingleVisitResidual({ ...request, time_bound_ms: 1 }, () => tick++);
  assert.equal(result.status, 'NEEDS_EVIDENCE'); assert.equal(result.cause, 'TIME_BOUND');
  assert.equal(result.domain_complete, false); assert.equal(result.descriptive_facts.primitive_release_authorized, false);
  assert.deepEqual(result.values, {}); assert.equal(result.frontier.restart_current_round, true);
});

test('the retained fifth-level public counterexample remains ambiguous under the original mark detector', () => {
  const diagnostic = fixture.finalMeasurementDiagnostic, final = fixture.scenes[diagnostic.scene];
  assert.equal(diagnostic.measurement, null); assert.equal(measureTraceField(final.rows), null);
  assert.equal(final.observation.levels_completed, 4);
  const concentric = new Map<string, number[]>();
  for (const mark of diagnostic.visibleSquarePerimeters as R[]) {
    const key = JSON.stringify(mark.center); concentric.set(key, [...(concentric.get(key) ?? []), mark.width]);
  }
  assert.equal([...concentric.values()].filter(widths => widths.length > 1).length, 2);
  assert.equal(fixture.cases.find((item: R) => item.id === 'public:final_component_abstention').expected, null);
  assert.deepEqual(fixture.cases.find((item: R) => item.id === 'public:final_own_abstention').expected,
    { status: 'abstained', reason: 'no_recurrent_line_question' });
});
