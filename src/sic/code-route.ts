import { codeBits, codeMaskRotation, codePosition, decodeCodeWord, encodeCodeWord, measureCodeScene, normalizeCodeMask,
  rotatedCodeMask, type CodeLattice, type CodePoseGoal, type CodeWord } from '../logos-engine/v6-code-program.ts';
import { geometricComponents, ObservedInputDomain, projection } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { choosePreparedConfiguration, preparedConfigurationFacts, preparedConfigurationModule } from './prepared-configuration-card.ts';
import { bindExamples, codeInstructionEffect, readDemonstration, type CodeExample } from './code-demonstration.ts';

export const codeRouteId = 'sic_code_route';
export const verifyProgramConfigurationId = 'sic_verify_program_configuration';
export const learnProgramConfigurationId = 'sic_learn_program_configuration';
export const codeRouteStrategies = {
  observe_program_trace: 'Run the visible program to measure instruction effects',
  edit_program_step: 'Edit one instruction to build a route to the target',
  execute_verified_program: 'Run the edited program whose instructions lead to the target',
} as const;

type Scene = { origin: NativePoint; size: number; goal: NativePoint; allowed: NativePoint[]; columns: NativeBox[][];
  bit_commands: NativeCommand[][]; values: number[]; execute: NativeCommand; button_box: NativeBox; button_hue: number;
  mask: NativePoint[]; shape: NativePoint; hue: number; floor: number[]; scaled?: boolean; goalPose?: CodePoseGoal;
  examples?: readonly CodeExample[]; restarts?: NativePoint[] };
type Pose = { at: NativePoint; scale: number; rotation?: number; hue?: number };
type Effect = { motion: NativePoint; resize?: number; fromScales?: number[]; turn?: number; fromRotations?: number[];
  hue?: number; ref: string };
type State = { epoch: number; scene: Scene; effects: Record<string, Effect>; rejected: string[]; runs: string[];
  count: number; stopped: boolean; editRef?: string; examplesTried?: readonly number[]; refusedRestarts?: string[] };
type ProgramLeg = { program: CodeWord[]; edit: CodeWord[] | null; run: string; restart?: NativePoint };
type Proposal = NativeProposal & ProgramLeg & { local: State; start: Pose; edits?: ProgramLeg[]; needId: string; example?: number };
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
    if ((scene.goalPose ? scene.floor.includes(part.color) : part.color !== hue) || side !== b - y + 1 || x < left || y < top
      || r >= left + width * size || b >= top + height * size || (x - left) % size || (y - top) % size) return [];
    const normalized = normalizeCodeMask(part.mask, scale);
    if (!normalized) return [];
    const rotation = scene.goalPose ? codeMaskRotation(mask, normalized, size) : null;
    if (scene.goalPose ? rotation == null : !same(normalized, mask)) return [];
    return [{ at: [(x - left) / size, (y - top) / size] as NativePoint, scale, ...(rotation == null ? {} : { rotation, hue: part.color }) }];
  });
  return poses.length === 1 ? poses[0]! : null;
}

function programPaths(scene: Scene, start: Pose, words: CodeWord[], effects: State['effects']) {
  const cost = (a: bigint, b: bigint) => (a ^ b).toString(2).replaceAll('0', '').length;
  const allowed = new Set(scene.allowed.map(point => point.join(',')));
  const goal = scene.goalPose;
  const masks = goal ? [0, 1, 2, 3].map(turn => new Set(rotatedCodeMask(scene.mask, scene.size, turn).map(point => point.join(',')))) : null;
  function fits({ at: [x, y], scale, rotation }: Pose) {
    if (scale < 1) return false;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      if (!allowed.has(`${x + dx},${y + dy}`)) return false;
    }
    if (!goal || rotation === undefined || !masks) return true;
    return !goal.notch.some(([u, v]) => {
      const row = Math.floor(((goal.at[1] - y) * scene.size + v) / scale);
      const col = Math.floor(((goal.at[0] - x) * scene.size + u) / scale);
      return masks[rotation]!.has(`${col},${row}`);
    });
  }
  type Partial = Pose & { words: CodeWord[]; edits: number };
  let reachable: Partial[] = [{ ...start, words: [], edits: 0 }];
  for (const word of words) {
    const next = new Map<string, Partial>();
    for (const path of reachable) for (const [value, { motion, resize, fromScales, turn, fromRotations, hue }] of Object.entries(effects)) {
      // A consistent turn from several orientations supports a relative rotation.
      if (fromScales && !fromScales.includes(path.scale)
        || fromRotations?.length === 1 && !fromRotations.includes(path.rotation!)) continue;
      const at: NativePoint = [path.at[0] + motion[0], path.at[1] + motion[1]], scale = path.scale + (resize ?? 0);
      const projected: Pose = { at, scale, ...(goal ? { rotation: (path.rotation! + (turn ?? 0)) % 4, hue: hue ?? path.hue! } : {}) };
      const stationary = scale === path.scale && same(at, path.at) && projected.rotation === path.rotation && projected.hue === path.hue;
      if (stationary || !fits(projected)) continue;
      const edits = path.edits + cost(decodeCodeWord(word), BigInt(value)), key = [...at, scale, projected.rotation, projected.hue].join(',');
      if ((next.get(key)?.edits ?? Infinity) > edits) next.set(key, { ...projected, edits, words: [...path.words, encodeCodeWord(BigInt(value))] });
    }
    reachable = [...next.values()];
  }
  return reachable;
}

