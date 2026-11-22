import { watchPassage, recallProjectedPassage } from './prepare-projected-passage.ts';
import {
  visibleImages,
  applyImages,
  recognizeProjection,
} from './paired-previews.ts';
import { forecast } from './paired-displacements.ts';
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
  | 'motors'
  | 'evidence'
  | 'refs'
  | 'radius'
  | 'carry'
  | 'projections'
  | 'mobileSupports'
> & { bodies: [number, number]; selectionWitness?: string };
export type PairInquiry = {
  scene?: Scene;
  reading?: Reading;
  learning: Learning;
  active?: string;
  initialChecked?: boolean;
  lesson?: ReusableEffects;
  rebindAttempt?: string;
  selectionWitness?: string;
};
export function inquiry(lesson?: ReusableEffects): PairInquiry {
  return { learning: fresh(), ...(lesson ? { lesson } : {}) };
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
    ...(q.selectionWitness ? { selectionWitness: q.selectionWitness } : {}),
    ...(q.learning.projections?.length
      ? { projections: structuredClone(q.learning.projections) }
      : {}),
    ...(q.learning.mobileSupports
      ? { mobileSupports: q.learning.mobileSupports }
      : {}),
  };
}
export function proposeLessonTest(
  q: PairInquiry,
  layout: VisualLayout,
  rows: NativeRows,
  ref: string,
) {
  const lesson = q.lesson;
  if (
    q.active ||
    q.rebindAttempt ||
    !lesson?.carry ||
    (!lesson.projections?.length && !lesson.radius && !lesson.selectionWitness)
  )
    return;
  const scene = pairedScene(layout, rows, undefined, lesson.bodies);
  if (!scene) return;
  const tiles = picture(scene.grid, rows),
    v = readPair(scene, tiles);
  if (!v) return;
  const hypotheses = visibleImages(scene, v, tiles).filter((im) =>
    lesson.projections?.some(
      (r) =>
        r.pivotForm === scene.initial[im.pivot] &&
        ((r.from === im.dir && r.to === im.out) ||
          (r.from === im.out && r.to === im.dir)),
    ),
  );
  if (!hypotheses.length && !lesson.radius && !lesson.selectionWitness) return;
  q.scene = scene;
  const test = forecast(
    scene,
    q.learning,
    v,
    { ...v, active: v.active === 0 ? 1 : 0 },
    'select',
    hypotheses.length
      ? 'reidentify_the_partner_of_a_previously_verified_projection'
      : lesson.radius
        ? 'retest_the_scope_of_the_other_subject_in_a_new_room'
        : 'retest_a_witnessed_selection_before_using_the_new_subject',
    [
      'the_other_registered_subject_acquires_control',
      'the_displayed_landing_can_be_checked_next',
    ],
    ref,
  );
  test.evidence.push(lesson.carry);
  if (lesson.selectionWitness) test.evidence.push(lesson.selectionWitness);
  test.paired!.lesson = lesson.carry;
  return test;
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
  if (click && q.lesson?.carry && f?.paired?.lesson === q.lesson.carry)
    q.rebindAttempt = ref;
  if (!q.scene && (!q.initialChecked || point)) {
    const scene =
      pairedScene(layout, b, point) ??
      (!q.initialChecked ? pairedScene(layout, b) : undefined);
    if (scene) q.scene = scene;
    q.initialChecked = true;
  }
  if (point && q.scene) {
    const g = q.scene.grid,
      col = Math.floor((point[0] - g.left) / g.pitch),
      row = Math.floor((point[1] - g.top) / g.pitch);
    const selected = row * g.columns + col;
    const x = g.left + col * g.pitch,
      y = g.top + row * g.pitch;
    const changed =
      col >= 0 &&
      col < g.columns &&
      row >= 0 &&
      row < g.rows &&
      b
        .slice(y, y + g.pitch)
        .some((line, j) =>
          line
            .slice(x, x + g.pitch)
            .some((ink, i) => a[y + j]?.[x + i] !== ink),
        );
    const proposed =
      changed && !q.reading?.subjects.includes(selected)
        ? pairedScene(layout, b, point)
        : undefined;
    if (
      proposed &&
      !proposed.bodies.every((ink) => q.scene!.bodies.includes(ink))
    ) {
      const old = readPair(proposed, picture(proposed.grid, b));
      const next = old && readPair(proposed, picture(proposed.grid, a), old);
      if (
        old &&
        next &&
        old.active === 0 &&
        next.active === 1 &&
        old.subjects.every((p, i) => next.subjects[i] === p)
      ) {
        // A confirmed transfer of the mark disambiguates a subject from an
        // equally shaped indicator. Old physical effects refer to other bodies.
        q.scene = proposed;
        q.learning = fresh();
        delete q.reading;
        delete q.active;
        delete q.selectionWitness;
      }
    }
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
  watchPassage(s, m, old, next, after, ref, op);
  const previous = q.active;
  if (
    f?.purpose ===
      'reidentify_the_partner_of_a_previously_verified_projection' ||
    f?.purpose === 'retest_the_scope_of_the_other_subject_in_a_new_room' ||
    f?.purpose === 'retest_a_witnessed_selection_before_using_the_new_subject'
  ) {
    q.rebindAttempt = ref;
    if (
      (f.purpose === 'reidentify_the_partner_of_a_previously_verified_projection' ||
        f.purpose === 'retest_a_witnessed_selection_before_using_the_new_subject') &&
      click &&
      old.active !== next.active &&
      old.subjects.every((p, i) => next.subjects[i] === p)
    )
      q.active = 'known_subjects_reidentified_after_room_change';
  }
  if (
    click &&
    old.active !== next.active &&
    old.subjects.every((p, i) => next.subjects[i] === p)
  ) {
    const target = next.subjects[next.active],
      w = s.grid.columns;
    if (!explainedByPlacement && point &&
        Math.floor((point[0] - s.grid.left) / s.grid.pitch) === target % w &&
        Math.floor((point[1] - s.grid.top) / s.grid.pitch) === Math.floor(target / w)) {
      q.selectionWitness = ref;
    }
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
  if (
    click &&
    s.partialContext &&
    !explainedByPlacement &&
    old.active !== next.active &&
    old.subjects.every((site, i) => next.subjects[i] === site)
  ) {
    q.active ??=
      'selection_moves_a_distinctive_mark_between_stationary_subjects';
    if (!m.refs.includes(ref)) m.refs = [...m.refs.slice(-5), ref];
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
  if (op === 'ACTION5' && !explainedByPlacement) {
    const learned = recognizeProjection(s, old, next, before, ref);
    for (const r of learned) {
      const registered = (m.projections ??= []);
      if (
        !registered.some(
          (k) =>
            k.pivotForm === r.pivotForm &&
            ((k.from === r.from && k.to === r.to) ||
              (k.from === r.to && k.to === r.from)),
        )
      )
        registered.push(r);
      q.active ??= 'an_operation_realizes_a_projected_displacement';
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
    // Reacquiring a stationary subject certifies selection only. The command
    // axes and contact laws still need their own local tests in the new room.
    if (f?.purpose !== 'retest_a_witnessed_selection_before_using_the_new_subject') {
      m.evidence = structuredClone(lesson.evidence);
      m.motors = { ...lesson.motors, ...m.motors };
    }
    if (lesson.projections && !m.projections?.length) {
      const visible = visibleImages(s, next, after);
      const matched = lesson.projections.filter((r) =>
        visible.some(
          (im) =>
            s.initial[im.pivot] === r.pivotForm &&
            ((im.dir === r.from && im.out === r.to) ||
              (im.dir === r.to && im.out === r.from)),
        ),
      );
      if (matched.length) m.projections = structuredClone(matched);
    }
    if (lesson.mobileSupports && m.scope && m.radius === lesson.radius)
      m.mobileSupports = lesson.mobileSupports;
    m.carry = lesson.carry;
    m.refs = [...lesson.refs.slice(-3), ...m.refs];
    delete q.lesson;
  }
  if (m.projections?.length) {
    const shown = visibleImages(s, next, after).filter((im) =>
      m.projections!.some(
        (r) =>
          r.pivotForm === s.initial[im.pivot] &&
          ((r.from === im.dir && r.to === im.out) ||
            (r.from === im.out && r.to === im.dir)),
      ),
    );
    m.previewPose = key(next);
    const actual = applyImages(next, shown);
    if (actual) m.visibleEffect = actual;
    else delete m.visibleEffect;
    for (const im of shown)
      for (const r of m.projections)
        if (r.pivotForm === s.initial[im.pivot]) {
          const w = s.grid.columns,
            dist =
              Math.abs((im.pivot % w) - (im.source % w)) +
              Math.abs(Math.floor(im.pivot / w) - Math.floor(im.source / w));
          r.witnessedReach = Math.max(r.witnessedReach ?? 0, dist);
        }
  }
  if (q.active) {
    const mobile = new Set(m.mobileForms ?? []);
    for (const form of new Set(s.other.map((p) => s.initial[p]!))) {
      if (
        s.other.filter((p) => s.initial[p] === form).length < 2 ||
        m.projections?.some((r) => r.pivotForm === form)
      )
        continue;
      const prior = before.flatMap((k, i) => (k === form ? [i] : [])),
        now = after.flatMap((k, i) => (k === form ? [i] : []));
      if (prior.length === now.length && prior.some((p) => !now.includes(p)))
        mobile.add(form);
    }
    m.mobileForms = [...mobile];
    m.avoid = after.flatMap((k, i) => (mobile.has(k) ? [i] : []));
  }
  delete m.imageTrial;
  if (
    q.active ||
    (click && old.active !== next.active && !explainedByPlacement)
  ) {
    const candidates = visibleImages(s, next, after);
    const trial = applyImages(next, candidates);
    if (
      trial &&
      !m.projections?.length &&
      !m.checked.includes('preview/' + key(next))
    ) {
      q.active ??= 'compare_an_indicated_landing_to_an_actual_operation';
      m.imageTrial = trial;
    }
  }
  if (q.active) m.visits[key(next)] = (m.visits[key(next)] ?? 0) + 1;
  const recalled = recallProjectedPassage(s, m, next, after);
  if (recalled) {
    m.passage = recalled;
    delete m.plan;
    watchPassage(s, m, old, next, after, ref, op);
  }
  return localEffects(s, m, old, next, op, ref, f);
}
export function pairProposal(
  q: PairInquiry,
  ref: string,
  depth: number,
  budget: number,
) {
  if (!q.active || !q.scene || !q.reading) return;
  if (
    q.learning.imageTrial &&
    !q.learning.checked.includes('preview/' + key(q.reading))
  ) {
    q.learning.checked.push('preview/' + key(q.reading));
    return forecast(
      q.scene,
      q.learning,
      q.reading,
      q.learning.imageTrial,
      'ACTION5',
      'test_whether_a_public_image_predicts_the_landing',
      ['the_named_body_arrives_at_the_visible_image'],
      ref,
    );
  }
  return planDisplacements(q.scene, q.learning, q.reading, ref, depth, budget);
}
