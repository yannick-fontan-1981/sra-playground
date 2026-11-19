import { matchCoupledPair, measureCoupledPairs, type CoupledPairBox, type CoupledPairDelta } from '../logos-engine/v6-coupled-pair-observation.ts';
import { jointCoupledPairRoute } from '../logos-engine/v6-coupled-pair-route.ts';
import type { NativeCommand, NativeRows } from '../logos-engine/v6-native-types.ts';

export type ObservedJointInput = { ink: number; size: number; floors: number[]; refuted: string[];
  trials: Record<string, { delta: CoupledPairDelta; partner: CoupledPairDelta; ref: string }> };
export type JointProposal = { command: NativeCommand; expected: CoupledPairBox[]; evidence: string[] };
const signature = (boxes: readonly CoupledPairBox[]) => boxes.map(box => box.join(',')).sort().join(';');
const contains = ([top, left, bottom, right]: CoupledPairBox, x: number, y: number) => x >= left && x <= right && y >= top && y <= bottom;

export function observeJointInput(local: ObservedJointInput | undefined, before: NativeRows, after: NativeRows,
  command: NativeCommand, ref: string, predicted?: JointProposal): ObservedJointInput | undefined {
  if (!/^ACTION[1-4]$/.test(command.action_ref)) return local;
  const returned = measureCoupledPairs(after);
  const candidates = measureCoupledPairs(before).filter(pair => !local || pair.value === local.ink && pair.size === local.size).flatMap(pair => {
    const match = returned.find(item => item.value === pair.value && item.size === pair.size);
    const motion = match && matchCoupledPair(pair, match);
    return motion ? [{ pair, motion }] : [];
  });
  if (candidates.length !== 1) return local;
  const { pair, motion } = candidates[0]!;
  const [delta, partner] = motion.deltas;
  const history = local ?? { ink: pair.value, size: pair.size, floors: [], refuted: [], trials: {} };
  if (predicted && signature(predicted.expected) !== signature(motion.boxes)) {
    return { ...history, refuted: [...new Set([...history.refuted, signature(pair.boxes)])] };
  }
  if (!delta || !partner || [delta, partner].some(vector => Math.abs(vector[0]) + Math.abs(vector[1]) !== pair.size)) return local;
  const axis = delta[0] === 0 ? 1 : 0;
  if (!partner[axis]) return local;
  const floors = new Set(history.floors);
  for (const [top, left, bottom, right] of pair.boxes) {
    const revealed = new Set<number>();
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      if (!motion.boxes.some(box => contains(box, x, y))) revealed.add(after[y]![x]!);
    }
    if (revealed.size === 1) floors.add([...revealed][0]!);
  }
  return { ...history, floors: [...floors], trials: { ...history.trials, [command.action_ref]: { delta, partner, ref } } };
}

export function chooseJointInput(local: ObservedJointInput | undefined, rows: NativeRows, inputs: readonly NativeCommand[],
  remaining: number, revalidate = false): JointProposal | undefined {
  if (!local || !local.floors.length) return;
  const trials = inputs.flatMap(command => local.trials[command.action_ref] ? [{ command, ...local.trials[command.action_ref]! }] : []);
  const signs = [0, 1].map(axis => new Set(trials.filter(trial => trial.delta[axis]).map(trial =>
    Math.sign(trial.delta[axis]! * trial.partner[axis]!))));
  if (signs.some(axis => axis.size !== 1) || !revalidate && !signs.some(axis => axis.has(-1))) return;
  const pair = measureCoupledPairs(rows).find(candidate => candidate.value === local.ink && candidate.size === local.size);
  if (!pair || local.refuted.includes(signature(pair.boxes))) return;
  const controls = Object.fromEntries(trials.map(trial => [trial.command.action_ref, trial.delta]));
  const evidence = trials.map(trial => trial.ref);
  const route = jointCoupledPairRoute(rows, pair, controls, local.floors, signs.map(axis => [...axis][0]!), Math.min(40, remaining), evidence, true);
  const command = inputs.find(input => input.action_ref === route?.actions[0]);
  return command && route?.expected[0] ? { command, expected: route.expected[0], evidence } : undefined;
}
