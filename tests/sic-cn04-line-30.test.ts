import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { NativeRows } from '../src/logos-engine/v6-native-types.ts';
import type { PortPose } from '../src/logos-engine/v6-port-assembly.ts';

const root = process.env.SIC_CN04_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { PortAssembly, portAgreement, compatiblePorts, portAccessPath, placedPorts, portCells }: typeof import('../src/logos-engine/v6-port-assembly.ts') =
  await import(moduleURL('src/logos-engine/v6-port-assembly.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_CN04_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const historical = [1, 2, 3, 4, 5, 5, 5, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 1];

async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch({ type: 'load', code: 'CN04', level: 1 }), sequence);
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 19 } });
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

test('30 separates calibrated motion, joint compatibility, reachable poses and the visible pair of contacts', async t => {
  const record = t.mock.method(PortAssembly.prototype, 'record');
  const original = PortAssembly.prototype.before;
  let owner: InstanceType<typeof PortAssembly> | undefined, preRotation: NativeRows | undefined, refused: Row | undefined;
  t.mock.method(PortAssembly.prototype, 'before', function (this: InstanceType<typeof PortAssembly>, ...args: Parameters<typeof original>) {
    owner = this;
    const [proposal, index, packet, observation] = args;
    if (preRotation && observation.level_epoch === 1 && observation.revision === 8 && proposal.steps[index].mode === 'move') {
      refused = original.call(this, proposal, index, { ...packet, frame_rows: preRotation }, observation);
    }
    return original.apply(this, args);
  });

  const game = await start();
  let goal: readonly PortPose[] = [];
  for (const [i, action] of historical.entries()) {
    const n = i + 1, d = await game.decision(), p = d.proposal.port_plan, step = d.proposal.steps[d.guard.index];
    const model = owner!.model!;
    assert.deepEqual([d.family, d.proposal.kind, d.command.actionRef, d.guard.admitted, d.guard.reason],
      ['port_assembly', 'rigid_port_assembly', 'ACTION' + action, true, 'compare_joint_material_occupancy_and_epoch']);
    if (n === 1) {
      assert.deepEqual([p.materials, p.known_ports, p.poses, p.joint_goal, step.mode, step.expected_after, model.unit],
        [2, [2, 2], [[0, 3, 3], [0, 12, 9]], null, 'calibrate', null, 3]);
    }
    if (n === 5) {
      preRotation = game.observation.frame;
      goal = p.joint_goal;
      assert.deepEqual([goal, step.mode, step.expected_after], [[[3, 7, 10], [0, 12, 9]], 'rotate', null]);
      assert.equal(compatiblePorts(model, 0, goal[0]!, new Map([[1, goal[1]!]])), true);
      assert.equal(portAccessPath(model, p.poses, 0, goal[0]!, owner!.motion), null);
    }
    if (n === 8) {
      const path = [...Array(7).fill('ACTION2'), ...Array(4).fill('ACTION4')];
      assert.deepEqual(d.proposal.actions.map((a: Row) => a.action_ref), path);
      assert.deepEqual(portAccessPath(model, p.poses, 0, goal[0]!, owner!.motion), path);
      const withoutDown = new Map(owner!.motion);
      assert.equal(withoutDown.delete('ACTION2'), true);
      assert.equal(portAccessPath(model, p.poses, 0, goal[0]!, withoutDown), null);
      assert.deepEqual(refused, { admitted: false, reason: 'compare_joint_material_occupancy_and_epoch' });
    }
    if (n === 19) {
      assert.deepEqual([game.observation.level, p.materials, p.known_ports, p.joint_goal, step.mode, step.expected_after],
        [2, 4, [2, 4, 4, 2], null, 'calibrate', null]);
    }
    const intersection = n === 17 || n === 18 ? placedPorts(model, 0, goal[0]!)[1].intersection(placedPorts(model, 1, goal[1]!)[1]).sorted() : [];
    const valuesAtContact = (rows: NativeRows) => {
      const cells = portCells(rows, model);
      return intersection.map(point => cells.get(point.join(','))?.value);
    };
    const out = await game.advance();
    if (n === 1) {
      const event = record.mock.calls.map(c => c.result as Row).findLast(r => r?.ref === out.observation_ref)!;
      assert.deepEqual([out.matched, event.status, event.poses, owner!.motion.get('ACTION1')],
        [null, 'pose_measured', [[0, 3, 2], [0, 12, 9]], [0, -1]]);
    }
    if (n === 17) assert.deepEqual([out.matched, portAgreement(game.observation.frame, model, goal),
      valuesAtContact(game.observation.frame), game.observation.levelsCompleted], [true, false, [8, 8], 0]);
    if (n === 18) {
      assert.deepEqual(step.expected_after, goal);
      assert.deepEqual(intersection, [[12, 11], [12, 13]]);
      const frames = game.observation.frames!;
      assert.deepEqual(frames.map(frame => [portAgreement(frame, model, goal), valuesAtContact(frame)]),
        [[true, [3, 3]], [true, [3, 3]], [false, [12, 12]]]);
      const boundary = record.mock.calls.map(c => c.result as Row).findLast(r => r?.ref === out.observation_ref)!;
      assert.deepEqual([out.matched, out.reason, boundary.status, game.observation.level, game.observation.levelsCompleted],
        [null, 'official_boundary', 'official_boundary', 2, 1]);
    }
  }
});
