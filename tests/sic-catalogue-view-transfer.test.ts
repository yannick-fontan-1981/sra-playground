import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { measureOccludedCatalogue } from '../src/logos-engine/v6-occluded-catalogue-observation.ts';
import { createSicCatalogueComparison, continueCatalogueViewsGroup } from '../src/sic/catalogue-comparison.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { NativeRows } from '../src/logos-engine/v6-native-types.ts';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const captured = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-catalogue-role-public.json.gz', import.meta.url))).toString());
const raster = (rows: NativeRows, varied: boolean) => rows.map(row => varied ? [...row].reverse().map(value => (value * 3 + 1) % 16) : [...row]);
const viewCommand = (varied: boolean) => varied ? 'ACTION1' : 'ACTION3';
const extensionScene = measureOccludedCatalogue(captured.steps[5].before.frame)!;
const extensionSource = extensionScene.controls.find((control: any) => control.palette !== extensionScene.palette)!;
const extensionPalette = Array.from({ length: 16 }, (_, value) => value).find(value =>
  !captured.steps[5].before.frame.some((row: number[]) => row.includes(value)) && !captured.nextViewReturn.frame.some((row: number[]) => row.includes(value)))!;
const extensionSite = (() => {
  const [left, top, right, bottom] = extensionScene.field;
  for (let y = top + 1; y < bottom; y++) for (let x = left + 1; x < right; x++) if (
    captured.steps[5].before.frame[y][x] === extensionSource.palette && captured.nextViewReturn.frame[y][x] === extensionSource.palette) return [x, y];
  throw new Error('The public fixture must contain a stationary second subject');
})();
function extendSelectors(rows: NativeRows): number[][] {
  const next = rows.map(row => [...row]), [left, top, right, bottom] = extensionSource.bbox;
  const shift = right - left + 4;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) next[y]![x + shift] = extensionPalette;
  next[extensionSite[1]!]![extensionSite[0]!] = extensionPalette;
  for (let y = 0; y < extensionScene.field[1]; y++) {
    const row = [...next[y]!];
    for (let x = 0; x < row.length; x++) next[y]![x] = row[x + 5] ?? row[0]!;
  }
  return next;
}

type Mutation = 'none' | 'ambiguous_selectors' | 'missing_command' | 'extended_selectors';
function packet(board: any, stepIndex: number, varied: boolean, mutation: Mutation = 'none'): V6PublicObservation {
  const frame = raster(board.level === 2 && mutation === 'extended_selectors' ? extendSelectors(board.frame) : board.frame, varied);
  if (board.level === 2 && mutation === 'ambiguous_selectors') {
    const scene = measureOccludedCatalogue(frame)!;
    const [left, top, right, bottom] = scene.controls[1].bbox;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) frame[y]![x] = scene.controls[0].palette;
  }
  return { frame, frames: [frame], level: board.level, levelsCompleted: board.levelsCompleted, state: board.state,
    availableActionIds: board.level === 2 && mutation === 'missing_command' ? [6]
      : varied ? board.level === 1 ? [1, 6] : [1, 3, 6] : board.availableActionIds, stepIndex };
}

