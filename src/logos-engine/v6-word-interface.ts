/**
 * Complete native common_word_interface.py plus its exact V5 closure:
 * _WordBudget and parse_typed_word (including resumable progress).
 * Reference: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 */
import { compareUnicode } from './canonical.ts';
import { projection, v6Digest } from './v6-native-observer.ts';
import type { NativePublicObservation, NativeRows } from './v6-native-types.ts';
export type WordRecord = Record<string, any>;
export interface WordCommand extends WordRecord { action_ref: string; data?: Record<string, number> }
export interface WordObservation extends WordRecord { entities: readonly WordRecord[]; level_epoch: number; levels_completed: number; observation_ref: string; frame_hash: string; state: string }
export type WordState = readonly [word: readonly string[], focus: number];
export interface TypedWordRule { input_type_ref: string; output_type_ref: string; left: readonly string[]; right: readonly string[]; rule_ref: string; provenance_refs: readonly string[] }
const keyOf = (value: unknown): string => JSON.stringify(value);
const addressed = (action: WordCommand): boolean => !!action.data && Object.keys(action.data).length > 0;
const modulo = (a: number, n: number) => (a % n + n) % n;
function same(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
function compareNumbers(a: readonly number[], b: readonly number[]): number { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!; return a.length - b.length; }
function compareStrings(a: readonly string[], b: readonly string[]): number { for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = compareUnicode(a[i]!, b[i]!); if (c) return c; } return a.length - b.length; }

/** Arbitrary exact counters preserve the source's finite declared parse budget. */
export class WordBudget {
  readonly maximum: bigint; examined = 0n; reached = false;
  constructor(maximum: number | bigint) { this.maximum = BigInt(maximum); }
  take(count: number | bigint = 1): boolean { const amount = BigInt(count); if (amount > this.maximum - this.examined) { this.reached = true; return false; } this.examined += amount; return true; }
}
export function parseTypedWord(word: readonly string[], rules: readonly TypedWordRule[], inputType: string, outputType: string,
  maximumOutput: number, maximumParses: number | bigint, budget: WordBudget, progress: WordRecord = {}, resume: WordRecord = {}): readonly [WordRecord[], unknown[][], boolean] {
  const byFirst = new Map<string, number[]>(Object.entries(resume.rule_lookup ?? {}).sort(([a], [b]) => compareUnicode(a, b)).map(([key, value]) => [key, [...value as number[]]]));
  let scanCursor = Number(resume.scan_cursor ?? 0), outputBoundSeen = !!resume.output_bound_seen;
  type Pending = [number, string[], unknown[], number, boolean];
  const pending: Pending[] = (resume.pending ?? [[0, [], [], 0, false]]).map((row: Pending) => [row[0], [...row[1]], [...row[2]], row[3], row[4]]);
  const parses: WordRecord[] = [...(resume.parses ?? [])], gaps = new Map<string, unknown[]>((resume.gaps ?? []).map((row: unknown[]) => [keyOf(row), [...row]]));
  const matches = new Map<string, { position: number; rule_index: number; matches: boolean }>((resume.rule_matches ?? []).map((row: any) => [keyOf([row.position, row.rule_index]), { ...row }]));
  if (!Number.isInteger(scanCursor) || scanCursor < 0 || scanCursor > rules.length) throw new TypeError('invalid current parse scan cursor');
  const sortedGaps = () => [...gaps.values()].sort((a, b) => Number(a[0]) - Number(b[0]) || Number(a[1]) - Number(b[1]) || compareUnicode(String(a[2]), String(b[2])));
  const save = () => Object.assign(progress, { scan_cursor: scanCursor, rule_lookup: Object.fromEntries(byFirst), pending: pending.map(row => [...row]), parses: [...parses],
    gaps: sortedGaps(), output_bound_seen: outputBoundSeen, rule_matches: [...matches.values()].sort((a, b) => a.position - b.position || a.rule_index - b.rule_index) });
  for (let index = scanCursor; index < rules.length; index++) {
    const rule = rules[index]!; if (!budget.take(1 + rule.left.length)) { save(); return [parses, sortedGaps(), false]; }
    if (rule.input_type_ref === inputType && rule.output_type_ref === outputType) {
      if (!rule.left.length) throw new TypeError('A typed parse rule must have a first input symbol');
      if (!byFirst.has(rule.left[0]!)) byFirst.set(rule.left[0]!, []); byFirst.get(rule.left[0]!)!.push(index);
    }
    scanCursor = index + 1;
  }
  while (pending.length) {
    if (!budget.take()) { save(); break; }
    const item = pending.shift()!; let [position, output, derivation, cursor, matched] = item;
    if (position === word.length) {
      if (BigInt(parses.length) >= BigInt(maximumParses)) { pending.unshift([position, output, derivation, cursor, matched]); save(); break; }
      parses.push({ output_word: output, derivation }); continue;
    }
    const choices = byFirst.get(word[position]!) ?? [];
    while (cursor < choices.length) {
      const ruleIndex = choices[cursor]!, rule = rules[ruleIndex]!, matchKey = keyOf([position, ruleIndex]);
      const matchWork = matches.has(matchKey) ? 0 : rule.left.length;
      if (!budget.take(1 + matchWork + rule.right.length + output.length + derivation.length)) { pending.unshift([position, output, derivation, cursor, matched]); break; }
      const end = position + rule.left.length; cursor++;
      if (!matches.has(matchKey)) matches.set(matchKey, { position, rule_index: ruleIndex, matches: same(word.slice(position, end), rule.left) });
      if (!matches.get(matchKey)!.matches) continue;
      matched = true; const following = [...output, ...rule.right];
      if (following.length > maximumOutput) { outputBoundSeen = true; const gap = [position, end, 'output_length_bound']; gaps.set(keyOf(gap), gap); continue; }
      const trace = [...derivation, [position, end, output.length, following.length, rule.rule_ref, rule.provenance_refs]];
      pending.push([end, following, trace, 0, false]);
    }
    if (budget.reached) break;
    if (!matched) { const gap = [position, word.length, 'missing_rule_for_suffix']; gaps.set(keyOf(gap), gap); }
  }
  save(); return [parses, sortedGaps(), pending.length === 0 && !outputBoundSeen];
}

