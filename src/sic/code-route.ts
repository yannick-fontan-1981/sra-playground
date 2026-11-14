import { CODE_DIRECTIONS, codeBits, codePosition, decodeCodeWord, encodeCodeWord, measureCodeScene, moveCodePosition, type CodeWord } from '../logos-engine/v6-code-program.ts';
import { ObservedInputDomain, projection } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const codeRouteId = 'sic_code_route';
export const codeRouteStrategies = {
  observe_program_trace: 'Run the visible program to measure instruction effects',
  edit_program_step: 'Edit one instruction to build a route to the target',
  execute_verified_program: 'Run the edited program whose instructions lead to the target',
} as const;
const graph = compileStrategyGraph({ id: 'build_program_from_measured_motion', version: 1, order: 'FALLBACK',
  priorities: ['execute_verified_program', 'edit_program_step', 'observe_program_trace'],
  strategies: {
    observe_program_trace: [{ fact: 'untriedRun', expected: true, label: 'The effect of executing this visible program from the current cell is untested' }],
    edit_program_step: [{ fact: 'needsEdit', expected: true, label: 'Measured instructions can reach the target after an edit' }],
    execute_verified_program: [{ fact: 'verifiedProgram', expected: true, label: 'Every current instruction matches a measured route to the target' }],
  },
}, ['untriedRun', 'needsEdit', 'verifiedProgram']);

type Scene = { origin: NativePoint; size: number; goal: NativePoint; allowed: NativePoint[]; columns: NativeBox[][];
  bit_commands: NativeCommand[][]; values: number[]; execute: NativeCommand; button_box: NativeBox; button_hue: number };
type Effect = { motion: NativePoint; ref: string };
type State = { epoch: number; scene: Scene; effects: Record<string, Effect>; rejected: string[]; runs: string[];
  count: number; stopped: boolean };
type Proposal = NativeProposal & { local: State; program: CodeWord[]; start: NativePoint;
  edit: CodeWord[] | null; run: string; needId: string };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const cell = ([x, y]: NativePoint, { origin: [l, t], size }: Scene): NativeBox =>
  [l + x * size, t + y * size, l + (x + 1) * size - 1, t + (y + 1) * size - 1];

function programFor(scene: Scene, start: NativePoint, words: CodeWord[], effects: State['effects']): CodeWord[] | null {
  const cost = (a: bigint, b: bigint) => (a ^ b).toString(2).replaceAll('0', '').length;
  type Partial = { at: NativePoint; words: CodeWord[]; edits: number };
  let reachable: Partial[] = [{ at: start, words: [], edits: 0 }];
  for (const word of words) {
    const next = new Map<string, Partial>();
    for (const path of reachable) for (const [value, { motion }] of Object.entries(effects)) {
      const at = moveCodePosition(path.at, motion, scene);
      if (same(at, path.at)) continue;
      const edits = path.edits + cost(decodeCodeWord(word), BigInt(value)), key = at.join(',');
      if ((next.get(key)?.edits ?? Infinity) > edits) next.set(key, { at, edits, words: [...path.words, encodeCodeWord(BigInt(value))] });
    }
    reachable = [...next.values()];
  }
  return reachable.find(path => same(path.at, scene.goal))?.words ?? null;
}

function observedInstructions(proposal: Proposal, frames: readonly NativeRows[]) {
  const { local: { scene }, program, start } = proposal;
  const ends = new Map<number, NativePoint>();
  for (const frame of frames) {
    const position = codePosition(frame, scene);
    if (!position) continue;
    const emphasis = scene.columns.map(column => {
      const [l, t, r] = column[0]!, bottom = column.at(-1)![3];
      return projection(frame, [l - 1, t - 1, r + 1, bottom + 1]).flat().filter(pixel => pixel === scene.button_hue).length;
    });
    const highest = Math.max(...emphasis);
    if (highest > 0 && emphasis.filter(value => value === highest).length === 1) ends.set(emphasis.indexOf(highest), position);
  }
  return program.flatMap((word, index) => {
    const end = ends.get(index), begin = index ? ends.get(index - 1) : start;
    if (!end || !begin) return [];
    const motion: NativePoint = [end[0] - begin[0], end[1] - begin[1]];
    return CODE_DIRECTIONS.some(direction => same(direction, motion)) ? [{ word: String(decodeCodeWord(word)), motion }] : [];
  });
}

