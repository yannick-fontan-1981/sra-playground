import { fitOccludedCatalogue } from '../logos-engine/v6-occluded-catalogue-observation.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { CatalogueSlot, SlottedCatalogue } from './catalogue-slots.ts';

type Alternative = { card: number; above: number };
type Subject = { palette: number; origin: NativePoint; scale: number; cards: CatalogueSlot[]; options: Alternative[] };
export type JointCatalogue = { epoch: number; lastRef: string; subjects: Subject[]; submitted: number[];
  step: number | null; tried: string[]; evidence: string[]; stopped: boolean };
export type JointCatalogueAction = { kind: 'select' | 'move' | 'submit'; action: NativeCommand; palette: number; box: NativeBox;
  card?: number; revealed?: number[] };
export type JointCatalogueReturn = { local: JointCatalogue; reason: string; matched: boolean };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const click = ([x, y]: NativePoint): NativeCommand => ({ action_ref: 'ACTION6', data: { x, y } });
const sign = (action: NativeCommand) => action.action_ref === 'ACTION3' ? -1 : 1;
const paletteBit = (scene: SlottedCatalogue, ink: number) => {
  const index = scene.controls.findIndex(control => control.palette === ink);
  return index >= 0 ? 1 << index : 0;
};
const footprint = (subject: Subject): NativeBox => {
  const [x, y] = subject.origin, { scale, cards, options } = subject;
  return [x, y, x + Math.max(...options.map(option => cards[option.card]!.extent[0])) * scale - 1,
    y + Math.max(...options.map(option => cards[option.card]!.extent[1])) * scale - 1];
};
const sameCards = (a: readonly CatalogueSlot[], b: readonly CatalogueSlot[]) =>
  same(a.map(card => [card.mask, card.extent]), b.map(card => [card.mask, card.extent]));

function readSubject(rows: NativeRows, scene: SlottedCatalogue, retained?: Subject): Subject | null {
  if (retained && !sameCards(retained.cards, scene.cards)) return null;
  const fits = fitOccludedCatalogue(rows, scene, [scene.background]).filter(fit => !retained
    || retained.options.some(option => option.card === fit.candidate) && retained.scale === fit.scale && retained.origin[1] === fit.translation[1]);
  if (!fits.length || fits.some(fit => fit.scale !== fits[0]!.scale || !same(fit.translation, fits[0]!.translation))) return null;
  const options = fits.map(fit => ({ card: fit.candidate,
    above: retained?.options.find(option => option.card === fit.candidate)?.above ?? 0 }));
  return { palette: scene.palette, origin: fits[0]!.translation, scale: fits[0]!.scale, cards: scene.cards, options };
}

function placed(subject: Subject, card: number, width: number): number[] {
  const points = [], { scale, origin: [x, y], cards } = subject;
  for (const [a, b] of cards[card]!.mask) for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
    points.push((y + b * scale + dy) * width + x + a * scale + dx);
  }
  return points;
}

function depthOrder(subjects: readonly Subject[], scene: SlottedCatalogue): number[] {
  const above = scene.controls.map(({ palette }) => subjects.find(subject =>
    subject.palette === palette)?.options.reduce((common, option) => common & option.above, (1 << scene.controls.length) - 1) ?? 0);
  for (let middle = 0; middle < above.length; middle++) for (let low = 0; low < above.length; low++) {
    if (above[low]! & (1 << middle)) above[low] = above[low]! | above[middle]!;
  }
  return above;
}

function constrain(rows: NativeRows, scene: SlottedCatalogue, subjects: readonly Subject[]): Subject[] | null {
  const [l, t, r, b] = scene.field, width = rows[0]!.length;
  let next = subjects.map(subject => {
    const visible: number[] = [];
    const { palette } = subject;
    for (let y = t + 1; y < b; y++) for (let x = l + 1; x < r; x++) if (rows[y]![x] === palette) visible.push(y * width + x);
    const options = subject.options.flatMap(option => {
      const coverage = new Set(placed(subject, option.card, width));
      if (!visible.every(pixel => coverage.has(pixel))) return [];
      let above = option.above;
      for (const pixel of coverage) {
        const x = pixel % width, y = Math.floor(pixel / width), ink = rows[y]?.[x];
        if (x <= l || x >= r || y <= t || y >= b || ink === scene.background) return [];
        if (ink !== undefined && ink !== palette) above |= paletteBit(scene, ink);
      }
      return [{ ...option, above }];
    });
    return { ...subject, options };
  });
  for (;;) {
    if (next.some(subject => !subject.options.length)) return null;
    const order = depthOrder(next, scene);
    if (order.some((mask, index) => mask & (1 << index))) return null;
    const revised = next.map(subject => {
      const subjectBit = paletteBit(scene, subject.palette);
      return { ...subject, options: subject.options.filter(({ above }) =>
        !order.some((mask, i) => (above & (1 << i)) !== 0 && (mask & subjectBit) !== 0)) };
    });
    if (revised.every((subject, i) => subject.options.length === next[i]!.options.length)) return revised;
    next = revised;
  }
}

