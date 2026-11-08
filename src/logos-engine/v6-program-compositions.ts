/** Compose explicit conditional public-program hypotheses toward an observed
 * reduction. Source: pinned V6 program_compositions.py.
 */
import { renderProgramLayers, decodeProgramStacks, fitProgramLayerOffset, fitProgramGlyphVectors } from './v6-program-geometry.ts';
import { occurrenceProgramTranslationCandidates } from './v6-occurrence-program-observer.ts';
import { programIdentity } from './v6-program-identity.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const key = (point: readonly number[]): string => `${point[0]},${point[1]}`;
const pointOrder = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
const wordOrder = (a: readonly number[], b: readonly number[]): number => {
  for (let index = 0; index < Math.min(a.length, b.length); index++) if (a[index] !== b[index]) return a[index]! - b[index]!;
  return a.length - b.length;
};

export function programPixels(objects: readonly R[], layer: R): Set<string> {
  const result = new Set<string>();
  for (const object of objects) {
    const [x, y] = object.anchor;
    for (const point of renderProgramLayers(object.word, layer.shape, layer.step).keys()) {
      const [a, b] = point.split(',').map(Number); result.add(`${x + a!},${y + b!}`);
    }
  }
  return result;
}

export function fitProgramCompositionModel(alignment: R, editBefore: NativeRows, editAfter: NativeRows,
  beforeMembers: readonly R[], afterMembers: readonly R[], rows: NativeRows, frames: readonly NativeRows[],
  options: { official_progress: boolean }): R | null {
  if (!options.official_progress || !alignment.candidate_roles?.length) return null;
  const rules = occurrenceProgramTranslationCandidates(alignment);
  if (!rules.length) return null;
  const geometry = alignment.editor_geometry, exclusions = [geometry.member_column, geometry.footer];
  const layer = fitProgramLayerOffset(editBefore, editAfter, beforeMembers, afterMembers, rules[0]!.operand_shape, exclusions);
  const glyph = fitProgramGlyphVectors(alignment);
  if (!layer || !glyph) return null;
  const palette = new Set<number>((geometry.controls as R[]).map(control => control.color)), images = [rows, ...frames];
  const word = (alignment.initial_members as R[]).map(member => member.color), interactions: R[] = [];
  for (const phase of alignment.phases as R[]) {
    const operator = (glyph.operators as R[]).find(candidate => candidate.label === phase.label);
    if (!operator || operator.vectors.length < 2) continue;
    const first = decodeProgramStacks(images[phase.start]!, layer, palette, exclusions), last = decodeProgramStacks(images[phase.endpoint]!, layer, palette, exclusions);
    const own = first.filter(object => equal(object.word, word));
    if (own.length !== 1 || !last.some(object => equal(object.word, word) && equal(object.base, own[0]!.base))) continue;
    const missing = first.filter(object => object !== own[0] && !last.some(other => equal(other.base, object.base)));
    if (missing.length !== 1 || missing[0]!.word.length !== 1) continue;
    const offset = [0, 1].map(index => missing[0]!.base[index] - own[0]!.base[index]);
    if (!(operator.vectors as number[][]).some(vector => equal(vector, offset))) continue;
    interactions.push({ label: operator.label, vectors: operator.vectors, observed_offset: offset, observed_reduction: 1,
      status: 'candidate_single_member_reduction_or_whole_object_removal', evidence: phase.evidence,
      scope: 'Only one single-member object disappeared in the observed scoring execution. Repeated unit reduction is a conservative hypothesis for larger words.' });
  }
  if (interactions.length !== 1) return null;
  const moves = (glyph.operators as R[]).filter(operator => operator.vectors.length === 1), observed: number[][] = rules.map(rule => rule.vector);
  let basis: number[][] | null = null;
  for (const a of observed) {
    for (const b of observed) if (a[0]! * b[1]! - a[1]! * b[0]!) { basis = [a, b]; break; }
    if (basis) break;
  }
  if (!basis) return null;
  const width = Math.max(...observed.map(vector => Math.abs(vector[0]!))) + 1, height = Math.max(...observed.map(vector => Math.abs(vector[1]!))) + 1;
  const templates: R[] = [], frequencies = new Map<number, number>();
  for (const row of rows) for (const color of row) frequencies.set(color, (frequencies.get(color) ?? 0) + 1);
  const background = [...frequencies].sort((a, b) => b[1] - a[1])[0]![0];
  for (const phase of alignment.phases as R[]) {
    const motions = (phase.effect.translations ?? []).filter((motion: R) => motion.signature === alignment.candidate_roles[0].signature);
    if (motions.length !== 1) continue;
    const motion = motions[0]!;
    for (const [frame, anchor] of [[images[phase.endpoint]!, motion.before], [images[phase.start]!, motion.after]] as [NativeRows, number[]][]) {
      const point = [0, 1].map(index => anchor[index]! + word.length * layer.step[index]);
      const occupied = programPixels(decodeProgramStacks(frame, layer, palette, exclusions), layer), [x, y] = point as [number, number];
      if (!(0 <= x && x <= frame[0]!.length - width && 0 <= y && y <= frame.length - height)) continue;
      const sample = Array.from({ length: height }, (_, b) => Array.from({ length: width }, (_, a) => occupied.has(`${x + a},${y + b}`) ? null : frame[y + b]![x + a]!));
      const known = sample.flat().filter(value => value !== null);
      if (known.length < width * height / 2 || new Set(known).size === 1 && known[0] === background) continue;
      templates.push({ values: sample, source_base: point, source_refs: phase.evidence, status: 'observed_survived_surface_appearance' });
    }
  }
  if (!templates.length) return null;
  const model: R = { layer, glyphs: glyph, interaction: interactions[0], moves, basis, surface_templates: templates,
    editor_geometry: geometry, acquisition_epoch: alignment.epoch, command_ref: alignment.command_ref,
    evidence_refs: [alignment.before_ref, alignment.after_ref], status: 'conditional_program_composition_model',
    uncertainties: ['Glyph extrapolation outside three observed translations.', 'Unknown interior supports are excluded, never assumed walkable.',
      'Outside the measured lattice extent, blocking is a boundary hypothesis.',
      'Larger-word reduction and stationary identical-label respondents are hypotheses; no universal terminal role.'] };
  model.model_id = `program-model:${programIdentity(model).slice(0, 20)}`;
  return model;
}

