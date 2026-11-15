import { cellPatchCenter, cellPatchChanges, measureCellPatchFields, projectCellPatch,
  type CellPatchGeometry } from '../logos-engine/v6-cell-patch-observation.ts';
import { lineWindows, NativeLineSearchDomainError, NativeLineSearchWorkBoundError, searchLines } from '../logos-engine/v6-supported-lines.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const observedLinePlacementId = 'sic_prepare_line_from_observed_responses';
export const observedLineStrategies = {
  prepare_line_against_response: 'Place a mark while accounting for the observed reply',
  verify_resized_marks: 'Check the learned mark roles on the new layout',
  contrast_equivalent_line_preparation: 'Test a different equally ranked placement after an observed return',
  complete_observed_line: 'Place the final mark of a line',
} as const;

type Field = { geometry: CellPatchGeometry; grid: string[][] };
type MarkRoles = { own: string; other: string; empty: string };
type Marks = MarkRoles & { refs: string[]; colors?: MarkRoles };
type Training = { epoch: number; fields: Field[]; model: Marks | null };
type Witness = { epoch: number; model: Marks; boundary: string };
type FieldStart = { geometry: CellPatchGeometry; initial: string };
type Local = { epoch: number; geometry: CellPatchGeometry; initial: string; tried: Record<string, number>; stopped: boolean;
  model?: Marks; needsConfirmation?: boolean; earlierFields?: FieldStart[] };
type Proposal = NativeProposal & { local: Local; model: Marks; field: Field; point: NativePoint; trial: string; needId: string };
const encode = (grid: readonly string[][]) => JSON.stringify(grid);
const samePoint = ([x, y]: readonly number[], [a, b]: readonly number[]) => x === a && y === b;

function cellBounds(geometry: CellPatchGeometry, [column, row]: NativePoint): NativeBox {
  const left = geometry.origin[0]! + column * geometry.pitch[0]!, top = geometry.origin[1]! + row * geometry.pitch[1]!;
  return [left, top, left + geometry.size[0]! - 1, top + geometry.size[1]! - 1];
}

function cellColors(geometry: CellPatchGeometry, point: NativePoint, rows: NativeRows): string {
  const [left, top, right, bottom] = cellBounds(geometry, point);
  const values = new Set(rows.slice(top, bottom + 1).flatMap(row => row.slice(left, right + 1)));
  return [...values].sort((a, b) => a - b).join(',');
}

function sampleMark(field: Field, mark: string): NativeBox | null {
  const row = field.grid.findIndex(line => line.includes(mark));
  return row < 0 ? null : cellBounds(field.geometry, [field.grid[row]!.indexOf(mark), row]);
}

function pointInField(field: Field, x: number, y: number): NativePoint | null {
  for (const [j, row] of field.grid.entries()) for (const [i] of row.entries()) {
    const [left, top, right, bottom] = cellBounds(field.geometry, [i, j]);
    if (left <= x && x <= right && top <= y && y <= bottom) return [i, j];
  }
  return null;
}

function placedAndAnswered(before: Field, rows: NativeRows, addressed: NativePoint) {
  const projected = projectCellPatch(rows, before.geometry);
  const changes = projected && cellPatchChanges(before, projected);
  if (changes?.length !== 2) return null;
  const local = changes.find(([x, y]) => samePoint([Number(x), Number(y)], addressed)), remote = changes.find(entry => entry !== local);
  if (!local || !remote || local[2] !== remote[2] || local[3] === remote[3]
    || typeof local[2] !== 'string' || typeof local[3] !== 'string' || typeof remote[3] !== 'string') return null;
  return { own: local[3], other: remote[3], empty: local[2], reply: [Number(remote[0]), Number(remote[1])] as NativePoint };
}

function fieldCandidates(rows: NativeRows): Field[] {
  return measureCellPatchFields(rows).filter(field => field.geometry.shape[0] * field.geometry.shape[1] <= 16) as Field[];
}

function fitMarkRoles(field: Field, rows: NativeRows, model: Marks): Marks | null {
  if (field.grid.every(row => row.every(value => value === model.own || value === model.other || value === model.empty))) return model;
  const colors = model.colors;
  if (!colors || new Set(Object.values(colors)).size !== 3) return null;
  const available = new Map<string, string>();
  for (const [y, row] of field.grid.entries()) for (const [x, token] of row.entries()) {
    const signature = cellColors(field.geometry, [x, y], rows);
    const existing = available.get(signature);
    if (existing !== undefined && existing !== token) return null;
    available.set(signature, token);
  }
  const own = available.get(colors.own), other = available.get(colors.other), empty = available.get(colors.empty);
  return available.size === 3 && own !== undefined && other !== undefined && empty !== undefined
    ? { ...model, own, other, empty } : null;
}

