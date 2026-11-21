import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';

export type FieldPart = { readonly bbox: NativeBox; readonly area: number };
export type FieldCell = { box: NativeBox; value: number };
type Cell = FieldCell;
export type ExemplarRule = { columns: number; rows: number; cueIndex: number; orientation: number; sameAsCue: number[]; differentFromCue: number[] };
type Field = { origin: NativeBox; columns: number; rows: number; cells: (Cell | null)[]; cue: NativeBox };
export type FieldAssignment = { box: NativeBox; before: number; desired: number };
export type ExemplarPlan = {
  field: NativeBox;
  cue: NativeBox;
  samples: NativeBox[];
  examples: number;
  agreements: number;
  orientations: number[];
  assignments: FieldAssignment[];
  relativeRules: ExemplarRule[];
};

const at = (x: number, y: number) => x + ',' + y;
export function fieldPitches(cells: Cell[], axis: 0 | 1): number[] {
  const lines = new Map<number, number[]>();
  for (const { box } of cells) {
    const line = box[1 - axis]!;
    const coords = lines.get(line) ?? [];
    coords.push(box[axis]);
    lines.set(line, coords);
  }
  const frequencies = new Map<number, number>();
  for (const line of lines.values()) {
    line.sort((a, b) => a - b);
    for (let i = 1; i < line.length; i++) {
      const gap = line[i]! - line[i - 1]!;
      frequencies.set(gap, (frequencies.get(gap) ?? 0) + 1);
    }
  }
  return [...frequencies].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([pitch]) => pitch);
}

function fieldsAtPitch(cells: Cell[], dx: number, dy: number): Map<string, Field[]> {
  const locations = new Map(cells.map(cell => [at(cell.box[0], cell.box[1]), cell]));
  const visited = new Set<Cell>(), families = new Map<string, Field[]>();
  for (const start of cells) {
    if (visited.has(start)) continue;
    const group = [start];
    visited.add(start);
    for (let i = 0; i < group.length; i++) {
      const [x, y] = group[i]!.box;
      for (const key of [at(x - dx, y), at(x + dx, y), at(x, y - dy), at(x, y + dy)]) {
        const neighbor = locations.get(key);
        if (!neighbor || visited.has(neighbor)) continue;
        visited.add(neighbor);
        group.push(neighbor);
      }
    }
    if (group.length < 3) continue;
    const left = Math.min(...group.map(c => c.box[0])), top = Math.min(...group.map(c => c.box[1]));
    const right = Math.max(...group.map(c => c.box[0])), bottom = Math.max(...group.map(c => c.box[1]));
    const columns = (right - left) / dx + 1, height = (bottom - top) / dy + 1;
    if (columns < 2 || height < 2 || columns * height !== group.length + 1) continue;
    const w = start.box[2] - start.box[0] + 1, h = start.box[3] - start.box[1] + 1;
    if (w % columns || h % height) continue;
    const slots: (Cell | null)[] = [];
    let cue: NativeBox | undefined;
    for (let row = 0; row < height; row++) for (let col = 0; col < columns; col++) {
      const x = left + col * dx, y = top + row * dy;
      const cell = locations.get(at(x, y)) ?? null;
      slots.push(cell);
      if (!cell) cue = [x, y, x + w - 1, y + h - 1];
    }
    if (!cue) continue;
    const key = [columns, height, slots.indexOf(null)].join('/');
    const fields = families.get(key) ?? [];
    fields.push({ origin: [left, top, right + w - 1, bottom + h - 1], columns, rows: height, cells: slots, cue });
    families.set(key, fields);
  }
  return families;
}

export function readFieldCue(board: NativeRows, field: Pick<Field,'cue'|'columns'|'rows'>): number[] | undefined {
  const [x, y, right, bottom] = field.cue;
  const w = (right - x + 1) / field.columns, h = (bottom - y + 1) / field.rows;
  const symbols: number[] = [];
  for (let j = 0; j < field.rows; j++) for (let i = 0; i < field.columns; i++) {
    const left = x + i * w, top = y + j * h, value = board[top]![left]!;
    for (let v = top; v < top + h; v++) for (let u = left; u < left + w; u++) {
      if (board[v]![u] !== value) return;
    }
    symbols.push(value);
  }
  return symbols;
}

export function fieldSymbolIndex(index: number, field: Pick<Field,'columns'|'rows'>, orientation: number): number {
  let x = index % field.columns, y = Math.floor(index / field.columns);
  if (orientation & 1) [x, y] = [y, x];
  if (orientation & 2) x = field.columns - x - 1;
  if (orientation & 4) y = field.rows - y - 1;
  return y * field.columns + x;
}

