import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeCommand, NativeFamily, NativePoint } from '../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { createCursorRoleMemory, cursorRoleMemoryId } from '../src/sic/cursor-role-memory.ts';
import { learnPatternAccessId } from '../src/sic/framed-contact.ts';

function scene(level: number, actions: number[], mask: NativePoint[], ink: number, positions: NativePoint[]): GameObservation {
  const frame = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
  for (const [x, y] of positions) for (const [dx, dy] of mask) frame[y + dy]![x + dx] = ink;
  return { gameCode: 'UNKNOWN', frame, frames: [frame], state: 'NOT_FINISHED', availableActionIds: actions,
    level, levelCount: 3, levelsCompleted: level - 1, canUndo: false, canSelectLevel: true, defaultFps: 10 };
}

// A second registered family supplies the training commands. The cursor memory
// must obtain its evidence as a passive observer of the real advance/seal path.
function witnessSource(actions: NativeCommand[]): NativeFamily {
  let calls = 0;
  return {
    id: learnPatternAccessId,
    async propose(observation, rows) {
      if (observation.levels_completed !== 0 || calls === actions.length) return null;
      const action = actions[calls]!;
      const point_binding = action.action_ref === 'ACTION6' ? await ObservedInputDomain.makeLocusWitness(observation, rows,
        [action.data.x!, action.data.y!], { reason: 'Click the current training sprite', evidence: [observation.observation_ref] }) : undefined;
      return { status: 'proposed', kind: learnPatternAccessId,
        actions: [action], steps: [point_binding ? { point_binding } : {}],
        sicLocalDecision: { strategy: 'observe_public_input' } };
    },
    before: () => ({ admitted: true, reason: 'fixture_ready' }),
    after: () => ({ matched: true, seal_prefix: true, reason: 'fixture_observed' }),
    record: () => { calls++; return { events: [] }; },
    state: () => ({ calls }), restore: state => { calls = state.calls as number; },
  };
}

const add = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];

const scenarios: { name: string; actions: [number, number]; nextActions?: number[]; mask: NativePoint[]; ink: number; floor: string; color: string;
  first: NativePoint; next: NativePoint[]; effects: [NativePoint, NativePoint]; resolution: 'unique' | 'ambiguous' | 'contradicted' | 'point' }[] = [
  { name: 'retains a translated sprite after palette and input reindexing', actions: [3, 1], nextActions: [3, 4],
    mask: [[0, 0], [1, 0], [1, 1]], ink: 7, floor: '#111', color: '#35A', first: [7, 14], next: [[30, 20]],
    effects: [[3, 0], [0, -2]], resolution: 'unique' },
  { name: 'uses one command to resolve identical sprites', actions: [5, 4], mask: [[0, 0], [0, 1]], ink: 9,
    floor: '#242', color: '#FC2', first: [17, 18], next: [[8, 8], [38, 32]], effects: [[0, 2], [-3, 0]], resolution: 'ambiguous' },
  { name: 'rechecks only a contradicted effect', actions: [2, 5], mask: [[0, 0], [1, 0], [2, 0], [1, 1]], ink: 12,
    floor: '#455', color: '#F93', first: [19, 21], next: [[22, 47]], effects: [[-2, 0], [0, 3]], resolution: 'contradicted' },
  { name: 'relocates the learned click onto the current sprite', actions: [6, 5], mask: [[0, 0]], ink: 4,
    floor: '#134', color: '#ABD', first: [31, 21], next: [[9, 26]], effects: [[2, 0], [0, -2]], resolution: 'point' },
];

