/** Compare the resources assignable to independent obligations before and after a transformation. */
export function lostResourceCoverage<Demand, Resource>(demands: readonly Demand[], before: readonly Resource[],
  after: readonly Resource[], fits: (demand: Demand, resource: Resource) => boolean) {
  if (!demands.length) return;
  const matched = (resources: readonly Resource[]) => {
    const assignments = new Map<number, number>();
    const assign = (need: number, visited: Set<number>): boolean => resources.some((resource, index) => {
      if (visited.has(index) || !fits(demands[need]!, resource)) return false;
      visited.add(index);
      const current = assignments.get(index);
      if (current !== undefined && !assign(current, visited)) return false;
      assignments.set(index, need);
      return true;
    });
    demands.forEach((_, index) => assign(index, new Set()));
    return assignments.size;
  };
  if (matched(before) !== demands.length) return;
  const available = matched(after);
  if (available < demands.length) return { required: demands.length, available };
}