export function observeCatalogueSubject(local: JointCatalogue, scene: SlottedCatalogue, rows: NativeRows): JointCatalogue | null {
  if (local.subjects.some(subject => subject.palette === scene.palette)) return local;
  const subject = readSubject(rows, scene);
  if (!subject) return null;
  const subjects = constrain(rows, scene, [...local.subjects, subject]);
  return subjects ? { ...local, subjects } : null;
}

function catalogueInformation(local: JointCatalogue, scene: SlottedCatalogue, rows: NativeRows) {
  const order = depthOrder(local.subjects, scene), width = rows[0]!.length, [l, t, r, b] = scene.field;
  const used = new Set([scene.background, ...scene.controls.map(control => control.palette)]);
  const fixed = new Set<number>();
  for (let y = t + 1; y < b; y++) for (let x = l + 1; x < r; x++) if (!used.has(rows[y]![x]!)) fixed.add(y * width + x);
  const all = local.subjects.map(subject => ({ subject, knownAbove: order[scene.controls.findIndex(c => c.palette === subject.palette)]!,
    bit: paletteBit(scene, subject.palette), options: subject.options.map(choice => placed(subject, choice.card, width)) }));
  return (mover: Subject, destination: number) => {
    const deltaX = destination - mover.origin[0];
    const world = all.map(layer => layer.subject !== mover ? layer : {
      ...layer, options: layer.options.map(pixels => pixels.map(pixel => pixel + deltaX)),
    });
    const revealed: number[] = [];
    let gain = 0;
    for (const { subject, options, bit } of world) {
      if (options.length < 2) continue;
      const concealed = new Set(fixed);
      for (const layer of world) {
        if (layer.subject === subject || layer.knownAbove & bit) continue;
        for (const pixels of layer.options) for (const pixel of pixels) concealed.add(pixel);
      }
      const groups = new Map<string, number>();
      for (const pixels of options) {
        const signature = pixels.filter(pixel => !concealed.has(pixel)).join(',');
        groups.set(signature, (groups.get(signature) ?? 0) + 1);
      }
      const delta = options.length - Math.max(...groups.values());
      if (delta > 0) { gain += delta; revealed.push(subject.palette); }
    }
    return { gain, revealed };
  };
}

export function chooseJointCatalogue(local: JointCatalogue, scene: SlottedCatalogue, rows: NativeRows, frameHash: string,
  available: readonly string[], remaining: number): JointCatalogueAction | null {
  const seen = (action: NativeCommand) => local.tried.includes(JSON.stringify([frameHash, action]));
  const select = (palette: number): JointCatalogueAction | null => {
    const control = scene.controls.find(control => control.palette === palette);
    if (!control) return null;
    const action = click(control.point);
    return seen(action) ? null : { kind: 'select', action, palette, box: control.bbox };
  };
  const absent = scene.controls.find(control => !local.subjects.some(subject => subject.palette === control.palette));
  if (absent) return select(absent.palette);
  if (local.subjects.every(subject => subject.options.length === 1)) {
    const palette = local.submitted.includes(scene.palette) ? local.subjects.find(subject => !local.submitted.includes(subject.palette))?.palette
      : scene.palette;
    if (palette === undefined) return null;
    if (palette !== scene.palette) return select(palette);
    const card = local.subjects.find(subject => subject.palette === palette)!.options[0]!.card;
    const slot = scene.cards[card]!, action = click(slot.point);
    return seen(action) ? null : { kind: 'submit', action, palette, box: slot.bbox, card };
  }
  let best: { subject: Subject; action: NativeCommand; gain: number; depth: number; revealed: number[] } | null = null;
  const information = catalogueInformation(local, scene, rows);
  for (const subject of local.subjects) for (const action_ref of ['ACTION3', 'ACTION4']) {
    const action: NativeCommand = { action_ref, data: {} };
    if (!available.includes(action_ref) || subject.palette === scene.palette && seen(action)) continue;
    const left = scene.field[0] + 1, right = scene.field[2] - (footprint(subject)[2] - subject.origin[0] + 1);
    const stride = local.step ?? subject.scale;
    for (let depth = 1; depth <= Math.min(remaining, 10); depth++) {
      const destination = Math.max(left, Math.min(right, subject.origin[0] + sign(action) * stride * depth));
      if (destination === subject.origin[0]) break;
      const { gain, revealed } = information(subject, destination);
      const rate = gain / (depth + Number(subject.palette !== scene.palette));
      const prior = best ? best.gain / (best.depth + Number(best.subject.palette !== scene.palette)) : 0;
      if (gain && (rate > prior || rate === prior && best && depth < best.depth)) best = { subject, action, gain, depth, revealed };
      if (destination === left || destination === right) break;
    }
  }
  if (!best) return null;
  if (best.subject.palette !== scene.palette) return select(best.subject.palette);
  return { kind: 'move', action: best.action, palette: scene.palette, box: footprint(best.subject), revealed: best.revealed };
}