export async function wordGlyphs(rows: NativeRows, group: WordRecord, ink: number): Promise<string[]> {
  const [left, top, right, bottom] = group.box, size = group.size, result: string[] = [];
  for (let i = 0; i < Math.floor((right - left + 1) / size); i++) {
    let mask = projection(rows, [left + i * size + 1, top + 1, left + (i + 1) * size - 2, bottom - 1]).map(row => row.map(value => Number(value === ink)));
    const orbit: number[][] = [];
    for (let turn = 0; turn < 4; turn++) { orbit.push(mask.flat()); const height = mask.length, width = mask[0]!.length;
      mask = Array.from({ length: width }, (_, y) => Array.from({ length: height }, (_, x) => mask[x]![width - 1 - y]!)); }
    orbit.sort(compareNumbers); result.push(await v6Digest(orbit[0]!));
  }
  return result;
}
export function wordFocus(rows: NativeRows, group: WordRecord, cursor: readonly WordRecord[]): number | null {
  const [left, top, right] = group.box, size = group.size, found: number[] = [];
  for (let i = 0; i < Math.floor((right - left + 1) / size); i++) {
    let valid = true;
    for (const part of cursor) {
      const x = left + i * size + part.dx, y = top + part.dy, width = part.width, height = part.height;
      if (Math.min(x, y) < 0 || x + width > rows[0]!.length || y + height > rows.length) { valid = false; break; }
      const got: number[][] = []; for (let yy = 0; yy < height; yy++) for (let xx = 0; xx < width; xx++) if (rows[y + yy]![x + xx] === part.hue) got.push([xx, yy]);
      if (!same(got.sort(compareNumbers), [...part.mask].sort(compareNumbers))) { valid = false; break; }
    }
    if (valid) found.push(i);
  }
  return found.length === 1 ? found[0]! : null;
}

