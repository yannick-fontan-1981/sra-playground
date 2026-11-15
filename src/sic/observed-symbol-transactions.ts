import { FrameGrid, measureConcentricFrames } from '../logos-engine/v5-concentric-frames.ts';
import { measureDiagramRows, measureStackedDiagramRows, type DiagramRow } from '../logos-engine/v5-symbolic-diagrams.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { VisibleInstruction } from './visible-instruction-card.ts';

const roles = ['stock', 'workbench', 'requests'] as const;
type Role = typeof roles[number];
type Region = { value: number; box: NativeBox };
type Part = ReturnType<typeof geometricComponents>[number];
type Example = { point: NativePoint; instruction: VisibleInstruction; regions: Region[]; proof: string };
export type SymbolExamples = Partial<Record<Role, Example[]>>;
export type SymbolWorkspaceEvidence = {
  regions: Record<Role, Region>; operandOffset: NativePoint; activationOffset: NativePoint;
  selectionOutline: number; proof: string[];
};
type Glyph = { value: number; box: NativeBox };
type Job = { demand: Glyph } | { recipe: DiagramRow };
type Seat = { box: NativeBox; empty: number };
type StockMark = { value: number; offset: number };
type Workspace = { regions: Record<Role, NativeBox>; slots: NativeBox[]; empty: number; extent: number; activation: NativePoint;
  stockMark?: StockMark; unary?: Seat };
export type SymbolTransaction = { workspace: Workspace; job: Job | null; held: number | null; loaded: number };
export type SymbolStep = {
  kind: 'select' | 'load' | 'deliver' | 'transform'; point: NativePoint; target: NativeBox; value: number;
  intent: NativeBox; job: Job; intermediate?: boolean;
};
const roleByInstruction: Record<VisibleInstruction, Role> = {
  select_indicated_symbol: 'stock', load_indicated_operand: 'workbench',
  apply_indicated_transformation: 'workbench', deliver_matching_symbol: 'requests',
};
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const area = (box: NativeBox) => width(box) * height(box);
const samePoint = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const sameBox = (a: NativeBox, b: NativeBox) => a.every((v, i) => v === b[i]);
const inside = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const overlap = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const at = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
const pointBox = ([x, y]: NativePoint): NativeBox => [x, y, x, y];
const offset = (a: NativePoint, b: NativePoint): NativePoint => [b[0] - a[0], b[1] - a[1]];
const shifted = (point: NativePoint, by: NativePoint): NativePoint => [point[0] + by[0], point[1] + by[1]];
const frameBox = ({ left, top, right, bottom }: ReturnType<typeof measureConcentricFrames>[number]): NativeBox => [left, top, right, bottom];

export function rememberSymbolExample(examples: SymbolExamples, instruction: VisibleInstruction, point: NativePoint,
  rows: NativeRows, proof: string): SymbolExamples {
  const role = roleByInstruction[instruction], previous = examples[role] ?? [];
  if (previous.length >= 8 || previous.some(example => example.instruction === instruction && samePoint(example.point, point))) return examples;
  const regions = geometricComponents(rows).filter(part => inside(part.bbox, pointBox(point)))
    .map(part => ({ value: part.color, box: part.bbox }));
  return { ...examples, [role]: [...previous, { point, instruction, regions, proof }] };
}

export function consolidateSymbolWorkspace(examples: SymbolExamples, selectionOutline: number): SymbolWorkspaceEvidence | null {
  const stock = examples.stock ?? [], workbench = examples.workbench ?? [], requests = examples.requests ?? [];
  const operands = workbench.filter(example => example.instruction === 'load_indicated_operand');
  const activation = workbench.filter(example => example.instruction === 'apply_indicated_transformation');
  if (stock.length < 2 || operands.length !== 2 || activation.length !== 1 || requests.length < 2) return null;
  const enclosure = (samples: Example[]) => samples[0]!.regions.filter(region => samples.every(example =>
    example.regions.some(candidate => sameBox(candidate.box, region.box) && candidate.value === region.value)))
    .sort((a, b) => area(a.box) - area(b.box))[0];
  const source = enclosure(stock), bench = enclosure(workbench), receiver = enclosure(requests);
  if (!source || !bench || !receiver || overlap(source.box, bench.box) || overlap(source.box, receiver.box)
    || overlap(bench.box, receiver.box)) return null;
  const first = operands[0]!.point;
  return { regions: { stock: source, workbench: bench, requests: receiver },
    operandOffset: offset(first, operands[1]!.point), activationOffset: offset(first, activation[0]!.point),
    selectionOutline, proof: [...stock, ...workbench, ...requests].map(example => example.proof).slice(-8) };
}

