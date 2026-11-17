import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { markerDisplacement, singleChangedPoint } from './observed-click-regions.ts';

export const layeredFitId = 'sic_layered_fit';
export const learnLayeredFitId = 'sic_learn_layered_fit';
type Part = ReturnType<typeof geometricComponents>[number];
type Pane = { color: number; box: NativeBox; points: NativePoint[] };
type Blend = { color: number; layers: number[] };
type LayerRelation = { colors: number[]; mixed: number; learnedAt: number; evidence: string[]; motionStep?: number; blends?: Blend[] };
type Scene = { panes: Pane[]; canvas: NativeBox; reference: NativeBox; mixed: number; empty: number; reuseRefs?: string[];
  composite?: { step: number; possibilities: Blend[][]; occlusion?: { frame: NativeBox; ink: number } } };
type Stage = 'select' | 'measure' | 'fit';
type State = { epoch: number; scene: Scene; index: number; stage: Stage; marker: NativePoint | null; remaining: string[]; refs: string[]; failed: boolean;
  motionStep?: number; activeBox?: NativeBox };
type Proposal = NativeProposal & { local: State; pane: Pane; stage: Stage; delta: NativePoint | null; marker: NativePoint | null; needId: string };

const dirs = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => x >= l && y >= t && x <= r && y <= b;
const mid = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const inset = ([l, t, r, b]: NativeBox): NativeBox => [l + 1, t + 1, r - 1, b - 1];

function colorsIn(rows: NativeRows, region: NativeBox): Map<number, NativePoint[]> {
  const map = new Map<number, NativePoint[]>();
  const [l, t, r, b] = region;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const c = rows[y]?.[x];
    if (c === undefined) continue;
    const cells = map.get(c) ?? [];
    cells.push([x, y]);
    map.set(c, cells);
  }
  return map;
}

function findFrames(parts: Part[], rows: NativeRows): NativeBox[] {
  const seen = new Map<string, NativeBox>();
  const colors = new Set(parts.filter(p => width(p.bbox) === 12 && height(p.bbox) >= 11 && p.area >= 30 && p.area <= 45).map(p => p.color));
  for (const p of parts) {
    if (!colors.has(p.color) || width(p.bbox) !== 12 || height(p.bbox) < 11 || height(p.bbox) > 12) continue;
    const [l, t, r, b] = p.bbox;
    for (const top of [t, b - 11]) {
      if (top < 0 || top + 11 >= rows.length) continue;
      const edge = p.mask.filter(([dx, dy]) => dx === 0 || dx === 11 || t + dy === top || t + dy === top + 11).length;
      if (edge >= 30 && edge === p.area) seen.set([l, top, r, top + 11].join(','), [l, top, r, top + 11]);
    }
  }
  return [...seen.values()].sort((a, b) => a[1] - b[1]);
}

function initial(rows: NativeRows, relation?: LayerRelation): Scene | null {
  const parts = geometricComponents(rows), frames = findFrames(parts, rows);
  if (frames.length !== 2) return null;
  const canvas = inset(frames[0]!), reference = inset(frames[1]!);
  if (canvas[3] >= reference[1]) return null;
  const target = colorsIn(rows, reference);
  const current = colorsIn(rows, canvas);
  if (current.size !== 1) return null;
  const empty = [...current.keys()][0]!;
  const reuse = relation?.colors.length === 2 && target.has(relation.mixed) && relation.mixed !== empty && !relation.colors.includes(empty)
    && [...target.keys()].every(color => color === empty || color === relation.mixed || relation.colors.includes(color))
    ? relation : null;
  if (!reuse && (target.size !== 4 || !target.has(empty))) return null;
  const field: NativeBox = [0, 0, rows[0]!.length - 1, reference[1] - 2];
  const colors = colorsIn(rows, field);
  const available = [...target.keys()].filter(c => c !== empty);
  const panes: Pane[] = [];
  for (const color of reuse?.colors ?? available) {
    const choices = parts.filter(p => p.color === color && p.area > 2 * width(canvas) * height(canvas) && p.bbox[3] < field[3]);
    if (choices.length !== 1) continue;
    panes.push({ color, box: choices[0]!.bbox, points: colors.get(color) ?? [] });
  }
  const mixed = reuse ? [reuse.mixed] : available.filter(c => !panes.some(p => p.color === c));
  if (panes.length !== 2 || mixed.length !== 1) return null;
  panes.sort((a, b) => (a.box[0] > 0 && a.box[1] > 0 ? 1 : 0) - (b.box[0] > 0 && b.box[1] > 0 ? 1 : 0));
  return { panes, canvas, reference, empty, mixed: mixed[0]!, ...(reuse ? { reuseRefs: reuse.evidence } : {}) };
}

