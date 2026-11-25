import { composePlan } from '../src/sic/effect-composer.ts';

const permit = 1, left = 2, right = 4, latch = 8, proof = 16, charged = 32;
const firstStage = 64;
const rules = {
  handoff: ['relay'], persistent: ['latch'], deadline: ['time'], resource: ['stock'],
  observation: ['proof'], conjunction: ['both'],
  'delayed-latch-with-budget': ['time', 'latch', 'stock'],
  'witnessed-conjunction': ['both', 'proof'],
  'timed-handoff-with-proof': ['time', 'relay', 'proof'],
};
export const development = Object.keys(rules).slice(0, 6);
export const reserved = Object.keys(rules).slice(6);

export function generateMechanic(family, draw) {
  const integer = (from, to) => from + draw(to - from + 1);
  const has = trait => rules[family].includes(trait);
  const timed = has('time'), stages = integer(3, 5);
  const negative = draw(5) === 0;
  const operations = [];
  const add = (name, declarations = {}) => operations.push({
    name, needs: 0, forbids: 0, held: 0, either: 0, adds: 0, clears: 0, breakDuring: 0,
    post: 0, delay: 0, window: 0, ticks: 1, cost: 0, ...declarations,
  });
  let initialFacts = 0, finalClear = 0, finalFacts = 0;
  if (has('relay')) {
    initialFacts |= left;
    add('relâcher avant le relais', { needs: left, either: left | right, clears: left, adds: right, breakDuring: left, ticks: 2 });
    add('passer le relais sous appui', { needs: left, either: left | right, clears: left, adds: right, ticks: integer(1, 3) });
  }
  if (has('latch')) {
    add('occuper la commande', { forbids: left, adds: left });
    add('enclencher le verrou', { needs: left, adds: latch, post: latch, ticks: integer(1, 2) });
    add('libérer la commande', { needs: left, clears: left });
    finalClear |= left;
    finalFacts |= latch;
  }
  if (has('both')) {
    add('placer le premier appui', { needs: finalFacts, adds: left, ticks: integer(1, 3) });
    add('placer le second appui', { needs: draw(2) ? left : 0, adds: right, ticks: integer(1, 3) });
  }
  if (timed) {
    add('amorcer la fenêtre', { delay: integer(1, 3), window: integer(4, 7), ticks: integer(1, 2) });
    add('attendre un tick');
  }
  if (has('proof')) {
    add('supposer le signal', { post: proof });
    if (!negative) add('observer le signal', { adds: proof, post: proof, ticks: integer(1, 3) });
  }
  if (has('stock')) {
    add('préparer le passage économe', { adds: charged, post: charged, cost: 1, ticks: integer(1, 3) });
  }
  const stock = has('stock') ? stages + 1 : 0;
  for (let stage = 0; stage < stages; stage++) {
    const bit = firstStage << stage;
    let needs = 0;
    for (let parent = 0; parent < stage; parent++) {
      if (draw(3) === 0 || parent === stage - 1 && draw(3) < 2) needs |= firstStage << parent;
    }
    if (has('relay')) needs |= stage === 0 && draw(2) ? 0 : right;
    if (has('proof') && (stage === stages - 1 || draw(2))) needs |= proof;
    if (negative && !has('proof') && stage === stages - 1) needs |= proof;
    const held = (timed && (stage === stages - 1 || draw(3)) ? permit : 0)
      | (has('both') && (stage !== 0 || draw(2)) ? left | right : 0)
      | (has('latch') && (stage !== 0 || draw(2)) ? latch : 0);
    const ticks = integer(1, 3);
    if (has('stock')) add('forcer le passage ' + (stage + 1),
      { needs, forbids: bit, held, adds: bit, cost: integer(3, 5) });
    add('valider le passage ' + (stage + 1), { needs: needs | (has('stock') ? charged : 0), forbids: bit,
      held, adds: bit, post: bit, cost: has('stock') ? 1 : 0, ticks });
    finalFacts |= bit;
  }
  // This fixes a real ordering choice even when the operator graph is familiar.
  for (let index = operations.length - 1; index > 0; index--) {
    const other = draw(index + 1);
    [operations[index], operations[other]] = [operations[other], operations[index]];
  }
  return { family, timed, initialFacts, finalClear, finalFacts, stock, negative, operations };
}

const covers = (facts, wanted) => (facts & wanted) === wanted;
const bitCount = value => value.toString(2).replaceAll('0', '').length;
const start = spec => ({ facts: spec.initialFacts, units: spec.stock, tick: 0, ready: 0, until: 0 });
const complete = (spec, state) => covers(state.facts, spec.finalFacts) && !(state.facts & spec.finalClear);
const identity = (spec, state) => spec.timed
  ? [state.facts, state.units, state.tick, state.ready, state.until].join(',')
  : (state.facts << 5) + state.units;

