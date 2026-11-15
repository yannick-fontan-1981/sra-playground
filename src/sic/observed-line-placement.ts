import { cellPatchCenter, cellPatchChanges, measureCellPatchFields, projectCellPatch,
  type CellPatchGeometry } from '../logos-engine/v6-cell-patch-observation.ts';
import { lineWindows, NativeLineSearchDomainError, NativeLineSearchWorkBoundError, searchLines } from '../logos-engine/v6-supported-lines.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const observedLinePlacementId = 'sic_prepare_line_from_observed_responses';
export const observedLineStrategies = {
  prepare_line_against_response: 'Place a mark while accounting for the observed reply',
  contrast_equivalent_line_preparation: 'Test a different equally ranked placement after an observed return',
  complete_observed_line: 'Place the final mark of a line',
} as const;

type Field = { geometry: CellPatchGeometry; grid: string[][] };
type Marks = { own: string; other: string; empty: string; refs: string[] };
type Training = { epoch: number; fields: Field[]; model: Marks | null };
type Witness = { epoch: number; model: Marks; boundary: string };
type Local = { epoch: number; geometry: CellPatchGeometry; initial: string; tried: Record<string, number>; stopped: boolean };
type Proposal = NativeProposal & { local: Local; field: Field; point: NativePoint; trial: string; needId: string };
const encode = (grid: readonly string[][]) => JSON.stringify(grid);
const samePoint = ([x, y]: readonly number[], [a, b]: readonly number[]) => x === a && y === b;

function cellBounds(geometry: CellPatchGeometry, [column, row]: NativePoint): NativeBox {
  const left = geometry.origin[0]! + column * geometry.pitch[0]!, top = geometry.origin[1]! + row * geometry.pitch[1]!;
  return [left, top, left + geometry.size[0]! - 1, top + geometry.size[1]! - 1];
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
  return { own: local[3], other: remote[3], empty: local[2] };
}

function fieldCandidates(rows: NativeRows): Field[] {
  return measureCellPatchFields(rows).filter(field => field.geometry.shape[0] * field.geometry.shape[1] <= 16) as Field[];
}

export function createSicObservedLinePlacement(): NativeFamily<Proposal> {
  let training: Training | null = null, witness: Witness | null = null, local: Local | null = null;
  const comparePlacement = (proposal: Proposal, rows: NativeRows) => {
    const current = projectCellPatch(rows, proposal.local.geometry);
    if (current && encode(current.grid) === proposal.local.initial) return null;
    const returned = placedAndAnswered(proposal.field, rows, proposal.point), model = witness?.model;
    return !!returned && !!model && returned.own === model.own && returned.other === model.other && returned.empty === model.empty;
  };
  return {
    id: observedLinePlacementId,
    observePublicOutcome(before, after, command, first, second) {
      const { x, y } = command.data;
      if (command.action_ref !== 'ACTION6' || typeof x !== 'number' || typeof y !== 'number') return;
      if (training?.epoch !== before.level_epoch) training = { epoch: before.level_epoch, fields: fieldCandidates(first), model: null };
      const fields = training.fields.flatMap(field => {
        const current = projectCellPatch(first, field.geometry) as Field | null;
        const point = current && pointInField(current, x, y);
        return current && point ? [{ current, point }] : [];
      });
      if (fields.length !== 1) return;
      const { current, point } = fields[0]!, { model } = training;
      if (after.levels_completed > before.levels_completed) {
        if (!model || model.refs.length < 4 || current.grid[point[1]]?.[point[0]] !== model.empty) return;
        const length = Math.min(...current.geometry.shape);
        const wins = lineWindows(current.grid, length).some(window => window.some(cell => samePoint(cell, point))
          && window.every(cell => samePoint(cell, point) || current.grid[cell[1]!]?.[cell[0]!] === model.own));
        if (wins) witness = { epoch: after.level_epoch, model, boundary: after.observation_ref };
        return;
      }
      if (before.level_epoch !== after.level_epoch) return;
      const measured = placedAndAnswered(current, second, point);
      if (!measured) return;
      const previous = model && measured.own === model.own && measured.other === model.other && measured.empty === model.empty ? model.refs : [];
      training.model = { ...measured, refs: [...previous.slice(-4), before.observation_ref, after.observation_ref] };
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const memory = witness;
      if (remaining < 1 || memory?.epoch !== observation.level_epoch || !observation.available_action_refs.includes('ACTION6')) return null;
      const model = memory.model, previous = local?.epoch === observation.level_epoch ? local : null;
      if (previous?.stopped) return null;
      const fields = previous ? [projectCellPatch(rows, previous.geometry) as Field | null].filter((field): field is Field => !!field) : fieldCandidates(rows);
      const choices = fields.filter(field => field.grid.flat().every(value => [model.own, model.other, model.empty].includes(value)));
      if (choices.length !== 1) return null;
      const field = choices[0]!, board = encode(field.grid), count = field.grid.flat().filter(value => value === model.empty).length;
      if (!count) return null;
      const state: Local = previous ?? { epoch: observation.level_epoch, geometry: field.geometry, initial: board, tried: {}, stopped: false };
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
      const attempts = (point: NativePoint) => state.tried[board + '|' + point.join(',')] ?? 0;
      const selected = ranked.filter(candidate => candidate.value === ranked[0]?.value)
        .sort((a, b) => attempts(a.point) - attempts(b.point))[0];
      if (!selected) return null;
      const point = selected.point as NativePoint, trial = board + '|' + point.join(',');
      const strategy = selected.immediate_goal ? 'complete_observed_line'
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
      return { status: 'proposed', kind: observedLinePlacementId, actions, local: state, field, point, trial, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, point_binding: binding, expected_after: null }],
        sicSituationCard: { strategy, need: 'Prepare a complete line while accounting for the other marks',
          situation: label, mode: strategy === 'contrast_equivalent_line_preparation' ? 'exploration' : 'solving', evidence,
          agenda: [], target: cellBounds(field.geometry, point) },
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
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) {
        return { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      }
      const matched = comparePlacement(proposal, second);
      return { matched, seal_prefix: true, reason: matched === null ? 'observed_return_to_initial_arrangement'
        : matched ? 'local_mark_and_opposing_reply_confirmed' : 'mark_or_reply_prediction_contradicted' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch) return { events: [] };
      const state = proposal.local, tried = state.tried;
      local = { ...state, stopped: comparePlacement(proposal, second) === false,
        tried: { ...tried, [proposal.trial]: (tried[proposal.trial] ?? 0) + 1 } };
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
