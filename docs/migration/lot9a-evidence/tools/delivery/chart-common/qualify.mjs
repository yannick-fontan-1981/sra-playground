#!/usr/bin/env node
/** Read-only qualification of retained Chart common work forms and full graphs.
 * No owner, native runtime, worker, game or original oracle is instantiated.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createGunzip, gunzipSync } from 'node:zlib';

const SELF = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SELF), '../../../../../..');
const OWNER = 'public_chart_navigation', REFERENCE = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.68.0';
const EXPECTED_NATIVE = { fileCount: 334, digest: 'e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653' };
const IDS = ['primary', 'contrary', 'selected-acquisition-ablation', 'passive-scene-equal', 'passive-scene-changed'];
const METHODS = {
  primary: ['initialize', 'held_resume', 'inspect', 'advance', 'inspect', 'resume', 'inspect', 'advance', 'inspect', 'resume', 'inspect', 'advance', 'inspect', 'close'],
  contrary: ['initialize', 'held_resume', 'inspect', 'advance', 'inspect', 'close'],
  'selected-acquisition-ablation': ['initialize', 'held_resume', 'inspect', 'advance', 'inspect', 'resume', 'inspect', 'close'],
  'passive-scene-equal': ['initialize', 'held_resume', 'inspect', 'advance', 'inspect', 'edit', 'inspect', 'resume', 'inspect', 'advance', 'inspect', 'close'],
  'passive-scene-changed': ['initialize', 'held_resume', 'inspect', 'advance', 'inspect', 'edit', 'inspect', 'resume', 'inspect', 'advance', 'inspect', 'close'],
};
const sha = value => createHash('sha256').update(value).digest('hex'), copy = value => structuredClone(value);
const label = path => relative(ROOT, path), utc = () => new Date().toISOString();
const failRecord = error => ({ name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? null });
function inside(name) { const path = resolve(ROOT, name); assert.ok(path.startsWith(ROOT + sep)); return path; }
function fingerprint(path) { assert.equal(realpathSync(path), path); const data = readFileSync(path);
  return { path: label(path), bytes: data.length, sha256: sha(data) }; }
function argumentsOf(argv) {
  assert.equal(argv.length, 4, 'Usage: qualify.mjs --capture DIRECTORY --output NEW_DIRECTORY'); const args = {};
  for (let index = 0; index < argv.length; index += 2) { assert.ok(['--capture', '--output'].includes(argv[index]));
    assert.equal(args[argv[index]], undefined); args[argv[index]] = inside(argv[index + 1]); }
  assert.ok(args['--capture'] && args['--output']); return { capture: args['--capture'], output: args['--output'] };
}
function fingerprintMatches(pin) { assert.deepEqual(fingerprint(inside(pin.path)), pin, `Retained input changed: ${pin.path}`); }

class GraphBlobs {
  constructor(capture, pins) {
    this.capture = capture; this.pins = new Map(pins.map(pin => [pin.sha256, pin])); this.used = new Set();
    assert.equal(this.pins.size, pins.length); this.perRecord = new Map();
  }
  beginRecord() { this.perRecord.clear(); }
  graph(pin) {
    assert.deepEqual(pin, this.pins.get(pin.sha256));
    const path = inside(pin.path); assert.equal(path, resolve(this.capture, 'graphs', pin.sha256 + '.json.gz'));
    this.used.add(pin.sha256); if (this.perRecord.has(pin.sha256)) return this.perRecord.get(pin.sha256);
    const compressed = readFileSync(path); assert.equal(compressed.length, pin.gzipBytes); assert.equal(sha(compressed), pin.gzipSha256);
    const raw = gunzipSync(compressed); assert.equal(raw.length, pin.rawBytes); assert.equal(sha(raw), pin.sha256);
    const value = JSON.parse(raw.toString('utf8')); assert.deepEqual(Object.keys(value).sort(), ['chain', 'deltas', 'nodes']);
    this.perRecord.set(pin.sha256, value); return value;
  }
  expand(value) {
    if (value === null || typeof value !== 'object') return value;
    if (!Array.isArray(value) && Object.hasOwn(value, '$chartGraphRef')) {
      assert.deepEqual(Object.keys(value), ['$chartGraphRef']); return this.graph(value.$chartGraphRef);
    }
    if (Array.isArray(value)) return value.map(item => this.expand(item));
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, this.expand(child)]));
  }
  finish() {
    assert.deepEqual([...this.used].sort(), [...this.pins.keys()].sort(), 'Every retained graph blob must be referenced');
    assert.deepEqual(readdirSync(resolve(this.capture, 'graphs')).sort(), [...this.pins.keys()].map(key => key + '.json.gz').sort());
    for (const pin of this.pins.values()) {
      const data = readFileSync(inside(pin.path)); assert.equal(data.length, pin.gzipBytes); assert.equal(sha(data), pin.gzipSha256);
    }
  }
}

async function* records(path, integrity) {
  const source = createReadStream(path), stream = source.pipe(createGunzip()), decoder = new StringDecoder('utf8');
  const hash = createHash('sha256'); let buffer = '', bytes = 0, ordinal = 0;
  source.on('error', error => stream.destroy(error));
  for await (const chunk of stream) {
    hash.update(chunk); bytes += chunk.length; buffer += decoder.write(chunk);
    let index;
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); assert.ok(line);
      const value = JSON.parse(line); assert.equal(value.ordinal, ordinal++); yield value;
    }
  }
  buffer += decoder.end(); assert.equal(buffer, '', 'Capture must end on a complete JSONL record');
  Object.assign(integrity, { rawBytes: bytes, rawSha256: hash.digest('hex'), records: ordinal });
}

class Reader {
  constructor(fixture, receipt, functions) {
    this.fixture = fixture; this.receipt = receipt; Object.assign(this, functions);
    this.header = null; this.footer = null; this.current = null; this.sessions = []; this.runtimeDigest = null;
    this.totalPoints = 0; this.totalReturns = 0;
  }
  packet(name, index, frames = null) {
    return { ...copy(this.fixture.frames[name].public), step_index: index,
      ...(frames ? { frame_packet: frames.map(id => copy(this.fixture.frames[id].rows)) } : {}) };
  }
  expected(id, index) {
    if (id === 'primary') return { step: this.fixture.sequences.primary.steps[index], kind: 'active' };
    if (id === 'contrary') return { step: this.fixture.sequences.contraryAnchor.steps[index], kind: 'active' };
    if (id === 'selected-acquisition-ablation') return { step: this.fixture.sequences.primary.steps[0], kind: 'suppressed' };
    if (index === 0) return { step: this.fixture.sequences.primary.steps[0], kind: 'active' };
    const changed = id === 'passive-scene-changed', caseId = changed ? 'unattributed_scene_withdraws_location' : 'unattributed_same_scene_preserves_location';
    return { row: this.fixture.cases.find(row => row.id === caseId), kind: 'passive', caseId,
      afterFrame: changed ? 'room_c_empty' : 'room_b_equal_held',
      returnedFrames: changed ? ['room_c_boundary4', 'room_c_empty'] : ['room_b_equal_held'] };
  }
  nodeValue(state, node) {
    assert.ok(node); const value = node.value;
    return this.isNativeStateGraph(value) ? this.hydrateNativeState(value, id => {
      const fragment = state.nodes[id]; assert.ok(fragment); assert.equal(fragment.kind, 'state_fragment'); return fragment.value;
    }) : this.decodeNativeState(value);
  }
  facts(state, key) {
    const memory = this.nodeValue(state, state.nodes['reasoning:memory']);
    return memory.facts.map(id => this.nodeValue(state, state.nodes[id])).filter(fact => fact.key === key);
  }
  async graph(state, row) {
    const graph = row.knowledge, snapshot = row.snapshot;
    assert.deepEqual(Object.keys(graph).sort(), ['chain', 'deltas', 'nodes']); assert.ok(Array.isArray(graph.deltas));
    if (state.sourceDigest === null) {
      state.sourceDigest = snapshot.sourceDigest; state.kernel = new this.NativeKnowledgeStore(state.sourceDigest, state.sessionId).kernel;
      if (this.runtimeDigest === null) this.runtimeDigest = state.sourceDigest; else assert.equal(state.sourceDigest, this.runtimeDigest);
    }
    assert.equal(snapshot.sourceDigest, state.sourceDigest); assert.equal(snapshot.sourceCommit, REFERENCE); assert.equal(snapshot.implementation, IMPLEMENTATION);
    assert.ok(graph.deltas.length >= state.deltas.length);
    for (let index = 0; index < state.deltas.length; index++) assert.deepEqual(graph.deltas[index], state.deltas[index], 'Historical graph deltas must remain intact');
    const previous = state.deltas.length;
    for (const delta of graph.deltas.slice(previous)) {
      assert.deepEqual(Object.keys(delta).sort(), ['cause', 'digest', 'node', 'previous', 'sequence', 'source_digest']);
      assert.equal(delta.sequence, state.deltas.length + 1); assert.equal(delta.previous, state.chain); assert.equal(delta.source_digest, state.sourceDigest);
      state.kernel.validateNode(delta.node); assert.equal(delta.node.scope, state.sessionId);
      assert.equal(delta.node.origin.source_digest, state.sourceDigest); assert.equal(delta.node.origin.store_profile, this.NATIVE_STORE_PROFILE);
      const earlier = state.nodes[delta.node.id]; assert.equal(delta.node.revision, (earlier?.revision ?? 0) + 1);
      if (earlier) { assert.equal(delta.node.kind, earlier.kind); assert.deepEqual(delta.node.origin, earlier.origin);
        assert.equal(isDeepStrictEqual({ ...delta.node, revision: earlier.revision }, earlier), false, 'No-op graph delta'); }
      if (delta.node.kind === 'state_fragment') assert.equal(delta.node.id, `state_fragment:${this.symbolicDigest(delta.node.value, false)}`);
      assert.equal(await this.digest({ sequence: delta.sequence, previous: delta.previous, node: delta.node, cause: delta.cause, source_digest: delta.source_digest }), delta.digest);
      state.nodes[delta.node.id] = delta.node; state.deltas.push(delta); state.chain = delta.digest; state.chains.set(delta.digest, delta.sequence);
      if (delta.node.id === `family_state:${OWNER}`) state.ownerRoots.push({ sequence: delta.sequence, node: delta.node });
    }
    assert.deepEqual(graph.nodes, state.nodes, 'The complete materialized graph must equal reconstruction from every delta');
    assert.equal(graph.chain, state.chain); assert.equal(snapshot.graphChain, state.chain);
    assert.equal(snapshot.graphRevision, state.deltas.length); assert.equal(snapshot.nodeCount, Object.keys(state.nodes).length);
    for (const delta of graph.deltas.slice(previous)) if (this.isNativeStateGraph(delta.node.value)) this.nodeValue(state, delta.node);
    const executable = Object.values(state.nodes).filter(node => ['program', 'family_activation'].includes(node.kind))
      .sort((a, b) => this.compareUnicode(a.id, b.id)).map(node => ({ id: node.id, value: node.value }));
    assert.equal(await this.digest({ profile: this.NATIVE_STORE_PROFILE, source_digest: state.sourceDigest, nodes: executable }), snapshot.nativeExecutionDigest);
    assert.deepEqual(row.authorizationIdentity, { graphChain: state.chain, nativeExecutionDigest: snapshot.nativeExecutionDigest });
    for (const id of [`family_state:${OWNER}`, 'family_state:branch_routing', 'program:v6.chart_navigation.choose',
      'program:v6.composition_strategy.choose', 'program:prototype.laya_router.route']) assert.ok(state.nodes[id], `Missing retained root ${id}`);
    const chart = this.nodeValue(state, state.nodes[`family_state:${OWNER}`]);
    assert.equal(chart.format, 'native.public_chart_navigation.v1'); assert.deepEqual(Object.keys(chart).sort(), ['format', 'source_state']);
    assert.deepEqual(chart.source_state, row.ownerState); assert.deepEqual(Object.keys(row.ownerState).sort(), [...this.fixture.stateFields].sort());
    if (['inspect', 'held_resume', 'close'].includes(row.method)) assert.equal(state.deltas.length, previous, `${row.method} must not create graph changes`);
    return previous;
  }
  operations(state, row) {
    const operations = row.ownerOperations, memory = row.memoryOperations, byOrdinal = new Map(operations.map(op => [op.ordinal, op]));
    for (const op of operations) {
      assert.equal(op.ordinal, state.ownerOperationCount++); assert.equal(Object.hasOwn(op, 'exception'), false);
      assert.ok(op.startedActivity < op.completedActivity); state.activities.push(op.startedActivity, op.completedActivity);
      assert.deepEqual(Object.keys(op.sourceBefore).sort(), [...this.fixture.stateFields].sort());
      assert.deepEqual(Object.keys(op.sourceAfter).sort(), [...this.fixture.stateFields].sort());
      if (op.parentOrdinal !== null) { const parent = byOrdinal.get(op.parentOrdinal); assert.ok(parent);
        assert.equal(op.depth, parent.depth + 1); assert.ok(parent.startedActivity < op.startedActivity && op.completedActivity < parent.completedActivity); }
      else assert.equal(op.depth, 0);
      if (op.graphAtStart) assert.equal(state.chains.get(op.graphAtStart.chain), op.graphAtStart.revision);
      if (op.method === 'restoreNative') {
        const root = state.ownerRoots.filter(item => item.sequence <= op.graphAtStart.revision).at(-1); assert.ok(root);
        assert.equal(root.node.revision, op.graphAtStart.ownerRootRevision);
        assert.deepEqual(op.arguments.state, this.nodeValue(state, root.node));
        assert.deepEqual(op.sourceAfter, op.arguments.state.source_state); assert.equal(op.returnKind, 'undefined');
        state.nativeRestorations.push({ operation: op.ordinal, rootRevision: root.node.revision, graphRevision: op.graphAtStart.revision });
      }
      if (op.method === 'nativeState') { assert.equal(op.returnValue.format, 'native.public_chart_navigation.v1');
        assert.deepEqual(op.returnValue.source_state, op.sourceAfter); assert.deepEqual(op.sourceAfter, op.sourceBefore); }
      if (op.method === 'restore') {
        assert.deepEqual(op.sourceAfter, op.arguments.state); assert.equal(op.returnKind, 'undefined');
        if (op.phase.type === 'controlled_cold_reset') {
          const reset = state.resets.find(item => item.afterReturn === op.phase.physicalReturnsBeforeCall); assert.ok(reset);
          assert.deepEqual(op.sourceBefore, reset.before); assert.deepEqual(op.sourceAfter, reset.after); state.coldRestoreCalls++;
        } else {
          assert.equal(op.phase.type, 'advance');
          const get = memory.find(item => item.method === 'get' && item.completedActivity < op.startedActivity
            && isDeepStrictEqual(item.returnValue.value, op.arguments.state)); assert.ok(get, 'Source restore must consume an actually observed source-memory get');
          const put = memory.find(item => item.method === 'put' && item.completedActivity < get.startedActivity
            && isDeepStrictEqual(item.arguments[2], op.arguments.state)); assert.ok(put, 'Source get must follow the observed current source-state put');
          assert.deepEqual(this.facts(state, 'chart_navigation_state').at(-1).value, op.arguments.state);
          state.sourceRestorations.push({ operation: op.ordinal, get: get.ordinal, put: put.ordinal, physicalReturn: op.phase.physicalReturnsBeforeCall });
        }
      }
      const suppressed = state.id === 'selected-acquisition-ablation' && op.method === 'recordSource';
      assert.equal(op.originalInvoked, !suppressed);
      if (suppressed) { assert.equal(op.returnKind, 'null'); assert.deepEqual(op.sourceAfter, op.sourceBefore); }
      if (op.method === 'before') assert.equal(op.returnValue.admitted, true);
    }
    for (const op of memory) {
      assert.equal(op.ordinal, state.memoryOperationCount++); assert.equal(Object.hasOwn(op, 'exception'), false);
      assert.deepEqual(op.arguments.slice(0, 2), ['common-observation-frontier', 'chart_navigation_state']);
      assert.ok(op.startedActivity < op.completedActivity); state.activities.push(op.startedActivity, op.completedActivity);
    }
    const sourceRecords = operations.filter(op => op.method === 'recordSource');
    if (row.method === 'advance') {
      const physical = state.pendingReturn; assert.ok(physical); const expected = this.expected(state.id, state.returns.length - 1);
      assert.equal(sourceRecords.length, 1, 'Count recordSource once, independently of its native record wrapper');
      const op = sourceRecords[0], args = op.arguments;
      assert.deepEqual(args.before, physical.beforeObservation); assert.deepEqual(args.after, row.actualObservation);
      assert.deepEqual(args.command, physical.command); assert.deepEqual(args.firstRows, physical.before.frame_rows);
      assert.deepEqual(args.secondRows, physical.after.frame_rows); assert.deepEqual(args.frames, physical.after.frame_packet); assert.equal(args.index, 0);
      const wrappers = operations.filter(item => item.method === 'record');
      if (expected.kind === 'passive') { assert.equal(args.proposal, null); assert.equal(wrappers.length, 0); state.passive++; }
      else { assert.equal(wrappers.length, 1); assert.equal(op.parentOrdinal, wrappers[0].ordinal);
        assert.deepEqual(args.proposal, physical.selectedProposal);
        assert.deepEqual(wrappers[0].returnValue, { events: expected.kind === 'suppressed' ? [] : [op.returnValue] });
        if (expected.kind === 'suppressed') state.suppressed++; else state.active++; }
      if (expected.kind !== 'suppressed') {
        const record = expected.step ? expected.step.record : expected.row.value, afterState = expected.step ? expected.step.afterState : expected.row.afterState;
        assert.deepEqual(op.returnValue, record); assert.deepEqual(op.sourceAfter, afterState); assert.deepEqual(row.ownerState, afterState);
        const events = this.facts(state, `chart_navigation_event:${args.before.revision}`); assert.equal(events.length, 1); assert.deepEqual(events[0].value, record);
        assert.deepEqual(this.facts(state, 'chart_navigation_state').at(-1).value, afterState);
        if (expected.kind === 'active') assert.deepEqual(this.nodeValue(state, state.nodes[`reasoning:transition:${args.before.revision}`]).caller_acquisition.selected_result.events, [record]);
      } else { assert.deepEqual(row.ownerState.evidence, []); assert.deepEqual(row.ownerState.gains, []); assert.deepEqual(row.ownerState.visited, []); }
      state.pendingReturn = null;
    } else assert.equal(sourceRecords.length, 0, 'Planning, inspection, reset and closure must not invent acquired returns');
    if (state.pendingReset) {
      assert.ok(operations.some(op => op.method === 'restoreNative' && isDeepStrictEqual(op.sourceBefore, state.pendingReset.after)
        && isDeepStrictEqual(op.sourceAfter, state.pendingReset.before)), 'The common graph must really restore acquired state after the controlled cold reset');
      state.recoveredColdResets++; state.pendingReset = null;
    }
  }
  async point(row) {
    const state = this.current; assert.ok(state); assert.equal(row.caseId, state.id); assert.equal(row.sessionId, state.sessionId);
    assert.equal(row.method, METHODS[state.id][state.points], 'Every promised work form must occur exactly in the declared order');
    assert.deepEqual(row.identityBefore, state.last?.authorizationIdentity ?? null);
    if (row.method === 'initialize') assert.deepEqual(row.arguments, { sessionId: state.sessionId,
      observation: state.publicCurrent, budgets: this.header.declaration.budgets });
    else if (row.method === 'advance') assert.deepEqual(row.arguments, { command: state.pendingReturn.command,
      observation: state.pendingReturn.after, executionMs: 0 });
    else if (row.method !== 'edit') assert.equal(row.arguments, null);
    assert.equal(row.pointIndex, state.points++); this.totalPoints++;
    await this.graph(state, row); this.operations(state, row);
    assert.equal(row.snapshot.actions, state.returns.length); assert.equal(row.snapshot.levelsCompleted, 0);
    assert.deepEqual(row.publicCurrent, state.publicCurrent);
    if (row.returnKind === 'native_yield') {
      assert.deepEqual(row.result.snapshot, row.snapshot, 'Both complete native snapshots must agree after the timed call has finished');
      assert.equal(row.result.snapshot.graphChain, state.chain); assert.equal(row.result.snapshot.graphRevision, state.deltas.length);
      assert.equal(row.result.snapshot.nativeExecutionDigest, row.snapshot.nativeExecutionDigest);
      assert.deepEqual(row.result.snapshot.proposal, row.snapshot.proposal);
      if (row.result.kind === 'action' && row.result.snapshot.lastDecision === OWNER) {
        assert.ok(row.result.authorization); assert.equal(row.result.snapshot.proposal.material_access_subquestion, 'chart_navigation');
        assert.equal(row.result.snapshot.proposal.bundle_template.operation_key, 'OP18');
        assert.equal(row.result.snapshot.proposal.strategy_receipt.selected, 'factored_material_return');
        assert.equal(row.result.snapshot.whyAct.decision.decision.status, 'action_set_released');
        assert.equal(row.result.snapshot.proposal.chart_plan.choice.release_authority, false);
        if (state.id === 'selected-acquisition-ablation' && state.returns.length === 1) {
          assert.equal(row.result.snapshot.proposal.chart_plan.offer.kind, 'annotation_dependency');
          assert.notDeepEqual(row.result.snapshot.proposal.chart_plan.offer, this.fixture.sequences.primary.steps[1].proposal.chart_plan.offer);
        } else {
          const expected = this.expected(state.id, state.returns.length); assert.ok(expected.step);
          assert.deepEqual(row.result.command, expected.step.proposal.actions[0]);
          assert.deepEqual(row.result.snapshot.proposal.chart_plan, expected.step.proposal.chart_plan);
        }
      }
      if (row.method === 'held_resume') {
        assert.deepEqual(row.result.command, state.lastYield.result.command); assert.deepEqual(row.result.authorization, state.lastYield.result.authorization);
        assert.deepEqual(row.ownerState, state.last.ownerState);
      }
      state.lastYield = row;
    } else if (row.returnKind === 'knowledge_memory') { assert.equal(row.method, 'inspect'); assert.deepEqual(row.result, row.knowledge); }
    else { assert.equal(row.returnKind, 'undefined'); assert.equal(row.method, 'close'); assert.equal(row.result, null); state.closed = true; }
    if (row.method === 'edit') {
      assert.ok(state.id.startsWith('passive-')); assert.deepEqual(row.arguments.changes, [{ type: 'set_family_enabled', familyId: OWNER, enabled: false }]);
      assert.equal(this.nodeValue(state, state.nodes[`family_activation:${OWNER}`]).enabled, false);
    }
    state.currentObservation = row.actualObservation; state.last = row;
  }
  async accept(row) {
    if (row.type === 'header') {
      assert.equal(this.header, null); this.header = row;
      const declaredPin = this.receipt.inputsBefore.find(pin => pin.path === row.declarationPin.path);
      assert.ok(declaredPin); assert.deepEqual(row.declarationPin, declaredPin); fingerprintMatches(declaredPin);
      assert.deepEqual(row.declaration, JSON.parse(readFileSync(inside(declaredPin.path), 'utf8')), 'Header must contain the actual frozen declaration');
      assert.equal(row.declaration.schema, 'logos-engine.lot9a.chart-common-declaration.v1'); assert.equal(row.declaration.allowExecution, true);
      for (const pin of row.declaration.inputPins) assert.deepEqual(pin, this.receipt.inputsBefore.find(actual => actual.path === pin.path));
      assert.equal(row.sourceHead, this.receipt.sourceHeadBefore); assert.equal(this.receipt.sourceHeadAfter, row.sourceHead);
      assert.deepEqual(row.fixturePin, this.receipt.inputsBefore.find(pin => pin.path === row.declaration.fixturePath));
      assert.deepEqual(row.candidateNative, EXPECTED_NATIVE); assert.equal(row.declaration.expectedImplementation, IMPLEMENTATION);
      assert.deepEqual(row.declaration.caseIds, IDS); assert.equal(row.declaration.sessionId, 'chart:synthetic');
      assert.deepEqual(row.declaration.inheritedFunctionalAccounting, { initializedSessions: 10, physicalReturns: 14 }); return;
    }
    assert.ok(this.header);
    if (row.type === 'session_start') {
      assert.equal(this.current, null); assert.equal(row.caseId, IDS[this.sessions.length]); assert.equal(row.sessionId, 'chart:synthetic');
      assert.deepEqual(row.coldState, this.fixture.sequences.primary.coldState); assert.equal(row.fixtureRastersAdapted, false);
      assert.equal(row.acquiredStateInjected, false); assert.equal(row.groupSelectionFiltered, false);
      const first = this.expected(row.caseId, 0).step;
      this.current = { id: row.caseId, sessionId: row.sessionId, sourceDigest: null, kernel: null, nodes: {}, deltas: [], chain: null,
        chains: new Map([[null, 0]]), ownerRoots: [], points: 0, returns: [], pendingReturn: null, last: null, lastYield: null,
        currentObservation: null, publicCurrent: this.packet(first.beforeFrame, 0), ownerOperationCount: 0, memoryOperationCount: 0,
        activities: [], active: 0, passive: 0, suppressed: 0, nativeRestorations: [], sourceRestorations: [], coldRestoreCalls: 0,
        resets: [], pendingReset: null, recoveredColdResets: 0, closed: false }; return;
    }
    if (row.type === 'owner_binding') {
      assert.equal(row.caseId, this.current.id); assert.equal(row.id, OWNER); assert.equal(row.registeredInstances, 1); assert.equal(row.passiveSameInstance, true);
      assert.equal(row.entryPoint, 'chart_navigation'); assert.equal(row.sourcePosition, 24);
      assert.deepEqual(row.coldState, this.fixture.sequences.primary.coldState); return;
    }
    if (row.type === 'point') return this.point(row);
    if (row.type === 'physical_return') {
      const state = this.current; assert.equal(row.caseId, state.id); assert.equal(row.index, state.returns.length); assert.equal(state.pendingReturn, null);
      const expected = this.expected(state.id, row.index), last = state.lastYield;
      assert.equal(last.result.kind, 'action'); assert.deepEqual(row.command, last.result.command); assert.deepEqual(row.authorization, last.result.authorization);
      assert.deepEqual(row.authorizationIdentity, last.authorizationIdentity); assert.deepEqual(row.before, state.publicCurrent);
      assert.equal(row.expectedAcquisition, expected.kind);
      const afterFrame = expected.step ? expected.step.afterFrame : expected.afterFrame, frames = expected.step ? expected.step.returnedFrames : expected.returnedFrames;
      assert.equal(row.afterFrame, afterFrame); assert.deepEqual(row.returnedFrames, frames);
      assert.deepEqual(row.after, this.packet(afterFrame, row.index + 1, frames));
      if (expected.kind === 'passive') assert.notEqual(row.selectedFamily, OWNER); else assert.equal(row.selectedFamily, OWNER);
      const physical = { ...row, beforeObservation: copy(state.currentObservation), selectedProposal: copy(last.result.snapshot.proposal) };
      state.returns.push(physical); state.pendingReturn = physical; state.publicCurrent = row.after; this.totalReturns++; return;
    }
    if (row.type === 'controlled_cold_reset') {
      const state = this.current; assert.equal(state.id, 'primary'); assert.equal(row.afterReturn, state.returns.length);
      assert.deepEqual(row.before, state.last.ownerState); assert.deepEqual(row.after, this.fixture.sequences.primary.coldState);
      assert.deepEqual(row.authoritativeGraphIdentity, state.last.authorizationIdentity); assert.equal(row.learnedStateInjected, false);
      state.resets.push(row); state.pendingReset = row; return;
    }
    if (row.type === 'session_end') {
      const state = this.current, expectedReturns = [3, 1, 1, 2, 2][IDS.indexOf(state.id)];
      assert.equal(row.caseId, state.id); assert.equal(row.summary.status, 'captured'); assert.equal(row.summary.runtimeClosed, true); assert.equal(state.closed, true);
      assert.equal(state.returns.length, expectedReturns); assert.equal(row.summary.physicalReturns, expectedReturns);
      assert.equal(state.pendingReturn, null); assert.equal(state.pendingReset, null);
      assert.equal(state.active + state.passive + state.suppressed, expectedReturns);
      assert.equal(row.summary.activeChartAcquisitions, state.active); assert.equal(row.summary.passiveChartAcquisitions, state.passive);
      assert.equal(row.summary.suppressedChartAcquisitions, state.suppressed); assert.equal(row.summary.nativeRestoreCalls, state.nativeRestorations.length);
      assert.equal(row.summary.sourceFactRestorations, state.sourceRestorations.length); assert.equal(row.summary.controlledColdResets, state.coldRestoreCalls);
      assert.deepEqual(row.summary, this.receipt.sessions[this.sessions.length], 'Session-end ledger must equal the retained receipt');
      assert.equal(row.summary.initialized, true); assert.equal(row.summary.factoryCalls, 1);
      assert.equal(state.points, METHODS[state.id].length);
      assert.equal(row.summary.capturePoints, state.points); assert.equal(row.summary.ownerOperations, state.ownerOperationCount);
      assert.equal(row.summary.memoryOperations, state.memoryOperationCount);
      assert.equal(state.coldRestoreCalls, state.id === 'primary' ? 2 : 0); assert.equal(state.recoveredColdResets, state.coldRestoreCalls);
      assert.equal(state.sourceRestorations.length, expectedReturns); assert.ok(state.nativeRestorations.length > 0);
      assert.deepEqual([...state.activities].sort((a, b) => a - b), Array.from({ length: state.activities.length }, (_, index) => index));
      assert.deepEqual(row.summary.terminal.sourceState, state.last.ownerState);
      this.sessions.push({ caseId: state.id, physicalReturns: expectedReturns, activeChartAcquisitions: state.active, passiveChartAcquisitions: state.passive,
        suppressedChartAcquisitions: state.suppressed, capturePoints: state.points, sourceFactRestorations: state.sourceRestorations,
        controlledColdResets: state.coldRestoreCalls, recoveredColdResets: state.recoveredColdResets, nativeRestorations: state.nativeRestorations,
        graphNodes: Object.keys(state.nodes).length, graphDeltas: state.deltas.length, finalGraphChain: state.chain,
        ownerOperationCount: state.ownerOperationCount, memoryOperationCount: state.memoryOperationCount });
      this.current = null; return;
    }
    if (row.type === 'footer') { assert.equal(this.footer, null); this.footer = row; assert.equal(row.status, 'captured_synthetic_common_graphs'); return; }
    throw new Error(`Unexpected capture record: ${row.type}`);
  }
  finish() {
    assert.equal(this.current, null); assert.ok(this.footer); assert.equal(this.sessions.length, 5); assert.equal(this.totalReturns, 9);
    assert.equal(this.totalPoints, 52);
    assert.equal(this.totalPoints, this.receipt.capturePoints); assert.equal(this.footer.capturePoints, this.totalPoints);
    assert.equal(this.receipt.sessions.length, this.sessions.length); assert.equal(this.receipt.sessionStarts, this.sessions.length);
    assert.equal(this.receipt.initializedSessions, this.sessions.length); assert.equal(this.receipt.physicalReturns, this.totalReturns);
    assert.equal(this.footer.sessionStarts, this.sessions.length); assert.equal(this.footer.initializedSessions, this.sessions.length);
    assert.equal(this.footer.physicalReturns, this.totalReturns);
    assert.equal(this.sessions.reduce((sum, row) => sum + row.activeChartAcquisitions, 0), 6);
    assert.equal(this.sessions.reduce((sum, row) => sum + row.passiveChartAcquisitions, 0), 2);
    assert.equal(this.sessions.reduce((sum, row) => sum + row.suppressedChartAcquisitions, 0), 1);
    const limits = this.header.declaration.limits, prior = this.verifiedPriorReceipts;
    assert.equal(this.receipt.attempt, prior.length + 1); assert.ok(this.receipt.attempt <= limits.maximumAttempts);
    const totals = { sessionStarts: this.sessions.length, initializedSessions: this.sessions.length,
      physicalReturns: this.totalReturns, elapsedSeconds: this.receipt.elapsedSeconds };
    assert.ok(Number.isFinite(totals.elapsedSeconds) && totals.elapsedSeconds >= 0);
    for (const [index, previous] of prior.entries()) {
      const value = previous.receipt;
      assert.equal(previous.pin.path, label(resolve(inside(this.header.declaration.stageRoot),
        `common-capture-${String(index + 1).padStart(2, '0')}/capture/receipt.json`)));
      assert.equal(value.attempt, index + 1);
      assert.equal(value.sessionStarts, value.sessions.length);
      assert.equal(value.initializedSessions, value.sessions.filter(session => session.initialized).length);
      assert.equal(value.physicalReturns, value.sessions.reduce((sum, session) => sum + session.physicalReturns, 0));
      for (const key of ['sessionStarts', 'initializedSessions', 'physicalReturns']) {
        assert.ok(Number.isSafeInteger(value[key]) && value[key] >= 0); totals[key] += value[key];
      }
      assert.ok(Number.isFinite(value.elapsedSeconds) && value.elapsedSeconds >= 0); totals.elapsedSeconds += value.elapsedSeconds;
    }
    assert.deepEqual(this.receipt.cumulativeThisTool, totals); assert.deepEqual(this.footer.cumulativeThisTool, totals);
    assert.ok(totals.sessionStarts <= limits.maximumSessionStartsCumulative);
    assert.ok(totals.physicalReturns <= limits.maximumPhysicalReturnsCumulative);
    assert.ok(totals.elapsedSeconds <= limits.maximumCaptureSecondsCumulative);
    assert.deepEqual(this.receipt.inheritedFunctionalAccounting, { initializedSessions: 10, physicalReturns: 14 });
    assert.deepEqual(this.receipt.includingInherited, { initializedSessions: 10 + totals.initializedSessions, physicalReturns: 14 + totals.physicalReturns });
  }
}

async function main() {
  const { capture, output } = argumentsOf(process.argv.slice(2)); assert.equal(existsSync(output), false);
  assert.notEqual(capture, output); mkdirSync(dirname(output), { recursive: true }); mkdirSync(output);
  const began = Date.now(), report = { schema: 'logos-engine.lot9a.chart-common-qualification.v1', status: 'running', startedAt: utc(),
    reader: fingerprint(SELF), capture: label(capture), runtimeExecutions: 0, ownerExecutions: 0, originalOraclesExecuted: 0,
    officialGameRuns: 0, officialSolvedLevels: 0, officialPerformanceMeasurement: false, globalLockAcquired: false,
    publicWorkerQualified: false, publicServiceQualified: false, publicTicketsQualified: false, failures: [] };
  try {
    const receiptPath = resolve(capture, 'receipt.json'), receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    report.captureReceipt = fingerprint(receiptPath); assert.equal(receipt.schema, 'logos-engine.lot9a.chart-common-capture.v1');
    assert.equal(receipt.status, 'captured_synthetic_common_graphs'); assert.deepEqual(receipt.inputsBefore, receipt.inputsAfter);
    assert.equal(receipt.inputsUnchanged, true); assert.equal(receipt.nativeSourceUnchanged, true); assert.equal(receipt.sourceHeadUnchanged, true);
    assert.deepEqual(receipt.nativeBefore, EXPECTED_NATIVE); assert.deepEqual(receipt.nativeAfter, EXPECTED_NATIVE);
    assert.equal(new Set(receipt.inputsBefore.map(pin => pin.path)).size, receipt.inputsBefore.length);
    for (const pin of receipt.inputsBefore) fingerprintMatches(pin);
    const verifiedPriorReceipts = receipt.priorAttempts.map(previous => {
      const pin = { path: previous.path, bytes: previous.bytes, sha256: previous.sha256 };
      assert.deepEqual(pin, receipt.inputsBefore.find(input => input.path === pin.path)); fingerprintMatches(pin);
      const value = JSON.parse(readFileSync(inside(pin.path), 'utf8'));
      assert.equal(value.schema, 'logos-engine.lot9a.chart-common-capture.v1');
      assert.equal(previous.status, value.status); assert.equal(previous.sessionStarts, value.sessionStarts);
      assert.equal(previous.physicalReturns, value.physicalReturns); return { pin, receipt: value };
    });
    const eventsPath = inside(receipt.events.path); assert.equal(eventsPath, resolve(capture, 'events.jsonl.gz'));
    const eventsPin = fingerprint(eventsPath); assert.deepEqual(eventsPin, { path: receipt.events.path, bytes: receipt.events.bytes, sha256: receipt.events.sha256 });
    const fixturePath = inside('docs/migration/lot9a-evidence/reference-01/reference.json.gz');
    const fixture = JSON.parse(gunzipSync(readFileSync(fixturePath)).toString('utf8'));
    assert.equal(sha(readFileSync(fixturePath)), '0770706db16249ac4ab1c7c8b9533d571f2fc2cdaeaf5dae2d990806e412cfe8');
    const [canonical, knowledge, stateGraph, hash] = await Promise.all([
      import(pathToFileURL(inside('src/logos-engine/canonical.ts')).href),
      import(pathToFileURL(inside('src/logos-engine/v6-knowledge-store.ts')).href),
      import(pathToFileURL(inside('src/logos-engine/v6-native-state-graph.ts')).href),
      import(pathToFileURL(inside('src/logos-engine/v6-hash.ts')).href),
    ]);
    const reader = new Reader(fixture, receipt, { digest: canonical.digest, compareUnicode: canonical.compareUnicode,
      NativeKnowledgeStore: knowledge.NativeKnowledgeStore, NATIVE_STORE_PROFILE: knowledge.NATIVE_STORE_PROFILE,
      decodeNativeState: knowledge.decodeNativeState, isNativeStateGraph: stateGraph.isNativeStateGraph,
      hydrateNativeState: stateGraph.hydrateNativeState, symbolicDigest: hash.symbolicDigest, verifiedPriorReceipts });
    const blobs = new GraphBlobs(capture, receipt.rawCapture.graphBlobs), integrity = {};
    for await (const row of records(eventsPath, integrity)) { blobs.beginRecord(); await reader.accept(blobs.expand(row)); }
    reader.finish(); blobs.finish();
    assert.equal(integrity.rawBytes, receipt.events.rawBytes); assert.equal(integrity.rawSha256, receipt.events.rawSha256);
    assert.equal(integrity.records, receipt.rawCapture.records); fingerprintMatches(report.captureReceipt);
    assert.deepEqual(fingerprint(eventsPath), eventsPin); for (const pin of receipt.inputsBefore) fingerprintMatches(pin);
    report.status = 'qualified_synthetic_common_work_forms_and_complete_graphs'; report.sessions = reader.sessions;
    report.rawIntegrity = integrity; report.completeGraphBlobs = receipt.rawCapture.graphBlobs.length;
    report.accounting = { thisPassedCapture: { initializedSessions: 5, physicalReturns: 9, activeChartAcquisitions: 6, passiveChartAcquisitions: 2, suppressedChartAcquisitions: 1 },
      cumulativeThisTool: receipt.cumulativeThisTool, inheritedFunctionalAccounting: receipt.inheritedFunctionalAccounting,
      includingInherited: receipt.includingInherited, qualificationCreatesSessions: 0 };
    report.restorationQualification = 'Source put/get/restore are linked in activity order and to the committed source fact. Native restore arguments match the actual historical family root and all its hydrated fragments. Two explicit cold resets are separate and are repaired by the real common graph, without another physical return.';
    report.scope = 'Complete actual graphs, source facts, native snapshots, proposals, authorizations, packets and owner operations were retained and checked. No graph subset, field projection, new oracle or family execution was used by this reader. The public service/worker/ticket boundary and official costs remain outside this proof.';
  } catch (error) { report.status = 'failed'; report.failures.push(failRecord(error)); process.exitCode = 1; }
  report.finishedAt = utc(); report.elapsedSeconds = (Date.now() - began) / 1000;
  const path = resolve(output, 'qualification.json'); writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ status: report.status, qualification: label(path), sessions: report.sessions?.length ?? 0 }) + '\n');
}

await main();