export function programCoordinates(point: readonly number[], origin: readonly number[], basis: readonly (readonly number[])[]): number[] | null {
  const x = point[0]! - origin[0]!, y = point[1]! - origin[1]!, [a, b] = basis;
  const determinant = a![0]! * b![1]! - a![1]! * b![0]!, u = x * b![1]! - y * b![0]!, v = a![0]! * y - a![1]! * x;
  if (!determinant) throw new RangeError('Program lattice requires a nonzero determinant');
  return u % determinant === 0 && v % determinant === 0 ? [Math.floor(u / determinant) || 0, Math.floor(v / determinant) || 0] : null;
}

export function programSurface(rows: NativeRows, model: R, objects: readonly R[], origin: readonly number[]): R | null {
  const height = rows.length, width = rows[0]!.length, occupied = programPixels(objects, model.layer), accepted = new Map<string, number[]>();
  const [a, b] = model.basis as number[][], exclusions: number[][] = [model.editor_geometry.member_column, model.editor_geometry.footer], extent = Math.max(width, height);
  for (let u = -extent; u <= extent; u++) for (let v = -extent; v <= extent; v++) {
    const x = origin[0]! + u * a![0]! + v * b![0]!, y = origin[1]! + u * a![1]! + v * b![1]!;
    if (!(0 <= x && x < width && 0 <= y && y < height) || exclusions.some(([left, top, right, bottom]) => left! <= x && x <= right! && top! <= y && y <= bottom!)) continue;
    for (const template of model.surface_templates as R[]) {
      const pattern: (number | null)[][] = template.values, th = pattern.length, tw = pattern[0]!.length;
      if (x + tw > width || y + th > height) continue;
      let pairs = 0, matched = true;
      pattern.forEach((row, j) => row.forEach((value, i) => {
        if (value !== null && !occupied.has(`${x + i},${y + j}`)) { pairs++; if (value !== rows[y + j]![x + i]) matched = false; }
      }));
      if (pairs >= tw * th / 2 && matched) { accepted.set(`${x},${y}`, [x, y]); break; }
    }
  }
  for (const object of objects) accepted.set(key(object.base), [...object.base]);
  const coords = [...accepted.values()].map(point => programCoordinates(point, origin, model.basis)).filter((point): point is number[] => point !== null);
  if (!coords.length) return null;
  const bounds = [0, 1].map(index => [Math.min(...coords.map(point => point[index]!)), Math.max(...coords.map(point => point[index]!))]);
  const sw = Math.max(...(model.layer.shape as number[][]).map(point => point[0]!)) + 1, sh = Math.max(...(model.layer.shape as number[][]).map(point => point[1]!)) + 1;
  const interiors = new Set<number>();
  for (const template of model.surface_templates as R[]) {
    const values = new Set<number>((template.values as (number | null)[][]).slice(0, sh).flatMap(row => row.slice(0, sw)).filter((value): value is number => value !== null));
    if (values.size === 1) interiors.add([...values][0]!);
  }
  for (let u = bounds[0]![0]!; u <= bounds[0]![1]!; u++) for (let v = bounds[1]![0]!; v <= bounds[1]![1]!; v++) {
    const x = origin[0]! + u * a![0]! + v * b![0]!, y = origin[1]! + u * a![1]! + v * b![1]!;
    if (!(0 <= x && x <= width - sw && 0 <= y && y <= height - sh)) continue;
    const values: number[] = [];
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) if (!occupied.has(`${x + i},${y + j}`)) values.push(rows[y + j]![x + i]!);
    if (values.length >= sw * sh / 2 && new Set(values).size === 1 && interiors.has(values[0]!)) accepted.set(`${x},${y}`, [x, y]);
  }
  return { points: [...accepted.values()].sort(pointOrder), origin, basis: model.basis, bounds,
    scope: 'Lattice extent from matched survived anchor patches; interiors from measured smaller role-support appearance. Decoded object pixels are occluded. Unmatched interior support is excluded; outside blocking remains a hypothesis.' };
}

