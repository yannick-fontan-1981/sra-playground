import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { V6PublicObservation, V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { createSicVerifyContactOrder } from '../src/sic/ordered-contact.ts';
import { readCrossedPiercing } from '../src/sic/crossed-piercing.ts';
import { observeSupportSelection, supportSelectionAt, type ObservedSupportSelection } from '../src/sic/observed-support-selection.ts';
import type { NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';
import { bindContinuityPlan, collectContinuityReturn } from '../scripts/sic-continuity-evidence.mjs';
import { captureSupportSelection, observeSupportSelectionReturn, completeSupportSelection, measureSupportSelection } from '../scripts/sic-support-selection-continuity.mjs';

type Return = { action: { id: number; data?: { x: number; y: number } }; before: number[][]; after: number[][]; won?: boolean };
const fixture: { training: Return[]; selection: Return[] } = JSON.parse(gunzipSync(await readFile(
  new URL('./fixtures/sic-crossed-selection-public.json.gz', import.meta.url))).toString());
const source = JSON.parse(await readFile(new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm', import.meta.url), 'utf8'));

// These are real public returns, not a copy of the planner's predictions.
// The second interface changes the ring masks, origin, palette and
// directional command codes. Its selection effects are learned again natively.
function interfaceVariant(varied: boolean) {
  const dx = varied ? 3 : 0, dy = varied ? -2 : 0;
  const ink = (value: number) => varied ? (value * 5 + 7) % 16 : value;
  const action = (id: number) => varied && id >= 1 && id <= 4 ? id + 1 : id;
  const command = (actual: Return['action']) => ({ actionRef: 'ACTION' + action(actual.id),
    data: actual.data ? { x: actual.data.x + dx, y: actual.data.y + dy } : {} });
  const rows = (frame: number[][]) => {
    const changed = structuredClone(frame);
    if (varied) for (const part of geometricComponents(frame)) {
      const [l, t, r, b] = part.bbox;
      if (r - l === 5 && b - t === 5 && part.area > 6 && part.area < 18) changed[t]![l + 3] = part.color;
    }
    const result = Array.from({ length: 64 }, () => Array<number>(64).fill(ink(5)));
    changed.forEach((row, y) => row.forEach((value, x) => {
      if (x + dx >= 0 && x + dx < 64 && y + dy >= 0 && y + dy < 64) result[y + dy]![x + dx] = ink(value);
    }));
    return result;
  };
  return { rows, command, ids: [1, 2, 3, 4, 5, 6], wait: varied ? 'ACTION1' : 'ACTION5',
    remap: (ref: string) => 'ACTION' + action(Number(ref.slice(6))) };
}

async function runPublicSelection(varied: boolean, mutation?: 'marking' | 'pose' | 'rail' | 'control') {
  const variant = interfaceVariant(varied), policy = structuredClone(source.declarations[0].configuration.observed_composition_services.rooted_line_question);
  policy.probe_order = policy.probe_order.map(variant.remap);
  const family = createSicVerifyContactOrder(policy, defaultRecoveryPack);
  const fallback: NativeFamily = {
    id: preparedEffectsId,
    proposeInSubquestion(_group, _entry, ...args) { return this.propose(...args); },
    propose(observation) {
      if ((family.state().crossed?.selections?.length ?? 0) < 2) return null;
      const action = { action_ref: variant.wait, data: {} };
      return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action }],
        binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch } };
    },
    before: (proposal, _index, _packet, observation) => ({ admitted: proposal.binding?.observation_ref === observation.observation_ref, reason: 'independent_trial' }),
    after: () => ({ matched: null, seal_prefix: true, reason: 'independent_return' }),
    record: () => ({ events: [] }), state: () => ({}), restore() {},
  };
  const groups = planningGroupsWithExperiments(standalonePlanningGroups).map(group => {
    const entries = group.families.flatMap((id, index) => [family.id, fallback.id].includes(id)
      ? [{ id, entry: group.entryPoints?.[index] ?? null }] : []);
    return { ...group, families: entries.map(entry => entry.id), entryPoints: entries.map(entry => entry.entry) };
  }).filter(group => group.families.length);
  const runtime = new NativeV6Runtime({ families: [family, fallback], groups, sourceDigest: 'measured-support-selection', maxPointOccurrences: 250 });
  const service = new V6AgentService(() => runtime), sessionId = 'support-selection-' + varied + '-' + (mutation ?? 'stable');
  const packet = (frame: number[][], sequence: number, level: number): V6PublicObservation => ({
    frame, frames: [frame], level, levelsCompleted: level - 1, state: 'NOT_FINISHED', availableActionIds: variant.ids, stepIndex: sequence,
  });
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: packet(variant.rows(fixture.training[0]!.before), sequence, 1), budgets: { targetLevels: 2, levelActionCaps: [50, 90] } });
  const tickets: V6Ticket[] = [], replies: typeof reply[] = [], mixedProposals: any[] = [];
  const executed: any[] = [];
  let priorPlan: any;
  const mutationAt = mutation === 'rail' ? 9 : mutation === 'control' ? 18 : 12;
  try {
    for (const [index, returned] of [...fixture.training, ...fixture.selection.slice(0, 25)].entries()) {
      assert.ok(reply.ticket, JSON.stringify({ index, reason: reply.snapshot.reason }));
      const expected = variant.command(returned.action), ticket = reply.ticket;
      const plan = priorPlan = bindContinuityPlan(ticket, reply.snapshot.trace, priorPlan);
      const capture = captureSupportSelection(reply.snapshot.proposal, ticket, variant.rows(returned.before), () => family.state());
      assert.deepEqual({ actionRef: ticket.actionRef, data: ticket.data }, expected, 'The native ticket follows the observed public action at ' + index);
      const currentLevel = index < fixture.training.length ? 1 : 2;
      const local = index - fixture.training.length;
      if (local === 9) {
        mixedProposals.push({ ...structuredClone(reply.snapshot.proposal),
          selectionEvidence: family.state().crossed.selections.flatMap((effect: ObservedSupportSelection) => effect.refs) });
        assert.equal(reply.snapshot.proposal?.actions.length, 16);
        assert.ok(reply.snapshot.proposal?.actions.slice(1).some((value: any) => value.action_ref === 'ACTION6'));
      }
      let rows = variant.rows(returned.won ? fixture.selection[0]!.before : returned.after);
      if (mutation && local === mutationAt) {
        const scene = readCrossedPiercing(rows, 6, (reply.snapshot.proposal as any).crossed.scene.layout)!;
        assert.ok(scene);
        if (mutation === 'marking') {
          const [x, y] = scene.handles[0]!;
          rows[y + 2]![x + 5] = (rows[y + 2]![x + 5]! + 1) % 16;
        } else if (mutation === 'pose') {
          rows = variant.rows(returned.before); // the commanded selection did not change the active support
        } else if (mutation === 'control') {
          const [x, y] = scene.layout.shafts[0]!.select;
          rows[y]![x] = (rows[y]![x]! + 1) % 16;
        } else {
          const next = (reply.snapshot.proposal as any).crossed.path[ticket.actionIndex + 1];
          const from = scene.pose.heads[next.active].line, to = next.pose.heads[next.active].line;
          // A future transverse move needs the public link, even in a retained series.
          const axis = scene.layout.shafts[next.active].axis, at = Math.min(from, to);
          const [ox, oy] = scene.layout.origin;
          const x = axis === 0 ? ox + 2 : ox + (at + 1) * 6 - 1;
          const y = axis === 0 ? oy + (at + 1) * 6 - 1 : oy + 2;
          rows[y]![x] = rows[oy]![ox]!; rows[y + axis]![x + 1 - axis] = rows[oy]![ox]!;
        }
      }
      tickets.push(ticket);
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id,
        executionMs: 1, observation: packet(rows, sequence, returned.won ? 2 : currentLevel) });
      replies.push(reply);
      const actual = collectContinuityReturn(ticket, plan, reply.snapshot.trace);
      executed.push({ level: ticket.level, decisionRevision: ticket.decisionRevision, actionIndex: ticket.actionIndex,
        action: ticket.actionRef, ...(ticket.actionRef === 'ACTION6' ? { data: ticket.data } : {}), resets: 0, ...actual,
        supportSelection: completeSupportSelection(observeSupportSelectionReturn(capture, returned.won ? null : rows),
          () => family.state(), actual, reply.snapshot.levelsCompleted) });
      if (mutation && local === mutationAt) break;
      if (reply.kind === 'boundary' && local !== 24) reply = await service.handle({ type: 'resume', sessionId, sequence });
    }
    return { familyState: family.state(), tickets, replies, reply, mixedProposals, executed };
  } finally { runtime.close('test_complete'); }
}

