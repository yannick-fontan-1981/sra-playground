/** Pinned queued_field_models: acquired control effects and compatible closure hypotheses. */
import { measureQueuedField, queuedFieldBoard } from './v6-queued-field-observation.ts';
import { queuedFieldClosure, queuedFieldModels, queuedFieldPlacement } from './v6-queued-field-mechanics.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const uniqueNumbers = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);

export function queueTranslationPremise(key: string, field: unknown, members: readonly number[], column: number, action: string): string {
  return identity([key, field, [...members], column, action]);
}

export function activeQueueMemberCount(state: R | null): number | null {
  if (!truth(state)) return null;
  const values = new Set<number>();
  for (const law of Object.values(state!.controls ?? {}) as R[]) if (law.kind === 'reorder') for (const permutation of law.permutations as number[][]) values.add(permutation.length);
  if (state!.active_member_count !== null && state!.active_member_count !== undefined) values.add(state!.active_member_count);
  return values.size === 1 ? [...values][0]! : null;
}

export function portableQueueHypothesis(previous: R | null, scene: R, observation: R): R | null {
  if (!truth(previous) || previous!.epoch === observation.level_epoch || !truth(scene.mark)) return null;
  const count = activeQueueMemberCount(previous);
  if (count === null || count !== scene.mark.values.length) return null;
  if (['size', 'pitch'].some(key => !equal(previous!.geometry[key], scene.geometry[key]))) return null;
  if (!truth(previous!.closure_models) || scene.empty_appearance_hypothesis === null) return null;
  const controls: R = Object.fromEntries(Object.entries(previous!.controls as R).filter(([action]) => observation.available_action_refs.includes(action))
    .map(([action, law]) => [action, { ...structuredClone(law), acquisition_epoch: law.acquisition_epoch ?? previous!.epoch, status: 'portable_hypothesis_pending_revalidation' }]));
  if (!(Object.values(controls) as R[]).some(law => law.kind === 'receive')) return null;
  return { key: identity([observation.level_epoch, scene.geometry]), epoch: observation.level_epoch, geometry: scene.geometry,
    controls, gravity: previous!.gravity, empty: scene.empty_appearance_hypothesis, active_member_count: count,
    closure_models: structuredClone(previous!.closure_models), closure_status: 'portable_hypotheses_pending_current_receipt',
    closure_acquisition_epoch: previous!.closure_acquisition_epoch ?? previous!.epoch,
    preview_orientations: structuredClone(previous!.preview_orientations ?? []),
    evidence: [...previous!.evidence, observation.observation_ref], restorations: [], attempts: [], refuted_translations: [],
    transfer_scope: { source_epoch: previous!.epoch, current_epoch: observation.level_epoch,
      source_relation_digest: identity([previous!.controls, previous!.closure_models]),
      premises: ['same measured cell size and pitch', 'same controlled member cardinality', 'currently available input', 'current field and preview measured again'],
      authority: 'conditional prediction to revalidate; no board, coordinates or terminal quota transferred' } };
}

/** Lexicographic permutations satisfying the observed values, equivalent to source filtering. */
function matchingPermutations(first: number[], second: number[]): number[][] {
  const result: number[][] = [], used = new Set<number>();
  function visit(prefix: number[]): void {
    if (prefix.length === first.length) { result.push(prefix); return; }
    for (let i = 0; i < first.length; i++) if (!used.has(i) && first[i] === second[prefix.length]) {
      used.add(i); visit([...prefix, i]); used.delete(i);
    }
  }
  visit([]); return result;
}