function programFor(scene: Scene, start: Pose, words: CodeWord[], effects: State['effects']): CodeWord[] | null {
  const goal = scene.goalPose;
  return programPaths(scene, start, words, effects).find(path => same(path.at, scene.goal) && path.scale === (goal?.scale ?? 1)
    && (!goal || path.rotation === goal.rotation && path.hue === goal.hue))?.words ?? null;
}

function programViaRestart(scene: Scene, start: Pose, words: CodeWord[], effects: State['effects'], refused: readonly string[]) {
  const restarts = scene.restarts?.filter(point => !refused.includes(point.join(',')));
  if (!restarts?.length || restarts.length > 12 || scene.goalPose || start.scale !== 1) return null;
  const motion = Object.fromEntries(Object.entries(effects).filter(([, effect]) => !effect.resize && !effect.turn && effect.hue === undefined));
  const distances = new Map([[scene.goal.join(','), 0]]);
  const edges = restarts.map(at => ({ key: at.join(','), paths: programPaths(scene, { at, scale: 1 }, words, motion) }));
  for (let distance = 1; distance <= restarts.length; distance++) {
    for (const node of edges) {
      if (!distances.has(node.key) && node.paths.some(path => distances.get(path.at.join(',')) === distance - 1)) {
        distances.set(node.key, distance);
      }
    }
  }
  const path = programPaths(scene, start, words, motion).filter(path => !same(path.at, start.at) && distances.has(path.at.join(',')))
    .sort((a, b) => distances.get(a.at.join(','))! - distances.get(b.at.join(','))! || a.edits - b.edits)[0];
  return path ? { words: path.words, ...(same(path.at, scene.goal) ? {} : { restart: path.at }) } : null;
}

function observedInstructions(proposal: Proposal, frames: readonly NativeRows[]) {
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
    const motion: NativePoint = [end.at[0] - begin.at[0], end.at[1] - begin.at[1]];
    const effect = codeInstructionEffect(motion, begin, end, scene.scaled ?? false);
    return effect ? [{ word: String(decodeCodeWord(word)), ...effect }] : [];
  });
}

