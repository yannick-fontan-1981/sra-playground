import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import { pathToContact } from './mechanism-contact-routes.ts';
import { aligned, anchoredSamples, controlledStrokes } from './controlled-parts.ts';
import { reachablePreviewConfigurations, type LayoutStep } from './reachable-preview-configurations.ts';
import { visualLayout } from './witnessed-preview-transfer.ts';
import type { Memory } from './preparation-experiments.ts';
import type { MechanismPlan } from './reconfigure-local-mechanism.ts';

const key = (p: XY) => p.join();
export function plansForWitnessedSubjects(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>
) {
  const learning = m.previewLearning,
    layout = visualLayout(o, rows),
    plans: { plan: MechanismPlan; rank: number }[] = [];
  if (!learning?.partMotion) return plans;
  const seen = new Set<string>();
  for (const b of Object.values(learning.bindings).sort(
    (a, b) => (b.calibration?.hit ?? 0) - (a.calibration?.hit ?? 0)
  )) {
    const stats = learning.partMotion[b.actor],
      bodies = layout[b.actor],
      q = b.gesture.op;
    if (!stats || !bodies?.length || !available.has(q) || b.gesture.point) continue;
    const last = learning.lastActor[b.actor],
      body = bodies.length === 1 ? bodies[0] : bodies.find((x) => last && same(x.at, last));
    if (!body) continue;
    const p = body.at,
      peers = bodies.filter((x) => x !== body).map((x) => x.at),
      motors = controlledStrokes(stats, available, q),
      horizontal = motors.find((x) => x.d[0]),
      vertical = motors.find((x) => x.d[1]);
    if (!horizontal || !vertical) continue;
    const pitch: XY = [size(horizontal.d), size(vertical.d)];
    const ranked = Object.entries(stats.substrate).sort((a, b) => b[1] - a[1]);
    if (!ranked[0] || ranked[0][1] * 2 <= ranked.reduce((n, x) => n + x[1], 0)) continue;
    const ground = Number(ranked[0][0]),
      remaining = new Set(peers.map(key));
    const open = (at: XY) => {
      if (
        at[0] < 0 ||
        at[1] < 0 ||
        at[0] >= 2 * rows[0]!.length ||
        at[1] >= 2 * rows.length ||
        remaining.has(key(at))
      )
        return false;
      if (
        stats.sites[key(at)] !== undefined ||
        rows[Math.floor(at[1] / 2)]![Math.floor(at[0] / 2)] === ground
      )
        return true;
      // A small foreground part may cover the centre. Check the surrounding footprint on this lattice.
      const x0 = Math.ceil((at[0] - pitch[0] / 2) / 2),
        y0 = Math.ceil((at[1] - pitch[1] / 2) / 2);
      let n = 0,
        hits = 0;
      for (let y = y0; y < (at[1] + pitch[1] / 2) / 2; y++)
        for (let x = x0; x < (at[0] + pitch[0] / 2) / 2; x++) {
          const c = rows[y]?.[x];
          if (c === undefined) continue;
          n++;
          if (c === ground) hits++;
        }
      return hits * 2 > n;
    };
    for (const role of new Set(b.witnesses.flatMap((w) => (w.geometry?.pivots ?? []).map((v) => v.role)))) {
      const sites = layout[role];
      if (!sites || sites.length > 12) continue;
      const examples = anchoredSamples(b.witnesses, role, p, pitch);
      if (!examples.length) continue;
      const variety = new Set(examples.map((x) => diff(x.actor, x.centre).join())).size;
      for (const site of sites) {
        const c = aligned(site.at, p, pitch),
          offset = diff(site.at, c),
          fixed = sites.filter((z) => z !== site).map((z) => z.at);
        if (
          same(c, p) ||
          remaining.has(key(c)) ||
          Math.abs(offset[0]) * 2 === pitch[0] ||
          Math.abs(offset[1]) * 2 === pitch[1]
        )
          continue;
        const k = JSON.stringify([b.actor, b.indicator, q, role, site.at]);
        if (seen.has(k)) continue;
        seen.add(k);
        const allowed = (point: XY) => same(point, c) || open(point);
        const home = new Set([key(p)]),
          walk = [p];
        for (const u of walk)
          for (const motor of motors) {
            const v = add(u, motor.d);
            if (!same(v, c) && allowed(v) && !home.has(key(v))) {
              home.add(key(v));
              walk.push(v);
            }
          }
        if (!motors.some((v) => home.has(key(diff(c, v.d))))) continue;
        const real = (step: LayoutStep): LayoutStep => ({
          ...step,
          c: add(step.c, offset),
          placed: add(step.placed, offset),
        });
        const failures = m.localProgress?.attempts ?? {};
        const denied = (step: LayoutStep) =>
          step.stage === 'write' &&
          failures[
            JSON.stringify(['failed_contact', b.actor, role, fixed, step.p, add(step.c, offset), step.op])
          ] !== undefined;
        const witness = b.witnesses
          .slice()
          .reverse()
          .find((w) => w.geometry?.pivots.some((z) => z.role === role))!;
        const common = {
          p: b.actor,
          c: role,
          actorPeers: peers,
          indicatorOffset: diff(witness.indicated, witness.arrived),
          witnessRefs: [witness.before, witness.after],
          fixed,
          start: p,
          initialC: site.at,
          support: [],
          home: home.size,
        };
        const confidence = Math.min(8, variety * 2) + Math.min(6, b.calibration?.hit ?? 0);
        for (const option of pathToContact(p, c, motors, allowed)) {
          const write = option.path.at(-1)!;
          if (denied(write)) continue;
          const steps = option.path.map(real),
            placement = add(write.placed, offset),
            attempt = JSON.stringify([k, placement, write.p, write.op]);
          if (failures[attempt] !== undefined) continue;
          plans.push({
            plan: {
              ...common,
              placed: placement,
              launch: null,
              arrival: null,
              use: null,
              indicator: null,
              steps,
              key: attempt,
              basis: 'test_displacement',
              otherSetups: option.possible,
              opensCells: option.opened,
              recoverable: option.recoverable,
            },
            rank:
              30 +
              confidence +
              4 * Number(option.recoverable) +
              Math.min(4, option.possible) +
              Math.min(6, option.opened) -
              Math.log2(1 + steps.length),
          });
        }
        const calc = reachablePreviewConfigurations({
          actor: p,
          centre: c,
          motors: motors.map((z) => ({ ...z, ref: 0 })),
          op: q,
          patterns: examples,
          otherCentres: fixed.map((z) => aligned(z, p, pitch)),
          passable: allowed,
          readWitnessed: true,
          allowWrites: true,
          stateLimit: Math.min(4096, rows.length * rows[0]!.length * 2),
          attempted: denied,
        });
        for (const variant of calc.configurations.slice(0, 12)) {
          const steps = variant.steps.map(real),
            placement = add(variant.placed, offset);
          const attempt = JSON.stringify([k, p, placement, variant.launch, variant.arrival]);
          if (failures[attempt] !== undefined) continue;
          plans.push({
            plan: {
              ...common,
              placed: placement,
              launch: variant.launch,
              arrival: variant.arrival,
              use: variant.continuation,
              indicator: b.indicator,
              steps,
              key: attempt,
              basis: 'move_to_change_access',
              support: [],
              home: calc.home.size,
              otherSetups: calc.configurations.length,
              opensCells: variant.gain,
              recoverable: false,
            },
            rank: 96 + confidence + Math.min(6, variant.gain) - Math.log2(1 + steps.length),
          });
        }
      }
    }
  }
  return plans;
}
