import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_SC25_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { MotifAccess }: typeof import('../src/logos-engine/v6-motif-access.ts') = await import(moduleURL('src/logos-engine/v6-motif-access.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_SC25_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const card = [1, 3, 5, 7];
const commands: (number | [number, number])[] = [[30, 55], 1, 2, 3, 1, 2, 4, [30, 50], [30, 55], [25, 50],
  [25, 50], [25, 55], [30, 55], [35, 55], [30, 60], [30, 55]];

async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch({ type: 'load', code: 'SC25', level: 1 }), sequence);
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    get observation() { return observation; },
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      return { command: reply.command!, proposal: reply.snapshot.proposal as Row, family: reply.snapshot.lastDecision,
        guard: (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')! };
    },
    async advance() {
      const { actionRef, data } = reply.command!;
      const actionId = Number(actionRef.slice(6));
      observation = toV6PublicObservation(backend.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) }), ++sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

const isMotif = (n: number) => n >= 2 && n <= 8 || n >= 11 && n <= 15;
test('21 qualifies observed motif preparation without attributing access or other owners to the first calibration', async t => {
  const record = t.mock.method(MotifAccess.prototype, 'record');
  const game = await start(), refs = new Map<number, string>();
  for (const [index, action] of commands.entries()) {
    const n = index + 1, d = await game.decision(), p = d.proposal.motif_plan;
    const command = typeof action === 'number' ? ['ACTION' + action, {}] : ['ACTION6', { x: action[0], y: action[1] }];
    assert.deepEqual([d.command.actionRef, d.command.data], command);
    if (isMotif(n)) {
      assert.deepEqual([d.family, d.proposal.material_access_subquestion, d.proposal.kind, d.guard.reason, d.guard.admitted],
        ['motif_access', 'motif_conditioned_access', 'motif_to_geometric_access', 'revalidate_actor_input_pattern_and_epoch', true]);
    } else {
      assert.deepEqual([d.family, d.proposal.kind], ['public_occurrence_recall', 'cell_patch_placement']);
    }
    const step = d.proposal.steps[d.guard.index];
    if (n === 2) assert.deepEqual([p.cards, p.ui_lattice_size, p.actor, p.homologous_goal, p.measured_translations, step.mode, step.expected_after],
      [[card], 3, [39, 19, 42, 22], [13, 18, 16, 21], {}, 'calibrate', null]);
    if (n === 8) {
      assert.deepEqual([p.selected, p.measured_translations, step.mode], [card, { ACTION3: [-4, 0], ACTION4: [4, 0] }, 'toggle']);
      assert.ok(d.proposal.route_refs.includes(refs.get(4)) && d.proposal.route_refs.includes(refs.get(7)));
    }
    if (n === 13) assert.equal(step.mode, 'toggle');
    if (n === 15) assert.deepEqual([step.mode, step.card, step.expected_after], ['invoke', card, null]);

    const out = await game.advance();
    refs.set(n, out.observation_ref);
    const event = record.mock.calls.map(c => c.result as Row).findLast(r => r?.ref === out.observation_ref);
    if (n === 2) assert.deepEqual([event?.status, event?.mode, event?.before, event?.after, out.matched],
      ['public_response', 'calibrate', [[39, 19], 4], [[39, 19], 4], null]);
    if (n === 4 || n === 7) {
      assert.deepEqual([event?.before, event?.after], n === 4 ? [[[39, 19], 4], [[35, 19], 4]] : [[[35, 19], 4], [[39, 19], 4]]);
    }
    if (n === 8 || n === 13) assert.equal(out.matched, true);
    if (n === 15) {
      assert.deepEqual([out.matched, event?.mode, event?.grid_cleared, event?.remote_color_contact_hypothesis,
        game.observation.frames.length, game.observation.levelsCompleted], [null, 'invoke', true, undefined, 17, 0]);
    }
  }
});

for (const target of [2, 8]) {
  test('21 releases another real ticket when the motif proof is withdrawn at T' + target, async t => {
    const original = MotifAccess.prototype.propose;
    let withdrawn = false;
    t.mock.method(MotifAccess.prototype, 'propose', async function (this: InstanceType<typeof MotifAccess>,
      ...args: Parameters<typeof original>) {
      const [observation, rows, inputs] = args;
      if (observation.level_epoch !== 1 || observation.revision !== target) return await original.apply(this, args);
      if (this.epoch !== observation.level_epoch) this.start(observation, rows, inputs);
      const grid = this.grid;
      assert.deepEqual(grid?.cards.map(c => c.mask), [card]);
      this.grid = target === 2 ? null : { ...grid!, cards: [] };
      withdrawn = true;
      try {
        return await original.apply(this, args);
      } finally {
        this.grid = grid;
      }
    });
    const game = await start();
    for (let n = 1; n < target; n++) { await game.decision(); await game.advance(); }
    const d = await game.decision();
    assert.ok(withdrawn);
    assert.deepEqual([d.family, d.proposal.kind, d.command.actionRef, d.command.data],
      ['observed_frontier', 'experiment', target === 2 ? 'ACTION1' : 'ACTION6', target === 2 ? {} : { x: 12, y: 19 }]);
    const out = await game.advance();
    assert.equal(out.family, d.family);
    assert.equal(game.observation.levelsCompleted, 0);
  });
}
