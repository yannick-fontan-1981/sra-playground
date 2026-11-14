import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const stagedMarksId = 'sic_staged_marks';

type Part = ReturnType<typeof geometricComponents>[number];
type Source = { box: NativeBox; mark: NativeBox };
type Model = { reference: Source; donors: Source[]; outlineHeight: number };
type Layer = { box: NativeBox; marks: { box: NativeBox; color: number }[] };
type Scene = { preview: NativeBox; layers: Layer[] };
type State = { epoch: number; model: Model; refs: string[]; resizeRef: string | null; rejected: string[] };
type Choice = { input: string; reason: string; target: NativeBox; click?: NativePoint };
type Proposal = NativeProposal & { local: State; scene: Scene; choice: Choice; needId: string };

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
  return confirm(reference.box, 'Advance the combined marks toward the reference');
}

function containsSignatures(layer: Layer, signatures: ReadonlySet<number>): boolean {
  return [...signatures].every(color => layer.marks.some(mark => mark.color === color));
}

export function createSicStagedMarks(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: stagedMarksId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION5','ACTION6','ACTION2'].every(id => observation.available_action_refs.includes(id))) return null;
      const parts = geometricComponents(rows);
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const model = prior?.model ?? measure(parts, rows);
      if (!model) return null;
      const local = prior ?? { epoch: observation.level_epoch, model, refs: [], resizeRef: null, rejected: [] };
      const scene = read(parts, model);
      if (!scene) return null;
      const choice = choose(scene, local);
      if (!choice) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(v => v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: choice.input, expected: center(choice.target), evidence };
      const recurring = choice.input === 'ACTION5' && scene.layers.length > 0;
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: recurring ? null : offer, access: null, interaction: recurring ? offer : null });
      if (!selected) return null;
      const witness = choice.click ? await ObservedInputDomain.makeLocusWitness(observation, rows, choice.click, { reason: choice.reason, evidence }) : null;
      if (choice.click && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'combine_observed_contributions_at_reference', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['control_preview', 'visible_contributions', 'reference'], parentObjective: parent, satisfactionContract: 'official_progress_with_combined_marks' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = stagedMarksId + ':' + need.id;
      const action: NativeCommand = { action_ref: choice.input, data: choice.click ? { x: choice.click[0], y: choice.click[1] } : {} };
      return {
        status: 'proposed', kind: stagedMarksId, local, scene, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: choice.target, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Combine the visible marks at the reference', situation: choice.reason, evidence, agenda: entries, mode,
          triggerCard: card, focus: scene.preview, target: choice.target, carriers: scene.layers.map(layer => layer.box) },
        question: { reason: choice.reason, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: choice.reason, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: choice.reason,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'stage_action_bound' : 'stage_layout_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const reason = check(proposal, second);
      return { matched: !!reason, seal_prefix: true, reason: reason ?? 'stage_effect_not_confirmed' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, choice, scene } = proposal, confirmed = check(proposal, second);
      state = { ...local,
        refs: confirmed ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        resizeRef: choice.input === 'ACTION2' && confirmed ? after.observation_ref : local.resizeRef,
        rejected: confirmed ? local.rejected : [...local.rejected, scene.preview.join(',')] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function check({ local, scene: before, choice }: Proposal, rows: NativeRows): string | null {
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
