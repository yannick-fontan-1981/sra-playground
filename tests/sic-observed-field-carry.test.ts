import assert from 'node:assert/strict';
import test from 'node:test';
import { compileLevel, initialState, renderWorld, stepDetailed } from '../experiments/sinking-star-ss05/src/core.ts';
import { SS05_LEVELS } from '../experiments/sinking-star-ss05/src/levels.ts';
import { admitFieldCarry, checkFieldCarryReturn, observeFieldCarry, planFieldCarry,
  type FieldCarryMemory, type FieldCarryPlan } from '../src/sic/observed-field-carry.ts';

for (const mirrored of [false, true]) test(`carry learns once and reaches the first accessible body with the learned controls${mirrored ? ' in a mirrored field' : ''}`, () => {
  const transform = (rows: number[][]) => rows.map(row => (mirrored ? [...row].reverse() : row)
    .map(ink => (ink + (mirrored ? 9 : 4)) % 16));
  const commands = new Map([1, 2, 3, 4, 5].map(id => [`ACTION${id + (mirrored ? 10 : 20)}`, id]));
  const inputs = [...commands].map(([action_ref]) => ({ action_ref, data: {} }));
  let memory: FieldCarryMemory | undefined;
  for (let level = 0; level < 2; level++) {
    const world = compileLevel(SS05_LEVELS[level]!);
    let current = initialState(world), marks: FieldCarryPlan['marks'] | undefined;
    let actions = 0, firstCarry = 0, continuousCarry = false, firstBody: number | undefined;
    if (memory) delete memory.supportAt;
    while (!current.complete && actions < 85) {
      const plan = planFieldCarry(memory, transform(renderWorld(world, current)), inputs, `entry:${level}:${actions}`, 100 - actions, marks);
      assert.ok(plan, `No plan at level ${level + 1}, command ${actions}`);
      assert.ok(plan.steps.length <= 16);
      if (level) {
        assert.equal(plan.observe, false);
        assert.ok(plan.evidence.includes('return:0:1'));
      }
      marks = plan.marks;
      for (const [index, step] of plan.steps.entries()) {
        const before = transform(renderWorld(world, current));
        assert.ok(admitFieldCarry(plan, index, before));
        const detail = stepDetailed(world, current, commands.get(step.action.action_ref)!);
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
        const after = transform(renderWorld(world, current));
        if (!plan.observe) {
          assert.ok(checkFieldCarryReturn(plan, index, before, after));
          if (moved) assert.equal(checkFieldCarryReturn(plan, index, before, before), false);
        }
        memory = observeFieldCarry(memory, before, after, step.action, `return:${level}:${actions}`,
          inputs.map(input => input.action_ref), marks);
      }
    }
    assert.ok(current.complete);
    assert.ok(continuousCarry);
    if (level) {
      assert.equal(firstCarry, 5);
      assert.equal(firstBody, 0);
    } else assert.equal(firstCarry, 1);
  }
});

test('carry abstains when two observed fields give equally strong controller matches', () => {
  const world = compileLevel(SS05_LEVELS[0]!);
  const frame = renderWorld(world, initialState(world));
  const inputs = [1, 2, 3, 4, 5].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  assert.ok(planFieldCarry(undefined, frame, inputs, 'unique', 16));
  const ambiguous = frame.map(row => [...row, ...row]);
  assert.equal(planFieldCarry(undefined, ambiguous, inputs, 'ambiguous', 16), undefined);
});
