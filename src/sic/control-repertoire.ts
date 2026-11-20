import { diff, same, type XY } from './access-terrain.ts';

export type ControlResponse = { before: XY; after: XY };
export type RepertoireChange = {
  shared: number;
  expansion: number;
  choices: number;
  novel: boolean;
  awakened: boolean;
  score: number;
};

/** Compare displacements under the same controls in the body's own reference frame.
 * A component carried along identically by every button has no demonstrated choice. */
export function compareControlRepertoires(
  origin: XY,
  prepared: XY,
  responses: ReadonlyMap<string, ControlResponse>,
  trigger: string
): RepertoireChange | null {
  const selected = responses.get(trigger);
  if (!selected || responses.size < 2 || same(prepared, selected.after)) return null;
  const before = new Set<string>(),
    after = new Set<string>();
  for (const response of responses.values()) {
    before.add(diff(response.before, origin).join());
    after.add(diff(response.after, prepared).join());
  }
  if (after.size < 2) return null;
  const expansion = [...after].filter((d) => !before.has(d)).length;
  const novel = !before.has(diff(selected.after, prepared).join());
  const awakened = same(selected.before, origin);
  const choices = after.size - before.size;
  const score =
    Number(novel) * 4 + Number(awakened) * 2 + Math.min(2, expansion) + Math.max(-2, Math.min(2, choices));
  return { shared: responses.size, expansion, choices, novel, awakened, score };
}
