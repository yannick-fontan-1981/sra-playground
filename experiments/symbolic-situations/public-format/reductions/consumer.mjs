import { consumer } from '../operator/frozen.mjs';

export const baseline = 'f296ac1c2e18f9d02b8e3045c3a225c61553c0e6';
const root = 'experiments/sic-agenda-offres/';
export function frozen(sha = baseline, depot = process.env.SRA_SOLVER_REPO ?? '.') {
  return consumer({ sha, depot, entree: root + 'public-v1/solveur.mjs',
    dep: [root + 'public-v1/admission.mjs', root + 'public-v1/planifier.mjs',
      root + 'public-v1/schema.json', root + 'agenda.mjs', 'src/sic/reasoning-mode.ts'] });
}
