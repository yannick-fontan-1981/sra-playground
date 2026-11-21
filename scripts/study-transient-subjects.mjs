import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function transientSubjectAudit(solver) {
  const load = name => import(pathToFileURL(resolve(solver, 'src', name)).href);
  const {geometricComponents} = await load('logos-engine/v6-native-observer.ts');
  const {returningTranslation} = await load('sic/observed-animation.ts');
  const index = rows => {
    const groups = new Map();
    for (const part of geometricComponents(rows)) {
      const key = JSON.stringify([part.color, part.mask]);
      const positions = groups.get(key) ?? new Map();
      positions.set(part.bbox.slice(0, 2).join(), part);
      groups.set(key, positions);
    }
    return groups;
  };
  const tally = {actions: 0, animated: 0, returningSubject: 0, stableCentre: 0,
    interactionWithClickAvailable: 0, animatedInteraction: 0, returningOnInteraction: 0};
  function observe(before, after, input) {
    tally.actions++;
    const activation = input === 5 && before.availableActionIds.includes(6);
    tally.interactionWithClickAvailable += Number(activation);
    const frames = after.frames ?? [];
    if (frames.length < 2) return;
    tally.animated++;
    tally.animatedInteraction += Number(activation);
    const initial = index(before.frame), final = index(after.frame);
    let witnessed = false, stableCentre = false;
    for (const frame of frames) {
      const middle = index(frame);
      for (const [key, origins] of initial) {
        const endpoints = final.get(key), moving = middle.get(key);
        if (endpoints?.size !== origins.size || moving?.size !== origins.size
            || [...origins.keys()].some(p => !endpoints.has(p))) continue;
        const missing = [...origins.keys()].filter(p => !moving.has(p));
        if (missing.length !== 1) continue;
        const part = origins.get(missing[0]), [l, t, r, b] = part.bbox;
        const footprint = part.mask.map(([x, y]) => [x + l, y + t]);
        const cx = Math.round((l + r) / 2), cy = Math.round((t + b) / 2);
        const centreUnchanged = frames.every(f => f[cy]?.[cx] === before.frame[cy]?.[cx]);
        if (!witnessed || centreUnchanged && !stableCentre) {
          assert.ok(returningTranslation(before.frame, after.frame, frames, footprint));
          witnessed = true;
          stableCentre ||= centreUnchanged;
        }
      }
      if (stableCentre) break;
    }
    tally.returningSubject += Number(witnessed);
    tally.stableCentre += Number(stableCentre);
    tally.returningOnInteraction += Number(activation && witnessed);
  }
  return {tally, observe};
}
