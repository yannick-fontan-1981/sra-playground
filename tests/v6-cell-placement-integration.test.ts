import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily, NativeExecution } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { CellPlacementMemory } from '../src/logos-engine/v6-cell-placement.ts';

type R = Record<string, any>;
const oracle = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-cell-placement-reference.json.gz', import.meta.url))).toString());
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const configuration = declarations.strategy.declarations[0]!.configuration;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ID = 'family_state:public_occurrence_recall';
const copy = <T>(value: T): T => structuredClone(value);

// Controlled public packets exercise the product caller. They are neither
// real-game victories nor learned state supplied to initialize the agent.
test('fresh common caller acquires dated cell roles once through its real SRC and WHY/ACT chain', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const shared = families.filter(family => family.id === 'public_occurrence_recall');
  assert.equal(shared.length, 1, 'Multiple source entries must retain only one acquisition owner');
  const family = shared[0]!, before = copy(family.state());
  let result = await runtime.initialize({ sessionId: 'cell-common-fresh',
    observation: { ...copy(oracle.scenes['seed:empty'].public), step_index: 0 },
    budgets: { targetLevels: 1, levelActionCaps: [40], maxActions: 40 } }, execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.equal(result.snapshot.lastDecision, family.id);
  assert.ok(result.authorization, 'The physical point must be released by WHY/ACT');
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.kind, 'cell_patch_placement');
  assert.equal(proposal.field_subquestion, 'cell_patch_composition');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.equal(proposal.cell_placement_plan.model, null, 'No role or opponent is preloaded');
  assert.equal(proposal.cell_placement_plan.expected_motif, null);
  assert.deepEqual(result.command, oracle.plans.initial.actions[0]);
  assert.deepEqual(family.state(), before, 'A proposal and its guard do not acquire a game effect');
  const group = (result.snapshot.coverage as R).sourceGroups.find((entry: R) => entry.id === 'window_constraints');
  const cell = group.entryPoints.indexOf('cell_patch_composition'), recall = group.entryPoints.indexOf('observed_occurrence_recall');
  assert.ok(cell >= 0 && recall > cell);
  assert.equal(group.families[cell], family.id); assert.equal(group.families[recall], family.id);

  result = await runtime.advance({ command: result.command!, executionMs: 1,
    observation: { ...copy(oracle.scenes['seed:reply'].public), step_index: 1 } }, execution);
  assert.equal(result.kind, 'boundary');
  assert.equal(result.snapshot.actions, 1); assert.equal(result.snapshot.cycles, 1);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
  assert.deepEqual((result.snapshot.whyAct as R).analysis.map((entry: R) => entry.operation), ['OP29', 'OP30', 'OP31']);
  const graph = runtime.inspectKnowledge();
  const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  const stored = read(ID), cells = stored.events.filter((event: R) => event.kind === 'cell_patch_placement_evidence');
  assert.equal(cells.length, 2, 'One selected-action record and one independently dated packet record');
  assert.equal(stored.events.filter((event: R) => event.kind === 'coupled_pair_epoch_anchor').length, 1);
  const models = Object.values(cells.at(-1).models) as R[];
  assert.equal(models.length, 1); assert.equal(models[0]!.status, 'candidate');
  assert.deepEqual(models[0]!.ordered_frames, [0, 2]);
  assert.notEqual(models[0]!.own, models[0]!.other, 'Same-palette motifs still have distinct exact patch identities');
  assert.deepEqual(stored, family.state());
  const prefix = read(`prefix_evidence:${(result.snapshot.prefix as R).revision}`);
  assert.equal(prefix.transitions.length, 1);
  const acquired = read(`reasoning:transition:${prefix.decision_revision}`);
  assert.ok(acquired.caller_acquisition && acquired.frontier_acquisition);
  const facts = (read('reasoning:memory').facts as string[]).map(read);
  assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state')!.value, stored);

  result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  const resumed = result.snapshot.proposal as R;
  assert.equal(resumed.kind, 'cell_patch_placement');
  assert.equal(resumed.cell_placement_plan.model.status, 'candidate');
  assert.ok(resumed.cell_placement_plan.search);
  assert.equal(resumed.cell_placement_plan.expected_motif, models[0]!.own);
  assert.deepEqual(family.state(), stored, 'Preparing the next conditional move preserves acquired evidence');
});

test('cell reducer changes invalidate delta checkpoint reuse and rejected recall cannot discard learned evidence', context => {
  const family = new SharedSeriesConstraint(configuration.window_constraints.occurrence_recall);
  const first = oracle.scenes['seed:empty'], later = oracle.scenes['seed:reply'];
  family.record(first.observation, later.observation, oracle.plans.initial.actions[0], first.rows, later.rows,
    copy(oracle.plans.initial), 0, later.public.frame_packet);
  const trusted = family.nativeState(), original = CellPlacementMemory.prototype.applyEvent;
  let replays = 0;
  context.mock.method(CellPlacementMemory.prototype, 'applyEvent', function (this: CellPlacementMemory, event: R) {
    replays++; original.call(this, event);
  });
  family.restoreNative(trusted); assert.equal(replays, 0, 'An unchanged owned checkpoint needs no journal replay');
  const cell = copy(trusted.events.filter((event: R) => event.kind === 'cell_patch_placement_evidence').at(-1));
  (Object.values(cell.models)[0] as R).status = 'refuted';
  family.cells.applyEvent(cell);
  const inconsistent = family.nativeState();
  assert.throws(() => family.restoreNative(inconsistent), /Shared series memory changed/);
  replays = 0; family.restoreNative(trusted);
  assert.equal(replays, 2, 'A changed cell reducer requires a verified reconstruction');
  assert.deepEqual(family.state(), trusted);
  const forged = copy(trusted);
  forged.events.find((event: R) => event.kind === 'cell_patch_placement_evidence').detail.command.data.x++;
  assert.throws(() => family.restoreNative(forged), /Shared series memory changed/);
  assert.deepEqual(family.state(), trusted, 'A refused journal edit leaves the live learned model intact');
  replays = 0; family.restoreNative(trusted); assert.equal(replays, 0);
});
