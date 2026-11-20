import type { NativeExecution, NativeObservation, NativeProgramHandle, NativeProposal, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Point } from '../logos-engine/v6-point-set.ts';
import { assignStopTargets, coversStopMarkers, measureMaterialStopScene, measureStopScene, planStopPlacement,
  reconcileStopMaterial, stopEdgeKey, stopSceneMatches, stopShapeBox,
  type StopLayout, type StopScene, type StopStep } from './marker-stop-placement.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { sicNeedId } from './need-identity.ts';

export type StopControls = { motion: [string, Point][]; selector: string; refs: string[] };
export type StopMemory = StopControls & { epoch: number; layout: StopLayout; scene: StopScene; confirmed: string[];
  rejected: string[]; route: StopStep[]; retired?: boolean };
export type StopProposal = NativeProposal & { stopMemory: StopMemory; stopSteps: StopStep[]; needId: string };
export const isStopProposal = (proposal: NativeProposal): proposal is StopProposal => Object.hasOwn(proposal, 'stopMemory');

const effectKey = (step: StopStep) => step.effect ? `${step.effect}:${step.action}` : null;

export async function proposeStopPlacement(observation: NativeObservation, rows: NativeRows, keys: readonly string[], remaining: number,
  retained: StopMemory | null, controls: StopControls | null, decide: NativeProgramHandle | undefined, execution?: NativeExecution) {
  const epoch = observation.level_epoch;
  let local = retained?.epoch === epoch ? retained : null;
  if (!local && controls) {
    const vectors = controls.motion.filter(([action]) => keys.includes(action));
    if (vectors.length !== 4 || !keys.includes(controls.selector)) return null;
    const strides = new Set(vectors.map(([, [x, y]]) => Math.abs(x) + Math.abs(y)));
    const stride = [...strides][0]!;
    if (strides.size !== 1 || !stride || vectors.some(([, [x, y]]) => (x === 0) === (y === 0))) return null;
    const measured = measureStopScene(observation, rows, stride);
    if (measured) {
      local = { ...controls, motion: vectors, ...measured, epoch, confirmed: [], rejected: [], route: [] };
    } else {
      const colored = measureMaterialStopScene(observation, rows, stride);
      const assignment = colored ? assignStopTargets(colored.layout, colored.scene, colored.targets, vectors) : null;
      if (colored && assignment) local = { ...controls, motion: vectors, layout: colored.layout, ...assignment, epoch, confirmed: [], rejected: [] };
    }
  }
  if (!local || local.retired || !stopSceneMatches(rows, local.layout, local.scene)) return null;
  const { scene, layout } = local;
  const selecting = coversStopMarkers(scene.pieces[scene.active]!);
  if (selecting && scene.pieces.every(coversStopMarkers)) return null;
  const route = selecting ? [{ action: local.selector,
    expected: { ...scene, active: (scene.active + 1) % scene.pieces.length }, effect: null }]
    : local.route.length ? local.route : planStopPlacement(layout, scene, local.motion, local.rejected);
  if (!route?.length) return null;
  const unconfirmed = route.findIndex(step => {
    const effect = effectKey(step);
    return effect !== null && !local!.confirmed.includes(effect);
  });
  const probing = unconfirmed === 0;
  const limit = probing || selecting ? 1 : unconfirmed < 0 ? maximumCommittedActions : unconfirmed;
  const steps = route.slice(0, Math.min(limit, remaining, maximumCommittedActions));
  const mode = execution?.reasoningMode ?? (probing ? 'exploration' : 'solving');
  const strategy = probing ? 'P05' : selecting ? 'P02' : 'P07';
  const facts = { routeSupported: !probing && !selecting, knownInteraction: selecting, eligibleProbe: probing, mode };
  const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
  if (decision?.result !== strategy) return null;
  const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...new Set(local.refs.filter(value => value !== ref))];
  const parent = 'G_official_completion';
  const objective = { kind: 'fit_visible_markers_after_contact', scope: ref.split(':revision:', 1)[0]!,
    subjects: ['selected_piece', 'fixed_stop', 'same_color_markers'], parentObjective: parent,
    satisfactionContract: 'official_progress_after_observed_marker_coverage' };
  const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
  const id = 'stop-placement:' + need.id, actions = steps.map(step => ({ action_ref: step.action, data: {} }));
  const changesMaterial = steps[0]?.effect?.startsWith('material:');
  const source = changesMaterial ? layout.materials?.find(region => region.color === steps[0]!.expected.pieces[scene.active]!.color) : undefined;
  const label = probing ? changesMaterial ? 'Check which color the piece acquires on contact with the source'
    : 'Test how the selected piece changes shape at the fixed obstacle'
    : selecting ? 'Switch to the next piece after checking marker coverage'
      : layout.materials && scene.pieces[scene.active]!.targetColor !== scene.pieces[scene.active]!.color
        ? 'Reach the color source for this piece and its assigned markers'
        : 'Follow the visible route to the required shape and marker position';
  return { status: 'proposed', kind: 'sic_verify_marker_placement', actions, stopMemory: { ...local, route },
    stopSteps: steps, needId: need.id, steps: steps.map((step, i) => ({ action: actions[i]!, expected_after: step.expected })),
    binding: { observation_ref: ref, level_epoch: epoch, levels_completed: observation.levels_completed },
    sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
      edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
    sicSituationCard: { strategy, need: 'Fit the piece to its markers using shape changes observed at contact', mode,
      situation: label, agenda: [], evidence, triggerCard: decision.receipt.workflow,
      actor: stopShapeBox(scene.pieces[scene.active]!.shape), addressedRegion: source?.box ?? layout.stop,
      targets: scene.pieces[scene.active]!.markers.map(([x, y]) => [x - 1, y - 1, x + 1, y + 1]),
      otherSupports: scene.pieces.flatMap((piece, i) => i === scene.active ? [] : [stopShapeBox(piece.shape)]) },
    question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
    sicLocalDecision: { strategy, objective: { id, label, parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
      preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } } satisfies StopProposal;
}

export function stopProjectionMatches(proposal: StopProposal, index: number, rows: NativeRows): boolean {
  return stopSceneMatches(rows, proposal.stopMemory.layout, proposal.stopSteps[index]!.expected);
}

export function observeStopPlacement(local: StopMemory, step: StopStep, rows: NativeRows, ref: string): StopMemory {
  const { layout, scene } = local, refs = [...local.refs.slice(-5), ref];
  if (stopSceneMatches(rows, layout, step.expected)) {
    const key = effectKey(step);
    return { ...local, scene: step.expected, route: local.route.slice(1), refs,
      confirmed: key && !local.confirmed.includes(key) ? [...local.confirmed, key] : local.confirmed };
  }
  if (step.action === local.selector) {
    const active = scene.pieces.findIndex((_, i) => stopSceneMatches(rows, layout, { ...scene, active: i }));
    if (active >= 0 && active !== scene.active) return { ...local, scene: { ...scene, active }, route: [], refs };
  } else if (stopSceneMatches(rows, layout, scene)) {
    return { ...local, rejected: [...local.rejected, stopEdgeKey(scene, step.action)], route: [], refs };
  } else {
    const reconciled = reconcileStopMaterial(layout, scene, step, rows);
    if (reconciled) return { ...local, ...reconciled, route: [], refs };
  }
  return { ...local, retired: true, route: [], refs };
}
