type Cell = string;
type Binding = { id: string; cell: (positions: readonly Cell[]) => Cell | undefined; movable: boolean };

export type ObjectRelation = {
  id: string;
  kind: 'contact' | 'occupancy';
  cells: (positions: readonly Cell[]) => readonly [Cell, Cell] | undefined;
};

export function objectRelations(bindings: readonly Binding[], adjacent: (a: Cell, b: Cell) => boolean): ObjectRelation[] {
  return bindings.flatMap((left, index) => bindings.slice(index + 1).flatMap(right => {
    if (!left.movable && !right.movable) return [];
    const id = JSON.stringify([left.id, right.id]);
    return (['occupancy', 'contact'] as const).map(kind => ({
      id: id + ':' + kind, kind,
      cells: (positions: readonly Cell[]): readonly [Cell, Cell] | undefined => {
        const a = left.cell(positions), b = right.cell(positions);
        if (a !== undefined && b !== undefined && (kind === 'occupancy' ? a === b : adjacent(a, b))) return [a, b];
      },
    }));
  }));
}
