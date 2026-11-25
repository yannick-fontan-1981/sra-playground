import { registerHooks } from 'node:module';

const source = new URL('../src/sic/observed-cycle.ts', import.meta.url);
export const profiles = ['disabled', 'production', 'extended'];

export function installCycleProfile(profile) {
  if (!profiles.includes(profile)) throw new Error('Unknown profile ' + profile);
  if (profile === 'production') return;
  const importSource = JSON.stringify(source.href);
  const shim = profile === 'disabled'
    ? 'export {inferObservedCycle} from ' + importSource + '; export const inferCycleAfterTransient = () => undefined;'
    : 'import {inferCycleAfterTransient as learn} from ' + importSource +
      '; export {inferObservedCycle} from ' + importSource +
      '; export const inferCycleAfterTransient = (samples, equal) => learn(samples, equal, 6);';
  const url = 'data:text/javascript,' + encodeURIComponent(shim);
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context);
      return result.url === source.href && context.parentURL !== url ? { url, shortCircuit: true } : result;
    },
  });
}
