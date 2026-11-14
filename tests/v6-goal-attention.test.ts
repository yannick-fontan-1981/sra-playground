import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GoalAccessAdapter } from '../src/logos-engine/v6-goal-access.ts';
import { AttentionMemory } from '../src/logos-engine/v6-attention-memory.ts';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { pointGoal, electInformationGoals, reconcileInformationGoal } from '../src/logos-engine/v6-information-goals.ts';
import { compileInformationPreference } from '../src/sic/information-preference.ts';
import { assessHypothesisPartition, compareSeparation } from '../src/sic/discriminating-experiment.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { readRecoveryRevision, recoveryRevision } from '../src/sic/recovery-pack.ts';

test('experiment discrimination ranks the worst remaining group and reports an exact eliminated share', () => {
  assert.deepEqual(assessHypothesisPartition([2, 2, 0]), { outcomes: 2, remaining: 2, eliminatedShare: { n: 1n, d: 2n } });
  assert.deepEqual(assessHypothesisPartition([1, 0]), { outcomes: 1, remaining: 1, eliminatedShare: { n: 0n, d: 1n } });
  assert.equal(assessHypothesisPartition([]), null);
  assert.equal(compareSeparation(assessHypothesisPartition([2, 1, 1])!.eliminatedShare,
    assessHypothesisPartition([3, 1])!.eliminatedShare), 1);
});

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

test('information priority can change the order inside a preservation tier and shadows without changing the baseline', () => {
  const observation = { observation_ref: 'current', level_epoch: 1 };
  const base = { ...observation, evidence: ['witness'], risks: [], return_steps: 0, predictions: { a: 1, b: 2 } };
  const first = { ...base, source: 'coupled_displays', action: { action_ref: 'ACTION1' }, relations: [['a', 'tests', 'b']] };
  const second = { ...base, source: 'point_contrast', action: { action_ref: 'ACTION6', data: { x: 4, y: 5 } }, relations: [['c', 'tests', 'd']] };
  const offers = [first, second];
  const policy = { excluded_risks: ['protected'], continue_observed_parent: true, order: ['stable_binding'] };
  const preference = compileInformationPreference({ mode: 'shadow', strategy: 'point_contrast', minimumOutcomes: 2 });
  const choose = (candidates: typeof offers, setting = preference, opening = false) =>
    electInformationGoals(candidates, observation, 5, null, policy, opening, setting).next().value;
  const alternate = choose(offers)!;
  assert.equal(alternate[0], first);
  assert.deepEqual(alternate[1].sic_preference.preferred, second.action);
  assert.equal(alternate[1].sic_preference.preferredOutcomes, 2);
  const active = { ...preference, mode: 'active' } as const;
  assert.deepEqual([...electInformationGoals(offers, observation, 5, null, policy, false, active)].map(([offer]) => offer), [second, first]);
  for (const blocked of [{ ...second, risks: ['protected'] }, { ...second, return_steps: 5 }, { ...second, level_epoch: 2 }]) {
    const result = choose([first, blocked], active)!;
    assert.equal(result[0], first);
    assert.equal(result[1].sic_preference.preferred, null);
  }
  assert.equal(choose([{ ...first, engaged_parent: true }, second], active)?.[0].source, first.source);
  assert.equal(choose([{ ...first, relations: [...first.relations, ['e', 'tests', 'f']] }, second], active, true)?.[0].source, first.source);
  assert.equal(choose(offers, { ...active, minimumOutcomes: 3 })?.[0], first);
  assert.throws(() => compileInformationPreference({ ...preference, minimumOutcomes: 1 }), /2–64/);
  const revision = recoveryRevision({ ...defaultRecoveryPack, informationPreference: preference });
  assert.equal(revision.schemaVersion, 6);
  assert.deepEqual(readRecoveryRevision(JSON.parse(JSON.stringify(revision))), revision);
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
