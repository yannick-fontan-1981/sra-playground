/** Reconstructed cold ordinary-caller proof scaffolding. It supplies declared
 * public returns only; no production priority, learned state or goal is injected.
 * Importing this module does not start a runtime or write evidence. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativePublicObservation, NativeRuntimeYield } from '../src/logos-engine/v6-native-types.ts';
import { ObservedBinding } from '../src/logos-engine/v6-observed-binding.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

export type R = Record<string, any>;
export type BindingMode = 'positive' | 'refutation' | 'ambiguity' | 'boundary';
export const OWNER = 'public_observed_binding';
export const ATTENTION_OWNER = 'object_frame_binding';
export const STATE_ID = `family_state:${OWNER}`;
export const copy = <T>(value: T): T => structuredClone(value);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PLAN = 'docs/migration/lot5c-evidence/recovery/common/common-plan.json';
const SOURCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };

export async function commonProofInputs(additional: string[] = []): Promise<R[]> {
  const paths = [PLAN, 'scripts/native-object-binding-common-loop.ts', 'tests/v6-object-binding-common.test.ts', ...additional];
  assert.equal(new Set(paths).size, paths.length);
  return Promise.all(paths.map(async path => {
    const bytes = await readFile(resolve(ROOT, path));
    return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
}

export async function bindingDeclarations(): Promise<NativeV6Declarations> {
  const paths = ['laya_proto/common_frontier_policy.drm.json', 'morphology_policy/strategy.drm'];
  const [common, strategy] = await Promise.all(paths.map(async path => JSON.parse(await readFile(resolve(ROOT, SOURCE + path), 'utf8'))));
  return { common, strategy };
}

interface Scene { bodyX: number; objects: readonly (readonly [number, number])[]; available: readonly string[]; epoch: number; levels: number }
export interface PublicRow { stage: number; label: string; before: R; command: R; after: NativePublicObservation }
function fill(rows: number[][], bbox: readonly number[], palette: number): void {
  const [left, top, right, bottom] = bbox as [number, number, number, number];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) rows[y]![x] = palette;
}
function frame(rows: number[][], bbox: readonly number[], palette: number): void {
  const [left, top, right, bottom] = bbox as [number, number, number, number];
  for (let x = left + 1; x < right; x++) rows[top]![x] = rows[bottom]![x] = palette;
  for (let y = top + 1; y < bottom; y++) rows[y]![left] = rows[y]![right] = palette;
}
function raster(scene: Scene, declared: R): number[][] {
  const rows = Array.from({ length: declared.height }, () => Array(declared.width).fill(declared.background));
  frame(rows, declared.primaryFrame.bbox, declared.primaryFrame.palette);
  frame(rows, declared.secondaryFrame.bbox, declared.secondaryFrame.palette);
  for (const [x, y] of scene.objects) fill(rows, [x, y, x + 3, y + 3], declared.primaryObject.palette);
  fill(rows, declared.secondaryObject.bbox, declared.secondaryObject.palette);
  fill(rows, [scene.bodyX, declared.body.bbox[1], scene.bodyX + 1, declared.body.bbox[3]], declared.body.palette);
  return rows;
}
function packet(scene: Scene, declared: R, index: number): NativePublicObservation {
  const rows = raster(scene, declared);
  return { frame_rows: rows, frame_packet: [copy(rows)], level: scene.epoch, levels_completed: scene.levels,
    state: 'NOT_FINISHED', frame_hash: symbolicDigest(rows).slice(0, 16),
    available_action_refs: [...scene.available], step_index: index } as NativePublicObservation;
}
export function publicState(value: NativePublicObservation): R {
  return { frame_rows: value.frame_rows, level: value.level, levels_completed: value.levels_completed,
    state: value.state, frame_hash: value.frame_hash, available_action_refs: value.available_action_refs };
}
const primitive = (command: R): R => ({ action_ref: command.action_ref,
  ...(command.data && Object.keys(command.data).length ? { data: copy(command.data) } : {}) });

/** Pure public input construction, independent of any current owner or offer. */
export function bindingPublicTable(mode: BindingMode, plan: R): { initial: NativePublicObservation; table: PublicRow[] } {
  const declared = plan.publicScene, table: PublicRow[] = [];
  let scene: Scene = { bodyX: 3, objects: [[10, 10]], available: declared.initialAvailable, epoch: 1, levels: 0 };
  const initial = packet(scene, declared, 0);
  function step(label: string, action: string, next: Scene): void {
    table.push({ stage: table.length, label, before: publicState(packet(scene, declared, 0)),
      command: { action_ref: action }, after: packet(next, declared, table.length + 1) });
    scene = next;
  }
  step('first public right translation', 'ACTION4', { ...scene, bodyX: 4, available: declared.afterFirstCalibrationAvailable });
  step('public left translation', 'ACTION3', { ...scene, bodyX: 3, available: declared.remainingAvailable });
  for (let x = 4; x <= 9; x++) step('approach visible correspondence', 'ACTION4', { ...scene, bodyX: x });
  if (mode === 'ambiguity') {
    step('two compatible public relocations', 'ACTION5', { ...scene, objects: [[4, 10], [12, 10]] });
    return { initial, table };
  }
  step('public local relocation', 'ACTION5', { ...scene, objects: [[4, 10]] });
  for (let x = 10; x <= 22; x++) step('public joint translation', 'ACTION4', { ...scene, bodyX: x, objects: [[x - 5, 10]] });
  if (mode === 'boundary') {
    step('official public scope boundary', 'ACTION5', { bodyX: 3, objects: [[10, 10]],
      available: declared.initialAvailable, epoch: 2, levels: 1 });
    return { initial, table };
  }
  step('public selected-site arrival', 'ACTION5', { ...scene, objects: [[25, 9]] });
  step('public local separation contrast', 'ACTION3', { ...scene, bodyX: 21,
    objects: mode === 'positive' ? [[25, 9]] : [[24, 9]] });
  return { initial, table };
}

