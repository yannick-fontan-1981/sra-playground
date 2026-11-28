import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_TN36_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { CodeProgram, codePosition }: typeof import('../src/logos-engine/v6-code-program.ts') = await import(moduleURL('src/logos-engine/v6-code-program.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const data = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-tn36-public-returns.json.gz', import.meta.url))).toString());
const packet = (turn: number): V6PublicObservation => data.nominal.observations[turn];
const sessionId = 'sra-v6-' + data.session;
const opening = { x: 36, y: 55 }, coldCode = [3, 0, 3, 0, 0], learnedCode = [3, 3, 3, 3, 3];
const sample = (code: number, displacement: number[]) => ({ code, displacement });

async function start(limit: number, live = false) {
  const backend = live && process.env.SIC_TN36_GAME_ROOT ? await sourceBackend(process.env.SIC_TN36_GAME_ROOT) : null;
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  function observe(request: object, expected: V6PublicObservation, n: number) {
    if (!backend) return expected;
    const { palette, ...actual } = toV6PublicObservation(backend.dispatch(request), n);
    assert.deepEqual(actual, expected, 'official TN36 return ' + n);
    return { ...actual, palette };
  }
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'TN36', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: limit } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      const p = reply.snapshot.proposal as Row, guard = (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard');
      assert.deepEqual([reply.kind, reply.snapshot.lastDecision, p.kind, p.program_subquestion, guard?.admitted, guard?.reason, reply.command?.actionRef],
        ['action', 'code_program', 'learned_code_program', 'learned_code_program', true, 'bind_actor_program_bits_and_epoch', 'ACTION6']);
      return { p, plan: p.code_plan, step: p.steps[guard!.index], point: reply.command!.data, refs: p.question.hypothesis_refs };
    },
    async advance(expected: V6PublicObservation = packet(sequence + 1), endpointOnly = false) {
      const command = reply.command!, n = ++sequence;
      const actual = observe({ type: 'action', actionId: 6, data: command.data }, expected, n);
      const observation = endpointOnly ? { ...actual, frames: [actual.frame] } : actual;
      reply = await service.handle({ type: 'advance', sessionId, sequence: n, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
test('the gel learns N1 code 3 from execution, then reaches the cavity and relearns a different code in N2', async t => {
  const record = t.mock.method(CodeProgram.prototype, 'record'), game = await start(19, true);
  let initial: string, n1Proof: string, n2Proof: string;
  for (let n = 1; n <= 19; n++) {
    const d = await game.decision();
    assert.deepEqual(d.point, data.nominal.commands[n - 1].data);
    const mode = [1, 8, 18].includes(n) ? 'execute' : [9, 19].includes(n) ? 'demonstrate' : 'edit';
    assert.equal(d.step.mode, mode);
    if (n === 1) {
      initial = d.p.binding.observation_ref;
      assert.deepEqual([d.point, d.plan.actor_position, d.plan.goal, d.plan.available_examples, d.plan.locally_observed_operators,
        d.plan.observed_executions, d.plan.current_codes, d.plan.desired_codes, d.step.expected_after, d.refs],
      [opening, [4, 1], [4, 6], 0, 0, 0, coldCode, coldCode, null, [initial]]);
    }
    if (n === 2) {
      assert.deepEqual([d.point, d.plan.locally_observed_operators, d.plan.current_codes, d.plan.desired_codes, d.step.expected_after, d.refs],
        [{ x: 26, y: 42 }, 1, coldCode, learnedCode, [3, 2, 3, 0, 0], [n1Proof, initial]]);
    }
    if (n === 8) assert.deepEqual([d.point, d.step.code, d.step.position], [opening, learnedCode, [4, 1]]);
    if (n === 9) {
      assert.deepEqual([d.step.example, d.plan.available_examples, d.plan.locally_observed_operators, d.plan.observed_executions], [0, 2, 0, 0]);
      assert.ok(!d.refs.includes(n1Proof));
    }
    if (n === 10) {
      assert.deepEqual([d.plan.actor_position, d.plan.goal, d.plan.locally_observed_operators, d.plan.desired_codes],
        [[3, 5], [3, 1], 1, [33, 33, 33, 33]]);
      assert.ok(d.refs.includes(n2Proof));
    }
    if (n === 18) assert.deepEqual([d.step.code, d.step.position], [[33, 33, 33, 33], [3, 5]]);
    const out = await game.advance();
    assert.deepEqual([out.family, out.matched], ['code_program', mode === 'edit' ? true : null]);
    if (n === 1 || n === 8 || n === 9 || n === 18) {
      const acquired = record.mock.calls.at(-1)!;
      assert.equal(acquired.result!.ref, out.observation_ref);
      if (n === 1) {
        n1Proof = out.observation_ref;
        assert.equal(acquired.arguments[7]!.length, 7);
        assert.deepEqual(acquired.result!.measured, [sample(3, [0, 1]), sample(3, [0, 1])]);
        assert.deepEqual(codePosition(packet(n).frame, acquired.this.board!), [4, 1]);
      }
      if (n === 9) {
        n2Proof = out.observation_ref;
        assert.equal(acquired.result!.preserved_actual_world, true);
        assert.ok(acquired.result!.measured.length > 0);
        assert.ok(acquired.result!.measured.every((m: Row) => m.code === 33 && m.displacement[0] === 0 && m.displacement[1] === -1));
      }
      if (n === 8 || n === 18) {
        assert.deepEqual([acquired.result!.status, out.reason, packet(n).levelsCompleted],
          ['official_boundary', 'official_boundary', n === 8 ? 1 : 2]);
      }
    }
  }
});
test('the same execution and endpoint without ordered public images changes the next physical edit and the learned labels', async t => {
  const record = t.mock.method(CodeProgram.prototype, 'record'), game = await start(8, true);
  const first = await game.decision();
  assert.deepEqual([first.point, first.step.mode, first.step.code], [opening, 'execute', coldCode]);
  const out = await game.advance(packet(1), true), masked = record.mock.calls.at(-1)!;
  assert.deepEqual([out.matched, masked.result!.ref, masked.result!.measured, masked.this.effects.size, masked.this.executed.size],
    [null, out.observation_ref, [], 0, 1]);
  const edit = await game.decision();
  assert.deepEqual([edit.point, edit.plan.locally_observed_operators, edit.plan.desired_codes, edit.step.mode],
    [data.endpointOnly.commands[0].data, 0, [1, 0, 3, 0, 0], 'edit']);
  assert.deepEqual(edit.refs, [out.observation_ref, first.p.binding.observation_ref]);
  assert.deepEqual(masked.this.evidence, []);
  assert.equal((await game.advance(data.endpointOnly.observations[0])).matched, true);
  const trial = await game.decision();
  assert.deepEqual([trial.point, trial.step.mode, trial.step.code], [opening, 'execute', [1, 0, 3, 0, 0]]);
  await game.advance(data.endpointOnly.observations[1]);
  assert.deepEqual(record.mock.calls.at(-1)!.result!.measured, [sample(1, [1, 0]), sample(3, [0, 1])]);
  const next = await game.decision();
  assert.deepEqual([next.point, next.plan.locally_observed_operators, next.plan.desired_codes],
    [data.endpointOnly.commands[2].data, 2, learnedCode]);
});

test('N2 reuses the demonstration path with a different eligible example and records its missing displacement', async t => {
  const startOriginal = CodeProgram.prototype.start;
  t.mock.method(CodeProgram.prototype, 'start', function (this: CodeProgram, ...args: Parameters<CodeProgram['start']>) {
    startOriginal.apply(this, args);
    if (args[0].level_epoch === 2) this.demoTried.add(0);
  });
  const record = t.mock.method(CodeProgram.prototype, 'record'), game = await start(19, true);
  for (let n = 1; n <= 8; n++) {
    assert.deepEqual((await game.decision()).point, data.nominal.commands[n - 1].data);
    await game.advance();
  }
  const other = await game.decision();
  assert.deepEqual([other.point, other.plan.available_examples, other.step.mode, other.step.example, other.plan.locally_observed_operators],
    [{ x: 8, y: 58 }, 2, 'demonstrate', 1, 0]);
  const out = await game.advance(data.secondExample.observations[0]), e = record.mock.calls.at(-1)!;
  assert.deepEqual([e.result!.ref, e.result!.measured, e.result!.preserved_actual_world, e.this.effects.size],
    [out.observation_ref, [], true, 0]);
  const next = await game.decision();
  assert.deepEqual([next.point, next.step.mode, next.step.code, next.plan.locally_observed_operators],
    [data.secondExample.commands[1].data, 'execute', [0, 0, 0, 0], 0]);
  await game.advance(data.secondExample.observations[1]);
  assert.deepEqual(record.mock.calls.at(-1)!.result!.measured, []);
  const edit = await game.decision();
  assert.deepEqual([edit.point, edit.step.mode, edit.plan.desired_codes], [data.secondExample.commands[2].data, 'edit', [0, 0, 0, 1]]);
});
