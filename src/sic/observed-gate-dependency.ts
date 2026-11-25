export type GateDependency<T> = { control: T; closedWhenPressed: boolean; evidence: string };
type Snapshot<T> = { occupied: ReadonlyMap<T, boolean>; closed: ReadonlyMap<T, boolean> };

/** Derive a conditional effect only when one observable cause changed. */
export function observedGateDependencies<T>(
  before: Snapshot<T>, after: Snapshot<T>, evidence: string, compatible: (control: T, gate: T) => boolean,
): Map<T, GateDependency<T>> {
  const changed = [...before.occupied].filter(([site, held]) =>
    after.occupied.has(site) && after.occupied.get(site) !== held);
  if (changed.length !== 1) return new Map();
  const control = changed[0]![0];
  const pressed = after.occupied.get(control)!;
  return new Map([...before.closed].flatMap(([gate, closed]) => {
    const next = after.closed.get(gate);
    return next !== undefined && next !== closed && compatible(control, gate)
      ? [[gate, { control, closedWhenPressed: next === pressed, evidence }]] : [];
  }));
}
