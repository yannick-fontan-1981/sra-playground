import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { measureNativeObservation, ObservedInputDomain, rowsDigest } from '../src/logos-engine/v6-native-observer.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { renderProgramLayers } from '../src/logos-engine/v6-program-geometry.ts';
import { sharedLearnedPreparationWitness } from '../src/logos-engine/v6-learned-preparation.ts';
import { programControlDiscoveryBlocksOrdinaryPlan } from '../src/logos-engine/v6-program-control-discovery.ts';
import { observedProgramQuestion } from '../src/logos-engine/v6-program-composition-access.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-program-composition-reference.json.gz', import.meta.url))).toString());
const diagnosis = JSON.parse(await readFile(new URL('../docs/migration/native-campaigns-v39/diagnostics/stck-level-four-program-diagnosis.json', import.meta.url), 'utf8'));
const trace = JSON.parse(gunzipSync(await readFile(new URL('../docs/migration/native-campaigns-v40/diagnostics/stck-current-access-public.json.gz', import.meta.url))).toString());
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const normalized = (command: R): R => ({ action_ref: command.action_ref, data: command.data ?? {} });
const hasNativeEvent = (event: R): boolean => event.kind.startsWith('native_program_control_');

/** Recorded public returns only. Expected commands check the actual choice;
 * they are never inputs to planning. No game engine or private state is loaded. */
function recordedPacket(index: number): NativePublicObservation {
  return copy(trace.packets[index].packet);
}

async function view(packet: NativePublicObservation, revision: number) {
  return { packet, observation: await measureNativeObservation(packet, revision, 'control-discovery-integration') };
}

/** The old program-only journal is replayed solely as an integration fixture.
 * The separate cold-runtime test below does not import a learned checkpoint. */
async function afterKnownBinding(enabled = true) {
  const original = new SharedSeriesConstraint(fixture.policy.recall);
  for (const event of diagnosis.events) { original.memory.applyEvent(copy(event)); original.events.push(copy(event)); }
  const family = new SharedSeriesConstraint(fixture.policy.recall, { currentProgramAccess: true, programControlDiscovery: enabled });
  family.restore(original.state());
  const before = await view(recordedPacket(35), 35), after = await view(recordedPacket(36), 36);
  const proposal = await family.programPropose(before.observation, before.packet.frame_rows, [], 32, 360_000, () => 0);
  assert.ok(proposal);
  assert.equal(proposal.program_composition_plan.mode, 'bind_single_member');
  assert.deepEqual(normalized(proposal.actions[0]), normalized(trace.packets[36].command));
  assert.equal(family.before(proposal, 0, before.packet, before.observation).admitted, true);
  family.record(before.observation, after.observation, proposal.actions[0], before.packet.frame_rows,
    after.packet.frame_rows, proposal, 0, after.packet.frame_packet);
  assert.equal(family.memory.compositionRefutedEpochs.has(after.observation.level_epoch), false);
  return { family, ...after };
}

async function probe(family: SharedSeriesConstraint, packet: NativePublicObservation, observation: R): Promise<R> {
  const proposal = await family.programPropose(observation, packet.frame_rows, [], 32, 360_000, () => 0);
  assert.ok(proposal);
  assert.equal(proposal.kind, 'public_program_control_probe');
  return proposal;
}

/** Controlled insertion, not an observed game return. Its new member colour
 * deliberately has no relationship to the clicked glyph's palette. */