function selectionPoint(pane: Pane): NativePoint {
  const c = mid(pane.box);
  return pane.points.reduce((a, b) => {
    const dist = (p: NativePoint) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]);
    return dist(a) <= dist(b) ? a : b;
  }, pane.points[0]!);
}

function firstDirection(pane: Pane, scene: Scene) {
  const [x, y] = mid(pane.box), [u, v] = mid(scene.canvas);
  const horizontal = Math.abs(x - u) > Math.abs(y - v);
  return horizontal ? dirs[x < u ? 3 : 2]! : dirs[y < v ? 1 : 0]!;
}

function fitPane(rows: NativeRows, pane: Pane, scene: Scene, [dx, dy]: NativePoint): string[] | null {
  const area: NativeBox = [0, 0, rows[0]!.length - 1, scene.reference[1] - 2];
  const known = colorsIn(rows, area);
  const translated = [...(known.get(pane.color) ?? []), ...(known.get(scene.mixed) ?? [])];
  const absolute = [...new Map([...pane.points.map(([x, y]): NativePoint => [x + dx, y + dy]), ...translated].map(p => [key(p), p])).values()];
  const target = new Set<string>(), reference = colorsIn(rows, scene.reference);
  for (const color of [pane.color, scene.mixed]) {
    for (const [a, b] of reference.get(color) ?? []) {
      target.add(key([a - scene.reference[0] + scene.canvas[0], b - scene.reference[1] + scene.canvas[1]]));
    }
  }
  const pitch = Math.abs(dx) + Math.abs(dy);
  return fitProjection(absolute, target, scene.canvas, pitch);
}

function fitProjection(absolute: NativePoint[], target: ReadonlySet<string>, canvas: NativeBox, pitch: number,
  occluded: readonly NativePoint[] = []) {
  let x = Infinity, y = Infinity;
  for (const p of absolute) { x = Math.min(x, p[0]); y = Math.min(y, p[1]); }
  if (!Number.isFinite(x) || absolute.length > 1200 || pitch < 1) return null;
  let shape = absolute.map(([a, b]): NativePoint => [a - x, b - y]);
  let uncertain = occluded.map(([a, b]): NativePoint => [a - x, b - y]);
  let best: string[] | null = null;
  for (let turn = 0; turn < 4; turn++) {
    for (let row = -12; row <= 12; row++) for (let col = -12; col <= 12; col++) {
      const length = turn + Math.abs(row) + Math.abs(col);
      if (best && best.length <= length) continue;
      const origin: NativePoint = [x + col * pitch, y + row * pitch];
      if (origin[0] > canvas[2] || origin[1] > canvas[3]) continue;
      const cut = shape.map(([a, b]): NativePoint => [a + origin[0], b + origin[1]]).filter(p => inside(canvas, p));
      if (cut.length > target.size || cut.some(p => !target.has(key(p)))) continue;
      if (cut.length < target.size) {
        if (!uncertain.length) continue;
        const possible = new Set([...cut.map(key), ...uncertain.map(([a, b]) => key([a + origin[0], b + origin[1]]))]);
        if ([...target].some(point => !possible.has(point))) continue;
      }
      best = [...Array<string>(Math.abs(row)).fill(row < 0 ? 'ACTION1' : 'ACTION2'),
        ...Array<string>(Math.abs(col)).fill(col < 0 ? 'ACTION3' : 'ACTION4'), ...Array<string>(turn).fill('ACTION5')];
    }
    const bottom = Math.max(...shape.map(p => p[1]));
    shape = shape.map(([a, b]): NativePoint => [bottom - b, a]);
    uncertain = uncertain.map(([a, b]): NativePoint => [bottom - b, a]);
  }
  return best;
}

