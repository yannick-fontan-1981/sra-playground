import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_MIND_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { FeedbackSequences }: typeof import('../src/logos-engine/v6-feedback-sequences.ts') = await import(moduleURL('src/logos-engine/v6-feedback-sequences.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const gz = (path: string) => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString());
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const archive = gz('../docs/migration/lot4a-evidence/integrated-051/mind-live-01/mind-public-trace.json.gz').packets;
const alternative = gz('./fixtures/sic-mind-alternate-returns.json.gz');
const sessionId = 'sra-v6-' + alternative.session;
const owner = 'feedback_sequences';
const opening = { x: 4, y: 54 }, exploratory = [8, 14, 9], discriminated = [8, 9, 14];

function packet(n: number): V6PublicObservation {
  const p = archive[n].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, level: p.level, levelsCompleted: p.levels_completed,
    state: p.state, stepIndex: p.step_index, availableActionIds: p.available_action_refs.map((key: string) => Number(key.slice(6))) };
}
async function start(limit: number, live = false) {
  const backend = live && process.env.SIC_MIND_GAME_ROOT ? await sourceBackend(process.env.SIC_MIND_GAME_ROOT) : null;
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  function observe(request: object, expected: V6PublicObservation, n: number) {
    if (!backend) return expected;
    const { palette, ...actual } = toV6PublicObservation(backend.dispatch(request), n);
    assert.deepEqual(actual, expected, 'official MIND return ' + n);
    return { ...actual, palette };
  }
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'MIND', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: limit } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      const p = reply.snapshot.proposal as Row, guard = (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')!;
      assert.deepEqual([reply.snapshot.lastDecision, p.kind, guard.admitted, guard.reason], [owner, 'public_feedback_sequence', true, 'ordered_prefix_and_loci_bound']);
      return { p, plan: p.feedback_plan, step: p.steps[guard.index], command: reply.command! };
    },
    async advance(expected = packet(sequence + 1)) {
      const { actionRef, data } = reply.command!;
      const observation = observe({ type: 'action', actionId: Number(actionRef.slice(6)), ...(data?.x === undefined ? {} : { data }) }, expected, ++sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
test('12 learns the entry protocol, consumes the ordered feedback in two levels and rebinds the method across epochs', async t => {
  const record = t.mock.method(FeedbackSequences.prototype, 'record'), game = await start(19, true);
  const refs = new Map<number, string>();
  for (let n = 1; n <= 17; n++) {
    const d = await game.decision();
    assert.deepEqual([d.command.actionRef, d.command.data], [archive[n].command.action_ref, archive[n].command.data ?? {}]);
    if (n === 1) {
      assert.deepEqual([d.command.data, d.step.kind, d.step.value, d.step.expected_after, d.plan.repeatable,
        d.plan.active, d.plan.selection.trial, d.plan.selection.role_status], [opening, 'ADD', 8, null, null, null, [8], 'unconfirmed']);
    }
    if (n === 2) {
      assert.deepEqual([d.command.data, d.step.value, d.step.prefix_before, d.plan.repeatable, d.plan.selection.trial],
        [opening, 14, [8], false, exploratory]);
      assert.ok(d.plan.evidence.includes(refs.get(1)));
    }
    if (n === 4 || n === 12) assert.equal(d.step.kind, 'CONTROL_WHEN_FULL');
    if (n === 5 || n === 13) {
      const s = d.plan.selection;
      assert.deepEqual([s.trial, s.candidate_count, s.law_alternatives, d.p.actions[1].data],
        n === 5 ? [discriminated, 2, 4, { x: 10, y: 54 }] : [[14, 6, 8], 4, 12, { x: 16, y: 54 }]);
      assert.ok(d.plan.evidence.includes(refs.get(n - 1)));
    }
    if (n === 9 || n === 17) {
      const s = d.plan.selection, recalled = s.recalled_entry;
      assert.deepEqual([d.step.value, s.current_role_revalidation_pending, recalled.source_epoch],
        [8, true, n === 9 ? 1 : 2]);
      assert.ok(recalled.append_evidence.length >= 2);
      assert.equal(recalled.submit_evidence, refs.get(n === 9 ? 4 : 12));
    }
    const out = await game.advance();
    refs.set(n, out.observation_ref);
    assert.equal(out.family, owner);
    if ([1, 4, 8, 9, 12, 16].includes(n)) {
      const ret = await record.mock.calls.at(-1)!.result!;
      if (n === 1 || n === 9) {
        const e = ret.event as Row;
        assert.deepEqual([ret.status, e.value, e.repeatable, e.ref], ['observed_append', 8, false, out.observation_ref]);
        if (n === 9) assert.equal(e.method_revalidation, 'active_rank_row_confirmed');
      }
      if (n === 4 || n === 12) {
        const e = ret.event as Row;
        assert.deepEqual([ret.status, e.values, e.marks.length, e.before, e.ref],
          ['observed_submission_feedback', n === 4 ? exploratory : [8, 14, 6], 3, refs.get(n - 1), out.observation_ref]);
      }
      if (n === 8 || n === 16) assert.deepEqual([ret.status, out.reason, packet(n).levelsCompleted],
        ['official_boundary', 'official_boundary', n === 8 ? 1 : 2]);
    }
  }
});

test('12 history omitted only from the live offer preserves its first click but repeats the old sequence and yields ambiguous feedback', async t => {
  const native = FeedbackSequences.prototype.propose;
  const seen: Row[] = [];
  t.mock.method(FeedbackSequences.prototype, 'propose', async function (this: FeedbackSequences, ...args: Parameters<typeof native>) {
    if (args[0].revision !== 5) return native.apply(this, args);
    const state = this.state();
    if (!state.history.length) return native.apply(this, args);
    const model = new FeedbackSequences();
    model.restore({ ...state, history: [] });
    seen.push(...state.history);
    return native.apply(model, args);
  });
  const record = t.mock.method(FeedbackSequences.prototype, 'record'), game = await start(14, true);
  let feedbackRef: string;
  for (let n = 1; n <= 4; n++) {
    const d = await game.decision();
    assert.deepEqual([d.command.actionRef, d.command.data], [archive[n].command.action_ref, archive[n].command.data ?? {}]);
    feedbackRef = (await game.advance()).observation_ref;
  }
  for (let n = 5; n <= 13; n++) {
    const d = await game.decision(), i = n - 5, cmd = alternative.commands[i];
    assert.deepEqual([d.command.actionRef, d.command.data], ['ACTION' + cmd.id, cmd.data ?? {}]);
    if (n === 5) assert.deepEqual([d.command.data, d.plan.selection.trial, d.plan.selection.candidate_count, d.plan.selection.law_alternatives],
      [opening, exploratory, 9, 1]);
    if (n === 6) assert.deepEqual([d.command.data, d.step.value], [opening, 14]);
    if (n === 9) {
      assert.deepEqual([d.plan.selection.trial, d.plan.selection.candidate_count, d.plan.selection.law_alternatives], [discriminated, 2, 4]);
      assert.ok(d.plan.evidence.includes(feedbackRef!));
    }
    if (n === 13) assert.equal(d.plan.selection.recalled_entry.source_epoch, 1);
    const out = await game.advance(alternative.observations[i]);
    if (n === 8) {
      const ret = await record.mock.calls.at(-1)!.result!;
      assert.deepEqual([ret.status, ret.matches, ret.evidence], ['feedback_ambiguous', 2, out.observation_ref]);
    }
    if (n === 12) assert.deepEqual([out.reason, alternative.observations[i].levelsCompleted], ['official_boundary', 1]);
  }
  assert.ok(seen.length > 0);
  assert.ok(seen.every(row => row.ref === feedbackRef!));
});