export function rebindSymbolWorkspace(frame: FrameGrid, learned: SymbolWorkspaceEvidence): SymbolTransaction | null {
  const diagrams = measureDiagramRows(frame), binary = diagrams.filter(diagram => diagram.left_values.length === 2);
  const extent = binary[0]?.symbol_extent;
  if (!extent || binary.some(diagram => diagram.symbol_extent !== extent)) return null;
  const parts = geometricComponents(frame.rows);
  const [stock, workbench, requests] = roles.map(role => {
    const reference = learned.regions[role];
    const candidates = parts.filter(part => part.color === reference.value
      && width(part.bbox) === width(reference.box) && height(part.bbox) === height(reference.box));
    return candidates.length === 1 ? candidates[0]!.bbox : null;
  });
  if (!stock || !workbench || !requests || overlap(stock, workbench) || overlap(stock, requests) || overlap(workbench, requests)) return null;
  const slots = measureConcentricFrames(frame).filter(candidate => candidate.maximum_equal_padding === 1)
    .map(frameBox).filter(box => inside(workbench, box) && width(box) === extent + 2 && height(box) === extent + 2);
  const pairs = slots.flatMap(a => slots.filter(b => samePoint(center(b), shifted(center(a), learned.operandOffset))).map(b => [a, b]));
  if (pairs.length !== 1) return null;
  const pair = pairs[0]!, empty = at(frame.rows, center(pair[0]!));
  const activation = shifted(center(pair[0]!), learned.activationOffset);
  if (empty === undefined || empty !== at(frame.rows, center(pair[1]!)) || !inside(workbench, pointBox(activation))
    || pair.some(box => inside(box, pointBox(activation)))) return null;
  const extraSeats = slots.filter(box => !pair.some(operand => overlap(box, operand))
    && diagrams.some(diagram => diagram.left_values.length === 1 && diagram.symbol_extent === extent
      && diagram.branch_value === at(frame.rows, [box[0], box[1]])));
  const workspace: Workspace = { regions: { stock, workbench, requests }, slots: pair, empty, extent, activation };
  const stockMark = inferStockMark(parts, workspace);
  const spare = extraSeats.length === 1 ? extraSeats[0]! : null, spareEmpty = spare ? at(frame.rows, center(spare)) : undefined;
  if (stockMark) workspace.stockMark = stockMark;
  if (spare && spareEmpty !== undefined) workspace.unary = { box: spare, empty: spareEmpty };
  return { workspace, job: null, held: null, loaded: 0 };
}

function glyphs(parts: Part[], box: NativeBox, extent: number, hollow: boolean): Glyph[] {
  return parts.filter(part => inside(box, part.bbox) && width(part.bbox) === extent && height(part.bbox) === extent
    && (hollow ? part.area === 4 * (extent - 1) && part.mask.every(([x, y]) => x === 0 || y === 0 || x === extent - 1 || y === extent - 1)
      : part.rectangular)).map(part => ({ value: part.color, box: part.bbox }));
}

function stockDots(parts: Part[], workspace: Workspace): Part[] {
  return parts.filter(part => part.area === 1 && inside(workspace.regions.stock, part.bbox));
}

function inferStockMark(parts: Part[], workspace: Workspace): StockMark | null {
  const icons = glyphs(parts, workspace.regions.stock, workspace.extent, false);
  if (icons.length < 2) return null;
  const dots = stockDots(parts, workspace);
  const matches = (icon: Glyph) => dots.flatMap(({ color, bbox: [x, y] }) => {
    const offset = x - icon.box[2];
    return y === center(icon.box)[1] && offset > 1 && offset <= workspace.extent + 1 ? [{ value: color, offset }] : [];
  });
  const common = matches(icons[0]!).filter(mark => icons.every(icon =>
    matches(icon).some(candidate => candidate.value === mark.value && candidate.offset === mark.offset)));
  return common.length === 1 ? common[0]! : null;
}

