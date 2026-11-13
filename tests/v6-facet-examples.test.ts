import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { NativeFacetExamples, facetSideValues } from '../src/logos-engine/v6-facet-examples.ts';
import { facetCenter, facetShape, facetRectangles, facetProject, facetScaleMean } from '../src/logos-engine/v6-facet-examples-geometry.ts';
import { facetExample, acquireFacetSeed, facetCompoundPlan } from '../src/logos-engine/v6-facet-examples-compound.ts';
import { facetRender, facetBounds, facetCompare, facetCandidates, facetImagePoints } from '../src/logos-engine/v6-facet-examples-stencils.ts';
import { ObservedInputDomain, measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-facet-examples-reference.json.gz', import.meta.url))).toString('utf8'));
const sourceRoot = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const pointOrder = (a: number[], b: number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
const assertState = (actual: any, expected: any, label: string): void => assert.deepEqual(actual, expected, label);

test('FacetExamples fixtures pin the unchanged original family, DRM, SRC and consumed dependencies', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.match(fixture.provenance.scope, /not router\/game parity/);
  assert.match(fixture.provenance.normalization, /no source proposal/);
  for (const [name, expected] of Object.entries(fixture.provenance.sources) as [string, {bytes: number; sha256: string}][]) {
    const bytes = await readFile(new URL(name, sourceRoot));
    assert.equal(bytes.length, expected.bytes, name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, name);
  }
  assert.deepEqual(new NativeFacetExamples().configuration, fixture.configuration);
  assert.equal(fixture.configuration.compound.maximum_states, 1024);
  assert.equal(fixture.configuration.compound.requires_observed_seed_and_vertical_effect_and_boundary, true);
});

for (const row of fixture.geometry.centers) test(`source measured center and sorted mask: ${row.id}`, () => {
  assert.deepEqual(facetShape(row.entity), row.shape);
  assert.deepEqual(facetCenter(row.entity), row.center);
});
for (const row of fixture.geometry.sideValues) test(`source integer set diagnostic iteration: ${row.id}`, () => {
  assert.deepEqual(facetSideValues(row.values, row.excluded), row.expected);
});
for (const row of fixture.geometry.averages) test(`original Python positive-width scale mean: ${row.id}`, () => {
  assert.equal(facetScaleMean(row.scales), row.expected);
});

for (const row of fixture.initial) test(`original current face measurement and complete SRC proposal: ${row.id}`, async () => {
  const family = new NativeFacetExamples();
  if (row.observationMode === 'original-public-measurement') {
    assert.deepEqual(await measureNativeObservation(row.public, row.public.step_index, fixture.provenance.observationScope), row.observation);
  } else {
    assert.equal(row.observationMode, 'synthetic-observation-corruption');
  }
  assert.deepEqual(facetRectangles(row.observation), row.rectangles);
  assert.deepEqual(facetProject(row.observation, row.public.frame_rows), row.projection);
  assert.deepEqual(facetExample(row.observation, row.public.frame_rows), row.example);
  const proposal = await family.propose(row.observation, row.public.frame_rows, row.inputs, row.remaining);
  assert.deepEqual(proposal, row.proposal);
  assertState(family.state(), row.state, row.id);
  if (proposal) {
    assert.equal(proposal.kind, 'public_facet_example');
    assert.equal(proposal.actions.length, 1);
    assert.equal(proposal.facet_plan.workflow.workflow, 'v6.facet_examples.choose');
    assert.equal(proposal.facet_plan.workflow.src_status, 'completed');
  }
});

for (const session of fixture.sessions) test(`original selected acquisition, official boundary and restored next choice: ${session.id}`, async () => {
  const family = new NativeFacetExamples();
  if (session.initialState) family.restore(clone(session.initialState));
  for (const [index, row] of session.steps.entries()) {
    const label = `${session.id} step ${index}`;
    assertState(family.state(), row.stateBefore, `${label} initial state`);
    assert.deepEqual(await measureNativeObservation(row.beforePublic, row.beforePublic.step_index, fixture.provenance.observationScope), row.beforeObservation);
    const domain = new ObservedInputDomain(250);
    assert.deepEqual(domain.candidates(row.beforeObservation), row.inputs);
    const restored = new NativeFacetExamples(); restored.restore(clone(row.stateBefore));
    const proposal = await family.propose(row.beforeObservation, row.beforePublic.frame_rows, row.inputs, row.remaining);
    assert.deepEqual(proposal, row.proposal, `${label} complete proposal/SRC`);
    assert.deepEqual(await restored.propose(row.beforeObservation, row.beforePublic.frame_rows, row.inputs, row.remaining), row.proposal, `${label} restored next choice`);
    assertState(family.state(), row.stateAfterPropose, `${label} proposed owner state`);
    assertState(restored.state(), row.stateAfterPropose, `${label} restored owner state`);
    if (!row.command) continue;
    assert.ok(proposal, `${label} acquired response belongs to a selected proposal`);
    family.bind(proposal, domain);
    assert.deepEqual(proposal, row.boundProposal, `${label} immutable point binding`);
    assert.deepEqual(family.before(proposal, 0, row.beforePublic, row.beforeObservation), row.beforeGuard);
    assert.equal(row.beforeGuard.admitted, true);
    assert.deepEqual(await measureNativeObservation(row.afterPublic, row.afterPublic.step_index, fixture.provenance.observationScope), row.afterObservation);
    assert.deepEqual(family.after(proposal, 0, row.beforeObservation, row.afterObservation, row.beforePublic.frame_rows, row.afterPublic.frame_rows), row.afterGuard);
    const event = await family.record(row.beforeObservation, row.afterObservation, row.command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, proposal, 0);
    assert.deepEqual(event, row.record, `${label} observed return classification`);
    assertState(family.state(), row.stateAfter, `${label} acquired state`);
    const restoredBefore = new NativeFacetExamples(); restoredBefore.restore(clone(row.stateAfterPropose));
    assert.deepEqual(await restoredBefore.record(row.beforeObservation, row.afterObservation, row.command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, clone(row.boundProposal), 0), row.record,
      `${label} record works without transient current/cache after restore`);
    assertState(restoredBefore.state(), row.stateAfter, `${label} restored acquisition`);
    if (index + 1 < session.steps.length) {
      assert.deepEqual(row.afterPublic, session.steps[index + 1].beforePublic, `${label} public trajectory has no injected intermediate observation`);
    }
  }
});

for (const row of fixture.records) test(`original declared return and resulting durable/next-decision state: ${row.id}`, async () => {
  const family = new NativeFacetExamples(); family.restore(clone(row.stateBefore));
  const event = await family.record(row.beforeObservation, row.afterObservation, row.command, row.beforePublic.frame_rows, row.afterPublic.frame_rows, clone(row.proposal), 0);
  assert.deepEqual(event, row.record);
  assertState(family.state(), row.stateAfter, `${row.id} acquired state`);
  const restored = new NativeFacetExamples(); restored.restore(clone(row.stateAfter));
  assert.deepEqual(await family.propose(row.afterObservation, row.afterPublic.frame_rows, row.nextInputs, row.nextRemaining), row.nextProposal);
  assert.deepEqual(await restored.propose(row.afterObservation, row.afterPublic.frame_rows, row.nextInputs, row.nextRemaining), row.nextProposal);
  assertState(family.state(), row.stateAfterNext, `${row.id} subsequent state`);
  assertState(restored.state(), row.stateAfterNext, `${row.id} restored subsequent state`);
});

for (const row of fixture.stateVariants) test(`original qualified state intervention: ${row.id}`, async () => {
  assert.match(row.origin, /state-ablation|restored-source-refutation/);
  const family = new NativeFacetExamples(); family.restore(clone(row.stateBefore));
  assert.deepEqual(await family.propose(row.observation, row.public.frame_rows, row.inputs, row.remaining), row.proposal);
  assertState(family.state(), row.stateAfter, row.id);
});

for (const row of fixture.compoundPlans) test(`original compound plan, numeric identity and recomputable cache: ${row.id}`, () => {
  const input = clone(row);
  const cache = new Map();
  assert.deepEqual(facetCompoundPlan(input.observation, input.rows, input.portable, cache, input.configuration), row.expected);
  assert.deepEqual(Object.fromEntries(cache), row.cache);
  assert.deepEqual(facetCompoundPlan(input.observation, input.rows, input.portable, cache, input.configuration), row.expected, 'cache hit preserves the exact source plan');
  assert.deepEqual(input, row, 'planning does not mutate supplied durable knowledge or observation');
});

for (const row of fixture.stencils.render) test(`original visible stencil overlay: ${row.id}`, () => {
  const image = facetRender(row.stamp, row.placements, row.background);
  const pixels = [...image].map(([key, value]) => [...key.split(',').map(Number), value]).sort(pointOrder);
  assert.deepEqual(pixels, row.expected);
  assert.deepEqual(facetBounds(facetImagePoints(image)), row.bounds);
});
for (const row of fixture.stencils.compare) test(`original rational sampling and contour alternatives: ${row.id}`, () => {
  const image = facetRender(row.stamp, row.placements, row.background);
  assert.deepEqual(facetCompare(row.reference, image, row.stamp, row.placements, row.background, row.palette, row.maxDenominator, row.sampleOffsets), row.expected);
});
for (const row of fixture.stencils.search) test(`original finite composition enumeration: ${row.id}`, () => {
  const a = row.arguments;
  const steps = new Map(Object.entries(a.steps).map(([key, value]) => [Number(key), value as [number, number]]));
  assert.deepEqual(facetCandidates(a.reference, a.stamp, a.faces, steps, a.background, a.palette, a.maxUnits, a.maxStates, a.maxDenominator, a.sampleOffsets), row.expected);
});

for (const row of fixture.guards.cases) test(`original current observation and command guard: ${row.id}`, () => {
  const family = new NativeFacetExamples(); family.restore(clone(fixture.guards.state));
  assert.deepEqual(family.before(clone(row.proposal), 0, row.public, row.observation), row.expected);
  assert.equal(row.expected.admitted, row.id === 'current');
});
for (const row of fixture.guards.errors) test(`original selected response rejection without state mutation: ${row.id}`, async () => {
  const family = new NativeFacetExamples(); family.restore(clone(fixture.guards.state)); const before = family.state();
  await assert.rejects(async () => {
    if (row.operation === 'bind') family.bind(clone(row.proposal), new ObservedInputDomain(250));
    else await family.record(row.observation, fixture.guards.afterObservation, row.command, fixture.guards.beforePublic.frame_rows, fixture.guards.afterPublic.frame_rows, clone(row.proposal), 0);
  }, (error: unknown) => error instanceof Error && error.message.includes(row.message));
  assertState(family.state(), before, 'a foreign response cannot acquire knowledge');
});

test('seed, measured vertical extension and official boundary are each required before portable compound recall', () => {
  const byId = Object.fromEntries(fixture.stateVariants.map((row: any) => [row.id, row]));
  for (const id of ['portable-without-seed-is-not-recalled', 'portable-without-observed-up-shift-is-not-recalled', 'portable-without-official-boundary-is-not-recalled',
    'changed-stamp-invalidates-portable-example', 'changed-marker-invalidates-portable-example']) assert.equal(byId[id].proposal, null, id);
  assert.ok(byId['unchanged-acquired-portable-is-revalidated'].proposal.facet_plan.projection.compound);
  const session = fixture.sessions.find((s: any) => s.id === 'cold-seed-extension-boundary-then-compound-nonacceptance');
  assert.deepEqual(session.steps[0].stateBefore, new NativeFacetExamples().state());
  assert.equal(session.steps[0].record.status, 'filled_example_correspondence');
  assert.equal(session.steps[1].record.status, 'observed_visible_cap_and_side_change');
  assert.equal(session.steps[2].record.status, 'official_boundary');
  assert.equal(session.steps[3].proposal.facet_plan.projection.compound.prefix, 0);
  assert.equal(session.steps[3].record.status, 'compound_seed_effect_matched');
});

test('two discriminating returns after the same action produce different next measured choices', () => {
  const left = fixture.sessions.find((s: any) => s.id === 'discriminating-extension-two').steps;
  const right = fixture.sessions.find((s: any) => s.id === 'discriminating-extension-four').steps;
  assert.deepEqual(left[1].proposal, right[1].proposal);
  assert.deepEqual(left[1].command, right[1].command);
  assert.notDeepEqual(left[1].record.cap_shift, right[1].record.cap_shift);
  assert.notDeepEqual(left[2].proposal.actions, right[2].proposal.actions);
  assert.ok(left[2].proposal.facet_plan.method);
  assert.ok(right[2].proposal.facet_plan.method);
});

test('a fully matched visible compound remains unaccepted and its restored refutation changes a later decision', () => {
  const session = fixture.sessions.find((s: any) => s.id === 'cold-seed-extension-boundary-then-compound-nonacceptance');
  const final = session.steps.find((r: any) => r.record?.status === 'compound_visual_candidate_not_accepted');
  assert.ok(final);
  assert.equal(final.record.outside_preserved, true);
  assert.equal(final.record.whole_colored_render_matched, true);
  assert.ok(final.stateAfter.refuted_compounds.includes(final.proposal.facet_plan.projection.scope_ref));
  assert.ok(Object.keys(final.stateAfter.compound_methods).length > 0, 'locally measured extension remains evidence despite global nonacceptance');
  assert.equal(session.steps.at(-1).proposal, null);
  const retained = fixture.stateVariants.find((r: any) => r.id === 'complete-unaccepted-scope-remains-refuted-after-visible-prefix-return');
  const removed = fixture.stateVariants.find((r: any) => r.id === 'removing-only-refutation-reenables-the-same-compound-scope');
  assert.deepEqual(retained.public, removed.public);
  assert.deepEqual({ ...retained.stateBefore, refuted_compounds: [] }, removed.stateBefore);
  assert.equal(retained.proposal, null);
  assert.ok(removed.proposal);
  const conditional = fixture.stateVariants.find((r: any) => r.id === 'removing-local-compound-method-restores-conditional-port-hypothesis');
  assert.deepEqual(conditional.public, removed.public);
  assert.deepEqual({ ...removed.stateBefore, compound_methods: {} }, conditional.stateBefore);
  assert.deepEqual(conditional.proposal.actions, removed.proposal.actions, 'local revalidation changes the justification, not necessarily the command');
  assert.equal(conditional.proposal.facet_plan.method, null);
  assert.ok(removed.proposal.facet_plan.method);
  assert.equal(removed.proposal.facet_plan.projection.compound.port_status, 'current_scope_stencil_extension_observed_and_current_render_revalidated');
  assert.notEqual(conditional.proposal.facet_plan.projection.compound.port_status, removed.proposal.facet_plan.projection.compound.port_status);
  assert.notDeepEqual(conditional.proposal.route_refs, removed.proposal.route_refs);
});

test('failed trial suppression and epoch invalidation preserve portable evidence while clearing local knowledge', () => {
  const failed = fixture.sessions.find((s: any) => s.id === 'failed-current-trial').steps;
  assert.ok(failed[0].stateAfter.failed.length);
  assert.equal(failed[1].proposal, null);
  const boundary = fixture.sessions.find((s: any) => s.id === 'seed-extension-boundary').steps;
  const retained = boundary[2].stateAfter, fresh = boundary[3].stateAfterPropose;
  assert.ok(retained.method);
  assert.equal(fresh.method, null);
  assert.deepEqual(fresh.events, retained.events);
  assert.deepEqual(fresh.portable, retained.portable);
  assert.deepEqual(fresh.failed, []);
  assert.deepEqual(fresh.compound_methods, {});
  assert.deepEqual(fresh.refuted_compounds, []);
});

test('state exports and restores deep-copy evidence and exclude the recomputable compound cache', () => {
  const row = fixture.sessions.find((s: any) => s.id === 'cold-seed-extension-boundary-then-compound-nonacceptance').steps.find((r: any) => r.stateAfter?.refuted_compounds.length);
  const retained = clone(row.stateAfter), supplied = clone(retained), family = new NativeFacetExamples();
  family.restore(supplied);
  supplied.events.length = 0; supplied.portable.evidence.push('foreign'); supplied.refuted_compounds.length = 0;
  assertState(family.state(), retained, 'restore owns its own retained evidence');
  const exposed = family.state() as any; exposed.portable.stamp[0][0] = 123; exposed.compound_methods = {};
  assertState(family.state(), retained, 'returned checkpoint is detached');
  assert.deepEqual(Object.keys(family.state()).sort(), ['compound_methods', 'epoch', 'events', 'failed', 'method', 'portable', 'refuted_compounds']);
  assert.equal(family.compound_cache.size, 0, 'restoring durable state does not restore a search cache');
});

test('selected seed acquisition independently matches the measured complete colored stamp', () => {
  const row = fixture.sessions.find((s: any) => s.id === 'seed-extension-boundary').steps[0];
  assert.deepEqual(acquireFacetSeed(row.beforeObservation, row.afterObservation, row.beforePublic.frame_rows, row.afterPublic.frame_rows, row.proposal.facet_plan.projection), row.stateAfter.portable);
});