export async function measureWordScene(observation: WordObservation, rows: NativeRows): Promise<WordRecord | null> {
  const grouped = new Map<string, { size: number; ink: number; groups: WordRecord[] }>();
  for (const entity of observation.entities) {
    const [left, top, right, bottom] = entity.bbox, height = bottom - top + 1, width = right - left + 1;
    if (height < 3 || width % height || entity.rectangular) continue;
    const inks: number[] = [];
    for (let i = 0; i < width / height; i++) {
      const cut = projection(rows, [left + i * height, top, left + (i + 1) * height - 1, bottom]);
      const edge = [...cut[0]!, ...cut.at(-1)!, ...cut.map(row => row[0]!), ...cut.map(row => row.at(-1)!)];
      const colors = [...new Set(cut.flat().filter(value => value !== entity.palette_value))];
      if (!edge.every(value => value === entity.palette_value) || colors.length !== 1) break; inks.push(colors[0]!);
    }
    if (inks.length === width / height && new Set(inks).size === 1) {
      const key = keyOf([height, inks[0]]); if (!grouped.has(key)) grouped.set(key, { size: height, ink: inks[0]!, groups: [] });
      grouped.get(key)!.groups.push({ box: entity.bbox, size: height, type: entity.palette_value });
    }
  }
  const candidates = [...grouped.values()].filter(value => value.groups.length >= 4).sort((a, b) => b.size - a.size); if (!candidates.length) return null;
  const { ink, groups } = candidates[0]!, byY = new Map<number, WordRecord[]>();
  for (const group of groups) { if (!byY.has(group.box[1])) byY.set(group.box[1], []); byY.get(group.box[1])!.push(group); }
  const table: [WordRecord, WordRecord][] = [], words: WordRecord[] = [];
  for (const row of byY.values()) { row.sort((a, b) => a.box[0] - b.box[0]); if (row.length % 2 === 0) { for (let i = 0; i < row.length; i += 2) if (row[i]!.type !== row[i + 1]!.type) table.push([row[i]!, row[i + 1]!]); } else if (row.length === 1) words.push(row[0]!); }
  if (words.length !== 2 || !table.length) return null;
  const cursors: { group: WordRecord; cursor: WordRecord[] }[] = [];
  for (const group of words) {
    const [left, top, right, bottom] = group.box, size = group.size;
    for (let i = 0; i < (right - left + 1) / size; i++) {
      const x = left + i * size, above: WordRecord[] = [], below: WordRecord[] = [];
      for (const entity of observation.entities) { const [L, T, R, B] = entity.bbox; if (!(x < L && L <= R && R < x + size - 1)) continue;
        if (top - size < T && T <= B && B < top) above.push(entity); if (bottom < T && T <= B && B <= bottom + size) below.push(entity); }
      for (const first of above) for (const second of below) {
        const a = first.bbox, b = second.bbox;
        if (first.palette_value !== second.palette_value || first.area !== second.area || a[0] !== b[0] || a[2] !== b[2]
          || top + bottom - a[1] !== b[3] || top + bottom - a[3] !== b[1]) continue;
        const height = a[3] - a[1] + 1, reflected = first.mask.map(([X, Y]: number[]) => [X, height - 1 - Y!]).sort(compareNumbers);
        if (!same(reflected, [...second.mask].sort(compareNumbers))) continue;
        const cursor = [first, second].map(entity => ({ dx: entity.bbox[0] - x, dy: entity.bbox[1] - top, width: entity.bbox[2] - entity.bbox[0] + 1,
          height: entity.bbox[3] - entity.bbox[1] + 1, hue: entity.palette_value, mask: [...entity.mask].sort(compareNumbers) }));
        cursors.push({ group, cursor });
      }
    }
  }
  if (cursors.length !== 1) return null;
  const { group: editable, cursor } = cursors[0]!, source = words.find(group => group !== editable)!;
  const rules: TypedWordRule[] = [];
  for (const [left, right] of table) rules.push({ input_type_ref: String(left.type), output_type_ref: String(right.type), left: await wordGlyphs(rows, left, ink),
    right: await wordGlyphs(rows, right, ink), rule_ref: `rule_${(await v6Digest([left.box, right.box])).slice(0, 12)}`, provenance_refs: [observation.observation_ref] });
  const word = await wordGlyphs(rows, source, ink), maximum = Math.floor((editable.box[2] - editable.box[0] + 1) / editable.size);
  const depth = word.length + 1, states = BigInt(rules.length + 1) ** BigInt(depth);
  const budget = new WordBudget(states * BigInt(rules.reduce((sum, rule) => sum + rule.left.length + rule.right.length, 0) + maximum + depth + 3));
  const [parses, , complete] = parseTypedWord(word, rules, String(source.type), String(editable.type), maximum, states, budget);
  const outputs = new Map(parses.filter(parse => parse.output_word.length === maximum).map(parse => [keyOf(parse.output_word), parse.output_word]));
  if (outputs.size !== 1 || budget.reached) return null;
  return { editable, source, cursor, ink, target: [...outputs.values()][0], rule_count: rules.length, parse_count: parses.length, bounded_derivations_complete: complete, goal_length: maximum };
}