async function start(varied: boolean, mutation: Mutation = 'none') {
  const catalogue = createSicCatalogueComparison(), prepared = createPreparedEffects(undefined, defaultRecoveryPack);
  const calls: { group: string; level: number; proposed: boolean }[] = [];
  const propose = catalogue.proposeInGroup!.bind(catalogue);
  catalogue.proposeInGroup = async (group, observation, ...args) => {
    const result = await propose(group, observation, ...args);
    calls.push({ group, level: observation.level_epoch, proposed: result !== null });
    return result;
  };
  const groups = planningGroupsWithExperiments(standalonePlanningGroups).map(group => {
    const entries = group.families.flatMap((id, index) => [catalogue.id, prepared.id].includes(id)
      ? [{ id, entry: group.entryPoints?.[index] ?? null }] : []);
    return { ...group, families: entries.map(item => item.id), entryPoints: entries.map(item => item.entry) };
  }).filter(group => group.families.length);
  const runtime = new NativeV6Runtime({ families: [catalogue, prepared], groups,
    sourceDigest: 'catalogue-view-transfer', maxPointOccurrences: 100 });
  const service = new V6AgentService(() => runtime), sessionId = 'catalogue-view-' + varied + '-' + mutation;
  let sequence = 0, result = await service.handle({ type: 'init', sessionId, sequence,
    observation: packet(captured.steps[0].before, 0, varied), budgets: { targetLevels: 3, levelActionCaps: [20, 20, 20] } });
  assert.equal(calls.find(call => call.group === continueCatalogueViewsGroup)?.proposed, false,
    'An unacquired view retains its ordinary discovery path');
  for (const step of captured.steps.slice(0, 5)) {
    const ticket = result.ticket;
    assert.ok(ticket, JSON.stringify({ reason: result.reason, proposal: result.snapshot.proposal?.kind }));
    assert.equal(result.snapshot.proposal?.kind, catalogue.id);
    assert.equal(ticket.actionRef, step.command.id === 3 ? viewCommand(varied) : 'ACTION6');
    if (step.command.data) {
      const originalX = varied ? 63 - Number(ticket.data.x) : Number(ticket.data.x);
      assert.ok(Math.abs(originalX - step.command.data.x) <= 1, 'The reflected native center remains inside the same public card or selector');
      assert.equal(ticket.data.y, step.command.data.y);
    }
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id,
      executionMs: 1, observation: packet(step.after, sequence, varied, mutation) });
    assert.equal(result.kind, 'boundary');
    result = await service.handle({ type: 'resume', sessionId, sequence });
  }
  async function advance(rows: NativeRows) {
    assert.ok(result.ticket);
    const current = packet(captured.steps[5].before, sequence + 1, varied);
    current.frame = rows; current.frames = [rows];
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: result.ticket.id,
      executionMs: 1, observation: current });
    return result;
  }
  return { catalogue, prepared, calls, runtime, advance, get result() { return result; } };
}

for (const extended of [false, true]) for (const varied of [false, true]) test('native catalogue reuses the acquired view before a selection preview'
  + (extended ? ' with an additional unlearned selector' : '') + (varied ? ' after a reflection, palette permutation and command change' : ''), async () => {
  const mutation = extended ? 'extended_selectors' : 'none', run = await start(varied, mutation);
  try {
    assert.equal(run.result.snapshot.levelsCompleted, 1);
    assert.equal(run.result.snapshot.actions, 5);
    assert.equal(run.result.ticket?.actionRef, viewCommand(varied));
    assert.ok(run.result.ticket?.graphChain && run.result.ticket.nativeExecutionDigest);
    assert.equal(run.calls.at(-1)?.group, continueCatalogueViewsGroup);
    assert.equal(run.calls.at(-1)?.proposed, true);
    const proposal = run.result.snapshot.proposal!;
    assert.equal(proposal.kind, run.catalogue.id);
    assert.equal(proposal.candidateCount, 4);
    assert.deepEqual(proposal.local.backgrounds, [], 'The new substrate and answer must still be observed');
    assert.ok(proposal.local.evidence.some((ref: string) => ref.includes(':epoch:1:')));
    assert.ok(proposal.local.views.includes(viewCommand(varied)), 'The command comes from the acquired role');
    const returned = await run.advance(packet({ ...captured.steps[5].before, frame: captured.nextViewReturn.frame }, 6, varied, mutation).frame);
    assert.equal(returned.kind, 'boundary');
    assert.equal(returned.snapshot.actions, 6);
    const actual = returned.snapshot.trace.findLast(event => event.kind === 'actual_outcome' && event.family === run.catalogue.id);
    assert.equal(actual?.reason, 'catalogue_view_effect_observed');
    assert.equal(actual?.matched, true);
    assert.equal(returned.snapshot.trace.filter(event => event.kind === 'sealed_prefix').length, 6);
    assert.ok(run.catalogue.state!().state.backgrounds.length > 0);
    if (extended) {
      const learned = Object.values(run.catalogue.state!().learnedViews) as any[];
      const current = learned.find(role => role.controls.length === 3)!;
      assert.ok(current);
      assert.equal(Object.keys(current.commands).length, 2, 'The added selector is not assigned an unobserved effect');
      assert.ok(Object.values(current.commands).every((commands: any) => commands.includes(viewCommand(varied))));
    }
  } finally { run.runtime.close('test_complete'); }
});

