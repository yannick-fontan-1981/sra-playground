import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';

type Part = ReturnType<typeof geometricComponents>[number];
const width = ({ bbox: [l, , r] }: Part) => r - l + 1;
const height = ({ bbox: [, t, , b] }: Part) => b - t + 1;
type Guide = { box: NativeBox; order: string[] };
export type ReceivingGuideLayout = { field: NativeBox; unit: number; background: number; receivingGuides: Guide[]; order: string[] };

export function measureReceivingGuides(rows: NativeRows, retained?: ReceivingGuideLayout) {
  const parts = geometricComponents(rows);
  if (retained) return readGuidePieces(rows, parts, retained);
  const widthOfBoard = rows[0]!.length;
  const divider = rows.flatMap((row, y) => y > rows.length / 2 && y < rows.length - 4
    && row.filter(ink => ink === row[0]).length >= widthOfBoard * 0.75
    && rows[y - 1]![0] !== row[0] && rows[y + 1]![0] !== row[0] ? [y] : []);
  if (divider.length !== 1) return null;
  const split = divider[0]!, lower = parts.filter(part => part.bbox[1] > split);
  const square = (part: Part) => part.rectangular && width(part) === height(part) && width(part) >= 3;
  const references = lower.filter(square), units = new Set(references.map(width));
  if (units.size !== 1 || references.length < 2) return null;
  const unit = width(references[0]!), stride = unit + 2;
  const labelSide = 2;
  const offset = Math.floor((unit - labelSide) / 2);
  const anchors = lower.flatMap(part => {
    if (part.rectangular || width(part) !== stride || height(part) !== stride) return [];
    const [l, t] = part.bbox, x = l + 1 + offset, y = t + 1 + offset, ink = rows[y]![x]!;
    if (ink === part.color || !rows.slice(y, y + labelSide).every(row =>
      row.slice(x, x + labelSide).every(pixel => pixel === ink))) return [];
    return [{ part, ink }];
  }).sort((a, b) => a.part.bbox[0] - b.part.bbox[0]);
  if (anchors.length < 2 || new Set(anchors.map(anchor => anchor.ink)).size !== anchors.length) return null;
  const fields = parts.filter(part => part.bbox[0] > 0 && part.bbox[2] < widthOfBoard - 1 && part.bbox[3] < split
    && width(part) >= stride * 3 && height(part) >= stride * 3 && part.area >= unit * unit * 4).sort((a, b) => b.area - a.area);
  if (!fields.length || fields[0]!.area === fields[1]?.area) return null;
  const background = fields[0]!.color;
  const fragments = parts.filter(part => part.color === background && part.bbox[3] < split
    && part.bbox[0] > 0 && part.bbox[2] < widthOfBoard - 1);
  const field: NativeBox = [Math.min(...fragments.map(part => part.bbox[0])), Math.min(...fragments.map(part => part.bbox[1])),
    Math.max(...fragments.map(part => part.bbox[2])), Math.max(...fragments.map(part => part.bbox[3]))];
  const candidateRoots = parts.filter(part => !part.rectangular && width(part) === stride && height(part) === stride
    && part.bbox[2] === field[0] - 1 && part.bbox[1] >= field[1] && part.bbox[3] <= field[3]);
  if (candidateRoots.length !== 1) return null;
  const root = candidateRoots[0]!.bbox, row = root[1] + 1;
  const groups = anchors.map((anchor, i) => references.filter(reference =>
    reference.bbox[0] > anchor.part.bbox[2] && reference.bbox[0] < (anchors[i + 1]?.part.bbox[0] ?? widthOfBoard)
    && reference.bbox[1] === anchor.part.bbox[1] + 1).sort((a, b) => a.bbox[0] - b.bbox[0]));
  if (groups.some(group => !group.length) || groups.flat().length !== references.length) return null;
  const guides: Guide[] = [];
  for (const [i, anchor] of anchors.entries()) {
    const pins = parts.filter(part => part.color === anchor.ink && part.rectangular && part.area === labelSide * labelSide
      && width(part) === labelSide && height(part) === labelSide && part.bbox[3] < field[1]
      && part.bbox[0] >= field[0] && part.bbox[2] <= field[2]);
    if (pins.length !== 1) return null;
    const center = pins[0]!.bbox[0], first = row - Math.floor((row - field[1]) / stride) * stride;
    const onGuide = (y: number) => rows[y]![center] !== background && rows[y]![center + 1] !== background;
    let last = first;
    while (last + unit < field[3] && onGuide(last + unit)) last += stride;
    const length = (last - first) / stride;
    if (length < groups[i]!.length || !onGuide(first - 1)) return null;
    guides.push({ box: [center, first - 1, center + 1, last - stride + unit], order: groups[i]!.map(piece => String(piece.color)) });
  }
  const order = guides.flatMap(guide => guide.order);
  if (new Set(order).size !== order.length) return null;
  return readGuidePieces(rows, parts, { field, unit, background, receivingGuides: guides, order });
}

function readGuidePieces(rows: NativeRows, parts: Part[], retained: ReceivingGuideLayout) {
  const { field, unit, background, order, receivingGuides } = retained, stride = unit + 2;
  const roots = parts.filter(part => !part.rectangular && width(part) === stride && height(part) === stride
    && part.bbox[2] === field[0] - 1 && part.bbox[1] >= field[1] && part.bbox[3] <= field[3]);
  if (roots.length !== 1) return null;
  const root = roots[0]!.bbox, row = root[1] + 1, offset = Math.floor((unit - 2) / 2);
  const pieces = parts.filter(part => part.rectangular && width(part) === unit && height(part) === unit && order.includes(String(part.color))
    && part.bbox[1] >= field[1] && part.bbox[3] <= field[3]);
  if (pieces.length !== order.length || new Set(pieces.map(piece => piece.color)).size !== pieces.length) return null;
  const lineRows = [row + offset, row + offset + 1], start = root[2];
  let tip = start - 1;
  for (let x = start; x <= field[2]; x++) {
    if (lineRows.every(y => rows[y]![x] === background)) break;
    tip = x;
  }
  if (tip < start || (tip - unit - (field[0] + 1)) % stride !== 0) return null;
  return { root, field, unit, background, line_rows: lineRows, start, tip, order, receivingGuides,
    receiverLayout: retained,
    pieces: pieces.map(part => ({ id: 'material:' + String(part.color), type: String(part.color), bbox: part.bbox })),
    layout: JSON.stringify([field, receivingGuides.map(guide => guide.box)]) };
}
