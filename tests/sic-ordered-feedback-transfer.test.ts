import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { initialFeedbackLayout } from '../src/logos-engine/v6-feedback-sequences-visual.ts';
import type { NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { V6AgentResult, V6PublicObservation, V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import { createSicVerifyOrderedFeedback, verifyOrderedFeedbackId } from '../src/sic/feedback-trial.ts';
import { observedMechanicsGroup } from '../src/sic/strategy-agenda.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { observedPressureRecoveryGroup } from '../src/sic/public-input-exploration.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';

type Transfer = 'compatible' | 'ambiguous' | 'changed_shape' | 'missing_submission';

// This public interface accepts any completely entered trial. It exercises the
// acquisition and transfer of entry/submission, independently of a hidden code.
function entryRoom(variant: boolean, transfer: Transfer) {
  const submit = variant ? 'ACTION2' : 'ACTION5';
  const colors = variant ? [[11, 7, 13], [5, 12, 15, 9]] : [[8, 14, 9], [6, 10, 4, 7]];
  const empty = variant ? 1 : 2, reference = variant ? 4 : 3;
  let level = 1, completed = 0, entered: number[] = [];
  const geometry = () => {
    const w = (variant ? 4 : 3) + (level === 2 && transfer === 'changed_shape' ? 1 : 0);
    const x = (variant ? 7 : 13) + (level === 2 ? 9 : 0), y = (variant ? 34 : 29) + (level === 2 ? 5 : 0);
    return { w, pitch: w + 2, x, y, palette: colors[level - 1]!, count: level === 1 ? 3 : 4 };
  };
  function packet(stepIndex: number): V6PublicObservation {
    const { w, pitch, x, y, palette, count } = geometry();
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
    const tile = (tx: number, ty: number, color: number) => {
      for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) rows[ty + dy]![tx + dx] = color;
    };
    for (let i = 0; i < palette.length; i++) tile(x + i * pitch, y, palette[i]!);
    for (let i = 0; i < count; i++) {
      tile(x + i * pitch, y - 10, entered[i] ?? empty);
      tile(x + i * pitch, y - 20, reference);
      if (level === 2 && transfer === 'ambiguous') tile(x + i * pitch, y + 10, reference);
    }
    // A distinctive tile teaches entry on L1. The transferred interface has no
    // cue: only the witnessed row and submission can give it early priority.
    if (level === 1) for (let dx = 0; dx < w; dx++) rows[y - 1]![x + dx] = variant ? 6 : 12;
    const availableActionIds = level === 1 ? [Number(submit.slice(6)), 6]
      : transfer === 'missing_submission' ? [submit === 'ACTION2' ? 5 : 2, 6] : [1, 2, 3, 4, 5, 6];
    return { frame: rows, frames: [rows], state: completed === 2 ? 'WIN' : 'NOT_FINISHED',
      level, levelsCompleted: completed, availableActionIds, stepIndex };
  }
  function act(ticket: V6Ticket, contradict = false) {
    const { w, pitch, x, y, palette, count } = geometry();
    if (ticket.actionRef === 'ACTION6' && !contradict) {
      const selected = palette.findIndex((_, i) => Number(ticket.data.x) >= x + i * pitch && Number(ticket.data.x) < x + i * pitch + w
        && Number(ticket.data.y) >= y && Number(ticket.data.y) < y + w);
      assert.ok(selected >= 0, 'The actual ticket addresses a current palette tile');
      if (entered.length < count) entered.push(palette[selected]!);
    } else if (ticket.actionRef === submit && entered.length === count) {
      completed++;
      if (completed < 2) { level++; entered = []; }
    }
  }
  return { packet, act, submit, get level() { return level; }, get completed() { return completed; } };
}

async function start(variant: boolean, transfer: Transfer = 'compatible') {
  const room = entryRoom(variant, transfer), family = createSicVerifyOrderedFeedback();
  const calls: { group: string; completed: number; proposed: boolean }[] = [];
  const proposeInGroup = family.proposeInGroup!.bind(family);
  family.proposeInGroup = async (group, observation, ...rest) => {
    const result = await proposeInGroup(group, observation, ...rest);
    calls.push({ group, completed: observation.levels_completed, proposed: result !== null });
    return result;
  };
  const fallback: NativeFamily = {
    id: preparedEffectsId,
    proposeInSubquestion(_group, _entry, ...args) { return this.propose(...args); },
    propose(observation) {
      if (!observation.levels_completed) return null;
      const action = { action_ref: observation.available_action_refs.find(ref => /^ACTION[1-5]$/.test(ref))!, data: {} };
      return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action }],
        binding: { observation_ref: observation.observation_ref } };
    },
    before: (proposal, index, _packet, observation) => ({ admitted: index === 0 && proposal.binding?.observation_ref === observation.observation_ref,
      reason: 'unrelated_experiment_bound' }),
    after: () => ({ matched: null, seal_prefix: true, reason: 'unrelated_experiment_return' }),
    record: () => ({ events: [] }), state: () => ({}), restore() {},
  };
  // Retain the production order and subquestion entries for these two owners.
  // In particular, a witnessed preview is offered inside the first group,
  // before the later general reuse group is reached.
  const groups = planningGroupsWithExperiments(standalonePlanningGroups).map(group => {
    const entries = group.families.flatMap((id, index) => [family.id, fallback.id].includes(id)
      ? [{ id, entry: group.entryPoints?.[index] ?? null }] : []);
    return { ...group, families: entries.map(entry => entry.id), entryPoints: entries.map(entry => entry.entry) };
  }).filter(group => group.families.length);
  const runtime = new NativeV6Runtime({ families: [family, fallback], sourceDigest: 'ordered-feedback-transfer', maxPointOccurrences: 100, groups });
  const service = new V6AgentService(() => runtime), sessionId = 'feedback-transfer-' + variant + '-' + transfer;
  let sequence = 0, result = await service.handle({ type: 'init', sessionId, sequence,
    observation: room.packet(0), budgets: { targetLevels: 2, levelActionCaps: [24, 24] } });
  const tickets: V6Ticket[] = [], outcomes: V6AgentResult[] = [];
  async function next(contradict = false) {
    assert.ok(result.ticket, JSON.stringify({ kind: result.kind, reason: result.reason }));
    const ticket = result.ticket;
    tickets.push(ticket); room.act(ticket, contradict);
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id,
      executionMs: 1, observation: room.packet(sequence) });
    outcomes.push(result);
    if (result.kind === 'boundary' && room.completed < 2) result = await service.handle({ type: 'resume', sessionId, sequence });
    return result;
  }
  while (room.level === 1) { assert.ok(tickets.length < 12); await next(); }
  return { family, runtime, room, tickets, outcomes, calls, next, get result() { return result; } };
}

