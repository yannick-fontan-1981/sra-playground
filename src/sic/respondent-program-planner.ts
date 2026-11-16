import type { OccurrenceRecord } from '../logos-engine/v6-occurrence-scene.ts';

type Word = number[];
export type ProgramBody = { base: number[]; word: Word };
export type ProgramTurn = { base: number[]; targets: ProgramBody[] };
export type RespondentContext = { initial: ProgramTurn; points: number[][]; sites: number[][]; evidence: string[] };
export type ScheduledProgramStep = {
  kind: 'insert' | 'remove' | 'execute'; label?: number; before: Word; word: Word;
  base: number[]; forecasts: ProgramTurn[];
};
type Body = { at: string; word: Word };
type Turn = { at: string; targets: Body[] };
type Hypothesis = { removeTop: boolean; respondentsInteract: boolean };
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

export function planRespondentPrograms(model: OccurrenceRecord, context: RespondentContext, existing: Word,
  available: Word, remaining: number, deadline: number): ScheduledProgramStep[] | null {
  const motion = new Map<number, number[]>((model.moves as OccurrenceRecord[]).map(move => [move.label, move.vectors[0]]));
  const interaction = model.interaction.label as number, safe = new Set(context.points.map(key));
  const labels = [interaction, ...motion.keys()].filter(label => available.includes(label));
  const allowed = new Set([...motion.keys(), interaction]);
  if (!labels.includes(interaction) || context.initial.targets.some(body => body.word.some(label => !allowed.has(label)))) return null;
  const limit = Math.min(5, Math.max(existing.length, Math.max(...context.initial.targets.map(body => body.word.length)) + 2));
  const programs = enumerateWords(labels, limit);
  const sites = new Set(context.sites.map(key));
  const steps = new Map([...safe].map(at => [at, new Map([...motion].map(([label, vector]) => {
    const destination = offset(at, vector);
    return [label, safe.has(destination) ? destination : at] as const;
  }))]));
  const contact = new Map([...safe].map(at => [at, new Set((model.interaction.vectors as number[][]).map(vector => offset(at, vector)))]));

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
          if (!actors.some((other, position) => index !== position && other.word.length && other.at === destination)) actor.at = destination;
        }
      }
      if (targets.every(body => !body.word.length)) break;
    }
    return { at: actors[0]!.at, targets };
  };

  let projections = 0;
  const search = (start: Turn, current: Word, budget: number, allowTransfer: boolean) => {
    const access = new Map<string, Stage>();
    let best: Stage | null = null;
    for (const word of programs) {
      if (performance.now() >= deadline || projections >= 450_000) break;
      const change = changeWord(current, word), edits = change.remove + change.insert.length;
      if (edits >= budget || (best && edits + 1 >= best.cost)) continue;
      let variants = hypotheses.map(() => start);
      const returns: Turn[][] = [], seen = new Set<string>();
      for (let turn = 1; turn <= 10 && edits + turn <= budget; turn++) {
        const next = variants.map((variant, index) => execute(variant, word, hypotheses[index]!));
        projections += next.length;
        if (next.some(item => item === null)) break;
        variants = next as Turn[];
        if (variants.some(item => item.at !== variants[0]!.at)) break;
        const signatures = variants.map(digest), combined = signatures.join('|');
        if (seen.has(combined)) break;
        seen.add(combined);
        returns.push(variants);
        const stage = { word, change, returns: [...returns], cost: edits + turn };
        if (variants.every(item => item.targets.every(body => !body.word.length))) {
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
  const start = { at: key(context.initial.base), targets: context.initial.targets.map(body => ({ at: key(body.base), word: body.word })) };
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
    for (let count = 0; count < stage.change.remove; count++) {
      const word = before.slice(1);
      plan.push({ kind: 'remove', before, word, base, forecasts: [] });
      before = word;
    }
    for (const label of stage.change.insert) {
      const word = [label, ...before];
      plan.push({ kind: 'insert', label, before, word, base, forecasts: [] });
      before = word;
    }
    for (const variants of stage.returns) {
      const distinct = new Map(variants.map(turn => [digest(turn), turn]));
      const forecasts = [...distinct.values()].map(turn => ({ base: coordinates(turn.at),
        targets: turn.targets.filter(body => body.word.length).map(body => ({ base: coordinates(body.at), word: body.word })) }));
      plan.push({ kind: 'execute', before, word: before, base, forecasts });
      base = forecasts[0]!.base;
    }
  }
  return plan;
}
