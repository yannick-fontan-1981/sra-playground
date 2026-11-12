#!/usr/bin/env node
/** Bounded synthetic Chart work forms through the complete production caller.
 * Preparation never imports this file. Runtime imports occur only after the
 * root execution declaration and every source/input fingerprint are checked.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, createReadStream, createWriteStream, existsSync, fsyncSync, mkdirSync, openSync,
  readFileSync, realpathSync, readdirSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createGzip, gunzipSync, gzipSync } from 'node:zlib';

const SELF = fileURLToPath(import.meta.url), TOOL = dirname(SELF), ROOT = resolve(TOOL, '../../../../../..');
const OWNER = 'public_chart_navigation', EPISODE = 'common-observation-frontier';
const REFERENCE = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const NATIVE = { fileCount: 334, digest: 'e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653' };
const IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.68.0';
const FIXTURE = 'docs/migration/lot9a-evidence/reference-01/reference.json.gz';
const FIXTURE_SHA = '0770706db16249ac4ab1c7c8b9533d571f2fc2cdaeaf5dae2d990806e412cfe8';
const IDS = ['primary', 'contrary', 'selected-acquisition-ablation', 'passive-scene-equal', 'passive-scene-changed'];
const BUDGETS = { targetLevels: 3, levelActionCaps: [8, 8, 8], maxActions: 8 };
const ORIGINAL = `reference/v6/${REFERENCE}/source/agents/yf_arc3_v6`;
const DECLARATIONS = [`${ORIGINAL}/laya_proto/common_frontier_policy.drm.json`, `${ORIGINAL}/morphology_policy/strategy.drm`];
const copy = value => structuredClone(value), utc = () => new Date().toISOString();
const sha = value => createHash('sha256').update(value).digest('hex');
const label = path => relative(ROOT, path);
const errorRecord = error => ({ name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? null });
const inside = path => {
  const full = resolve(ROOT, path); assert.ok(full.startsWith(ROOT + sep), `Path outside checkout: ${path}`); return full;
};
function fingerprint(path) {
  assert.equal(realpathSync(path), path); assert.ok(statSync(path).isFile());
  const data = readFileSync(path); return { path: label(path), bytes: data.length, sha256: sha(data) };
}
function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : entry.isFile() ? [path] : [];
  }).sort();
}
function nativeInventory() {
  const files = {};
  for (const path of [...filesUnder(inside('src/logos-engine')), ...filesUnder(inside('src/runtime'))]
    .filter(path => /\.(ts|json|drm)$/.test(path)).sort()) files[label(path)] = fingerprint(path).sha256;
  return { fileCount: Object.keys(files).length, digest: sha(JSON.stringify(files)), files };
}
function argumentsOf(argv) {
  assert.equal(argv.length, 4, 'Usage: capture.mjs --declaration FILE --output NEW_DIRECTORY');
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert.ok(['--declaration', '--output'].includes(argv[i])); assert.equal(args[argv[i]], undefined);
    args[argv[i]] = inside(argv[i + 1]);
  }
  assert.ok(args['--declaration'] && args['--output']); return { declarationPath: args['--declaration'], output: args['--output'] };
}
function rawWriter(directory, maximumBytes) {
  const path = resolve(directory, 'events.jsonl'), fd = openSync(path, 'wx'), graphDir = resolve(directory, 'graphs');
  mkdirSync(graphDir); const blobs = new Map(); let ordinal = 0, rawBytes = 0, graphBytes = 0, closed = false;
  const limit = added => assert.ok(rawBytes + graphBytes + added <= maximumBytes, 'Declared aggregate raw capture bound exceeded');
  const replaceGraph = (_key, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || !isDeepStrictEqual(Object.keys(value).sort(), ['chain', 'deltas', 'nodes'])
      || !value.nodes || typeof value.nodes !== 'object' || !Array.isArray(value.deltas)) return value;
    const raw = Buffer.from(JSON.stringify(value)), digest = sha(raw);
    if (!blobs.has(digest)) {
      limit(raw.length); const compressed = gzipSync(raw, { level: 6 }), target = resolve(graphDir, digest + '.json.gz');
      writeFileSync(target, compressed, { flag: 'wx' }); graphBytes += raw.length;
      blobs.set(digest, { path: label(target), sha256: digest, rawBytes: raw.length, gzipBytes: compressed.length, gzipSha256: sha(compressed) });
    }
    return { $chartGraphRef: blobs.get(digest) };
  };
  return {
    path,
    emit(type, value = {}) {
      assert.equal(closed, false);
      const data = Buffer.from(JSON.stringify({ ordinal, type, ...value }, replaceGraph) + '\n'); limit(data.length);
      let position = 0; while (position < data.length) position += writeSync(fd, data, position, data.length - position);
      rawBytes += data.length; return ordinal++;
    },
    close() { if (!closed) { fsyncSync(fd); closeSync(fd); closed = true; } },
    summary: () => ({ records: ordinal, rawBytes, graphRawBytes: graphBytes, totalRawBytes: rawBytes + graphBytes,
      graphBlobs: [...blobs.values()].sort((a, b) => a.sha256.localeCompare(b.sha256)) }),
  };
}
function schedule(execution) {
  return execution ? { signalProvided: Boolean(execution.signal), signalAborted: execution.signal?.aborted ?? false,
    deadlineMs: execution.deadlineMs ?? null, nowProvided: typeof execution.now === 'function',
    remainingLevelActions: execution.remainingLevelActions ?? null, yieldControlProvided: typeof execution.yieldControl === 'function' } : null;
}
function methodArguments(method, args) {
  if (method === 'restore' || method === 'restoreNative') return { state: copy(args[0]) };
  if (method === 'nativeState') return {};
  if (method === 'proposeInSubquestion') return { group: args[0], question: args[1], observation: copy(args[2]), rows: copy(args[3]),
    inputs: copy(args[4]), remaining: args[5], execution: schedule(args[6]) };
  if (method === 'bind') return { proposal: copy(args[0]), domain: args[1] == null ? null : {
    limit: args[1].limit, bindings: [...args[1].bindings].map(([key, table]) => [key, [...table].map(([point, witness]) => [point, copy(witness)])]) } };
  if (method === 'before') return { proposal: copy(args[0]), index: args[1], publicPacket: copy(args[2]), observation: copy(args[3]), execution: schedule(args[4]) };
  if (method === 'after') return { proposal: copy(args[0]), index: args[1], before: copy(args[2]), after: copy(args[3]),
    firstRows: copy(args[4]), secondRows: copy(args[5]) };
  return { before: copy(args[0]), after: copy(args[1]), command: copy(args[2]), firstRows: copy(args[3]), secondRows: copy(args[4]),
    proposal: args[5] == null ? null : copy(args[5]), index: args[6] ?? 0, frames: args[7] == null ? null : copy(args[7]), execution: schedule(args[8]) };
}
function plans(fixture) {
  const primary = fixture.sequences.primary.steps, contrary = fixture.sequences.contraryAnchor.steps;
  assert.equal(primary.length, 3); assert.equal(contrary.length, 1);
  return IDS.map((id, index) => ({ id, steps: index === 0 ? primary : index === 1 ? contrary : primary.slice(0, 1),
    expectedPhysicalReturns: [3, 1, 1, 2, 2][index], coldResets: index === 0 ? 2 : 0,
    passive: index >= 3, sceneChanged: index === 4, ablation: index === 2 }));
}
function selected(result, step) {
  assert.equal(result.kind, 'action', result.reason); assert.equal(result.snapshot.lastDecision, OWNER);
  assert.deepEqual(result.command, step.proposal.actions[0]); assert.ok(result.authorization);
  assert.equal(result.authorization.observation_ref, step.observation.observation_ref);
  assert.deepEqual(result.snapshot.proposal.chart_plan, step.proposal.chart_plan);
  assert.equal(result.snapshot.proposal.material_access_subquestion, 'chart_navigation');
  assert.equal(result.snapshot.proposal.strategy_receipt.selected, 'factored_material_return');
  assert.equal(result.snapshot.proposal.bundle_template.operation_key, 'OP18');
  assert.equal(result.snapshot.whyAct.decision.decision.status, 'action_set_released');
}

async function main() {
  const { declarationPath, output } = argumentsOf(process.argv.slice(2));
  const declaration = JSON.parse(readFileSync(declarationPath, 'utf8'));
  assert.equal(declaration.schema, 'logos-engine.lot9a.chart-common-declaration.v1');
  assert.equal(declaration.allowExecution, true, 'The root execution declaration is not frozen');
  assert.deepEqual(declaration.expectedNative, NATIVE); assert.equal(declaration.expectedImplementation, IMPLEMENTATION);
  assert.equal(declaration.referenceCommit, REFERENCE); assert.equal(declaration.fixturePath, FIXTURE); assert.equal(declaration.fixtureSha256, FIXTURE_SHA);
  assert.deepEqual(declaration.caseIds, IDS); assert.equal(declaration.sessionId, 'chart:synthetic'); assert.deepEqual(declaration.budgets, BUDGETS);
  const stage = inside(declaration.stageRoot), relativeOutput = relative(stage, output);
  const match = /^common-capture-(\d{2})\/capture$/.exec(relativeOutput); assert.ok(match, 'Capture must use a declared attempt directory');
  const attempt = Number(match[1]), limits = declaration.limits;
  assert.equal(limits.expectedSessionsPerAttempt, 5); assert.equal(limits.expectedPhysicalReturnsPerAttempt, 9);
  assert.equal(limits.expectedCapturePointsPerAttempt, 52);
  assert.equal(limits.maximumAttempts, 2); assert.equal(limits.maximumSessionStartsCumulative, 10); assert.equal(limits.maximumPhysicalReturnsCumulative, 18);
  assert.ok(attempt >= 1 && attempt <= limits.maximumAttempts); assert.equal(existsSync(output), false, 'Refuse an existing capture directory');
  const prior = [];
  for (let index = 1; index < attempt; index++) {
    const path = resolve(stage, `common-capture-${String(index).padStart(2, '0')}/capture/receipt.json`);
    const value = JSON.parse(readFileSync(path, 'utf8')); prior.push({ path: label(path), receipt: value, fingerprint: fingerprint(path) });
  }
  if (attempt > 1) assert.ok(declaration.correctiveAttemptRecordPath && existsSync(inside(declaration.correctiveAttemptRecordPath)), 'A corrective attempt requires its retained observed-defect declaration');
  const priorSessions = prior.reduce((sum, row) => sum + row.receipt.sessionStarts, 0), priorReturns = prior.reduce((sum, row) => sum + row.receipt.physicalReturns, 0);
  assert.ok(priorSessions + 5 <= limits.maximumSessionStartsCumulative); assert.ok(priorReturns + 9 <= limits.maximumPhysicalReturnsCumulative);
  mkdirSync(dirname(output), { recursive: true }); mkdirSync(output);
  const receiptPath = resolve(output, 'receipt.json'), writer = rawWriter(output, limits.maximumRawBytesPerAttempt), began = Date.now();
  const receipt = { schema: 'logos-engine.lot9a.chart-common-capture.v1', status: 'running', startedAt: utc(), attempt,
    entryBoundary: 'NativeV6Runtime', publicWorkerQualified: false, publicServiceQualified: false, publicTicketsQualified: false,
    originalOraclesExecuted: 0, gameRuns: 0, officialSolvedLevels: 0, officialPerformanceMeasurement: false, globalLockAcquired: false,
    sessionStarts: 0, initializedSessions: 0, physicalReturns: 0, capturePoints: 0, sessions: [], failures: [], inputsBefore: [], inputsAfter: [],
    inheritedFunctionalAccounting: declaration.inheritedFunctionalAccounting, priorAttempts: prior.map(row => ({ ...row.fingerprint,
      status: row.receipt.status, sessionStarts: row.receipt.sessionStarts, physicalReturns: row.receipt.physicalReturns })) };
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  let nativeBefore = null, sourceHead = null;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(new Error('Declared capture supervision deadline reached')), limits.abortAfterSecondsPerCapture * 1000);
  const execution = { signal: controller.signal, yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)) };
  try {
    assert.deepEqual(declaration.inheritedFunctionalAccounting, { initializedSessions: 10, physicalReturns: 14 });
    const pins = new Map(declaration.inputPins.map(pin => [pin.path, pin])); assert.equal(pins.size, declaration.inputPins.length);
    const candidatePath = inside(declaration.candidateNativePath), candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
    assert.deepEqual({ fileCount: candidate.fileCount, digest: candidate.digest }, NATIVE);
    const nativeFiles = Object.fromEntries(Object.entries(candidate.files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    assert.equal(Object.keys(nativeFiles).length, NATIVE.fileCount); assert.equal(sha(JSON.stringify(nativeFiles)), NATIVE.digest);
    for (const path of [...filesUnder(TOOL).map(label), label(candidatePath), FIXTURE, 'tests/v6-chart-navigation-kernel.test.ts', ...DECLARATIONS]) {
      assert.ok(pins.has(path), `The root declaration omitted ${path}`);
    }
    const names = [...new Set([label(declarationPath), ...pins.keys(), ...Object.keys(nativeFiles), ...prior.map(row => row.path),
      ...(declaration.correctiveAttemptRecordPath ? [declaration.correctiveAttemptRecordPath] : [])])].sort();
    for (const name of names) {
      const actual = fingerprint(inside(name)); receipt.inputsBefore.push(actual);
      if (pins.has(name)) assert.deepEqual(actual, pins.get(name), `Declared input changed: ${name}`);
      if (Object.hasOwn(nativeFiles, name)) assert.equal(actual.sha256, nativeFiles[name], `Candidate source changed: ${name}`);
    }
    nativeBefore = nativeInventory(); assert.deepEqual(nativeBefore, candidate);
    sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    receipt.sourceHeadBefore = sourceHead; receipt.nativeBefore = { fileCount: nativeBefore.fileCount, digest: nativeBefore.digest };
    const fixtureBytes = readFileSync(inside(FIXTURE)); assert.equal(sha(fixtureBytes), FIXTURE_SHA);
    const fixture = JSON.parse(gunzipSync(fixtureBytes).toString('utf8'));
    assert.equal(fixture.referenceCommit, REFERENCE);
    const declaredPlans = plans(fixture), declarations = { common: JSON.parse(readFileSync(inside(DECLARATIONS[0]), 'utf8')),
      strategy: JSON.parse(readFileSync(inside(DECLARATIONS[1]), 'utf8')) };
    writer.emit('header', { declaration, declarationPin: fingerprint(declarationPath), sourceHead, candidateNative: receipt.nativeBefore,
      fixturePin: fingerprint(inside(FIXTURE)), cases: declaredPlans.map(plan => ({ ...plan, steps: plan.steps.map(step => ({
        beforeFrame: step.beforeFrame, afterFrame: step.afterFrame, returnedFrames: step.returnedFrames })) })),
      qualification: 'complete_synthetic_common_caller_graphs_and_observed_owner_restorations_only' });
    // This is the first native import and follows the frozen preflight above.
    const { createNativeV6Runtime } = await import(pathToFileURL(inside('src/logos-engine/v6-native-runtime.ts')).href);
    for (const plan of declaredPlans) await captureSession({ plan, fixture, declaration, execution, writer, receipt, createNativeV6Runtime, declarations });
    assert.equal(receipt.sessionStarts, 5); assert.equal(receipt.initializedSessions, 5); assert.equal(receipt.physicalReturns, 9);
    assert.equal(receipt.capturePoints, limits.expectedCapturePointsPerAttempt);
    receipt.status = 'captured_synthetic_common_graphs';
  } catch (error) {
    receipt.failures.push(errorRecord(error)); receipt.status = 'failed';
    try { writer.emit('capture_failure', { error: errorRecord(error) }); } catch (extra) { receipt.failures.push(errorRecord(extra)); }
  } finally {
    clearTimeout(timer);
    try {
      receipt.inputsAfter = receipt.inputsBefore.map(pin => fingerprint(inside(pin.path)));
      receipt.inputsUnchanged = isDeepStrictEqual(receipt.inputsBefore, receipt.inputsAfter);
      const nativeAfter = nativeInventory(); receipt.nativeAfter = { fileCount: nativeAfter.fileCount, digest: nativeAfter.digest };
      receipt.nativeSourceUnchanged = nativeBefore !== null && isDeepStrictEqual(nativeBefore, nativeAfter);
      receipt.sourceHeadAfter = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
      receipt.sourceHeadUnchanged = sourceHead !== null && sourceHead === receipt.sourceHeadAfter;
      if (!receipt.inputsUnchanged || !receipt.nativeSourceUnchanged || !receipt.sourceHeadUnchanged) receipt.status = 'failed';
    } catch (error) { receipt.status = 'failed'; receipt.failures.push(errorRecord(error)); }
    receipt.finishedAt = utc(); receipt.elapsedSeconds = (Date.now() - began) / 1000;
    receipt.cumulativeThisTool = { sessionStarts: priorSessions + receipt.sessionStarts, initializedSessions: prior.reduce((sum, row) => sum + row.receipt.initializedSessions, 0) + receipt.initializedSessions,
      physicalReturns: priorReturns + receipt.physicalReturns, elapsedSeconds: prior.reduce((sum, row) => sum + row.receipt.elapsedSeconds, 0) + receipt.elapsedSeconds };
    receipt.includingInherited = { initializedSessions: 10 + receipt.cumulativeThisTool.initializedSessions, physicalReturns: 14 + receipt.cumulativeThisTool.physicalReturns };
    try { writer.emit('footer', { status: receipt.status, sessionStarts: receipt.sessionStarts, initializedSessions: receipt.initializedSessions,
      physicalReturns: receipt.physicalReturns, capturePoints: receipt.capturePoints, cumulativeThisTool: receipt.cumulativeThisTool }); }
    catch (error) { receipt.status = 'failed'; receipt.failures.push(errorRecord(error)); }
    writer.close(); receipt.rawCapture = writer.summary();
    try {
      const raw = fingerprint(writer.path), events = resolve(output, 'events.jsonl.gz');
      await pipeline(createReadStream(writer.path), createGzip({ level: 6 }), createWriteStream(events, { flags: 'wx' }));
      receipt.events = { ...fingerprint(events), rawBytes: raw.bytes, rawSha256: raw.sha256 };
      unlinkSync(writer.path);
    } catch (error) { receipt.status = 'failed'; receipt.failures.push(errorRecord(error)); }
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ status: receipt.status, receipt: label(receiptPath), sessionStarts: receipt.sessionStarts,
      physicalReturns: receipt.physicalReturns, capturePoints: receipt.capturePoints }) + '\n');
    if (receipt.status === 'failed') process.exitCode = 1;
  }
}

async function captureSession({ plan, fixture, declaration, execution, writer, receipt, createNativeV6Runtime, declarations }) {
  const sessionId = declaration.sessionId, summary = { caseId: plan.id, sessionId, status: 'running', initialized: false,
    factoryCalls: 0, physicalReturns: 0, activeChartAcquisitions: 0, passiveChartAcquisitions: 0, suppressedChartAcquisitions: 0,
    sourceFactRestorations: 0, controlledColdResets: 0, nativeRestoreCalls: 0, ownerOperations: 0, memoryOperations: 0,
    capturePoints: 0, runtimeClosed: false };
  receipt.sessions.push(summary); receipt.sessionStarts++;
  const packet = (name, index, frames = null) => ({ ...copy(fixture.frames[name].public), step_index: index,
    ...(frames ? { frame_packet: frames.map(id => copy(fixture.frames[id].rows)) } : {}) });
  const cold = copy(fixture.sequences.primary.coldState), pendingOperations = [], pendingMemory = [], stack = [];
  let runtime = null, owner = null, readState = null, last = null, publicCurrent = null, phase = null,
    operationOrdinal = 0, memoryOrdinal = 0, activityOrdinal = 0, pointIndex = 0;
  writer.emit('session_start', { caseId: plan.id, sessionId, coldState: cold, budgets: declaration.budgets,
    expectedPhysicalReturns: plan.expectedPhysicalReturns, explicitColdResets: plan.coldResets,
    acquiredStateInjected: false, fixtureRastersAdapted: false, groupSelectionFiltered: false });
  const graphIdentity = () => {
    const graph = runtime?.knowledge?.memory;
    return graph ? { chain: graph.chain, revision: graph.deltas.length,
      ownerRootRevision: graph.nodes[`family_state:${OWNER}`]?.revision ?? null } : null;
  };
  function installOwnerCapture() {
    for (const method of ['proposeInSubquestion', 'bind', 'before', 'after', 'record', 'recordSource', 'restore', 'restoreNative', 'nativeState']) {
      const original = owner[method].bind(owner);
      owner[method] = (...args) => {
        const suppressed = plan.ablation && method === 'recordSource' && args[5] != null;
        const row = { ordinal: operationOrdinal++, parentOrdinal: stack.at(-1) ?? null, depth: stack.length, method,
          phase: copy(phase), startedActivity: activityOrdinal++, graphAtStart: graphIdentity(),
          sourceBefore: copy(readState()), arguments: methodArguments(method, args), originalInvoked: !suppressed };
        stack.push(row.ordinal);
        const finish = (value, failed = false, error = null) => {
          assert.equal(stack.pop(), row.ordinal, 'Owner instrumentation stack must remain nested');
          const complete = { ...row, completedActivity: activityOrdinal++, sourceAfter: copy(readState()),
            ...(failed ? { exception: errorRecord(error) } : { returnKind: value === undefined ? 'undefined' : value === null ? 'null' : 'value',
              returnValue: value === undefined ? null : copy(value) }), ...(method === 'bind' ? { proposalAfter: copy(args[0]) } : {}) };
          pendingOperations.push(complete); summary.ownerOperations++;
          if (!failed && method === 'recordSource') {
            if (suppressed) summary.suppressedChartAcquisitions++;
            else if (args[5] == null) summary.passiveChartAcquisitions++;
            else summary.activeChartAcquisitions++;
          }
          if (!failed && method === 'restore') {
            if (phase?.type === 'controlled_cold_reset') summary.controlledColdResets++;
            else summary.sourceFactRestorations++;
          }
          if (!failed && method === 'restoreNative') summary.nativeRestoreCalls++;
          if (failed) throw error; return value;
        };
        try {
          const value = suppressed ? null : original(...args);
          return value && typeof value.then === 'function' ? value.then(result => finish(result), error => finish(undefined, true, error)) : finish(value);
        } catch (error) {
          if (stack.at(-1) === row.ordinal) return finish(undefined, true, error);
          throw error;
        }
      };
    }
  }
  function installSourceFactCapture() {
    const memory = runtime.authority.memory;
    for (const method of ['put', 'get']) {
      const original = memory[method].bind(memory);
      memory[method] = (...args) => {
        if (args[0] !== EPISODE || args[1] !== 'chart_navigation_state') return original(...args);
        const row = { ordinal: memoryOrdinal++, method, phase: copy(phase), startedActivity: activityOrdinal++, arguments: copy(args) };
        try {
          const value = original(...args);
          pendingMemory.push({ ...row, completedActivity: activityOrdinal++, returnKind: value === undefined ? 'undefined' : 'value',
            returnValue: value === undefined ? null : copy(value) }); summary.memoryOperations++; return value;
        } catch (error) {
          pendingMemory.push({ ...row, completedActivity: activityOrdinal++, exception: errorRecord(error) }); summary.memoryOperations++; throw error;
        }
      };
    }
  }
  const fact = key => runtime.knowledge.stateValue('reasoning:memory').facts.map(id => runtime.knowledge.stateValue(id)).filter(row => row.key === key);
  async function invoke(type, input = null) {
    assert.equal(execution.signal.aborted, false, 'Capture supervision aborted');
    assert.ok(receipt.capturePoints < declaration.limits.maximumCapturePointsPerAttempt);
    phase = { type, pointIndex, physicalReturnsBeforeCall: summary.physicalReturns };
    const startedMs = Date.now(), beforeIdentity = type === 'initialize' ? null : runtime.authorizationIdentity();
    let result, kind;
    if (type === 'initialize') {
      result = await runtime.initialize(copy(input), execution); kind = 'native_yield'; summary.initialized = true; receipt.initializedSessions++;
      installSourceFactCapture();
    } else if (type === 'advance') { result = await runtime.advance(copy(input), execution); kind = 'native_yield'; }
    else if (type === 'resume' || type === 'held_resume') { result = await runtime.resume(execution); kind = 'native_yield'; }
    else if (type === 'edit') { result = await runtime.edit(copy(input), execution); kind = 'native_yield'; }
    else if (type === 'inspect') { result = runtime.inspectKnowledge(); kind = 'knowledge_memory'; }
    else if (type === 'close') { result = await runtime.close('chart_common_capture_closed'); kind = 'undefined'; summary.runtimeClosed = true; }
    else throw new Error('Unknown capture work form');
    const snapshot = runtime.snapshot(), knowledge = type === 'inspect' ? result : runtime.inspectKnowledge();
    const identity = runtime.authorizationIdentity?.() ?? null;
    assert.equal(snapshot.implementation, IMPLEMENTATION); assert.equal(snapshot.sourceCommit, REFERENCE);
    assert.equal(snapshot.levelsCompleted, 0); assert.equal(snapshot.graphChain, knowledge.chain);
    assert.equal(snapshot.graphRevision, knowledge.deltas.length); assert.equal(snapshot.nodeCount, Object.keys(knowledge.nodes).length);
    assert.deepEqual(identity, { graphChain: snapshot.graphChain, nativeExecutionDigest: snapshot.nativeExecutionDigest });
    assert.ok(knowledge.nodes[`family_state:${OWNER}`]); assert.ok(knowledge.nodes['family_state:branch_routing']);
    assert.ok(knowledge.nodes['program:v6.chart_navigation.choose']); assert.ok(knowledge.nodes['program:v6.composition_strategy.choose']);
    writer.emit('point', { caseId: plan.id, sessionId, pointIndex: pointIndex++, method: type, arguments: copy(input),
      execution: ['initialize', 'advance', 'resume', 'held_resume', 'edit'].includes(type) ? schedule(execution) : null,
      returnKind: kind, result: result === undefined ? null : copy(result), snapshot, authorizationIdentity: identity,
      identityBefore: beforeIdentity, publicCurrent: copy(publicCurrent), actualObservation: copy(runtime.observation),
      ownerState: copy(readState()), knowledge, ownerOperations: pendingOperations.splice(0).sort((a, b) => a.ordinal - b.ordinal),
      memoryOperations: pendingMemory.splice(0).sort((a, b) => a.ordinal - b.ordinal), wallClock: { startedMs, finishedMs: Date.now() } });
    receipt.capturePoints++; summary.capturePoints++; phase = null;
    if (kind === 'native_yield') last = result;
    return result;
  }
  async function supply(afterFrame, returnedFrames, expectedKind, sourceStep = null, sourceCaseId = null) {
    assert.equal(last.kind, 'action'); assert.ok(last.authorization); const command = copy(last.command);
    if (sourceStep) selected(last, sourceStep); else assert.notEqual(last.snapshot.lastDecision, OWNER);
    const after = packet(afterFrame, summary.physicalReturns + 1, returnedFrames), before = copy(publicCurrent);
    for (const rows of [after.frame_rows, ...after.frame_packet]) assert.ok(rows.length === 64 && rows.every(row => row.length === 64));
    writer.emit('physical_return', { caseId: plan.id, sessionId, index: summary.physicalReturns,
      selectedFamily: last.snapshot.lastDecision, command, authorization: copy(last.authorization),
      authorizationIdentity: copy(runtime.authorizationIdentity()), before, after,
      sourceStepIndex: sourceStep ? plan.steps.indexOf(sourceStep) : null, sourceCaseId,
      afterFrame, returnedFrames, expectedAcquisition: expectedKind, executionMs: 0 });
    summary.physicalReturns++; receipt.physicalReturns++; publicCurrent = after;
    const result = await invoke('advance', { command, observation: after, executionMs: 0 });
    assert.equal(result.kind, 'boundary'); assert.equal(result.snapshot.actions, summary.physicalReturns);
    await invoke('inspect'); return result;
  }
  function compareAcquired(step, beforeRevision) {
    assert.deepEqual(readState(), step.afterState);
    assert.deepEqual(runtime.knowledge.stateValue(`family_state:${OWNER}`).source_state, step.afterState);
    const events = fact(`chart_navigation_event:${beforeRevision}`); assert.equal(events.length, 1); assert.deepEqual(events[0].value, step.record);
    assert.deepEqual(fact('chart_navigation_state').at(-1).value, step.afterState);
    assert.deepEqual(runtime.knowledge.stateValue(`reasoning:transition:${beforeRevision}`).caller_acquisition.selected_result.events, [step.record]);
  }
  try {
    assert.equal(summary.factoryCalls++, 0); runtime = await createNativeV6Runtime(declarations);
    const registered = runtime.families.filter(family => family.id === OWNER);
    assert.equal(registered.length, 1); owner = registered[0]; assert.equal(runtime.acquisitionFamilies.chart, owner);
    readState = owner.state.bind(owner); assert.deepEqual(readState(), cold);
    const material = runtime.snapshot().coverage.sourceGroups.find(group => group.id === 'factored_material_return');
    const entry = material.entryPoints.indexOf('chart_navigation'); assert.ok(entry > 0);
    assert.equal(material.families[entry], OWNER); assert.equal(material.entryPoints[entry - 1], 'ordered_reaction');
    assert.equal(declarations.strategy.declarations[0].configuration.factored_material_return.ordered_subquestions.indexOf('chart_navigation') + 1, 24);
    writer.emit('owner_binding', { caseId: plan.id, sessionId, id: OWNER, registeredInstances: 1, passiveSameInstance: true,
      entryPoint: 'chart_navigation', sourcePosition: 24, group: copy(material), coldState: copy(readState()) });
    installOwnerCapture(); publicCurrent = packet(plan.steps[0].beforeFrame, 0);
    await invoke('initialize', { sessionId, observation: publicCurrent, budgets: declaration.budgets });
    selected(last, plan.steps[0]);
    const held = { command: copy(last.command), authorization: copy(last.authorization), knowledge: runtime.inspectKnowledge(), ownerState: copy(readState()) };
    await invoke('held_resume');
    assert.deepEqual(last.command, held.command); assert.deepEqual(last.authorization, held.authorization);
    assert.deepEqual(runtime.inspectKnowledge(), held.knowledge); assert.deepEqual(readState(), held.ownerState);
    await invoke('inspect');
    for (const [index, step] of plan.steps.entries()) {
      selected(last, step);
      await supply(step.afterFrame, step.returnedFrames, plan.ablation ? 'suppressed' : 'active', step);
      if (plan.ablation) {
        assert.deepEqual(owner.gains, []); assert.deepEqual(owner.visited, []); assert.deepEqual(owner.evidence, []);
        assert.equal(runtime.snapshot().caller.acquiredTransitions, 1);
        await invoke('resume'); assert.equal(last.kind, 'action'); assert.equal(last.snapshot.lastDecision, OWNER);
        assert.equal(last.snapshot.proposal.chart_plan.offer.kind, 'annotation_dependency');
        assert.notDeepEqual(last.snapshot.proposal.chart_plan.offer, fixture.sequences.primary.steps[1].proposal.chart_plan.offer);
        await invoke('inspect');
      } else compareAcquired(step, step.observation.revision);
      if (index + 1 < plan.steps.length) {
        const priorState = copy(readState()), identity = runtime.authorizationIdentity();
        phase = { type: 'controlled_cold_reset', pointIndex, physicalReturnsBeforeCall: summary.physicalReturns };
        owner.restore(copy(cold));
        writer.emit('controlled_cold_reset', { caseId: plan.id, sessionId, afterReturn: summary.physicalReturns,
          before: priorState, after: copy(readState()), authoritativeGraphIdentity: identity, learnedStateInjected: false });
        phase = null; await invoke('resume'); await invoke('inspect');
      }
    }
    if (plan.passive) {
      const previous = copy(readState()), sourceCaseId = plan.sceneChanged ? 'unattributed_scene_withdraws_location' : 'unattributed_same_scene_preserves_location';
      const sourceCase = fixture.cases.find(row => row.id === sourceCaseId); assert.ok(sourceCase);
      await invoke('edit', { expectedGraphChain: runtime.authorizationIdentity().graphChain,
        reason: 'Declared passive chart capture after an actual cold gain', changes: [{ type: 'set_family_enabled', familyId: OWNER, enabled: false }] });
      await invoke('inspect'); await invoke('resume'); await invoke('inspect');
      const afterFrame = plan.sceneChanged ? 'room_c_empty' : 'room_b_equal_held';
      const returnedFrames = plan.sceneChanged ? ['room_c_boundary4', afterFrame] : [afterFrame];
      await supply(afterFrame, returnedFrames, 'passive', null, sourceCaseId);
      assert.deepEqual(readState(), sourceCase.afterState);
      assert.deepEqual(owner.evidence, previous.evidence); assert.deepEqual(owner.gains, previous.gains); assert.deepEqual(owner.grants, previous.grants);
      const acquired = fact(`chart_navigation_event:${sourceCase.arguments[0].revision}`);
      assert.equal(acquired.length, 1); assert.deepEqual(acquired[0].value, sourceCase.value);
      assert.deepEqual(runtime.knowledge.stateValue(`family_state:${OWNER}`).source_state, sourceCase.afterState);
    }
    assert.equal(summary.physicalReturns, plan.expectedPhysicalReturns); assert.equal(summary.controlledColdResets, plan.coldResets);
    assert.equal(summary.activeChartAcquisitions + summary.passiveChartAcquisitions + summary.suppressedChartAcquisitions, summary.physicalReturns);
    summary.terminal = { sourceState: copy(readState()), snapshot: copy(runtime.snapshot()), authorizationIdentity: copy(runtime.authorizationIdentity()) };
    await invoke('close'); summary.status = 'captured';
  } catch (error) {
    summary.status = 'failed'; summary.error = errorRecord(error);
    writer.emit('session_failure', { caseId: plan.id, sessionId, error: errorRecord(error),
      ownerOperations: pendingOperations.splice(0), memoryOperations: pendingMemory.splice(0), ownerState: readState ? copy(readState()) : null });
    throw error;
  } finally {
    if (runtime && !summary.runtimeClosed) {
      try { await runtime.close('chart_common_capture_finalized'); summary.runtimeClosed = true; }
      catch (error) { summary.closeError = errorRecord(error); summary.status = 'failed'; }
    }
    writer.emit('session_end', { caseId: plan.id, sessionId, summary: copy(summary) });
  }
}

await main();
