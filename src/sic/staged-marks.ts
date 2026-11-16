import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { choosePreparedConfiguration, preparedConfigurationFacts, preparedConfigurationModule } from './prepared-configuration-card.ts';
import { assessSpanStep, beamBox, distributedSpanLoad, measureSpan, nextSpanStep, planSpan, readSpanPose,
  type SpanLayout, type SpanMemory, type SpanPose, type SpanStep } from './supported-span.ts';

export const stagedMarksId = 'sic_staged_marks';
export const verifyCombinedMarksId = 'sic_verify_combined_marks';

type Part = ReturnType<typeof geometricComponents>[number];
type Source = { box: NativeBox; mark: NativeBox; color: number };
type Model = { reference: Source; donors: Source[]; outlineHeight: number };
type Layer = { box: NativeBox; marks: { box: NativeBox; color: number }[] };
type Scene = { preview: NativeBox; layers: Layer[] };
type State = { epoch: number; model: Model; refs: string[]; resizeRef: string | null; rejected: string[]; depositRef?: string;
  alignRef?: string; validPaint?: number; resizePixels?: number };
type Choice = { input: string; reason: string; target: NativeBox; click?: NativePoint; prepared?: true };
type MarksProposal = NativeProposal & { local: State; scene: Scene; choice: Choice; needId: string };
type SpanState = { epoch: number; layout: SpanLayout; plan: NonNullable<ReturnType<typeof planSpan>>; placed: number;
  refs: string[]; refused: boolean; stopped: boolean; distributed?: true };
type SpanProposal = NativeProposal & { span: SpanState; pose: SpanPose; step: SpanStep; needId: string };
type Proposal = MarksProposal | SpanProposal;
const isSpan = (proposal: Proposal): proposal is SpanProposal => 'span' in proposal;

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r + 1) / 2), Math.floor((t + b) / 2)];
const same = (a: NativeBox, b: NativeBox) => a.every((v, i) => v === b[i]);
const contains = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const coversX = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[2] >= b[2];

function outline(part: Part) {
  const w = width(part.bbox), h = height(part.bbox);
  return w >= 2 * h && h >= 5 && part.area === 2 * (w + h - 2)
    && part.mask.every(([x, y]) => x === 0 || y === 0 || x === w - 1 || y === h - 1);
}

function measure(parts: Part[], rows: NativeRows): Model | null {
  const previews = parts.filter(outline);
  if (previews.length !== 1) return null;
  const [preview] = previews, h = height(preview!.bbox);
  const sources = parts.flatMap(p => {
    if (height(p.bbox) !== h / 2 || width(p.bbox) < h || p.bbox[3] >= preview!.bbox[1]) return [];
    const marks = parts.filter(m => m.rectangular && m.color !== p.color && contains(p.bbox, m.bbox)
      && height(m.bbox) === 2 && width(m.bbox) >= 2 && m.area < p.area);
    return marks.length === 1 ? [{ box: p.bbox, mark: marks[0]!.bbox, color: p.color, markColor: marks[0]!.color }] : [];
  });
  const edge = sources.filter(p => p.box[0] === 0 || p.box[2] === rows[0]!.length - 1);
  if (edge.length !== 2 || edge[0]!.color !== edge[1]!.color || edge[0]!.box[1] !== edge[1]!.box[1]
    || width(edge[0]!.mark) !== width(edge[1]!.mark)) return null;
  const refs = sources.filter(p => p.box[3] < edge[0]!.box[1] && p.color !== edge[0]!.color
    && p.markColor === edge[0]!.markColor && p.markColor === edge[1]!.markColor
    && width(p.mark) === edge.reduce((sum, d) => sum + width(d.mark), 0));
  return refs.length === 1 ? { reference: refs[0]!, donors: edge, outlineHeight: h } : null;
}

function read(parts: Part[], model: Model): Scene | null {
  const previews = parts.filter(p => height(p.bbox) === model.outlineHeight && outline(p));
  if (previews.length !== 1) return null;
  const marks = parts.filter(p => p.rectangular && height(p.bbox) === height(model.donors[0]!.mark)
    && width(p.bbox) === height(model.donors[0]!.mark));
  const layers = parts.flatMap(p => {
    const h = height(p.bbox), w = width(p.bbox);
    if (h !== model.outlineHeight - 2 || w < width(model.reference.box) || p.area < w * h * 0.6
      || p.bbox[1] <= model.reference.box[3]) return [];
    const visible = marks.filter(m => m.color !== p.color && contains(p.bbox, m.bbox));
    return visible.length ? [{ box: p.bbox, marks: visible.map(m => ({ box: m.bbox, color: m.color })) }] : [];
  });
  return { preview: previews[0]!.bbox, layers };
}