function paneMatches(rows: NativeRows, scene: Scene, pane: Pane, marker: NativePoint | null): boolean {
  const field = colorsIn(rows, scene.canvas), expected = colorsIn(rows, scene.reference);
  const wanted = new Set([pane.color, scene.mixed].flatMap(c => (expected.get(c) ?? [])
    .map(([x, y]) => key([x - scene.reference[0] + scene.canvas[0], y - scene.reference[1] + scene.canvas[1]]))));
  const actual = new Set([pane.color, scene.mixed].flatMap(c => (field.get(c) ?? []).map(key)));
  if (marker && inside(scene.canvas, marker)) {
    actual.delete(key(marker));
    wanted.delete(key(marker));
  }
  return wanted.size === actual.size && [...wanted].every(p => actual.has(p));
}

function bounds(points: NativePoint[]): NativeBox {
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
}

const workArea = (rows: NativeRows, reference: NativeBox): NativeBox => [0, 0, rows[0]!.length - 1, reference[1] - 2];
const clipped = (pane: Pane, area: NativeBox) => pane.box.some((edge, index) => edge === area[index]);

function targetLayer(reference: Map<number, NativePoint[]>, scene: Scene, palette: readonly number[]) {
  return new Set(palette.flatMap(color => (reference.get(color) ?? [])
    .map(([x, y]) => key([x - scene.reference[0] + scene.canvas[0], y - scene.reference[1] + scene.canvas[1]]))));
}

const layerPalette = (pane: Pane, blends: readonly Blend[]) =>
  [pane.color, ...blends.filter(blend => blend.layers.includes(pane.color)).map(blend => blend.color)];

function outlinePoints([l, t, r, b]: NativeBox): NativePoint[] {
  const points: NativePoint[] = [];
  for (let x = l; x <= r; x++) points.push([x, t], [x, b]);
  for (let y = t + 1; y < b; y++) points.push([l, y], [r, y]);
  return points;
}

function frameOcclusion(rows: NativeRows, frame: NativeBox) {
  const outline = outlinePoints(frame), counts = new Map<number, number>();
  for (const [x, y] of outline) {
    const ink = rows[y]![x]!;
    counts.set(ink, (counts.get(ink) ?? 0) + 1);
  }
  const dominant = [...counts].find(([, count]) => count >= outline.length * 0.75);
  return dominant && { frame, ink: dominant[0] };
}

function unobservedLayerPoints(rows: NativeRows, box: NativeBox, scene: Scene, marker: NativePoint | null = null): NativePoint[] {
  const cover = scene.composite?.occlusion;
  if (!cover) return [];
  const points = outlinePoints(cover.frame).filter(([x, y]) => rows[y]?.[x] === cover.ink && inside(box, [x, y]));
  if (marker && inside(box, marker) && !points.some(point => same(point, marker))) points.push(marker);
  return points;
}

