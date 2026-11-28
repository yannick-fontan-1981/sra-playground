/** Reproducible evaluation-side P14 worlds; nothing in this module is agent input. */
export const FAMILIES = Object.freeze([
  'transient_then_period', 'ambiguous_periods', 'delayed_command', 'expiring_window',
  'cycle_intervention', 'independent_clocks', 'ordered_intermediates', 'partial_observation',
]);
const clone = value => structuredClone(value);
const mod = (a, b) => ((a % b) + b) % b;

function random(seed) {
  let state = seed >>> 0;
  return limit => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) % limit;
  };
}
function mix(seed, index, family) {
  let word = (Number(seed) ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  for (const char of family) word = Math.imul(word ^ char.charCodeAt(0), 0x85ebca6b) >>> 0;
  return word;
}
function clock(prefix, period, width, phase = 0) {
  return { kind: 'clock', prefix: [...prefix], cycle: Array.from({ length: period }, (_, i) => Number(i < width)), phase };
}
function transient(draw, length) {
  const out = Array.from({ length }, (_, i) => i === 0 ? 0 : draw(2));
  // A genuine non-periodic approach may itself temporarily resemble a short period.
  if (out.length > 2) out[out.length - 1] = 0;
  return out;
}

export function generateCase(family, index, seed) {
  if (!FAMILIES.includes(family)) throw new Error('Unknown P14 development family: ' + family);
  if (!Number.isSafeInteger(index) || index < 0 || !Number.isSafeInteger(Number(seed))) throw new Error('Invalid P14 seed/index');
  const draw = random(mix(seed, index, family));
  const integer = (min, max) => min + draw(max - min + 1);
  const channels = [], actions = [], worlds = [{ channels: {} }, { channels: {} }];
  const names = new Set();
  function name(prefix) {
    let id;
    do { id = prefix + integer(1000, 999999); } while (names.has(id));
    names.add(id);
    return id;
  }
  function addChannel(first, second = first) {
    const id = name('v'); channels.push(id);
    worlds[0].channels[id] = clone(first); worlds[1].channels[id] = clone(second);
    return id;
  }
  function add(kind, duration, fields = {}) {
    const id = name('k'); actions.push({ id, kind, duration, ...fields }); return id;
  }
  function move(from, to, duration, gates = [], extra = {}) { return add('move', duration, { from, to, gates, ...extra }); }
  let goal = 2, waitDuration = 1, inspectDuration = 1;

  if (family === 'transient_then_period') {
    const period = integer(4, 13), width = integer(2, Math.min(6, period - 1));
    const prefix = transient(draw, integer(2, 24)), phase = draw(period);
    const gate = addChannel(clock(prefix, period, width, phase), clock(prefix, period, width, mod(phase + 1, period)));
    move(0, 1, integer(1, 7));
    move(1, 2, integer(1, width), [gate]);
  } else if (family === 'ambiguous_periods') {
    const p = integer(4, 10), q = p + integer(1, 5), width = integer(2, Math.min(4, p - 1));
    const prefix = transient(draw, integer(3, 15));
    // Both worlds give exactly the same first pulse; the next recurrence separates p and q.
    const gate = addChannel(clock(prefix, p, width), clock(prefix, q, width));
    move(0, 1, integer(1, 5));
    move(1, 2, integer(1, width), [gate]);
  } else if (family === 'delayed_command') {
    const delay = integer(2, 14), width = integer(2, 7);
    const gate = addChannel({ kind: 'pulse', delay, width }, { kind: 'pulse', delay: delay + integer(1, 4), width });
    const p = integer(4, 13), w = integer(2, Math.min(5, p - 1));
    const automatic = addChannel(clock(transient(draw, integer(0, 11)), p, w, draw(p)));
    add('trigger', 1, { targets: [gate] });
    move(0, 1, integer(1, width), [gate]);
    // The concurrent automatic motion is also consumed later; it is not padding entropy.
    move(1, 2, integer(1, w), [automatic]);
  } else if (family === 'expiring_window') {
    goal = 3;
    const delay = integer(2, 13), width = integer(2, 6), travel = width + integer(1, 5);
    const gate = addChannel({ kind: 'pulse', delay, width }, { kind: 'pulse', delay: delay + integer(1, 3), width });
    move(0, 1, integer(1, 8));
    add('trigger', 1, { from: 1, targets: [gate] });
    move(1, 3, travel, [gate]);
    if (draw(2)) add('hold', 1, { from: 1, targets: [gate], holdTicks: travel + integer(1, 4), uses: 1 });
    // The detour shortens the gated portion, while lengthening the total travel.
    move(1, 2, integer(1, width), [gate]);
    move(2, 3, integer(5, 14));
  } else if (family === 'cycle_intervention') {
    const p = integer(4, 12), width = integer(2, Math.min(5, p - 1));
    const prefix = transient(draw, integer(3, 14));
    const gate = addChannel(clock(prefix, p, width, draw(p)));
    const first = move(0, 1, integer(1, width), [gate], { perturbs: [gate] });
    const q = integer(4, 14), nextWidth = integer(2, Math.min(6, q - 1));
    const kind = draw(3); // reset, shift, or interrupt before the resumed cycle
    const interruption = kind === 2 ? Array(integer(2, 15)).fill(0) : [];
    const shift = kind === 0 ? 0 : draw(q);
    worlds[0].replacements = { [first]: { [gate]: clock(interruption, q, nextWidth, shift) } };
    worlds[1].replacements = { [first]: { [gate]: clock(interruption, q, nextWidth, mod(shift + integer(1, q - 1), q)) } };
    move(1, 2, integer(1, nextWidth), [gate]);
  } else if (family === 'independent_clocks') {
    goal = 3;
    const p = integer(4, 11); let q;
    do { q = integer(5, 13); } while (q === p);
    const duration = integer(1, 3), w1 = Math.max(duration, integer(2, Math.min(5, p - 1)));
    const w2 = Math.max(duration, integer(2, Math.min(5, q - 1)));
    const prefix = transient(draw, integer(1, 12)), rendezvous = prefix.length + integer(15, 40);
    const aPhase = mod(prefix.length - rendezvous, p), bPhase = mod(prefix.length - rendezvous, q);
    const a = addChannel(clock(prefix, p, w1, aPhase));
    const b = addChannel(clock(prefix, q, w2, bPhase), clock(prefix, q, w2, mod(bPhase + 1, q)));
    move(0, 1, duration, [a, b]);
    move(1, 3, integer(1, 8));
    if (draw(2)) {
      move(0, 2, integer(1, w1), [a]);
      move(2, 3, integer(8, 17));
    }
  } else if (family === 'ordered_intermediates') {
    goal = 3;
    const p = integer(7, 16), width = integer(1, Math.min(3, Math.floor((p - 3) / 2)));
    const firstAt = integer(1, p - 2 * width - 2);
    const secondAt = integer(firstAt + width + 1, p - width);
    const word = at => Array.from({ length: p }, (_, i) => Number(i >= at && i < at + width));
    const a = addChannel({ kind: 'clock', prefix: [], cycle: word(firstAt), phase: 0 },
      { kind: 'clock', prefix: [], cycle: word(secondAt), phase: 0 });
    const b = addChannel({ kind: 'clock', prefix: [], cycle: word(secondAt), phase: 0 },
      { kind: 'clock', prefix: [], cycle: word(firstAt), phase: 0 });
    inspectDuration = p;
    move(0, 1, integer(1, width), [a]); move(0, 2, integer(1, width), [b]);
    move(1, 3, integer(1, 12)); move(2, 3, integer(1, 12));
    // inspect at t=0 returns the same final all-zero frame in both worlds;
    // the intermediate ordered events exchange the viable immediate windows.
  } else if (family === 'partial_observation') {
    const p = integer(5, 14), width = integer(2, Math.min(6, p - 1));
    const prefix = transient(draw, integer(0, 18));
    const maskLength = integer(3, 9), noiseLength = integer(3, 8);
    const mask = Array.from({ length: maskLength }, (_, i) => i === 0 ? 0 : Number(draw(3) === 0));
    const noise = Array.from({ length: noiseLength }, (_, i) => i === 0 ? 0 : Number(draw(3) === 0));
    const phase = draw(p);
    const a = { ...clock(prefix, p, width, phase), mask, noise };
    const b = { ...clock(prefix, p, width, mod(phase + integer(1, p - 1), p)), mask: [...mask], noise: [...noise] };
    const gate = addChannel(a, b);
    waitDuration = integer(2, 4);
    inspectDuration = integer(1, 3);
    move(0, 1, integer(1, 7)); move(1, 2, integer(1, width), [gate]);
  }
  add('wait', waitDuration); add('inspect', inspectDuration);
  // Presentation order and names are nuisance variables and are removed by signature().
  for (let i = actions.length - 1; i > 0; i--) { const j = draw(i + 1); [actions[i], actions[j]] = [actions[j], actions[i]]; }
  if (draw(2)) channels.reverse();
  return { version: 1, id: `P14-${family}-${seed}-${index}`, family,
    origin: integer(100, 1_000_000), budget: { actions: 180, ticks: 360, states: 20000 },
    public: { channels, initial: 0, goal, actions }, worlds };
}

function primitive(word) {
  for (let n = 1; n <= word.length; n++) if (word.length % n === 0 && word.every((v, i) => v === word[i % n])) return word.slice(0, n);
  return [...word];
}
function canonicalChannel(channel) {
  const result = { kind: channel.kind };
  if (channel.kind === 'clock') {
    let cycle = primitive(channel.cycle.map((_, i) => channel.cycle[mod(i + channel.phase, channel.cycle.length)]));
    const prefix = [...channel.prefix];
    // Extend the periodic suffix backwards as far as it is observationally identical.
    while (prefix.length && prefix.at(-1) === cycle.at(-1)) {
      prefix.pop(); cycle = [cycle.at(-1), ...cycle.slice(0, -1)];
    }
    result.prefix = prefix; result.cycle = cycle;
  } else { result.delay = channel.delay; result.width = channel.width; }
  if (channel.mask?.some(x => x !== 1)) result.mask = primitive(channel.mask);
  if (channel.noise?.some(x => x !== 0)) result.noise = primitive(channel.noise);
  return result;
}
function permutations(list) {
  if (list.length <= 1) return [list];
  return list.flatMap((item, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(rest => [item, ...rest]));
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

/** Canonical temporal transition signature, modulo channel/action names, presentation and clock origin. */
export function signature(spec) {
  const forms = permutations(spec.public.channels).map(order => {
    const names = new Map(order.map((id, i) => [id, `c${i}`]));
    const mapIds = list => list?.map(id => names.get(id)).sort();
    const mapped = spec.public.actions.map(action => {
      const { id, gates, targets, perturbs, ...base } = action;
      const publicAction = { ...base };
      if (gates) publicAction.gates = mapIds(gates);
      if (targets) publicAction.targets = mapIds(targets);
      if (perturbs) publicAction.perturbs = mapIds(perturbs);
      const replacement = spec.worlds.map(world => Object.fromEntries(order.filter(c => world.replacements?.[id]?.[c])
        .map(c => [names.get(c), canonicalChannel(world.replacements[id][c])]))).sort((a, b) => JSON.stringify(stable(a)).localeCompare(JSON.stringify(stable(b))));
      return { id, publicAction, sort: JSON.stringify(stable({ publicAction, replacement })) };
    }).sort((a, b) => a.sort.localeCompare(b.sort));
    const actionNames = new Map(mapped.map((a, i) => [a.id, `a${i}`]));
    const worlds = spec.worlds.map(world => ({
      channels: Object.fromEntries(order.map(id => [names.get(id), canonicalChannel(world.channels[id])])),
      replacements: Object.fromEntries(mapped.filter(a => world.replacements?.[a.id]).map(a => [actionNames.get(a.id),
        Object.fromEntries(order.filter(c => world.replacements[a.id][c]).map(c => [names.get(c), canonicalChannel(world.replacements[a.id][c])]))])),
    })).map(stable).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify(stable({ version: spec.version, budget: spec.budget, initial: spec.public.initial,
      goal: spec.public.goal, actions: mapped.map(a => a.publicAction), worlds }));
  });
  return forms.sort()[0];
}

export function shiftOrigin(spec, delta) {
  if (!Number.isSafeInteger(delta)) throw new Error('Invalid P14 clock-origin shift');
  return { ...clone(spec), origin: spec.origin + delta };
}
