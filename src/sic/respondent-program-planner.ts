import type { OccurrenceRecord } from '../logos-engine/v6-occurrence-scene.ts';
import type { NativePoint } from '../logos-engine/v6-native-types.ts';

type Word = number[];
export type ProgramBody = { base: number[]; word: Word };
export type ProgramTurn = { base: number[]; targets: ProgramBody[] };
export type RespondentTerrain = { marked: NativePoint[]; unknown: NativePoint[] };
export type RespondentContext = { initial: ProgramTurn; points: number[][]; sites: number[][]; evidence: string[]; terrain?: RespondentTerrain };
export type ScheduledProgramStep = {
  kind: 'insert' | 'remove' | 'execute'; label?: number; before: Word; word: Word;
  base: number[]; forecasts: ProgramTurn[]; markedTerrain?: NativePoint[]; closedRound?: true;
};
type Body = { at: string; word: Word };
type Turn = { at: string; targets: Body[] };
type UnknownTerrain = 'blocked' | 'open' | 'removes_respondent';
type Hypothesis = { removeTop: boolean; respondentsInteract: boolean; removesEnteringRespondent?: boolean;
  classifyUnknown?: (at: string) => UnknownTerrain | undefined };
type Change = { remove: number; insert: Word };
type Stage = { word: Word; change: Change; returns: Turn[][]; cost: number };

const key = (base: readonly number[]) => base.join(',');
const coordinates = (at: string) => at.split(',').map(Number);
const offset = (at: string, [dx, dy]: readonly number[]) => {
  const [x, y] = coordinates(at);
  return `${x! + dx!},${y! + dy!}`;
};
const digest = (turn: Turn) => JSON.stringify([turn.at, turn.targets.map(body => body.word.length ? [body.at, body.word] : [])]);
const hypotheses: Hypothesis[] = [true, false].flatMap(removeTop =>
  [false, true].map(respondentsInteract => ({ removeTop, respondentsInteract })));

function changeWord(current: Word, target: Word): Change {
  let shared = 0;
  while (shared < current.length && shared < target.length && current.at(-1 - shared) === target.at(-1 - shared)) shared++;
  return { remove: current.length - shared, insert: target.slice(0, target.length - shared).reverse() };
}

function appendProgramEdits(plan: ScheduledProgramStep[], existing: Word, change: Change, base: number[],
  details: Pick<ScheduledProgramStep, 'closedRound' | 'markedTerrain'> = {}) {
  let before = existing;
  for (let i = 0; i < change.remove; i++) {
    const word = before.slice(1);
    plan.push({ kind: 'remove', before, word, base, forecasts: [], ...details });
    before = word;
  }
  for (const label of change.insert) {
    const word = [label, ...before];
    plan.push({ kind: 'insert', label, before, word, base, forecasts: [], ...details });
    before = word;
  }
  return before;
}

function forecastsFor(variants: readonly Turn[]): ProgramTurn[] {
  const distinct = new Map(variants.map(turn => [digest(turn), turn]));
  return [...distinct.values()].map(turn => ({ base: coordinates(turn.at),
    targets: turn.targets.filter(body => body.word.length).map(body => ({ base: coordinates(body.at), word: body.word })) }));
}

function enumerateWords(labels: Word, capacity: number): Word[] {
  const words: Word[] = [];
  const visit = (prefix: Word) => {
    if (prefix.length) words.push(prefix);
    if (prefix.length === capacity) return;
    for (const label of labels) visit([...prefix, label]);
  };
  visit([]);
  return words;
}

function programProjection(model: OccurrenceRecord, context: RespondentContext, includeUnknown = false) {
  const motion = new Map<number, number[]>((model.moves as OccurrenceRecord[]).map(move => [move.label, move.vectors[0]]));
  const interaction = model.interaction.label as number, safe = new Set(context.points.map(key));
  const marked = new Set(context.terrain?.marked.map(key)), unknown = new Set(context.terrain?.unknown.map(key));
  const possible = includeUnknown ? new Set([...safe, ...unknown]) : safe;
  const steps = new Map([...possible].map(at => [at, new Map([...motion].map(([label, vector]) =>
    [label, offset(at, vector)] as const))]));
  const contact = new Map([...possible].map(at => [at, new Set((model.interaction.vectors as number[][]).map(vector => offset(at, vector)))]));

  const execute = (previous: Turn, word: Word, hypothesis: Hypothesis): Turn | null => {
    const targets = previous.targets.map(body => ({ ...body }));
    const actors = [{ at: previous.at, word }, ...targets];
    for (const [index, actor] of actors.entries()) {
      const instructions = [...actor.word].reverse();
      for (const label of instructions) {
        if (label === interaction) {
          for (const [other, target] of actors.entries()) {
            if (index === other || !target.word.length || !contact.get(actor.at)?.has(target.at)) continue;
            if (!other) return null;
            if (index && !hypothesis.respondentsInteract) continue;
            target.word = hypothesis.removeTop ? target.word.slice(1) : target.word.slice(0, -1);
          }
        } else {
          const destination = steps.get(actor.at)?.get(label) ?? actor.at;
          if (actors.some((other, position) => index !== position && other.word.length && other.at === destination)) continue;
          if (unknown.has(destination)) {
            if (index === 0) return null;
            const terrain = hypothesis.classifyUnknown?.(destination);
            if (!terrain) return null;
            if (terrain === 'removes_respondent') { actor.word = []; break; }
            if (terrain === 'open') actor.at = destination;
            continue;
          }
          if (marked.has(destination)) {
            // Never test the unfamiliar support by sending the controlled stack
            // into it. A respondent can distinguish blocking from removal.
            if (index === 0) return null;
            if (hypothesis.removesEnteringRespondent) { actor.word = []; break; }
          }
          if (safe.has(destination)) actor.at = destination;
        }
      }
      if (targets.every(body => !body.word.length)) break;
    }
    return { at: actors[0]!.at, targets };
  };
  const start = { at: key(context.initial.base), targets: context.initial.targets.map(body => ({ at: key(body.base), word: body.word })) };
  return { execute, start, motion, interaction, safe, steps, contact };
}

