// Diagnostic for candidate 3c2d6bcf. Preload in the chronological runner with
// NODE_OPTIONS=--import=<file URL>. Keep the ordinary, unmodified replay as A/B.
import { writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

if (process.env.SIC_REPLAY_CHILD === '1' && process.env.SIC_P05_COUNTS) {
  const counters = { switchContact: 0, evaluateMissingControl: 0, qualifyControlTrial: 0 };
  const key = Symbol.for('sic.qualification.callCounts');
  globalThis[key] = counters;
  const loaded = new Set();
  // Match one expression per site. Inserting a comma expression preserves its
  // value and evaluation order, including the conditional contact branch.
  const sites = [
    ['paired-passage.ts', 'switchContact', '? qualifyControlTrial(offer', '? (COUNT, qualifyControlTrial)(offer'],
    ['missing-control-strategy.ts', 'evaluateMissingControl', 'const entry = qualifyControlTrial(proposal',
      'const entry = (COUNT, qualifyControlTrial)(proposal'],
    ['control-effect-next.ts', 'qualifyControlTrial', 'const current = offeredAt === context.observationRef',
      'const current = (COUNT, offeredAt === context.observationRef)'],
  ];
  registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      const site = sites.find(([file]) => url.endsWith('/src/sic/' + file));
      if (!site) return result;
      const [file, name, original, replacement] = site;
      const source = Buffer.from(result.source).toString('utf8');
      if (source.split(original).length !== 2) throw Error('Unrecognised P05 call site in ' + url);
      loaded.add(file);
      const increment = `globalThis[Symbol.for('sic.qualification.callCounts')].${name}++`;
      return { ...result, source: source.replace(original, replacement.replace('COUNT', increment)) };
    },
  });
  process.once('exit', () => {
    writeFileSync(process.env.SIC_P05_COUNTS,
      JSON.stringify({ loaded: [...loaded].sort(), counters }) + '\n', { flag: 'wx' });
  });
}