export function createSicCodeRoute(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: codeRouteId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 48) return null;
      const scene = prior?.scene ?? findScene(observation, rows);
      if (!scene || scene.columns.length > 12 || scene.columns[0]!.length > 24) return null;
      const local = prior ?? { scene, epoch: observation.level_epoch, effects: {}, rejected: [], runs: [], count: 0, stopped: false };
      const program = codeBits(rows, scene), start = codePosition(rows, scene);
      if (!program || !start) return null;
      const wanted = programFor(scene, start, program, local.effects);
      const column = wanted ? program.findIndex((word, index) => !same(word, wanted[index])) : -1;
      const change = wanted && column >= 0 ? decodeCodeWord(program[column]!) ^ decodeCodeWord(wanted[column]!) : 0n;
      const weights = scene.columns[0]!.map((_, i, bits) => 1n << BigInt(bits.length - i - 1));
      const bit = weights.findIndex(weight => (change & weight) !== 0n);
      const run = JSON.stringify([start, program]);
      const untried = !local.runs.includes(run), editable = column !== -1 && bit !== -1;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set(Object.values(local.effects).map(effect => effect.ref))];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        untriedRun: { value: untried && !wanted, evidence }, needsEdit: { value: editable, evidence },
        verifiedProgram: { value: untried && !!wanted && column === -1, evidence },
      }, planners: { observe_program_trace: () => scene.execute, execute_verified_program: () => scene.execute,
        edit_program_step: () => editable ? scene.bit_commands[column]![bit]! : null } });
      if (!selected) return null;
      const strategy = selected.id, label = codeRouteStrategies[strategy], command = selected.plan;
      const parent = 'G_official_completion';
      const goal = { kind: 'program_motion_to_visible_target', scope: ref.split(':revision:', 1)[0]!, subjects: ['program_and_moving_piece'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_program_execution' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `code-route:${need.id}`, actions = [command];
      const edit = editable ? program.map((word, index) => index === column ? encodeCodeWord(decodeCodeWord(word) ^ weights[bit]!) : word) : null;
      const addressed = editable ? scene.columns[column]![bit]! : scene.button_box;
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, [command.data.x!, command.data.y!], { reason: label, evidence });
      return { status: 'proposed', kind: codeRouteId, actions, local, program, start, edit, run, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: pointBinding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Build a program that moves the piece to its target', mode: wanted ? 'solving' : 'exploration',
          situation: label, agenda: entries, evidence, actor: cell(start, scene), target: cell(scene.goal, scene), addressed },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_program_bound' : 'current_program_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = proposal.edit ? editMatches(proposal, second) : null;
      return { matched, seal_prefix: true, reason: matched === null ? 'observe_program_trace'
        : matched ? 'program_edit_observed' : 'program_edit_contradicted' };
    },
    record(before, after, _command, _first, second, proposal, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, edit, run } = proposal;
      if (edit) {
        state = { ...local, stopped: !editMatches(proposal, second), count: local.count + 1 };
        return { events: [] };
      }
      const effects = { ...local.effects }, rejected = new Set(local.rejected);
      for (const { word, motion } of observedInstructions(proposal, frames)) {
        if (rejected.has(word)) continue;
        if (effects[word] && !same(effects[word]!.motion, motion)) {
          rejected.add(word);
          delete effects[word];
        } else effects[word] = { motion, ref: after.observation_ref };
      }
      state = { ...local, effects, rejected: [...rejected], runs: [...local.runs, run], count: local.count + 1 };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function findScene(observation: NativeObservation, rows: NativeRows) {
  const clicks = observation.entities.map(entity => {
    const [x, y] = center(entity.bbox);
    return { action_ref: 'ACTION6', data: { x, y } };
  });
  return measureCodeScene(observation, rows, clicks) as Scene | null;
}

function editMatches({ local: { scene }, edit, start }: Proposal, rows: NativeRows) {
  return same(edit, codeBits(rows, scene)) && same(start, codePosition(rows, scene));
}