export function simulateProgramWord(word: readonly number[], ownBase: readonly number[], targets: readonly R[], model: R, field: R, maxTurns: number): R | null {
  const move = new Map<number, number[]>((model.moves as R[]).map(operator => [operator.label, operator.vectors[0]]));
  const interaction = model.interaction, radius = new Set<string>((interaction.vectors as number[][]).map(key));
  let position = [...ownBase], counts = targets.map(target => target.word.length);
  const safe = new Set<string>((field.points as number[][]).map(key)), seen = new Set<string>(), turns: R[] = [];
  if (targets.some(target => (target.word as number[]).some(label => label !== interaction.label))) return null;
  for (let turn = 0; turn < maxTurns; turn++) {
    const state = JSON.stringify([position, counts]);
    if (seen.has(state)) return null;
    seen.add(state); const steps: R[] = [];
    for (const label of word) {
      const previous = position;
      let why: string;
      if (move.has(label)) {
        const delta = move.get(label)!, target = [position[0]! + delta[0]!, position[1]! + delta[1]!];
        if (targets.some((other, index) => counts[index] && equal(target, other.base))) return null;
        if (safe.has(key(target))) { position = target; why = 'matched_survived_surface'; }
        else {
          const coordinate = programCoordinates(target, field.origin, field.basis);
          if (coordinate === null || coordinate.every((value, index) => field.bounds[index][0] <= value && value <= field.bounds[index][1])) return null;
          why = 'conditional_outer_boundary_blocking';
        }
      } else if (label === interaction.label) {
        counts = counts.map((count, index) => radius.has(`${targets[index]!.base[0] - position[0]!},${targets[index]!.base[1] - position[1]!}`) ? Math.max(0, count - 1) : count);
        why = 'conditional_neighbor_reduction';
      } else return null;
      steps.push({ label, before: [...previous], after: [...position], remaining: [...counts], reason: why });
      if (!counts.some(Boolean)) {
        turns.push({ steps, base: [...position], remaining: [...counts] });
        return { turns, success: 'conditional_all_observed_other_words_reduced', not_official_success: true };
      }
    }
    if (targets.some((target, index) => counts[index] && radius.has(`${position[0]! - target.base[0]},${position[1]! - target.base[1]}`))) return null;
    turns.push({ steps, base: [...position], remaining: [...counts] });
  }
  return null;
}

