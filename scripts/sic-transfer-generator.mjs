import { createHash } from 'node:crypto';

const consumers = ['clocked-arrival', 'switched-support'];
const discoveryIntents = ['transfer', 'transfer', 'transfer', 'transfer', 'late-onset', 'contradiction', 'insufficient', 'control'];
const probeIntents = ['late-onset', 'late-onset', 'late-onset', 'late-onset', 'late-onset', 'contradiction', 'insufficient', 'control'];

function randomFrom(seed) {
  let state = (seed >>> 0) || 1;
  return limit => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % limit;
  };
}

function periodicPattern(random, length, maximum) {
  for (;;) {
    const pattern = Array.from({ length }, () => random(maximum + 1));
    if (!pattern.includes(maximum) || pattern.every(value => value === maximum)) continue;
    const repeated = pattern.some((_, index) => {
      const period = index + 1;
      return period < length && length % period === 0 && pattern.every((value, i) => value === pattern[i % period]);
    });
    if (!repeated) return pattern;
  }
}

function createClock(random, startup, forcePeriod) {
  const phases = periodicPattern(random, forcePeriod ?? 2 + random(5), 1);
  const prefix = Array.from({ length: startup }, () => random(2));
  if (prefix.length) prefix[prefix.length - 1] = 1 - phases.at(-1);
  return { phases, prefix };
}

function clockSituation(random, intent, stage) {
  const late = intent === 'late-onset' || (stage === 'probe' && intent === 'contradiction');
  const startup = intent === 'control' ? 0 : late ? 4 + random(3) : 1 + random(3);
  const small = intent === 'insufficient';
  const distance = small ? 8 + random(2) : 25 + random(5);
  const admission = 7 + random(2);
  const gates = [{ at: admission, ...createClock(random, startup, small ? 6 : undefined) }];
  if (!small && random(2)) gates.push({ at: 12 + random(3), ...createClock(random, startup) });
  const delays = [{ at: 1 + random(2), ticks: 1 + random(3) }];
  if (random(2)) delays.push({ at: 4 + random(2), ticks: 1 + random(3) });
  return { strategy: consumers[0], intent, distance, gates, delays, disturbance: intent === 'contradiction' ? 19 + random(3) : null };
}

function supportSituation(random, intent, stage) {
  const late = intent === 'late-onset' || (stage === 'probe' && intent === 'contradiction');
  const startupLength = intent === 'control' ? 0 : late ? 4 + random(3) : 1 + random(3);
  const span = 2 + random(2), all = (1 << span) - 1;
  const phases = periodicPattern(random, 2 + random(5), all);
  const startup = Array.from({ length: startupLength }, () => 1 + random(all));
  const offset = intent === 'contradiction' ? startupLength + 2 * phases.length - 1 : null;
  const controlAccess = random(2) ? 'home' : 'supported';
  return { strategy: consumers[1], intent, span, phases, startup, disturbance: offset, controlAccess };
}

function semanticKey(spec) {
  if (spec.strategy === consumers[0]) {
    const { strategy, distance, gates, delays, disturbance } = spec;
    return JSON.stringify([strategy, distance, gates, delays, disturbance]);
  }
  const { strategy, intent, span, phases, startup, disturbance, controlAccess } = spec;
  return JSON.stringify([strategy, span, phases, startup, disturbance, controlAccess, intent === 'insufficient']);
}

export function generateSituations(count, seed, stage, existing = new Set()) {
  const random = randomFrom(seed);
  const intents = stage === 'probe' ? probeIntents : discoveryIntents;
  const situations = [];
  for (let attempt = 0; situations.length < count; attempt++) {
    if (attempt >= count * 120) throw new Error('The generator exhausted this campaign');
    const i = situations.length;
    const intent = intents[Math.floor(i / 2) % intents.length];
    const spec = i % 2 === 0 ? clockSituation(random, intent, stage) : supportSituation(random, intent, stage);
    const key = createHash('sha256').update(semanticKey(spec)).digest('hex');
    if (existing.has(key)) continue;
    existing.add(key);
    situations.push({ key, spec });
  }
  return situations;
}

export function startupLength(spec) {
  return spec.strategy === consumers[0] ? Math.max(...spec.gates.map(gate => gate.prefix.length)) : spec.startup.length;
}
