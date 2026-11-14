import assert from 'node:assert/strict';
import test from 'node:test';
import { selectStrategyFamily } from '../src/sic/family-agenda.ts';
import { reasoningGroupOrder, selectReasoningMode, type ReasoningSituation } from '../src/sic/reasoning-mode.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { readRecoveryRevision, recoveryRevision } from '../src/sic/recovery-pack.ts';
import { controlEffectTrigger, orderControlTrials, readControlEffectTrigger } from '../src/sic/control-effect-trigger.ts';
import { resolveNavigationPrimitives } from '../src/sic/navigation-primitives.ts';

test('fresh level entry, refuted and supported plans select different reasoning cards and a different next offer', async () => {
  const start: ReasoningSituation = { level: 1, levelsCompleted: 0, targetLevels: 3, levelActions: 0, remainingActions: 9,
    latestReturn: 'unknown', acquiredInformation: false, observationRef: 'entry' };
  const ids = ['goal_access', 'information_goal', 'acquire_control_for_target', 'view', 'view_continuity', 'observed_frontier'];
  const groups = ids.map(id => ({ id }));
  async function choice(changes: Partial<ReasoningSituation>, required = false) {
    const situation = { ...start, ...changes };
    const mode = selectReasoningMode(situation).mode;
    const { card, order } = reasoningGroupOrder(groups, mode, situation.remainingActions);
    const agenda = await selectStrategyFamily(groups, async index => ({ family: ids[index]!, selected: required || index > 0 }), order);
    return [mode, card, agenda.selected];
  }
  assert.deepEqual(await choice({}), ['assimilation', 'revalidate-needed-control', 'acquire_control_for_target']);
  assert.deepEqual(await choice({ levelActions: 2, latestReturn: 'contradicted' }), ['exploration', 'explore-grounded-question', 'information_goal']);
  assert.deepEqual(await choice({ levelActions: 2, latestReturn: 'contradicted', remainingActions: 1 }),
    ['exploration', 'explore-with-limited-reserve', 'view']);
  assert.deepEqual(await choice({ levelActions: 3, latestReturn: 'matched' }), ['solving', 'resume-objective-access', 'view']);
  assert.deepEqual(await choice({ levelActions: 3, latestReturn: 'matched' }, true), ['solving', 'resume-objective-access', 'goal_access']);
  assert.deepEqual(await choice({ level: 2, levelsCompleted: 1 }), ['assimilation', 'revalidate-needed-control', 'acquire_control_for_target']);
});

test('adaptive reasoning is an explicit pack policy and survives export', () => {
  const pack = recoveryRevision({ ...defaultRecoveryPack, reasoningMode: 'adaptive' });
  assert.equal(pack.schemaVersion, 7);
  assert.deepEqual(readRecoveryRevision(JSON.parse(JSON.stringify(pack))), pack);
  assert.equal(recoveryRevision(defaultRecoveryPack).schemaVersion, 1);
  assert.throws(() => recoveryRevision({ ...defaultRecoveryPack, reasoningMode: 'adaptive', familyAgenda: 'native' }),
    /requires the active SIC agenda/);
});

test('the same P05 offer uses a different trigger only when its supporting evidence is present', () => {
  const facts = { current: 'current', priorEffect: 'earlier-effect', planDependency: 'retained-plan',
    evidence: ['current', 'earlier-effect', 'retained-plan'] };
  const assimilation = controlEffectTrigger('assimilation', facts);
  assert.equal(assimilation.id, 'revalidate_control');
  assert.deepEqual(assimilation.evidence, ['current', 'earlier-effect']);
  const solving = controlEffectTrigger('solving', facts);
  assert.equal(solving.id, 'unblock_plan_control');
  assert.deepEqual(solving.evidence, ['current', 'retained-plan']);
  assert.equal(controlEffectTrigger('exploration', facts).id, 'explore_control');
  assert.equal(controlEffectTrigger('assimilation', { ...facts, evidence: ['current'] }).id, 'explore_control');
  assert.equal(controlEffectTrigger('solving', { ...facts, planDependency: 'current' }).id, 'explore_control');
  assert.deepEqual(readControlEffectTrigger(solving, 'current'), solving);
  assert.equal(readControlEffectTrigger({ ...solving, evidence: ['current'] }, 'current'), undefined);
  assert.equal(readControlEffectTrigger(solving, 'next'), undefined);
});

test('trigger cards can change the first control offered and preserve an engaged trial', () => {
  const commands = ['ACTION1', 'ACTION2', 'ACTION3'];
  const factsFor = (command: string) => ({
    current: 'current',
    priorEffect: command === 'ACTION2' ? 'earlier-effect' : undefined,
    planDependency: command === 'ACTION3' ? 'retained-plan' : undefined,
    evidence: ['current', 'earlier-effect', 'retained-plan'],
  });
  assert.deepEqual(orderControlTrials(commands, 'assimilation', factsFor), ['ACTION2', 'ACTION1', 'ACTION3']);
  assert.deepEqual(orderControlTrials(commands, 'solving', factsFor), ['ACTION3', 'ACTION1', 'ACTION2']);
  assert.deepEqual(orderControlTrials(commands, 'exploration', factsFor), commands);
  assert.deepEqual(orderControlTrials(commands, 'assimilation', factsFor, 'ACTION3'), ['ACTION3', 'ACTION2', 'ACTION1']);
  assert.deepEqual(orderControlTrials(commands, 'assimilation', command => ({ ...factsFor(command), evidence: ['current'] })), commands);
});

test('the same navigation situation chooses a different primitive in each reasoning mode', () => {
  const evidence = ['current', 'observed-return'] as const;
  const expected = [2, 3] as const;
  const offers = { evidence, probe: { input: 'probe', expected: null, evidence },
    access: { input: 'move', expected, evidence }, interaction: { input: 'interact', expected: null, evidence } };
  const exploration = resolveNavigationPrimitives({ ...offers, mode: 'exploration' });
  const assimilation = resolveNavigationPrimitives({ ...offers, mode: 'assimilation' });
  const solving = resolveNavigationPrimitives({ ...offers, mode: 'solving' });
  assert.equal(exploration.selected?.id, 'P05');
  assert.equal(assimilation.selected?.id, 'P02');
  assert.equal(solving.selected?.id, 'P07');
  assert.equal(solving.entries.find(entry => entry.id === 'P02')?.result, 'lower_priority');
  const after = resolveNavigationPrimitives({ ...offers, mode: 'solving', access: null, interaction: null });
  assert.equal(after.selected?.id, 'P05');
});