/** itertools.product(labels, repeat), without eagerly allocating the domain. */
export function* programProducts(labels: readonly number[], repeat: number): IterableIterator<number[]> {
  if (!repeat) { yield []; return; }
  if (!labels.length) return;
  const indices = Array<number>(repeat).fill(0);
  for (;;) {
    yield indices.map(index => labels[index]!);
    let index = repeat - 1;
    while (index >= 0 && indices[index] === labels.length - 1) { indices[index] = 0; index--; }
    if (index < 0) return;
    indices[index] = indices[index]! + 1;
  }
}

export interface ProgramSearchOptions {
  max_new_actions: number;
  deadline: number;
  now?: () => number;
  /** Explicit native extension: only newly inserted labels are restricted.
   * The learned model and the operators already present in any word remain
   * unchanged. Omission preserves the original Python search domain. */
  insertable_labels?: readonly number[];
}

export function searchProgram(existing: readonly number[], ownBase: readonly number[], targets: readonly R[], model: R, field: R, options: ProgramSearchOptions): R {
  if (targets.some(target => (target.word as number[]).some(label => label !== model.interaction.label))) {
    return { status: 'unknown', reason: 'unvalidated_respondent_operator', nodes: 0, plan: null };
  }
  const prefix = [...existing].reverse(), labels = [...new Set<number>([...(model.moves as R[]).map(operator => operator.label), model.interaction.label])]
    .sort((a, b) => a - b).filter(label => options.insertable_labels === undefined || options.insertable_labels.includes(label));
  if (options.insertable_labels !== undefined && targets.some(target => target.word.length > 0)
    && !prefix.includes(model.interaction.label) && !labels.includes(model.interaction.label)) {
    return { status: 'unknown', reason: 'no_insertable_or_retained_reduction_operator', nodes: 0, plan: null,
      scope: 'Native current-input search bound: the retained own word and all available insertions lack the only operator that can reduce these stationary target words under this simulator. No game-level impossibility is inferred.' };
  }
  const now = options.now ?? (() => performance.now() / 1000);
  let best: R | null = null, nodes = 0;
  for (let length = Math.max(1, prefix.length); length <= prefix.length + Math.min(15, options.max_new_actions - 1); length++) {
    const edits = length - prefix.length;
    if (best && edits + 1 >= best.cost) break;
    for (const suffix of programProducts(labels, edits)) {
      nodes++;
      if (now() >= options.deadline) return { status: 'level_deadline', nodes, best };
      const word = [...prefix, ...suffix], candidate = simulateProgramWord(word, ownBase, targets, model, field, options.max_new_actions - edits);
      if (candidate) {
        const cost = edits + candidate.turns.length, entry: R = { word, edits: suffix, cost, prediction: candidate };
        if (best === null || cost < best.cost || cost === best.cost && (word.length < best.word.length || word.length === best.word.length && wordOrder(word, best.word) < 0)) best = entry;
      }
    }
  }
  return { status: best ? 'proposed' : 'unknown', nodes, plan: best,
    scope: 'Minimum external command count among enumerated prefix-preserving words under the stated conditional model; no oracle optimum or game success claim.' };
}