function stockValues(parts: Part[], workspace: Workspace, icons: Glyph[]): number[] {
  const mark = workspace.stockMark, single = icons.map(icon => icon.value);
  if (!mark) return single;
  const dots = stockDots(parts, workspace).filter(part => part.color === mark.value);
  const runs = icons.map(icon => {
    const [x, y] = [icon.box[2] + mark.offset, center(icon.box)[1]];
    const end = Math.min(workspace.regions.stock[2] + 1, ...icons.filter(other => other.box[0] > x && center(other.box)[1] === y).map(other => other.box[0]));
    return dots.filter(({ bbox: [col, row] }) => row === y && col >= x && col < end)
      .map(part => part.bbox[0]).sort((a, b) => a - b).map(col => col - x);
  });
  if (runs.some(run => run[0] !== 0)) return single;
  const pitches = new Set(runs.flatMap(run => run.slice(1).map((value, i) => value - run[i]!)));
  if (pitches.size > 1 || pitches.has(1)) return single;
  const pitch = [...pitches][0];
  return icons.flatMap((icon, i) => {
    const run = runs[i]!, y = center(icon.box)[1];
    const right = workspace.regions.stock[2], last = icon.box[2] + mark.offset + run.at(-1)!;
    const beyond = pitch !== undefined && last + pitch > right && parts.some(part => part.area === 1
      && part.color === mark.value && part.bbox[0] === last + pitch && part.bbox[1] === y);
    return Array.from({ length: run.length + Number(beyond) }, () => icon.value);
  });
}

function subtract(items: readonly number[], spent: readonly number[]): number[] | null {
  const remaining = [...items];
  for (const value of spent) {
    const index = remaining.indexOf(value);
    if (index === -1) return null;
    remaining.splice(index, 1);
  }
  return remaining;
}

// Compare complete paths so immediate deliveries cannot consume a required ingredient.
function plan(stock: number[], open: Glyph[], recipes: readonly DiagramRow[]): Job | null {
  type Node = { available: number[]; pending: Glyph[]; first: Job | null };
  const queue: Node[] = [{ available: stock, pending: open, first: null }];
  const seen = new Set<string>();
  const push = (next: Node) => {
    const key = JSON.stringify([next.available.slice().sort((a, b) => a - b), next.pending.map(glyph => glyph.value)]);
    if (seen.has(key) || queue.length >= 256) return;
    seen.add(key);
    queue.push(next);
  };
  for (const node of queue) {
    if (!node.pending.length) return node.first;
    node.pending.forEach((demand, index) => {
      const available = subtract(node.available, [demand.value]);
      if (available) push({ available, pending: node.pending.filter((_, i) => i !== index), first: node.first ?? { demand } });
    });
    for (const recipe of recipes) {
      const available = subtract(node.available, recipe.left_values);
      if (available) push({ available: [...available, ...recipe.right_values], pending: node.pending, first: node.first ?? { recipe } });
    }
  }
  return null;
}

function recipeSeats(workspace: Workspace, recipe: DiagramRow | null): Seat[] {
  if (recipe?.left_values.length === 1) return workspace.unary ? [workspace.unary] : [];
  return workspace.slots.map(box => ({ box, empty: workspace.empty }));
}

function sameRecipe(a: DiagramRow, b: DiagramRow): boolean {
  return a.branch_value === b.branch_value && a.left_values.join() === b.left_values.join()
    && a.right_values.join() === b.right_values.join();
}