function completesLine(field: Field, point: NativePoint, mark: string): boolean {
  return lineWindows(field.grid, Math.min(...field.geometry.shape)).some(window => window.some(cell => samePoint(cell, point))
    && window.every(cell => samePoint(cell, point) || field.grid[cell[1]!]?.[cell[0]!] === mark));
}

function independentField(a: CellPatchGeometry, b: CellPatchGeometry): boolean {
  const [, , ar, ab] = cellBounds(a, [a.shape[0]! - 1, a.shape[1]! - 1]);
  const [, , br, bb] = cellBounds(b, [b.shape[0]! - 1, b.shape[1]! - 1]);
  return ar < b.origin[0]! || br < a.origin[0]! || ab < b.origin[1]! || bb < a.origin[1]!;
}

export function createSicObservedLinePlacement(): NativeFamily<Proposal> {
  let training: Training | null = null, witness: Witness | null = null, local: Local | null = null;
  const learnOutcome: NonNullable<NativeFamily<Proposal>['observePublicOutcome']> = (before, after, command, first, second) => {
    const { x, y } = command.data;
    if (command.action_ref !== 'ACTION6' || typeof x !== 'number' || typeof y !== 'number') return;
    learnPlacement(before, after, first, second, [x, y]);
  };
  function learnPlacement(before: NativeObservation, after: NativeObservation, first: NativeRows, second: NativeRows,
    [x, y]: NativePoint, selected?: Field) {
    if (training?.epoch !== before.level_epoch) training = { epoch: before.level_epoch, fields: selected ? [selected] : fieldCandidates(first), model: null };
    const fields = selected ? [selected] : training.fields;
    const addressed = fields.flatMap(field => {
      const current = projectCellPatch(first, field.geometry) as Field | null;
      const point = current && pointInField(current, x, y);
      return current && point ? [{ current, point }] : [];
    });
    if (addressed.length !== 1) return;
    const { current, point } = addressed[0]!, { model } = training;
    if (after.levels_completed > before.levels_completed) {
      if (!model || model.refs.length < 4 || current.grid[point[1]]?.[point[0]] !== model.empty) return;
      if (completesLine(current, point, model.own)) witness = { epoch: after.level_epoch, model, boundary: after.observation_ref };
      return;
    }
    if (before.level_epoch !== after.level_epoch) return;
    const measured = placedAndAnswered(current, second, point);
    if (!measured) return;
    const previous = model && measured.own === model.own && measured.other === model.other && measured.empty === model.empty ? model.refs : [];
    training.model = { own: measured.own, other: measured.other, empty: measured.empty,
      colors: { own: cellColors(current.geometry, point, second), other: cellColors(current.geometry, measured.reply, second),
        empty: cellColors(current.geometry, point, first) },
      refs: [...previous.slice(-4), before.observation_ref, after.observation_ref] };
  }
  const placementEffect = (proposal: Proposal, first: NativeRows, rows: NativeRows) => {
    const { local: state, model, field, point } = proposal;
    const current = projectCellPatch(rows, state.geometry);
    if (current && encode(current.grid) === state.initial) return { matched: null, next: null };
    const returned = placedAndAnswered(field, rows, point);
    if (returned && returned.own === model.own && returned.other === model.other && returned.empty === model.empty) {
      return { matched: true, next: null };
    }
    if (current?.grid[point[1]]?.[point[0]] === model.own
      && (completesLine(field, point, model.own) || current.grid.every((row: string[]) => !row.includes(model.empty)))) {
      const alternatives = fieldCandidates(rows).flatMap(candidate => {
        if (!independentField(field.geometry, candidate.geometry)) return [];
        const roles = fitMarkRoles(candidate, rows, model);
        if (!roles || !candidate.grid.some(row => row.includes(roles.empty))) return [];
        return [{ field: candidate, roles }];
      });
      if (alternatives.length === 1) return { matched: true, next: alternatives[0]! };
    }
    for (const earlier of state.earlierFields ?? []) {
      const restored = projectCellPatch(rows, earlier.geometry) as Field | null;
      if (!restored || encode(restored.grid) !== earlier.initial) continue;
      const before = projectCellPatch(first, earlier.geometry) as Field | null;
      if (before && encode(before.grid) === earlier.initial) continue;
      const roles = fitMarkRoles(restored, rows, model);
      if (roles) return { matched: null, next: { field: restored, roles } };
    }
    return { matched: false, next: null };
  };
  return {
    id: observedLinePlacementId,
    observePublicOutcome: learnOutcome,
    async propose(observation, rows, _inputs, remaining, execution) {
      const memory = witness;
      if (remaining < 1 || memory?.epoch !== observation.level_epoch || !observation.available_action_refs.includes('ACTION6')) return null;
      const previous = local?.epoch === observation.level_epoch ? local : null;
      if (previous?.stopped) return null;
      const fields = previous ? [projectCellPatch(rows, previous.geometry) as Field | null].filter((field): field is Field => !!field) : fieldCandidates(rows);
      const inherited = previous?.model ?? memory.model;
      const choices = fields.flatMap(field => {
        const model = fitMarkRoles(field, rows, inherited);
        return model ? [{ field, model }] : [];
      });
      if (choices.length !== 1) return null;
      const { field, model } = choices[0]!, board = encode(field.grid), count = field.grid.flat().filter(value => value === model.empty).length;
      if (!count) return null;
      const state: Local = previous ?? { epoch: observation.level_epoch, geometry: field.geometry, initial: board, tried: {}, stopped: false,
        model, needsConfirmation: model !== inherited };
      const length = Math.min(...field.geometry.shape);
      const now = execution?.now ?? (() => performance.now());
      let ranked: ReturnType<typeof searchLines>[0];
      try {
        [ranked] = searchLines(field.grid, model.own, model.other, model.empty, length, null, 0, Math.min(count, 8),
          { maxNodes: 25000, deadlineMs: Math.min(execution?.deadlineMs ?? Infinity, now() + 100), now });
      } catch (error) {
        if (error instanceof NativeLineSearchDomainError || error instanceof NativeLineSearchWorkBoundError) return null;
        throw error;
      }
      const trialKey = (point: NativePoint) => [field.geometry.origin, board, point].join('|');
      const attempts = (point: NativePoint) => state.tried[trialKey(point)] ?? state.tried[board + '|' + point.join(',')] ?? 0;
      const selected = ranked.filter(candidate => candidate.value === ranked[0]?.value)
        .sort((a, b) => attempts(a.point) - attempts(b.point))[0];
      if (!selected) return null;
      const point = selected.point as NativePoint, trial = trialKey(point);
      const strategy = state.needsConfirmation ? 'verify_resized_marks' : selected.immediate_goal ? 'complete_observed_line'
        : selected !== ranked[0] ? 'contrast_equivalent_line_preparation' : 'prepare_line_against_response';
      const label = observedLineStrategies[strategy], ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...new Set([memory.boundary, ...model.refs].filter(item => item !== ref))];
      const [x, y] = cellPatchCenter(field.geometry, point) as [number, number];
      const action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      if (!binding) return null;
      const objective = { kind: 'assemble_line_under_observed_responses', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['own_mark', 'opposing_mark', 'vacant_cell'], parentObjective: parent, satisfactionContract: 'observed_line_and_official_progress' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'line-placement:' + need.id;
      return { status: 'proposed', kind: observedLinePlacementId, actions, local: state, model, field, point, trial, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, point_binding: binding, expected_after: null }],
        sicSituationCard: { strategy, need: 'Prepare a complete line while accounting for the other marks',
          situation: label, mode: state.needsConfirmation || strategy === 'contrast_equivalent_line_preparation' ? 'exploration' : 'solving', evidence,
          agenda: [], target: cellBounds(field.geometry, point), ownMark: sampleMark(field, model.own),
          otherMark: sampleMark(field, model.other), markRolesPending: state.needsConfirmation === true },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, preconditions: {},
          preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_vacant_cell_bound' : 'placement_context_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) {
        return { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      }
      const { matched, next } = placementEffect(proposal, first, second);
      if (next && matched) return { matched: true, seal_prefix: true, reason: 'field_completed_and_another_field_visible' };
      return { matched, seal_prefix: true, reason: matched === null ? 'observed_return_to_initial_arrangement'
        : matched ? 'local_mark_and_opposing_reply_confirmed' : 'mark_or_reply_prediction_contradicted' };
    },
    record(before, after, _action, first, second, proposal) {
      const [x, y] = cellPatchCenter(proposal.field.geometry, proposal.point) as [number, number];
      learnPlacement(before, after, first, second, [x, y], proposal.field);
      if (before.level_epoch !== after.level_epoch) return { events: [] };
      const state = proposal.local, tried = state.tried;
      const { matched, next } = placementEffect(proposal, first, second);
      local = { ...state, stopped: matched === false, needsConfirmation: state.needsConfirmation === true && matched !== true,
        tried: { ...tried, [proposal.trial]: (tried[proposal.trial] ?? 0) + 1 } };
      if (next) {
        const earlierFields = (state.earlierFields ?? []).filter(item => independentField(item.geometry, next.field.geometry));
        local = { ...local, geometry: next.field.geometry, initial: encode(next.field.grid), model: next.roles,
          needsConfirmation: true, earlierFields: [...earlierFields, { geometry: state.geometry, initial: state.initial }] };
      } else if (matched === true) {
        local.model = { ...proposal.model, refs: [...proposal.model.refs.slice(-4), before.observation_ref, after.observation_ref] };
      }
      return { events: [] };
    },
    state: () => ({ training, witness, local }),
    restore(value: NativeRecord) {
      training = structuredClone((value.training as Training | undefined) ?? null);
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      local = structuredClone((value.local as Local | undefined) ?? null);
    },
  };
}
