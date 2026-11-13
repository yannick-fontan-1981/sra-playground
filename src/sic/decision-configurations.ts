import type { NativeResolution } from './native-resolution.ts';
import type { DirectionalReturn } from './directional-return.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import { isLevelCompletion } from './recovery.ts';

export type Decision = Pick<NativeResolution, 'objective' | 'objectiveSource'> & Partial<Pick<NativeResolution, 'context'>>;
type Fact = 'orientationContact' | 'reserveAccess' | 'reserveContact' | 'colorContact' | 'reserveAndColor'
  | 'reserveRoute' | 'targetContact' | 'levelObjective';

interface Configuration {
  readonly kind: 'strategy' | 'objective';
  readonly when: Fact;
  readonly need: string;
  readonly situation: string;
  readonly choice: string;
  readonly title?: string;
}

const configurations: readonly Configuration[] = [
  {
    kind: 'strategy', when: 'orientationContact',
    need: 'Find or verify a way to align the motifs',
    situation: 'The proposal targets a contact expected to change orientation.',
    choice: 'Test the orientation change and compare the two motifs on return.',
  },
  {
    kind: 'strategy', when: 'reserveAccess', title: 'Test access to a possible recharge',
    need: 'Reach a possible recharge before the reserve runs out',
    situation: 'The engine selected a test of movement or access toward a possible source.',
    choice: 'Check the proposed step against the returned position.',
  },
  {
    kind: 'strategy', when: 'reserveContact', title: 'Take the recharge detour',
    need: 'Have enough reserve to reach the target',
    situation: 'The engine selected a route to a tile that might restore reserve.',
    choice: 'Try the contact, then check whether the gauge rises.',
  },
  {
    kind: 'strategy', when: 'colorContact', title: 'Test a way to match the colors',
    need: 'Resolve the color difference between the two motifs',
    situation: 'The engine measured different colors and selected a tile to test for a color effect.',
    choice: 'Try the contact and compare both motifs on return.',
  },
  {
    kind: 'strategy', when: 'reserveAndColor', title: 'Fit a known color change into the available reserve',
    need: 'Match the colors and keep enough reserve to continue',
    situation: 'The engine linked a previously observed color effect to a route with onward access or recovery.',
    choice: 'Follow the next segment and check each planned effect on return.',
  },
  {
    kind: 'strategy', when: 'reserveRoute', title: 'Plan the next step within the reserve',
    need: 'Continue toward the target without exhausting the reserve',
    situation: 'The engine selected a route that budgets the reserve across more than the next action.',
    choice: 'Follow the next segment of that route and check the return before proceeding.',
  },
  {
    kind: 'strategy', when: 'targetContact',
    need: 'Check whether the target advances the level',
    situation: 'The engine measures aligned motifs and proposes contact with the target.',
    choice: 'Try the contact and check the level reported by the game.',
  },
  {
    kind: 'objective', when: 'levelObjective',
    need: 'Advance in the game',
    situation: 'The native proposal cites completion of the level as its objective.',
    choice: 'Complete the level. Intermediate plans can test alignment, reserve or access.',
  },
];

/** Display rules for evidence already published by the native engine. */
export function explainDecision(decision: Decision) {
  const context = decision.context;
  const strategy = context?.strategy;
  const colorReaccess = strategy?.route === 'managed_access' && strategy.color === 'different' && strategy.colorWitness !== null;
  const reserveContact = context?.access === 'contact' && context.effect === 'capacity_probe';
  const facts: Record<Fact, boolean> = {
    orientationContact: context?.access === 'contact' && context.effect === 'modifier',
    reserveAccess: strategy?.route === 'capacity_access_probe',
    reserveContact,
    colorContact: context?.access === 'contact' && context.effect === 'feature_probe' && strategy?.color === 'different' && !colorReaccess,
    reserveAndColor: colorReaccess,
    reserveRoute: strategy?.route === 'managed_access' && !!strategy.meter && !reserveContact && !colorReaccess,
    targetContact: context?.access === 'contact' && context.effect === 'peer' && context.orientation === 'aligned',
    levelObjective: decision.objectiveSource === 'native' && isLevelCompletion(decision.objective),
  };
  return configurations.filter(configuration => facts[configuration.when]);
}