export function wordEditPath(graph: ReadonlyMap<string, ReadonlyMap<string, string>>, start: string, goal: string): string[] | null {
  const queue = [start], known = new Map<string, string[]>([[start, []]]);
  for (let head = 0; head < queue.length; head++) { const glyph = queue[head]!; if (glyph === goal) return known.get(glyph)!;
    for (const [key, edges] of [...graph].sort(([a], [b]) => compareUnicode(a, b))) { const next = edges.get(glyph); if (next !== undefined && !known.has(next)) { known.set(next, [...known.get(glyph)!, key]); queue.push(next); } } }
  return null;
}
export function wordCursorPath(directions: ReadonlyMap<string, number>, start: number, target: number, n: number): string[] | null {
  const queue = [start], known = new Map<number, string[]>([[start, []]]);
  for (let head = 0; head < queue.length; head++) { const at = queue[head]!; if (at === target) return known.get(at)!;
    for (const [key, delta] of [...directions].sort(([a], [b]) => compareUnicode(a, b))) { const next = modulo(at + delta, n); if (!known.has(next)) { known.set(next, [...known.get(at)!, key]); queue.push(next); } } }
  return null;
}
export function wordVisitPlan(word: readonly string[], goal: readonly string[], at: number, edits: ReadonlyMap<string, ReadonlyMap<string, string>>, directions: ReadonlyMap<string, number>): string[] | null {
  const wrong = word.flatMap((value, i) => i < goal.length && value !== goal[i] ? [i] : []), paths = new Map(wrong.map(i => [i, wordEditPath(edits, word[i]!, goal[i]!)]));
  if ([...paths.values()].some(value => value === null)) return null;
  type Node = { mask: bigint; position: number; cost: number; path: string[] };
  let frontier = new Map<string, Node>([[`0:${at}`, { mask: 0n, position: at, cost: 0, path: [] }]]);
  for (let iteration = 0; iteration < wrong.length; iteration++) {
    const following = new Map<string, Node>();
    for (const { mask, position, path } of frontier.values()) for (let j = 0; j < wrong.length; j++) {
      if (mask >> BigInt(j) & 1n) continue; const target = wrong[j]!, travel = wordCursorPath(directions, position, target, word.length); if (travel === null) continue;
      const route = [...path, ...travel, ...paths.get(target)!], nextMask = mask | 1n << BigInt(j), key = `${nextMask}:${target}`;
      if (!following.has(key) || route.length < following.get(key)!.cost) following.set(key, { mask: nextMask, position: target, cost: route.length, path: route });
    }
    frontier = following;
  }
  return frontier.size ? [...frontier.values()].sort((a, b) => a.cost - b.cost || compareStrings(a.path, b.path))[0]!.path : wrong.length ? null : [];
}

