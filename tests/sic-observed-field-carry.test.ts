import assert from 'node:assert/strict';
import test from 'node:test';
import { compileLevel, initialState, renderWorld, stepDetailed, type State, type World } from '../experiments/sinking-star-ss05/src/core.ts';
import { SS05_LEVELS } from '../experiments/sinking-star-ss05/src/levels.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { sicObservedWeightShortage } from '../src/logos-engine/v6-native-types.ts';
import { findCompositionFrontier } from '../src/sic/composition-frontier.ts';
import { objectRelations } from '../src/sic/object-composition.ts';
import { createSicPublicInputExploration, observedPressureRecoveryGroup } from '../src/sic/public-input-exploration.ts';
import { lostResourceCoverage } from '../src/sic/resource-reserve.ts';
import { admitFieldCarry, checkFieldCarryReturn, observeFieldCarry, planFieldCarry,
  type FieldCarryMemory, type FieldCarryPlan } from '../src/sic/observed-field-carry.ts';

for (const mirrored of [false, true]) test(`carry and object composition transfer across five levels${mirrored ? ' with different object shapes and mirrored geometry' : ''}`, async () => {
  const transform = (world: World, state: State) => {
    const rows = renderWorld(world, state);
    if (mirrored) for (const [index, point] of state.monsters.entries()) {
      const x = 2 + 3 * point.x, y = 2 + 3 * point.y;
      rows[y]![x + 1] = index === 0 ? 8 : 10;
      rows[y + 1]![x] = index === 0 ? 5 : 10;
    }
    return rows.map(row => (mirrored ? [...row].reverse() : row).map(ink => (ink + (mirrored ? 9 : 4)) % 16));
  };
  const commands = new Map([1, 2, 3, 4, 5].map(id => [`ACTION${id + (mirrored ? 10 : 20)}`, id]));
  const inputs = [...commands].map(([action_ref]) => ({ action_ref, data: {} }));
  let memory: FieldCarryMemory | undefined;
  for (let level = 0; level < 5; level++) {
    const world = compileLevel(SS05_LEVELS[level]!);
    let current = initialState(world), marks: FieldCarryPlan['marks'] | undefined;
    let actions = 0, firstCarry = 0, continuousCarry = false, firstBody: number | undefined, compositions = 0;
    if (memory) {
      delete memory.supportAt;
      delete memory.seenFloor;
    }
    if (level === 4) {
      const testedCommands = inputs.map(input => input.action_ref);
      const hazardous = inputs.find(input => commands.get(input.action_ref) === 1)!;
      const packet = (frame_rows: number[][], revision: number, hash: string) => measureNativeObservation({
        frame_rows, frame_hash: hash, level: level + 1, levels_completed: level, state: 'NOT_FINISHED',
        available_action_refs: testedCommands,
      }, revision);
      for (const hasAccessRequirement of [true, false]) {
        const layout = hasAccessRequirement ? world : { ...world, doors: [] };
        const before = transform(layout, current);
        const sunk = stepDetailed(layout, current, 1).state;
        assert.equal(sunk.stones.length, 0);
        assert.equal(sunk.supports.length, 1);
        const after = transform(layout, sunk);
        const start = await packet(before, 1, 'entry'), lost = await packet(after, 2, 'lost');
        const family = createSicPublicInputExploration();
        family.restore({ ...family.state!(), epoch: start.level_epoch, fieldCarry: memory! });
        await family.observePublicOutcome!(start, lost, hazardous, before, after);
        assert.equal(family.requestedStopReason!(lost), hasAccessRequirement ? sicObservedWeightShortage : null);
        if (!hasAccessRequirement) continue;
        const restored = await packet(before, 3, 'entry');
        assert.equal(family.stateAfterLevelReset!(lost, after, undefined, sicObservedWeightShortage), undefined);
        const rebound = family.stateAfterLevelReset!(restored, before, undefined, sicObservedWeightShortage);
        assert.ok(rebound);
        family.restore(rebound);
        const next = await family.proposeInGroup!(observedPressureRecoveryGroup, restored, before, inputs, 80);
        assert.ok(next?.fieldCarryPlan?.reflectiveRoute);
        assert.notEqual(next.actions[0]?.action_ref, hazardous.action_ref);
        assert.equal(family.requestedStopReason!(restored), null);
        const lostAgain = await packet(after, 4, 'lost');
        await family.observePublicOutcome!(restored, lostAgain, hazardous, before, after);
        assert.equal(family.requestedStopReason!(lostAgain), 'sic_resource_loss_already_recovered');
      }
    }
    while (!current.complete && actions < 120) {
      const visible = transform(world, current), entry = `entry:${level}:${actions}`;
      const plan = planFieldCarry(memory, visible, inputs, entry, 120 - actions, marks)
        ?? planFieldCarry(memory, visible, inputs, entry, 120 - actions, marks, [], true);
      assert.ok(plan, `No plan at level ${level + 1}, command ${actions}`);
      assert.ok(plan.steps.length <= 16);
      if (level) {
        assert.equal(plan.observe, false);
        assert.ok(plan.evidence.includes('return:0:1'));
      }
      marks = plan.marks;
      for (const [index, step] of plan.steps.entries()) {
        const before = transform(world, current);
        assert.ok(admitFieldCarry(plan, index, before));
        const detail = stepDetailed(world, current, commands.get(step.action.action_ref)!);
        if (detail.state.monsters.length < current.monsters.length) {
          assert.equal(plan.composition?.at, index);
          assert.equal(current.monsters.length - detail.state.monsters.length, 2);
          compositions++;
        }
        if (level === 3 && detail.state.monsters.some(({ x, y }) => world.buttons.some(button => button.x === x && button.y === y))
          && !current.monsters.some(({ x, y }) => world.buttons.some(button => button.x === x && button.y === y))) {
          assert.equal(plan.composition?.at, index);
          compositions++;
        }
        current = detail.state;
        assert.equal(current.dead, false);
        actions++;
        const moved = detail.phases[0]?.moves.find(piece => piece.actor === 'stone');
        if (moved) {
          if (!firstCarry) {
            firstCarry = actions;
            firstBody = world.stones.findIndex(p => p.x === moved.from.x && p.y === moved.from.y);
          }
          continuousCarry ||= index > 0;
        }
        if (current.complete) break;
        const after = transform(world, current);
        if (!plan.observe) {
          assert.ok(checkFieldCarryReturn(plan, index, before, after), `Unexpected return at level ${level + 1}, action ${actions}, ${plan.label}`);
          if (moved) assert.equal(checkFieldCarryReturn(plan, index, before, before), false);
          if (level === 3 && plan.composition?.at === index) {
            assert.ok(plan.evidence.some(ref => ref.startsWith('return:2:')));
            const gates = plan.composition.opens;
            assert.ok(gates?.length);
            for (const gate of gates) {
              const [x, y] = gate.split(',').map(Number) as [number, number];
              for (let offset = 0; offset < 3; offset++) {
                after[y + offset]!.splice(x, 3, ...before[y + offset]!.slice(x, x + 3));
              }
            }
            assert.equal(checkFieldCarryReturn(plan, index, before, after), false);
          }
        }
        memory = observeFieldCarry(memory, before, transform(world, current), step.action, `return:${level}:${actions}`,
          inputs.map(input => input.action_ref), marks);
      }
    }
    assert.ok(current.complete);
    if (level === 2 || level === 3) assert.equal(compositions, 1);
    else assert.ok(continuousCarry);
    if (level === 1) {
      assert.equal(firstCarry, 5);
      assert.equal(firstBody, 0);
    } else if (level === 0) assert.equal(firstCarry, 1);
  }
});

