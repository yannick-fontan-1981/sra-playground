import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GoalAccessAdapter } from '../src/logos-engine/v6-goal-access.ts';
import { AttentionMemory } from '../src/logos-engine/v6-attention-memory.ts';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { pointGoal, electInformationGoals, reconcileInformationGoal } from '../src/logos-engine/v6-information-goals.ts';

test('opening curiosity ranks richer compositions first within the admitted safety tier', () => {
  const observation = { observation_ref: 'start', level_epoch: 1 };
  const base = { ...observation, evidence: ['witness'], risks: [], return_steps: 0, source: 'motion_contrast' };
  const simple = { ...base, action: { action_ref: 'ACTION1' }, predictions: { a: 1, b: 2 }, relations: [['a', 'observes', 'b']] };
  const rich = { ...base, action: { action_ref: 'ACTION2' }, predictions: { a: 1, b: 1, c: 2 },
    relations: [['c', 'observes', 'b'], ['d', 'touches', 'c']] };
  const unavailable = { ...rich, action: { action_ref: 'ACTION3' }, return_steps: 20, relations: [...rich.relations, ['e', 'touches', 'd']] };
  const policy = { excluded_risks: [], continue_observed_parent: true, order: ['worst_case_separation', 'stable_binding'] };
  assert.deepEqual(electInformationGoals([simple, rich, unavailable], observation, 5, null, policy).next().value?.[0], simple);
  const [offer, receipt] = electInformationGoals([simple, rich, unavailable], observation, 5, null, policy, true).next().value!;
  assert.deepEqual(offer, rich);
  assert.equal(receipt.opening_complexity, 2);
  assert.deepEqual(electInformationGoals([{ ...simple, engaged_parent: true }, rich], observation, 5, null, policy, true).next().value?.[0].action, simple.action);
});

const reference = JSON.parse(await readFile(new URL('./fixtures/v6-goal-attention-reference.json', import.meta.url), 'utf8'));
const composition = JSON.parse(await readFile(new URL('./fixtures/v6-composition-reference.json', import.meta.url), 'utf8'));
for (const sample of reference.goals) test(`V6 goal access adapter original parity: ${sample.id}`, async () => {
  const adapter = new GoalAccessAdapter(), args = sample.args, scene = composition.scenes[args.scene];
  adapter.memory.models = structuredClone(args.models);
  const run = () => adapter.propose(scene.observation, scene.rows, args.actions, args.max_prefix);
  if (sample.error) await assert.rejects(run, (e: any) => e.message === sample.error);
  else assert.deepEqual(await run(), sample.expected);
  const restored = new GoalAccessAdapter(); restored.restore(adapter.state());
  assert.deepEqual(restored.state(), adapter.state());
  if (!sample.error) assert.deepEqual(await restored.propose(scene.observation, scene.rows, args.actions, args.max_prefix), sample.expected);
});

test('V6 goal access guards and actual transition acquisition survive authoritative state restoration', async () => {
  let adapter = new GoalAccessAdapter();
  const initial = reference.goals.find((sample: any) => sample.id === 'bound_memory_proposal:16');
  adapter.memory.models = structuredClone(initial.args.models);
  for (const row of reference.goal_steps) {
    assert.deepEqual(adapter.before(row.proposal, row.index, row.before_rows, row.before_options), row.expected_before);
    assert.deepEqual(adapter.after(row.proposal, row.index, row.before_rows, row.after_rows, row.after_options), row.expected_after);
    const events = await adapter.record(row.before, row.before_rows, row.command, row.after, row.after_rows, { proposal: row.proposal, index: row.index });
    assert.deepEqual(events, row.events);
    assert.deepEqual(structuredClone(adapter.memory.retainedState()), row.retained);
    const state = adapter.state(); adapter = new GoalAccessAdapter(); adapter.restore(state); assert.deepEqual(adapter.state(), state);
  }
});

const methods: Record<string, keyof AttentionMemory> = { open: 'open', matches: 'matches', revalidate: 'revalidate', close_pending: 'closePending',
  observe: 'observe', take_parent_return: 'takeParentReturn', retain_composition: 'retainComposition', composition_for: 'compositionFor', return_composition: 'returnComposition' };
for (const scenario of reference.attention) test(`V6 attention scoped return original parity: ${scenario.id}`, async () => {
  const memory = new NativeReasoningMemory(); let agent = new AttentionMemory(memory, 'episode');
  for (const [index, row] of scenario.steps.entries()) {
    const args = structuredClone(row.args); if (row.focus) args[args.length - 1] = agent.item!.id;
    const actual = await (agent[methods[row.method]!] as any).apply(agent, args);
    assert.deepEqual(actual ?? null, row.expected, `step ${index}: ${row.method}`);
    assert.deepEqual(agent.state(), row.state);
    for (const [key, expected] of Object.entries(row.facts)) assert.deepEqual(memory.get('episode', key), expected);
    const reloaded = new AttentionMemory(memory, 'episode'); assert.deepEqual(reloaded.state(), agent.state()); agent = reloaded;
  }
});

for (const sample of reference.information) test(`V6 information goal ordering original parity: ${sample.id}`, () => {
  const a = sample.args;
  const run = () => sample.kind === 'elect' ? [...electInformationGoals(a[0], a[1], a[2], a[3], a[4])] : sample.kind === 'point_goal' ? pointGoal(a[0]) : reconcileInformationGoal(a[0], a[1], a[2], a[3], a[4]);
  if (sample.error) assert.throws(run, (e: any) => e.message === sample.error);
  else assert.deepEqual(run(), sample.expected);
});

test('V6 goal, attention and curiosity remain bound to the pinned source', async () => {
  for (const [path, expected] of Object.entries(reference.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${reference.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
  }
});