export class WordInterface {
  readonly id = 'word_interface'; readonly familyId = 'word_interface';
  epoch: number | null = null; editGraph = new Map<string, Map<string, string>>(); focusDirections = new Map<string, number>(); passed: WordRecord[] = []; events: WordRecord[] = [];
  closed = new Map<string, readonly [string, string]>(); scene: WordRecord | null | undefined; verified = new Set<string>(); tried = new Set<string>(); refs = new Map<string, string>(); first: string | undefined; cycleStart: unknown = null;
  state(): WordRecord { const value: WordRecord = { format: 'native.word_interface.v1', epoch: this.epoch, edit_graph: [...this.editGraph].map(([key, edges]) => [key, [...edges]]),
    focus_directions: [...this.focusDirections], passed: this.passed, events: this.events, closed: [...this.closed.values()].sort(compareStrings) };
    if (this.scene !== undefined) Object.assign(value, { scene: this.scene, verified: [...this.verified].sort(compareUnicode), tried: [...this.tried].sort(compareUnicode), refs: [...this.refs], first: this.first, cycle_start: this.cycleStart }); return structuredClone(value); }
  restore(snapshot: WordRecord): void {
    const value = structuredClone(snapshot); if (value.format !== 'native.word_interface.v1' || !Array.isArray(value.edit_graph) || !Array.isArray(value.focus_directions) || !Array.isArray(value.closed) || !Array.isArray(value.events) || !Array.isArray(value.passed)) throw new TypeError('Incompatible word-interface state');
    this.epoch = value.epoch; this.editGraph = new Map(value.edit_graph.map(([key, edges]: [string, [string, string][]]) => [key, new Map(edges)])); this.focusDirections = new Map(value.focus_directions);
    this.passed = value.passed; this.events = value.events; this.closed = new Map(value.closed.map((item: [string, string]) => [keyOf(item), item]));
    this.scene = value.scene; this.verified = new Set(value.verified ?? []); this.tried = new Set(value.tried ?? []); this.refs = new Map(value.refs ?? []); this.first = value.first; this.cycleStart = value.cycle_start ?? null;
  }
  async read(rows: NativeRows): Promise<WordState | null> { if (!this.scene) return null; const editable = this.scene.editable, at = wordFocus(rows, editable, this.scene.cursor); return at === null ? null : [await wordGlyphs(rows, editable, this.scene.ink), at]; }
  async propose(observation: WordObservation, rows: NativeRows, inputs: readonly WordCommand[], remaining: number): Promise<WordRecord | null> {
    const keys = inputs.filter(action => !addressed(action)).map(action => action.action_ref).sort(compareUnicode); if (!keys.length || inputs.some(addressed)) return null;
    if (this.epoch !== observation.level_epoch) { this.epoch = observation.level_epoch; this.scene = await measureWordScene(observation, rows); this.verified.clear(); this.tried.clear(); this.refs.clear(); this.first = observation.observation_ref; this.cycleStart = null; }
    if (!this.scene) return null; const current = await this.read(rows); if (current === null) return null;
    const [word, at] = current, goal = this.scene.target as string[]; if (same(word, goal)) return null;
    let route = wordVisitPlan(word, goal, at, this.editGraph, this.focusDirections);
    if (!route?.length) { const unknown = keys.filter(key => !this.focusDirections.has(key) && !this.editGraph.has(key) && !this.tried.has(key));
      const ongoing = [...this.editGraph.keys()].filter(key => !this.closed.has(keyOf([key, word[at]]))).sort(compareUnicode);
      const key = ongoing[0] ?? unknown[0]; if (key === undefined) return null; route = [key]; }
    const steps: WordRecord[] = []; let state = current;
    for (const key of route.slice(0, Math.min(remaining, 16))) {
      const [w, pos] = state; let prediction: WordState | null = null;
      if (this.focusDirections.has(key)) prediction = [w, modulo(pos + this.focusDirections.get(key)!, w.length)];
      else if (this.editGraph.get(key)?.has(w[pos]!)) { const next = [...w]; next[pos] = this.editGraph.get(key)!.get(w[pos]!)!; prediction = [next, pos]; }
      steps.push({ action: { action_ref: key }, state, expected_after: prediction, expected_before: { level_epoch: this.epoch, frame_hash: steps.length ? null : observation.frame_hash } });
      if (prediction === null || !this.verified.has(key)) break; state = prediction;
    }
    const actions = steps.map(step => step.action), refs = [observation.observation_ref, this.first!, ...this.refs.values()], focus = `C_word_${(await v6Digest([refs, actions])).slice(0, 16)}`;
    const why = 'Use the observed typed dictionary to derive the required word and measured edit transitions to realize it.';
    const info = { source_word_length: (await wordGlyphs(rows, this.scene.source, this.scene.ink)).length, desired_length: goal.length, rules: this.scene.rule_count,
      complete_derivations: this.scene.parse_count, focused_slot: at, remaining_disagreements: word.filter((value, i) => i < goal.length && value !== goal[i]).length,
      scope: 'Glyph identity hypothesizes quarter-turn equivalence of the full inner mask; dictionary parsing uses the existing typed-word kernel.' };
    const facts = { typed_dictionary_observed: true, unique_goal_word: true, cursor_and_editable_word_bound: true };
    return { status: 'proposed', kind: 'typed_word_interface', word_plan: info, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: info, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs, binding: { observation_ref: observation.observation_ref, level_epoch: this.epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence: refs, actions, outcome_guard: { path: ['value'], contains: focus } } };
  }
  bind(_proposal: WordRecord, _domain: unknown): void {}
  async before(proposal: WordRecord, index: number, publicPacket: NativePublicObservation, observation: WordObservation): Promise<WordRecord> {
    const bound = proposal.binding, step = proposal.steps[index], ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed && publicPacket.available_action_refs.includes(step.action.action_ref)
      && (index !== 0 || observation.observation_ref === bound.observation_ref) && same(await this.read(publicPacket.frame_rows), step.state);
    return { admitted: !!ok, reason: 'bind_full_glyph_word_and_focus' };
  }
  async after(proposal: WordRecord, index: number, before: WordObservation, after: WordObservation, _first: NativeRows, second: NativeRows): Promise<WordRecord> {
    if (!same([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed])) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const prediction = proposal.steps[index].expected_after, matched = prediction ? same(await this.read(second), prediction) : null;
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_observed_edit_or_cursor_transition' };
  }
  async record(before: WordObservation, after: WordObservation, command: WordCommand, _first: NativeRows, second: NativeRows, proposal: WordRecord, index: number): Promise<WordRecord> {
    const old = proposal.steps[index].state as WordState, key = command.action_ref, ref = after.observation_ref;
    if (after.levels_completed > before.levels_completed) { this.passed.push({ score: after.levels_completed, ref }); return { status: 'official_boundary', ref }; }
    const next = await this.read(second), event: WordRecord = { ref, input: key, status: 'unknown_transition' }; this.tried.add(key);
    if (next !== null) {
      const [word, at] = old, [out, focus] = next, changed = word.flatMap((value, j) => j < out.length && value !== out[j] ? [j] : []);
      if (at === focus && changed.length === 1 && changed[0] === at) {
        if (!this.editGraph.has(key)) this.editGraph.set(key, new Map()); const known = this.editGraph.get(key)!.get(word[at]!);
        if (known !== undefined && known !== out[at]) { this.editGraph.clear(); this.closed.clear(); event.prior_cycle_refuted = true; this.editGraph.set(key, new Map()); }
        this.editGraph.get(key)!.set(word[at]!, out[at]!); this.verified.add(key); this.refs.set(key, ref); event.status = 'local_glyph_rewrite';
        let reached = out[at]!; const seen = new Set<string>(), edges = this.editGraph.get(key)!;
        while (edges.has(reached) && !seen.has(reached)) { seen.add(reached); reached = edges.get(reached)!; }
        if (seen.has(reached)) for (const glyph of seen) this.closed.set(keyOf([key, glyph]), [key, glyph]);
        for (const [other, otherEdges] of [...this.editGraph]) if (other !== key && this.closed.has(keyOf([other, out[at]])) && otherEdges.get(out[at]!) === word[at]) {
          const inverse = new Map([...otherEdges].map(([a, b]) => [b, a])); if (inverse.size === otherEdges.size) { this.editGraph.set(key, inverse); for (const glyph of inverse.keys()) this.closed.set(keyOf([key, glyph]), [key, glyph]); }
        }
      } else if (same(word, out) && at !== focus) { const delta = modulo(focus - at, word.length); if (delta === 1 || delta === word.length - 1) {
        this.focusDirections.set(key, delta === 1 ? 1 : -1); this.verified.add(key); this.refs.set(key, ref); event.status = 'cursor_step'; } }
    }
    this.events.push(event); return event;
  }
}