test('recovery requires a real loss of assignable coverage', () => {
  const fits = (need: string, item: string[]) => item.includes(need);
  assert.deepEqual(lostResourceCoverage(['hold', 'cross'], [['hold', 'cross'], ['hold']], [['cross']], fits),
    { required: 2, available: 1 });
  assert.equal(lostResourceCoverage(['hold'], [['hold'], ['hold']], [['hold'], ['cross']], fits), undefined);
  assert.equal(lostResourceCoverage(['hold', 'cross'], [['hold']], [], fits), undefined);
});

test('pair enumeration keeps distinct instances and can compose differently bound objects', () => {
  const bindings = [
    { id: 'one:0', cell: (positions: readonly string[]) => positions[0], movable: true },
    { id: 'one:1', cell: (positions: readonly string[]) => positions[1], movable: true },
    { id: 'another', cell: (positions: readonly string[]) => positions[2], movable: true },
    { id: 'fixture', cell: () => '9', movable: false },
  ];
  const relations = objectRelations(bindings, (left, right) => Math.abs(Number(left) - Number(right)) === 1);
  const before = ['1', '2', '6'], after = ['1', '5', '9'];
  const reached = relations.filter(relation => !relation.cells(before) && relation.cells(after));
  assert.deepEqual(reached.map(relation => relation.cells(after)), [['9', '9']]);
  const mixed = ['1', '5', '6'];
  assert.deepEqual(relations.filter(relation => !relation.cells(before) && relation.cells(mixed)).map(relation => relation.cells(mixed)), [['5', '6']]);
  assert.equal(relations.length, 12);
});

