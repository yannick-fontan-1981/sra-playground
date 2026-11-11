/** Exact, development-only comparison against independently exported Python fixtures. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { NativePreviewPacking } from '../src/logos-engine/v6-preview-packing.ts';
import { previewPackingNormalized, previewPackingMeasureScene, previewPackingPointFor,
  previewPackingInputCandidates, previewPackingSample, previewPackingPose } from '../src/logos-engine/v6-preview-packing-geometry.ts';
import { previewPackingTransform, previewPackingAssignments } from '../src/logos-engine/v6-preview-packing-calculus.ts';
import { ObservedInputDomain, measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const sourceRoot = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);

function differences(a: any, b: any, path = '$', found: R[] = []): R[] {
  if (isDeepStrictEqual(a, b) || found.length >= 8) return found;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
    found.push({ path, actual: a, expected: b }); return found;
  }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) found.push({ path: `${path}.${key}`, actualPresent: Object.hasOwn(a, key), expectedPresent: Object.hasOwn(b, key) });
    else differences(a[key], b[key], `${path}.${key}`, found);
    if (found.length >= 8) break;
  }
  return found;
}

export async function verifyPreviewPackingReference(fixturePath?: string | URL): Promise<R> {
  const started = performance.now();
  const file = fixturePath ?? new URL('../tests/fixtures/v6-preview-packing/reference.json.gz', import.meta.url);
  const bytes = await readFile(file); const fixture: R = JSON.parse(gunzipSync(bytes).toString('utf8'));
  let checks = 0;
  const check = (actual: unknown, expected: unknown, label: string): void => {
    checks++;
    assert.ok(isDeepStrictEqual(actual, expected), `${label}\n${JSON.stringify(differences(actual, expected), null, 2).slice(0, 12000)}`);
  };
  const state = (owner: NativePreviewPacking, expected: any, label: string): void => check(owner.sourceState(), expected, label);
  const restore = (initial: any): NativePreviewPacking => { const owner = new NativePreviewPacking(); owner.restoreSourceState(copy(initial)); return owner; };
  check(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e', 'Pinned source commit');
  assert.match(fixture.provenance.normalization, /no proposal, event, mask, piece, assignment/);
  assert.match(fixture.provenance.recovery, /not a reconstruction of historical evidence/);
  for (const [name, expected] of Object.entries(fixture.provenance.sources) as [string, R][]) {
    const source = await readFile(new URL(name, sourceRoot));
    check({ bytes: source.length, sha256: createHash('sha256').update(source).digest('hex') }, expected, `Original source immutable: ${name}`);
  }
  check(new NativePreviewPacking().configuration, fixture.configuration, 'Original DRM configuration');
  for (const row of fixture.helpers.normalized) check(previewPackingNormalized(copy(row.points)), row.expected, `Normalized: ${row.id}`);
  for (const row of fixture.helpers.transforms) check(previewPackingTransform(copy(row.mask), row.kind), row.expected, `Transform: ${row.id}`);
  for (const row of fixture.helpers.scenes) {
    check(previewPackingMeasureScene(copy(row.rows)), row.expected, `Measured public scene: ${row.id}`);
    check(previewPackingInputCandidates(copy(row.rows), ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6']), row.inputs, `Supplementary source input points: ${row.id}`);
  }
  for (const row of fixture.helpers.points) check(previewPackingPointFor(copy(row.model), copy(row.piece)), row.expected, `Source point: ${row.id}`);
  for (const row of fixture.helpers.samples) check(previewPackingSample(copy(row.rows), copy(row.model), copy(row.cell)), row.expected, `Raster majority: ${row.id}`);
  for (const row of fixture.helpers.poses) check(previewPackingPose(copy(row.rows), copy(row.model)), row.expected, `Observed preview pose: ${row.id}`);
  for (const row of fixture.helpers.assignments) check(await previewPackingAssignments(copy(row.model)), row.expected, `Exact finite residual: ${row.id}`);
  for (const row of fixture.initial) {
    const owner = new NativePreviewPacking();
    if (row.observationMode === 'original-public-measurement') check(await measureNativeObservation(row.public, row.public.step_index, fixture.provenance.observationScope), row.observation, `Original observation: ${row.id}`);
    else check(row.observationMode, 'synthetic-observation-corruption', `Labelled observation intervention: ${row.id}`);
    check(await owner.propose(copy(row.observation), copy(row.public.frame_rows), copy(row.inputs), row.remaining), row.proposal, `Initial complete proposal: ${row.id}`);
    state(owner, row.state, `Initial source memory: ${row.id}`);
  }
  for (const session of fixture.sessions) {
    const owner = new NativePreviewPacking();
    if (session.initialState) owner.restoreSourceState(copy(session.initialState));
    for (const [index, row] of session.steps.entries()) {
      const label = `${session.id}/${index}`;
      state(owner, row.stateBefore, `Continuous source memory: ${label}`);
      check(await measureNativeObservation(row.beforePublic, row.beforePublic.step_index, fixture.provenance.observationScope), row.beforeObservation, `Before public observer: ${label}`);
      const domain = new ObservedInputDomain(250);
      check(domain.candidates(row.beforeObservation), row.inputs, `Current measured input domain: ${label}`);
      const restored = restore(row.stateBefore);
      const proposal = await owner.propose(copy(row.beforeObservation), copy(row.beforePublic.frame_rows), copy(row.inputs), row.remaining);
      check(proposal, row.proposal, `Continuous complete source proposal: ${label}`);
      check(await restored.propose(copy(row.beforeObservation), copy(row.beforePublic.frame_rows), copy(row.inputs), row.remaining), row.proposal, `Freshly restored source proposal: ${label}`);
      state(owner, row.stateAfterPropose, `Proposed source memory: ${label}`);
      state(restored, row.stateAfterPropose, `Restored proposed source memory: ${label}`);
      if (!row.command) continue;
      assert.ok(proposal && proposal.status === 'proposed', label);
      owner.bind(proposal, domain);
      check(proposal, row.boundProposal, `Binding preserves exact source proposal: ${label}`);
      check(owner.before(proposal, 0, copy(row.beforePublic), copy(row.beforeObservation)), row.beforeGuard, `Before guard: ${label}`);
      check(await measureNativeObservation(row.afterPublic, row.afterPublic.step_index, fixture.provenance.observationScope), row.afterObservation, `After public observer: ${label}`);
      check(owner.after(proposal, 0, copy(row.beforeObservation), copy(row.afterObservation), copy(row.beforePublic.frame_rows), copy(row.afterPublic.frame_rows)), row.afterGuard, `After guard: ${label}`);
      check(await owner.record(copy(row.beforeObservation), copy(row.afterObservation), copy(row.command), copy(row.beforePublic.frame_rows), copy(row.afterPublic.frame_rows), proposal, 0), row.record, `Selected acquired return: ${label}`);
      state(owner, row.stateAfter, `Acquired source memory: ${label}`);
      const restoredBeforeReturn = restore(row.stateAfterPropose);
      check(await restoredBeforeReturn.record(copy(row.beforeObservation), copy(row.afterObservation), copy(row.command), copy(row.beforePublic.frame_rows), copy(row.afterPublic.frame_rows), copy(row.boundProposal), 0), row.record, `Return after fresh restore: ${label}`);
      state(restoredBeforeReturn, row.stateAfter, `Acquisition survives restore: ${label}`);
      if (index + 1 < session.steps.length) check(row.afterPublic, session.steps[index + 1].beforePublic, `No synthetic hidden intermediate observation: ${label}`);
    }
  }
  const guarded = restore(fixture.guards.state);
  for (const row of fixture.guards.cases) check(guarded.before(copy(row.proposal), row.index, copy(row.public), copy(row.observation)), row.expected, `Guard counterexample: ${row.id}`);
  const continued = restore(fixture.guards.continuationState);
  for (const row of fixture.guards.continuations) check(continued.before(copy(row.proposal), row.index, copy(row.public), copy(row.observation)), row.expected, `Continuation guard source scope: ${row.id}`);
  for (const row of fixture.guards.after) check(continued.after(copy(row.proposal), row.index, copy(row.beforeObservation), copy(row.afterObservation), copy(row.rows), copy(row.later)), row.expected, `After guard counterexample: ${row.id}`);
  for (const row of fixture.records) {
    const owner = restore(row.stateBefore);
    check(await owner.record(copy(row.beforeObservation), copy(row.afterObservation), copy(row.command), copy(row.rows), copy(row.later), copy(row.proposal), row.index), row.expected, `Passive acquisition exclusion: ${row.id}`);
    state(owner, row.stateAfter, `Passive source state unchanged: ${row.id}`);
  }
  for (const row of fixture.stateVariants) {
    const owner = restore(row.stateBefore);
    check(await owner.propose(copy(row.observation), copy(row.public.frame_rows), copy(row.inputs), row.remaining), row.proposal, `Explicit source intervention: ${row.id}`);
    state(owner, row.stateAfter, `Intervened source memory: ${row.id}`);
  }
  return { schema: 'sra.preview-packing-independent-source-comparison.v1', status: 'passed', checks,
    sourceFiles: Object.keys(fixture.provenance.sources).length, initialCases: fixture.initial.length,
    sessions: fixture.sessions.length, sourceSteps: fixture.sessions.reduce((n: number, s: R) => n + s.steps.length, 0),
    helpers: Object.fromEntries(Object.entries(fixture.helpers).map(([k, v]) => [k, (v as any[]).length])),
    guards: fixture.guards.cases.length + fixture.guards.continuations.length + fixture.guards.after.length,
    stateVariants: fixture.stateVariants.length, gameExecution: false, historicalResultsReused: false,
    fixture: { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
    elapsedMilliseconds: performance.now() - started };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); const fixtureIndex = args.indexOf('--fixture'), outIndex = args.indexOf('--out');
  const startedAt = new Date().toISOString(); let report: R;
  try { report = { startedAt, ...await verifyPreviewPackingReference(fixtureIndex >= 0 ? args[fixtureIndex + 1] : undefined), finishedAt: new Date().toISOString() }; }
  catch (error) { report = { startedAt, finishedAt: new Date().toISOString(), status: 'failed', error: error instanceof Error ? error.stack : String(error) }; process.exitCode = 1; }
  if (outIndex >= 0) await writeFile(args[outIndex + 1]!, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