for (const varied of [false, true]) test('native acquisition reuses measured selections inside a mixed movement prefix' + (varied ? ' after changing the interface geometry, masks, palette and controls' : ''), async () => {
  const run = await runPublicSelection(varied);
  const mixed = run.tickets.slice(fixture.training.length + 9);
  assert.equal(mixed.length, 16);
  assert.deepEqual(mixed.map(ticket => ticket.actionIndex), Array.from({ length: 16 }, (_, i) => i));
  assert.ok(mixed.every(ticket => ticket.graphChain && ticket.nativeExecutionDigest));
  assert.equal(run.replies.slice(fixture.training.length + 9).filter(reply => reply.kind === 'boundary').length, 1);
  assert.equal(run.reply.kind, 'boundary');
  assert.equal(run.reply.snapshot.acquiredRecords, run.tickets.length);
  assert.equal(run.familyState.crossed.active, 1);
  assert.equal(run.familyState.crossed.selections.length, 2);
  assert.equal(run.mixedProposals[0].selectionEvidence.length, 4);
  for (const ref of run.mixedProposals[0].selectionEvidence) assert.ok(run.mixedProposals[0].route_refs.includes(ref));
  assert.ok(!run.reply.snapshot.trace.some(event => event.kind === 'native_acquisition_incomplete'));
  const groups = new Map<string, any[]>();
  for (const ticket of run.executed) groups.set(ticket.planId, [...(groups.get(ticket.planId) ?? []), ticket]);
  const physical = measureSupportSelection(run.executed, groups);
  assert.ok(physical.some(series => series.movements > 0 && series.selections >= 3 && series.continued === 15));
  for (const mutate of ['selection', 'physical', 'proof', 'acquisition']) {
    const edited = structuredClone(run.executed), selected = edited.find(ticket => ticket.actionIndex > 0 && ticket.supportSelection?.selecting)!;
    if (mutate === 'selection') selected.supportSelection.witness = null;
    if (mutate === 'physical') selected.supportSelection.after.markings = selected.supportSelection.before.markings;
    if (mutate === 'proof') selected.supportSelection.witness.refs[0] = 'other:epoch:2:revision:1:frame:0000000000000000';
    if (mutate === 'acquisition') edited.at(-1)!.supportSelection.acquisition.refs = [];
    const changedGroups = new Map<string, any[]>();
    for (const ticket of edited) changedGroups.set(ticket.planId, [...(changedGroups.get(ticket.planId) ?? []), ticket]);
    assert.throws(() => measureSupportSelection(edited, changedGroups), /SK48/);
  }
});

