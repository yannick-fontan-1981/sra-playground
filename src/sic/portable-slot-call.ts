import { projection } from '../logos-engine/v6-native-observer.ts';
import { outlineSameBox } from '../logos-engine/v6-outline-geometry.ts';
import { slotBoundary, type SlotState } from '../logos-engine/v6-slot-substitution.ts';
import type { NativeBox, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';

type Call = `call:${number}`;
export type SlotValue = number | Call;
type Token = { box: NativeBox; value: SlotValue; image: NativeRows; background: number };
type Cell = { box: NativeBox; fixed: number | null; initial: NativeRows };
type Program = { label: number; cells: Cell[] };
export type PortableSlotLayout = {
  portable: true;
  inventory: NativeBox[];
  slots: NativeBox[];
  targets: SlotValue[];
  tokens: Token[];
  cells: Cell[];
};

const width = ([left, , right]: NativeBox) => right - left + 1;
const height = ([, top, , bottom]: NativeBox) => bottom - top + 1;
const inside = ([l, t, r, b]: NativeBox, [left, top, right, bottom]: NativeBox) => left < l && top < t && r < right && b < bottom;
const sameImage = (a: NativeRows, b: NativeRows) => a.every((row, y) => row.every((value, x) => value === b[y]?.[x]));
const uniform = (values: readonly number[]) => values.length && values.every(value => value === values[0]) ? values[0]! : null;
const isRing = (box: NativeBox, area: number, value: number, rows: NativeRows) =>
  width(box) >= 3 && height(box) >= 3 && area === 2 * (width(box) + height(box)) - 4 && outlineSameBox(rows, box, value);

function orderedRow<T extends { box: NativeBox }>(cells: T[]): T[] {
  const sorted = cells.sort((a, b) => a.box[0] - b.box[0]);
  if (sorted.length < 2) return [];
  const pitch = sorted[1]!.box[0] - sorted[0]!.box[0];
  return pitch > width(sorted[0]!.box) && sorted.every(({ box }, i) =>
    box[1] === sorted[0]!.box[1] && box[0] === sorted[0]!.box[0] + pitch * i) ? sorted : [];
}

function preferredExpansion(word: readonly number[], programs: readonly Program[], tokens: readonly Token[]): Map<Cell, SlotValue> | null {
  const calls = new Map<Call, Program>();
  for (const token of tokens) {
    if (typeof token.value !== 'string') continue;
    const linked = programs.find(program => token.value === `call:${program.label}`);
    if (!linked) return null;
    calls.set(token.value, linked);
  }
  const roots = programs.filter(program => !calls.has(`call:${program.label}`));
  if (roots.length !== 1 || calls.size === 0) return null;
  const counts = new Map<SlotValue, number>();
  for (const { value } of tokens) counts.set(value, (counts.get(value) ?? 0) + 1);
  const literals = programs.flatMap(program => program.cells.flatMap(cell => cell.fixed === null ? [] : [cell.fixed]));
  literals.push(...tokens.flatMap(token => typeof token.value === 'number' ? [token.value] : []));
  const availableLiterals = [...word];
  for (const literal of literals) {
    const index = availableLiterals.indexOf(literal);
    if (index < 0) return null;
    availableLiterals.splice(index, 1);
  }

  const assignments = new Map<Cell, SlotValue>();
  let solution: Map<Cell, SlotValue> | null = null;
  let ambiguous = false, preference = -1, budget = 8192;
  type ExpansionCell = { cell: Cell; ancestry: readonly Program[] };
  function visit(pending: readonly ExpansionCell[], offset: number) {
    if (--budget < 0) return;
    const [current, ...rest] = pending;
    if (!current) {
      if (offset === word.length && [...counts.values()].every(count => count === 0)) {
        // The expansion must match the reference first. For equally valid
        // programs, prefer keeping literals with their visible frame label.
        const score = programs.reduce((total, program) => total
          + program.cells.filter(cell => assignments.get(cell) === program.label).length, 0);
        if (score > preference) {
          solution = new Map(assignments);
          preference = score;
          ambiguous = false;
        } else if (score === preference) ambiguous = true;
      }
      return;
    }
    const { cell, ancestry } = current;
    const expand = (value: SlotValue) => {
      if (typeof value === 'number') {
        if (value === word[offset]) visit(rest, offset + 1);
        return;
      }
      const linked = calls.get(value)!;
      if (ancestry.includes(linked)) return;
      const nested = [...ancestry, linked];
      visit([...linked.cells.map(child => ({ cell: child, ancestry: nested })), ...rest], offset);
    };
    const placed = cell.fixed ?? assignments.get(cell);
    if (placed !== undefined) {
      expand(placed);
      return;
    }
    const choices: SlotValue[] = [...calls.keys()];
    if (offset < word.length) choices.unshift(word[offset]!);
    for (const value of choices) {
      const count = counts.get(value) ?? 0;
      if (!count) continue;
      counts.set(value, count - 1);
      assignments.set(cell, value);
      expand(value);
      assignments.delete(cell);
      counts.set(value, count);
    }
  }
  const root = roots[0]!;
  visit(root.cells.map(cell => ({ cell, ancestry: [root] })), 0);
  return budget < 0 || ambiguous ? null : solution;
}

export function measurePortableSlotLayout(observation: NativeObservation, rows: NativeRows): PortableSlotLayout | null {
  const entities = observation.entities.map(entity => ({ box: entity.bbox, hue: entity.palette_value, area: entity.area }));
  const rings = entities.filter(({ box, area, hue }) => isRing(box, area, hue, rows));
  const references = new Map<string, typeof rings>();
  for (const entity of rings) {
    const { box } = entity, size = width(box);
    if (size < 5 || size !== height(box)) continue;
    const key = `${box[1]},${size}`;
    const row = references.get(key) ?? [];
    row.push(entity);
    references.set(key, row);
  }
  const layouts: PortableSlotLayout[] = [];
  for (const reference of references.values()) {
    const ordered = orderedRow(reference);
    if (ordered.length < 3) continue;
    const first = ordered[0]!.box, size = width(first) - 2, word = ordered.map(entity => entity.hue);
    if (new Set(word).size < 2) continue;
    const inventoryRows = new Map<number, Token[]>();
    for (const { box, hue, area } of entities) {
      if (box[1] === first[1] || width(box) !== size || height(box) !== size) continue;
      const background = uniform(slotBoundary(rows, box));
      if (background === null || background === hue) continue;
      const image = projection(rows, box);
      const value = area === size * size && word.includes(hue) ? hue
        : isRing(box, area, hue, rows) && uniform(image.slice(1, -1).flatMap(row => row.slice(1, -1))) === background ? `call:${hue}` as const : null;
      if (value === null) continue;
      const row = inventoryRows.get(box[1]) ?? [];
      row.push({ box, value, image, background });
      inventoryRows.set(box[1], row);
    }
    for (const inventory of inventoryRows.values()) {
      const tokens = orderedRow(inventory);
      if (!tokens.length || !tokens.some(token => typeof token.value === 'string') || new Set(tokens.map(token => token.background)).size !== 1) continue;
      const top = Math.min(first[1], tokens[0]!.box[1]), bottom = Math.max(first[1], tokens[0]!.box[1]);
      const programs: Program[] = [];
      for (const { box, hue } of rings) {
        if (box[1] <= top || box[3] >= bottom || height(box) <= size || width(box) <= height(box)) continue;
        const cells: Cell[] = [];
        for (const { box: marker, hue: ink, area } of entities) {
          const side = width(marker);
          if (side !== height(marker) || area !== side * side || !inside(marker, box)) continue;
          const [l, t, r, b] = marker;
          const fixed = side === size && word.includes(ink);
          const empty = side === size - 2 && !word.includes(ink);
          if (!fixed && !empty) continue;
          const cell: NativeBox = fixed ? marker : [l - 1, t - 1, r + 1, b + 1];
          if (!inside(cell, box)) continue;
          const background = uniform(slotBoundary(rows, cell));
          if (background === null || background === ink || (empty && uniform(slotBoundary(rows, marker)) !== background)) continue;
          cells.push({ box: cell, fixed: fixed ? ink : null, initial: projection(rows, cell) });
        }
        const orderedCells = orderedRow(cells);
        if (orderedCells.length) programs.push({ label: hue, cells: orderedCells });
      }
      if (programs.length < 2 || new Set(programs.map(program => program.label)).size !== programs.length) continue;
      const cells = programs.flatMap(program => program.cells);
      if (cells.filter(cell => cell.fixed === null).length !== tokens.length) continue;
      const plan = preferredExpansion(word, programs, tokens);
      if (!plan || plan.size !== tokens.length) continue;
      const orderedCells = [...plan.keys(), ...cells.filter(cell => cell.fixed !== null)];
      layouts.push({ portable: true, tokens, cells: orderedCells, inventory: tokens.map(token => token.box),
        slots: orderedCells.map(cell => cell.box), targets: orderedCells.map(cell => cell.fixed ?? plan.get(cell)!) });
    }
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

export function readPortableSlotState(rows: NativeRows, layout: PortableSlotLayout): SlotState<SlotValue> | null {
  const available: boolean[] = [], selected: number[] = [];
  for (const [i, token] of layout.tokens.entries()) {
    const full = sameImage(projection(rows, token.box), token.image);
    available.push(full);
    const boundary = uniform(slotBoundary(rows, token.box));
    if (full && boundary !== null && boundary !== token.background) selected.push(i);
  }
  if (selected.length > 1) return null;
  const contents: (SlotValue | null)[] = [];
  for (const cell of layout.cells) {
    const current = projection(rows, cell.box);
    if (sameImage(current, cell.initial)) { contents.push(cell.fixed); continue; }
    if (cell.fixed !== null) return null;
    const landed = layout.tokens.find(token => sameImage(current, token.image));
    if (!landed) return null;
    contents.push(landed.value);
  }
  return [available, contents, selected[0] ?? null];
}
