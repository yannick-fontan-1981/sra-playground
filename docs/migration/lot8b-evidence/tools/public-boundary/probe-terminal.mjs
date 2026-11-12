#!/usr/bin/env node
/** Separate terminal palette-validation probe; no positive scenario or return.
 * node probe-terminal.mjs --output NEW_DIRECTORY --declaration DECLARATION-v2.json
 * Expected: invalid palette -> internal, then resume/close -> stale.
 * The unchanged published service and factory run in one actual worker thread.
 */
import assert from 'node:assert/strict';
import { createReadStream, createWriteStream, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { BrowserV6WorkerClient } from '../../../../../src/runtime/v6-agent-client.ts';
import { buildPublicBranchPresentation } from './presentation.mjs';
import { preparePublishedWorkerTransport } from './worker-transport.mjs';
import { ROOT, LIMITS, NATIVE_DIGEST, PUBLISHED_COMMIT, sourceInputs, fingerprint,
  rawCapture, inside, errorRecord } from './capture-v2.mjs';

const SELF = fileURLToPath(import.meta.url);
const CASE_ID = 'terminal-invalid-palette';
const label = path => relative(ROOT, path);
const copy = value => structuredClone(value);
const utc = () => new Date().toISOString();
const rpcError = error => ({ code: error?.code ?? null, message: String(error?.message ?? error) });

async function main() {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'Node 24 or later is required');
  const argv = process.argv.slice(2);
  assert.equal(argv.length, 4, 'Usage: node probe-terminal.mjs --output NEW_DIRECTORY --declaration DECLARATION-v2.json');
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    assert.ok(['--output', '--declaration'].includes(argv[index]));
    assert.equal(Object.hasOwn(args, argv[index]), false);
    assert.ok(argv[index + 1] && !argv[index + 1].startsWith('--'));
    args[argv[index]] = argv[index + 1];
  }
  assert.ok(args['--output'] && args['--declaration']);
  const output = inside(args['--output']);
  const declarationPath = inside(args['--declaration']);
  mkdirSync(output);
  const receiptPath = resolve(output, 'receipt.json');
  const rawPath = resolve(output, 'events.jsonl');
  const eventsPath = resolve(output, 'events.jsonl.gz');
  const presentationPath = resolve(output, 'presentation.json');
  const started = Date.now();
  let bridge = null, client = null, writer = null, sessionId = null, nativeSequence = 0;
  let successfulAdvances = 0, inputNames = [], initialGraphChain = null;
  const abortController = new AbortController();
  let rejectAbort;
  const abortPromise = new Promise((_, reject) => { rejectAbort = reject; });
  void abortPromise.catch(() => {});
  const abort = error => {
    if (abortController.signal.aborted) return;
    abortController.abort(error); rejectAbort(error);
    client?.dispose();
    if (bridge) void bridge.close().catch(() => {});
  };
  const guard = async promise => {
    if (abortController.signal.aborted) { void Promise.resolve(promise).catch(() => {}); throw abortController.signal.reason; }
    return Promise.race([promise, abortPromise]);
  };
  const deadline = setTimeout(() => {
    const error = new Error(`The terminal probe exceeded its declared ${LIMITS.globalTimeoutMs} ms deadline`);
    error.code = 'capture_deadline'; abort(error);
  }, LIMITS.globalTimeoutMs);
  deadline.unref();
  const receipt = {
    schema: 'logos-engine.lot8b.public-terminal-probe-receipt.v1', status: 'running',
    scope: 'separate_terminal_palette_validation_probe', startedAt: utc(), checkout: ROOT,
    limits: LIMITS, declaration: null, scopeRevision: null, presentation: null,
    events: null, knowledgeBlobs: [], knowledgeRawBytes: 0, totalRawBytes: 0,
    inputsBefore: [], inputsAfter: [], inputsUnchanged: false, errors: [],
    sessionId: null, physicalReturns: 0, validPhysicalReturns: 0, successfulAdvances: 0,
    probe: null, closeResult: null, closeError: null, workerTransport: null, workersClosed: false,
    expectedTerminalOutcome: { error: 'internal', resumeError: 'stale', closeError: 'stale' },
    positiveScenarioQualified: false, publicServiceQualified: false, publicWorkerQualified: false,
    publicTicketsQualified: false, ticketRecoveryClaimed: false, officialPerformanceEligible: false,
    originalOraclesExecuted: 0, gameEnginesExecuted: 0, gameReplays: 0, acquiredStateInjected: false,
    browserEnvironmentQualified: false, globalLockUsed: false,
  };
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  const emit = (type, fields = {}) => writer.emit(type, { caseId: CASE_ID, ...fields });
  const request = async operation => {
    const result = await guard(client.request(operation));
    nativeSequence = result.snapshot.actions;
    if (operation.type === 'advance') successfulAdvances += 1;
    return result;
  };
  try {
    writer = rawCapture(rawPath, LIMITS.maxRawBytes, abort);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8'));
    assert.ok(declaration.inputs.includes(label(SELF)), 'The terminal probe tool must be declared');
    assert.equal(declaration.terminalProbe.kind, 'invalid_palette');
    assert.equal(declaration.terminalProbe.sessions, 1);
    assert.equal(declaration.terminalProbe.validPhysicalReturns, 0);
    assert.equal(declaration.terminalProbe.expectedError, 'internal');
    assert.equal(declaration.terminalProbe.expectedResumeError, 'stale');
    assert.equal(declaration.terminalProbe.ticketRecoveryClaimed, false);
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
    assert.deepEqual(presentation.publicBudgets, declaration.publicBudgets);
    const declaredPresentation = declaration.inputs.find(path => path.endsWith('/presentation-declared.json'));
    if (declaredPresentation) assert.deepEqual(presentation, JSON.parse(readFileSync(inside(declaredPresentation), 'utf8')));
    writeFileSync(presentationPath, JSON.stringify(presentation, null, 2) + '\n', { flag: 'wx' });
    receipt.presentation = await guard(fingerprint(presentationPath));
    receipt.inputsBefore.push(receipt.presentation); inputNames.push(label(presentationPath));
    emit('header', { schema: 'logos-engine.lot8b.public-terminal-probe.v1', declaration,
      scope: receipt.scope, scopeRevision: receipt.scopeRevision, limits: LIMITS,
      declarationInput: receipt.declaration, presentation: receipt.presentation,
      inputsBefore: receipt.inputsBefore, publishedRuntimeInputs: receipt.publishedRuntimeInputs,
      publishedSourceCommit: PUBLISHED_COMMIT, nativeDigest: NATIVE_DIGEST,
      captureEncoding: { knowledge: '$captureKnowledgeRef', rawBytes: 'JSONL plus unique full knowledge JSON',
        losslessHydrationRequired: true, transportPayloadModified: false, receiptField: 'knowledgeBlobs' },
      positiveScenarios: 0, validPhysicalReturns: 0, ticketRecoveryClaimed: false,
      expectedTerminalOutcome: receipt.expectedTerminalOutcome,
      officialPerformanceEligible: false, gameEnginesExecuted: 0, originalOraclesExecuted: 0 });
    const plan = presentation.cases.find(row => row.id === 'single-positive');
    assert.ok(plan);
    sessionId = `branch-public-terminal-${crypto.randomUUID()}`;
    receipt.sessionId = sessionId;
    emit('session_start', { sessionId, initial: plan.initial, stepPlan: [], coldStartRequired: true,
      physicalReturnsPlanned: 0, purpose: 'terminal_structural_validation_only' });
    bridge = await guard(preparePublishedWorkerTransport({ checkout: ROOT,
      buildManifestPath: declaration.buildManifestPath, maxWorkers: 1, startupTimeoutMs: 30_000,
      onRecord: record => emit('transport', { record }) }));
    client = new BrowserV6WorkerClient(bridge.factory, LIMITS.rpcTimeoutMs);
    const initial = await request({ type: 'init', sessionId, sequence: 0, observation: copy(plan.initial), budgets: declaration.publicBudgets });
    assert.equal(initial.kind, 'action');
    assert.ok(initial.ticket);
    assert.equal(initial.snapshot.actions, 0);
    const inspected = await request({ type: 'inspect', sessionId, sequence: 0 });
    assert.ok(inspected.knowledge);
    assert.equal(inspected.knowledge.chain, inspected.snapshot.graphChain);
    assert.deepEqual(inspected.ticket, initial.ticket);
    initialGraphChain = inspected.knowledge.chain;
    const beforeLabel = `${CASE_ID}/initial_authorization`;
    emit('inspection', { label: beforeLabel, sessionId, sequence: 0, result: inspected,
      counts: { dispatches: 0, advances: 0, inits: 1, resets: 0 } });
    const invalid = copy(plan.steps[0].observation);
    invalid.frame[0][0] = 16;
    const operation = { type: 'advance', sessionId, sequence: 1, ticketId: initial.ticket.id,
      observation: invalid, executionMs: 0 };
    let error = null, unexpectedResult = null, resumeResult = null, resumeError = null;
    try { unexpectedResult = await request(operation); } catch (caught) { error = rpcError(caught); }
    const resumeOperation = { type: 'resume', sessionId, sequence: nativeSequence };
    try { resumeResult = await request(resumeOperation); } catch (caught) { resumeError = rpcError(caught); }
    receipt.probe = { name: 'invalid_palette', beforeLabel, operation, error, unexpectedResult,
      resumeOperation, resumeResult, resumeError, physicalReturns: 0,
      suppliedFramePurpose: 'deliberately_invalid_request_no_host_dispatch',
      recoveryClaimed: false, positiveScenarioClaimed: false };
    emit('terminal_probe', receipt.probe);
    assert.equal(error?.code, 'internal', 'The actual structural palette validation outcome differs from the declared terminal expectation');
    assert.equal(resumeError?.code, 'stale', 'The failed service must reject continuation');
    assert.equal(unexpectedResult, null);
    assert.equal(resumeResult, null);
    assert.equal(successfulAdvances, 0);
  } catch (error) { receipt.errors.push(errorRecord(error)); }
  finally {
    if (sessionId && client) {
      const operation = { type: 'close', sessionId, sequence: nativeSequence };
      try { receipt.closeResult = await request(operation); }
      catch (error) { receipt.closeError = rpcError(error); }
      try { emit('terminal_close', { operation, result: receipt.closeResult, error: receipt.closeError,
        expectedError: 'stale', serviceAlreadyClosedExpected: true }); }
      catch (error) { receipt.errors.push(errorRecord(error)); }
    }
    try { client?.dispose(); } catch (error) { receipt.errors.push(errorRecord(error)); }
    if (bridge) {
      try { await bridge.close(); } catch (error) { receipt.errors.push(errorRecord(error)); }
      receipt.workerTransport = bridge.snapshot();
      receipt.workersClosed = receipt.workerTransport.closed && receipt.workerTransport.workers.length === 1
        && receipt.workerTransport.workers.every(worker => worker.exitedAt && worker.terminationAcknowledged);
    }
    receipt.successfulAdvances = successfulAdvances;
    const terminalObserved = receipt.probe?.error?.code === 'internal' && receipt.probe?.resumeError?.code === 'stale'
      && receipt.closeError?.code === 'stale' && receipt.closeResult === null
      && successfulAdvances === 0 && receipt.workersClosed;
    receipt.terminalOutcomeObserved = terminalObserved;
    if (!terminalObserved) receipt.errors.push(errorRecord(new Error('The complete declared terminal outcome was not observed')));
    try { if (writer) emit('session_end', { sessionId, physicalReturns: 0, validPhysicalReturns: 0,
      successfulAdvances, initialGraphChain, terminalOutcomeObserved: terminalObserved,
      closeResult: receipt.closeResult, closeError: receipt.closeError,
      workersClosed: receipt.workersClosed, workerTransport: receipt.workerTransport }); }
    catch (error) { receipt.errors.push(errorRecord(error)); }
    for (const name of inputNames) {
      try { receipt.inputsAfter.push(await fingerprint(inside(name))); }
      catch (error) { receipt.errors.push(errorRecord(error)); }
    }
    receipt.inputsUnchanged = receipt.inputsBefore.length > 0 && isDeepStrictEqual(receipt.inputsBefore, receipt.inputsAfter);
    if (!receipt.inputsUnchanged) receipt.errors.push(errorRecord(new Error('Probe input fingerprints did not remain identical')));
    try { writer?.close(); } catch (error) { receipt.errors.push(errorRecord(error)); }
    try {
      if (writer) {
        const raw = await fingerprint(rawPath);
        await pipeline(createReadStream(rawPath), createGzip({ level: 6 }), createWriteStream(eventsPath, { flags: 'wx' }));
        receipt.events = { ...await fingerprint(eventsPath), ...writer.snapshot(), rawSha256: raw.sha256 };
        assert.equal(receipt.events.rawBytes, raw.bytes);
        unlinkSync(rawPath); receipt.rawIntermediateRemoved = true;
      }
    } catch (error) {
      receipt.errors.push(errorRecord(error)); receipt.rawIntermediateRetained = label(rawPath);
      receipt.rawCapture = writer?.snapshot() ?? null;
    }
    if (writer) {
      receipt.knowledgeBlobs = writer.blobs(); receipt.knowledgeRawBytes = writer.snapshot().knowledgeRawBytes;
      receipt.totalRawBytes = writer.snapshot().totalRawBytes;
    }
    clearTimeout(deadline);
    if (abortController.signal.aborted) receipt.errors.push(errorRecord(abortController.signal.reason));
    receipt.status = receipt.errors.length === 0 && terminalObserved ? 'captured_terminal_failure' : 'failed';
    receipt.finishedAt = utc(); receipt.elapsedMs = Date.now() - started;
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  }
  process.stdout.write(JSON.stringify({ status: receipt.status, receipt: label(receiptPath),
    physicalReturns: 0, terminalOutcomeObserved: receipt.terminalOutcomeObserved, workersClosed: receipt.workersClosed }) + '\n');
  if (receipt.status !== 'captured_terminal_failure') process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  main().catch(error => { process.stderr.write(JSON.stringify(errorRecord(error)) + '\n'); process.exitCode = 1; });
}