function projectionKey(spec, { facts, tick, ready, until }) {
  if (!spec.timed) return facts;
  // An expired window leaves no future transition. An open window only keeps its closing time.
  return [facts, tick, until > tick ? Math.max(ready, tick) : 0, until > tick ? until : 0].join(',');
}
const maxTicks = 33, maxActions = 21;

function project(spec, before, op) {
  const { facts, units, tick } = before;
  const after = { facts: (facts & ~op.clears) | op.adds, units: units - op.cost,
    tick: tick + op.ticks, ready: before.ready, until: before.until };
  if (op.window) {
    after.ready = after.tick + op.delay;
    after.until = after.ready + op.window;
  }
  const atTime = state => {
    if (state.tick >= state.ready && state.tick < state.until) state.facts |= permit;
    else state.facts &= ~permit;
    return state;
  };
  const during = [];
  for (let elapsed = 1; elapsed < op.ticks; elapsed++) {
    during.push(atTime({ ...before, facts: facts & ~op.breakDuring, tick: tick + elapsed }));
  }
  return {
    action: op, after: atTime(after), during,
    requires: [{ relation: 'préconditions et capacité',
      holds: state => covers(state.facts, op.needs) && !(state.facts & op.forbids) && state.units >= op.cost }],
    maintains: [{ relation: 'maintien pendant la transition',
      holds: state => covers(state.facts, op.held) && (!op.either || Boolean(state.facts & op.either)) }],
    ensures: [{ relation: 'effet observable et horizon',
      holds: state => covers(state.facts, op.post) && (!spec.timed || state.tick <= maxTicks) }],
    evidence: op.needs & proof ? ['signal déjà observé'] : [],
  };
}

// Independent execution law. It executes each clock tick and cannot read projected states or contracts.
function execute(spec, before, op) {
  if ((before.facts & op.needs) !== op.needs || (before.facts & op.forbids) || before.units < op.cost) return;
  const stillSafe = facts => (facts & op.held) === op.held && (op.either === 0 || (facts & op.either) !== 0);
  if (!stillSafe(before.facts)) return;
  let { tick, ready, until } = before;
  let facts = before.facts;
  for (let remaining = op.ticks; remaining > 0; remaining--) {
    tick++;
    if (spec.timed && tick > maxTicks) return;
    if (remaining === 1) {
      facts = (before.facts & ~op.clears) | op.adds;
      if (op.window !== 0) {
        ready = tick + op.delay;
        until = ready + op.window;
      }
    } else {
      facts &= ~op.breakDuring;
    }
    facts = tick < ready || tick >= until ? facts & ~permit : facts | permit;
    if (!stillSafe(facts)) return;
  }
  if ((facts & op.post) !== op.post) return;
  return { tick, facts, ready, until, units: before.units - op.cost };
}

function searchReplay(spec, greedy) {
  const initial = start(spec);
  const frontier = [{ state: initial, length: 0 }];
  const seen = new Set([identity(spec, initial)]);
  for (let index = 0; index < frontier.length; index++) {
    const { state, length } = frontier[index];
    if (complete(spec, state)) return length;
    if (length === maxActions) continue;
    const choices = [];
    for (const op of spec.operations) {
      const next = execute(spec, state, op);
      if (!next) continue;
      const key = identity(spec, next);
      if (seen.has(key)) continue;
      if (!greedy) {
        seen.add(key);
        frontier.push({ state: next, length: length + 1 });
        continue;
      }
      const missed = bitCount((spec.finalFacts & ~next.facts) | (spec.finalClear & next.facts));
      choices.push({ next, key, missed, tick: next.tick });
    }
    if (choices.length) {
      choices.sort((a, b) => a.missed - b.missed || a.tick - b.tick || b.next.units - a.next.units);
      seen.add(choices[0].key);
      frontier.push({ state: choices[0].next, length: length + 1 });
    }
  }
}

export function compareMechanic(spec) {
  const initial = start(spec);
  const certificate = composePlan({
    domain: spec.family, initial, key: state => projectionKey(spec, state),
    reserve: state => state.units,
    goal: { relation: 'conditions finales', holds: state => complete(spec, state) },
    *choices(state) { for (const op of spec.operations) yield project(spec, state, op); },
    budget: { commands: maxActions, states: 70000 },
  });
  const baseline = searchReplay(spec, true);
  const oracle = searchReplay(spec, false);
  const effects = certificate?.effects ?? [];
  let current = initial;
  for (const { action } of effects) {
    current = execute(spec, current, action);
    if (!current) break;
  }
  const invalid = Boolean(certificate) && (!current || !complete(spec, current)
    || identity(spec, current) !== identity(spec, certificate.end));
  const commands = certificate && !invalid ? effects.length : null;
  const plan = commands === null ? null : effects.map(({ action, after }) =>
    ({ action: action.name, tick: after.tick, units: after.units }));
  return { commands, baseline: baseline ?? null, oracle: oracle ?? null, invalid, plan };
}