for (const mutation of ['ambiguous_selectors', 'missing_command'] as const) test('native catalogue refuses early reuse with ' + mutation + ' and retains its acquired facts', async () => {
  const run = await start(true, mutation);
  try {
    assert.ok(run.calls.some(call => call.level === 2 && call.group === continueCatalogueViewsGroup && !call.proposed));
    assert.ok(!run.calls.some(call => call.level === 2 && call.group === continueCatalogueViewsGroup && call.proposed));
    const retained = Object.values(run.catalogue.state!().learnedViews) as any[];
    assert.equal(retained.length, 1);
    assert.ok(retained[0].evidence.length >= 4);
    assert.equal(retained[0].completed, 1);
  } finally { run.runtime.close('test_complete'); }
});

for (const contradiction of [false, true]) test('native catalogue closes a transferred view on an ' + (contradiction ? 'incompatible' : 'ambiguous') + ' public return without losing its prior proofs', async () => {
  const run = await start(false), proof = structuredClone(run.catalogue.state!().learnedViews);
  try {
    const rows = raster(captured.steps[5].before.frame, false);
    if (contradiction) {
      const scene = measureOccludedCatalogue(rows)!, [left, top, right] = scene.field;
      for (let x = left; x <= right; x++) rows[top]![x] = rows[top - 1]![x]!;
    }
    const returned = await run.advance(rows);
    assert.equal(returned.kind, 'boundary');
    assert.equal(returned.ticket, null);
    assert.ok(returned.snapshot.trace.some(event => event.kind === 'actual_outcome' && event.family === run.catalogue.id
      && event.matched === (contradiction ? false : null)
      && event.reason === (contradiction ? 'catalogue_view_interface_contradicted' : 'catalogue_view_still_ambiguous')));
    assert.deepEqual(run.catalogue.state!().learnedViews, proof);
    if (contradiction) assert.equal(run.catalogue.state!().state.stopped, true);
  } finally { run.runtime.close('test_complete'); }
});

test('a view executed by another family can establish the reusable catalogue role', async () => {
  const catalogue = createSicCatalogueComparison(), first = captured.steps[0];
  const observe = async (board: any, revision: number) => measureNativeObservation({ frame_rows: board.frame,
    frame_hash: await publicFrameHash(board.frame), level: board.level, levels_completed: board.levelsCompleted,
    state: board.state, available_action_refs: board.availableActionIds.map((id: number) => 'ACTION' + id),
  }, revision, 'foreign-catalogue-view');
  await catalogue.observePublicOutcome!(await observe(first.before, 1), await observe(first.after, 2),
    { action_ref: 'ACTION3', data: {} }, first.before.frame, first.after.frame);
  const completion = captured.steps[4];
  await catalogue.observePublicOutcome!(await observe(completion.before, 5), await observe(completion.after, 6),
    { action_ref: 'ACTION6', data: completion.command.data }, completion.before.frame, completion.after.frame);
  assert.equal(catalogue.state!().state, null, 'The role does not require ownership of the acquired action');
  const current = await observe(completion.after, 6);
  const proposal = await catalogue.proposeInGroup!(continueCatalogueViewsGroup, current, completion.after.frame, [], 20);
  assert.equal(proposal?.actions[0]?.action_ref, 'ACTION3');
  assert.ok(proposal?.route_refs.includes((await observe(first.before, 1)).observation_ref));
});

test('two acquired interfaces that fit an extension leave its association ambiguous', async () => {
  const catalogue = createSicCatalogueComparison(), first = captured.steps[0];
  const observe = async (frame: NativeRows, revision: number) => measureNativeObservation({ frame_rows: frame,
    frame_hash: await publicFrameHash(frame), level: 1, levels_completed: 0, state: first.before.state,
    available_action_refs: first.before.availableActionIds.map((id: number) => 'ACTION' + id),
  }, revision, 'ambiguous-catalogue-extension');
  for (const [index, replace] of [false, true].entries()) {
    const mapped = (rows: NativeRows) => rows.map(row => row.map(value => replace && value === extensionSource.palette ? extensionPalette : value));
    const before = mapped(first.before.frame), after = mapped(first.after.frame);
    await catalogue.observePublicOutcome!(await observe(before, 2 * index + 1), await observe(after, 2 * index + 2),
      { action_ref: 'ACTION3', data: {} }, before, after);
  }
  const learned = structuredClone(catalogue.state!().learnedViews);
  assert.equal(Object.keys(learned).length, 2);
  const current = extendSelectors(first.before.frame);
  assert.equal(measureOccludedCatalogue(current)?.controls.length, 3);
  assert.equal(await catalogue.proposeInGroup!(continueCatalogueViewsGroup, await observe(current, 5), current, [], 20), null);
  assert.deepEqual(catalogue.state!().learnedViews, learned);
});
