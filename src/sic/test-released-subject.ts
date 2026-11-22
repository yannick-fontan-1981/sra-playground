import { chooseEffectExperiment } from './discriminating-experiment.ts';
import type { Reading, Scene } from './paired-scene.ts';
import { forecast, geometry, imagine, key, peer, viableMotionLaws, type Learning } from './paired-displacements.ts';
import { walkingRegion } from './unknown-region-entry.ts';
import type { TransportForecast, TransportSide } from './transport-observations.ts';

export type ReleasedSubject = {
  side: TransportSide; site: number; held: number; before: number; after: number;
  ticket: string; witness: string; attempted: string[];
};

export function observeRelease(s: Scene, m: Learning, before: Reading, after: Reading, ref: string) {
  const side = peer(before.active);
  if (after.active !== before.active || before.subjects[side] === after.subjects[side]) return;
  const prior = walkingRegion(s, before, before.subjects[side]);
  if (prior.has(after.subjects[side])) return;
  const next = walkingRegion(s, after, after.subjects[side]);
  if (next.size <= prior.size || next.size < 2) return;
  const ticket = ['role-access', side, Math.min(...prior), Math.min(...next)].join('/');
  if (m.checked.includes(ticket)) return;
  return { side, site: after.subjects[side], held: after.subjects[after.active], before: prior.size, after: next.size,
    ticket, witness: ref, attempted: [] } satisfies ReleasedSubject;
}

export function releasedSubjectTest(s: Scene, m: Learning, v: Reading, access: ReleasedSubject, ref: string,
  selection: string, available: readonly string[]) {
  const { side, site, held } = access;
  if (v.subjects[side] !== site || v.subjects[peer(side)] !== held || m.checked.includes(access.ticket)) return;
  const select = v.active !== side;
  let command: string | undefined;
  let expected = v;
  if (select) {
    if (!available.includes('ACTION6') || access.attempted.includes('select')) return;
    command = 'select';
    expected = { ...v, active: side };
  } else {
    // A probe with a measured direction is safe to try when all live models leave
    // the other subject in place. Otherwise calibrate a fresh public direction.
    const space = geometry(s), rivals = viableMotionLaws(m, side);
    const directions = available.filter(op => /^ACTION[1-4]$/.test(op) && !access.attempted.includes(op));
    const trials = directions.flatMap(op => {
      if (!m.motors[op]) return [];
      const outcomes = rivals.map(h => imagine(s, space, v, op, m, h) ?? v);
      const moved = outcomes.find(a => a.subjects[side] !== site);
      if (!moved || outcomes.some(a => a.subjects[peer(side)] !== held)) return [];
      return [{ action: { op, moved }, predictions: [key(v), ...outcomes.map(key)] }];
    });
    const measured = chooseEffectExperiment(trials, 2);
    if (measured) {
      command = measured.action.op;
      expected = measured.action.moved;
    }
    command ??= directions.find(op => !m.motors[op]);
  }
  if (!command) return;
  const f = forecast(s, m, v, expected, command, select ? 'select_the_subject_that_just_gained_access' : 'test_the_newly_released_subject_while_holding_its_partner',
    select ? ['both_subject_positions_are_preserved_by_selection'] : ['does_the_selected_subject_move_while_its_partner_stays'], ref);
  f.evidence = [...new Set([...f.evidence, selection, access.witness])];
  f.releasedAccess = { phase: select ? 'select' : 'test', side, held, before: access.before, after: access.after, ticket: access.ticket };
  return f;
}

export function recordReleaseTest(m: Learning, access: ReleasedSubject, v: Reading, next: Reading, f: TransportForecast, ref: string) {
  const phase = f.releasedAccess!.phase;
  access.attempted.push(phase === 'select' ? 'select' : f.command);
  if (phase === 'select' && next.active === access.side && next.subjects.every((p, i) => p === v.subjects[i]))
    return 'selected_the_released_subject_without_moving_either';
  if (phase === 'test' && next.active === access.side && next.subjects[access.side] !== access.site && next.subjects[peer(access.side)] === access.held) {
    m.checked.push(access.ticket);
    m.refs = [...m.refs.slice(-5), ref];
    return 'independent_motion_in_the_new_region_verified';
  }
  if (key(v) !== key(next) || phase === 'select') m.checked.push(access.ticket);
  return 'the_independent_motion_test_did_not_confirm_access';
}
