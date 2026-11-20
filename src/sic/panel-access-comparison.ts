import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';
import { containsBox, panelFootingEvidence, reachablePanelFootings, sameBox, type PanelWalker } from './panel-context-probe.ts';

/** Compare access with the observed carried pieces and with their occupied pixels blocked. */
export function comparePanelSupportAccess(walker: PanelWalker, rows: NativeRows, start: NativeBox,
  held: { tool: NativeBox; support: NativeBox }) {
  const parts = geometricComponents(rows), tool = parts.find(part => sameBox(part.bbox, held.tool));
  if (!tool) return;
  const supports = parts.filter(part => part.rectangular && containsBox(held.support, part.bbox)
    && !containsBox(held.tool, part.bbox));
  if (supports.length !== 2 || supports[0]!.color !== supports[1]!.color) return;
  const occupied = new Set([tool, ...supports].flatMap(part => part.mask.map(([x, y]) =>
    `${part.bbox[0] + x},${part.bbox[1] + y}`)));
  const contactInks = new Set(Object.values(walker.contacts ?? {}).flatMap(contact => contact.patch.split(',').map(Number)));
  const toolWasCrossed = contactInks.has(tool.color);
  const heldArea: NativeBox = [Math.min(held.tool[0], held.support[0]), Math.min(held.tool[1], held.support[1]),
    Math.max(held.tool[2], held.support[2]), Math.max(held.tool[3], held.support[3])];
  const patchAt = ([x, y, r, b]: NativeBox) => [rows[y]?.[x], rows[y]?.[r], rows[b]?.[x], rows[b]?.[r]];
  const possible = (box: NativeBox) => !!panelFootingEvidence(walker, rows, box)
    || toolWasCrossed && containsBox(heldArea, box)
      && patchAt(box).every(ink => ink === tool.color || ink === supports[0]!.color);
  const unoccupied = ([x, y, r, b]: NativeBox) =>
    [[x, y], [r, y], [x, b], [r, b]].every(([u, v]) => !occupied.has(`${u},${v}`));
  const field: NativeBox = [0, 0, rows[0]!.length - 1, rows.length - 1];
  const withSupport = reachablePanelFootings(walker, rows, field, start, possible);
  const withoutSupport = reachablePanelFootings(walker, rows, field, start, box => unoccupied(box) && possible(box));
  const prior = new Set(withoutSupport.map(box => box.slice(0, 2).join(',')));
  return { gain: withSupport.filter(box => unoccupied(box) && !prior.has(box.slice(0, 2).join(','))).length,
    withSupport: withSupport.length,
    withoutSupport: withoutSupport.length, uncertain: withSupport.filter(box => !sameBox(box, start)
      && !panelFootingEvidence(walker, rows, box)).length };
}
