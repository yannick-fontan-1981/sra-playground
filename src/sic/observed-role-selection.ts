import type { NativeObservation, NativeRows, NativePoint } from '../logos-engine/v6-native-types.ts';

export type SelectionShape = { pitch: number; phase: NativePoint; mask: number[]; inks: number[]; floor: number; backing: number };
export type SelectionHypothesis = { id: string; shape: SelectionShape; current: NativePoint; target: NativePoint;
  active: number; peer: number; mixed: boolean };

function tile(rows: NativeRows, [x, y]: NativePoint, pitch: number) {
  return Array.from({ length: pitch ** 2 }, (_, i) => rows[y + Math.floor(i / pitch)]![x + i % pitch]!);
}

export function maskedRole(pixels: readonly number[], mask: readonly number[], floor?: number) {
  const outside = pixels.filter((_, index) => !mask.includes(index));
  const shades = new Set(outside);
  if (!outside.length || shades.size > 2) return;
  const inside = mask.map(index => pixels[index]!);
  const ink = inside.find(value => inside.filter(other => other === value).length >= inside.length - 1);
  if (ink === undefined || shades.has(ink) || ink === floor || (floor !== undefined && inside.includes(floor))) return;
  const marker = inside.findIndex(value => value !== ink);
  const dominantBackground = [...shades].find(color => outside.filter(value => value === color).length * 4 >= outside.length * 3);
  return { ink, marker: marker < 0 ? null : mask[marker]!, background: [...shades], dominantBackground };
}

function nearbyFloor(rows: NativeRows, [x, y]: NativePoint, pitch: number, backing: number, visibleBackground?: number): number | undefined {
  const counts = new Map<number, number>();
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const at: NativePoint = [x + dx * pitch, y + dy * pitch];
    if (at[0] < 0 || at[1] < 0 || at[0] + pitch > rows[0]!.length || at[1] + pitch > rows.length) continue;
    const pixels = tile(rows, at, pitch);
    const ink = pixels[0]!;
    if (ink !== backing && pixels.every(value => value === ink)) counts.set(ink, (counts.get(ink) ?? 0) + 1);
  }
  const [first, next] = [...counts].sort((left, right) => right[1] - left[1]);
  if (first && first[1] >= 2 && first[1] > (next?.[1] ?? 0)) return first[0];
  return visibleBackground !== undefined && counts.get(visibleBackground) ? visibleBackground : undefined;
}

export function observedSelectionHypotheses(observation: NativeObservation, rows: NativeRows, backing: number): SelectionHypothesis[] {
  if (!observation.available_action_refs.includes('ACTION6') || observation.available_action_refs.length < 5) return [];
  const templates = new Map<string, { pitch: number; phase: NativePoint; mask: number[] }>();
  for (const entity of observation.entities) {
    const [x, y, right, bottom] = entity.bbox, pitch = right - x + 1;
    if (entity.rectangular || pitch < 3 || pitch > 7 || pitch % 2 === 0 || bottom - y + 1 !== pitch || entity.area < pitch + 1) continue;
    const pixels = tile(rows, [x, y], pitch);
    const mask = pixels.flatMap((ink, i) => ink === entity.palette_value ? [i] : []);
    if (mask.length !== entity.area || mask.length >= pixels.length - 2
      || !mask.includes((pixels.length - 1) / 2) || mask.some(i => !mask.includes(pixels.length - 1 - i))) continue;
    const phase: NativePoint = [x % pitch, y % pitch];
    templates.set(JSON.stringify([phase, mask]), { pitch, phase, mask });
  }
  const out: SelectionHypothesis[] = [];
  for (const { pitch, phase, mask } of templates.values()) {
    const glyphs = [];
    for (let y = phase[1]; y + pitch <= rows.length; y += pitch) for (let x = phase[0]; x + pitch <= rows[0]!.length; x += pitch) {
      const at: NativePoint = [x, y];
      const observed = maskedRole(tile(rows, at, pitch), mask);
      if (observed) glyphs.push({ ...observed, at });
    }
    const center = (pitch - 1) / 2;
    const selected = glyphs.filter(glyph => glyph.marker !== null
      && ((glyph.marker % pitch === center) !== (Math.floor(glyph.marker / pitch) === center)));
    if (selected.length !== 1) continue;
    const active = selected[0]!;
    const floor = active.background.length === 1 ? active.background[0] : nearbyFloor(rows, active.at, pitch, backing, active.dominantBackground);
    if (floor === undefined || floor === active.ink) continue;
    const peers = glyphs.filter(glyph => glyph.ink !== active.ink && glyph.marker === null
      && (glyph.background.includes(floor) || glyph.background.length === 2));
    if (peers.length > 6) continue;
    for (const peer of peers) {
      if (glyphs.filter(glyph => glyph.ink === peer.ink).length !== 1) continue;
      const shape = { pitch, phase, mask, inks: [active.ink, peer.ink].sort((a, b) => a - b), floor, backing };
      out.push({ id: JSON.stringify([pitch, phase, mask, peer.ink, peer.at]),
        shape, current: active.at, target: peer.at, active: active.ink, peer: peer.ink, mixed: peer.background.length > 1 });
    }
  }
  return out.sort((left, right) => Number(right.mixed) - Number(left.mixed));
}

export function selectionNeedsWitness(strict: SelectionShape | undefined, hypotheses: readonly SelectionHypothesis[]): boolean {
  return !strict || hypotheses.some(({ shape, active, peer }) =>
    shape.pitch === strict.pitch && shape.phase.every((coordinate,index)=>coordinate === strict.phase[index])
      && shape.mask.length === strict.mask.length && shape.mask.every((pixel,index)=>pixel === strict.mask[index])
      && strict.inks.includes(active) && !strict.inks.includes(peer));
}

export function selectionReturnFacts(hypothesis: SelectionHypothesis, before: NativeRows, after: NativeRows) {
  const { shape: { pitch, mask, floor }, current, target, active, peer } = hypothesis;
  const read = (rows: NativeRows, at: NativePoint) => maskedRole(tile(rows, at, pitch), mask, floor);
  const origin = read(before, current), candidate = read(before, target);
  const released = read(after, current), selected = read(after, target);
  const center = (pitch - 1) / 2;
  const marker = selected?.marker ?? null;
  return {
    beforeBinding: origin?.ink === active && origin.marker !== null && candidate?.ink === peer && candidate.marker === null,
    originReleased: released?.ink === active && released.marker === null,
    peerSelected: selected?.ink === peer && marker !== null,
    axialMarker: marker !== null && ((marker % pitch === center) !== (Math.floor(marker / pitch) === center)),
  };
}

export function witnessedSelection(hypothesis: SelectionHypothesis, before: NativeRows, after: NativeRows): boolean {
  return Object.values(selectionReturnFacts(hypothesis, before, after)).every(Boolean);
}