/** Actual source calls and native annotations are separate. The original oracle
 * receives only public inputs and chooses its own latest proposal. */
export class BindingCapture {
  readonly runtime: R;
  readonly operations: R[] = [];
  readonly restores: R[] = [];
  readonly attentionRestores: R[] = [];
  readonly nativeAttentionExtensions: R[] = [];
  readonly initialState: R;
  readonly owner: R;
  private ownerDepth = 0;
  private attentionDepth = 0;
  private readonly active: R[] = [];
  private readonly callers = new WeakSet<object>();
  private readonly attentions = new WeakSet<object>();
  private readonly memories = new WeakSet<object>();
  private readonly ids = new WeakMap<object, number>();
  private nextId = 1;
  constructor(runtime: R) {
    this.runtime = runtime; this.owner = runtime.acquisitionFamilies.binding;
    assert.ok(this.owner, 'The ordinary factory must install the binding acquisition owner');
    assert.equal(this.owner.id, OWNER);
    assert.equal(runtime.families.filter((family: R) => family.id === OWNER).length, 1);
    this.initialState = copy(this.owner.state());
    const specifications: Record<string, (args: any[]) => R> = {
      proposeSource: a => ({ input: { obs: a[0], rows: a[1], inputs: a[2], remaining: a[3] } }),
      recordSource: a => ({ input: { before: a[0], after: a[1], command: a[2], first: a[3], second: a[4], index: a[6] ?? 0 },
        ...(a[5] != null ? { useLatestSourceProposal: true } : {}) }),
      bind: () => ({ input: {}, useLatestSourceProposal: true }),
      before: a => ({ input: { index: a[1], public: a[2], obs: a[3] }, useLatestSourceProposal: true }),
      after: a => ({ input: { index: a[1], before: a[2], after: a[3], first: a[4], second: a[5] }, useLatestSourceProposal: true }),
    };
    for (const [method, project] of Object.entries(specifications)) {
      const original = this.owner[method].bind(this.owner);
      this.owner[method] = (...args: any[]) => {
        this.attachCaller();
        return this.capture({ method, ...copy(project(args)) }, () => original(...args), true);
      };
    }
    const restore = this.owner.restoreNative.bind(this.owner);
    this.owner.restoreNative = (value: R) => {
      const input = copy(value), returned = restore(value), output = copy(this.owner.nativeState());
      assert.deepEqual(output, input, 'Common restoration preserves the exact authoritative checkpoint');
      this.restores.push({ operationCount: this.operations.length, input, output });
      return returned;
    };
    this.attachCaller();
  }
  private id(value: object): number {
    if (!this.ids.has(value)) this.ids.set(value, this.nextId++);
    return this.ids.get(value)!;
  }
  attention(): R { return copy(this.runtime.caller?.attention.state() ?? { item: null, composition: null }); }
  records(): R[] { return this.operations.filter(row => row.method === 'recordSource'); }
  journal(id: string, mode: string): R {
    return { schema: 'logos-engine.v6.observed-binding-public-operations.v1', id, chainId: id, mode,
      episode: 'common-observation-frontier', operations: copy(this.operations) };
  }
  private capture(row: R, invoke: () => any, owned: boolean): any {
    const puts: R[] = []; row.native = { memoryPuts: puts };
    this.operations.push(row); this.active.push(row);
    if (owned) this.ownerDepth++; else this.attentionDepth++;
    const finish = (result: any, error?: any): any => {
      assert.equal(this.active.pop(), row, 'Source operations must finish in their actual nested order');
      if (owned) this.ownerDepth--; else this.attentionDepth--;
      row.native = { ...(error ? { exception: { type: error.name, message: error.message } } : { result: copy(result ?? null) }),
        state: copy(this.owner.state()), attention: this.attention(), memoryPuts: puts,
        sharedAttentionBound: this.owner.attention === this.runtime.caller?.attention };
      if (error) throw error;
      return result;
    };
    let result: any;
    try { result = invoke(); } catch (error) { return finish(undefined, error); }
    return result && typeof result.then === 'function'
      ? result.then((value: any) => finish(value), (error: any) => finish(undefined, error)) : finish(result);
  }
  private attachMemory(memory: R | null | undefined): void {
    if (!memory || this.memories.has(memory)) return;
    this.memories.add(memory);
    const original = memory.put.bind(memory);
    memory.put = (...args: any[]) => {
      const returned = original(...args), active = this.active.at(-1);
      if (active && ['attention', 'attention_composition'].includes(args[1])) {
        active.native.memoryPuts.push(copy({ episode: args[0], key: args[1], value: args[2],
          evidence: args[3] ?? 'fixture', revision: args[4] ?? 1 }));
      }
      return returned;
    };
  }
  attachCaller(): void {
    const caller = this.runtime.caller;
    if (!caller) return;
    this.attachMemory(caller.memory);
    if (!this.callers.has(caller)) {
      this.callers.add(caller);
      for (const method of ['restore', 'restoreFrom']) {
        const original = caller[method].bind(caller);
        caller[method] = (...args: any[]) => {
          const prior = caller.attention, before = copy(prior.state());
          const returned = original(...args), after = caller.attention;
          this.attentionRestores.push({ method, operationCount: this.operations.length,
            beforeId: this.id(prior), afterId: this.id(after), identityChanged: prior !== after,
            before, after: copy(after.state()) });
          this.attachCaller(); return returned;
        };
      }
    }
    const attention = caller.attention;
    if (this.attentions.has(attention)) return;
    this.attentions.add(attention); this.attachMemory(attention.memory);
    const methods: Record<string, { source: string; input: (args: any[]) => R }> = {
      open: { source: 'open', input: a => ({ question: a[0], obs: a[1] }) },
      matches: { source: 'matches', input: a => ({ question: a[0], obs: a[1] }) },
      revalidate: { source: 'revalidate', input: a => ({ obs: a[0] }) },
      observe: { source: 'observe', input: a => ({ before: a[0], after: a[1], command: a[2], focus_id: a[3] }) },
      takeParentReturn: { source: 'take_parent_return', input: a => ({ obs: a[0] }) },
      closePending: { source: 'close_pending', input: a => ({ obs: a[0], reason: a[1] }) },
      compositionFor: { source: 'composition_for', input: a => ({ owner: a[0], obs: a[1] }) },
      retainComposition: { source: 'retain_composition', input: a => ({ owner: a[0], target_ref: a[1], question: a[2], evidence: a[3], obs: a[4], binding: a[5] ?? null }) },
      returnComposition: { source: 'return_composition', input: a => ({ owner: a[0], target_ref: a[1], status: a[2], evidence: a[3], obs: a[4] }) },
    };
    for (const [method, spec] of Object.entries(methods)) {
      const original = attention[method].bind(attention);
      attention[method] = (...args: any[]) => {
        if (this.ownerDepth > 0 || this.attentionDepth > 0) return original(...args);
        return this.capture({ method: `attention.${spec.source}`, input: copy(spec.input(args)) }, () => original(...args), false);
      };
    }
    const revise = attention.reviseComposition.bind(attention);
    attention.reviseComposition = (...args: any[]) => {
      const before = copy(attention.state()), returned = revise(...args);
      this.nativeAttentionExtensions.push({ method: 'revise_composition', operationCount: this.operations.length,
        arguments: copy(args), result: copy(returned ?? null), before, after: copy(attention.state()) });
      return returned;
    };
  }
}

