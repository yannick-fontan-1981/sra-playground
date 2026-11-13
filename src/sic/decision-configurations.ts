import type { NativeResolution } from './native-resolution.ts';
import { isLevelCompletion } from './recovery.ts';

export type Decision = Pick<NativeResolution, 'objective' | 'objectiveSource'> & Partial<Pick<NativeResolution, 'context'>>;
type Fact = 'orientationContact' | 'reserveContact' | 'targetContact' | 'levelObjective';

interface Configuration {
  readonly kind: 'strategy' | 'objective';
  readonly when: Fact;
  readonly need: string;
  readonly situation: string;
  readonly choice: string;
}

const configurations: readonly Configuration[] = [
  {
    kind: 'strategy', when: 'orientationContact',
    need: 'Find or verify a way to align the motifs',
    situation: 'The proposal targets a contact expected to change orientation.',
    choice: 'Test the orientation change and compare the two motifs on return.',
  },
  {
    kind: 'strategy', when: 'reserveContact',
    need: 'Have enough reserve to reach the target',
    situation: 'The proposed route includes a contact to test or collect reserve.',
    choice: 'Route through the reserve before attempting the target.',
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
  const facts: Record<Fact, boolean> = {
    orientationContact: context?.access === 'contact' && context.effect === 'modifier',
    reserveContact: context?.access === 'contact' && context.effect === 'capacity_probe',
    targetContact: context?.access === 'contact' && context.effect === 'peer' && context.orientation === 'aligned',
    levelObjective: decision.objectiveSource === 'native' && isLevelCompletion(decision.objective),
  };
  return configurations.filter(configuration => facts[configuration.when]);
}
