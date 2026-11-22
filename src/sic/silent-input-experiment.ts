import type { Edge, Experiment, Memory } from './preparation-experiments.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import { nextConfiguration } from './configuration-trials.ts';

export const silentInputStrategy = 'test_an_unresponsive_input_after_preparation';
export const startSilentTest = 'compare_a_silent_input_across_two_preparations';
export const finishSilentTest = 'measure_the_input_after_the_observed_preparation';

export type SilentInputQuestion = {
  origin: number;
  prepared: number;
  prepare: string;
  probe: string;
  refs: number[];
  preparationReturns: number;
  inactiveOrigins: number;
  reversible: boolean;
};

const canIssue = (available: readonly string[], command: string) => available.includes(command.split(':')[0]!);

function experiment(question: SilentInputQuestion, phase: 'prepare' | 'probe'): Experiment {
  return { phase, origin: question.origin, a: question.prepare, b: question.probe, refs: question.refs,
    rule: 'test_if_a_previously_silent_input_acts_in_another_arrangement', silentInput: question };
}

export function proposeSilentInput(m: Memory, site: number, available: readonly string[], budget: number,
  minimumOutcomes: number, continuation: boolean, rows: NativeRows): Experiment | null {
  if (minimumOutcomes > 2 || budget < 1 || site < 0) return null;
  if (continuation) {
    const q = m.pendingSilentInput;
    return q?.prepared === site && canIssue(available, q.probe) ? experiment(q, 'probe') : null;
  }
  if (budget < 2 || m.pendingSilentInput || m.pending || m.cursorSelection?.pending ||
      (m.pairInquiry?.learning.planSolves && m.pairInquiry.learning.plan?.length)) return null;

  const counts = new Map<number, number>();
  for (const index of m.delayed.history) counts.set(index, 1 + (counts.get(index) ?? 0));
  const inactive = new Map<string, Edge[]>(), productive = new Set<string>();
  for (const edge of m.edges) {
    if (!edge.stable || edge.t !== edge.s || edge.effect.key !== 'still') productive.add(edge.cmd);
    else {
      const controls = inactive.get(edge.cmd) ?? [];
      controls.push(edge);
      inactive.set(edge.cmd, controls);
    }
  }
  let best: { question: SilentInputQuestion; rank: number[] } | undefined;
  for (const [index, prep] of m.edges.entries()) {
    const times = counts.get(index) ?? 0;
    if (prep.s !== site || prep.t === site || !prep.stable || times < 2 || !canIssue(available, prep.cmd) ||
        prep.effect.key === 'completion' || prep.effect.key.startsWith('terminal:')) continue;
    const preparedActions = m.scenes[prep.t]!.split('|').at(-1)!.split(',');
    const following = m.edges.filter(edge => edge.s === prep.t);
    const reversible = following.some(edge => edge.stable && edge.t === site);
    for (const [probe, controls] of inactive) {
      if (controls.length < 2 || productive.has(probe) || !canIssue(preparedActions, probe) ||
          following.some(edge => edge.cmd === probe)) continue;
      const direct = controls.find(edge => edge.s === site);
      const other = controls.find(edge => edge.s !== site);
      if (!direct || !other) continue;
      const rank = [Number(reversible), Math.min(4, times), Math.min(4, controls.length), direct.ref, -prep.ref];
      const difference = best ? rank.findIndex((v,i) => v !== best!.rank[i]) : -1;
      if (best && (difference < 0 || rank[difference]! < best.rank[difference]!)) continue;
      best = { rank, question: { origin: site, prepared: prep.t, prepare: prep.cmd, probe, reversible,
        preparationReturns: times, inactiveOrigins: controls.length, refs: [direct.ref, other.ref, prep.ref] } };
    }
  }
  if (!best) return null;
  // A single witnessed control can sometimes test a new configuration now.
  // Returning to a familiar arrangement to ask a two-action question costs more.
  if (m.configurationOpportunity && m.configurations) {
    const direct = nextConfiguration(m.configurations, rows, available);
    if (direct && direct.expected === direct.target) return null;
  }
  return experiment(best.question, 'prepare');
}

export function assessSilentInput(m: Memory, x: Experiment, from: number, to: number, command: string, effect: string) {
  const q = x.silentInput!;
  if (x.phase === 'prepare') {
    if (from !== q.origin || to !== q.prepared || command !== q.prepare) return 'preparation_did_not_reproduce_observed_arrangement';
    m.pendingSilentInput = q;
    return 'preparation_verified_test_the_silent_input';
  }
  if (from !== q.prepared || command !== q.probe) return 'prepared_input_test_inapplicable';
  if (effect === 'completion') return 'prepared_input_reached_official_completion';
  if (effect.startsWith('terminal:')) return 'prepared_input_ended_the_attempt';
  if (from === to) return 'input_remained_silent_after_preparation';
  return to === q.origin ? 'prepared_input_restored_original_arrangement' : 'previously_silent_input_changed_the_arrangement';
}