export function assertReleased(current: NativeRuntimeYield): void {
  const value = current as unknown as R;
  assert.equal(value.kind, 'action', String(value.reason)); assert.ok(value.authorization);
  assert.equal(value.snapshot.whyAct.enabled, true);
  assert.equal(value.snapshot.whyAct.decision.decision.status, 'action_set_released');
  const guard = value.snapshot.trace.findLast((item: R) => item.kind === 'before_guard');
  assert.ok(guard); assert.equal(guard.admitted, true); assert.equal(guard.point_bound, true);
  assert.equal(guard.family, value.snapshot.lastDecision); assert.equal(guard.index, value.authorization.action_index);
  assert.equal(value.authorization.action_index, value.snapshot.prefix.nextIndex);
  assert.equal(value.authorization.decision_revision, value.snapshot.prefix.revision);
  assert.deepEqual(value.command, value.snapshot.proposal.actions[value.authorization.action_index]);
}

export async function runBindingCommon(mode: BindingMode): Promise<R> {
  const startedAt = new Date().toISOString(), executionInputsBefore = await commonProofInputs();
  const plan = JSON.parse(await readFile(resolve(ROOT, PLAN), 'utf8'));
  assert.equal(plan.schema, 'logos-engine.lot5c-common-proof-plan.v1');
  assert.ok(Date.parse(plan.declaredAt) <= Date.parse(startedAt));
  assert.ok(plan.cases.some((item: R) => item.id === mode));
  const declarations = await bindingDeclarations(), declarationsBefore = copy(declarations);
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), internal = runtime as unknown as R;
  const capture = new BindingCapture(internal), owner = capture.owner;
  const { initial, table } = bindingPublicTable(mode, plan);
  const checks: string[] = [], failures: R[] = [], history: R[] = [], checkpoints: R[] = [], continuations: R[] = [];
  let current: NativeRuntimeYield | null = null, currentPacket = initial, stage = 0, returned = 0, ownReturns = 0;
  const sessionId = `lot5c-recovery-binding-common-${mode}`;
  try {
    assert.deepEqual(capture.initialState, new ObservedBinding().state());
    current = await runtime.initialize({ sessionId, observation: copy(initial),
      budgets: { targetLevels: 3, levelActionCaps: [96, 96, 96], maxActions: plan.publicResponseTable.maximumActualReturnsPerSyntheticRun } }, execution);
    capture.attachCaller();
    const coverage = (current.snapshot as unknown as R).coverage.sourceGroups.find((row: R) => row.id === 'factored_material_return');
    const index = coverage.entryPoints.indexOf('observed_object_binding');
    assert.ok(index >= 0); assert.equal(coverage.families[index], OWNER);
    const order = declarations.strategy.declarations[0]!.configuration.factored_material_return.ordered_subquestions;
    const entries = coverage.entryPoints.filter((entry: string | null) => entry !== null);
    assert.deepEqual(entries, [...entries].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    checks.push('cold_unique_owner_and_original_material_subquestion_order');
    while (stage < table.length && returned < plan.publicResponseTable.maximumActualReturnsPerSyntheticRun) {
      assertReleased(current);
      const before = current as unknown as R;
      const matches = table.filter(row => isDeepStrictEqual(row.before, publicState(currentPacket))
        && isDeepStrictEqual(row.command, primitive(before.command)));
      assert.ok(matches.length <= 1, 'The declared public response table is deterministic');
      const match = matches[0]; assert.ok(!match || match.stage === stage, 'The public table advances contiguously');
      const next = match ? { ...copy(match.after), step_index: returned + 1 }
        : { ...copy(currentPacket), step_index: returned + 1, frame_packet: [copy(currentPacket.frame_rows)] };
      const own = before.snapshot.lastDecision === OWNER, recordCount = capture.records().length;
      const selected = { family: before.snapshot.lastDecision, proposalKind: before.snapshot.proposal.kind,
        bindingKind: before.snapshot.proposal.binding_plan?.offer.kind ?? null,
        targetFrame: before.snapshot.proposal.binding_plan?.offer.target.frame.ref ?? null,
        actions: copy(before.snapshot.proposal.actions), command: copy(before.command), authorization: copy(before.authorization) };
      current = await runtime.advance({ command: copy(before.command), observation: copy(next), executionMs: 0 }, execution);
      returned++; if (own) ownReturns++; if (match) stage++;
      currentPacket = next;
      const after = current as unknown as R;
      if (current.kind === 'boundary' || current.kind === 'stopped') {
        assert.equal(capture.records().length, returned, 'Every actual public return is acquired once when its prefix seals');
        assert.equal(new Set(capture.records().map(row => row.input.before.observation_ref)).size, returned);
        const retained = copy(internal.knowledge.stateValue(STATE_ID));
        assert.deepEqual(retained, owner.nativeState());
        assert.equal(Object.hasOwn(retained, 'attention'), false);
        const fresh = new ObservedBinding(); fresh.restoreNative(copy(retained));
        assert.deepEqual(fresh.state(), owner.state()); assert.deepEqual(fresh.nativeState(), retained);
        const callerAttention = copy(internal.knowledge.stateValue('caller:attention'));
        assert.deepEqual(callerAttention, capture.attention());
        const reasoning = internal.knowledge.stateValue('reasoning:memory');
        const facts = reasoning.facts.map((id: string) => internal.knowledge.stateValue(id));
        for (const recorded of capture.records()) {
          const events = facts.filter((fact: R) => fact.key === `object_binding_event:${recorded.input.before.revision}`);
          const retainedEvent = recorded.useLatestSourceProposal || Boolean(recorded.native.result);
          assert.equal(events.length, retainedEvent ? 1 : 0,
            'Selected null is retained by the source caller; passive null creates no event');
          if (retainedEvent) assert.deepEqual(events[0].value, recorded.native.result);
        }
        checkpoints.push({ returned, state: retained, attention: callerAttention, graphChain: internal.inspectKnowledge().chain });
        if (current.kind === 'boundary') current = await runtime.resume(execution);
      } else {
        assert.equal(capture.records().length, recordCount, 'An open prefix does not acquire its physical returns early');
        if (own) continuations.push({ returned, fromIndex: before.authorization.action_index,
          toIndex: after.authorization.action_index, planned: before.snapshot.prefix.planned,
          decisionRevision: before.authorization.decision_revision });
      }
      history.push({ returned, tableStage: stage, advancesDeclaredTable: Boolean(match), selected,
        returnedPacket: copy(next), afterKind: current.kind, attention: capture.attention() });
    }
    assert.equal(stage, table.length, 'The ordinary selector must traverse the declared public path');
    assert.ok(ownReturns > 0 && capture.records().some(row => !row.useLatestSourceProposal));
    assert.ok(capture.records().some(row => row.useLatestSourceProposal && row.native.result === null), 'Exercise selected-null retention');
    assert.ok(capture.records().some(row => !row.useLatestSourceProposal && row.native.result === null), 'Exercise passive-null omission');
    assert.equal(capture.records().length, returned);
    assert.ok(checkpoints.length > 0 && capture.restores.length > 0);
    assert.ok(capture.attentionRestores.some(row => row.identityChanged));
    assert.ok(capture.operations.filter(row => ['proposeSource', 'recordSource'].includes(row.method))
      .every(row => row.native.sharedAttentionBound));
    assert.equal(capture.nativeAttentionExtensions.length, 0);
    assert.ok(continuations.length > 0);
    const state = owner.state(), attention = capture.attention().composition, next = current as unknown as R;
    const bindingEvents = capture.records().flatMap(row => row.native.result ? [row.native.result] : []);
    if (mode === 'positive' || mode === 'refutation') {
      const arrival = capture.records().find(row => row.native.result?.status === 'arrival_at_selected_site_requires_separation');
      assert.ok(arrival); assert.equal(arrival.native.attention.composition.status, 'pending');
      assert.ok(arrival.native.state.pending_reception);
      assert.equal(next.kind, 'action'); assert.equal(next.snapshot.lastDecision, OWNER); assertReleased(current!);
      if (mode === 'positive') {
        assert.ok(bindingEvents.some(event => event.status === 'reception_confirmed_by_separation'));
        assert.equal(state.pending_reception, null); assert.equal(state.held, null); assert.equal(attention.status, 'achieved');
        assert.notEqual(next.snapshot.proposal.binding_plan.offer.target.frame.ref, attention.target_ref);
      } else {
        assert.ok(state.events.some((event: R) => event.status === 'reception_refuted_object_moves_with_body'));
        assert.equal(state.pending_reception, null); assert.equal(state.held.status, 'joint_transport_observed');
        assert.equal(attention.status, 'pending'); assert.equal(next.snapshot.proposal.binding_plan.offer.target.frame.ref, attention.target_ref);
      }
      checks.push('arrival_remains_pending_until_measured_local_separation', 'acquired_contrast_changes_next_actual_common_target_and_decision');
    } else if (mode === 'ambiguity') {
      assert.ok(bindingEvents.some(event => event.status === 'identity_binding_unresolved'));
      assert.equal(state.held, null); assert.equal(attention.status, 'pending');
      assert.equal(capture.operations.findLast(row => row.method === 'proposeSource')!.native.result, null);
      if (next.kind === 'action') assert.notEqual(next.snapshot.lastDecision, OWNER);
      checks.push('two_compatible_relocations_do_not_create_an_attachment_or_replace_the_parent');
    } else {
      assert.ok(bindingEvents.some(event => event.status === 'scope_changed_preserving_conditional_methods'));
      assert.equal(state.epoch, 2); assert.equal(state.core, null); assert.equal(state.held, null);
      assert.equal(state.pending_reception, null); assert.deepEqual(state.moves, {}); assert.deepEqual(state.observed_frames, {});
      assert.ok(state.methods.length > 0 && state.goal_evidence.length > 0); assert.equal(attention.status, 'boundary');
      assert.equal(capture.operations.findLast(row => row.method === 'proposeSource')!.native.result, null);
      checks.push('natural_boundary_discards_local_geometry_but_retains_conditional_methods');
    }
    checks.push('one_selected_or_passive_acquisition_per_actual_return', 'authoritative_checkpoint_and_fresh_owner_restoration',
      'source_selected_null_retained_and_passive_null_not_retained', 'caller_attention_restoration_has_one_shared_owner',
      'ordinary_why_act_authorizes_every_released_step', 'public_response_never_depends_on_owner_or_expected_native_result');
  } catch (error: any) { failures.push({ name: error.name, message: error.message, stack: error.stack }); }
  finally { runtime.close('reconstructed_synthetic_object_binding_common_proof_finished'); }
  assert.deepEqual(declarations, declarationsBefore);
  return { schema: 'logos-engine.lot5c-common-loop.v1', status: failures.length ? 'failed' : 'passed',
    startedAt, finishedAt: new Date().toISOString(), sessionId, mode, synthetic: true,
    reconstruction: 'New execution of reconstructed proof scaffolding; no historical receipt reused',
    proofPlan: PLAN, executionInputsBefore, sourceDeclarationsModified: false, table, history, checkpoints, continuations,
    operations: capture.operations, journal: capture.journal(sessionId, mode), restores: capture.restores,
    attentionRestores: capture.attentionRestores, nativeAttentionExtensions: capture.nativeAttentionExtensions,
    initialState: capture.initialState, finalState: copy(owner.state()), finalAttention: capture.attention(),
    returned, ownReturns, sourceStages: stage, declaredStages: table.length, next: copy(current),
    checks: { passed: checks.length, names: checks, failures },
    qualification: 'Synthetic cold ordinary caller proof, not a game result or cost measurement. Exact source parity requires independent unchanged-Python replay of the actual public-operation journal. Native tracker restoration is separate from shared caller-attention restoration.' };
}

