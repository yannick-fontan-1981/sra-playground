/** Development-only laboratory. Hidden laws never cross publicProjection().
 * The oracle has its own transition implementation in sic-p05-oracle.mjs. */
import { createHash } from 'node:crypto';

export const P05_SCHEMA = 'sic-p05-lab-v1';
export const P05_FAMILIES = [
  { id: '1', name: 'unknown-displacement' },
  { id: '2', name: 'selected-receiver' },
  { id: '3', name: 'terrain-and-support' },
  { id: '4', name: 'phase-and-delay' },
  { id: '5', name: 'resource-and-exhaustion' },
  { id: '6', name: 'local-and-remote-causality' },
  { id: '7', name: 'transferred-evidence' },
  { id: '8', name: 'initially-equivalent-commands' },
];
export const DEFAULT_SEED = 26112805;
export const MODEL_CONTRACT = Object.freeze({
  version: 'finite-interventional-contexts-v1',
  deterministic: true,
  prepare: 'Public, one gesture; resets the listed context, clock, actors and pending effects.',
  command: 'One intervention per episode; its unknown bounded-latency effect has a selected or fixed receiver.',
  background: 'Context-specific constant remote drift per tick; measured by time-matched WAIT controls.',
  scope: 'Only the listed, measured public contexts; no claim of universal guard discovery.',
  resource: 'A command spends its nonnegative cost when affordable; otherwise it has no causal effect.',
  observation: 'Complete, noiseless public positions, selection, context, reserve and remote counter after each gesture.',
  excluded: ['hidden persistent state between prepared episodes', 'unbounded latency', 'unobserved context discovery'],
});
const copy = value => structuredClone(value);
export const digest = value => createHash('sha256').update(typeof value === 'string' || ArrayBuffer.isView(value)
  ? value : JSON.stringify(value)).digest('hex');