export function createSicVerifyProgramConfiguration(family = verifyProgramConfigurationId): NativeFamily<Proposal> {
  const learns = family === learnProgramConfigurationId;
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(choosePreparedConfiguration, {}, await preparedConfigurationModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 48) return null;
      const adoption = learns && !prior ? await execution?.readPriorClickScene?.((before, original, action) => {
        const scene = findScene(original, before);
        if (!scene) return null;
        const from = codeBits(before, scene), to = codeBits(rows, scene), pose = codePose(before, scene);
        if (!from || !to || !pose || !same(pose, codePose(rows, scene))) return null;
        const column = from.findIndex((word, index) => !same(word, to[index]));
        if (column < 0 || to.some((word, index) => index !== column && !same(word, from[index]))) return null;
        const difference = decodeCodeWord(from[column]!) ^ decodeCodeWord(to[column]!);
        const bit = scene.columns[column]!.findIndex((_, i, bits) => difference === 1n << BigInt(bits.length - i - 1));
        const bounds = scene.columns[column]![bit];
        if (!bounds) return null;
        const [l, t, r, b] = bounds, { x, y } = action.data;
        return x! >= l && x! <= r && y! >= t && y! <= b ? scene : null;
      }) : null;
      if (learns && !prior && (!adoption || adoption.afterRef !== observation.observation_ref || adoption.levelEpoch !== observation.level_epoch)) return null;
      const lattice = state?.epoch === observation.level_epoch - 1 ? state.scene : undefined;
      const scene = prior?.scene ?? adoption?.scene ?? findScene(observation, rows, lattice);
      if (!scene || scene.columns.length > 12 || scene.columns[0]!.length > 24) return null;
      const local: State = prior ?? { scene, epoch: observation.level_epoch, effects: {}, rejected: [], runs: [], count: 0, stopped: false,
        ...(adoption ? { editRef: adoption.afterRef } : {}) };
      const program = codeBits(rows, scene), start = codePose(rows, scene);
      if (!program || !start) return null;
      const direct = programFor(scene, start, program, local.effects);
      const staged = direct ? null : programViaRestart(scene, start, program, local.effects, local.refusedRestarts ?? []);
      const wanted = direct ?? staged?.words ?? null, restart = staged?.restart;
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
      const label = example ? scene.goalPose ? 'Measure the highlighted instruction in the separate demonstrator'
        : 'Compare the highlighted instruction with motion in the separate demonstrator'
        : restart ? editable ? 'Edit the program to reach a marked continuation tile'
          : 'Run the program and check whether the marked tile retains the new position' : codeRouteStrategies[phase];
      const command = editable ? scene.bit_commands[column]![bit]! : example?.command ?? scene.execute;
      const parent = 'G_official_completion';
      const goal = { kind: 'program_motion_to_visible_target', scope: ref.split(':revision:', 1)[0]!, subjects: ['program_and_moving_piece'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_program_execution' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `code-route:${need.id}`, actions = [command];
      const edit = editable ? program.map((word, index) => index === column ? encodeCodeWord(decodeCodeWord(word) ^ weights[bit]!) : word) : null;
      const addressed = editable ? scene.columns[column]![bit]! : example?.box ?? scene.button_box;
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, [command.data.x!, command.data.y!], { reason: label, evidence });
      const steps = [{ action: command, expected_after: edit, point_binding: pointBinding }];
      const edits: ProgramLeg[] = [{ program, edit, run, ...(restart && !edit ? { restart } : {}) }];
      if (reuseEdit && edit && wanted) {
        let current = edit;
        while (edits.length < Math.min(remaining, maximumCommittedActions, 48 - local.count)) {
          const column = wanted.findIndex((word, index) => !same(word, current[index]));
          const run = JSON.stringify([scene.scaled ? start : start.at, current]);
          if (column < 0 && local.runs.includes(run)) break;
          const delta = column >= 0 ? decodeCodeWord(current[column]!) ^ decodeCodeWord(wanted[column]!) : 0n;
          const bit = weights.findIndex(weight => (delta & weight) !== 0n);
          if (column >= 0 && bit < 0) break;
          const command = column >= 0 ? scene.bit_commands[column]![bit]! : scene.execute;
          const next = column >= 0 ? current.map((word, i) => i === column ? encodeCodeWord(decodeCodeWord(word) ^ weights[bit]!) : word) : null;
          const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, [command.data.x!, command.data.y!], { reason: label, evidence });
          edits.push({ program: current, edit: next, run, ...(restart && !next ? { restart } : {}) });
          steps.push({ action: command, expected_after: next, point_binding: witness });
          actions.push(command);
          if (!next) break;
          current = next;
        }
      }
      return { status: 'proposed', kind: family, actions, local, program, start, edit, run, needId: need.id,
        ...(restart && !edit ? { restart } : {}),
        ...(example ? { example: exampleIndex } : {}),
        ...(edits.length > 1 ? { edits } : {}), steps,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: scene.goalPose ? 'Match the receptacle position, size, orientation and color'
          : 'Build a program that moves the piece to its target', mode,
          situation: label, agenda: [], evidence, triggerCard: decision.receipt.workflow,
          actor: cell(start.at, scene, start.scale), target: scene.goalPose?.box ?? cell(restart ?? scene.goal, scene),
          ...(restart ? { finalTarget: cell(scene.goal, scene) } : {}),
          addressed, ...(example ? { demonstration: example.stage } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const leg = proposal.edits?.[index], { scene } = proposal.local;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!leg && proposal.local.epoch === observation.level_epoch && same(leg.program, codeBits(packet.frame_rows, scene))
          && same(proposal.start, codePose(packet.frame_rows, scene));
      return { admitted, reason: admitted ? 'current_program_bound' : 'current_program_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.example !== undefined) {
        return { matched: realProgramUnchanged(proposal, second), seal_prefix: true, reason: 'verify_demonstration_preserves_real_program' };
      }
      const leg = proposal.edits?.[index] ?? proposal;
      if (leg.restart) {
        const matched = same(codePose(second, proposal.local.scene)?.at, leg.restart)
          && same(codeBits(second, proposal.local.scene), leg.program);
        return { matched, seal_prefix: true, reason: matched ? 'program_left_a_retained_start' : 'program_did_not_retain_marked_start' };
      }
      const matched = leg.edit ? editMatches({ ...proposal, edit: leg.edit }, second) : null;
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length, reason: matched === null ? 'observe_program_trace'
        : matched ? 'program_edit_observed' : 'program_edit_contradicted' };
    },
    record(before, after, _command, _first, second, proposal, index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const leg = proposal.edits?.[index] ?? proposal;
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local;
      const { edit, run } = leg;
      if (edit) {
        const confirmed = editMatches({ ...proposal, edit }, second);
        state = { ...local, stopped: !confirmed, count: local.count + 1, ...(confirmed ? { editRef: after.observation_ref } : {}) };
        return { events: [] };
      }
      const effects = { ...local.effects }, rejected = new Set(local.rejected);
      const example = proposal.example === undefined ? undefined : local.scene.examples?.[proposal.example];
      const isolated = !example || realProgramUnchanged(proposal, second) && frames.every(frame => realProgramUnchanged(proposal, frame));
      const observed = example ? isolated ? readDemonstration(local.scene, example, frames) : []
        : observedInstructions({ ...proposal, program: leg.program, local }, frames);
      for (const { word, motion, resize, fromScale, turn, fromRotation, hue } of observed) {
        if (rejected.has(word)) continue;
        const previous = effects[word];
        if (previous && (!same(previous.motion, motion) || (previous.resize ?? 0) !== (resize ?? 0)
          || previous.turn !== turn || previous.hue !== hue)) {
          rejected.add(word);
          delete effects[word];
        } else effects[word] = { motion, ref: after.observation_ref,
          ...(fromScale !== undefined ? { resize, fromScales: [...new Set([...(previous?.fromScales ?? []), fromScale])] } : {}),
          ...(fromRotation !== undefined ? { turn, fromRotations: [...new Set([...(previous?.fromRotations ?? []), fromRotation])] } : {}),
          ...(hue !== undefined ? { hue } : {}) };
      }
      const history = proposal.example === undefined ? { runs: [...local.runs, run] }
        : { examplesTried: [...local.examplesTried ?? [], proposal.example] };
      const retained = leg.restart && same(codePose(second, local.scene)?.at, leg.restart) && same(codeBits(second, local.scene), leg.program);
      state = { ...local, effects, rejected: [...rejected], ...history, count: local.count + 1,
        ...(leg.restart && !retained ? { refusedRestarts: [...local.refusedRestarts ?? [], leg.restart.join(',')] } : {}) };
      return { events: [], ...(retained ? { reviewEvidence: 'The program left the piece on the marked tile, which is now the next starting position.' } : {}) };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function findScene(observation: NativeObservation, rows: NativeRows, lattice?: CodeLattice) {
  const clicks = observation.entities.map(entity => {
    const [x, y] = center(entity.bbox);
    return { action_ref: 'ACTION6', data: { x, y } };
  });
  const scene = (measureCodeScene(observation, rows, clicks) ?? measureCodeScene(observation, rows, clicks, true, true)
    ?? (lattice && (measureCodeScene(observation, rows, clicks, false, false, lattice)
      ?? measureCodeScene(observation, rows, clicks, true, true, lattice)))) as Scene | null | undefined;
  return scene?.examples?.length ? { ...scene, examples: bindExamples(scene.examples, scene, observation) } : scene;
}

function editMatches({ local: { scene }, edit, start }: Proposal, rows: NativeRows) {
  return same(edit, codeBits(rows, scene)) && same(start, codePose(rows, scene));
}

function realProgramUnchanged({ local: { scene }, program, start }: Proposal, rows: NativeRows) {
  return same(program, codeBits(rows, scene)) && same(start, codePose(rows, scene));
}