/** Keep contiguous returns for each selected plan, with no cross-session attribution. */
export function strategyEpisodes(returns: readonly DirectionalReturn[], sessionId: string) {
  const episodes: { configuration: Configuration; first: DirectionalReturn; last: DirectionalReturn }[] = [];
  const latest = new Map<Fact, typeof episodes[number]>();
  for (const item of returns) {
    if (item.sessionId !== sessionId || !item.decision?.proposalRef) continue;
    const rules = explainDecision(item.decision).filter(rule => rule.title);
    for (const configuration of rules) {
      const previous = latest.get(configuration.when);
      if (previous?.last.sequence === item.sequence - 1 && previous.last.fromLevel === item.fromLevel
          && previous.last.decision?.proposalRef === item.decision.proposalRef) previous.last = item;
      else {
        const next = { configuration, first: item, last: item };
        episodes.push(next);
        latest.set(configuration.when, next);
      }
    }
  }
  return episodes;
}

export function strategyOutcome(configuration: Configuration, item: DirectionalReturn): string {
  const decision = item.decision;
  if (!decision) return 'No return for this choice yet.';
  if (item.fromLevel !== item.toLevel) return 'The game advanced. The local effect cannot be separated from the level change.';
  if (item.restart) return 'The game restarted. The local effect cannot be separated from the restart.';
  if (decision.remainingSteps !== 1 || decision.stepIndex == null) return item.nativeCheck?.matched === false
    ? 'The latest step differed from the prediction; this segment’s final effect was not reached.'
    : 'Only steps toward the planned endpoint have been observed.';
  if (configuration.when === 'reserveContact' || (configuration.when === 'reserveAndColor' && decision.context?.effect === 'capacity_probe')) {
    const meter = decision.strategyMeter;
    if (meter?.unitsAfter != null) return meter.unitsAfter > meter.unitsBefore
      ? 'The measured gauge rose on this return.'
      : 'The measured gauge did not rise on this return.';
    return 'The gauge change could not be verified on this return.';
  }
  if (configuration.when === 'colorContact' || (configuration.when === 'reserveAndColor' && decision.context?.effect === 'feature_probe')) {
    const [a, b] = decision.sprites.filter(sprite => sprite.label.startsWith('Pattern compared'));
    if (a?.after && b?.after) {
      const same = (x: NativeRows, y: NativeRows) => JSON.stringify(x) === JSON.stringify(y);
      const recolored = (before: NativeRows, after: NativeRows) => {
        const changes = new Map<number, number>();
        const unchanged = new Set<number>();
        before.forEach((row, y) => row.forEach((color, x) => {
          const next = after[y]?.[x];
          if (next === color) unchanged.add(color);
          else if (next !== undefined) changes.set(color, changes.has(color) && changes.get(color) !== next ? -1 : next);
        }));
        return changes.size === 1 && [...changes].every(([from, to]) => to >= 0 && !unchanged.has(from) && !unchanged.has(to));
      };
      if ((same(a.before, a.after) && recolored(b.before, b.after)) || (same(b.before, b.after) && recolored(a.before, a.after))) {
        return 'One motif changed color in place; the other kept the same pixels.';
      }
      if (same(a.before, a.after) && same(b.before, b.after)) return 'Neither motif changed on this return.';
    }
    return 'The two crops do not isolate a color change on this return.';
  }
  return item.nativeCheck?.matched === true ? 'The engine confirmed the predicted step.'
    : item.nativeCheck?.matched === false ? 'The observed step differed from the prediction.'
      : 'The engine did not publish a matching check for this step.';
}