function initialComposite(rows: NativeRows, relation: LayerRelation | undefined): Scene | null {
  const step = relation?.motionStep;
  if (!relation || !step) return null;
  const parts = geometricComponents(rows), frames = findFrames(parts, rows);
  if (frames.length !== 2) return null;
  const canvas = inset(frames[0]!), reference = inset(frames[1]!);
  if (canvas[3] >= reference[1]) return null;
  const area = workArea(rows, reference), field = colorsIn(rows, area), target = colorsIn(rows, reference);
  const empty = [...field].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  if (empty === undefined || !target.has(empty) || relation.colors.includes(empty)) return null;
  const known = relation.blends ?? [{ color: relation.mixed, layers: relation.colors }];
  const primaries = [...new Set([...relation.colors, ...[...target.keys()].filter(color => color !== empty
    && !known.some(blend => blend.color === color) && (field.get(color)?.length ?? 0) > width(canvas) * height(canvas))])];
  if (primaries.length !== 3 || primaries.some(color => !(field.get(color)?.length))) return null;
  const panes = primaries.map(color => ({ color, points: field.get(color)!, box: bounds(field.get(color)!) }))
    .sort((a, b) => Number(clipped(a, area)) - Number(clipped(b, area)));
  const scene: Scene = { panes, canvas, reference, empty, mixed: relation.mixed, reuseRefs: relation.evidence };
  const unknown = [...target.keys()].filter(color => color !== empty && !primaries.includes(color)
    && !known.some(blend => blend.color === color));
  const masks = Array.from({ length: 1 << primaries.length }, (_, mask) => primaries.filter((_, i) => mask & (1 << i)))
    .filter(layers => layers.length > 1 && !known.some(blend => blend.layers.length === layers.length
      && layers.every(layer => blend.layers.includes(layer))));
  if (unknown.length > masks.length) return null;
  let possibilities = [known];
  for (const color of unknown) possibilities = possibilities.flatMap(blends => masks
    .filter(layers => !blends.some(blend => blend.layers === layers)).map(layers => [...blends, { color, layers }]));
  const fits = (candidate: Scene) => possibilities.filter(blends => panes.every(pane => {
    if (clipped(pane, area)) return true;
    const palette = layerPalette(pane, blends), points = palette.flatMap(color => field.get(color) ?? []);
    const wanted = targetLayer(target, scene, palette);
    return wanted.size > 0 && fitProjection(points, wanted, canvas, step, unobservedLayerPoints(rows, bounds(points), candidate)) !== null;
  }));
  const compatible = fits(scene);
  if (compatible.length) return { ...scene, composite: { step, possibilities: compatible } };
  const occlusion = frameOcclusion(rows, frames[0]!);
  if (!occlusion) return null;
  const occludedScene = { ...scene, composite: { step, possibilities, occlusion } };
  const uncertain = fits(occludedScene);
  return uncertain.length ? { ...occludedScene, composite: { step, possibilities: uncertain, occlusion } } : null;
}

function unchangedLayers(first: NativeRows, second: NativeRows, scene: Scene, moved: Pane, blends: readonly Blend[],
  previousMarker?: NativePoint | null, marker?: NativePoint | null) {
  const membership = new Map<number, number>([[scene.empty, 0]]);
  scene.panes.forEach((pane, i) => membership.set(pane.color, 1 << i));
  for (const blend of blends) membership.set(blend.color, blend.layers.reduce((mask, color) => mask | membership.get(color)!, 0));
  const moving = membership.get(moved.color)!;
  const bottom = workArea(second, scene.reference)[3];
  for (let y = 0; y <= bottom; y++) for (let x = 0; x < second[y]!.length; x++) {
    if (previousMarker?.[0] === x && previousMarker[1] === y || marker?.[0] === x && marker[1] === y) continue;
    const a = membership.get(first[y]![x]!), b = membership.get(second[y]![x]!);
    if (a !== undefined && b !== undefined && ((a ^ b) & ~moving)) return false;
  }
  return true;
}

function planComposite(first: NativeRows, second: NativeRows, local: State, pane: Pane, marker: NativePoint, delta?: NativePoint): State {
  const { scene } = local, { step, possibilities, occlusion } = scene.composite!;
  const measured = delta ? second : first;
  const observedMarker = occlusion ? delta ? marker : local.marker : null;
  const current = colorsIn(measured, workArea(first, scene.reference));
  const ref = colorsIn(second, scene.reference);
  const readings = possibilities.flatMap(blends => {
    if (delta && !unchangedLayers(first, second, scene, pane, blends, occlusion ? local.marker : null, observedMarker)) return [];
    const palette = layerPalette(pane, blends);
    const moved = delta ? pane.points.map(([x, y]): NativePoint => [x + delta[0], y + delta[1]]) : [];
    const visible = palette.flatMap(color => current.get(color) ?? []).filter(point => !observedMarker || !same(point, observedMarker));
    const recovered = [...new Map([...moved, ...visible].map(p => [key(p), p])).values()];
    const box = bounds(recovered);
    const wanted = targetLayer(ref, scene, palette);
    const route = wanted.size ? fitProjection(recovered, wanted, scene.canvas, step, unobservedLayerPoints(measured, box, scene, observedMarker)) : null;
    return [{ blends, route, pane: { ...pane, points: recovered, box } }];
  });
  const plans = readings.filter(reading => reading.route !== null);
  const remaining = plans[0]?.route;
  if (!remaining || plans.some(plan => plan.route!.join(',') !== remaining.join(','))) {
    const reading = readings.length === 1 ? readings[0] : null;
    if (occlusion && delta && reading && clipped(reading.pane, workArea(second, scene.reference))
      && reading.pane.points.length > pane.points.length) {
      const panes = scene.panes.slice();
      panes[local.index] = reading.pane;
      return { ...local, scene: { ...scene, panes, composite: { ...scene.composite!, possibilities: [reading.blends] } }, marker };
    }
    return { ...local, failed: true };
  }
  const fitted = { ...scene, composite: { ...scene.composite!, possibilities: plans.map(plan => plan.blends) } };
  const activeBox = occlusion ? plans[0]!.pane.box : undefined;
  return remaining.length
    ? { ...local, scene: fitted, stage: 'fit', remaining, marker, ...(activeBox ? { activeBox } : {}) }
    : { ...local, scene: fitted, index: local.index + 1, stage: 'select', remaining, marker: occlusion ? marker : null };
}

