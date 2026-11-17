import { measureWordBoard, parseTypedWord, WordBudget, wordGlyphs, type WordObservation, type WordState,
  type TypedWordRule } from '../logos-engine/v6-word-interface.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';

type Side = { box: NativeBox; size: number; type: number; arity: number };
type Bracket = { left: number; right: number; above: number; height: number; ink: number;
  first: boolean[]; middle: boolean[]; last: boolean[] };
export type RuleSynthesis = { sides: Side[]; examples: [Side, Side]; words: [string[], string[]]; bracket: Bracket; ink: number };

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const side = ({ box, size, type }: Pick<Side, 'box' | 'size' | 'type'>): Side => ({ box, size, type, arity: (box[2] - box[0] + 1) / size });
const glyphCache = new Map<string, Promise<string[]>>();
const glyphs = (rows: NativeRows, group: Side, ink: number) => {
  const [l, t, r, b] = group.box;
  const pixels = rows.slice(t, b + 1).map(row => row.slice(l, r + 1).join(',')).join(';');
  const key = JSON.stringify([ink, group.size, b - t, pixels]);
  const prior = glyphCache.get(key);
  if (prior) return prior;
  const measured = wordGlyphs(rows, group, ink);
  if (glyphCache.size >= 192) glyphCache.delete(glyphCache.keys().next().value!);
  glyphCache.set(key, measured);
  return measured;
};

function measureBracket(observation: WordObservation, sides: readonly Side[]): Bracket | null {
  const matches: Bracket[] = [];
  for (const { box: [l, t, r, b], size } of sides) {
    const upper = observation.entities.filter(part => part.bbox[0] > l && part.bbox[2] < r
      && part.bbox[1] >= t - size && part.bbox[3] < t);
    for (const first of upper) {
      const [a, y, c, end] = first.bbox, height = end - y + 1, width = c - a + 1;
      if (width < 3) continue;
      const observed = new Set(first.mask.map((p: number[]) => p.join(',')));
      const column = (x: number) => Array.from({ length: height }, (_, j) => observed.has([x, j].join(',')));
      const middle = column(1);
      if (Array.from({ length: width - 2 }, (_, x) => column(x + 1)).some(pattern => !equal(pattern, middle))) continue;
      const paired = observation.entities.some(second => second.palette_value === first.palette_value
        && equal(second.bbox, [a, t + b - end, c, t + b - y])
        && equal([...second.mask].map(p => p.join(',')).sort(), first.mask.map(([x, j]: number[]) => [x, height - 1 - j!].join(',')).sort()));
      if (paired) matches.push({ left: a - l, right: r - c, above: t - y, height,
        ink: first.palette_value, first: column(0), middle, last: column(width - 1) });
    }
  }
  return matches.length === 1 ? matches[0]! : null;
}

function bracketMatches(rows: NativeRows, box: NativeBox, model: Bracket) {
  const [l, t, r, b] = box, first = l + model.left, last = r - model.right;
  for (let x = first; x <= last; x++) {
    const column = x === first ? model.first : x === last ? model.last : model.middle;
    for (let i = 0; i < model.height; i++) {
      const above = rows[t - model.above + i]?.[x], below = rows[b + model.above - i]?.[x];
      if (above === undefined || below === undefined || (above === model.ink) !== column[i] || (below === model.ink) !== column[i]) return false;
    }
  }
  return true;
}

export async function readRuleSynthesis(rows: NativeRows, layout: RuleSynthesis): Promise<WordState | null> {
  const focus = layout.sides.flatMap((item, i) => bracketMatches(rows, item.box, layout.bracket) ? [i] : []);
  if (focus.length !== 1) return null;
  const values = await Promise.all([...layout.sides, ...layout.examples].map(item => glyphs(rows, item, layout.ink)));
  const observed = values.slice(0, layout.sides.length);
  if (!equal(values.slice(layout.sides.length), layout.words)
    || observed.some((word, i) => word.length !== layout.sides[i]!.arity || word.some(glyph => glyph !== word[0]))) return null;
  return [observed.map(word => word[0]!), focus[0]!];
}

