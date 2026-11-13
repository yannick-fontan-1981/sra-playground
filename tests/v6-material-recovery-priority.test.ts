import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { rowsDigest } from '../src/logos-engine/v6-native-observer.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { summaryReturnedPublicProbe, independentReturnedProbeSupport } from '../src/logos-engine/v6-returned-probe-scope.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const firstAttempt = JSON.parse(gunzipSync(await readFile(new URL('../docs/migration/native-campaigns-v50/life-public-trace.json.gz', import.meta.url))).toString()) as R;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ownKinds = new Set(['typed_carrier_response', 'typed_material_flow', 'typed_pose_scope', 'typed_pose_model', 'typed_pose_response']);
const scopeRef = 'native_contact_probe_scope:animated_contact';
const contactRef = 'family_state:animated_contact';
const recoveryRule = 'returned_unlearned_contact_refusal_is_local';
const read = (runtime: R, id: string): R => {
  const graph = runtime.inspectKnowledge();
  return hydrateNativeState(graph.nodes[id].value, key => graph.nodes[key].value) as R;
};

// The first selected command and its complete four-image return were actually
// executed in the retained failed campaign. The first current material query
// remains an experiment: this replay never supplies its unexecuted response.
async function firstReturn(sessionId: string, controlledReturn?: NativePublicObservation) {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const family = (runtime as unknown as { families: NativeFamily[] }).families.find(item => item.id === 'public_occurrence_recall')!;
  const cold = copy(family.state());
  let result = await runtime.initialize({ sessionId, observation: copy(firstAttempt.packets[0].packet),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  assert.equal(result.kind, 'action'); assert.equal(result.snapshot.lastDecision, 'animated_contact');
  assert.deepEqual(result.command, firstAttempt.packets[1].command);
  assert.equal((result.snapshot.proposal as R).strategy_receipt.native_coordination, undefined,
    'A cold measured material question has no acquired priority before the first actual return');
  assert.deepEqual(family.state(), cold);
  result = await runtime.advance({ command: result.command!, executionMs: 0,
    observation: controlledReturn ?? copy(firstAttempt.packets[1].packet) }, execution);
  assert.equal(result.snapshot.actions, 1); assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
  return { runtime, family, result, retained: copy(family.state()) as R };
}

test('a real restored transient invitation releases a current measured material question through normal authorization', async () => {
  const { runtime, family, result: boundary, retained } = await firstReturn('anonymous-material-restored-transient');
  assert.equal(boundary.kind, 'boundary'); assert.equal(boundary.snapshot.levelsCompleted, 0);
  assert.equal(firstAttempt.status, 'failed', 'The first failed campaign is preserved, not relabeled as success');
  assert.equal(firstAttempt.packets.length, 2);
  assert.deepEqual(firstAttempt.packets[0].packet.frame_rows, firstAttempt.packets[1].packet.frame_rows);
  assert.ok(firstAttempt.packets[1].packet.frame_packet.some((rows: R) => JSON.stringify(rows) !== JSON.stringify(firstAttempt.packets[0].packet.frame_rows)));
  assert.deepEqual(retained.events.filter((event: R) => ownKinds.has(event.kind)), []);
  const contact = read(runtime, 'family_state:animated_contact');
  assert.equal(contact.events.length, 1); assert.equal(contact.events[0].mode, 'invitation');
  assert.equal(contact.events[0].model, null);
  const result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, family.id);
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.kind, 'typed_carrier_experiment');
  assert.equal(proposal.typed_carrier_plan.reason, 'test_current_marked_carrier');
  assert.equal(proposal.field_subquestion, 'typed_material_flow');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.ok(result.authorization, 'Refusal recovery is not physical authorization');
  assert.equal(proposal.steps[0].expected_after, null);
  assert.deepEqual(proposal.steps[0].point_binding.point, proposal.typed_carrier_plan.selected.point);
  assert.deepEqual(family.state(), retained, 'No carrier, replacement, production or selection fact is fabricated during recovery');
  assert.equal(result.snapshot.actions, 1); assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
  assert.deepEqual(read(runtime, 'family_state:animated_contact'), contact, 'The unknown contact model remains unknown');
  assert.equal(proposal.strategy_receipt.native_coordination.length, 1);
  const receipt = proposal.strategy_receipt.native_coordination[0];
  assert.equal(receipt.rule, recoveryRule);
  assert.equal(receipt.physical_action_authorized, false);
  assert.equal(receipt.preferred_proposal_id, proposal.proposal_id);
  assert.equal(receipt.current_inquiry.status, 'current_measured_relation_for_unknown_effect');
  assert.deepEqual(receipt.current_inquiry.acquisition_event_refs, []);
  assert.deepEqual(receipt.current_inquiry.context_model_ids, []);
  assert.equal(receipt.current_inquiry.effect_requires_actual_return, true);
  assert.equal(receipt.current_inquiry.supportBoxes.length, 4);
  const scope = read(runtime, scopeRef);
  assert.equal(scope.status, 'transient_returned_unlearned_invitation');
  assert.deepEqual(scope.public_return, { first: firstAttempt.packets[0].packet, second: firstAttempt.packets[1].packet });
  assert.equal(scope.returned_frame_count, 4);
  assert.equal(scope.transient_changed_points.length, 12);
  assert.equal(scope.before_frame_digest, scope.frame_digest);
  assert.ok(scope.returned_frame_digests.some((value: string) => value !== scope.frame_digest));
  assert.equal(independentReturnedProbeSupport(scope, receipt.current_inquiry, scope.public_return.second.frame_rows), true);
});