function infer(fields: Field[], board: NativeRows): ExemplarPlan[] {
  const cues = fields.map(field => readFieldCue(board, field));
  const hypotheses: ExemplarPlan[] = [];
  for (const [index, target] of fields.entries()) {
    const cue = cues[index];
    if (!cue) continue;
    for (let orientation = 0; orientation < 8; orientation++) {
      if ((orientation & 1) && target.columns !== target.rows) continue;
      const mapping = new Map<number, number>(), support = new Map<number, Set<number>>();
      const cueIndex = target.cells.indexOf(null), same = new Set<number>(), different = new Set<number>();
      const samples: NativeBox[] = [];
      let consistent = true, agreements = 0;
      for (const [n, example] of fields.entries()) {
        const symbols = cues[n];
        if (n === index || !symbols) continue;
        samples.push(example.origin);
        for (const [k, cell] of example.cells.entries()) {
          if (!cell) continue;
          const symbol = symbols[fieldSymbolIndex(k, example, orientation)]!;
          if (mapping.has(symbol) && mapping.get(symbol) !== cell.value) { consistent = false; break; }
          mapping.set(symbol, cell.value);
          (cell.value === symbols[cueIndex] ? same : different).add(symbol);
          const examples = support.get(symbol) ?? new Set<number>();
          examples.add(n);
          support.set(symbol, examples);
          agreements++;
        }
        if (!consistent) break;
      }
      if (!consistent || samples.length < 2 || new Set(mapping.values()).size < 2) continue;
      const assignments: FieldAssignment[] = [];
      for (const [k, cell] of target.cells.entries()) {
        if (!cell) continue;
        const symbol = cue[fieldSymbolIndex(k, target, orientation)]!;
        const desired = mapping.get(symbol);
        if (desired === undefined || (support.get(symbol)?.size ?? 0) < 2) { consistent = false; break; }
        assignments.push({ box:cell.box, before:cell.value, desired });
      }
      const relativeRules: ExemplarRule[] = [];
      if (same.size && different.size && [...same].every(symbol => !different.has(symbol))) {
        relativeRules.push({columns:target.columns, rows:target.rows, cueIndex, orientation,
          sameAsCue:[...same].sort((a,b) => a-b), differentFromCue:[...different].sort((a,b) => a-b)});
      }
      if (consistent) hypotheses.push({field:target.origin, cue:target.cue, samples, examples:samples.length,
        agreements, orientations:[orientation], assignments, relativeRules});
    }
  }
  return hypotheses;
}

export function solidFieldCells(board: NativeRows, parts: readonly FieldPart[]): Map<string, Cell[]> {
  const sizes = new Map<string, Cell[]>();
  for (const {bbox:box, area} of parts) {
    const w = box[2] - box[0] + 1, h = box[3] - box[1] + 1;
    if (w < 2 || h < 2 || area !== w * h) continue;
    const key = at(w, h), group = sizes.get(key) ?? [];
    group.push({ box, value:board[box[1]]![box[0]]! });
    sizes.set(key, group);
  }
  return sizes;
}

export function exemplarPlans(board: NativeRows, parts: readonly FieldPart[]): ExemplarPlan[] {
  const sizes = solidFieldCells(board, parts);
  const byField = new Map<string, ExemplarPlan[]>();
  for (const cells of sizes.values()) {
    if (cells.length < 9 || new Set(cells.map(c => c.value)).size < 2) continue;
    for (const dx of fieldPitches(cells, 0)) for (const dy of fieldPitches(cells, 1)) {
      for (const fields of fieldsAtPitch(cells, dx, dy).values()) {
        if (fields.length < 3) continue;
        for (const plan of infer(fields, board)) {
          const key = plan.field.join(), group = byField.get(key) ?? [];
          group.push(plan);
          byField.set(key, group);
        }
      }
    }
  }
  const plans: ExemplarPlan[] = [];
  for (const hypotheses of byField.values()) {
    hypotheses.sort((a,b) => b.examples - a.examples || b.agreements - a.agreements);
    const best = hypotheses[0]!;
    const peers = hypotheses.filter(h => h.examples === best.examples && h.agreements === best.agreements);
    const expected = JSON.stringify(best.assignments);
    if (!peers.every(h => JSON.stringify(h.assignments) === expected)) continue;
    if (best.assignments.every(cell => cell.before === cell.desired)) continue;
    const uniqueRules = new Map(peers.flatMap(h => h.relativeRules.map(rule => [JSON.stringify(rule), rule] as const)));
    plans.push({...best, orientations:[...new Set(peers.flatMap(h => h.orientations))], relativeRules:[...uniqueRules.values()]});
  }
  return plans.sort((a,b) => b.examples - a.examples || b.agreements - a.agreements);
}