export async function measureRuleSynthesis(observation: WordObservation, rows: NativeRows): Promise<RuleSynthesis | null> {
  const measured = measureWordBoard(observation, rows);
  if (!measured || measured.table.length < 2 || measured.table.length > 8) return null;
  const table = [...measured.table].sort(([a], [b]) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
  const sides = table.flatMap(pair => pair.map(item => side(item as Side)));
  const [from, to] = sides.map(item => item.type);
  if (from === to || !sides.some(item => item.arity > 1) || sides.some((item, i) => item.type !== (i % 2 === 0 ? from : to)
    || item.arity < 1 || item.arity > 4)) return null;
  const targetWords = [measured.words.find(group => group.type === from), measured.words.find(group => group.type === to)];
  if (!targetWords[0] || !targetWords[1]) return null;
  const examples = targetWords.map(item => side(item as Side)) as [Side, Side];
  if (examples.some(item => item.arity > 10)) return null;
  const bracket = measureBracket(observation, sides);
  if (!bracket || examples.some(item => bracketMatches(rows, item.box, bracket))) return null;
  const words = await Promise.all(examples.map(item => glyphs(rows, item, measured.ink))) as [string[], string[]];
  const layout = { sides, examples, words, bracket, ink: measured.ink };
  return await readRuleSynthesis(rows, layout) ? layout : null;
}

function rulesFor(layout: RuleSynthesis, values: readonly string[]): TypedWordRule[] {
  const rules: TypedWordRule[] = [];
  for (let i = 0; i < layout.sides.length; i += 2) {
    const input = layout.sides[i]!, output = layout.sides[i + 1]!;
    rules.push({ input_type_ref: String(input.type), output_type_ref: String(output.type), rule_ref: 'measured-rule-' + i / 2,
      left: Array<string>(input.arity).fill(values[i]!), right: Array<string>(output.arity).fill(values[i + 1]!), provenance_refs: [] });
  }
  return rules;
}

function explainsExample(layout: RuleSynthesis, values: readonly string[]) {
  const rules = rulesFor(layout, values), [from, to] = layout.examples.map(item => String(item.type));
  const [source, target] = layout.words, max = Math.max(...rules.map(rule => rule.right.length)) * source.length;
  const [parses, , complete] = parseTypedWord(source, rules, from!, to!, max, 16_384, new WordBudget(32_768));
  return complete && parses.length > 0 && parses.every(parse => equal(parse.output_word, target));
}

export function synthesizeRuleAssignments(layout: RuleSynthesis, initial: readonly string[]): string[][] {
  const [source, target] = layout.words, values: (string | null)[] = layout.sides.map(() => null);
  const results = new Map<string, string[]>();
  let examined = 0;
  const fit = (index: number, letters: readonly string[], at: number) => {
    const arity = layout.sides[index]!.arity, glyph = letters[at];
    return glyph !== undefined && at + arity <= letters.length && (!values[index] || glyph === values[index])
      && letters.slice(at, at + arity).every(letter => letter === glyph) ? glyph : null;
  };
  const visit = (read: number, written: number) => {
    if (++examined > 16_384 || read > source.length || written > target.length) return;
    if (read === source.length && written === target.length) {
      const completed = values.map((glyph, i) => glyph ?? initial[i]!);
      const id = JSON.stringify(completed);
      if (!results.has(id) && explainsExample(layout, completed)) results.set(id, completed);
      return;
    }
    for (let i = 0; i < layout.sides.length; i += 2) {
      const a = fit(i, source, read), b = fit(i + 1, target, written);
      if (a === null || b === null) continue;
      const left = values[i]!, right = values[i + 1]!;
      values[i] = a; values[i + 1] = b;
      visit(read + layout.sides[i]!.arity, written + layout.sides[i + 1]!.arity);
      values[i] = left; values[i + 1] = right;
      if (examined > 16_384) return;
    }
  };
  visit(0, 0);
  return examined <= 16_384 ? [...results.values()] : [];
}