for (const variant of [false, true]) test('native ordered entry reuses its first compatible interface' + (variant ? ' with different size, colors, positions and submission' : ''), async () => {
  const run = await start(variant), proof = structuredClone(run.family.state().retained);
  try {
    assert.equal(proof.submit, run.room.submit);
    assert.equal(proof.completed, 1);
    assert.ok(proof.proof.length >= 4, 'The method was acquired from actual L1 entries and official submission');
    assert.ok(run.calls.filter(call => call.completed === 0 && [observedMechanicsGroup, observedPressureRecoveryGroup].includes(call.group)).every(call => !call.proposed),
      'No unlearned entry gets priority in the reuse group');
    assert.equal(run.result.snapshot.proposal?.kind, verifyOrderedFeedbackId);
    assert.equal(run.calls.at(-1)?.group, observedPressureRecoveryGroup);
    assert.equal(run.calls.at(-1)?.proposed, true);
    assert.equal(run.result.ticket?.actionRef, 'ACTION6');
    assert.equal(run.result.ticket?.level, 2);
    assert.equal(run.result.snapshot.proposal?.local.active.y, run.result.snapshot.proposal?.local.layout.palette_y - 10);
    assert.equal(run.result.snapshot.proposal?.local.submission, run.room.submit);
    assert.ok(run.result.snapshot.proposal?.route_refs.some((ref: string) => proof.proof.includes(ref)));
    assert.ok(run.result.ticket?.graphChain && run.result.ticket.nativeExecutionDigest,
      'The reuse is authorized by a real native ticket and graph');
    await run.next();
    const current = (run.runtime as any).observation;
    assert.equal(initialFeedbackLayout(current), null, 'The first partial entry can no longer be recognized as an empty interface');
    assert.equal(run.calls.at(-1)?.group, observedPressureRecoveryGroup,
      'The current witnessed layout keeps ownership after its first entry');
    while (run.room.completed < 2) { assert.ok(run.tickets.length < 16); await run.next(); }
    const transferred = run.tickets.filter(ticket => ticket.level === 2);
    assert.equal(transferred.length, 5);
    assert.ok(transferred.slice(0, -1).every(ticket => ticket.actionRef === 'ACTION6'));
    assert.equal(transferred.at(-1)!.actionRef, run.room.submit,
      'The learned submit is chosen among several available plain controls');
    assert.equal(run.result.snapshot.levelsCompleted, 2);
    assert.ok(run.outcomes.every(outcome => outcome.kind !== 'action'), 'Every entry still awaits and acquires its own return');
  } finally { run.runtime.close('test_complete'); }
});

for (const transfer of ['ambiguous', 'changed_shape', 'missing_submission'] as const) test('native reuse declines ' + transfer + ' without erasing its previous proof', async () => {
  const run = await start(false, transfer);
  try {
    assert.equal(run.result.snapshot.proposal?.kind, preparedEffectsId);
    assert.equal(run.calls.find(call => call.completed === 1 && call.group === observedPressureRecoveryGroup)?.proposed, false);
    assert.equal(run.family.state().retained.submit, run.room.submit);
    assert.ok(run.family.state().retained.proof.length >= 4);
  } finally { run.runtime.close('test_complete'); }
});

test('a contradictory first transferred entry closes the ticket and blocks only that failed operation', async () => {
  const run = await start(true), proof = structuredClone(run.family.state().retained), first = run.result.ticket!;
  try {
    await run.next(true);
    const returned = run.outcomes.at(-1)!;
    assert.equal(returned.kind, 'boundary');
    assert.ok(returned.snapshot.trace.some((event: any) => event.kind === 'actual_outcome' && event.matched === false));
    assert.ok(run.family.state().state.blocked.some((key: string) => key.includes(first.actionRef)));
    assert.deepEqual(run.family.state().retained, proof, 'Independent earlier successful entry/submission remains documented');
    assert.equal(run.result.snapshot.proposal?.kind, preparedEffectsId, 'No blind retry is released from the contradicted state');
  } finally { run.runtime.close('test_complete'); }
});

test('production admits the ordered-entry owner through reuse before its ordinary interpretation group', () => {
  const groups = standalonePlanningGroups.filter(group => (group.families as readonly string[]).includes(verifyOrderedFeedbackId));
  assert.deepEqual(groups.map(group => group.id), [observedPressureRecoveryGroup, observedMechanicsGroup, 'interpret_examples_and_collections']);
  const pressure = planningGroupsWithExperiments(standalonePlanningGroups).find(group => group.id === observedPressureRecoveryGroup)!;
  assert.ok(pressure.families.indexOf(verifyOrderedFeedbackId) < pressure.families.indexOf(preparedEffectsId));
});