function movedSelection(box: NativeBox, marker: NativePoint | null, command: string, step: number) {
  const [l, t, r, b] = box;
  if (command === 'ACTION5') return {
    box: [l, t, l + b - t, t + r - l] as NativeBox,
    marker: marker ? [l + b - marker[1], t + marker[0] - l] as NativePoint : null,
  };
  const direction = dirs.find(([input]) => input === command);
  if (!direction) return { box, marker };
  const dx = direction[1] * step, dy = direction[2] * step;
  return { box: [l + dx, t + dy, r + dx, b + dy] as NativeBox,
    marker: marker ? [marker[0] + dx, marker[1] + dy] as NativePoint : null };
}

function observeComposite(first: NativeRows, second: NativeRows, proposal: Pick<Proposal, 'local' | 'pane' | 'marker' | 'stage'>): State {
  const { local, pane, marker, stage } = proposal, { scene } = local;
  const { step, possibilities, occlusion } = scene.composite!;
  if (stage === 'select') {
    const selection = selectionMarker(first, second, pane, scene, occlusion ? marker : null);
    if (!selection) return { ...local, failed: true };
    return clipped(pane, workArea(first, scene.reference))
      ? { ...local, stage: 'measure', marker: selection }
      : planComposite(first, second, local, pane, selection);
  }
  if (stage === 'measure' && marker) {
    const [, dx, dy] = firstDirection(pane, scene), delta = markerDisplacement(first, second, marker, [dx, dy], step);
    return delta ? planComposite(first, second, local, pane, [marker[0] + delta[0], marker[1] + delta[1]], delta)
      : { ...local, failed: true };
  }
  const field = colorsIn(second, scene.canvas), ref = colorsIn(second, scene.reference);
  const markerColor = marker ? first[marker[1]]?.[marker[0]] : undefined;
  const projected = local.activeBox ? movedSelection(local.activeBox, marker, local.remaining[0]!, step) : null;
  const marks = projected || markerColor === undefined ? [] : colorsIn(second, workArea(second, scene.reference)).get(markerColor) ?? [];
  const [x, y] = projected?.marker ?? [-1, -1];
  const visibleMarker = projected ? markerColor !== undefined && second[y]?.[x] === markerColor ? projected.marker : null
    : marks.length === 1 ? marks[0]! : null;
  const remaining = local.remaining.slice(1), limit = local.index + Number(!remaining.length);
  const consistent = possibilities.filter(blends => unchangedLayers(first, second, scene, pane, blends,
    occlusion ? marker : null, occlusion ? visibleMarker : null)
    && scene.panes.slice(0, limit).every(settled => {
      const palette = layerPalette(settled, blends), target = targetLayer(ref, scene, palette);
      const actual = new Set(palette.flatMap(color => (field.get(color) ?? []).map(key)));
      if (visibleMarker) { actual.delete(key(visibleMarker)); target.delete(key(visibleMarker)); }
      return target.size === actual.size && [...target].every(point => actual.has(point));
    }));
  const failed = !consistent.length || first.every((row, y) => row.every((color, x) => color === second[y]?.[x]));
  return { ...local, scene: { ...scene, composite: { ...scene.composite!, possibilities: consistent } }, failed,
    index: remaining.length ? local.index : local.index + Number(!failed), stage: remaining.length ? 'fit' : 'select',
    remaining, marker: remaining.length || occlusion ? visibleMarker : null, ...(projected ? { activeBox: projected.box } : {}) };
}