async function controlledInsertion(packet: NativePublicObservation, proposal: R, label = 201) {
  const plan = proposal.program_control_probe_plan, rows = copy(packet.frame_rows) as number[][];
  assert.equal(plan.before_word.length, 1);
  assert.ok(!plan.control.palette.includes(label));
  const [width, height] = plan.layout.member_size, first = plan.layout.members[0].bbox;
  const top = first[1] - height - 1;
  assert.ok(top >= 0);
  for (let y = top; y < top + height; y++) for (let x = first[0]; x < first[0] + width; x++) rows[y]![x] = label;
  const word = [label, ...plan.before_word], base = plan.owner.base;
  const anchor = base.map((value: number, index: number) => value - word.length * plan.model.layer.step[index]);
  for (const [point, color] of renderProgramLayers(word, plan.model.layer.shape, plan.model.layer.step)) {
    const [x, y] = point.split(',').map(Number);
    rows[anchor[1] + y!]![anchor[0] + x!] = color;
  }
  const next = { ...copy(packet), frame_rows: rows, frame_packet: [rows], frame_hash: await rowsDigest(rows), step_index: packet.step_index + 1 };
  return view(next, 37);
}

async function withAcquiredInsertion() {
  const current = await afterKnownBinding(), proposal = await probe(current.family, current.packet, current.observation);
  assert.equal(proposal.program_control_probe_plan.mode, 'probe_edit');
  const after = await controlledInsertion(current.packet, proposal);
  current.family.record(current.observation, after.observation, proposal.actions[0], current.packet.frame_rows,
    after.packet.frame_rows, proposal, 0, after.packet.frame_packet);
  const binding = current.family.memory.controlDiscoveryEvents.find((event: R) => event.kind === 'native_program_control_binding');
  assert.ok(binding);
  assert.equal(binding.label, 201);
  assert.equal(binding.operator_status, 'unknown');
  return { family: current.family, ...after, binding };
}

test('current control discovery is explicit, uses a real public row and confers no learned-effect priority', async () => {
  const disabled = await afterKnownBinding(false), enabled = await afterKnownBinding();
  assert.equal(await disabled.family.programPropose(disabled.observation, disabled.packet.frame_rows, [], 32, 360_000, () => 0), null);
  const previous = enabled.family.state(), proposal = await probe(enabled.family, enabled.packet, enabled.observation);
  const plan = proposal.program_control_probe_plan;
  assert.equal(plan.mode, 'probe_edit');
  assert.equal(plan.operator_status, 'unknown');
  assert.equal(proposal.actions.length, 1);
  assert.deepEqual(enabled.family.state(), previous, 'Questions and bindings are not acquisitions');
  assert.equal(sharedLearnedPreparationWitness(enabled.family.memory, fixture.policy.recall, proposal, enabled.observation), null,
    'Knowledge of an editor does not certify the effect of an unattributed command');
  const domain = new ObservedInputDomain(256);
  domain.candidates(enabled.observation); enabled.family.bind(proposal, domain);
  assert.deepEqual(proposal.steps[0].point_binding.projection_bbox, plan.control.bbox);
  assert.deepEqual(proposal.steps[0].point_binding.point, [proposal.actions[0].data.x, proposal.actions[0].data.y]);
  assert.equal(proposal.steps[0].point_binding.observation_ref, enabled.observation.observation_ref);
  assert.equal(enabled.family.before(proposal, 0, enabled.packet, enabled.observation).admitted, true);
});

test('the shared guard revalidates the actual retained model, current input, glyph and point payload', async () => {
  const { family, packet, observation } = await afterKnownBinding(), proposal = await probe(family, packet, observation), previous = family.state();
  for (const alter of [
    (p: R) => { p.program_control_probe_plan.model_digest = 'forged'; },
    (p: R) => { p.program_control_probe_plan.control.patch[0][0] = 200; },
    (p: R) => { p.program_control_probe_plan.observation_ref = 'unobserved-context'; },
  ]) {
    const changed = copy(proposal); alter(changed);
    assert.equal(family.before(changed, 0, packet, observation).admitted, false);
  }
  const unavailable = { ...packet, available_action_refs: packet.available_action_refs.filter(ref => ref !== 'ACTION6') };
  assert.equal(family.before(proposal, 0, unavailable, observation).admitted, false);
  const changedRows = copy(packet.frame_rows) as number[][], [x, y] = proposal.program_control_probe_plan.control.bbox;
  changedRows[y]![x] = 200;
  assert.equal(family.before(proposal, 0, { ...packet, frame_rows: changedRows }, observation).admitted, false);
  const changedPoint = copy(proposal); changedPoint.actions[0].data.x++;
  const domain = new ObservedInputDomain(256); domain.candidates(observation);
  assert.throws(() => family.bind(changedPoint, domain), /payload differs/);
  assert.deepEqual(family.state(), previous);
});

