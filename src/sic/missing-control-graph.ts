import { compileStrategyGraph, type StrategyGraph } from './strategy-agenda.ts';

export const missingControlStrategy = 'test_missing_control';
export const missingControlNeed = 'establish_control_effect_for_current_objective';
export const missingControlLabel = 'Test an input needed by the retained method';
export const missingControlStrategies = { [missingControlStrategy]: missingControlLabel };

type Fact = 'currentObservation' | 'supportedObjective' | 'availableControl' | 'knownEffect' | 'alreadyTried';
export const missingControlGraph = compileStrategyGraph({
  id: 'current-control-effect',
  version: 1,
  order: 'FALLBACK',
  priorities: [missingControlStrategy],
  strategies: {
    [missingControlStrategy]: [
      { fact: 'currentObservation', expected: true, label: 'The proposed test refers to the current observation' },
      { fact: 'supportedObjective', expected: true, label: 'An objective supported by evidence depends on this control' },
      { fact: 'availableControl', expected: true, label: 'The command is available in the current situation' },
      { fact: 'knownEffect', expected: false, label: 'The effect has yet to be measured in this situation' },
      { fact: 'alreadyTried', expected: false, label: 'The command has yet to be tried in this situation' },
    ],
  },
} satisfies StrategyGraph<typeof missingControlStrategy, Fact>,
['currentObservation', 'supportedObjective', 'availableControl', 'knownEffect', 'alreadyTried']);