export function planRespondentPrograms(model: OccurrenceRecord, context: RespondentContext, existing: Word,
  available: Word, remaining: number, deadline: number): ScheduledProgramStep[] | null {
  const { execute, start, motion, interaction } = programProjection(model, context);
  const labels = [interaction, ...motion.keys()].filter(label => available.includes(label));
  const allowed = new Set([...motion.keys(), interaction]);
  if (!labels.includes(interaction) || context.initial.targets.some(body => body.word.some(label => !allowed.has(label)))) return null;
  const limit = Math.min(5, Math.max(existing.length, Math.max(...context.initial.targets.map(body => body.word.length)) + 2));
  const programs = enumerateWords(labels, limit);
  const sites = new Set(context.sites.map(key));
  const variantsToCheck = context.terrain ? hypotheses.flatMap(hypothesis =>
    [true, false].map(removesEnteringRespondent => ({ ...hypothesis, removesEnteringRespondent }))) : hypotheses;
  let projections = 0;
  const search = (start: Turn, current: Word, budget: number, allowTransfer: boolean) => {
    const access = new Map<string, Stage>();
    let best: Stage | null = null;
    for (const word of programs) {
      if (performance.now() >= deadline || projections >= 450_000) break;
      const change = changeWord(current, word), edits = change.remove + change.insert.length;
      if (edits >= budget || (best && edits + 1 >= best.cost)) continue;
      let variants = variantsToCheck.map(() => start);
      const returns: Turn[][] = [], seen = new Set<string>();
      for (let turn = 1; turn <= 10 && edits + turn <= budget; turn++) {
        const next = variants.map((variant, index) => {
          // A removed respondent leaves the projection absorbing at the
          // official boundary while the blocking alternative checks safety.
          if (context.terrain && turn > 1 && variant.targets.every(body => !body.word.length)) return variant;
          return execute(variant, word, variantsToCheck[index]!);
        });
        projections += next.length;
        if (next.some(item => item === null)) break;
        variants = next as Turn[];
        const expected = context.terrain ? variants.filter((_, index) => variantsToCheck[index]!.removesEnteringRespondent) : variants;
        if (expected.some(item => item.at !== expected[0]!.at)) break;
        const signatures = variants.map(digest), combined = signatures.join('|');
        if (seen.has(combined)) break;
        seen.add(combined);
        returns.push(expected);
        const stage = { word, change, returns: [...returns], cost: edits + turn };
        if (expected.every(item => item.targets.every(body => !body.word.length))) {
          if (!best || stage.cost < best.cost) best = stage;
          break;
        }
        const end = variants[0]!;
        if (allowTransfer && end.at !== start.at && sites.has(end.at) && signatures.every(value => value === signatures[0])) {
          const id = signatures[0]!;
          if (!access.has(id) || access.get(id)!.cost > stage.cost) access.set(id, stage);
        }
      }
    }
    return { best, access: [...access.values()].sort((a, b) => a.cost - b.cost).slice(0, 10) };
  };
  const budget = Math.min(remaining, 30), direct = search(start, existing, budget, true);
  let route = direct.best ? [direct.best] : null;
  let cost = direct.best?.cost ?? budget + 1;
  for (const transfer of direct.access) {
    const arrival = transfer.returns.at(-1)![0]!;
    const finish = search(arrival, transfer.word, cost - transfer.cost - 1, false).best;
    if (!finish) continue;
    route = [transfer, finish];
    cost = transfer.cost + finish.cost;
  }
  if (!route) return null;
  const plan: ScheduledProgramStep[] = [];
  let before = existing, base = context.initial.base;
  for (const stage of route) {
    before = appendProgramEdits(plan, before, stage.change, base);
    for (const variants of stage.returns) {
      const forecasts = forecastsFor(variants);
      plan.push({ kind: 'execute', before, word: before, base, forecasts });
      base = forecasts[0]!.base;
    }
  }
  return context.terrain ? plan.map(step => ({ ...step, markedTerrain: context.terrain!.marked })) : plan;
}