export function recordJointCatalogue(local: JointCatalogue, scene: SlottedCatalogue, returned: SlottedCatalogue | null,
  before: NativeRows, after: NativeRows, action: JointCatalogueAction, ref: string, attempt: string): JointCatalogueReturn {
  const next = { ...local, lastRef: ref, tried: [...local.tried.slice(-100), attempt], evidence: [...local.evidence.slice(-6), ref] };
  const finish = (current: JointCatalogue | null, reason: string) => ({
    local: current ?? { ...next, stopped: true }, reason, matched: current !== null,
  });
  if (!returned || !same(returned.field, scene.field) || returned.background !== scene.background
    || !same(returned.controls, scene.controls) || returned.palette !== action.palette) return finish(null, 'catalogue_geometry_changed');
  const [l, t, r, b] = scene.field;
  const field = (rows: NativeRows) => rows.slice(t + 1, b).map(row => row.slice(l + 1, r));
  if (action.kind !== 'move') {
    if (!same(field(before), field(after))) return finish(null, 'catalogue_selection_changed_the_field');
    if (action.kind === 'select') return finish(observeCatalogueSubject(next, returned, after), 'selected_catalogue_measured');
    return returned.selectedCard === action.card ? finish({ ...next, submitted: [...local.submitted, action.palette] }, 'catalogue_choice_mark_checked')
      : finish(null, 'catalogue_choice_mark_missing');
  }
  if (!sameCards(scene.cards, returned.cards)) return finish(null, 'catalogue_slots_changed_during_translation');
  const used = new Set([scene.background, ...scene.controls.map(control => control.palette)]);
  const cover = (rows: NativeRows) => field(rows).map(row => row.map(ink => used.has(ink) ? null : ink));
  if (!same(cover(before), cover(after))) return finish(null, 'catalogue_cover_changed_during_translation');
  const subject = local.subjects.find(subject => subject.palette === action.palette)!;
  const measured = readSubject(after, returned, subject);
  if (!measured) return finish(null, 'catalogue_translation_unresolved');
  const delta = measured.origin[0] - subject.origin[0], stride = Math.abs(delta);
  if (delta && Math.sign(delta) !== sign(action.action)) return finish(null, 'catalogue_translation_direction_contradicted');
  if (stride && local.step !== null && stride !== local.step) {
    const [left, , right] = footprint(measured);
    if (stride > local.step || left !== l + 1 && right !== r - 1) return finish(null, 'catalogue_translation_size_contradicted');
  }
  const probes = next.subjects.map(item => item === subject ? measured : item);
  const subjects = constrain(after, returned, probes);
  if (!subjects) return finish(null, 'catalogue_view_contradicted_retained_shapes');
  const step = local.step ?? (stride && footprint(measured)[0] > l + 1 && footprint(measured)[2] < r - 1 ? stride : null);
  return finish({ ...next, subjects, step }, delta ? 'catalogue_translation_compared_for_all_subjects' : 'catalogue_subject_remained_at_boundary');
}
