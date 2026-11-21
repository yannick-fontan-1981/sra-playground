import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import type { VisualLayout } from './witnessed-preview-transfer.ts';
import {
  pairedScene,
  readPair,
  picture,
  type Scene,
  type Reading,
} from './paired-scene.ts';
import {
  fresh,
  key,
  localEffects,
  type Learning,
} from './paired-displacements.ts';
import { planDisplacements } from './plan-paired-displacements.ts';
import type { TransportForecast } from './transport-observations.ts';

export type ReusableEffects = Pick<
  Learning,
  'motors' | 'evidence' | 'refs' | 'radius' | 'carry'
> & { bodies: [number, number] };
export type PairInquiry = {
  scene?: Scene;
  reading?: Reading;
  learning: Learning;
  active?: string;
  initialChecked?: boolean;
  lesson?: ReusableEffects;
};
export function inquiry(lesson?: ReusableEffects): PairInquiry {
  return { learning: fresh(), lesson };
}
export function carryPair(
  q: PairInquiry,
  ref: string,
): ReusableEffects | undefined {
  if (!q.active || !q.scene || !q.learning.refs.length) return;
  const { motors, evidence, refs, radius } = q.learning;
  return {
    bodies: q.scene.bodies,
    motors: structuredClone(motors),
    evidence: structuredClone(evidence),
    refs: [...refs],
    radius,
    carry: ref,
  };
}
export function seePair(
  q: PairInquiry,
  layout: VisualLayout,
  b: NativeRows,
  a: NativeRows,
  op: string,
  ref: string,
  f?: TransportForecast,
  explainedByPlacement = false,
) {
  const click = op.startsWith('ACTION6:'),
    point = click
      ? (op.slice(8).split(',').map(Number) as [number, number])
      : undefined;
  if (!q.scene && (!q.initialChecked || point)) {
    q.scene =
      pairedScene(layout, b, point) ??
      (!q.initialChecked ? pairedScene(layout, b) : undefined);
    q.initialChecked = true;
  }
  if (!q.scene) return;
  const s = q.scene,
    before = picture(s.grid, b),
    after = picture(s.grid, a),
    old = readPair(s, before, q.reading),
    next = readPair(s, after, old);
  if (!old || !next) {
    if (f) {
      delete q.learning.plan;
      return 'subject_registration_ambiguous';
    }
    return;
  }
  const m = q.learning;
  q.reading = next;
  const previous = q.active;
  if (
    click &&
    old.active !== next.active &&
    old.subjects.every((p, i) => next.subjects[i] === p)
  ) {
    const target = next.subjects[next.active],
      w = s.grid.columns;
    const changes = before.flatMap((z, i) =>
      z !== after[i] && !old.subjects.includes(i) ? [i] : [],
    );
    const offsets = changes.map((p) => [
      (p % w) - (target % w),
      Math.floor(p / w) - Math.floor(target / w),
    ]);
    const radius = Math.max(
      0,
      ...offsets.map(([x, y]) => Math.max(Math.abs(x!), Math.abs(y!))),
    );
    if (
      !q.active &&
      offsets.length >= 4 &&
      radius > 0 &&
      offsets.filter(
        ([x, y]) => Math.max(Math.abs(x!), Math.abs(y!)) === radius,
      ).length >= Math.ceil(offsets.length * 0.75)
    ) {
      q.active = 'selection_exposes_a_spatial_scope';
      m.scope = ref;
      m.radius = radius;
    }
  }
  if (op === 'ACTION5' && !explainedByPlacement) {
    const changes = before.flatMap((z, i) => (z !== after[i] ? [i] : []));
    if (changes.length === 2) {
      const [i, j] = changes as [number, number];
      if (before[i] === after[j] && before[j] === after[i]) {
        const isMovable = (n: number) =>
          old.subjects.includes(n) || old.pieces.includes(n);
        const marker =
          isMovable(i) !== isMovable(j) ? (isMovable(i) ? j : i) : undefined;
        if (marker !== undefined) {
          m.special = { mark: before[marker]!, ref };
          q.active ??= 'an_operation_exchanges_a_marker_and_a_body';
          m.refs = [...m.refs.slice(-5), ref];
        }
      }
    }
  }
  if (m.special) {
    old.anchor = before.indexOf(m.special.mark);
    next.anchor = after.indexOf(m.special.mark);
    if (old.anchor >= 0 && !s.ground.includes(old.anchor))
      s.ground.push(old.anchor);
  }
  if (
    !previous &&
    q.active &&
    q.lesson?.bodies.every((ink, i) => ink === s.bodies[i])
  ) {
    const lesson = q.lesson;
    m.evidence = structuredClone(lesson.evidence);
    m.motors = { ...lesson.motors, ...m.motors };
    m.carry = lesson.carry;
    m.refs = [...lesson.refs.slice(-3), ...m.refs];
    delete q.lesson;
  }
  if (q.active) m.visits[key(next)] = (m.visits[key(next)] ?? 0) + 1;
  return localEffects(s, m, old, next, op, ref, f);
}
export function pairProposal(
  q: PairInquiry,
  ref: string,
  depth: number,
  budget: number,
) {
  if (!q.active || !q.scene || !q.reading) return;
  return planDisplacements(q.scene, q.learning, q.reading, ref, depth, budget);
}