/** Optional, exclusive evidence sink. All new recovery outputs stay in recovery. */
export async function saveBindingEvidence(name: string, report: R): Promise<void> {
  assert.ok(Array.isArray(report.executionInputsBefore), 'Proof inputs must be pinned before execution');
  const after = await Promise.all(report.executionInputsBefore.map(async (pin: R) => {
    const bytes = await readFile(resolve(ROOT, pin.path));
    return { path: pin.path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
  report.executionInputs = report.executionInputsBefore;
  report.executionInputsAfter = after;
  report.executionInputsUnchangedDuringRun = isDeepStrictEqual(report.executionInputsBefore, after);
  if (!report.executionInputsUnchangedDuringRun) {
    report.status = 'failed';
    const failure = { name: 'ProofInputChanged', message: 'An executed proof input differs from its pre-execution pin' };
    if (report.checks) report.checks.failures.push(failure); else report.failures.push(failure);
  }
  const configured = process.env.LOGOS_LOT5C_COMMON_EVIDENCE_DIR;
  if (!configured) return;
  assert.match(name, /^[a-z][a-z0-9-]*$/);
  const directory = resolve(configured, name);
  assert.ok(directory.startsWith(resolve(ROOT, 'docs/migration/lot5c-evidence/recovery/common') + '/'));
  await mkdir(directory, { recursive: true });
  const { operations: _operations, journal, ...rest } = report;
  await writeFile(resolve(directory, 'actual-operations.json'), JSON.stringify(journal) + '\n', { flag: 'wx' });
  await writeFile(resolve(directory, 'common-loop.json.gz'), gzipSync(JSON.stringify(rest) + '\n'), { flag: 'wx' });
}
