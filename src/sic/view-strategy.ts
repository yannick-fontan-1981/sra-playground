import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph, type StrategyFact } from './strategy-agenda.ts';

export const viewStrategies = {
  test_reopened_access: 'Retest access after a visible change',
  confirm_access_obstruction: 'Repeat the movement to check the obstruction',
  test_change_of_witnessed_obstruction: 'Test whether the obstruction can change',
  approach_view_edge: 'Approach an edge that may reveal more of the board',
} as const;

export type ViewStrategy = keyof typeof viewStrategies;
type Fact = 'reopened' | 'obstruction' | 'repeated' | 'edgeAccess';

const reopened = { fact: 'reopened', expected: true, label: 'A changed obstruction and the same mover poses were observed' } as const;
const obstruction = { fact: 'obstruction', expected: true, label: 'The witnessed obstruction and mover poses still match' } as const;
const repeated = { fact: 'repeated', expected: true, label: 'The same input stopped at this obstruction more than once' } as const;
const edgeAccess = { fact: 'edgeAccess', expected: true, label: 'A measured motion offers bounded access to a potentially unseen screen area' } as const;
const noReopening = { ...reopened, expected: false, label: 'There is no current reopening to retest' } as const;
const noObstruction = { ...obstruction, expected: false, label: 'There is no current obstruction to investigate' } as const;
const firstStop = { ...repeated, expected: false, label: 'Only one stopped motion has been observed here' } as const;

export const viewStrategyGraph = compileStrategyGraph<ViewStrategy, Fact>({
  id: 'view-access', version: 1, order: 'FALLBACK', priorities: [
    'test_reopened_access', 'confirm_access_obstruction', 'test_change_of_witnessed_obstruction', 'approach_view_edge',
  ],
  strategies: {
    test_reopened_access: [reopened],
    confirm_access_obstruction: [noReopening, obstruction, firstStop],
    test_change_of_witnessed_obstruction: [noReopening, obstruction, repeated],
    approach_view_edge: [noReopening, noObstruction, edgeAccess],
  },
}, ['reopened', 'obstruction', 'repeated', 'edgeAccess']);

export function isViewStrategy(value: unknown): value is ViewStrategy {
  return typeof value === 'string' && Object.hasOwn(viewStrategies, value);
}

export interface ViewNeedSituation {
  readonly observationRef: string;
  readonly segment: number;
  readonly reopened: readonly string[] | null;
  readonly obstruction: { refs: readonly string[]; repeated: boolean } | null;
  readonly edgeAccess: readonly string[] | null;
}

export function selectViewStrategy<Plan>(current: ViewNeedSituation, planners: Readonly<Record<ViewStrategy, () => Plan | null>>) {
  const { observationRef, segment, reopened: changed, obstruction: block, edgeAccess: edge } = current;
  const witness = (value: boolean, refs: readonly string[] = []): StrategyFact => ({ value, evidence: [observationRef, ...refs] });
  const facts: Record<Fact, StrategyFact> = {
    reopened: witness(changed !== null, changed ?? []),
    obstruction: witness(block !== null, block?.refs),
    repeated: block ? witness(block.repeated, block.refs) : { value: 'unknown' },
    edgeAccess: edge ? witness(true, edge) : { value: 'unknown' },
  };
  const decision = resolveStrategyGraph({ graph: viewStrategyGraph, facts, mode: 'active', planners });
  const identity = { kind: 'observe_view_access', scope: observationRef.split(':revision:', 1)[0]!, subjects: [`view-segment:${segment}`],
    parentObjective: 'G_official_completion', satisfactionContract: 'observe_the_bound_view_access_return' } as const;
  const needId = sicNeedId(identity);
  return { ...decision,
    situation: { id: `sic-situation:${symbolicDigest([viewStrategyGraph.id, needId])}`, revision: observationRef, facts },
    need: { ...identity, id: needId, status: 'assigned' as const, evidence: decision.entries.find(entry => entry.result === 'selected')?.evidence ?? [] },
  };
}