test('composition search considers reachable effects beyond an already visited pose', () => {
  const edges: Record<string, string[]> = { start: ['empty_walk', 'approach'], approach: ['start'], empty_walk: ['start'] };
  const route = (depth: number) => findCompositionFrontier({
    start: 'start', key: pose => pose, depth, limit: 12,
    successors: pose => (edges[pose] ?? []).map(after => ({ action: `${pose}:${after}`, after })),
    isComposition: (before, after) => before === 'approach' && after === 'start',
  });
  assert.equal(route(1), undefined);
  assert.deepEqual(route(2)?.map(step => step.action), ['start:approach', 'approach:start']);
});

test('carry abstains when two observed fields give equally strong controller matches', () => {
  const world = compileLevel(SS05_LEVELS[0]!);
  const frame = renderWorld(world, initialState(world));
  const inputs = [1, 2, 3, 4, 5].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  assert.ok(planFieldCarry(undefined, frame, inputs, 'unique', 16));
  const ambiguous = frame.map(row => [...row, ...row]);
  assert.equal(planFieldCarry(undefined, ambiguous, inputs, 'ambiguous', 16), undefined);
});

test('a fresh controller can reach a new composition and use its observed outcome', () => {
  const world = compileLevel(SS05_LEVELS[2]!);
  const inputs = [1, 2, 3, 4, 5].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  let current = initialState(world), memory: FieldCarryMemory | undefined;
  let moves = 0;
  while (!current.complete && moves < 60) {
    const visible = renderWorld(world, current);
    const propose = (contactOnly: boolean) => planFieldCarry(memory, visible, inputs, `entry:${moves}`, 60 - moves, undefined, [], contactOnly);
    const plan = propose(false) ?? propose(true);
    assert.ok(plan, `No plan at command ${moves}`);
    for (const [index, step] of plan.steps.entries()) {
      const before = renderWorld(world, current);
      assert.ok(admitFieldCarry(plan, index, before));
      const next = stepDetailed(world, current, Number(step.action.action_ref.slice(6))).state;
      assert.equal(next.dead, false);
      moves++;
      if (next.complete) {
        current = next;
        break;
      }
      const after = renderWorld(world, next), ref = `return:${moves}`;
      memory = observeFieldCarry(memory, before, after, step.action, ref, inputs.map(input => input.action_ref), plan.marks);
      if (!plan.observe) assert.ok(checkFieldCarryReturn(plan, index, before, after));
      if (plan.composition?.at === index) {
        assert.equal(next.monsters.length, 0);
        assert.ok(memory);
        memory.contactRef = ref;
      }
      current = next;
    }
  }
  assert.ok(current.complete);
  assert.ok(memory?.contactRef);
});