test('a stationary unknown-input return is a scoped trial, not a refutation of the old operator model', async () => {
  const { family, packet, observation } = await afterKnownBinding(), proposal = await probe(family, packet, observation);
  const models = copy(family.memory.compositionModels), refuted = [...family.memory.compositionRefutedEpochs];
  const after = await view({ ...copy(packet), step_index: packet.step_index + 1 }, 37);
  assert.equal(family.after(proposal, 0, observation, after.observation, packet.frame_rows, after.packet.frame_rows).matched, null);
  const result = family.record(observation, after.observation, proposal.actions[0], packet.frame_rows,
    after.packet.frame_rows, proposal, 0, after.packet.frame_packet);
  const discoveries = result.events.filter(hasNativeEvent);
  assert.equal(discoveries.length, 1);
  assert.equal(discoveries[0].kind, 'native_program_control_trial');
  assert.equal(discoveries[0].outcome, 'collection_insertion_unresolved');
  assert.equal(discoveries[0].public_changed, false);
  assert.deepEqual(family.memory.compositionModels, models);
  assert.deepEqual([...family.memory.compositionRefutedEpochs], refuted);
  assert.equal(family.memory.requestedStopReason, null);
  assert.equal(await family.programPropose(after.observation, after.packet.frame_rows, [], 32, 360_000, () => 0), null,
    'A new observation identifier does not justify retrying the same failed local question');
});

test('an acquired insertion survives shared checkpoint restoration and its unknown label cannot disappear from planning', async () => {
  const { family, packet, observation, binding } = await withAcquiredInsertion();
  const beforeModels = copy(family.memory.compositionModels), state = family.nativeState();
  assert.equal(binding.control.palette.includes(binding.label), false, 'The output label is learned from the return, not the control colours');
  assert.equal(programControlDiscoveryBlocksOrdinaryPlan(family.memory.compositionModels.at(-1)!, family.memory.controlDiscoveryEvents, packet.frame_rows), true);
  const proposal = await probe(family, packet, observation);
  assert.equal(proposal.program_control_probe_plan.mode, 'probe_execute');
  assert.equal(proposal.program_control_probe_plan.binding.label, binding.label);
  assert.deepEqual(proposal.actions, [{ action_ref: family.memory.compositionModels.at(-1)!.command_ref }]);
  assert.equal(family.before(proposal, 0, packet, observation).admitted, true);
  assert.equal(sharedLearnedPreparationWitness(family.memory, fixture.policy.recall, proposal, observation), null);
  const restored = new SharedSeriesConstraint(fixture.policy.recall, { currentProgramAccess: true, programControlDiscovery: true });
  restored.restoreNative(state);
  assert.deepEqual(restored.nativeState(), state);
  const second = await probe(restored, packet, observation);
  assert.deepEqual(second, proposal);
  assert.equal(restored.before(second, 0, packet, observation).admitted, true);

  // A native journal does not implicitly enable experiments in a source-only instance.
  const disabled = new SharedSeriesConstraint(fixture.policy.recall, { currentProgramAccess: true });
  disabled.restoreNative(state);
  assert.equal(await disabled.programPropose(observation, packet.frame_rows, [], 32, 360_000, () => 0), null);

  // Failed recall publishes neither the tampered state nor an empty learned model.
  const corrupted = copy(state), acquired = corrupted.events.find((event: R) => event.kind === 'native_program_control_binding');
  acquired.label++;
  assert.throws(() => restored.restore(corrupted), /memory changed during recall/);
  assert.deepEqual(restored.nativeState(), state);
  restored.memory.controlDiscoveryEvents = [];
  restored.restoreNative(state);
  assert.deepEqual(restored.nativeState(), state, 'A cached immutable checkpoint does not authorize reuse of a changed working reducer');
  assert.deepEqual(restored.memory.compositionModels, beforeModels);
});