export function nextSymbolStep(frame: FrameGrid, state: SymbolTransaction): SymbolStep | null {
  const { workspace, held, loaded } = state;
  const { extent, regions } = workspace;
  const parts = geometricComponents(frame.rows);
  const stock = glyphs(parts, regions.stock, extent, false);
  const requests = glyphs(parts, regions.requests, extent, true);
  const applicable = (diagram: DiagramRow) => diagram.symbol_extent === extent && (diagram.left_values.length === workspace.slots.length
    || (workspace.unary && diagram.left_values.length === 1));
  const binary = measureDiagramRows(frame).filter(diagram => applicable(diagram) && diagram.left_values.length === workspace.slots.length);
  const initial = state.job ?? plan(stock.map(item => item.value), requests, binary);
  const recipes = initial && (!('recipe' in initial) || binary.some(recipe => sameRecipe(recipe, initial.recipe)))
    ? binary : measureStackedDiagramRows(frame).filter(applicable);
  const job = initial ?? plan(stockValues(parts, workspace, stock), requests, recipes);
  if (!job) return null;
  const recipe = 'recipe' in job ? job.recipe : null;
  const demand = 'demand' in job ? job.demand : null;
  const seats = recipeSeats(workspace, recipe);
  if (demand && !requests.some(candidate => sameBox(candidate.box, demand.box) && candidate.value === demand.value)) return null;
  if (recipe && !recipes.some(candidate => sameRecipe(candidate, recipe))) return null;
  if (!seats.length || !seats.every(({ box, empty }, i) => at(frame.rows, center(box)) === (i < loaded ? recipe?.left_values[i] : empty))) return null;
  const receivedOutput = requests.find(request => recipe?.right_values.includes(request.value));
  const intent = demand?.box ?? receivedOutput?.box ?? regions.requests;
  if (recipe && loaded === seats.length) {
    const triggers = parts.filter(part => part.rectangular && width(part.bbox) === extent && height(part.bbox) === extent
      && part.color === recipe.branch_value && (seats.length === 1
        ? inside(regions.workbench, part.bbox) && part.bbox[3] < seats[0]!.box[1]
        : samePoint(center(part.bbox), workspace.activation)));
    if (triggers.length !== 1) return null;
    return { kind: 'transform', point: center(triggers[0]!.bbox), target: triggers[0]!.bbox,
      value: recipe.right_values[0]!, intent, job, intermediate: !receivedOutput };
  }
  const value = demand?.value ?? recipe?.left_values[loaded];
  const target = demand?.box ?? seats[loaded]?.box;
  if (target === undefined || value === undefined) return null;
  if (held === value) return { kind: demand ? 'deliver' : 'load', point: center(target), target, value, intent, job };
  if (held !== null) return null;
  const source = stock.find(glyph => glyph.value === value);
  return source ? { kind: 'select', point: center(source.box), target: source.box, value, intent, job } : null;
}

export function verifySymbolStep(step: SymbolStep, workspace: Workspace, first: NativeRows, second: NativeRows,
  selectionOutline: number): string | null {
  const { regions, extent } = workspace;
  const outline = measureConcentricFrames(new FrameGrid(second))
    .filter(frame => frame.maximum_equal_padding === 1 && frame.outer_value === selectionOutline && inside(regions.stock, frameBox(frame)));
  if (step.kind === 'select') return outline.length === 1 && samePoint(center(frameBox(outline[0]!)), step.point)
    ? 'symbol_selection_confirmed' : null;
  if (step.kind === 'load' || step.kind === 'deliver') return outline.length === 0
    && at(first, step.point) !== step.value && at(second, step.point) === step.value
    ? (step.kind === 'load' ? 'operand_loaded' : 'request_filled') : null;
  if (!('recipe' in step.job)) return null;
  const seats = recipeSeats(workspace, step.job.recipe);
  if (!seats.length || !seats.every(({ box, empty }) => at(first, center(box)) !== empty && at(second, center(box)) === empty)) return null;
  const inventory = (rows: NativeRows) => {
    const parts = geometricComponents(rows);
    return stockValues(parts, workspace, glyphs(parts, regions.stock, extent, false));
  };
  const before = inventory(first), after = inventory(second);
  const thisOutput = subtract(after, [...before, ...step.job.recipe.right_values]);
  return thisOutput ? 'operands_consumed_and_recipe_outputs_observed' : null;
}

export function advanceSymbolTransaction(state: SymbolTransaction, step: SymbolStep): SymbolTransaction {
  if (step.kind === 'select') return { ...state, job: step.job, held: step.value };
  if (step.kind === 'load') return { ...state, held: null, loaded: state.loaded + 1 };
  return { ...state, job: null, held: null, loaded: 0 };
}