function responseOrders(targets: Body[]): Body[][] {
  if (targets.length <= 1) return [targets];
  return targets.flatMap((body, index) => responseOrders(targets.filter((_, i) => i !== index)).map(rest => [body, ...rest]));
}

export function planClosedRespondentRound(model: OccurrenceRecord, context: RespondentContext, current: Word,
  available: Word, capacity: number, remaining: number, deadline: number): ScheduledProgramStep[] | null {
  const { execute, start, motion, interaction, safe, steps, contact } = programProjection(model, context, true);
  if (!start.targets.length || start.targets.length > 4 || !available.includes(interaction)
    || start.targets.some(body => body.word.some(label => label !== interaction && !motion.has(label)))) return null;
  const blocking = new Set(start.targets.map(body => body.at));
  const orders = responseOrders(start.targets);
  const unknown: UnknownTerrain[] = ['blocked', 'open', 'removes_respondent'];
  const variants = hypotheses.flatMap(hypothesis => [true, false].map(removesEnteringRespondent => ({ ...hypothesis, removesEnteringRespondent })));
  const count = (targets: Body[]) => targets.reduce((total, body) => total + body.word.length, 0);
  const initial = count(start.targets);
  let tries = 0;
  type Round = { change: Change; turns: Turn[]; damage: number; cost: number };
  const result: { best: Round | null } = { best: null };
  const withinBudget = () => tries < 75_000 && performance.now() < deadline;
  const consider = (word: Word, hits: number) => {
    const best = result.best;
    if (best && hits < best.damage) return;
    const change = changeWord(current, word);
    const cost = change.remove + change.insert.length + 1;
    if (cost > remaining) return;
    const turns = new Map<string, Turn>();
    let damage = Infinity;
    const terrain = new Map<string, UnknownTerrain>();
    const check = (targets: Body[], variant: Hypothesis): boolean => {
      if (!withinBudget()) return false;
      tries++;
      const pending: { at?: string } = {};
      const turn = execute({ ...start, targets }, word, { ...variant, classifyUnknown: at => {
        const recorded = terrain.get(at);
        if (!recorded) pending.at = at;
        return recorded;
      } });
      if (pending.at) {
        const position = pending.at;
        const safeInEveryCase = unknown.every(value => {
          terrain.set(position, value);
          return check(targets, variant);
        });
        terrain.delete(position);
        return safeInEveryCase;
      }
      if (!turn || turn.at !== start.at) return false;
      damage = Math.min(damage, initial - count(turn.targets));
      if (!damage || best && (damage < best.damage || damage === best.damage && cost >= best.cost)) return false;
      turn.targets.sort((a, b) => a.at.localeCompare(b.at));
      turns.set(digest(turn), turn);
      return true;
    };
    if (!orders.every(targets => variants.every(variant => check(targets, variant)))) return;
    result.best = { change, turns: [...turns.values()], damage, cost };
  };
  const distance = new Map([[start.at, 0]]), open = [start.at];
  for (let i = 0; i < open.length; i++) {
    const from = open[i]!;
    // Build distances in the reverse graph. Available moves need not be symmetric.
    for (const [other, edges] of steps) {
      if (safe.has(other) && !blocking.has(other) && !distance.has(other)
        && [...edges].some(([label, to]) => to === from && available.includes(label))) {
        distance.set(other, distance.get(from)! + 1);
        open.push(other);
      }
    }
  }
  const actions: number[] = [];
  const limit = Math.min(8, capacity);
  const visit = (at: string, hits: number) => {
    if (!withinBudget() || (distance.get(at) ?? Infinity) > limit - actions.length) return;
    if (hits && at === start.at) consider(actions.slice().reverse(), hits);
    if (actions.length >= limit) return;
    const direct = start.targets.filter(body => contact.get(at)?.has(body.at)).length;
    if (direct) {
      actions.push(interaction);
      visit(at, hits + direct);
      actions.pop();
    }
    for (const [label, to] of steps.get(at) ?? []) {
      if (!available.includes(label) || !safe.has(to) || blocking.has(to)) continue;
      actions.push(label);
      visit(to, hits);
      actions.pop();
    }
  };
  visit(start.at, 0);
  const selected = result.best;
  if (!selected) return null;
  const plan: ScheduledProgramStep[] = [];
  const base = context.initial.base, details = { closedRound: true as const,
    ...(context.terrain?.marked.length ? { markedTerrain: context.terrain.marked } : {}) };
  const before = appendProgramEdits(plan, current, selected.change, base, details);
  plan.push({ kind: 'execute', before, word: before, base, forecasts: forecastsFor(selected.turns), ...details });
  return plan;
}