test('unknown execution evidence is retained without promoting semantics or poisoning a previously learned model', async () => {
  const { family, packet, observation } = await withAcquiredInsertion(), proposal = await probe(family, packet, observation);
  const models = copy(family.memory.compositionModels), refuted = [...family.memory.compositionRefutedEpochs];
  const after = await view({ ...copy(packet), step_index: packet.step_index + 1 }, 38);
  const command = normalized(proposal.actions[0]);
  const result = family.record(observation, after.observation, command, packet.frame_rows,
    after.packet.frame_rows, proposal, 0, after.packet.frame_packet);
  const effects = result.events.filter((event: R) => event.kind === 'native_program_control_effect');
  assert.equal(effects.length, 1, 'An empty canonical discrete payload must not drop the actual acquired return');
  assert.equal(effects[0].status, 'operator_effect_unresolved');
  assert.equal(effects[0].operator_model_created, false);
  assert.deepEqual(effects[0].evidence, [observation.observation_ref, after.observation.observation_ref]);
  assert.deepEqual(family.memory.compositionModels, models);
  assert.deepEqual([...family.memory.compositionRefutedEpochs], refuted);
  assert.equal(family.memory.requestedStopReason, null);
  assert.equal(await family.programPropose(after.observation, after.packet.frame_rows, [], 32, 360_000, () => 0), null);
  const state = family.nativeState(), restored = new SharedSeriesConstraint(fixture.policy.recall, { currentProgramAccess: true, programControlDiscovery: true });
  restored.restoreNative(state);
  assert.deepEqual(restored.memory.controlDiscoveryEvents, family.memory.controlDiscoveryEvents);
});

test('a newly acquired but unmodeled member blocks an otherwise available incomplete-palette projection', async () => {
  const { family, packet, binding } = await withAcquiredInsertion(), model = family.memory.compositionModels.at(-1)!;
  // Controlled falsifier: restore the old complete row and put the unknown
  // member underneath a known one. The source palette can then decode only
  // the known top shape and mistakenly see an executable one-member word.
  // This constructed scene is not attributed to a real game transition.
  const rows = copy(recordedPacket(36).frame_rows) as number[][];
  const controls: R[] = model.editor_geometry.controls;
  for (const control of controls) {
    for (let y = control.bbox[1]; y <= control.bbox[3]; y++) for (let x = control.bbox[0]; x <= control.bbox[2]; x++) {
      rows[y]![x] = control.patch[y - control.bbox[1]][x - control.bbox[0]];
    }
  }
  const members: R[] = binding.members_after, reordered = [binding.before_word[0], binding.label];
  for (const [index, member] of members.entries()) {
    for (let y = member.bbox[1]; y <= member.bbox[3]; y++) for (let x = member.bbox[0]; x <= member.bbox[2]; x++) rows[y]![x] = reordered[index]!;
  }
  const owner = binding.owner_before, target = (binding.objects_after as R[]).find(object => object.word.every((label: number) => label === model.interaction.label))!;
  assert.ok(target);
  const counts = new Map<number, number>();
  for (const color of rows.flat()) counts.set(color, (counts.get(color) ?? 0) + 1);
  const background = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
  for (const point of renderProgramLayers(target.word, model.layer.shape, model.layer.step).keys()) {
    const [x, y] = point.split(',').map(Number); rows[target.anchor[1] + y!]![target.anchor[0] + x!] = background;
  }
  const wanted = [
    { anchor: owner.anchor, word: reordered },
    { anchor: target.base.map((value: number, index: number) => value - model.layer.step[index]), word: [model.interaction.label] },
  ];
  for (const object of wanted) for (const [point, color] of renderProgramLayers(object.word, model.layer.shape, model.layer.step)) {
    const [x, y] = point.split(',').map(Number); rows[object.anchor[1] + y!]![object.anchor[0] + x!] = color;
  }
  const current = await view({ ...copy(packet), frame_rows: rows, frame_packet: [rows], frame_hash: await rowsDigest(rows), step_index: 39 }, 39);
  const original = observedProgramQuestion(family.memory, current.observation, rows, 16,
    { remaining_level_actions: 32, level_deadline: 360, now: () => 0, native_current_program_access: true });
  assert.ok(original, 'The controlled scene actually exposes the incomplete-palette planning risk');
  assert.equal(original.kind, 'public_program_composition');
  assert.ok(!original.program_composition_plan.word.includes(binding.label));
  assert.equal(programControlDiscoveryBlocksOrdinaryPlan(model, family.memory.controlDiscoveryEvents, rows), true);
  assert.equal(await family.programPropose(current.observation, rows, [], 32, 360_000, () => 0), null,
    'A currently present unknown member cannot be erased from the executing program by an old palette');
});

