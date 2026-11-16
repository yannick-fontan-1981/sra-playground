import { CODE_DIRECTIONS, codeBits, codePosition, decodeCodeWord, encodeCodeWord, measureCodeScene, normalizeCodeMask, type CodeWord } from '../logos-engine/v6-code-program.ts';
import { geometricComponents, ObservedInputDomain, projection } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { choosePreparedConfiguration, preparedConfigurationFacts, preparedConfigurationModule } from './prepared-configuration-card.ts';
import { bindExamples, readDemonstration, type CodeExample } from './code-demonstration.ts';

export const codeRouteId = 'sic_code_route';
export const verifyProgramConfigurationId = 'sic_verify_program_configuration';
export const codeRouteStrategies = {
  observe_program_trace: 'Run the visible program to measure instruction effects',
  edit_program_step: 'Edit one instruction to build a route to the target',
  execute_verified_program: 'Run the edited program whose instructions lead to the target',
} as const;

type Scene = { origin: NativePoint; size: number; goal: NativePoint; allowed: NativePoint[]; columns: NativeBox[][];
  bit_commands: NativeCommand[][]; values: number[]; execute: NativeCommand; button_box: NativeBox; button_hue: number;
  mask: NativePoint[]; shape: NativePoint; hue: number; scaled?: boolean; examples?: readonly CodeExample[] };
type Pose = { at: NativePoint; scale: number };
type Effect = { motion: NativePoint; resize?: number; fromScales?: number[]; ref: string };
type Instruction = { word: string; motion: NativePoint; resize?: number; fromScale?: number };
type State = { epoch: number; scene: Scene; effects: Record<string, Effect>; rejected: string[]; runs: string[];
  count: number; stopped: boolean; editRef?: string; examplesTried?: readonly number[] };
type Proposal = NativeProposal & { local: State; program: CodeWord[]; start: Pose;
  edit: CodeWord[] | null; run: string; needId: string; example?: number };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const cell = ([x, y]: NativePoint, { origin: [l, t], size }: Scene, scale = 1): NativeBox =>
  [l + x * size, t + y * size, l + (x + scale) * size - 1, t + (y + scale) * size - 1];

function codePose(rows: NativeRows, scene: Scene): Pose | null {
  if (!scene.scaled) {
    const at = codePosition(rows, scene);
    return at ? { at, scale: 1 } : null;
  }
  const { origin: [left, top], shape: [width, height], size, hue, mask } = scene;
  const poses = geometricComponents(rows).flatMap(part => {
    const [x, y, r, b] = part.bbox, side = r - x + 1, scale = side / size;
    if (part.color !== hue || side !== b - y + 1 || x < left || y < top
      || r >= left + width * size || b >= top + height * size || (x - left) % size || (y - top) % size) return [];
    const normalized = normalizeCodeMask(part.mask, scale);
    return normalized && same(normalized, mask) ? [{ at: [(x - left) / size, (y - top) / size] as NativePoint, scale }] : [];
  });
  return poses.length === 1 ? poses[0]! : null;
}

function programFor(scene: Scene, start: Pose, words: CodeWord[], effects: State['effects']): CodeWord[] | null {
  const cost = (a: bigint, b: bigint) => (a ^ b).toString(2).replaceAll('0', '').length;
  const allowed = new Set(scene.allowed.map(point => point.join(',')));
  function fits([x, y]: NativePoint, scale: number) {
    if (scale < 1) return false;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      if (!allowed.has(`${x + dx},${y + dy}`)) return false;
    }
    return true;
  }
  type Partial = Pose & { words: CodeWord[]; edits: number };
  let reachable: Partial[] = [{ ...start, words: [], edits: 0 }];
  for (const word of words) {
    const next = new Map<string, Partial>();
    for (const path of reachable) for (const [value, { motion, resize, fromScales }] of Object.entries(effects)) {
      if (fromScales && !fromScales.includes(path.scale)) continue;
      const at: NativePoint = [path.at[0] + motion[0], path.at[1] + motion[1]], scale = path.scale + (resize ?? 0);
      if ((scale === path.scale && same(at, path.at)) || !fits(at, scale)) continue;
      const edits = path.edits + cost(decodeCodeWord(word), BigInt(value)), key = [...at, scale].join(',');
      if ((next.get(key)?.edits ?? Infinity) > edits) next.set(key, { at, scale, edits, words: [...path.words, encodeCodeWord(BigInt(value))] });
    }
    reachable = [...next.values()];
  }
  return reachable.find(path => same(path.at, scene.goal) && path.scale === 1)?.words ?? null;
}

function observedInstructions(proposal: Proposal, frames: readonly NativeRows[]): Instruction[] {
  const { local: { scene }, program, start } = proposal;
  const ends = new Map<number, Pose>();
  for (const frame of frames) {
    const position = codePose(frame, scene);
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
    const motion: NativePoint = [end.at[0] - begin.at[0], end.at[1] - begin.at[1]], resize = end.scale - begin.scale;
    const translated = resize === 0 && CODE_DIRECTIONS.some(direction => same(direction, motion));
    const resized = resize !== 0 && motion.every(value => value === 0);
    return translated || resized ? [{ word: String(decodeCodeWord(word)), motion,
      ...(scene.scaled ? { resize, fromScale: begin.scale } : {}) }] : [];
  });
}

