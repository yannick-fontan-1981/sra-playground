import { registerHooks } from 'node:module';

// Evaluation-only counterfactual. Acquisition and every competing proposal stay
// active. The first public observation has revision one in a fresh campaign.
const firstRevision = Number(process.env.SIC_STUDY_CONTACT_FROM_REVISION);
if (!Number.isSafeInteger(firstRevision) || firstRevision < 1)
  throw Error('Set SIC_STUDY_CONTACT_FROM_REVISION to a positive public observation revision');

const selectedEpoch = process.env.SIC_STUDY_CONTACT_CHECKPOINT_EPOCH;
const epoch = selectedEpoch === undefined ? undefined : Number(selectedEpoch);
if (epoch !== undefined && (!Number.isSafeInteger(epoch) || epoch < 1))
  throw Error('Set SIC_STUDY_CONTACT_CHECKPOINT_EPOCH to a positive level epoch');
const isInScope = epoch === undefined ? 'true' : 'observation.level_epoch === ' + epoch;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier !== './contact-frontier.ts' || !context.parentURL?.endsWith('/sic/test-prepared-effects.ts'))
      return nextResolve(specifier, context);
    const original = JSON.stringify(nextResolve(specifier, context).url);
    const wrapper = [
      'export * from ' + original,
      'import { proposeFrontierContact as propose } from ' + original,
      'export function proposeFrontierContact(memory, learning, observation, rows, limits) {',
      '  if (' + isInScope + ' && observation.revision < ' + firstRevision + ') return null',
      '  return propose(memory, learning, observation, rows, limits)',
      '}',
    ].join('\n');
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(wrapper) };
  },
});
