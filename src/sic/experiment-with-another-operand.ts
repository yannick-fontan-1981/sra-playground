import type { Reading, Scene } from './paired-scene.ts';
import { pointCommand } from './paired-scene.ts';
import { exchangeTarget, forecast, geometry, imagine, key, law, md, peer, type Learning } from './paired-displacements.ts';
import { walkingRegion } from './unknown-region-entry.ts';
import type { TransportSide } from './transport-observations.ts';

type Step = { previous?: Step; op?: string; pose: Reading; depth: number; rank: number };

/** A witnessed exchange released one subject at the expense of its partner.
 * Test whether a movable part can replace the partner as the other operand. */
export function anotherOperandTest(s: Scene, m: Learning, v: Reading, ref: string, depth: number, budget: number) {
  const need = m.strandedPartner;
  if (!need || v.subjects[need.side] !== need.site || !v.pieces.length) return;
  const side = need.side, mobile = peer(side);
  if (m.evidence[side].clear_path_exchange === undefined) return;
  const space = geometry(s), origin = walkingRegion(s, v, need.site, space);
  const destination = walkingRegion(s, v, v.subjects[mobile], space);
  if (destination.size <= origin.size || destination.has(need.site)) return;
  const ops = Object.keys(m.motors);
  const sites = new Set<number>();
  for (const op of ops) {
    const { dx, dy } = m.motors[op]!;
    for (let p = space.at(need.site, dx, dy); p >= 0; p = space.at(p, dx, dy)) {
      if (!space.walk(v, p) && !space.medium.has(p)) break;
      if (destination.has(p)) sites.add(p);
    }
  }
  if (!sites.size) return;
  const score = (p: Reading) => Math.min(...p.pieces.map(part =>
    Math.min(...Array.from(sites, site => md(s, site, part))) * 3 + md(s, p.subjects[mobile], part)));
  const root: Step = { pose: v, depth: 0, rank: score(v) };
  const queue = [root], seen = new Map([[key(v), 0]]);
  const parked = s.goals.includes(v.subjects[mobile]);
  for (let count = 0; queue.length && count < budget; count++) {
    queue.sort((a, b) => b.rank - a.rank || b.depth - a.depth);
    const n = queue.pop()!, state = n.pose;
    if (n.depth !== seen.get(key(state))) continue;
    if (state.active === side) {
      for (const op of ops) {
        const operand = exchangeTarget(space, state, m.motors[op]!, 'clear_path_exchange');
        const ticket = key(state) + '|' + op;
        if (!sites.has(operand) || !state.pieces.includes(operand) || m.denied[ticket] || m.checked.includes('operand/' + ticket)) continue;
        const after = imagine(s, space, state, op, m, 'clear_path_exchange');
        if (!after || after.subjects[mobile] !== state.subjects[mobile]) continue;
        let first = n;
        while (first.previous?.previous) first = first.previous;
        const preparing = !!first.previous;
        const f = forecast(s, m, v, preparing ? first.pose : after, preparing ? first.op! : op,
          preparing ? 'prepare_an_alternative_operand_for_a_stranded_subject' : 'test_if_another_operand_releases_the_subject',
          ['the_subject_reaches_the_other_region_or_remains_confined', 'its_partner_keeps_its_position_during_the_test'], ref);
        f.evidence = [...new Set([...f.evidence, need.witness])];
        f.operandTest = { side, operand, command: op, steps: n.depth, stayed: key(state), transferred: key(after) };
        return f;
      }
    }
    if (n.depth >= depth - 1) continue;
    // Only the mobile partner arranges the test. Selection is a possible last preparation.
    for (const op of state.active === mobile ? [...ops, 'select'] : ['select']) {
      const command = op === 'select' ? pointCommand(s.grid, state.subjects[peer(state.active)]) : op;
      const ticket = key(state) + '|' + command;
      if (m.denied[ticket] || m.checked.includes('operand/' + ticket)) continue;
      const next = imagine(s, space, state, op, m, law(m, state.active));
      if (!next || next.subjects[side] !== need.site || next.pieces.length !== v.pieces.length) continue;
      if (parked && !s.goals.includes(next.subjects[mobile])) continue;
      const id = key(next), cost = n.depth + 1;
      if ((seen.get(id) ?? Infinity) <= cost) continue;
      seen.set(id, cost);
      queue.push({ pose: next, previous: n, op, depth: cost, rank: cost + score(next) });
    }
  }
}

export type StrandedPartner = { side: TransportSide; site: number; witness: string };