export function randomSource(seed) {
  let word = seed >>> 0;
  return limit => {
    word = (word + 0x6d2b79f5) | 0;
    let n = Math.imul(word ^ word >>> 15, 1 | word);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) % limit;
  };
}
const shuffle = (values, draw) => {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = draw(i + 1); [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const vector = draw => {
  const n = (1 + draw(19)) * (draw(2) ? 1 : -1);
  return draw(2) ? [n, 0] : [0, n];
};
const differentVector = (draw, previous) => {
  let v; do { v = vector(draw); } while (JSON.stringify(v) === JSON.stringify(previous));
  return v;
};
const conditionList = context => [
  ...Object.entries(context.context).map(([field, equals]) => ({ field: `context.${field}`, equals })),
  { field: 'reserve', equals: context.reserve },
  { field: 'selected', equals: context.selected },
].sort((a, b) => a.field.localeCompare(b.field));

/** The private table is varied before any learner is run. No success-conditioned generation. */
export function generateP05Situation(familyId, draw, serial = 0) {
  const family = String(familyId);
  if (!P05_FAMILIES.some(item => item.id === family)) throw new Error(`Unknown development family ${family}`);
  const commands = shuffle(['ACTION1', 'ACTION2', ...(draw(3) === 0 && family !== '8' ? ['ACTION3'] : [])], draw);
  const subjectIds = shuffle(['body-a', 'body-b', ...(family === '2' && draw(2) ? ['body-c'] : [])], draw);
  const initialSubjects = subjectIds.map((id, index) => ({ id, position: [index * 80, index * 37] }));
  const nContexts = family === '1' ? 1 : family === '2' ? subjectIds.length : ['3', '4', '5', '7'].includes(family) ? 3 : 2;
  const maxLatency = 3; // Same public envelope in every family; never disclose the sampled delay.
  const contexts = Array.from({ length: nContexts }, (_, index) => ({
    id: `setting-${index}`,
    selected: family === '2' ? subjectIds[index] : subjectIds[0],
    subjects: copy(initialSubjects),
    context: { terrain: 'surface-a', supported: true, blocked: false, phase: 0 },
    reserve: 20,
    remote: 0,
  }));
  if (family === '3') {
    contexts[0].context.blocked = true;
    contexts[1].context.terrain = 'surface-b';
    contexts[2].context.supported = false;
    contexts[2].context.terrain = 'surface-b';
  } else if (family === '4') {
    contexts.forEach((context, index) => { context.context.phase = index; });
  } else if (family === '5') {
    contexts[0].reserve = 0;
    contexts[1].reserve = 1 + draw(5);
    contexts[2].reserve = 7 + draw(8);
  } else if (['6', '7', '8'].includes(family)) {
    contexts.forEach((context, index) => { context.context.terrain = `surface-${String.fromCharCode(97 + index)}`; });
  }
  const vectors = commands.map(() => vector(draw));
  // Ensure behavioral diversity is in responses, never in identifiers or unused geometry.
  for (let i = 1; i < vectors.length; i++) vectors[i] = differentVector(draw, vectors[i - 1]);
  const costs = commands.map(() => family === '5' ? 1 + draw(5) : 0);
  const delays = commands.map(() => family === '4' ? 1 + draw(3) : 0);
  const activePhase = family === '4' ? draw(3) : 0;
  const transferredVariant = draw(3);
  const remoteCausal = commands.map(() => family === '6' ? 1 + draw(8) : 0);
  const ambient = contexts.map(context => ({ contextId: context.id, remotePerTick: family === '6' ? 1 + draw(4) : 0 }));
  const laws = [];
  for (let ci = 0; ci < contexts.length; ci++) {
    const context = contexts[ci];
    for (let qi = 0; qi < commands.length; qi++) {
      let delta = [...vectors[qi]], delay = delays[qi], resourceCost = costs[qi], remoteDelta = remoteCausal[qi];
      if (family === '3' && (context.context.blocked || !context.context.supported)) delta = [0, 0];
      if (family === '4' && ci !== activePhase) { delta = [0, 0]; delay = 0; }
      if (family === '6' && ci === 1 && qi === 0) remoteDelta = 0; // A time-matched control still exposes ambient drift.
      if (family === '7' && transferredVariant === 1 && ci > 0) delta = differentVector(draw, vectors[qi]);
      if (family === '7' && transferredVariant === 2 && ci === 2) delta = [0, 0];
      if (family === '8') delta = ci === 0 ? [...vectors[0]] : [...vectors[qi]];
      laws.push({ contextId: context.id, command: commands[qi], receiver: family === '2' ? 'selected' : context.selected,
        delta, delay, resourceCost, remoteDelta });
    }
  }
  const publicSpec = { commands: shuffle(commands, draw), contexts: shuffle(contexts, draw), maxLatency,
    commandBudget: 96, modelContract: MODEL_CONTRACT, priorClaims: [] };
  if (family === '7') {
    publicSpec.priorClaims = commands.map((command, qi) => ({
      effectId: `old:${qi}`, command, receiver: subjectIds[0], delta: [...vectors[qi]], delay: 0,
      resourceCost: 0, remoteDelta: 0, conditions: transferredVariant === 0 ? conditionList(contexts[0]) : [],
      supportingReturnIds: [`old:return-${qi}`], limitingReturnIds: [], status: 'confirmed',
    }));
  }
  if (family === '8') {
    const chosen = draw(commands.length), context = contexts[1], law = laws.find(item => item.contextId === context.id && item.command === commands[chosen]);
    const body = context.subjects.find(subject => subject.id === context.selected);
    publicSpec.selectionObjective = { contextId: context.id, receiver: body.id,
      target: [body.position[0] + law.delta[0], body.position[1] + law.delta[1]] };
  }
  return { schema: P05_SCHEMA, id: `development-${family}-${serial}`, family,
    publicSpec, privateSpec: { laws, ambient } };
}

/** This is the ONLY projection handed to an acquisition policy/learner. */
export function publicProjection(spec) {
  return copy(spec.publicSpec);
}

export function createLaboratory(spec) {
  const known = new Map(spec.publicSpec.contexts.map(context => [context.id, context]));
  let epochNumber = 0, receiptNumber = 0, contextId = spec.publicSpec.contexts[0].id;
  let state, pending = [];
  const reset = context => {
    state = { ref: `e${epochNumber}:t0`, epoch: `e${epochNumber}`, tick: 0, selected: context.selected,
      subjects: copy(context.subjects), context: copy(context.context), reserve: context.reserve, remote: context.remote };
    pending = [];
  };
  reset(known.get(contextId));
  function step(action) {
    const before = copy(state);
    if (action.kind === 'prepare') {
      if (!known.has(action.contextId)) throw new Error('Inaccessible preparation');
      contextId = action.contextId; epochNumber++; reset(known.get(contextId));
    } else {
      if (!['command', 'wait'].includes(action.kind)) throw new Error('Unknown gesture');
      if (action.kind === 'command') {
        if (!spec.publicSpec.commands.includes(action.command)) throw new Error('Unavailable command');
        const law = spec.privateSpec.laws.find(law => law.contextId === contextId && law.command === action.command);
        if (!law) throw new Error('Incomplete evaluator table');
        if (state.reserve >= law.resourceCost) {
          state.reserve -= law.resourceCost;
          pending.push({ tick: state.tick + 1 + law.delay,
            receiver: law.receiver === 'selected' ? state.selected : law.receiver,
            delta: [...law.delta], remoteDelta: law.remoteDelta });
        }
      }
      state.tick++;
      state.remote += spec.privateSpec.ambient.find(item => item.contextId === contextId)?.remotePerTick ?? 0;
      for (const effect of pending.filter(effect => effect.tick === state.tick)) {
        const receiver = state.subjects.find(subject => subject.id === effect.receiver);
        if (!receiver) throw new Error('Unknown physical receiver');
        receiver.position[0] += effect.delta[0]; receiver.position[1] += effect.delta[1];
        state.remote += effect.remoteDelta;
      }
      pending = pending.filter(effect => effect.tick > state.tick);
      state.ref = `${state.epoch}:t${state.tick}`;
    }
    return { ...copy(action), id: `r${++receiptNumber}`, before, after: copy(state), elapsed: 1 };
  }
  return { observation: () => copy(state), step };
}

/** A public, fixed experiment, independent of all laws, witnesses and family labels.
 * It is deliberately common to both arms: this campaign isolates P05, not P04. */
export function publicExperiment(publicSpec) {
  const actions = [];
  for (const context of publicSpec.contexts) {
    actions.push({ kind: 'prepare', command: 'PREPARE', contextId: context.id });
    for (let tick = 0; tick <= publicSpec.maxLatency; tick++) actions.push({ kind: 'wait', command: 'WAIT' });
    for (const command of publicSpec.commands) {
      actions.push({ kind: 'prepare', command: 'PREPARE', contextId: context.id });
      actions.push({ kind: 'command', command });
      for (let tick = 0; tick < publicSpec.maxLatency; tick++) actions.push({ kind: 'wait', command: 'WAIT' });
    }
  }
  return actions;
}

const permutations = values => values.length <= 1 ? [[...values]] : values.flatMap((value, index) =>
  permutations(values.filter((_, other) => index !== other)).map(rest => [value, ...rest]));

/** Canonical observable experiment graph modulo GLOBAL command/subject/terrain renaming.
 * Rows are resettable contexts; every command response and every return tick is included.
 * Unused private parameters, IDs, enumeration order and absolute positions are absent.
 * The row transition graph is fully determined by these responses under this contract. */
export function behaviorSignature(spec) {
  const pub = spec.publicSpec;
  const subjects = [...new Set(pub.contexts.flatMap(context => context.subjects.map(subject => subject.id)))];
  const terrains = [...new Set(pub.contexts.map(context => String(context.context.terrain)))];
  // Evaluate the physical response once, then relabel its public semantics globally.
  const responses = pub.contexts.map(context => {
    const episodes = [null, ...pub.commands].map(command => {
      const world = createLaboratory(spec);
      world.step({ kind: 'prepare', command: 'PREPARE', contextId: context.id });
      const initial = world.observation(), ticks = [];
      for (let t = 0; t <= pub.maxLatency; t++) {
        const receipt = world.step(t === 0 && command !== null ? { kind: 'command', command } : { kind: 'wait', command: 'WAIT' });
        ticks.push({ positions: Object.fromEntries(receipt.after.subjects.map(subject => {
          const origin = initial.subjects.find(item => item.id === subject.id).position;
          return [subject.id, [subject.position[0] - origin[0], subject.position[1] - origin[1]]];
        })), reserve: receipt.after.reserve - initial.reserve, remote: receipt.after.remote - initial.remote });
      }
      return ticks;
    });
    return { context, episodes };
  });
  let best;
  for (const commandOrder of permutations(pub.commands)) for (const subjectOrder of permutations(subjects)) for (const terrainOrder of permutations(terrains)) {
    const rows = responses.map(({ context, episodes }) => {
      const describe = { ...context.context, terrain: terrainOrder.indexOf(String(context.context.terrain)) };
      const normalizedEpisodes = [0, ...commandOrder.map(command => 1 + pub.commands.indexOf(command))].map(index =>
        episodes[index].map(tick => [subjectOrder.map(subject => tick.positions[subject]), tick.reserve, tick.remote]));
      return [Object.entries(describe).sort(([a], [b]) => a.localeCompare(b)), subjectOrder.indexOf(context.selected),
        context.reserve, normalizedEpisodes];
    }).map(row => JSON.stringify(row)).sort();
    // Family/prior story are excluded: the same physical experiment cannot fill two quotas.
    const candidate = JSON.stringify(rows);
    if (best === undefined || candidate < best) best = candidate;
  }
  return { hash: digest(best), canonical: best };
}

/** Invariance transformation: it must NEVER create a new corpus situation. */
export function renameAndPermute(spec, seed = 17) {
  const renamed = copy(spec), draw = randomSource(seed), pub = renamed.publicSpec;
  const commandMap = new Map(pub.commands.map((command, index) => [command, `opaque-${index + 19}`]));
  const ids = [...new Set(pub.contexts.flatMap(context => context.subjects.map(subject => subject.id)))];
  const bodyMap = new Map(ids.map((id, index) => [id, `piece-${index + 77}`]));
  const contextMap = new Map(pub.contexts.map((context, index) => [context.id, `context-${index + 91}`]));
  const terrains = [...new Set(pub.contexts.map(context => context.context.terrain))];
  const terrainMap = new Map(terrains.map((terrain, index) => [terrain, `texture-${index + 31}`]));
  pub.commands = shuffle(pub.commands.map(command => commandMap.get(command)), draw);
  for (const context of pub.contexts) {
    context.id = contextMap.get(context.id); context.selected = bodyMap.get(context.selected);
    context.context.terrain = terrainMap.get(context.context.terrain);
    context.subjects = shuffle(context.subjects.map(subject => ({ id: bodyMap.get(subject.id),
      position: [subject.position[0] + 233, subject.position[1] - 78] })), draw);
  }
  pub.contexts = shuffle(pub.contexts, draw);
  for (const law of renamed.privateSpec.laws) {
    law.contextId = contextMap.get(law.contextId); law.command = commandMap.get(law.command);
    if (law.receiver !== 'selected') law.receiver = bodyMap.get(law.receiver);
  }
  renamed.privateSpec.laws = shuffle(renamed.privateSpec.laws, draw);
  for (const item of renamed.privateSpec.ambient) item.contextId = contextMap.get(item.contextId);
  for (const claim of pub.priorClaims ?? []) {
    claim.command = commandMap.get(claim.command);
    if (claim.receiver !== 'selected') claim.receiver = bodyMap.get(claim.receiver);
    for (const condition of claim.conditions) {
      if (condition.field === 'selected') condition.equals = bodyMap.get(condition.equals);
      if (condition.field === 'context.terrain') condition.equals = terrainMap.get(condition.equals);
    }
  }
  if (pub.selectionObjective) {
    pub.selectionObjective.contextId = contextMap.get(pub.selectionObjective.contextId);
    pub.selectionObjective.receiver = bodyMap.get(pub.selectionObjective.receiver);
    pub.selectionObjective.target = [pub.selectionObjective.target[0] + 233, pub.selectionObjective.target[1] - 78];
  }
  renamed.id = `renamed-${seed}`;
  return renamed;
}

/** Independent operator owns all holdout generation. There is no reserve seed or switch here. */
export function developmentSeeds(seed = DEFAULT_SEED) {
  return Object.fromEntries(P05_FAMILIES.map(({ id }) => [id, (seed + Number(id) * 1009) >>> 0]));
}