for (const mutation of ['marking', 'pose'] as const) test('a contradictory selection seals only the actually executed native prefix: ' + mutation, async () => {
  const run = await runPublicSelection(false, mutation);
  assert.equal(run.reply.kind, 'boundary');
  assert.equal(run.reply.snapshot.acquiredRecords, run.tickets.length);
  assert.equal(run.tickets.at(-1)?.actionIndex, 3);
  assert.equal(run.reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
  assert.equal(run.familyState.crossed.pending.length, 0);
  assert.ok(!run.reply.snapshot.trace.some(event => event.kind === 'native_acquisition_incomplete'));
});

for (const mutation of ['rail', 'control'] as const) test('a changed public ' + mutation + ' blocks the next native ticket in a retained selection series', async () => {
  const run = await runPublicSelection(false, mutation);
  assert.equal(run.reply.kind, 'boundary');
  assert.equal(run.reply.snapshot.acquiredRecords, run.tickets.length);
  assert.equal(run.tickets.at(-1)?.actionIndex, mutation === 'rail' ? 0 : 9);
  if (mutation === 'rail') assert.equal(run.reply.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.seal_prefix, true);
  else assert.equal(run.reply.snapshot.trace.findLast(event => event.kind === 'before_guard')?.point_bound, false);
  assert.ok(!run.reply.snapshot.trace.some(event => event.kind === 'native_acquisition_incomplete'));
});

test('a retained selection needs a unique current control, scope and full observed marking transition', () => {
  const rows = [[4, 7], [2, 3]], ref = 'session:epoch:2:revision:9';
  const effect: ObservedSupportSelection = { from: 0, to: 1, action: 'choose', point: [1, 0], ink: 7,
    before: ['a', 'b'], after: ['c', 'd'], refs: ['session:epoch:2:revision:2', 'session:epoch:2:revision:3'] };
  const choose = (effects = [effect], currentRows = rows, currentRef = ref) => supportSelectionAt(effects, 0, 1, 'choose', [1, 0], ['a', 'b'], currentRows, currentRef);
  assert.deepEqual(choose(), effect);
  assert.equal(choose([effect, { ...effect, after: ['x', 'y'] }]), null);
  assert.equal(choose([effect], [[4, 8], [2, 3]]), null);
  assert.equal(choose([effect], rows, 'other:epoch:2:revision:9'), null);
  assert.deepEqual(observeSupportSelection([], effect, true, true), [effect]);
  assert.deepEqual(observeSupportSelection([effect], effect, false, true), []);
  assert.deepEqual(observeSupportSelection([effect], effect, true, false), []);
});
