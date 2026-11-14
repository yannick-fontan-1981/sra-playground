import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import { samplePublicAnimation, type DirectionalReturn } from './directional-return.ts';
import type { NativeResolution, SicObjective } from './native-resolution.ts';

export interface RestartWitness {
  readonly before: NativeRows;
  readonly after: NativeRows;
  readonly flash: NativeRows;
}

/** LS20's public death return contains a full yellow flash followed by the restored board. */
export function observeLs20Restart(before: NativeRows, after: NativeRows,
  frames: readonly NativeRows[]): RestartWitness | undefined {
  const solid = (frame: NativeRows) => frame.length === 64 && frame.every(row => row.length === 64 && row.every(value => value === 11));
  const flash = frames.slice(0, -1).find(solid);
  if (frames.length < 3 || !flash || solid(after)) return undefined;
  const [a, b] = samplePublicAnimation([before, after]) ?? [];
  if (!a || !b) return undefined;
  return { before: a.rows, after: b.rows, flash: [[11]] };
}

type ObjectiveSource = Pick<NativeResolution, 'objective' | 'objectiveSource' | 'question'>;
// Observed-frontier defines its protocol goal as official_level_completion_as_reported_by_protocol.
export const isLevelCompletion = (id: string | null | undefined) => id === 'G_official_completion' || id === 'G_protocol_completion';
export interface PursuedObjective {
  readonly level: number;
  readonly first: number;
  readonly last: number;
  readonly source: ObjectiveSource;
  readonly sic?: SicObjective;
  readonly advanced: boolean;
  readonly interrupted: boolean;
}

export function objectiveHistory(returns: readonly DirectionalReturn[]): readonly PursuedObjective[] {
  return returns.reduce<readonly PursuedObjective[]>(recordPursuedObjective, []);
}

export function recordPursuedObjective(items: readonly PursuedObjective[], item: DirectionalReturn): readonly PursuedObjective[] {
  const decision = item.decision;
  if (!decision?.objective && !decision?.question) return items;
  const { objective, objectiveSource, question } = decision;
  const source = { objective, objectiveSource, question };
  const sic = decision.recoveryDecision?.objective ?? decision.frontierStrategy?.objective ?? decision.viewStrategy?.objective ?? undefined;
  const last = items.at(-1);
  const advanced = item.toLevel > item.fromLevel;
  const interrupted = Boolean(item.restart);
  if (last && last.last + 1 === item.sequence && last.level === item.fromLevel && !last.advanced && !last.interrupted
    && last.source.objective === source.objective && last.source.objectiveSource === source.objectiveSource
    && last.source.question === source.question && last.sic?.id === sic?.id) {
    return [...items.slice(0, -1), { ...last, last: item.sequence, advanced, interrupted }];
  }
  return [...items.slice(-127), { level: item.fromLevel, first: item.sequence, last: item.sequence, source, sic, advanced, interrupted }];
}

export function firstRecovery(returns: readonly DirectionalReturn[], level: number) {
  const interrupted = returns.find(item => item.fromLevel === level && item.restart);
  if (!interrupted) return null;
  const following = returns.find(item => item.fromLevel === level && item.sequence > interrupted.sequence && item.decision);
  const route = returns.find(item => item.fromLevel === level && item.sequence > interrupted.sequence
    && item.decision && item.decision.route.length > 1);
  const after = following?.decision ?? route?.decision;
  const before = interrupted.decision;
  const retained = Boolean(before?.objective && after?.objective
    && (before.objective === after.objective || isLevelCompletion(before.objective) && isLevelCompletion(after.objective))
    && before.objectiveSource === 'native' && after.objectiveSource === 'native');
  return { interrupted, following, route, retained };
}

export function compareRecoveryRoute(start: DirectionalReturn, returns: readonly DirectionalReturn[]) {
  const plan = start.decision;
  if (!plan) return null;
  const executed: DirectionalReturn[] = [];
  let replacement: DirectionalReturn | undefined;
  let interruption: DirectionalReturn | undefined;
  for (const item of returns) {
    if (item.sessionId !== start.sessionId || item.sequence < start.sequence) continue;
    if (item.sequence !== start.sequence + executed.length || item.fromLevel !== start.fromLevel) break;
    if (executed.length > 0) {
      if (!item.decision?.proposalRef || !plan.proposalRef || item.decision.stepIndex == null) break;
      const offset = plan.stepIndex ?? 0;
      if (item.decision.proposalRef !== plan.proposalRef || item.decision.stepIndex === 0) {
        replacement = item;
        break;
      }
      if (item.decision.stepIndex !== offset + executed.length || executed.length >= plan.remainingSteps) break;
    }
    executed.push(item);
    if (item.restart || item.toLevel !== item.fromLevel) { interruption = item; break; }
  }
  return { executed, replacement, interruption,
    completed: executed.length === plan.remainingSteps,
    abandoned: executed.length < plan.remainingSteps && Boolean(replacement || interruption) };
}

/** Follow successive captured proposals until the next restart, level boundary or missing decision. */
export function recoveryContinuation(first: DirectionalReturn, returns: readonly DirectionalReturn[]) {
  const plans: DirectionalReturn[] = [];
  let next = compareRecoveryRoute(first, returns)?.replacement;
  while (next) {
    plans.push(next);
    const following = compareRecoveryRoute(next, returns)?.replacement;
    next = following && following.sequence > next.sequence ? following : undefined;
  }
  return plans;
}