function choose({ preview, layers }: Scene, local: State): Choice | null {
  const { model: { reference, donors }, resizeRef, rejected } = local;
  const contributors = donors.map(d => layers.find(layer => coversX(layer.box, d.mark) && layer.box[1] > d.box[3] && layer.marks.length === 1));
  const missing = donors.filter((_d, i) => !contributors[i]);
  const confirm = (target: NativeBox, reason: string): Choice => ({ input: 'ACTION5', reason, target });
  const align = (source: Source): Choice => ({ input: 'ACTION6', reason: 'Align the preview with the required visible mark', target: source.box, click: center(source.mark) });
  if (missing.length) {
    const next = missing.find(d => coversX(preview, d.mark)) ?? missing[0]!;
    return coversX(preview, next.mark) ? confirm(next.box, 'Test a deposit aligned with a missing contribution') : align(next);
  }
  const signatures = new Set(contributors.flatMap(layer => layer?.marks.map(mark => mark.color) ?? []));
  if (signatures.size !== donors.length) return null;
  const combined = layers.filter(layer => containsSignatures(layer, signatures)).sort((a, b) => a.box[1] - b.box[1])[0];
  if (!combined) return coversX(preview, reference.box)
    ? confirm(reference.box, 'Test whether a centered deposit combines the observed marks') : align(reference);
  if (!coversX(preview, reference.box)) return align(reference);
  if (width(preview) > width(reference.box) + height(donors[0]!.mark) * 2 && !resizeRef) {
    return { input: 'ACTION2', reason: 'Test whether reducing the width preserves the combined marks and clears the reference', target: reference.box };
  }
  if (rejected.includes(preview.join(','))) return null;
  return { ...confirm(reference.box, 'Advance the combined marks toward the reference'), prepared: true };
}

function containsSignatures(layer: Layer, signatures: ReadonlySet<number>): boolean {
  return [...signatures].every(color => layer.marks.some(mark => mark.color === color));
}

async function spanProposal(
  span: SpanState, pose: SpanPose, observation: NativeObservation, rows: NativeRows,
  decide: NativeProgramHandle | undefined, execution?: NativeExecution,
): Promise<SpanProposal | null> {
  const beam = span.plan[span.placed];
  const step = beam && !span.stopped ? nextSpanStep(span.layout, pose, beam, span.refused) : null;
  if (!step || !observation.available_action_refs.includes(step.action)) return null;
  const { layout } = span, ref = observation.observation_ref;
  const evidence: [string, ...string[]] = [ref, ...span.refs.filter(value => value !== ref)];
  const mode = execution?.reasoningMode ?? 'assimilation';
  const placed = step.kind === 'place';
  const knownEdit = step.action === 'ACTION2' || step.action === 'ACTION6';
  const facts = preparedConfigurationFacts(mode, { readyWithKnownApplication: placed, readyForFirstApplication: false,
    pendingWithKnownEdit: !placed && knownEdit, pendingWithUntestedEdit: !placed && !knownEdit });
  const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
  const strategy = placed || knownEdit ? 'P02' : 'P05';
  if (decision?.result !== strategy) return null;
  const bridge = span.distributed ? span.plan.findIndex(item => item.y + layout.h === layout.fixture.y) : -1;
  const sharesLoad = placed && bridge >= 0 && bridge <= span.placed
    && distributedSpanLoad(layout, span.plan.slice(0, span.placed + 1))?.beams[bridge]?.onFixture === false;
  const reason = step.kind === 'resize' ? 'Select the width planned for the next support or corridor'
    : step.kind === 'align' ? 'Align the preview with the measured contact interval'
      : sharesLoad ? 'Place the span with the bridge load shared across the side branches'
      : step.beam.y + layout.h === layout.fixture.y ? 'Join the two branches across the fixed support'
        : 'Place the span at the verified preview location and check that one unit of stock is used';
  const witness = step.point ? await ObservedInputDomain.makeLocusWitness(observation, rows, step.point, { reason, evidence }) : null;
  const target = beamBox(step.beam, layout.pitch), parent = 'G_official_completion';
  const goal = { kind: 'connect_both_foundations_with_supported_spans', scope: ref.split(':revision:', 1)[0]!,
    subjects: layout.bases.map(base => beamBox(base, layout.pitch).join(',')), parentObjective: parent,
    satisfactionContract: 'reach_reference_after_joining_both_foundations' };
  const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = verifyCombinedMarksId + ':' + need.id;
  const action: NativeCommand = { action_ref: step.action, data: step.point ? { x: step.point[0], y: step.point[1] } : {} };
  return { status: 'proposed', kind: verifyCombinedMarksId, span, pose, step, needId: need.id, actions: [action],
    binding: { observation_ref: ref, level_epoch: observation.level_epoch },
    steps: [{ action, expected_after: target, ...(witness ? { point_binding: witness } : {}) }],
    sicSituationCard: { strategy, need: 'Connect both foundations while supporting the span', situation: reason, evidence, agenda: [], mode,
      triggerCard: choosePreparedConfiguration, focus: pose.box, target, fixture: beamBox(layout.fixture, layout.pitch),
      reference: beamBox(layout.goal, layout.pitch),
      carriers: [...layout.bases, ...(bridge >= 0 && bridge < span.placed ? [span.plan[bridge]!] : [])].map(base => beamBox(base, layout.pitch)) },
    sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
      edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
    question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id, observed: false, open_question: reason, relations: [`contributes_to:${parent}`] }],
    sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: reason,
      preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } } };
}

