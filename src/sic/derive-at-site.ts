import type { NativeEntity, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Edge, Effect, Experiment, Memory, Pair } from './preparation-experiments.ts';

export type Anchor = { at: string; exterior: string };
export type Mark = { bare: string; prepared: string; origin: string };
type Capability = { actor: string; bareActor: string; dx: number; dy: number; newMotion: boolean };
export type Derivation = {
  kind: 'relocate' | 'carry';
  actor: string;
  site: string;
  trained: string;
  exterior: string;
  bareEffect: string;
  mark?: Mark;
  traveled: number;
  capability?: Capability;
};
function acquiredCapability(p: Pair): Capability | undefined {
  for (const v of p.after.effect.moves) {
    const bareActor = v.actor === p.first.mark?.prepared ? p.first.mark.bare : v.actor;
    const old = p.direct.effect.moves.find((m) => m.actor === bareActor);
    if (!old || old.dx !== v.dx || old.dy !== v.dy)
      return { actor: v.actor, bareActor, dx: v.dx, dy: v.dy, newMotion: !old };
  }
}
function isAbsent(cap: Capability | undefined, e: Effect, original: string) {
  if (!cap) return e.key === original;
  const move = e.moves.find((v) => v.actor === cap.bareActor);
  return cap.newMotion ? !move : !move || move.dx !== cap.dx || move.dy !== cap.dy;
}
function isPresent(cap: Capability | undefined, e: Effect, expected: string | undefined) {
  if (!cap) return e.key === expected;
  const move = e.moves.find((v) => v.actor === cap.actor);
  if (!move) return false;
  return cap.newMotion
    ? Math.sign(move.dx) === Math.sign(cap.dx) && Math.sign(move.dy) === Math.sign(cap.dy)
    : move.dx === cap.dx && move.dy === cap.dy;
}
const location = (e: NativeEntity) => e.position.join(',');
function relevant(e: NativeEntity, rows: NativeRows) {
  return !e.identity_ambiguous && e.area <= (rows.length * rows[0]!.length) / 3;
}
function outside(e: NativeEntity, rows: NativeRows) {
  let h = 2166136261,
    j = 1;
  const [l, t, r, b] = e.bbox;
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y]!.length; x++) {
      const n = x >= l && x <= r && y >= t && y <= b ? 263 : rows[y]![x]! + 1;
      h = Math.imul(h ^ n, 16777619);
      j = (Math.imul(j, 65599) + n) | 0;
    }
  return [rows.length, rows[0]!.length, l, t, r, b, h >>> 0, j >>> 0].join('/');
}
export function witnessAnchors(o: NativeObservation, rows: NativeRows, tracked: Set<string>, marked: Set<string>) {
  const by: Record<string, Anchor> = {};
  for (const e of o.entities)
    if (tracked.has(e.signature) && relevant(e, rows))
      by[e.signature] = { at: location(e), exterior: marked.has(e.signature) ? outside(e, rows) : '' };
  return by;
}
export function changedMark(b: NativeObservation, a: NativeObservation, rows: NativeRows): Mark | undefined {
  if (b.frame_hash === a.frame_hash) return;
  const before = new Set(b.entities.map((e) => e.signature)),
    after = new Set(a.entities.map((e) => e.signature));
  const fresh = new Map(
    a.entities.filter((e) => relevant(e, rows) && !before.has(e.signature)).map((e) => [e.bbox.join(','), e])
  );
  const changes = b.entities.filter(
    (e) => relevant(e, rows) && !after.has(e.signature) && fresh.has(e.bbox.join(','))
  );
  if (changes.length !== 1) return;
  const e = changes[0]!;
  return { bare: e.signature, prepared: fresh.get(e.bbox.join(','))!.signature, origin: location(e) };
}
function at(o: NativeObservation, id: string) {
  return o.entities.find((e) => !e.identity_ambiguous && e.signature === id);
}
const attempt = (p: Pair, kind: string, site: string) => 'derived:' + p.id + ':' + kind + ':' + site;
export function proposeDerivation(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  s: number,
  options: Set<string>,
  p: Pair
): Experiment | null {
  const rule = m.rules[p.id];
  if (!rule?.evaluations || !options.has(p.probe)) return null;
  const refs = [p.direct.ref, p.first.ref, p.after.ref, rule.verifiedAt!];
  const mark = p.first.mark;
  const capability = acquiredCapability(p);
  if (mark) {
    const carrier = at(o, mark.prepared);
    const acquired = m.activeMarks[mark.prepared];
    if (carrier && acquired?.op === p.prep && acquired.bare === mark.bare) {
      // Choose a site at which B was already measured with the unmodified carrier.
      const alternatives = m.edges.filter(
        (e) =>
          e.stable &&
          e.cmd === p.probe &&
          isAbsent(capability, e.effect, p.direct.effect.key) &&
          e.anchors[mark.bare]?.exterior &&
          e.anchors[mark.bare]!.at !== mark.origin
      );
      for (const baseline of alternatives) {
        const destination = baseline.anchors[mark.bare]!,
          id = attempt(p, 'carry', destination.at);
        if (m.attempts[id] || location(carrier) === destination.at) continue;
        const d: Derivation = {
          kind: 'carry',
          actor: mark.prepared,
          site: destination.at,
          trained: mark.origin,
          exterior: destination.exterior,
          bareEffect: baseline.effect.key,
          mark,
          traveled: 0,
          ...(capability ? { capability } : {}),
        };
        const x: Experiment = {
          phase: 'carry',
          origin: s,
          a: p.prep,
          b: p.probe,
          rule: p.id,
          expected: p.after.effect.key,
          derive: d,
          refs: [...refs, baseline.ref, acquired.revision],
        };
        const step = carryStep(m, o, rows, options, x);
        if (step) return step;
      }
    }
  }
  const actor = p.first.effect.moves[0]?.actor ?? p.after.effect.moves[0]?.actor ?? mark?.bare;
  if (!actor || !options.has(p.prep)) return null;
  const e = at(o, actor),
    origin = p.first.anchors[actor]?.at;
  if (!e || !origin || location(e) === origin) return null;
  const site = location(e),
    id = attempt(p, 'relocate', site);
  if (m.attempts[id]) return null;
  const baseline = m.edges.find((edge) => edge.s === s && edge.cmd === p.probe && edge.stable);
  if (baseline && !isAbsent(capability, baseline.effect, p.direct.effect.key)) return null;
  const observedA = m.edges.find((edge) => edge.s === s && edge.cmd === p.prep);
  if (observedA && (!observedA.stable || observedA.effect.key !== p.first.effect.key)) return null;
  const d: Derivation = {
    kind: 'relocate',
    actor,
    trained: origin,
    site,
    exterior: '',
    bareEffect: baseline?.effect.key ?? p.direct.effect.key,
    traveled: 0,
    ...(capability ? { capability } : {}),
  };
  return {
    phase: baseline ? 'deriveA' : 'deriveControl',
    origin: s,
    a: p.prep,
    b: p.probe,
    rule: p.id,
    expected: p.after.effect.key,
    prepEffect: p.first.effect.key,
    derive: d,
    refs: baseline ? [...refs, baseline.ref] : refs,
  };
}
export function carryStep(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  options: Set<string>,
  x: Experiment
): Experiment | null {
  const g = x.derive!,
    carrier = at(o, g.actor);
  if (!carrier || g.traveled >= 16) return null;
  const current = location(carrier);
  if (current === g.site)
    return g.traveled > 0 && outside(carrier, rows) === g.exterior && options.has(x.b)
      ? { ...x, phase: 'carryB' }
      : null;
  const [tx, ty] = g.site.split(',').map(Number),
    [cx, cy] = carrier.position;
  const distance = Math.abs(tx! - cx) + Math.abs(ty! - cy);
  const actions = m.edges
    .filter((e) => e.stable && options.has(e.cmd))
    .flatMap((e) =>
      e.effect.moves
        .filter((v) => v.actor === g.actor || v.actor === g.mark?.bare)
        .map((v) => ({
          op: e.cmd,
          next: Math.abs(tx! - cx - v.dx) + Math.abs(ty! - cy - v.dy),
          proved: v.actor === g.actor,
        }))
    )
    .filter((v) => v.next < distance)
    .sort((a, b) => a.next - b.next || Number(b.proved) - Number(a.proved));
  return actions.length ? { ...x, phase: 'carry', a: actions[0]!.op } : null;
}
export function derivationReceipt(
  m: Memory,
  x: Experiment,
  e: Edge,
  effect: string,
  old: NativeObservation,
  next: NativeObservation
) {
  const d = x.derive!;
  const id = 'derived:' + x.rule + ':' + d.kind + ':' + d.site;
  if (x.phase === 'deriveControl') {
    const absent = e.stable && isAbsent(d.capability, e.effect, d.bareEffect);
    if (!absent) m.attempts[id] = 1;
    else
      m.derivationOrigin = {
        ...x,
        phase: 'deriveA',
        derive: { ...d, bareEffect: effect },
        refs: [...x.refs, next.revision],
      };
    return absent ? 'independent_baseline' : 'baseline_differs';
  }
  if (x.phase === 'deriveA') {
    m.derivationOrigin = null;
    m.attempts[id] = 1;
    if (e.stable && effect === x.prepEffect) {
      m.pending = { ...x, phase: 'deriveB', refs: [...x.refs, next.revision] };
      return 'change_recreated';
    }
    return 'change_not_recreated';
  }
  if (x.phase === 'carry') {
    m.attempts[id] = 1;
    const a = at(old, d.actor),
      b = at(next, d.actor);
    if (!a || !b || location(a) === location(b)) return 'transport_failed';
    m.pending = { ...x, derive: { ...d, traveled: d.traveled + 1 }, refs: [...x.refs.slice(0, 6), next.revision] };
    return 'change_preserved_in_motion';
  }
  if (e.stable && isPresent(d.capability, e.effect, x.expected) && effect !== d.bareEffect) {
    m.pending = { ...x, phase: 'explore', refs: [...x.refs, next.revision] };
    return x.phase === 'carryB' ? 'transport_prediction_verified' : 'derived_prediction_verified';
  }
  return 'derived_prediction_refuted';
}
