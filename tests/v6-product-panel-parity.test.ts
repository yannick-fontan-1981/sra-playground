import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureProductPanel, productPanelCurrent, productPanelCommand } from '../src/logos-engine/v6-product-panel-observation.ts';
import { compileProductRoutes, measureCyclicProductSweep } from '../src/logos-engine/v6-product-panel-mechanics.ts';
import { ProductPanelMemory, productPanelBefore, productPanelAfter, commonProductPanelProposal, bindProductPanel } from '../src/logos-engine/v6-product-panel-access.ts';
import { SharedSeriesConstraint, SHARED_SERIES_DIGEST_SCOPE } from '../src/logos-engine/v6-shared-series.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const fixture = JSON.parse(gunzipSync(await readFile(new URL('fixtures/v6-product-panel-reference.json.gz', import.meta.url))).toString()) as R;
const probe = JSON.parse(gunzipSync(await readFile(new URL('fixtures/v6-product-panel-original-public.json.gz', import.meta.url))).toString()) as R;
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const restored = (events: readonly R[] = []): ProductPanelMemory => {
  const memory = new ProductPanelMemory(); for (const event of events) memory.applyEvent(clone(event)); return memory;
};
const configuration = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`, root), 'utf8')).declarations[0].configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall;

test('product reference pins unmodified source and distinguishes component, full-family envelope and caller selection', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false);
  assert.equal(fixture.qualification.gameHostRunByExporter, false);
  assert.match(fixture.qualification.commonEnvelope, /True ObservedCompositionConstraint/);
  assert.match(fixture.qualification.mechanics, /product_sweep\/COMPILE/);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  for (const item of [fixture, probe]) {
    for (const [path, expected] of Object.entries(item.sourceHashes)) {
      assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), expected, path);
      assert.equal(manifest.files[path].sha256, expected, path);
    }
    assert.equal(hash(await readFile(new URL(item.generator, root))), item.generatorSha256);
  }
  assert.equal(hash(await readFile(new URL(fixture.originalPublicProbe.path, root))), fixture.originalPublicProbe.sha256);
  for (const [name, expected] of Object.entries(probe.gameAssetHashes)) assert.equal(hash(await readFile(new URL(`public/python/${name}`, root))), expected, name);
  assert.ok(fixture.sourceMro.indexOf('CellPlacementAccess') < fixture.sourceMro.indexOf('ProductPanelAccess'));
  assert.ok(fixture.sourceMro.indexOf('ProductPanelAccess') < fixture.sourceMro.indexOf('RootedQuotaAccess'));
});

for (const c of fixture.cases as R[]) test(`Python ↔ TypeScript product panel: ${c.id}`, async () => {
  const a = c.arguments, scene = a.scene ? fixture.scenes[a.scene] : null, memory = restored(a.ownEvents);
  const beforeState = memory.currentState(), proposal = a.proposal ? clone(fixture.plans[a.proposal]) : null;
  let actual: any;
  switch (c.operation) {
    case 'measure': actual = measureProductPanel(scene.rows); break;
    case 'current': actual = productPanelCurrent(scene.rows, clone(a.geometry)); break;
    case 'command': actual = productPanelCommand(clone(a.control)); break;
    case 'routes': actual = compileProductRoutes(clone(a.geometry), clone(a.state), clone(a.observation), a.remaining,
      a.expired ? -1 : 300000, a.maxFactors, () => 0); break;
    case 'mechanical': {
      const invoke = () => measureCyclicProductSweep(clone(a.request), () => 0);
      if (c.expected?.rejected) { assert.throws(invoke); return; }
      actual = invoke(); break;
    }
    case 'propose':
      actual = memory.proposeProduct(clone(scene.observation), clone(scene.rows), [], a.remaining,
        { ...clone(a.policy), remaining_level_actions: a.remaining }, 300000, () => 0);
      assert.deepEqual(memory.currentState(), beforeState, 'A proposed factor experiment acquires no transition'); break;
    case 'common_propose': {
      const invoke = () => commonProductPanelProposal(memory, clone(scene.observation), clone(scene.rows), [], a.remaining,
        clone(a.policy), a.deadlinePresent ? 300000 : null, () => 0);
      if (c.expected?.rejected) { await assert.rejects(invoke); return; }
      actual = await invoke(); assert.deepEqual(memory.currentState(), beforeState); break;
    }
    case 'bind': {
      const domain = new ObservedInputDomain(4096); if (a.observed) domain.candidates(scene.observation);
      bindProductPanel(proposal!, domain); actual = proposal; break;
    }
    case 'before': actual = productPanelBefore({ ...proposal!, ...clone(a.patch) }, a.index, clone(scene.rows), clone(a.meta)); break;
    case 'after': actual = productPanelAfter(proposal!, a.index, clone(fixture.scenes[a.before].rows), clone(fixture.scenes[a.after].rows), clone(a.meta)); break;
    case 'record': {
      const before = fixture.scenes[a.before], after = fixture.scenes[a.after];
      if (a.passive) delete proposal!.product_panel_plan;
      const inputs = [clone(before.observation), clone(a.command), clone(after.observation), clone(before.rows), clone(after.rows), proposal!, a.index] as const;
      const unchanged = clone(inputs), events = memory.record(...inputs);
      assert.deepEqual(inputs, unchanged);
      assert.equal(c.expected.sourceParentRecordCalls, 1, 'The source product record keeps the original parent chain');
      assert.deepEqual(events, c.expected.events);
      assert.deepEqual(memory.currentState(), c.expected.state.projection);
      assert.equal(memory.retainedDigest(c.expected.state.parentDigest), c.expected.state.digest);
      assert.deepEqual(restored(memory.currentState().product_events).currentState(), memory.currentState());
      return;
    }
    default: throw new Error(`Unrecognized product operation ${c.operation}`);
  }
  assert.deepEqual(actual, c.expected);
});

test('original isolated component reaches three cold levels with 24 real commands and no manual priming', () => {
  assert.equal(probe.status, 'passed'); assert.equal(probe.actions, 24); assert.equal(probe.levelsCompleted, 3);
  assert.equal(probe.sessionCount, 1); assert.equal(probe.manualPrimingActions, 0);
  assert.equal(probe.state, 'NOT_FINISHED'); assert.match(probe.scope, /not original full common caller/);
  assert.deepEqual(probe.boundaries.map((value: R) => value.levelActions), [3, 7, 14]);
  assert.equal(probe.packets.length, 25); assert.equal(probe.prefixes.length, 16);
  assert.equal(probe.prefixes[0].proposal.product_panel_plan.estimate, null);
  assert.equal(probe.prefixes[1].proposal.product_panel_plan.estimate, null);
  for (const prefix of probe.prefixes as R[]) {
    const steps = prefix.proposal.steps as R[], unknown = steps.findIndex(step => !step.relation_observed);
    assert.ok(unknown === -1 || unknown === steps.length - 1, 'A conditional route stops at its first unobserved edge');
  }
});

test('all 24 true CombinedObservedCompositionMemory envelopes match the native passive journal and restore atomically', async () => {
  const family = new SharedSeriesConstraint(recallPolicy), domain = new ObservedInputDomain(4096);
  assert.deepEqual(family.state().events, []);
  let transitions = 0, official = 0;
  for (const envelope of fixture.commonEnvelopes as R[]) {
    const view = fixture.scenes[`public:${envelope.beforeIndex}`], inputs = domain.candidates(view.observation);
    const proposal = await family.productPropose(view.observation, view.rows, inputs, envelope.remaining, fixture.policy, 300000, () => 0);
    assert.deepEqual(proposal, envelope.proposal);
    family.bind(proposal!, domain); assert.deepEqual(proposal, envelope.boundProposal);
    for (const item of envelope.steps as R[]) {
      const before = fixture.scenes[`public:${item.actionIndex - 1}`], after = fixture.scenes[`public:${item.actionIndex}`];
      assert.deepEqual(family.before(proposal!, item.index, before.public, before.observation), item.beforeGuard);
      assert.deepEqual(family.after(proposal!, item.index, before.observation, after.observation, before.rows, after.rows), item.outcome);
      const result = family.record(before.observation, after.observation, proposal!.actions[item.index], before.rows, after.rows, proposal!, item.index, after.public.frame_packet);
      assert.deepEqual(result, item.record, 'Complete original family acquisition envelope, including passive records');
      assert.deepEqual(family.state().events, item.state.events, 'Complete supported journal event sequence equals original envelope');
      assert.deepEqual(family.product.currentState(), item.productState.projection);
      const checkpoint = family.state(), rebuilt = new SharedSeriesConstraint(recallPolicy);
      rebuilt.restore(clone(checkpoint)); assert.deepEqual(rebuilt.state(), checkpoint);
      assert.deepEqual(rebuilt.product.currentState(), family.product.currentState());
      assert.notEqual(checkpoint.digest, item.state.digest, 'Native digest is explicitly narrower than full original inheritance');
      transitions++; official += Number(result.status === 'official_boundary_witness');
    }
  }
  assert.equal(transitions, 24); assert.equal(official, 3);
  assert.match(SHARED_SERIES_DIGEST_SCOPE, /product_panel/);
  const checkpoint = family.state(), tampered = clone(checkpoint);
  tampered.events.find((event: R) => event.kind === 'observed_factor_product').state.visited.push([999]);
  assert.throws(() => family.restore(tampered), /changed during recall/);
  assert.deepEqual(family.state(), checkpoint);
});

test('product acquisition owns payloads and increments its revision only for actual retained events', () => {
  const event = clone(fixture.cases.find((item: R) => item.id === 'record:coupled_counterexample').expected.events[0]);
  const memory = new ProductPanelMemory();
  memory.applyEvent(event);
  const state = memory.currentState(), digest = memory.retainedDigest('ancestor'), revision = memory.nativeRevision;
  event.state.evidence.push('foreign'); state.product_state!.evidence.push('foreign'); state.product_events.length = 0;
  assert.equal(memory.retainedDigest('ancestor'), digest); assert.equal(memory.nativeRevision, revision);
  assert.equal(memory.currentState().product_state!.counterexamples.length, 1);
  assert.throws(() => memory.applyEvent({ kind: 'other' }), /Outside product/);
  assert.equal(memory.nativeRevision, revision);
});

test('source terminal witness adds no factor edge, while counterexample handling remains an explicit source limitation', () => {
  const boundary = fixture.cases.find((item: R) => item.operation === 'record' && item.expected.state.projection.product_state.boundary_witness);
  const previous = boundary.arguments.ownEvents.at(-1).state;
  assert.deepEqual(boundary.expected.state.projection.product_state.edges, previous.edges);
  assert.equal(boundary.expected.state.projection.product_state.boundary_witness.catalogue_goal_causal_status, 'compatible_not_universal');
  const forward = fixture.cases.find((item: R) => item.id === 'routes:forward').expected;
  const coupled = fixture.cases.find((item: R) => item.id === 'routes:source_retains_conditional_independence_after_counterexample').expected;
  assert.deepEqual(coupled, forward, 'This original compiler does not consult retained simultaneous-factor counterexamples');
  assert.match(fixture.qualification.conditionalIndependence, /even after recorded/);
});

test('product compiler time interruption never creates a complete or release-authorizing receipt', () => {
  const request = clone(fixture.cases.find((item: R) => item.id === 'mechanical:complete').arguments.request);
  let tick = 0;
  const result = measureCyclicProductSweep({ ...request, time_bound_ms: 1 }, () => tick++);
  assert.equal(result.status, 'NEEDS_EVIDENCE'); assert.equal(result.cause, 'TIME_BOUND');
  assert.equal(result.domain_complete, false); assert.equal(result.descriptive_facts.primitive_release_authorized, false);
  assert.equal(result.frontier.resume_strategy, 'reuse_complete_prefix_restart_unfinished_pure_model');
});

test('native exact-integer boundary refuses unrepresentable product cardinalities instead of rounding receipts', () => {
  const request = clone(fixture.cases.find((item: R) => item.id === 'mechanical:complete').arguments.request);
  request.models[0].factors = Array.from({ length: 16 }, () => Array.from({ length: 20 }, (_value, i) => `v:${i}`));
  assert.throws(() => measureCyclicProductSweep(request, () => 0), /cardinality exceeds the native exact-integer domain/);
});
