import { localPatch } from '../src/sic/local-response.ts';
import { op } from './sic-study-source-replay.mjs';

// Equal-length alternatives filter effects of elapsed time and responses shared by other inputs.
export function discriminatesAction(base, steps, p, runBranch, testUse) {
  const observed = steps.filter((c) => c.a === 6).map(op);
  const options = [
    ...new Set([
      ...base.availableActionIds.filter((id) => id !== 6 && id !== 7).map((id) => 'ACTION' + id),
      ...observed,
    ]),
  ];
  const alternatives = options.filter((k) => k !== p.a && k !== p.b && (!testUse || k !== p.c)).slice(0, 12);
  let compared = 0;
  for (const k of alternatives) {
    const rival = runBranch(testUse ? [p.a, p.b, k] : [p.a, k]);
    if (!rival) continue;
    compared++;
    if (localPatch(rival, testUse ? p.siteC : p.siteB) === (testUse ? p.afterC : p.afterB))
      return { compared, selective: false };
  }
  return { compared, selective: compared > 0 };
}