test('controlled public boundary changes do not receive restored-transient recovery', async context => {
  // Explicit witness falsifications, not new physical game returns. Every
  // variant starts from a new runtime and executes no external game action.
  for (const variant of [
    { id: 'changed final raster', change: (packet: R) => {
      packet.frame_rows[0][0] = (packet.frame_rows[0][0] + 1) % 16;
      packet.frame_packet[packet.frame_packet.length - 1] = copy(packet.frame_rows);
    } },
    { id: 'changed action domain', change: (packet: R) => { packet.available_action_refs.push('ACTION1'); } },
    { id: 'changed epoch', change: (packet: R) => { packet.level++; } },
    { id: 'official score increase', change: (packet: R) => { packet.levels_completed++; } },
    { id: 'terminal public state', change: (packet: R) => { packet.state = 'GAME_OVER'; } },
    { id: 'packet ends before displayed restoration', change: (packet: R) => { packet.frame_packet = packet.frame_packet.slice(0, 2); } },
  ]) await context.test(variant.id, async () => {
    const packet = copy(firstAttempt.packets[1].packet);
    variant.change(packet); packet.frame_hash = await rowsDigest(packet.frame_rows);
    const { runtime, result: boundary } = await firstReturn(`controlled-material-restoration:${variant.id}`, packet);
    const result = boundary.kind === 'boundary' ? await runtime.resume(execution) : boundary;
    const coordination = ((result.snapshot.proposal as R | null)?.strategy_receipt?.native_coordination ?? []) as R[];
    assert.equal(coordination.some(item => item.rule === recoveryRule), false,
      'A controlled counterexample must not produce the new restored-transient priority receipt');
    assert.equal(read(runtime, scopeRef).status, 'outside_stationary_invitation_scope');
  });
});

test('the complete returned packet distinguishes a stationary return, a transient restoration and an incomplete report', () => {
  const first = copy(firstAttempt.packets[0].packet), second = copy(firstAttempt.packets[1].packet);
  const measured = summaryReturnedPublicProbe(first, second);
  assert.equal(measured.status, 'transient_returned_unlearned_invitation');
  assert.equal(measured.transient_changed_points.length, 12);
  const stationary = { ...copy(second), frame_packet: [copy(first.frame_rows)] };
  assert.equal(summaryReturnedPublicProbe(first, stationary).status, 'stationary_unlearned_invitation');
  for (const changed of [
    { ...copy(second), frame_packet: [] },
    { ...copy(second), frame_packet: second.frame_packet.slice(0, 2) },
    { ...copy(second), step_index: second.step_index + 1 },
  ]) assert.equal(summaryReturnedPublicProbe(first, changed).status, 'outside_stationary_invitation_scope');
});

