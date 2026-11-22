import type { Door, Reading, Scene } from './paired-scene.ts';
import { forecast, key, peer, type Learning } from './paired-displacements.ts';
import { sameSites } from './transport-observations.ts';

export type SelectionReturn = { open: boolean; ref: string } | { ambiguous: true };

function covered(v: Reading, p: number) {
  return v.subjects.includes(p) || v.pieces.includes(p) || v.supports.includes(p);
}

// Ignore remote positions, but distinguish who holds each control and who is selected.
function controlContext(d: Door, v: Reading) {
  if (covered(v, d.site) || !d.controls.length) return;
  const holders = d.controls.map(p => v.pieces.includes(p) ? 'piece' : v.subjects.indexOf(p));
  if (holders.includes(-1) || !holders.includes(v.active)) return;
  return [d.site, holders.join(','), v.active, Number(v.opened.includes(d.site))].join('/');
}

export function observeSelection(s: Scene, m: Learning, b: Reading, a: Reading, ref: string) {
  if (a.active === b.active || !sameSites(b.subjects, a.subjects) ||
      !sameSites(b.pieces, a.pieces) || !sameSites(b.supports, a.supports)) return;
  for (const door of s.doors) {
    const context = controlContext(door, b);
    if (!context || covered(a, door.site)) continue;
    const returns = m.selectionReturns ??= {};
    const prior = returns[context], open = a.opened.includes(door.site);
    if (!prior) returns[context] = { open, ref };
    else if ('open' in prior && prior.open !== open) returns[context] = { ambiguous: true };
  }
}

export function openingsAfterSelection(s: Scene, m: Learning, v: Reading) {
  if (!m.selectionReturns) return v.opened;
  const opened = new Set(v.opened);
  for (const door of s.doors) {
    const context = controlContext(door, v), outcome = context && m.selectionReturns[context];
    if (!outcome || !('open' in outcome)) continue;
    if (outcome.open) opened.add(door.site);
    else opened.delete(door.site);
  }
  return [...opened].sort((a, b) => a - b);
}

export function selectionEvidence(s: Scene, m: Learning, v: Reading) {
  if (!m.selectionReturns) return [];
  return s.doors.flatMap(door => {
    const context = controlContext(door, v), result = context && m.selectionReturns![context];
    return result && 'ref' in result ? [result.ref] : [];
  });
}

export function selectionRefutedOpening(s: Scene, b: Reading, a: Reading, expected: readonly number[]) {
  return s.doors.some(d => !covered(b, d.site) && !covered(a, d.site) &&
    a.opened.includes(d.site) !== expected.includes(d.site));
}

export function testSelectionWhileHolding(s: Scene, m: Learning, v: Reading, ref: string, selection: string) {
  for (const door of s.doors) {
    const context = controlContext(door, v), opened = m.openings?.bySubject[door.site];
    if (!context || !opened || !v.opened.includes(door.site) || m.selectionReturns?.[context]) continue;
    const ticket = 'select-while-holding/' + context + '/' + key(v);
    if (m.checked.includes(ticket)) continue;
    const crossing = m.plan?.some(step => step.expected.subjects.includes(door.site));
    if (!crossing && m.openings?.need?.gate !== door.site) continue;
    const expected = { ...v, active: peer(v.active), opened: openingsAfterSelection(s, m, v) };
    const f = forecast(s, m, v, expected, 'select', 'test_whether_a_passage_requires_the_holder_to_remain_selected',
      ['same_positions_and_the_passage_stays_open', 'same_positions_and_the_passage_closes'], ref);
    f.gateSelectionTest = { gate: door.site, context, ticket };
    f.evidence = [...new Set([...f.evidence, selection, opened])];
    return f;
  }
}
