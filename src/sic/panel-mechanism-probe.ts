import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureComponentTranslations } from './observed-translation.ts';
import { containsBox, sameBox } from './panel-context-probe.ts';

const span = (box: NativeBox, axis: number) => box[axis + 2]! - box[axis]! + 1;

export function dockingDistance(tool: NativeBox, target: NativeBox, displacement: NativePoint = [0, 0]) {
  return Math.abs(tool[0] + tool[2] + 2 * displacement[0] - target[0] - target[2])
    + Math.abs(tool[1] + tool[3] + 2 * displacement[1] - target[1] - target[3]);
}

export function centeredToolRegion(tool: NativeBox, target: NativeBox): NativeBox | undefined {
  const dx = (target[0] + target[2] - tool[0] - tool[2]) / 2;
  const dy = (target[1] + target[3] - tool[1] - tool[3]) / 2;
  return Number.isInteger(dx) && Number.isInteger(dy) ? [tool[0] + dx, tool[1] + dy, tool[2] + dx, tool[3] + dy] : undefined;
}

/** Equal aligned supports with a central gap suggest a testable alignment. */
export function findPanelDock(rows: NativeRows, field: NativeBox, tool: NativeBox): NativeBox | undefined {
  const minimum = span(tool, 0) * span(tool, 1) / 4;
  const parts = geometricComponents(rows).filter(part => part.rectangular && part.area >= minimum
    && containsBox(field, part.bbox) && !containsBox(tool, part.bbox));
  const targets: NativeBox[] = [];
  for (const [index, first] of parts.entries()) for (const second of parts.slice(index + 1)) {
    if (first.color !== second.color || span(first.bbox, 0) !== span(second.bbox, 0) || span(first.bbox, 1) !== span(second.bbox, 1)) continue;
    for (const axis of [0, 1]) {
      const a = first.bbox[axis]! < second.bbox[axis]! ? first.bbox : second.bbox, b = a === first.bbox ? second.bbox : first.bbox;
      const gap = b[axis]! - a[axis + 2]! - 1;
      if (gap <= 0 || gap > span(tool, axis) || a[1 - axis] !== b[1 - axis] || a[3 - axis] !== b[3 - axis]) continue;
      targets.push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
    }
  }
  return targets.length === 1 ? targets[0] : undefined;
}

export function panelToolTranslation(before: NativeRows, after: NativeRows, field: NativeBox, tool: NativeBox) {
  const matches = measureComponentTranslations(before, after, part => sameBox(part.bbox, tool),
    part => containsBox(field, part.bbox));
  return matches.length === 1 ? matches[0]!.displacement : undefined;
}

export function measureAlignedTool(rows: NativeRows, field: NativeBox, region: NativeBox) {
  const candidates = geometricComponents(rows).filter(part => !part.rectangular && containsBox(region, part.bbox));
  if (candidates.length !== 1) return;
  const tool = candidates[0]!.bbox, support = findPanelDock(rows, field, tool);
  return support && dockingDistance(tool, support) === 0 ? { tool, support } : undefined;
}

type HeldSupport = NonNullable<ReturnType<typeof measureAlignedTool>>;

export const panelTransportPose = ({ tool, support }: HeldSupport) => `${tool.join(',')}:${support.join(',')}`;

export function measurePanelTransport(before: NativeRows, after: NativeRows, field: NativeBox,
  held: HeldSupport) {
  const delta = panelToolTranslation(before, after, field, held.tool);
  if (!delta) return;
  const shift = (box: NativeBox): NativeBox => [box[0] + delta[0], box[1] + delta[1], box[2] + delta[0], box[3] + delta[1]];
  const tool = shift(held.tool), support = findPanelDock(after, field, tool);
  return support && sameBox(support, shift(held.support)) ? { tool, support, delta } : undefined;
}

export function unchangedPanelTransport(before: NativeRows, after: NativeRows, { tool, support }: HeldSupport) {
  return [tool, support].every(([left, top, right, bottom]) => {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      if (before[y]?.[x] !== after[y]?.[x]) return false;
    }
    return true;
  });
}
