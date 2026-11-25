import { registerHooks } from 'node:module';
import { predictCycle } from './sic-transfer-rule.mjs';

let evidenceCollector;
let inducedRule;
let inferenceObserver;

export function useTransferEvidence(samples, equal, maximum, builtin) {
  const result = builtin(samples, equal, maximum);
  if (result) return result;
  if (samples.length >= 6) evidenceCollector?.(samples, equal ?? Object.is);
  const learned = inducedRule ? predictCycle(samples, equal ?? Object.is, inducedRule) : undefined;
  inferenceObserver?.(learned);
  return learned;
}


const source = new URL('../src/sic/observed-cycle.ts', import.meta.url);
export const profiles = ['disabled', 'production', 'extended'];

export function installCycleProfile(profile, collector, observer) {
  const tracing = profile?.mode === 'trace' || profile?.mode === 'induced';
  if (!tracing && !profiles.includes(profile)) throw new Error('Unknown profile ' + profile);
  if (profile === 'production') return;
  evidenceCollector = tracing ? collector : undefined;
  inferenceObserver = tracing ? observer : undefined;
  inducedRule = profile?.mode === 'induced' ? profile.rule : undefined;
  const importSource = JSON.stringify(source.href);
  const shim = profile === 'disabled'
    ? 'export {inferObservedCycle} from ' + importSource + '; export const inferCycleAfterTransient = () => undefined;'
    : 'import {inferCycleAfterTransient as learn} from ' + importSource +
      '; export {inferObservedCycle} from ' + importSource +
      '; export const inferCycleAfterTransient = (samples, equal) => learn(samples, equal, 6);';
  const traced = 'import {inferCycleAfterTransient as learn} from ' + importSource
    + '; import {useTransferEvidence as observe} from ' + JSON.stringify(import.meta.url)
    + '; export {inferObservedCycle} from ' + importSource
    + '; export const inferCycleAfterTransient = (samples, equal, maximum) => observe(samples, equal, maximum, learn);';
  const url = 'data:text/javascript,' + encodeURIComponent(tracing ? traced : shim);
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context);
      return result.url === source.href && context.parentURL !== url ? { url, shortCircuit: true } : result;
    },
  });
}