export function createSicLayeredFit(family = layeredFitId): NativeFamily<Proposal> {
  const learns = family === learnLayeredFitId;
  let memory: State | null = null;
  let relation: LayerRelation | undefined;
  return {
    id: family,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'].every(ref => observation.available_action_refs.includes(ref))) return null;
      const prior = memory?.epoch === observation.level_epoch ? memory : null;
      const preceding = relation?.learnedAt === observation.level_epoch - 1 ? relation : undefined;
      const marker = learns && !prior ? execution?.readClickMarker?.() : null;
      const click = marker?.afterRef === observation.observation_ref && marker.levelEpoch === observation.level_epoch ? marker : null;
      if (learns && !prior && !preceding && !click) return null;
      const scene = prior?.scene ?? initial(rows, preceding) ?? initialComposite(rows, preceding);
      if (!scene || prior?.failed) return null;
      if (learns && !prior && !scene.reuseRefs && !click) return null;
      if (click && (!inside(scene.panes[0]!.box, click.point) || !inside(scene.panes[0]!.box, click.marker)
        || scene.panes.some(pane => pane.color === click.value && pane.points.length > 1))) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, scene, index: 0, stage: click ? 'measure' : 'select',
        marker: click?.marker ?? null, remaining: [], refs: click ? [click.beforeRef, click.afterRef] : [], failed: false };
      const pane = scene.panes[local.index];
      if (!pane) return null;
      const direction = firstDirection(pane, scene);
      const target = local.stage === 'select' ? selectionPoint(pane) : null;
      const action_ref = local.stage === 'select' ? 'ACTION6' : local.stage === 'measure' ? direction[0] : local.remaining[0];
      if (!action_ref) return null;
      const action: NativeCommand = { action_ref, data: target ? { x: target[0], y: target[1] } : {} };
      const ref = observation.observation_ref;
      const refs = [...local.refs, ...(scene.reuseRefs ?? [])];
      const evidence: [string, ...string[]] = [ref, ...new Set(refs.filter(r => r !== ref))];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: action_ref, expected: target, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: local.stage === 'fit' ? null : offer,
        access: local.stage === 'fit' ? offer : null, interaction: null });
      if (!selected) return null;
      const witness = target ? await ObservedInputDomain.makeLocusWitness(observation, rows, target, { reason: 'Select a visible pane', evidence }) : null;
      if (target && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'fit_layer_to_reference', scope: ref.split(':revision:', 1)[0]!, subjects: ['pane:' + local.index],
        parentObjective: parent, satisfactionContract: 'visible_color_layer_matches_reference' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = family + ':' + need.id;
      const completesOverlap = scene.composite?.occlusion && local.index === scene.panes.length - 1
        && scene.composite.possibilities.every(blends => blends.some(blend => blend.layers.length === scene.panes.length));
      const situation = local.stage === 'select' ? scene.composite
        ? 'Select the next pane while preserving the layers already aligned to the reference'
        : scene.reuseRefs
        ? 'Both layers are visible again. Reuse the confirmed overlap rule and measure this layer in the new layout'
        : 'Select the visible pane and locate its selection marker'
        : local.stage === 'measure' ? 'Measure one translation and recover the portion hidden at the edge'
          : completesOverlap ? 'Align the final pane to complete the colors formed by all three layers'
            : 'Apply the next measured transform toward the matching reference layer';
      return { status: 'proposed', kind: family, local, pane, stage: local.stage, marker: local.marker,
        delta: local.stage === 'measure' ? [direction[1], direction[2]] : null, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: null, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Match the visible superposition to the reference', situation, evidence, agenda: entries, mode,
          triggerCard: card, pane: pane.box, canvas: scene.canvas, reference: scene.reference,
          marker: local.marker ? [...local.marker, ...local.marker] : null },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'layer_transform_bound' : 'layer_observation_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const next = observeReturn(first, second, proposal);
      return { matched: !next.failed, seal_prefix: true, reason: next.failed ? 'layer_prediction_not_confirmed'
        : next.index > proposal.local.index ? 'reference_layer_confirmed' : proposal.stage === 'select' ? 'selection_marker_confirmed'
          : proposal.stage === 'measure' ? 'translation_and_candidate_shape_confirmed' : 'observed_transform_changed_layer',
        ...(next.index > proposal.local.index ? { sic_need: { id: proposal.needId, status: 'satisfied' as const } } : {}) };
    },
    record(before, after, _action, first, second, proposal) {
      if (after.levels_completed > before.levels_completed) {
        const { panes, mixed, composite } = proposal.local.scene;
        const step = composite?.step ?? proposal.local.motionStep;
        const blends = composite?.possibilities[0]?.filter(blend => composite.possibilities.every(choice => choice.some(candidate =>
          candidate.color === blend.color && candidate.layers.length === blend.layers.length
          && blend.layers.every(layer => candidate.layers.includes(layer)))));
        relation = { colors: panes.map(pane => pane.color), mixed, learnedAt: before.level_epoch,
          evidence: [before.observation_ref, after.observation_ref], ...(step ? { motionStep: step } : {}), ...(blends ? { blends } : {}) };
        return { events: [], reviewEvidence: composite ? 'Official advancement confirmed the fit of the composed layers.'
          : 'Official advancement confirmed the fit of the two overlapping layers.' };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const next = observeReturn(first, second, proposal);
      memory = { ...next, refs: [...next.refs.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ memory, relation: relation ?? null }),
    restore(value: NativeRecord) {
      memory = structuredClone(value.memory as State | null);
      relation = value.relation ? structuredClone(value.relation as LayerRelation) : undefined;
    },
  };
}