test('contact scope acquisition checks every returned image and the public protocol boundary', async context => {
  // The public raster is reused in an explicitly controlled fresh context.
  // These supplied returns test witness measurement, not physical game play.
  const initial = { ...recordedPacket(36), level: 1, levels_completed: 0, step_index: 0 };
  for (const variant of [
    { id: 'unchanged public return', expected: 'stationary_unlearned_invitation', change: (_packet: R) => {} },
    { id: 'different intermediate image despite an unchanged final image', expected: 'outside_stationary_invitation_scope', change: (packet: R) => {
      const intermediate = copy(packet.frame_rows); intermediate[0][0] = (intermediate[0][0] + 1) % 256;
      packet.frame_packet = [intermediate, copy(packet.frame_rows)];
    } },
    { id: 'changed public action domain', expected: 'outside_stationary_invitation_scope', change: (packet: R) => {
      packet.available_action_refs = [...packet.available_action_refs, 'ACTION1'];
    } },
    { id: 'official level progress', expected: 'outside_stationary_invitation_scope', change: (packet: R) => {
      packet.level++; packet.levels_completed++;
    } },
    { id: 'official terminal state', expected: 'outside_stationary_invitation_scope', change: (packet: R) => {
      packet.state = 'GAME_OVER';
    } },
  ]) await context.test(variant.id, async () => {
    const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
    let result = await runtime.initialize({ sessionId: `controlled-contact-scope:${variant.id}`, observation: copy(initial),
      budgets: { targetLevels: 2, levelActionCaps: [10, 10], maxActions: 20 } }, execution);
    assert.equal(result.kind, 'action', result.reason);
    assert.equal(result.snapshot.lastDecision, 'animated_contact');
    assert.equal((result.snapshot.proposal as R).animated_contact_plan.mode, 'invitation');
    const packet = { ...copy(initial), frame_packet: [copy(initial.frame_rows)], step_index: 1 };
    variant.change(packet);
    result = await runtime.advance({ command: result.command!, executionMs: 0, observation: packet }, execution);
    assert.equal(result.snapshot.actions, 1);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
    const graph = runtime.inspectKnowledge(), id = 'native_contact_probe_scope:animated_contact';
    const value = hydrateNativeState(graph.nodes[id]!.value, ref => graph.nodes[ref]!.value) as R;
    assert.equal(value.status, variant.expected);
    assert.equal(value.returned_frame_count, packet.frame_packet.length);
    assert.ok(graph.nodes[value.transition_ref]);
  });
});

