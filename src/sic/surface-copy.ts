import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { advanceSurfacePose, makeSurfaceMasks, measureSurfaceLayout, observeSurface, paintSurface, surfaceAttachment, surfaceCrop, surfaceProgram,
  type SurfaceMeaning, type SurfaceMotion, type SurfaceState } from '../logos-engine/v6-surface-program.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const surfaceCopyId = 'sic_surface_copy';
export const learnSurfaceCopyId = 'sic_copy_surface_after_observed_tool_effect';
export const surfaceCopyStrategies = {
  P02: navigationPrimitives.P02,
  P05: navigationPrimitives.P05,
  choose_reference_color: 'Select the color needed for the next part of the reference',
  measure_surface_input: 'Test a command that may orient or apply the tool',
  apply_measured_surface_input: 'Use the measured command to copy the reference',
} as const;
const graph = compileStrategyGraph({ id: 'copy_a_visible_surface', version: 1, order: 'FALLBACK',
  priorities: ['choose_reference_color', 'apply_measured_surface_input', 'measure_surface_input'],
  strategies: {
    choose_reference_color: [{ fact: 'swatch', expected: true, label: 'The next proposed stroke needs a different visible color' }],
    apply_measured_surface_input: [{ fact: 'agreed', expected: true, label: 'All models predict the same effect for the proposed command' }],
    measure_surface_input: [{ fact: 'uncertain', expected: true, label: 'A command can advance the copy or distinguish competing effects' }],
  },
}, ['swatch', 'agreed', 'uncertain']);

type Scene = { ref: NativeBox; work: NativeBox; swatches: Record<string, NativeBox>; domain: Record<string, NativeCommand>; palette: number[] };
type Model = { labels: SurfaceMeaning[]; motion: SurfaceMotion; inclusive: boolean };
type Attachment = { masks: string[]; confirmed: number[]; rejected: boolean };
type State = { epoch: number; scene: Scene; goal: number[]; keys: string[]; models: Model[];
  tried: string[]; evidence: string[]; stopped: boolean; attachment: Attachment | null };
type Proposal = NativeProposal & { local: State; current: SurfaceState; command: NativeCommand;
  expected: SurfaceState | null; attempt: string; needId: string; attachmentPose: number | null };
const key = (value: unknown) => JSON.stringify(value);
const equal = (a: unknown, b: unknown) => key(a) === key(b);
const boxWidth = ([x, , r]: NativeBox) => r - x + 1;
const boxHeight = ([, y, , b]: NativeBox) => b - y + 1;
const turnDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 8 - Math.abs(a - b));
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];

function assignments(values: readonly SurfaceMeaning[]): SurfaceMeaning[][] {
  if (!values.length) return [[]];
  return values.flatMap((value, index) => assignments(values.filter((_, i) => i !== index)).map(rest => [value, ...rest]));
}

function predict(current: SurfaceState, model: Model, input: number, masks: readonly bigint[]): SurfaceState {
  const [pose, hue, grid] = current, meaning = model.labels[input]!;
  return meaning === 'write' ? [pose, hue, paintSurface(grid, masks[pose]!, hue)]
    : [advanceSurfacePose(pose, meaning, model.motion), hue, grid];
}

function compatibleModels(models: Model[], before: SurfaceState, after: SurfaceState | null, input: number, masks: readonly (readonly bigint[])[]) {
  return models.filter(model => equal(after, predict(before, model, input, masks[Number(model.inclusive)]!)));
}

function shortestSurfacePath(current: SurfaceState, goal: number[], masks: readonly (readonly bigint[])[]) {
  const [pose, hue, grid] = current;
  return masks.flatMap(footprints => {
    const path = surfaceProgram(grid, goal, pose, hue, footprints);
    if (!path?.length) return [];
    let lastPose = pose, lastHue = hue, cost = 0;
    for (const [footprint, nextHue] of path) {
      const nextPose = footprint % 8;
      cost += turnDistance(lastPose, nextPose) + Number(lastHue !== nextHue) + 1;
      lastPose = nextPose;
      lastHue = nextHue;
    }
    return [{ path, cost }];
  }).sort((a, b) => a.cost - b.cost)[0]?.path;
}