function observeReturn(first: NativeRows, second: NativeRows, { local, pane, stage, marker }: Proposal): State {
  if (local.scene.composite) return observeComposite(first, second, { local, pane, stage, marker });
  if (stage === 'select') {
    const next = selectionMarker(first, second, pane, local.scene);
    return { ...local, stage: 'measure', marker: next, failed: !next };
  }
  if (stage === 'measure' && marker) {
    const [, dx, dy] = firstDirection(pane, local.scene);
    const delta = markerDisplacement(first, second, marker, [dx, dy], 12);
    const fit = delta && fitPane(second, pane, local.scene, delta);
    return { ...local, stage: 'fit', marker: delta ? [marker[0] + delta[0], marker[1] + delta[1]] : null,
      remaining: fit ?? [], failed: !fit?.length, ...(delta ? { motionStep: Math.abs(delta[0]) + Math.abs(delta[1]) } : {}) };
  }
  const remaining = local.remaining.slice(1);
  const markerColor = marker ? first[marker[1]]?.[marker[0]] : undefined;
  const spots = markerColor === undefined ? [] : colorsIn(second, [0, 0, second[0]!.length - 1, local.scene.reference[1] - 2]).get(markerColor) ?? [];
  const nextMarker = spots.length === 1 ? spots[0]! : null;
  if (remaining.length) return { ...local, marker: nextMarker, remaining, failed: first.every((row, y) => row.every((c, x) => second[y]?.[x] === c)) };
  const matched = paneMatches(second, local.scene, pane, nextMarker);
  return { ...local, index: local.index + Number(matched), stage: 'select', marker: null, remaining: [], failed: !matched };
}

function selectionMarker(first: NativeRows, rows: NativeRows, pane: Pane, scene: Scene, previous?: NativePoint | null): NativePoint | null {
  const point = singleChangedPoint(first, rows);
  if (point) return point;
  if (previous) {
    const [l, t, r, b] = pane.box;
    const changed: NativePoint[] = [];
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      if ((x !== previous[0] || y !== previous[1]) && first[y]?.[x] !== rows[y]?.[x]) changed.push([x, y]);
    }
    if (changed.length === 1) return changed[0]!;
  }
  const palette = new Set([scene.empty, scene.mixed, ...scene.panes.map(p => p.color),
    ...(scene.composite?.possibilities.flatMap(blends => blends.map(blend => blend.color)) ?? [])]);
  const candidates = geometricComponents(rows).filter(p => p.area === 1 && !palette.has(p.color)
    && inside(pane.box, mid(p.bbox)) && first[p.bbox[1]]?.[p.bbox[0]] !== p.color);
  return candidates.length === 1 ? mid(candidates[0]!.bbox) : null;
}