test('a restored contact refusal remains local, acquired, corroborated and subject to current evidence', async context => {
  const { runtime, family, retained } = await firstReturn('anonymous-material-scope-falsification');
  const internal = runtime as unknown as R, store = internal.knowledge, graphBefore = runtime.inspectKnowledge();
  const scope = copy(store.value(scopeRef)) as R, contactState = copy(store.value(contactRef)) as R;
  const contact = (internal.families as NativeFamily[]).find(item => item.id === 'animated_contact')!;
  const inputs = internal.domain.candidates(internal.observation);
  const refusal = await contact.propose(internal.observation, internal.current.frame_rows, inputs, 600, execution);
  assert.equal(refusal!.status, 'unknown');
  assert.equal(scope.status, 'transient_returned_unlearned_invitation');

  // Read-only counterfactual views of the genuinely acquired graph. They are
  // not inserted into its journal and never reach an external game host.
  async function refused(overrides: { scope?: R | null; contactState?: R; missingNode?: boolean; transition?: R; transitionNode?: R } = {}) {
    const nodes = { ...store.memory.nodes };
    if (overrides.missingNode) delete nodes[scopeRef];
    if (overrides.transitionNode) nodes[scope.transition_ref] = overrides.transitionNode;
    internal.knowledge = new Proxy(store, { get(target, property) {
      if (property === 'memory') return { ...target.memory, nodes };
      if (property === 'value') return (id: string) => id === scopeRef && Object.hasOwn(overrides, 'scope') ? overrides.scope
        : id === contactRef && overrides.contactState ? overrides.contactState
        : id === scope.transition_ref && overrides.transition ? overrides.transition : target.value(id);
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    internal.planning = { execution, inputs, offers: new Map(), entryOffers: new Map(), coordination: [] };
    try {
      assert.equal(await internal.scopeReturnedContactRefusal(contact, refusal), false);
      assert.deepEqual(internal.planning.coordination, [], 'A rejected deferral publishes no priority receipt');
    } finally { internal.knowledge = store; internal.planning = null; }
  }

  await context.test('missing or stationary scope cannot use the transient rule', async () => {
    await refused({ missingNode: true }); await refused({ scope: null });
    await refused({ scope: { ...scope, status: 'stationary_unlearned_invitation' } });
  });
  for (const change of [
    { id: 'old epoch', apply: (value: R) => { value.epoch--; } },
    { id: 'other score', apply: (value: R) => { value.score++; } },
    { id: 'other public state', apply: (value: R) => { value.public_state = 'GAME_OVER'; } },
    { id: 'other input domain', apply: (value: R) => { value.available_action_refs = ['ACTION5']; } },
    { id: 'other contact evidence', apply: (value: R) => { value.evidence = ['other-before', 'other-after']; } },
    { id: 'other contact point', apply: (value: R) => { value.command.data.x++; } },
    { id: 'other final image', apply: (value: R) => { value.frame_digest = 'other-image'; } },
    { id: 'other starting image digest', apply: (value: R) => { value.before_frame_digest = 'other-before'; } },
    { id: 'missing public return', apply: (value: R) => { delete value.public_return; } },
    { id: 'missing transition', apply: (value: R) => { value.transition_ref = 'missing-transition'; } },
    { id: 'unaccounted returned frame', apply: (value: R) => { value.returned_frame_count++; } },
    { id: 'unaccounted returned digest', apply: (value: R) => { value.returned_frame_digests[1] = value.frame_digest; } },
    { id: 'suppressed transient pixel', apply: (value: R) => { value.transient_changed_points.pop(); } },
    { id: 'altered retained public return', apply: (value: R) => { value.public_return.second.frame_packet[1][0][0]++; } },
    { id: 'malformed retained public packet', apply: (value: R) => { value.public_return.second.frame_packet = null; } },
    { id: 'falsified returned protocol', apply: (value: R) => { value.public_return.second.level++; } },
  ]) await context.test(`scope refuses ${change.id}`, async () => {
    const changed = copy(scope); change.apply(changed); await refused({ scope: changed });
  });
  await context.test('transition provenance is corroborated independently of the scope summary', async () => {
    const transition = copy(store.value(scope.transition_ref)), node = copy(store.memory.nodes[scope.transition_ref]);
    await refused({ transition: { ...transition, after: 'other-after' } });
    await refused({ transition: { ...transition, status: 'official_boundary_witness' } });
    await refused({ transitionNode: { ...node, component: 'unrelated-component' } });
    await refused({ transitionNode: { ...node, status: 'unobserved' } });
  });
  await context.test('an acquired contact model, later evidence or a non-invitation retains its refusal', async () => {
    const modeled = copy(contactState); modeled.events.at(-1).model = { controlled: true }; await refused({ contactState: modeled });
    const otherMode = copy(contactState); otherMode.events.at(-1).mode = 'curve_disclosure'; await refused({ contactState: otherMode });
    const later = copy(contactState); later.events.push({ ...copy(later.events.at(-1)), evidence: ['later-before', 'later-after'] });
    await refused({ contactState: later }); await refused({ contactState: { ...contactState, events: [] } });
  });
  await context.test('the current material guard can veto recovery', async child => {
    const original = family.before.bind(family); let vetoes = 0;
    child.mock.method(family, 'before', (...args: Parameters<NativeFamily['before']>) => {
      if (args[0].kind === 'typed_carrier_experiment') { vetoes++; return { admitted: false, reason: 'controlled_current_support_changed' }; }
      return original(...args);
    });
    await refused(); assert.equal(vetoes, 1);
  });
  await context.test('a cold witness must be disjoint from all transient pixels and the original point', async child => {
    const original = family.currentInquiryWitness!.bind(family);
    for (const point of [scope.transient_changed_points[0], [scope.command.data.x, scope.command.data.y]]) {
      const mock = child.mock.method(family, 'currentInquiryWitness', (...args: Parameters<NonNullable<NativeFamily['currentInquiryWitness']>>) => {
        const witness = original(...args) as R;
        return witness ? { ...witness, supportBoxes: [...witness.supportBoxes, [...point, ...point]] } : witness;
      });
      await refused(); mock.mock.restore();
    }
  });
  await context.test('a cold relation cannot pretend to contain acquired context or skip evidence', async child => {
    const original = family.currentInquiryWitness!.bind(family);
    for (const change of [
      (value: R) => { value.proposal_ref = 'other-proposal'; },
      (value: R) => { value.evidence_refs = []; },
      (value: R) => { value.effect_requires_actual_return = false; },
      (value: R) => { value.acquisition_event_refs = ['invented-event']; },
      (value: R) => { value.status = 'acquired_context_for_unknown_effect'; value.context_model_ids = ['invented-context']; },
      (value: R) => { value.supportBoxes = [value.supportBoxes[0]]; },
    ]) {
      const mock = child.mock.method(family, 'currentInquiryWitness', (...args: Parameters<NonNullable<NativeFamily['currentInquiryWitness']>>) => {
        const witness = original(...args) as R; if (witness) { const changed = copy(witness); change(changed); return changed; } return witness;
      });
      await refused(); mock.mock.restore();
    }
  });
  await context.test('the first unsupported window cannot borrow a later material witness', async child => {
    const original = family.proposeInSubquestion!.bind(family), calls: string[] = [];
    child.mock.method(family, 'proposeInSubquestion', (...args: Parameters<NonNullable<NativeFamily['proposeInSubquestion']>>) => {
      if (args[0] === 'window_constraints') {
        calls.push(args[1]);
        if (args[1] === 'cell_patch_composition') return { status: 'proposed', kind: 'controlled_unsupported_inquiry',
          proposal_id: 'controlled-first-window-inquiry', actions: [], steps: [] };
      }
      return original(...args);
    });
    await refused();
    const order: string[] = internal.groups.find((group: R) => group.id === 'window_constraints').entryPoints;
    assert.deepEqual(calls, order.slice(0, order.indexOf('cell_patch_composition') + 1));
    assert.ok(!calls.includes('typed_material_flow'));
  });
  assert.equal(runtime.inspectKnowledge(), graphBefore);
  assert.deepEqual(family.state(), retained, 'Read-only arbitration acquires no material fact');
});