export function createSicSurfaceCopy(family = surfaceCopyId): NativeFamily<Proposal> {
  const learns = family === learnSurfaceCopyId;
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const named = inputs.filter(input => /^ACTION[1-5]$/.test(input.action_ref)).map(input => input.action_ref).sort();
      if (named.length !== 5) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.tried.length ?? 0) >= 32) return null;
      if (learns && !prior && !execution?.readPriorDirectionalScene) return null;
      const clicks = prior ? [] : observation.entities.filter(part => part.rectangular).map(part => {
        const [x, y] = center(part.bbox);
        return { action_ref: 'ACTION6', data: { x, y } };
      });
      const scene = prior?.scene ?? (measureSurfaceLayout(observation, rows, clicks) as Scene | null);
      if (!scene || boxWidth(scene.work) * boxHeight(scene.work) > 256) return null;
      const goal = prior?.goal ?? surfaceCrop(rows, scene.ref).flat();
      const hypotheses: Model[] = prior?.models ?? assignments([0, 2, 4, 6, 'write']).flatMap(labels =>
        (['bounded_axis', 'angular_attraction'] as const).flatMap(motion =>
          [false, true].map(inclusive => ({ labels, motion, inclusive }))));
      const current = observeSurface(rows, scene);
      if (!current || (prior && !equal(prior.keys, named)) || equal(current[2], goal) || !hypotheses.length) return null;
      const [pose, hue, grid] = current;
      const masks = [false, true].map(inclusive => makeSurfaceMasks(boxWidth(scene.work), boxHeight(scene.work), inclusive));
      const ref = observation.observation_ref;
      const receipt = learns && !prior ? execution?.readPriorDirectionalScene?.(first =>
        equal(surfaceCrop(first, scene.ref).flat(), goal) ? observeSurface(first, scene) : null) : null;
      let models = hypotheses;
      if (learns && !prior) {
        if (!receipt || receipt.afterRef !== ref || receipt.levelEpoch !== observation.level_epoch) return null;
        const input = named.indexOf(receipt.command);
        if (input < 0) return null;
        models = compatibleModels(hypotheses, receipt.scene, current, input, masks);
        if (!models.length || models.length === hypotheses.length) return null;
      }
      let local: State = prior ?? { epoch: observation.level_epoch, scene, goal, keys: named, models,
        tried: receipt ? [key([receipt.scene, receipt.command])] : [], evidence: receipt ? [receipt.beforeRef, ref] : [],
        stopped: false, attachment: null };
      const mainMasks = [...new Set(models.map(model => Number(model.inclusive)))].map(index => masks[index]!);
      let path = shortestSurfacePath(current, goal, mainMasks);
      const accessory = !path ? surfaceAttachment(scene, observation, inputs, current) : null;
      if (accessory && !equal(local.attachment?.masks, accessory[0].map(String))) {
        local = { ...local, attachment: { masks: accessory[0].map(String), confirmed: [], rejected: false } };
      }
      if (!path && local.attachment && !local.attachment.rejected) {
        const smallerMasks = local.attachment.masks.map(value => BigInt(value));
        path = shortestSurfacePath(current, goal, mainMasks.map(footprints => [...footprints, ...smallerMasks]));
      }
      if (!path) return null;
      const [footprint, color] = path[0]!, want = footprint % 8;
      const scored = named.flatMap((action_ref, index) => {
        const attempt = key([current, action_ref]);
        if (local.tried.includes(attempt)) return [];
        const predictions = models.map(model => predict(current, model, index, masks[Number(model.inclusive)]!));
        const variants = new Set(predictions.map(key)).size;
        const gain = predictions.reduce((sum, next, i) => {
          const writing = models[i]!.labels[index] === 'write';
          if (pose === want) return sum + Number(writing);
          if (writing) return sum - Number(!equal(grid, next[2]));
          return sum + turnDistance(pose, want) - turnDistance(next[0], want);
        }, 0) / models.length;
        return [{ command: { action_ref, data: {} }, gain, variants, expected: variants === 1 ? predictions[0]! : null, attempt }];
      }).sort((a, b) => b.gain - a.gain || b.variants - a.variants);
      const best = scored[0];
      const swatch = color === hue ? null : scene.domain[color];
      const swatchAttempt = key([current, swatch?.data ?? null]);
      if (swatch && local.tried.includes(swatchAttempt)) return null;
      const usesAttachment = !swatch && footprint >= 8 && pose === want;
      if (usesAttachment && !accessory) return null;
      const attachmentBox = usesAttachment && accessory ? accessory[2] : null;
      const stamp = usesAttachment && accessory ? {
        command: accessory[1] as NativeCommand,
        expected: [pose, hue, paintSurface(grid, accessory[0][pose]!, hue)] as SurfaceState,
        attempt: key([current, accessory[1].data]),
      } : null;
      if (stamp && local.tried.includes(stamp.attempt)) return null;
      const offer = swatch ? { command: swatch, expected: [pose, color, grid] as SurfaceState, attempt: swatchAttempt } : stamp ?? best;
      if (!offer) return null;
      const agreed = !swatch && (stamp ? local.attachment?.confirmed.includes(pose) === true : !!best?.expected);
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        swatch: { value: !!swatch, evidence }, agreed: { value: agreed, evidence },
        uncertain: { value: !swatch && !agreed, evidence },
      }, planners: { choose_reference_color: () => offer, apply_measured_surface_input: () => offer, measure_surface_input: () => offer } });
      if (!selected) return null;
      const strategy = selected.id, parent = 'G_official_completion';
      const label = stamp ? (agreed ? 'Reuse the small footprint confirmed on the working surface'
        : 'Test whether the smaller part of the tool marks the predicted area') : surfaceCopyStrategies[strategy];
      const mode = execution?.reasoningMode ?? 'exploration';
      const repeated = strategy === 'apply_measured_surface_input';
      const facts = { repeatSupportedInteraction: repeated, probeNeededInteraction: !repeated, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const primitive = repeated ? 'P02' : 'P05';
      if (learns && decision?.result !== primitive) return null;
      const selectedStrategy = learns ? primitive : strategy;
      const purpose = { kind: 'copy_visible_reference_surface', scope: ref.split(':revision:', 1)[0]!, subjects: ['reference_and_work_surface'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_matching_the_reference' };
      const need = { ...purpose, id: sicNeedId(purpose), status: 'assigned', evidence };
      const id = `surface-copy:${need.id}`, { expected, attempt } = selected.plan;
      const command: NativeCommand = selected.plan.command, actions = [command];
      const swatchBox = swatch ? scene.swatches[color]! : null;
      const pointBinding = swatchBox || attachmentBox ? await ObservedInputDomain.makeLocusWitness(observation, rows,
        [command.data.x!, command.data.y!], { reason: label, evidence }) : null;
      if ((attachmentBox || (learns && swatchBox)) && !pointBinding) return null;
      return { status: 'proposed', kind: family, actions, local, current, command, expected, attempt, needId: need.id,
        attachmentPose: stamp ? pose : null,
        steps: [{ action: command, expected_after: null, ...(pointBinding ? { point_binding: pointBinding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy: selectedStrategy, need: 'Make the working surface match the displayed reference',
          mode: learns ? mode : (stamp ? agreed : !!expected) ? 'solving' : 'exploration',
          situation: label, agenda: entries, evidence, reference: scene.ref, surface: scene.work, swatch: swatchBox,
          ...(attachmentBox ? { attachment: attachmentBox, footprintConfirmed: agreed } : {}),
          ...(decision ? { triggerCard: decision.receipt.workflow } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy: selectedStrategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'surface_copy_bound' : 'surface_copy_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = proposal.expected ? equal(observeSurface(second, proposal.local.scene), proposal.expected) : null;
      return { matched, seal_prefix: true, reason: matched === false ? 'surface_effect_contradicted'
        : matched === true ? 'surface_effect_confirmed' : 'observe_surface_effect' };
    },
    record(before, after, command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, current, expected, attempt } = proposal, next = observeSurface(second, local.scene);
      const input = local.keys.indexOf(command.action_ref);
      const masks = [false, true].map(inclusive => makeSurfaceMasks(boxWidth(local.scene.work), boxHeight(local.scene.work), inclusive));
      const models = input < 0 ? local.models : compatibleModels(local.models, current, next, input, masks);
      const { attachmentPose } = proposal;
      const contradicted = input < 0 && !equal(expected, next);
      const attachment = attachmentPose !== null && local.attachment ? {
        ...local.attachment, rejected: contradicted,
        confirmed: !contradicted && !equal(current, next)
          ? [...new Set([...local.attachment.confirmed, attachmentPose])] : local.attachment.confirmed,
      } : local.attachment ?? null;
      state = { ...local, models, attachment, stopped: !next || (attachmentPose === null && contradicted),
        tried: [...local.tried, attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