export function createSicVerifyCombinedMarks(): NativeFamily<Proposal> {
  let state: State | null = null;
  let learned: SpanMemory | null = null;
  let planning: SpanState | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyCombinedMarksId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(choosePreparedConfiguration, {}, await preparedConfigurationModule());
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION5','ACTION6','ACTION2'].every(id => observation.available_action_refs.includes(id))) return null;
      const parts = geometricComponents(rows);
      if (learned?.completed === observation.levels_completed) {
        const pose = readSpanPose(parts, learned.pitch, learned.beamHeight, learned.validPaint);
        if (pose) {
          const prior = planning?.epoch === observation.level_epoch ? planning : null;
          const layout = prior?.layout ?? measureSpan(rows, parts, learned, pose);
          const centered = prior?.plan ?? (layout && planSpan(layout, pose));
          const plan = centered ?? (layout && learned.confirmedSpan && planSpan(layout, pose, true));
          if (layout && plan) {
            const proposed = await spanProposal(prior ?? { epoch: observation.level_epoch, layout, plan, placed: 0,
              refs: learned.refs, refused: false, stopped: false, ...(!centered ? { distributed: true } : {}) },
            pose, observation, rows, decide, execution);
            if (proposed) return proposed;
          }
        }
      }
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const model = prior?.model ?? measure(parts, rows);
      if (!model) return null;
      const local = prior ?? { epoch: observation.level_epoch, model, refs: [], resizeRef: null, rejected: [] };
      const scene = read(parts, model);
      if (!scene) return null;
      const choice = choose(scene, local);
      if (!choice) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.refs, ...(local.depositRef ? [local.depositRef] : [])].filter(v => v !== ref))];
      const mode = execution?.reasoningMode ?? 'exploration';
      const recurring = choice.input === 'ACTION5' && !!local.depositRef;
      const facts = preparedConfigurationFacts(mode, { readyWithKnownApplication: !!choice.prepared && recurring,
        readyForFirstApplication: !!choice.prepared && !recurring, pendingWithKnownEdit: !choice.prepared && recurring,
        pendingWithUntestedEdit: !choice.prepared && !recurring });
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = recurring ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const witness = choice.click ? await ObservedInputDomain.makeLocusWitness(observation, rows, choice.click, { reason: choice.reason, evidence }) : null;
      if (choice.click && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'combine_observed_contributions_at_reference', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['control_preview', 'visible_contributions', 'reference'], parentObjective: parent, satisfactionContract: 'official_progress_with_combined_marks' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = verifyCombinedMarksId + ':' + need.id;
      const action: NativeCommand = { action_ref: choice.input, data: choice.click ? { x: choice.click[0], y: choice.click[1] } : {} };
      return {
        status: 'proposed', kind: verifyCombinedMarksId, local, scene, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: choice.target, ...(witness ? { point_binding: witness } : {}) }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Combine the visible marks at the reference', situation: choice.reason, evidence, agenda: [], mode,
          triggerCard: decision.receipt.workflow, focus: scene.preview, target: choice.target, carriers: scene.layers.map(layer => layer.box) },
        question: { reason: choice.reason, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: choice.reason, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: choice.reason,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'stage_action_bound' : 'stage_layout_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const reason = isSpan(proposal) ? assessSpanStep(proposal.span.layout, proposal.step, proposal.pose, first, second) : check(proposal, second);
      return { matched: !!reason, seal_prefix: true, reason: reason ?? 'stage_effect_not_confirmed' };
    },
    record(before, after, _action, first, second, proposal) {
      if (isSpan(proposal)) {
        if (learned && after.levels_completed > before.levels_completed) {
          learned = { ...learned, completed: after.levels_completed, confirmedSpan: true,
            refs: [...proposal.span.refs.slice(-5), after.observation_ref] };
        }
        if (before.level_epoch === after.level_epoch) {
          const { span, step, pose } = proposal, confirmed = assessSpanStep(span.layout, step, pose, first, second);
          planning = { ...span, placed: span.placed + Number(step.kind === 'place' && !!confirmed),
            refused: !!step.point && !confirmed, stopped: !confirmed && !step.point,
            refs: [...span.refs.slice(-5), after.observation_ref] };
        }
        return { events: [] };
      }
      const { local, choice, scene } = proposal;
      if (after.levels_completed > before.levels_completed && local.resizePixels && local.validPaint !== undefined && local.depositRef && local.alignRef) {
        const pitch = height(local.model.reference.box), resize = local.resizePixels / pitch;
        if (Number.isInteger(resize) && resize > 0) learned = { pitch, resize, beamHeight: local.model.outlineHeight,
          targetPaint: local.model.reference.color, barPaint: local.model.donors[0]!.color, validPaint: local.validPaint,
          completed: after.levels_completed, refs: [local.depositRef, local.alignRef, before.observation_ref, after.observation_ref] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const confirmed = check(proposal, second);
      const resized = choice.input === 'ACTION2' && confirmed ? read(geometricComponents(second), local.model) : null;
      state = { ...local,
        refs: confirmed ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        ...(confirmed === 'new_marked_layer_observed'
          ? { depositRef: after.observation_ref, validPaint: first[scene.preview[1]]![scene.preview[0]]! } : {}),
        ...(confirmed === 'preview_alignment_observed' ? { alignRef: after.observation_ref } : {}),
        ...(resized ? { resizePixels: width(scene.preview) - width(resized.preview) } : {}),
        resizeRef: choice.input === 'ACTION2' && confirmed ? after.observation_ref : local.resizeRef,
        rejected: confirmed ? local.rejected : [...local.rejected, scene.preview.join(',')] };
      return { events: [] };
    },
    state: () => ({ state, learned, planning }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      learned = structuredClone((value.learned as SpanMemory | undefined) ?? null);
      planning = structuredClone((value.planning as SpanState | undefined) ?? null);
    },
  };
}

function check({ local, scene: before, choice }: MarksProposal, rows: NativeRows): string | null {
  const after = read(geometricComponents(rows), local.model);
  if (!after) return null;
  if (choice.click) return !same(before.preview, after.preview) && coversX(after.preview, choice.target) ? 'preview_alignment_observed' : null;
  if (choice.input === 'ACTION2') {
    const combined = before.layers.find(layer => new Set(layer.marks.map(mark => mark.color)).size === local.model.donors.length);
    const signatures = new Set(combined?.marks.map(mark => mark.color));
    return combined && width(after.preview) < width(before.preview)
      && after.layers.some(layer => same(layer.box, combined.box) && containsSignatures(layer, signatures))
      ? 'preview_narrowed_and_marks_preserved' : null;
  }
  return after.layers.some(layer => !before.layers.some(old => same(old.box, layer.box) && old.marks.length === layer.marks.length))
    ? 'new_marked_layer_observed' : null;
}
