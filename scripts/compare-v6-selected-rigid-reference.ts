/** Development-only comparison against actual independent Python output.
 * This module does not generate expected proposals, routes or acquired events.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { NativeSelectedRigid } from '../src/logos-engine/v6-selected-rigid.ts';
import {
  selectedRigidScene, selectedRigidPoint, selectedRigidInputCandidates,
  selectedRigidPoses, selectedRigidMoved,
} from '../src/logos-engine/v6-selected-rigid-geometry.ts';
import { selectedRigidRoute } from '../src/logos-engine/v6-selected-rigid-search.ts';
import { ObservedInputDomain, measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeExecution } from '../src/logos-engine/v6-native-types.ts';

type Row = Record<string, any>;
const COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const copy = <T>(value: T): T => structuredClone(value);
const pinRoot = new URL('../reference/v6/' + COMMIT + '/', import.meta.url);
const sourceRoot = new URL('source/', pinRoot);

function differences(actual: any, expected: any, path = '$', found: Row[] = []): Row[] {
  if (isDeepStrictEqual(actual, expected) || found.length >= 10) return found;
  if (actual === null || expected === null || typeof actual !== 'object' ||
      typeof expected !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) {
    found.push({ path, actual, expected }); return found;
  }
  for (const key of new Set([...Object.keys(actual), ...Object.keys(expected)])) {
    if (!Object.hasOwn(actual, key) || !Object.hasOwn(expected, key)) {
      found.push({ path: path + '.' + key, actualPresent: Object.hasOwn(actual, key),
        expectedPresent: Object.hasOwn(expected, key) });
    } else differences(actual[key], expected[key], path + '.' + key, found);
    if (found.length >= 10) break;
  }
  return found;
}

function execution(value: Row): NativeExecution {
  return {
    ...(value.levelDeadlineMs === null ? {} : { deadlineMs: value.levelDeadlineMs }),
    now: () => value.observedNowMs,
    yieldControl: async () => {},
  };
}

export async function verifySelectedRigidReference(fixturePath?: string | URL): Promise<Row> {
  const started = performance.now();
  const fixtureFile = fixturePath ?? new URL('../tests/fixtures/v6-selected-rigid/reference.json.gz', import.meta.url);
  const bytes = await readFile(fixtureFile);
  const fixture: Row = JSON.parse(gunzipSync(bytes).toString('utf8'));
  let checks = 0, sourceFileChecks = 0, behaviorChecks = 0, records = 0;
  const exceptionComparisons: Row[] = [];
  const check = (actual: unknown, expected: unknown, label: string, source = false): void => {
    checks++;
    if (source) sourceFileChecks++; else behaviorChecks++;
    assert.ok(isDeepStrictEqual(actual, expected),
      label + '\n' + JSON.stringify(differences(actual, expected), null, 2).slice(0, 18000));
  };
  check(fixture.schema, 'sra.selected-rigid-original-reference.v1', 'Original fixture schema');
  check(fixture.exportStatus, 'passed', 'Fixture export must have passed its own coverage checks');
  check(fixture.provenance.commit, COMMIT, 'Immutable original commit');
  check(fixture.provenance.nativeStatesUsedToGenerateExpected, false, 'No native state generated expectations');
  check(fixture.provenance.nativePlansUsedToGenerateExpected, false, 'No native plan generated expectations');
  check(fixture.provenance.gameExecution, false, 'No game in component corpus');
  check(fixture.provenance.sourceBefore, fixture.provenance.sourceAfter, 'All original files unchanged through export');
  check(fixture.provenance.sourceBefore.files, 1786, 'Complete original inventory size');
  const manifestBytes = await readFile(new URL('manifest.json', pinRoot));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  check({ bytes: manifestBytes.length, sha256: createHash('sha256').update(manifestBytes).digest('hex') },
    fixture.provenance.sourceBefore.manifest, 'Bound complete source manifest');
  check(manifest.commit, COMMIT, 'Manifest commit');
  check(Object.keys(manifest.files).length, 1786, 'Every original file is accounted for');
  for (const [name, expected] of Object.entries(manifest.files) as [string, Row][]) {
    const content = await readFile(new URL(name, sourceRoot));
    check({ bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') },
      { bytes: expected.bytes, sha256: expected.sha256 }, 'Original immutable file: ' + name, true);
  }
  for (const [name, expected] of Object.entries(fixture.provenance.sources) as [string, Row][]) {
    const fromManifest = manifest.files[name];
    assert.ok(fromManifest, 'Imported source not in complete manifest: ' + name);
    check(expected, { bytes: fromManifest.bytes, sha256: fromManifest.sha256 },
      'Additional consumed-source provenance: ' + name, true);
  }

  const owner = (configuration: Row | null = fixture.configuration): NativeSelectedRigid =>
    new NativeSelectedRigid({ configuration: copy(configuration) as any });
  const restore = (value: any, configuration: Row | null = fixture.configuration): NativeSelectedRigid => {
    const instance = owner(configuration);
    instance.restoreSourceState(copy(value));
    return instance;
  };
  const sourceState = (instance: NativeSelectedRigid, expected: unknown, label: string): void =>
    check(instance.sourceState(), expected, label);
  const sourceDigest = (instance: NativeSelectedRigid, expected: unknown, label: string): void =>
    check(instance.retainedDigest(), expected, label);
  const configure = (instance: NativeSelectedRigid, value: Row): void =>
    instance.setCurrentBudget(execution(value), value.remainingLevelActions);

  const propose = async (instance: NativeSelectedRigid, row: Row, label: string): Promise<any> => {
    configure(instance, row.budget);
    let result: any = undefined;
    let error: Error | undefined;
    try {
      result = await instance.propose(copy(row.observation ?? row.beforeObservation),
        copy((row.public ?? row.beforePublic).frame_rows), copy(row.inputs), row.remaining);
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error(String(caught));
    }
    const expected = row.outcome;
    check(Boolean(error), expected.error !== null, label + ': exception occurrence');
    if (error) {
      check(error.message, expected.error.message, label + ': original exception message');
      exceptionComparisons.push({ label, source: expected.error,
        native: { type: error.name, message: error.message }, rule: 'Same message and rejection; language exception class retained separately.' });
      return null;
    }
    if (expected.requestedStopReason !== null) {
      check(result, expected.engineResult, label + ': explicit native blocking adapter preserves original internal refusal');
      check(expected.proposal, null, label + ': original family returned null plus stop reason');
    } else {
      check(result, expected.proposal, label + ': complete original family proposal or abstention');
    }
    check(instance.captureContext().requestedStopReason, expected.requestedStopReason,
      label + ': requested stop reason outside source state');
    check(instance.captureContext().configuration, row.configuration, label + ': actual configuration');
    return result;
  };

  check(owner().captureContext().configuration, fixture.configuration, 'Original selected_rigid_question configuration');
  for (const row of fixture.helpers.scenes) {
    check(selectedRigidScene(copy(row.rows), copy(row.old)), row.expected, 'Scene: ' + row.id);
  }
  for (const row of fixture.helpers.inputs) {
    check(selectedRigidInputCandidates(copy(row.rows), copy(row.available)), row.expected,
      'Input candidates: ' + row.id);
  }
  for (const row of fixture.helpers.points) {
    check(selectedRigidPoint(copy(row.scene), row.index), row.expected, 'Point: ' + row.id);
  }
  for (const row of fixture.helpers.poses) {
    check(selectedRigidPoses(copy(row.scene)), row.expected, 'Poses: ' + row.id);
  }
  for (const row of fixture.helpers.moved) {
    check(selectedRigidMoved(copy(row.scene), copy(row.poses), row.index, copy(row.direction)),
      row.expected, 'Full-mask displacement: ' + row.id);
  }
  for (const row of fixture.helpers.routes) {
    check(await selectedRigidRoute(copy(row.scene), row.active, row.budget.levelDeadlineMs,
      execution(row.budget)), row.expected, 'Original heap order, path and nodes: ' + row.id);
  }

  for (const row of fixture.initial) {
    const instance = owner(row.configuration);
    check(await measureNativeObservation(copy(row.public), row.public.step_index,
      fixture.provenance.observationScope), row.originalObservation, 'Original observer: ' + row.id);
    if (row.observationMode === 'original-public-measurement') {
      check(row.observation, row.originalObservation, 'Unmodified original observation: ' + row.id);
    } else check(row.observationMode, 'labelled-owner-intervention', 'Explicit observation intervention');
    if (row.inputMode === 'original-domain') {
      check(new ObservedInputDomain(fixture.pointLimit).candidates(copy(row.observation)),
        row.inputs, 'Original input domain: ' + row.id);
    }
    await propose(instance, row, 'Initial ' + row.id);
    sourceState(instance, row.state, 'Initial source state ' + row.id);
    sourceDigest(instance, row.digest, 'Initial retained digest ' + row.id);
  }

  for (const session of fixture.sessions) {
    check(session.cold, true, 'Session really starts cold: ' + session.id);
    const instance = owner();
    for (const [stepIndex, row] of session.steps.entries()) {
      const label = session.id + '/' + stepIndex;
      sourceState(instance, row.stateBefore, 'Continuous source state ' + label);
      sourceDigest(instance, row.digestBefore, 'Continuous source digest ' + label);
      check(await measureNativeObservation(copy(row.beforePublic), row.beforePublic.step_index,
        fixture.provenance.observationScope), row.beforeObservation, 'Continuous public observation ' + label);
      check(new ObservedInputDomain(fixture.pointLimit).candidates(copy(row.beforeObservation)),
        row.inputs, 'Continuous measured candidates ' + label);
      const independentlyRestored = restore(row.stateBefore);
      const nativeProposal = await propose(instance, row, label);
      await propose(independentlyRestored, row, label + '/fresh-event-restore');
      sourceState(instance, row.stateAfterPropose, 'Proposal preserves source events ' + label);
      sourceState(independentlyRestored, row.stateAfterPropose, 'Restored proposal source events ' + label);
      if (row.returns.length) {
        assert.ok(nativeProposal && nativeProposal.status === 'proposed', label);
        instance.bind(nativeProposal, new ObservedInputDomain(fixture.pointLimit));
        check(nativeProposal, row.boundProposal, 'Exact native binding ' + label);
      }
      for (const returned of row.returns) {
        const returnLabel = label + '/return-' + returned.index;
        sourceState(instance, returned.stateBefore, 'State before physical return ' + returnLabel);
        check(await measureNativeObservation(copy(returned.beforePublic), returned.beforePublic.step_index,
          fixture.provenance.observationScope), returned.beforeObservation, 'Before observation ' + returnLabel);
        check(instance.before(nativeProposal, returned.index, copy(returned.beforePublic),
          copy(returned.beforeObservation)), returned.beforeGuard, 'Before guard ' + returnLabel);
        check(await measureNativeObservation(copy(returned.afterPublic), returned.afterPublic.step_index,
          fixture.provenance.observationScope), returned.afterObservation, 'After observation ' + returnLabel);
        check(instance.after(nativeProposal, returned.index, copy(returned.beforeObservation),
          copy(returned.afterObservation), copy(returned.beforePublic.frame_rows),
          copy(returned.afterPublic.frame_rows)), returned.afterGuard, 'After guard ' + returnLabel);
        check(await instance.record(copy(returned.beforeObservation), copy(returned.afterObservation),
          copy(returned.command), copy(returned.beforePublic.frame_rows), copy(returned.afterPublic.frame_rows),
          nativeProposal, returned.index, copy(returned.afterPublic.frame_packet)),
          returned.sourceRecord, 'Selected original acquisition (including null) ' + returnLabel);
        records++;
        sourceState(instance, returned.stateAfter, 'Acquired source state ' + returnLabel);
        sourceDigest(instance, returned.digestAfter, 'Acquired retained digest ' + returnLabel);
        const saved = instance.sourceState();
        instance.restoreSourceState(copy(saved));
        sourceState(instance, returned.restoredState, 'Actual event replay restore ' + returnLabel);
        sourceDigest(instance, returned.digestAfter, 'Digest after actual event replay ' + returnLabel);
      }
      sourceState(instance, row.stateAfter, 'End of source step ' + label);
      sourceDigest(instance, row.digestAfter, 'End of source step digest ' + label);
      const next = session.steps[stepIndex + 1];
      if (next && row.returns.length) {
        check(row.returns.at(-1).afterPublic, next.beforePublic, 'No hidden intermediate public frame ' + label);
      }
    }
  }
  for (const row of fixture.guards.before) {
    const instance = restore(row.stateBefore);
    configure(instance, row.budget);
    check(instance.before(copy(row.proposal), row.index, copy(row.public), copy(row.observation)),
      row.expected, 'Before guard counterexample: ' + row.id);
  }
  for (const row of fixture.guards.after) {
    check(owner().after(copy(row.proposal), row.index, copy(row.beforeObservation),
      copy(row.afterObservation), copy(row.rows), copy(row.later)),
      row.expected, 'After guard counterexample: ' + row.id);
  }
  for (const row of fixture.guards.bind) {
    let caught: Error | undefined;
    try { owner().bind(copy(row.proposal)); }
    catch (error) { caught = error instanceof Error ? error : new Error(String(error)); }
    check(Boolean(caught), row.error !== null, 'Exact binding refusal: ' + row.id);
    if (caught) check(caught.message, row.error.message, 'Exact binding refusal message: ' + row.id);
  }
  for (const row of fixture.stateVariants) {
    assert.match(row.origin, /^explicit-intervention-on-original-acquired-events/);
    const instance = restore(row.stateBefore);
    await propose(instance, row, 'Declared source-state intervention ' + row.id);
    sourceState(instance, row.stateAfter, 'Intervened source event state ' + row.id);
    sourceDigest(instance, row.digestAfter, 'Intervened retained digest ' + row.id);
  }
  for (const row of fixture.restores) {
    const instance = restore(row.stateBefore);
    await propose(instance, { ...row.setup, outcome: row.setupOutcome }, 'Restore setup ' + row.id);
    const contextBefore = instance.captureContext();
    let caught: Error | undefined;
    try { instance.restoreSourceState(copy(row.input)); }
    catch (error) { caught = error instanceof Error ? error : new Error(String(error)); }
    check(Boolean(caught), row.error !== null, 'Source event restore rejects or succeeds ' + row.id);
    if (caught) exceptionComparisons.push({ label: 'restore/' + row.id,
      source: row.error, native: { type: caught.name, message: caught.message },
      rule: 'Malformed-state comparison covers rejection and atomicity only; native validation text is not original Python text.' });
    sourceState(instance, row.stateAfter, 'Restore event state and rejection atomicity ' + row.id);
    sourceDigest(instance, row.digestAfter, 'Restore reconstructed retained digest ' + row.id);
    const contextAfter = instance.captureContext();
    check({ levelDeadlineMs: contextAfter.levelDeadlineMs,
      remainingLevelActions: contextAfter.remainingLevelActions, requestedStopReason: contextAfter.requestedStopReason },
      row.ephemeralAfter, 'Restore leaves original ephemeral budget/stop outside source state ' + row.id);
    check(contextAfter, contextBefore, 'Restore does not alter clock observation or configuration ' + row.id);
  }
  for (const row of fixture.records) {
    const instance = restore(row.stateBefore);
    check(await instance.record(copy(row.beforeObservation), copy(row.afterObservation), copy(row.command),
      copy(row.rows), copy(row.later), copy(row.proposal), row.index), row.expected,
      'No passive acquisition: ' + row.id);
    sourceState(instance, row.stateAfter, 'Foreign return retains source history: ' + row.id);
  }
  return {
    schema: 'sra.selected-rigid-independent-source-comparison.v1', status: 'passed',
    checks, sourceFileChecks, behaviorChecks, originalFilesVerified: 1786,
    additionalConsumedSourceFiles: Object.keys(fixture.provenance.sources).length,
    initialCases: fixture.initial.length, coldSessions: fixture.sessions.length,
    sourceSteps: fixture.sessions.reduce((n: number, s: Row) => n + s.steps.length, 0),
    selectedRecords: records, helpers: Object.fromEntries(Object.entries(fixture.helpers).map(([k, v]) => [k, (v as any[]).length])),
    guards: Object.fromEntries(Object.entries(fixture.guards).map(([k, v]) => [k, (v as any[]).length])),
    declaredStateInterventions: fixture.stateVariants.length, restoreCases: fixture.restores.length,
    exceptionComparisons, gameExecution: false, historicalResultsReused: false,
    nativeStatesUsedToGenerateExpected: false, nativePlansUsedToGenerateExpected: false,
    fixture: { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
    elapsedMilliseconds: performance.now() - started,
    qualification: 'Complete source outputs on declared public synthetic cases; exact helpers, proposals, events, guards and event replay. Controlled clocks are not timing measurements. Malformed restore exceptions compare rejection and atomicity only.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const fixtureIndex = args.indexOf('--fixture');
  const outputIndex = args.indexOf('--out');
  const startedAt = new Date().toISOString();
  let report: Row;
  try {
    report = { startedAt, ...await verifySelectedRigidReference(
      fixtureIndex >= 0 ? args[fixtureIndex + 1] : undefined), finishedAt: new Date().toISOString() };
  } catch (error) {
    report = { startedAt, finishedAt: new Date().toISOString(), status: 'failed',
      error: error instanceof Error ? error.stack : String(error) };
    process.exitCode = 1;
  }
  if (outputIndex >= 0) {
    await writeFile(args[outputIndex + 1]!, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
