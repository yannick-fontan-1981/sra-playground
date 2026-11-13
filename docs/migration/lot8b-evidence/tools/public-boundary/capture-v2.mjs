#!/usr/bin/env node
/** Untimed public Lot8B capture through the unchanged published worker bundle.
 * node capture-v2.mjs --output NEW_DIRECTORY --declaration DECLARATION-v2.json
 * Revision after the retained terminal frame-validation failure in capture-01.
 * No game engine, original oracle, replay, restored acquisition or source edit.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, createWriteStream, fsyncSync, mkdirSync, openSync,
  readFileSync, realpathSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createGzip, gzipSync } from 'node:zlib';
import { BrowserV6Agent } from '../../../../../src/runtime/v6-agent.ts';
import { BrowserV6WorkerClient } from '../../../../../src/runtime/v6-agent-client.ts';
import { nativeV6Action, v6FrameHash } from '../../../../../src/runtime/v6-agent-protocol.ts';
import { buildPublicBranchPresentation } from './presentation.mjs';
import { preparePublishedWorkerTransport } from './worker-transport.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), '../../../../..');
const NATIVE_DIGEST = 'c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a';
const PUBLISHED_COMMIT = '8462204043aa368faa7df280d796bb706eb53b38';
const CASE_IDS = ['single-positive', 'triple-prefix', 'contrary-return'];
const RECOVERABLE_CHECKS = ['wrong_ticket', 'wrong_session', 'wrong_sequence', 'step_index_mismatch',
  'inconsistent_animation', 'negative_execution_duration', 'consumed_ticket'];
const LIMITS = { rpcTimeoutMs: 45_000, globalTimeoutMs: 360_000, maxRawBytes: 2 * 1024 * 1024 * 1024 };
const ORIGINAL_CAPTURE_SHA256 = 'fd9e0b7e2bd92c67e65b0f1e23452c6550ec0e1e9c0ed3bc7ea1a61369a5eed9';
const RUNTIME_INPUTS = ['v6-agent.ts', 'v6-agent-client.ts', 'v6-agent-protocol.ts',
  'contracts.ts', 'v6-agent-worker.ts', 'v6-agent-service.ts'].map(name => `src/runtime/${name}`);
const copy = value => structuredClone(value);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const utc = () => new Date().toISOString();
const label = path => relative(ROOT, path);
const errorRecord = error => ({ name: error?.name ?? 'Error', code: error?.code ?? null,
  message: String(error?.message ?? error), stack: error?.stack ?? null,
  ...(error?.snapshot ? { snapshot: copy(error.snapshot) } : {}) });

function inside(value) {
  const path = resolve(ROOT, value);
  assert.ok(path.startsWith(ROOT + sep), `Path outside the owned checkout: ${path}`);
  return path;
}

async function fingerprint(path) {
  assert.equal(realpathSync(path), path, `Noncanonical input: ${path}`);
  assert.ok(statSync(path).isFile(), `Expected a regular file: ${path}`);
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return { path: label(path), bytes: statSync(path).size, sha256: hash.digest('hex') };
}

function argumentsOf(argv) {
  assert.equal(argv.length, 4, 'Usage: node capture-v2.mjs --output NEW_DIRECTORY --declaration DECLARATION-v2.json');
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    assert.ok(['--output', '--declaration'].includes(argv[index]), 'Unknown capture option');
    assert.equal(Object.hasOwn(args, argv[index]), false, 'Duplicate capture option');
    assert.ok(argv[index + 1] && !argv[index + 1].startsWith('--'), 'Missing capture option value');
    args[argv[index]] = argv[index + 1];
  }
  assert.ok(args['--output'] && args['--declaration']);
  return { output: inside(args['--output']), declarationPath: inside(args['--declaration']) };
}

function rawCapture(path, limit, abort) {
  const fd = openSync(path, 'wx');
  const graphDirectory = resolve(dirname(path), 'graphs');
  mkdirSync(graphDirectory);
  const blobs = new Map();
  let count = 0, bytes = 0, knowledgeBytes = 0, closed = false, failure = null;
  const overLimit = extra => {
    if (bytes + knowledgeBytes + extra <= limit) return;
    failure = new Error(`The declared aggregate raw capture limit of ${limit} bytes would be exceeded`);
    failure.code = 'capture_size_limit';
    abort(failure);
    throw failure;
  };
  const replaceKnowledge = (key, value) => {
    if (key !== 'knowledge' || !value || typeof value !== 'object' || !value.nodes
      || typeof value.nodes !== 'object' || !Array.isArray(value.deltas) || !Object.hasOwn(value, 'chain')) return value;
    // Capture encoding only: the actual structured-clone transport value is
    // never changed. Exact compact JSON bytes are stored once per SHA-256.
    const raw = Buffer.from(JSON.stringify(value));
    const digest = sha(raw);
    if (!blobs.has(digest)) {
      overLimit(raw.length);
      const compressed = gzipSync(raw, { level: 6 });
      const target = resolve(graphDirectory, `${digest}.json.gz`);
      writeFileSync(target, compressed, { flag: 'wx' });
      blobs.set(digest, { sha256: digest, bytes: raw.length, path: label(target),
        gzipSha256: sha(compressed), gzipBytes: compressed.length });
      knowledgeBytes += raw.length;
    }
    return { $captureKnowledgeRef: blobs.get(digest) };
  };
  return {
    emit(type, fields = {}) {
      if (failure) throw failure;
      assert.equal(closed, false, 'The capture stream is already closed');
      try {
        const encoded = Buffer.from(JSON.stringify({ ordinal: count, type, caseId: null, ...fields }, replaceKnowledge) + '\n');
        overLimit(encoded.length);
        let written = 0;
        while (written < encoded.length) written += writeSync(fd, encoded, written, encoded.length - written);
        bytes += written; count += 1;
        return count - 1;
      } catch (error) { failure = error; abort(error); throw error; }
    },
    close() { if (!closed) { closed = true; try { fsyncSync(fd); } finally { closeSync(fd); } } },
    snapshot: () => ({ count, rawBytes: bytes, knowledgeRawBytes: knowledgeBytes, totalRawBytes: bytes + knowledgeBytes,
      failure: failure ? errorRecord(failure) : null }),
    blobs: () => [...blobs.values()].sort((a, b) => a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0),
  };
}

async function sourceInputs(declaration, declarationPath, guard, trackInputs) {
  assert.equal(declaration.schema, 'logos-engine.lot8b.public-boundary-declaration.v2');
  assert.equal(declaration.publishedSourceCommit, PUBLISHED_COMMIT);
  assert.equal(declaration.publishedNativeVersion, '0.67.0');
  assert.deepEqual(declaration.limits, LIMITS);
  assert.deepEqual(declaration.caseIds, CASE_IDS);
  assert.equal(declaration.plannedSessions, 3);
  assert.equal(declaration.plannedPhysicalReturns, 18);
  assert.deepEqual(declaration.negativeProtocolCases, RECOVERABLE_CHECKS);
  assert.ok(Array.isArray(declaration.inputs) && declaration.inputs.every(path => typeof path === 'string'));
  const revision = declaration.scopeRevision;
  assert.ok(revision && typeof revision.id === 'string' && revision.id);
  assert.equal(revision.originalScopePassed, false);
  assert.deepEqual(revision.excludedRecoverableChecks, ['invalid_frame_dimensions', 'invalid_palette']);
  assert.equal(revision.reason, 'structural_frame_errors_are_terminal_in_published_067');
  assert.equal(declaration.priorCapture.receiptPath, revision.previousCaptureReceipt.path);
  assert.equal(declaration.priorCapture.receiptSha256, revision.previousCaptureReceipt.sha256);
  assert.deepEqual(declaration.validationReservation.excludedRecoverableCases, revision.excludedRecoverableChecks);
  assert.equal(declaration.validationReservation.recoveryClaimed, false);
  const prior = JSON.parse(readFileSync(inside(revision.previousCaptureReceipt.path), 'utf8'));
  assert.equal(prior.status, 'failed');
  assert.equal(prior.physicalReturns, 0);
  assert.equal(prior.workersClosed, true);
  assert.equal(prior.inputsUnchanged, true);
  for (const key of ['path', 'bytes', 'sha256']) assert.equal(prior.events[key], revision.previousEvents[key]);
  const candidatePath = inside(declaration.candidateNativePath);
  const buildPath = inside(declaration.buildManifestPath);
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
  const build = JSON.parse(readFileSync(buildPath, 'utf8'));
  assert.equal(candidate.digest, NATIVE_DIGEST);
  assert.equal(candidate.fileCount, 331);
  assert.equal(Object.keys(candidate.files).length, candidate.fileCount);
  const nativeFiles = Object.fromEntries(Object.entries(candidate.files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  assert.equal(sha(JSON.stringify(nativeFiles)), NATIVE_DIGEST);
  assert.equal(build.nativeDigest, NATIVE_DIGEST);
  assert.ok(Array.isArray(build.files) && build.files.length > 0);
  const required = [label(SELF), label(resolve(dirname(SELF), 'presentation.mjs')),
    label(resolve(dirname(SELF), 'worker-transport.mjs')), label(resolve(dirname(SELF), 'worker-bootstrap.mjs')),
    'tests/fixtures/v6-branch-routing-reference.json', ...RUNTIME_INPUTS];
  for (const path of required) assert.ok(declaration.inputs.includes(path), `Declaration omits ${path}`);
  const names = [...new Set([label(declarationPath), declaration.candidateNativePath, declaration.buildManifestPath,
    revision.previousCaptureReceipt.path, revision.previousEvents.path,
    ...declaration.inputs, ...Object.keys(nativeFiles), ...build.files.map(file => file.path)])].sort();
  const before = [];
  trackInputs(names, before);
  for (const name of names) before.push(await guard(fingerprint(inside(name))));
  const byName = new Map(before.map(file => [file.path, file]));
  for (const pin of [revision.previousCaptureReceipt, revision.previousEvents]) {
    assert.deepEqual(byName.get(pin.path), { path: pin.path, bytes: pin.bytes, sha256: pin.sha256 }, 'The retained failed capture must remain intact');
  }
  assert.equal(byName.get('docs/migration/lot8b-evidence/tools/public-boundary/capture.mjs')?.sha256,
    ORIGINAL_CAPTURE_SHA256, 'The original capture tool must remain byte-for-byte unchanged');
  for (const [name, digest] of Object.entries(nativeFiles)) assert.equal(byName.get(name)?.sha256, digest, `Native source changed: ${name}`);
  for (const expected of build.files) {
    assert.deepEqual(byName.get(expected.path), { path: expected.path, bytes: expected.bytes, sha256: expected.sha256 },
      `Published build input changed: ${expected.path}`);
  }
  const publishedRuntime = RUNTIME_INPUTS.map(path => {
    const bytes = execFileSync('git', ['show', `${PUBLISHED_COMMIT}:${path}`],
      { cwd: ROOT, encoding: null, maxBuffer: 8 * 1024 * 1024 });
    const publishedSha256 = sha(bytes);
    assert.equal(byName.get(path)?.sha256, publishedSha256, `Controller/service input differs from published source: ${path}`);
    return { path, publishedSourceCommit: PUBLISHED_COMMIT, publishedSha256,
      workingSha256: byName.get(path).sha256, bytes: bytes.length };
  });
  return { before, names, publishedRuntime, candidateNative: byName.get(label(candidatePath)),
    buildManifest: byName.get(label(buildPath)) };
}

function gameObservation(packet) {
  return {
    gameCode: 'BRANCH_PUBLIC_SYNTHETIC', frame: copy(packet.frame), frames: copy(packet.frames),
    availableActionIds: [...packet.availableActionIds], state: packet.state,
    level: packet.level, levelsCompleted: packet.levelsCompleted, levelCount: 3,
    canUndo: false, canSelectLevel: false, defaultFps: 10,
  };
}

function sameAuthorityAndGraph(before, after) {
  const fields = ['actions', 'cycles', 'level', 'levelsCompleted', 'sourceCommit', 'sourceDigest',
    'graphChain', 'graphRevision', 'nativeExecutionDigest'];
  return before.kind === after.kind && before.phase === after.phase && before.sessionId === after.sessionId
    && isDeepStrictEqual(before.command, after.command) && isDeepStrictEqual(before.ticket, after.ticket)
    && isDeepStrictEqual(before.knowledge, after.knowledge)
    && fields.every(key => before.snapshot[key] === after.snapshot[key]);
}

async function captureCase(plan, declaration, emit, guard, active, sessions) {
  const caseId = plan.id;
  const session = { caseId, status: 'running', startedAt: utc(), sessionId: null,
    expectedPhysicalReturns: plan.expectedReturnCount, physicalReturns: 0, errors: [], closeResult: null,
    closeError: null, workerTransport: null, workersClosed: false };
  sessions.push(session);
  let bridge = null, client = null, agent = null, lastResult = null, pauseArmed = false, disposed = false;
  let current = copy(plan.initial), hostCurrent = gameObservation(current), lastInspection = null;
  let successfulAdvances = 0, inits = 0, resets = 0, dispatches = 0, pendingEngagedPause = null;
  const labels = new Set();
  const counts = () => ({ dispatches, advances: successfulAdvances, inits, resets });
  const operationCounts = {};
  const stop = () => {
    try { agent?.dispose(); } catch (error) { session.errors.push(errorRecord(error)); }
    try { client?.dispose(); } catch (error) { session.errors.push(errorRecord(error)); }
    if (bridge) void bridge.close().catch(() => {});
  };
  active.add(stop);
  const record = (type, fields = {}) => emit(type, { caseId, ...fields });
  const observable = {
    async request(operation) {
      operationCounts[operation.type] = (operationCounts[operation.type] ?? 0) + 1;
      if (operation.type === 'init') { inits += 1; session.sessionId = operation.sessionId; }
      const result = await client.request(operation);
      lastResult = result;
      if (operation.type === 'advance') successfulAdvances += 1;
      // This hook observes the actual reply. It neither changes it nor replaces
      // any ticket, graph or factory. Pause is exclusively the public host API.
      if (pauseArmed && ['init', 'resume'].includes(operation.type) && result.kind === 'action') {
        pauseArmed = false;
        agent.pause();
      }
      return result;
    },
    reset(reason) {
      resets += 1;
      record('transport', { record: { kind: 'controller_reset', reason } });
      client.reset(reason);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      record('transport', { record: { kind: 'controller_dispose' } });
      client.dispose();
    },
  };
  const healthy = sequence => {
    const snapshot = agent.snapshot;
    assert.notEqual(snapshot.status, 'error', snapshot.message);
    assert.equal(snapshot.sequence, sequence, 'Controller observation sequence');
    assert.equal(snapshot.actionCount, sequence, 'Controller physical action count');
    assert.equal(snapshot.actions, sequence, 'Native public action count');
    assert.equal(snapshot.sessionId, session.sessionId);
    assert.equal(dispatches, sequence);
    assert.equal(successfulAdvances, sequence);
    assert.equal(inits, 1);
    assert.equal(resets, 0);
    return snapshot;
  };
  const inspect = async name => {
    const inspectionLabel = `${caseId}/${name}`;
    assert.equal(labels.has(inspectionLabel), false, 'Inspection labels must be unique');
    labels.add(inspectionLabel);
    const knowledge = await guard(agent.inspectKnowledge());
    assert.ok(lastResult?.knowledge, 'The actual inspect RPC must expose its complete graph');
    assert.deepEqual(knowledge, lastResult.knowledge);
    assert.equal(lastResult.knowledge.chain, lastResult.snapshot.graphChain);
    assert.equal(lastResult.sessionId, session.sessionId);
    const item = { label: inspectionLabel, sequence: agent.snapshot.sequence, sessionId: session.sessionId,
      counts: counts(), result: copy(lastResult) };
    record('inspection', item);
    lastInspection = item;
    return item;
  };
  const assertQuestion = (result, expected, expectedMode, actionIndex = null) => {
    assert.equal(result?.kind, 'action', result?.reason ?? 'No public action was authorized');
    assert.ok(result.ticket);
    assert.deepEqual(result.command, expected, 'Actual public command differs from the declared presentation');
    assert.deepEqual(nativeV6Action(result.command), nativeV6Action(result.ticket));
    assert.equal(result.snapshot.lastDecision, 'branch_routing', 'The full factory must actually select BranchRouting');
    assert.equal(result.snapshot.proposal?.steps[result.ticket.actionIndex]?.mode, expectedMode);
    assert.equal(result.ticket.graphChain, result.snapshot.graphChain);
    assert.equal(result.ticket.nativeExecutionDigest, result.snapshot.nativeExecutionDigest);
    if (actionIndex !== null) assert.equal(result.ticket.actionIndex, actionIndex);
  };
  const authorize = async (name, expected, expectedMode, actionIndex = null) => {
    if (lastResult?.kind === 'boundary') {
      const prior = counts();
      pauseArmed = true;
      await guard(agent.step());
      assert.equal(pauseArmed, false, 'Planning did not reach an action to pause');
      assert.equal(agent.snapshot.paused, true);
      assert.deepEqual(counts(), prior, 'Planning/pause must not dispatch or advance');
    }
    const point = await inspect(name);
    assertQuestion(point.result, expected, expectedMode, actionIndex);
    return point;
  };
  const protocolCheck = async (name, operation, expectedCode) => {
    const before = await inspect(`protocol_${name}_before`);
    let error = null, unexpectedResult = null, resumeResult = null, after = null;
    try { unexpectedResult = await guard(observable.request(operation)); }
    catch (caught) { error = { code: caught?.code ?? null, message: String(caught?.message ?? caught) }; }
    if (error === null) {
      record('protocol_check', { name, operation, error, beforeLabel: before.label, afterLabel: null,
        resumeResult: null, preserved: false, unexpectedResult });
      throw new Error(`Invalid operation was accepted: ${name}`);
    }
    try {
      resumeResult = await guard(observable.request({ type: 'resume', sessionId: session.sessionId, sequence: before.sequence }));
      after = await inspect(`protocol_${name}_after`);
    } catch (caught) {
      record('protocol_check', { name, operation, error, beforeLabel: before.label, afterLabel: after?.label ?? null,
        resumeResult, preserved: false, recoveryError: errorRecord(caught) });
      throw caught;
    }
    const preserved = sameAuthorityAndGraph(before.result, after.result)
      && isDeepStrictEqual(before.result.ticket, resumeResult.ticket)
      && before.result.snapshot.graphChain === resumeResult.snapshot.graphChain
      && isDeepStrictEqual(before.counts, after.counts);
    record('protocol_check', { name, operation, error, beforeLabel: before.label, afterLabel: after.label,
      resumeResult, preserved });
    assert.equal(error.code, expectedCode, `${name}: actual service error code`);
    assert.equal(preserved, true, `${name}: rejection changed the pending ticket or acquired graph`);
  };
  try {
    record('session_start', { initial: plan.initial, stepPlan: plan.steps, finalQuestion: plan.finalQuestion,
      coldStartRequired: true, sourceModel: plan.sourceModel, presentationBounds: plan.presentationBounds });
    bridge = await guard(preparePublishedWorkerTransport({ checkout: ROOT,
      buildManifestPath: declaration.buildManifestPath, maxWorkers: 1, startupTimeoutMs: 30_000,
      onRecord: row => record('transport', { record: row }) }));
    client = new BrowserV6WorkerClient(bridge.factory, declaration.limits.rpcTimeoutMs);
    agent = new BrowserV6Agent({ transport: observable, actionsPerLevel: declaration.publicBudgets.levelActionCaps[0],
      targetLevels: declaration.publicBudgets.targetLevels, maxSessionActions: declaration.publicBudgets.maxActions,
      getObservation: () => hostCurrent, canDispatch: () => true,
      onState: snapshot => record('controller_state', { snapshot }),
      async dispatch(action) {
        const dispatchStarted = performance.now();
        const step = plan.steps[dispatches];
        assert.ok(step, 'No return may be supplied beyond the declared case');
        assert.deepEqual(action, nativeV6Action(step.expectedCommand), 'Host command must match before supplying a return');
        assertQuestion(lastResult, step.expectedCommand, step.expectedMode, step.prefix.actionIndex);
        assert.equal(current.stepIndex, step.sequence - 1);
        const ticket = copy(lastResult.ticket);
        assert.equal(ticket.frameHash, await v6FrameHash(current.frame));
        const before = copy(current);
        if (caseId === 'triple-prefix' && step.sequence === 6) {
          assert.equal(lastInspection.sequence, 5);
          pendingEngagedPause = { beforeLabel: lastInspection.label, ticketBefore: ticket, countsBefore: counts() };
          agent.pause();
        }
        current = copy(step.observation);
        hostCurrent = gameObservation(current);
        dispatches += 1;
        session.physicalReturns = dispatches;
        // Measure the synthetic host callback through return construction.
        // The capture write below is outside this window. No game engine runs,
        // and this duration is not an official native performance measurement.
        const executionMs = Math.max(0, performance.now() - dispatchStarted);
        record('host_dispatch', { stepIndex: step.sequence, action, expectedCommand: step.expectedCommand,
          ticket, publicBefore: before, publicAfter: current, executionMs });
        return { observation: hostCurrent, executionMs };
      },
    });
    pauseArmed = true;
    await guard(agent.step());
    healthy(0);
    assert.equal(pauseArmed, false);
    assert.equal(agent.snapshot.paused, true);
    const initial = await inspect('initial_authorization');
    assertQuestion(initial.result, plan.steps[0].expectedCommand, plan.steps[0].expectedMode, 0);
    const initialTicket = copy(initial.result.ticket);
    const initialResume = await guard(observable.request({ type: 'resume', sessionId: session.sessionId, sequence: 0 }));
    const reused = await inspect('initial_pause_reused');
    const initialPreserved = sameAuthorityAndGraph(initial.result, reused.result)
      && isDeepStrictEqual(initial.result.ticket, initialResume.ticket)
      && isDeepStrictEqual(initial.counts, reused.counts);
    record('pause_check', { name: 'before_first_dispatch', sequence: 0, beforeLabel: initial.label, afterLabel: reused.label,
      ticketBefore: initial.result.ticket, ticketAfter: reused.result.ticket,
      countsBefore: initial.counts, countsAfter: reused.counts, preserved: initialPreserved });
    assert.equal(initialPreserved, true, 'Pause must retain the original unexecuted ticket');
    if (caseId === 'single-positive') {
      const valid = () => ({ type: 'advance', sessionId: session.sessionId, sequence: 1,
        ticketId: initialTicket.id, observation: copy(plan.steps[0].observation), executionMs: 0 });
      const negatives = [
        ['wrong_ticket', 'stale', operation => { operation.ticketId += ':invalid'; }],
        ['wrong_session', 'stale', operation => { operation.sessionId += '_wrong'; }],
        ['wrong_sequence', 'stale', operation => { operation.sequence = 2; }],
        ['step_index_mismatch', 'stale', operation => { operation.observation.stepIndex = 2; }],
        ['inconsistent_animation', 'invalid', operation => { operation.observation.frames.at(-1)[0][0] = (operation.observation.frame[0][0] + 1) % 16; }],
        ['negative_execution_duration', 'invalid', operation => { operation.executionMs = -1; }],
      ];
      for (const [name, expectedCode, mutate] of negatives) {
        const operation = valid(); mutate(operation);
        await protocolCheck(name, operation, expectedCode);
      }
    }
    for (const step of plan.steps) {
      await authorize(`before_return_${step.sequence}`, step.expectedCommand, step.expectedMode, step.prefix.actionIndex);
      if (caseId === 'single-positive' && step.sequence === 2) {
        await protocolCheck('consumed_ticket', { type: 'advance', sessionId: session.sessionId, sequence: 2,
          ticketId: initialTicket.id, observation: copy(step.observation), executionMs: 0 }, 'stale');
      }
      await guard(agent.step());
      healthy(step.sequence);
      const after = await inspect(`after_return_${step.sequence}`);
      assert.equal(after.result.snapshot.actions, step.sequence);
      if (pendingEngagedPause && step.sequence === 6) {
        const before = pendingEngagedPause;
        const afterTicket = after.result.ticket;
        const preserved = after.result.kind === 'action' && afterTicket?.actionIndex === 1
          && afterTicket.decisionRevision === before.ticketBefore.decisionRevision
          && afterTicket.id !== before.ticketBefore.id && agent.snapshot.paused
          && after.counts.dispatches === before.countsBefore.dispatches + 1
          && after.counts.advances === before.countsBefore.advances + 1
          && after.counts.inits === before.countsBefore.inits && after.counts.resets === before.countsBefore.resets;
        record('pause_check', { name: 'during_dispatch', sequence: step.sequence,
          beforeLabel: before.beforeLabel, afterLabel: after.label, ticketBefore: before.ticketBefore,
          ticketAfter: afterTicket, countsBefore: before.countsBefore, countsAfter: after.counts, preserved });
        assert.equal(preserved, true, 'An engaged return must be acquired while Pause retains the remaining prefix');
        pendingEngagedPause = null;
      }
    }
    if (plan.finalQuestion) {
      await authorize('final_question', plan.finalQuestion.expectedCommand, plan.finalQuestion.expectedMode, 0);
      healthy(plan.expectedReturnCount);
    }
    assert.equal(dispatches, plan.expectedReturnCount);
    session.status = 'captured';
  } catch (error) {
    session.status = 'failed';
    session.errors.push(errorRecord(error));
  } finally {
    if (session.sessionId && client) {
      try {
        const sequence = agent?.snapshot.sequence ?? successfulAdvances;
        session.closeResult = await guard(observable.request({ type: 'close', sessionId: session.sessionId, sequence }));
        assert.equal(session.closeResult.kind, 'stopped');
        assert.equal(session.closeResult.reason, 'host_session_closed');
        if (lastInspection) assert.equal(session.closeResult.snapshot.graphChain, lastInspection.result.snapshot.graphChain);
      } catch (error) { session.closeError = errorRecord(error); session.errors.push(errorRecord(error)); }
    }
    try { agent?.dispose(); } catch (error) { session.errors.push(errorRecord(error)); }
    // A failed logging callback must never prevent actual worker disposal.
    try { client?.dispose(); } catch (error) { session.errors.push(errorRecord(error)); }
    if (bridge) {
      try { await bridge.close(); } catch (error) { session.errors.push(errorRecord(error)); }
      session.workerTransport = bridge.snapshot();
      session.workersClosed = session.workerTransport.closed && session.workerTransport.workers.length === 1
        && session.workerTransport.workers.every(worker => worker.exitedAt && worker.terminationAcknowledged);
      if (!session.workersClosed) session.errors.push(errorRecord(new Error('A created worker lacks an observed termination acknowledgement')));
    }
    active.delete(stop);
    session.finishedAt = utc(); session.counts = counts(); session.operationCounts = copy(operationCounts);
    if (session.errors.length) session.status = 'failed';
    try { record('session_end', { sessionId: session.sessionId, physicalReturns: dispatches,
      status: session.status, counts: session.counts, closeResult: session.closeResult,
      closeError: session.closeError, workersClosed: session.workersClosed, workerTransport: session.workerTransport,
      errors: session.errors }); }
    catch (error) { session.errors.push(errorRecord(error)); session.status = 'failed'; }
  }
  if (session.status !== 'captured') throw new Error(`Public case failed: ${caseId}; ${session.errors[0]?.message ?? 'unknown failure'}`);
}

async function main() {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'This capture imports the real source TypeScript through Node 24 or later');
  assert.equal(realpathSync(ROOT), ROOT);
  const { output, declarationPath } = argumentsOf(process.argv.slice(2));
  // Exclusive directory creation: an existing capture is never overwritten.
  mkdirSync(output);
  const receiptPath = resolve(output, 'receipt.json');
  const rawPath = resolve(output, 'events.jsonl');
  const eventsPath = resolve(output, 'events.jsonl.gz');
  const presentationPath = resolve(output, 'presentation.json');
  const started = Date.now();
  const active = new Set();
  const controller = new AbortController();
  let rejectAbort;
  const abortPromise = new Promise((_, reject) => { rejectAbort = reject; });
  void abortPromise.catch(() => {});
  const abort = error => {
    if (controller.signal.aborted) return;
    controller.abort(error); rejectAbort(error);
    for (const stop of [...active]) stop();
  };
  const guard = async promise => {
    if (controller.signal.aborted) { void Promise.resolve(promise).catch(() => {}); throw controller.signal.reason; }
    return Promise.race([promise, abortPromise]);
  };
  const deadline = setTimeout(() => {
    const error = new Error(`The declared global capture deadline of ${LIMITS.globalTimeoutMs} ms expired`);
    error.code = 'capture_deadline'; abort(error);
  }, LIMITS.globalTimeoutMs);
  deadline.unref();
  const receipt = { schema: 'logos-engine.lot8b.public-boundary-capture-receipt.v2', status: 'running',
    scope: 'Lot8B_public_boundary_complement', startedAt: utc(), checkout: ROOT,
    declaration: null, limits: LIMITS, events: null, presentation: null,
    knowledgeBlobs: [], knowledgeRawBytes: 0, totalRawBytes: 0, scopeRevision: null,
    inputsBefore: [], inputsAfter: [], inputsUnchanged: false, sessions: [], errors: [],
    publicServiceQualified: false, publicWorkerQualified: false, publicTicketsQualified: false,
    officialPerformanceEligible: false, officialPerformanceMeasurement: false, globalLockUsed: false,
    originalOraclesExecuted: 0, gameEnginesExecuted: 0, gameReplays: 0, acquiredStateInjected: false,
    browserEnvironmentQualified: false, fullOriginalModelIdentityClaimed: false,
    originalCallerWholeParityClaimed: false,
    executionMsMeaning: 'performance_now_synthetic_host_callback_entry_to_public_return_ready_excluding_capture_write_no_game_engine_or_official_performance' };
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  let writer = null, inputNames = [];
  try {
    writer = rawCapture(rawPath, LIMITS.maxRawBytes, abort);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8'));
    receipt.declaration = await guard(fingerprint(declarationPath));
    const inputs = await sourceInputs(declaration, declarationPath, guard, (names, before) => {
      inputNames = names; receipt.inputsBefore = before;
    });
    receipt.inputsBefore = inputs.before; inputNames = inputs.names;
    receipt.publishedRuntimeInputs = inputs.publishedRuntime;
    receipt.candidateNative = inputs.candidateNative; receipt.buildManifest = inputs.buildManifest;
    receipt.scopeRevision = copy(declaration.scopeRevision);
    receipt.priorCapture = copy(declaration.priorCapture);
    receipt.validationReservation = copy(declaration.validationReservation);
    const presentation = buildPublicBranchPresentation();
    assert.deepEqual(presentation.cases.map(row => row.id), CASE_IDS);
    assert.deepEqual(presentation.publicBudgets, declaration.publicBudgets);
    assert.equal(presentation.cases.reduce((total, row) => total + row.steps.length, 0), 18);
    const declaredPresentation = declaration.inputs.find(path => path.endsWith('/presentation-declared.json'));
    if (declaredPresentation) {
      assert.deepEqual(presentation, JSON.parse(readFileSync(inside(declaredPresentation), 'utf8')),
        'The generated data presentation differs from the frozen declaration');
      receipt.declaredPresentation = await guard(fingerprint(inside(declaredPresentation)));
      receipt.presentationMatchesDeclaration = true;
    }
    writeFileSync(presentationPath, JSON.stringify(presentation, null, 2) + '\n', { flag: 'wx' });
    receipt.presentation = await guard(fingerprint(presentationPath));
    receipt.inputsBefore.push(receipt.presentation);
    inputNames.push(label(presentationPath));
    writer.emit('header', { schema: 'logos-engine.lot8b.public-boundary-capture.v2',
      scope: receipt.scope, declaration, declarationInput: receipt.declaration, limits: LIMITS,
      presentation: receipt.presentation, inputsBefore: receipt.inputsBefore,
      publishedRuntimeInputs: receipt.publishedRuntimeInputs,
      scopeRevision: receipt.scopeRevision,
      captureEncoding: { knowledge: '$captureKnowledgeRef', rawBytes: 'JSONL plus each unique full knowledge JSON once',
        graphJson: 'UTF-8 compact JSON without a trailing newline', losslessHydrationRequired: true,
        transportPayloadModified: false, receiptField: 'knowledgeBlobs' },
      nativeDigest: NATIVE_DIGEST, publishedSourceCommit: PUBLISHED_COMMIT,
      publicEntryBoundary: 'BrowserV6Agent -> BrowserV6WorkerClient -> published worker bundle -> V6AgentService -> createNativeV6Runtime',
      executionMsMeaning: receipt.executionMsMeaning,
      countsContract: { dispatches: 'actual host dispatches supplied a retained public return',
        advances: 'successful advance RPC responses only', inits: 'init RPC requests', resets: 'explicit controller transport.reset calls' },
      jsonCaptureQualification: 'Complete JSON projection of actual RPC envelopes and public knowledge. Undefined object properties are omitted by the transport JSON projection; no lists, graph nodes or deltas are shortened.',
      qualification: 'capture_only_requires_independent_reader', officialPerformanceEligible: false,
      browserEnvironmentQualified: false, gameEnginesExecuted: 0, originalOraclesExecuted: 0, acquiredStateInjected: false });
    for (const plan of presentation.cases) {
      await captureCase(plan, declaration, writer.emit.bind(writer), guard, active, receipt.sessions);
      writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
    }
    assert.equal(receipt.sessions.length, 3);
    assert.equal(receipt.sessions.reduce((sum, row) => sum + row.physicalReturns, 0), 18);
  } catch (error) { receipt.errors.push(errorRecord(error)); }
  finally {
    for (const stop of [...active]) stop();
    for (const name of inputNames) {
      try { receipt.inputsAfter.push(await fingerprint(inside(name))); }
      catch (error) { receipt.errors.push(errorRecord(error)); }
    }
    receipt.inputsUnchanged = receipt.inputsBefore.length > 0 && isDeepStrictEqual(receipt.inputsBefore, receipt.inputsAfter);
    if (!receipt.inputsUnchanged) receipt.errors.push(errorRecord(new Error('Source/input fingerprints did not remain identical')));
    try { writer?.close(); } catch (error) { receipt.errors.push(errorRecord(error)); }
    try {
      if (writer) {
        const raw = await fingerprint(rawPath);
        await pipeline(createReadStream(rawPath), createGzip({ level: 6 }), createWriteStream(eventsPath, { flags: 'wx' }));
        receipt.events = { ...await fingerprint(eventsPath), ...writer.snapshot(), rawSha256: raw.sha256 };
        assert.equal(receipt.events.rawBytes, raw.bytes);
        unlinkSync(rawPath);
        receipt.rawIntermediateRemoved = true;
      }
    } catch (error) {
      receipt.errors.push(errorRecord(error));
      receipt.rawIntermediateRetained = label(rawPath);
      receipt.rawCapture = writer?.snapshot() ?? null;
    }
    if (writer) {
      receipt.knowledgeBlobs = writer.blobs();
      receipt.knowledgeRawBytes = writer.snapshot().knowledgeRawBytes;
      receipt.totalRawBytes = writer.snapshot().totalRawBytes;
    }
    clearTimeout(deadline);
    if (controller.signal.aborted) receipt.errors.push(errorRecord(controller.signal.reason));
    receipt.finishedAt = utc(); receipt.elapsedMs = Date.now() - started;
    receipt.physicalReturns = receipt.sessions.reduce((sum, row) => sum + row.physicalReturns, 0);
    receipt.workersClosed = receipt.sessions.length > 0 && receipt.sessions.every(row => row.workersClosed);
    receipt.status = receipt.errors.length === 0 && receipt.sessions.length === 3
      && receipt.sessions.every(row => row.status === 'captured') ? 'captured' : 'failed';
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  }
  process.stdout.write(JSON.stringify({ status: receipt.status, receipt: label(receiptPath),
    events: receipt.events?.count ?? 0, physicalReturns: receipt.physicalReturns, workersClosed: receipt.workersClosed }) + '\n');
  if (receipt.status !== 'captured') process.exitCode = 1;
}

// The separate terminal probe reuses provenance and capture encoding only.
// Importing these helpers does not start the main capture or a native runtime.
export { ROOT, LIMITS, NATIVE_DIGEST, PUBLISHED_COMMIT, sourceInputs, fingerprint, rawCapture, inside, errorRecord };

if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  main().catch(error => { process.stderr.write(JSON.stringify(errorRecord(error)) + '\n'); process.exitCode = 1; });
}
