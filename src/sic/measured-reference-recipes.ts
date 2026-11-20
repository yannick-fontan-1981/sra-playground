import { same, diff } from './access-terrain.ts';
import type { InverseInputs } from './inverse-frame-sites.ts';
import type { ReferenceRecipe } from './route-to-reference.ts';

// An agent may witness the decisive pair while pursuing an unrelated objective.
export function measuredReferenceRecipes({ known, history, pairAt }: InverseInputs): ReferenceRecipe[] {
  if (!pairAt) return [];
  const recipes: ReferenceRecipe[] = [];
  for (const [q, roles] of known)
    for (const [id, role] of roles) {
      const moving = (history.get(q + '/' + id) ?? []).filter((e) => !same(e.from, e.to));
      if (moving.length < 2) continue;
      const refNames = new Set(
        moving.flatMap((e) =>
          [...e.anchors.keys()].filter((k) => k !== 'world' && k !== 'self' && same(e.anchors.get(k)!, e.to))
        )
      );
      for (const anchor of refNames) {
        const uses = moving.filter((e) => e.anchors.has(anchor));
        if (uses.some((e) => !same(e.anchors.get(anchor)!, e.to))) continue;
        const writer = JSON.stringify([anchor, []]);
        for (const observed of uses) {
          const earlier = uses.find(
            (e) =>
              e.index < observed.index &&
              !same(e.to, observed.to) &&
              !same(diff(e.to, observed.to), diff(e.from, observed.from))
          );
          if (!earlier) continue;
          let witnessed = false;
          for (const [a] of known) {
            if (a === q) continue;
            const calibration = (history.get(a + '/' + writer) ?? []).find((e) => {
              if (
                e.index >= observed.index ||
                e.afterScene !== observed.scene ||
                same(e.from, e.to) ||
                !same(e.to, observed.to)
              )
                return false;
              const p = pairAt(e, role);
              return !!p && same(p.from, p.to) && same(p.to, observed.from);
            });
            if (calibration) {
              witnessed = true;
              break;
            }
          }
          if (witnessed) {
            recipes.push({
              q,
              role,
              anchor,
              offset: [0, 0],
              refs: [earlier.index, observed.index],
              placement: observed.to,
            });
            break;
          }
        }
      }
    }
  return recipes;
}