for (const scenario of scenarios) test(`native cursor memory ${scenario.name}`, async () => {
  const { actions, nextActions, mask, ink, first, next, effects, resolution } = scenario;
  const second = add(first, effects[0]), third = add(second, effects[1]);
  const training = [...actions, actions[0]].map((id, index): NativeCommand => {
    const [x, y] = [first, second, third][index]!;
    return { action_ref: `ACTION${id}`, data: id === 6 ? { x, y } : {} };
  });
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [createCursorRoleMemory(), witnessSource(training)],
    maxPointOccurrences: 100, adaptiveReasoning: true, sourceDigest: 'public-role-transfer', now: () => 0 }));
  let sequence = 0;
  const packet = (level: number, positions: NativePoint[]) => {
    const spriteIndex = level === 1 ? ink : ink - 1;
    const palette = Array<string>(ink + 1).fill('#000');
    palette[0] = scenario.floor;
    palette[spriteIndex] = scenario.color;
    return toV6PublicObservation({ ...scene(level, level > 1 && nextActions ? nextActions : actions, mask, spriteIndex, positions), palette }, sequence);
  };
  const sessionId = 'cursor-role-transfer';
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation: packet(1, [first]),
    budgets: { targetLevels: 2, levelActionCaps: [16, 16] } });
  const advance = async (level: number, positions: NativePoint[]) => {
    assert.equal(reply.kind, 'action');
    assert.ok(reply.ticket);
    sequence++;
    reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket.id,
      observation: packet(level, positions), executionMs: 0 });
  };
  const resume = async () => {
    assert.equal(reply.kind, 'boundary');
    reply = await service.handle({ type: 'resume', sessionId, sequence });
  };
  const lastEvent = (kind: string) => (reply.snapshot.trace as Record<string, unknown>[]).findLast(event => event.kind === kind);
  const verifyPlan = (action: number, strategy: string) => {
    assert.equal(reply.kind, 'action', reply.snapshot.reason ?? undefined);
    assert.equal(reply.command?.actionRef, `ACTION${action}`);
    assert.ok(reply.ticket);
    const plan = lastEvent('sic_native_plan');
    assert.equal(plan?.family, cursorRoleMemoryId);
    assert.equal(plan.authority, 'sicOnly');
    assert.equal(plan.strategy, strategy);
    assert.equal(plan.observationRef, reply.ticket.observationRef);
    const need = plan.need as { evidence: string[] };
    assert.equal(need.evidence[0], reply.ticket.observationRef);
    assert.equal(need.evidence.length, 3);
    assert.ok(need.evidence.slice(1).every(ref => ref.includes(':epoch:1:')), need.evidence.join('\n'));
    return plan;
  };

  assert.equal(reply.command?.actionRef, `ACTION${actions[0]}`);
  await advance(1, [second]);
  await resume();
  assert.equal(reply.command?.actionRef, `ACTION${actions[1]}`);
  await advance(1, [third]);
  await resume();
  await advance(2, next);
  assert.equal(reply.snapshot.levelsCompleted, 1);
  await resume();

  const plan = verifyPlan(actions[0], resolution === 'ambiguous' ? 'identify_active_cursor' : 'reuse_observed_cursor');
  if (resolution === 'ambiguous') {
    assert.equal(plan.planned, 1);
    await advance(2, [next[0]!, add(next[1]!, effects[0])]);
    assert.equal(lastEvent('actual_outcome')?.reason, 'cursor_role_reused');
    assert.equal(reply.snapshot.actions, 4);
  } else if (resolution === 'contradicted') {
    const changed = add(next[0]!, [2, 0]);
    await advance(2, [changed]);
    assert.equal(lastEvent('actual_outcome')?.reason, 'cursor_input_return_contradicted');
    await resume();
    verifyPlan(actions[1], 'reuse_observed_cursor');
    await advance(2, [add(changed, effects[1])]);
    assert.equal(lastEvent('actual_outcome')?.reason, 'cursor_role_reused');
    assert.equal(reply.snapshot.actions, 5);
  } else if (resolution === 'point') {
    const [x, y] = next[0]!;
    assert.deepEqual(reply.command?.data, { x, y });
    assert.equal(plan.planned, 1);
    await advance(2, [add(next[0]!, effects[0])]);
    assert.equal(lastEvent('actual_outcome')?.reason, 'cursor_role_reused');
  } else {
    assert.equal(plan.planned, 2);
    const revision = reply.ticket?.decisionRevision;
    const moved = add(next[0]!, effects[0]);
    await advance(2, [moved]);
    assert.equal(reply.ticket?.decisionRevision, revision);
    assert.equal(reply.ticket?.actionIndex, 1);
    await advance(2, [add(moved, effects[0])]);
    assert.equal(lastEvent('actual_outcome')?.reason, 'cursor_role_reused');
    assert.equal(reply.snapshot.actions, 5);
  }
});

test('the cursor-role family is registered by both production SIC engines', async () => {
  const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
  const declarations = {
    common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
    strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
  } as NativeV6Declarations;
  for (const solver of ['sic', 'sic-fallback'] as const) {
    const runtime = await createNativeV6Runtime(declarations, { recovery: { ...defaultRecoveryPack, solver } });
    assert.ok(runtime.snapshot().coverage.registeredFamilies?.includes(cursorRoleMemoryId), solver);
  }
});