test('cold common acquisition scopes a contact refusal and measures a conditional return preparation', async context => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const family = (runtime as unknown as { families: NativeFamily[] }).families.find(item => item.id === 'public_occurrence_recall')!;
  assert.deepEqual((family.state() as R).events, []);
  let result = await runtime.initialize({ sessionId: 'anonymous-control-discovery-cold-public-replay', observation: recordedPacket(0),
    budgets: { targetLevels: 6, levelActionCaps: [600, 600, 600, 600, 600, 600], maxActions: 3600 } }, execution);
  for (let index = 1; index <= 37; index++) {
    if (result.kind === 'boundary') result = await runtime.resume(execution);
    assert.equal(result.kind, 'action', `Before recorded command ${index}: ${result.reason}`);
    assert.deepEqual(normalized(result.command!), normalized(trace.packets[index].command), `Recorded public choice ${index}`);
    result = await runtime.advance({ command: result.command!, executionMs: 0, observation: recordedPacket(index) }, execution);
    assert.equal(result.snapshot.actions, index);
  }
  assert.equal(result.kind, 'boundary');
  const acquired = family.state() as R;
  const models = acquired.events.filter((event: R) => event.kind === 'fitted_program_composition');
  assert.ok(models.length > 0);

  const internal = runtime as unknown as R, contact = (internal.families as NativeFamily[]).find(item => item.id === 'animated_contact')!;
  const graphBefore = runtime.inspectKnowledge(), store = internal.knowledge;
  const scopeRef = 'native_contact_probe_scope:animated_contact', contactRef = 'family_state:animated_contact';
  const scope = copy(store.value(scopeRef)) as R, contactState = copy(store.value(contactRef)) as R;
  assert.equal(scope.status, 'stationary_unlearned_invitation');
  assert.equal(scope.epoch, 4);
  assert.equal(scope.score, 3);
  assert.deepEqual(scope.command, normalized(trace.packets[37].command));
  assert.deepEqual(scope.evidence, contactState.events.at(-1).evidence);
  assert.equal(contactState.events.at(-1).model, null);
  assert.ok(graphBefore.nodes[scope.transition_ref], 'The local refusal scope points to an acquired common transition');
  const inputs = internal.domain.candidates(internal.observation);
  const refusal = await contact.propose(internal.observation, internal.current.frame_rows, inputs, 600, execution);
  assert.equal(refusal!.status, 'unknown');

  // These read-only counterfactuals exercise arbitration against the single
  // genuinely acquired cold state. They do not insert or edit learned events.
  async function refusalScoped(overrides: { scope?: R | null; contactState?: R; missingNode?: boolean } = {}) {
    const nodes = { ...store.memory.nodes };
    if (overrides.missingNode) delete nodes[scopeRef];
    internal.knowledge = new Proxy(store, { get(target, property) {
      if (property === 'memory' && overrides.missingNode) return { ...target.memory, nodes };
      if (property === 'value') return (id: string) => id === scopeRef && Object.hasOwn(overrides, 'scope') ? overrides.scope
        : id === contactRef && overrides.contactState ? overrides.contactState : target.value(id);
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    internal.planning = { execution, inputs, offers: new Map(), entryOffers: new Map(), coordination: [] };
    try {
      const admitted = await internal.scopeStationaryContactRefusal(contact, refusal);
      assert.deepEqual(internal.planning.coordination, [], 'A rejected deferral must not publish a priority receipt');
      return admitted;
    } finally { internal.knowledge = store; internal.planning = null; }
  }

  await context.test('missing or unobserved scope does not suppress the original refusal', async () => {
    assert.equal(await refusalScoped({ missingNode: true }), false);
    assert.equal(await refusalScoped({ scope: null }), false);
    assert.equal(await refusalScoped({ scope: { status: 'unobserved' } }), false);
  });
  for (const change of [
    { id: 'old epoch', apply: (value: R) => { value.epoch--; } },
    { id: 'other score', apply: (value: R) => { value.score--; } },
    { id: 'other public state', apply: (value: R) => { value.public_state = 'GAME_OVER'; } },
    { id: 'other input domain', apply: (value: R) => { value.available_action_refs = ['ACTION5']; } },
    { id: 'changed image during the invitation', apply: (value: R) => { value.status = 'outside_stationary_invitation_scope'; } },
    { id: 'another contact response', apply: (value: R) => { value.evidence = ['unrelated-before', 'unrelated-after']; } },
    { id: 'another contact command', apply: (value: R) => { value.command.data.x++; } },
    { id: 'another contact image', apply: (value: R) => { value.frame_digest = 'unrelated-raster'; } },
  ]) await context.test(`local refusal scope rejects ${change.id}`, async () => {
    const changed = copy(scope); change.apply(changed);
    assert.equal(await refusalScoped({ scope: changed }), false);
  });
  await context.test('source contact models and later contact events preserve the original refusal', async () => {
    const modeled = copy(contactState); modeled.events.at(-1).model = { model_ref: 'controlled-acquired-contact-model' };
    assert.equal(await refusalScoped({ contactState: modeled }), false);
    const nonInvitation = copy(contactState); nonInvitation.events.at(-1).mode = 'curve_disclosure';
    assert.equal(await refusalScoped({ contactState: nonInvitation }), false);
    const later = copy(contactState); later.events.push({ ...copy(later.events.at(-1)), evidence: ['later-before', 'later-after'] });
    assert.equal(await refusalScoped({ contactState: later }), false);
    assert.equal(await refusalScoped({ contactState: { ...contactState, events: [] } }), false);
  });
  await context.test('a current guard veto prevents the independently grounded unknown question', async child => {
    const before = family.before.bind(family); let vetoes = 0;
    child.mock.method(family, 'before', (...args: Parameters<NativeFamily['before']>) => {
      if (args[0].kind === 'public_program_control_probe') {
        vetoes++; return { admitted: false, reason: 'controlled_current_control_changed' };
      }
      return before(...args);
    });
    assert.equal(await refusalScoped(), false);
    assert.equal(vetoes, 1);
  });
  await context.test('an earlier unsupported window question cannot borrow a later acquired editor context', async child => {
    const original = family.proposeInSubquestion!.bind(family), calls: string[] = [];
    child.mock.method(family, 'proposeInSubquestion', (...args: Parameters<NonNullable<NativeFamily['proposeInSubquestion']>>) => {
      if (args[0] === 'window_constraints') {
        calls.push(args[1]);
        if (args[1] === 'cell_patch_composition') return { status: 'proposed', kind: 'controlled_unsupported_inquiry',
          proposal_id: 'controlled-first-window-inquiry', actions: [], steps: [] };
      }
      return original(...args);
    });
    assert.equal(await refusalScoped(), false);
    assert.deepEqual(calls, ['cell_patch_composition']);
  });
  assert.equal(runtime.inspectKnowledge(), graphBefore, 'Counterfactual refusal checks do not alter the Kernel graph');
  assert.deepEqual(family.state(), acquired, 'Counterfactual arbitration acquires no model or binding');

  result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason);
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.kind, 'public_program_control_probe');
  assert.equal(proposal.program_control_probe_plan.mode, 'probe_edit');
  assert.equal(proposal.field_subquestion, 'observed_program_composition');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  const coordination = proposal.strategy_receipt.native_coordination;
  assert.equal(coordination.length, 1);
  assert.equal(coordination[0].rule, 'stationary_unlearned_contact_refusal_is_local');
  assert.equal(coordination[0].learned_preparation, undefined, 'An unknown effect receives no learned-preparation priority');
  assert.equal(coordination[0].grounded_inquiry.status, 'acquired_context_for_unknown_effect');
  assert.equal(coordination[0].grounded_inquiry.observation_ref, proposal.program_control_probe_plan.observation_ref);
  assert.equal(coordination[0].preferred_proposal_id, proposal.proposal_id);
  assert.equal(coordination[0].contact_scope_ref, scopeRef);
  assert.equal(coordination[0].contact_scope_revision, graphBefore.nodes[scopeRef]!.revision);
  assert.deepEqual(coordination[0].contact_evidence_refs, scope.evidence);
  assert.equal(coordination[0].source_state_ref, 'family_state:public_occurrence_recall');
  assert.equal(coordination[0].source_state_revision, graphBefore.nodes['family_state:public_occurrence_recall']!.revision);
  assert.ok(result.authorization, 'The new experimental point must still pass WHY/ACT');
  assert.deepEqual(proposal.steps[0].point_binding.projection_bbox, proposal.program_control_probe_plan.control.bbox);
  assert.deepEqual(family.state(), acquired, 'Planning performs no synthetic acquisition');

  // Controlled returns below test acquisition, not physical game actions or
  // a new level success. The inserted label is absent from the clicked glyph.
  const inserted = await controlledInsertion(recordedPacket(37), proposal);
  result = await runtime.advance({ command: result.command!, executionMs: 0, observation: inserted.packet }, execution);
  assert.equal(result.kind, 'boundary', result.reason);
  assert.equal(result.snapshot.actions, 38);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 38);
  const bindingState = family.state() as R, bindings = bindingState.events.filter((event: R) => event.kind === 'native_program_control_binding');
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].label, 201);
  assert.equal(bindings[0].control.palette.includes(201), false);
  assert.deepEqual(bindingState.events.filter((event: R) => event.kind === 'fitted_program_composition'), models);
  result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason);
  const execute = result.snapshot.proposal as R;
  assert.equal(execute.kind, 'public_program_control_probe');
  assert.equal(execute.program_control_probe_plan.mode, 'probe_prepare_return');
  assert.equal(execute.program_control_probe_plan.return_status, 'conditional_known_inverse_after_unknown_phase');
  assert.equal(execute.strategy_receipt.native_coordination[0].rule, 'stationary_unlearned_contact_refusal_is_local');
  assert.equal(execute.strategy_receipt.native_coordination[0].contact_scope_revision, graphBefore.nodes[scopeRef]!.revision,
    'The old refusal remains local while the next question revalidates the current changed image');
  assert.ok(result.authorization);
  assert.deepEqual(family.state(), bindingState);
  result = await runtime.advance({ command: result.command!, executionMs: 0,
    observation: { ...copy(inserted.packet), step_index: 39 } }, execution);
  assert.equal(result.kind, 'boundary', result.reason);
  assert.equal(result.snapshot.actions, 39);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 39);
  assert.deepEqual((result.snapshot.whyAct as R).analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
  const graph = runtime.inspectKnowledge(), read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, ref => graph.nodes[ref]!.value) as R;
  const retained = read('family_state:public_occurrence_recall'), native = retained.events.filter(hasNativeEvent);
  assert.deepEqual(native.map((event: R) => event.kind), ['native_program_control_trial', 'native_program_control_binding',
    'native_program_control_trial'], 'Selected and passive registration acquire each distinct response exactly once');
  assert.equal(native[0].public_changed, true);
  assert.equal(native[2].public_changed, false);
  assert.equal(native[2].outcome, 'known_return_preparation_unresolved');
  assert.equal(native[2].return_preparation, null, 'An unchanged controlled return cannot acquire the proposed inverse insertion');
  assert.equal(retained.events.some((event: R) => event.kind === 'native_program_control_effect'), false);
  assert.deepEqual(retained.events.filter((event: R) => event.kind === 'fitted_program_composition'), models);
  assert.deepEqual(retained, family.state());
  const facts = (read('reasoning:memory').facts as string[]).map(read);
  assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state')!.value, retained);
  const evidence = read(`prefix_evidence:${(result.snapshot.prefix as R).revision}`);
  assert.equal(evidence.proposal.kind, 'public_program_control_probe');
  const transition = read(`reasoning:transition:${evidence.decision_revision}`);
  assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
  assert.equal(result.snapshot.levelsCompleted, 3, 'This replay does not claim a fourth level or a new physical campaign');
});