export function acquireQueuedField(previous: R | null, before: R, after: R, command: R, rows: NativeRows, later: NativeRows, frames: readonly NativeRows[]): R | null {
  const prior = previous && previous.epoch === before.level_epoch ? previous : null;
  const count = activeQueueMemberCount(prior), a = measureQueuedField(rows, prior ? prior.geometry : null, count);
  const b = a ? measureQueuedField(later, a.geometry, count ?? (a.mark ? a.mark.values.length : null)) : null;
  if (!a || !a.mark || !truth(a.preview_alternatives)) return null;
  const epoch = before.level_epoch, key = identity([epoch, a.geometry]);
  // Acquisition owns its result; no earlier immutable journal event is mutated.
  let state: R = structuredClone(previous ?? {});
  if (state.key !== key) {
    const inherited = Object.fromEntries(['controls', 'gravity', 'closure_models', 'preview_orientations'].filter(k => Object.hasOwn(state, k)).map(k => [k, state[k]]));
    state = { key, epoch, geometry: a.geometry, controls: {}, evidence: [], prior_hypotheses: inherited, restorations: [], attempts: [], refuted_translations: [] };
  }
  state.evidence = [...state.evidence, before.observation_ref, after.observation_ref];
  const empty = Object.hasOwn(state, 'empty') ? state.empty : a.empty_appearance_hypothesis;
  if (empty === null) return state;
  const initial = queuedFieldBoard(a, empty), mark = a.mark, action: string = command.action_ref;
  const phases = frames.map(frame => measureQueuedField(frame, a.geometry, mark.values.length));
  state.attempts = [...state.attempts ?? [], identity([a.grid, mark.column, command])];
  const receipts: { gravity: number; index: number; placed: (number | null)[][] }[] = [];
  for (const gravity of [-1, 1]) {
    const placed = queuedFieldPlacement(initial, mark.values, mark.column, gravity);
    if (placed === null) continue;
    for (const [index, phase] of phases.entries()) {
      if (phase && !phase.mark && equal(phase.grid, placed.map(row => row.map(value => value === null ? empty : value)))) {
        receipts.push({ gravity, index, placed }); break;
      }
    }
  }
  if (receipts.length === 1) {
    const { gravity, index, placed } = receipts[0]!;
    state.gravity = gravity; state.empty = empty; state.active_member_count = mark.values.length;
    state.controls[action] = { kind: 'receive', phase_index: index, evidence: [before.observation_ref, after.observation_ref] };
    if (b && b.mark && after.level_epoch === epoch) {
      const final = queuedFieldBoard(b, empty), candidates: R[] = state.closure_models ?? queuedFieldModels(a.geometry.shape, gravity);
      let fitting = candidates.filter(model => equal(queuedFieldClosure(placed, model).board, final));
      const preview = (a.preview_alternatives as R[]).filter(p => p.members.length && equal(p.members[0], b.mark.values)
        && (b.preview_alternatives as R[]).some(q => equal(q.orientation, p.orientation) && equal(q.members, p.members.slice(1)))).map(p => p.orientation);
      const returned = equal(initial, final) && equal(a.preview_alternatives, b.preview_alternatives);
      if (!returned && truth(state.closure_models)) {
        const eliminated = candidates.filter(model => !fitting.some(item => equal(item, model)));
        if (eliminated.length) state.closure_counterexamples = [...state.closure_counterexamples ?? [], { model_refs: eliminated.map(model => identity(model)),
          evidence: [before.observation_ref, after.observation_ref], source_epoch: state.closure_acquisition_epoch ?? epoch, current_epoch: epoch }];
        if (!fitting.length) {
          fitting = queuedFieldModels(a.geometry.shape, gravity).filter(model => equal(queuedFieldClosure(placed, model).board, final));
          state.closure_models = fitting; state.closure_acquisition_epoch = epoch; state.closure_incompatible = !fitting.length;
          state.closure_status = fitting.length ? 'current_reconstruction_after_refutation' : 'no_library_closure_explains_current_receipt';
        }
      }
      if (returned || !fitting.length) {
        state.restorations.push({ board: initial, bundle: mark.values, column: mark.column, returned_to_prior_field: returned,
          evidence: [before.observation_ref, after.observation_ref] });
      } else {
        state.closure_models = fitting; state.closure_status = 'compatible_public_closure_models';
        state.last_removed = mark.values.length + initial.flat().filter(value => value !== null).length - final.flat().filter(value => value !== null).length;
        if (!Object.hasOwn(state, 'closure_acquisition_epoch')) state.closure_acquisition_epoch = epoch;
        state.spawn_column_observed = b.mark.column;
        if (preview.length) state.preview_orientations = preview;
      }
    }
    state.last_transition = 'received_then_automatic_or_return_unknown';
  } else if (b && b.mark && after.level_epoch === epoch && frames.length <= 1 && equal(queuedFieldBoard(b, empty), initial)) {
    const first: number[] = mark.values, second: number[] = b.mark.values, dx = b.mark.column - mark.column;
    let old = state.controls[action];
    if (old && old.kind === 'translate' && !dx && equal(a.grid, b.grid)) {
      state.refuted_translations = [...state.refuted_translations ?? [], { premise_ref: queueTranslationPremise(key, initial, first, mark.column, action),
        evidence: [before.observation_ref, after.observation_ref],
        scope: 'Same epoch, measured field, ordered members, origin and input; stationarity refutes this displacement prediction, not all mechanisms of contact.' }];
    }
    if (equal(first, second) && dx) {
      const vacated = (mark.rows as number[]).map(j => b.grid[j][mark.column]);
      if (uniqueNumbers(vacated).length === 1 && vacated[0] === empty) {
        state.empty = empty; state.controls[action] = { kind: 'translate', delta: dx, evidence: [before.observation_ref, after.observation_ref] };
        state.active_member_count = mark.values.length;
      }
    } else if (!dx && !equal(first, second) && equal([...first].sort((x, y) => x - y), [...second].sort((x, y) => x - y))) {
      let possible = matchingPermutations(first, second); old = state.controls[action];
      if (old?.kind === 'reorder') possible = possible.filter(permutation => (old.permutations as number[][]).some(item => equal(item, permutation)));
      state.controls[action] = { kind: 'reorder', permutations: possible, evidence: [before.observation_ref, after.observation_ref] };
    }
    state.last_transition = 'single_public_preparation';
  } else state.last_transition = 'unexplained_or_boundary';
  if (state.controls[action] && equal(state.controls[action].evidence, [before.observation_ref, after.observation_ref])) {
    const law = state.controls[action], old = previous?.controls?.[action] ?? {};
    law.acquisition_epoch = old.acquisition_epoch ?? epoch; law.revalidated_epoch = epoch; law.status = 'observed_current_relation';
    const contradicted = truth(old) && (old.kind !== law.kind || law.kind === 'translate' && old.delta !== law.delta || law.kind === 'reorder' && !law.permutations.length);
    if (contradicted) {
      state.control_counterexamples = [...state.control_counterexamples ?? [], { action, prior_relation: old, observed_relation: structuredClone(law),
        evidence: [before.observation_ref, after.observation_ref] }];
      if (law.kind === 'reorder' && !law.permutations.length) law.status = 'refuted_current';
    }
  }
  if (truth(state.transfer_scope)) state.transfer_scope = { ...state.transfer_scope, last_current_observation: after.observation_ref, last_revalidation: state.last_transition };
  return state;
}