export function createSicVerifyProgramConfiguration(): NativeFamily<Proposal> {
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyProgramConfigurationId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(choosePreparedConfiguration, {}, await preparedConfigurationModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 48) return null;
      const scene = prior?.scene ?? findScene(observation, rows);
      if (!scene || scene.columns.length > 12 || scene.columns[0]!.length > 24) return null;
      const local = prior ?? { scene, epoch: observation.level_epoch, effects: {}, rejected: [], runs: [], count: 0, stopped: false };
      const program = codeBits(rows, scene), start = codePose(rows, scene);
      if (!program || !start) return null;
      const wanted = programFor(scene, start, program, local.effects);
      const column = wanted ? program.findIndex((word, index) => !same(word, wanted[index])) : -1;
      const change = wanted && column >= 0 ? decodeCodeWord(program[column]!) ^ decodeCodeWord(wanted[column]!) : 0n;
      const weights = scene.columns[0]!.map((_, i, bits) => 1n << BigInt(bits.length - i - 1));
      const bit = weights.findIndex(weight => (change & weight) !== 0n);
      const run = JSON.stringify([scene.scaled ? start : start.at, program]);
      const untried = !local.runs.includes(run), editable = column !== -1 && bit !== -1;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...Object.values(local.effects).map(effect => effect.ref),
        ...(local.editRef ? [local.editRef] : [])])];
      const exampleIndex = wanted ? -1 : scene.examples?.findIndex((_, index) => !local.examplesTried?.includes(index)) ?? -1;
      const example = scene.examples?.[exampleIndex];
      const ready = untried && !!wanted && column === -1, canObserve = !wanted && (untried || !!example);
      const phase = ready ? 'execute_verified_program' : editable ? 'edit_program_step' : canObserve ? 'observe_program_trace' : null;
      if (!phase) return null;
      const reuseEdit = editable && !!local.editRef;
      const mode = execution?.reasoningMode ?? (wanted ? 'solving' : 'exploration');
      const facts = preparedConfigurationFacts(mode, { readyWithKnownApplication: ready, pendingWithKnownEdit: reuseEdit,
        pendingWithUntestedEdit: editable && !reuseEdit, needsApplicationObservation: canObserve });
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = ready || reuseEdit ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const label = example ? 'Compare the highlighted instruction with motion in the separate demonstrator' : codeRouteStrategies[phase];
      const command = editable ? scene.bit_commands[column]![bit]! : example?.command ?? scene.execute;
      const parent = 'G_official_completion';
      const goal = { kind: 'program_motion_to_visible_target', scope: ref.split(':revision:', 1)[0]!, subjects: ['program_and_moving_piece'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_program_execution' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `code-route:${need.id}`, actions = [command];
      const edit = editable ? program.map((word, index) => index === column ? encodeCodeWord(decodeCodeWord(word) ^ weights[bit]!) : word) : null;
      const addressed = editable ? scene.columns[column]![bit]! : example?.box ?? scene.button_box;
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, [command.data.x!, command.data.y!], { reason: label, evidence });
      return { status: 'proposed', kind: verifyProgramConfigurationId, actions, local, program, start, edit, run, needId: need.id,
        ...(example ? { example: exampleIndex } : {}),
        steps: [{ action: command, expected_after: null, point_binding: pointBinding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Build a program that moves the piece to its target', mode,
          situation: label, agenda: [], evidence, triggerCard: decision.receipt.workflow,
          actor: cell(start.at, scene, start.scale), target: cell(scene.goal, scene), addressed, ...(example ? { demonstration: example.stage } : {}) },
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
      if (proposal.example !== undefined) {
        return { matched: realProgramUnchanged(proposal, second), seal_prefix: true, reason: 'verify_demonstration_preserves_real_program' };
      }
      const matched = proposal.edit ? editMatches(proposal, second) : null;
      return { matched, seal_prefix: true, reason: matched === null ? 'observe_program_trace'
        : matched ? 'program_edit_observed' : 'program_edit_contradicted' };
    },
    record(before, after, _command, _first, second, proposal, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, edit, run } = proposal;
      if (edit) {
        const confirmed = editMatches(proposal, second);
        state = { ...local, stopped: !confirmed, count: local.count + 1, ...(confirmed ? { editRef: after.observation_ref } : {}) };
        return { events: [] };
      }
      const effects = { ...local.effects }, rejected = new Set(local.rejected);
      const example = proposal.example === undefined ? undefined : local.scene.examples?.[proposal.example];
      const isolated = !example || realProgramUnchanged(proposal, second) && frames.every(frame => realProgramUnchanged(proposal, frame));
      const observed = example ? isolated ? readDemonstration(local.scene, example, frames) : [] : observedInstructions(proposal, frames);
      for (const { word, motion, resize, fromScale } of observed) {
        if (rejected.has(word)) continue;
        const previous = effects[word];
        if (previous && (!same(previous.motion, motion) || (previous.resize ?? 0) !== (resize ?? 0))) {
          rejected.add(word);
          delete effects[word];
        } else effects[word] = { motion, ref: after.observation_ref,
          ...(fromScale !== undefined ? { resize, fromScales: [...new Set([...(previous?.fromScales ?? []), fromScale])] } : {}) };
      }
      const history = proposal.example === undefined ? { runs: [...local.runs, run] }
        : { examplesTried: [...local.examplesTried ?? [], proposal.example] };
      state = { ...local, effects, rejected: [...rejected], ...history, count: local.count + 1 };
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
  const scene = (measureCodeScene(observation, rows, clicks) ?? measureCodeScene(observation, rows, clicks, true)) as Scene | null;
  return scene?.examples?.length ? { ...scene, examples: bindExamples(scene.examples, scene, observation) } : scene;
}

function editMatches({ local: { scene }, edit, start }: Proposal, rows: NativeRows) {
  return same(edit, codeBits(rows, scene)) && same(start, codePose(rows, scene));
}

function realProgramUnchanged({ local: { scene }, program, start }: Proposal, rows: NativeRows) {
  return same(program, codeBits(rows, scene)) && same(start, codePose(rows, scene));
}
