import { createHash } from 'node:crypto';

export const families = [
  'F1-detour', 'F2-viewpoint', 'F3-contact-order', 'F4-held-support',
  'F5-temporary-opening', 'F6-construct-route', 'F7-uncertain-location', 'F8-recovery',
];
export const familyNames = {
  'F1-detour': 'Contournement et entrée alternative',
  'F2-viewpoint': 'Point de vue et rattachement du sujet',
  'F3-contact-order': 'Contact puis interaction',
  'F4-held-support': 'Appui maintenu et relais',
  'F5-temporary-opening': 'Ouverture temporaire et retour',
  'F6-construct-route': 'Construction et ressource',
  'F7-uncertain-location': 'Localisations et routes plausibles',
  'F8-recovery': 'Reprise après contradiction',
};

const yes = () => ({ all: [] });
const eq = (variable, value) => ({ variable, eq: value });
const min = (variable, value) => ({ variable, min: value });
const all = (...conditions) => ({ all: conditions.filter(Boolean) });
const any = (...conditions) => ({ any: conditions.filter(Boolean) });
const set = (variable, value) => ({ variable, set: value });
const add = (variable, value) => ({ variable, add: value });
const copy = value => structuredClone(value);

function builder(family, draw, seed, index) {
  let nextNode = 1;
  const shortcutCandidates = [];
  const spec = {
    protocol: 'sic-p07-access-v1', id: `p07-${family}-${index}`, family, seed,
    variables: [], initial: [{}], actions: [],
    goal: eq('done', 1), invariant: eq('alive', 1), parentInvariant: min('reserve', 1),
    budget: { commands: 64, states: 24000 },
    structure: {}, presentation: { rotation: 0, offset: [0, 0], palette: [2, 5, 8, 11] },
  };
  const variable = (id, role, value, options = {}) => {
    spec.variables.push({ id, role, ...options });
    for (const state of spec.initial) state[id] = value;
    return id;
  };
  variable('traveler', 'position', 0);
  variable('done', 'access-postcondition', 0);
  variable('alive', 'safety', 1);
  variable('reserve', 'return-resource', 2);
  const node = () => nextNode++;
  const action = (kind, requires, updates, extra = {}) => {
    const a = { id: `a${spec.actions.length}`, kind, requires, updates, ...extra };
    spec.actions.push(a);
    return a;
  };
  const move = (from, to, options = {}) => {
    const actor = options.actor ?? 'traveler';
    const guard = all(eq(actor, from), options.guard,
      options.selected === undefined ? undefined : eq('selected', options.selected));
    return action('move', guard, [set(actor, to), ...(options.updates ?? [])], {
      events: [{ kind: 'crossing', actor, from, to, ...(options.dependency ? { dependency: options.dependency } : {}) },
        ...(options.events ?? [])],
      ...(options.throughout ? { throughout: options.throughout } : {}),
      ...(options.branches ? { branches: options.branches } : {}),
    });
  };
  const chain = (from, to, length, options = {}) => {
    let p = from;
    const steps = [];
    for (let i = 0; i < length; i++) {
      const q = i === length - 1 ? to : node();
      steps.push(move(p, q, options));
      if (options.bidirectional) move(q, p, options);
      p = q;
    }
    return steps;
  };
  // Each stage has two genuinely different directed routes between branching vertices.
  // Length pairs are unordered: exchanging the two routes never creates a new case.
  const braid = (from, stages = 3, options = {}) => {
    let p = from;
    const lengths = [];
    let ordinaryCost = 0;
    for (let stage = 0; stage < stages; stage++) {
      const q = node();
      const a = 1 + draw(4), b = 1 + draw(4);
      lengths.push([Math.min(a, b), Math.max(a, b)]);
      ordinaryCost += Math.min(a, b);
      chain(p, q, a, options);
      // Avoid duplicate parallel edges when both routes consist of one command.
      if (a !== 1 || b !== 1) chain(p, q, b, options);
      p = q;
      if (ordinaryCost >= 4) shortcutCandidates.push({ from, to: q, options, ordinaryCost });
    }
    return { end: p, lengths };
  };
  const finish = (from, options = {}) => {
    const to = node();
    const terminal = draw(2) === 1;
    move(from, to, {
      ...options, updates: [...(options.updates ?? []), set('done', 1)],
      events: [...(options.events ?? []), { kind: 'access', subject: 'requested-subject', dependency: options.dependency ?? 'route-proof' },
        ...(terminal ? [{ kind: 'official-win' }] : [])],
    });
    return to;
  };
  const shortcut = (from, to) => move(from, to, {
    guard: min('reserve', 2), updates: [add('reserve', -2)], dependency: 'return-resource',
  });
  return { spec, variable, node, action, move, chain, braid, finish, shortcut, shortcutCandidates };
}

function detour(b, draw) {
  const { spec, node, variable, move, braid, finish, action } = b;
  variable('blocked', 'permanent-barrier', 0);
  const ingress = braid(0, 3);
  const far = node();
  // A tempting route is physically blocked. The alternative can only be entered from this side.
  move(ingress.end, far, { guard: eq('blocked', 1), dependency: 'blocked-direct-edge' });
  const bypass = braid(ingress.end, 2);
  move(bypass.end, far, { dependency: 'alternative-entry' });
  if (draw(2)) move(far, ingress.end, { dependency: 'one-way-return' });
  const trap = node();
  move(ingress.end, trap, { dependency: 'wrong-one-way-entry' });
  // The dead end has no path to the target; this is a physical trap, not an oracle label.
  action('wait', eq('traveler', trap), []);
  finish(far, { dependency: 'alternative-entry' });
  spec.structure = { mechanism: 'detour', ingress: ingress.lengths, bypass: bypass.lengths };
}

const rotate = ([x, y], r) => r === 0 ? [x, y] : r === 1 ? [-y, x] : r === 2 ? [-x, -y] : [y, -x];
const offset = ([x, y], [dx, dy]) => [x + dx, y + dy];

function viewpoint(b, draw) {
  const { spec, variable, node, move, braid, action } = b;
  variable('cameraReady', 'camera-position-ready', 0);
  variable('seen', 'fresh-observation', 0);
  variable('assignment', 'subject-assignment', 0, { hidden: true });
  const path = braid(0, 5);
  const shifted = node();
  move(path.end, shifted, { updates: [set('cameraReady', 1)], dependency: 'viewpoint-route' });
  const r = draw(4), delta = [7 + draw(5), -9 - draw(5)];
  const target = [2, 3], anchors = [[0, 0], [3, 0], [0, 4]];
  const real = offset(rotate(target, r), delta);
  const decoy = offset(rotate([target[0] + 2, target[1] - 1], r), delta);
  const assigned = draw(2);
  spec.initial[0].assignment = assigned;
  spec.view = {
    revealedWhen: eq('seen', 1), assignment: 'assignment',
    targetBefore: target, anchorsBefore: anchors,
    anchorsAfter: anchors.map(p => offset(rotate(p, r), delta)),
    subjectsAfter: assigned ? [decoy, real] : [real, decoy],
  };
  action('observe', all(eq('traveler', shifted), eq('cameraReady', 1)), [set('seen', 1), set('done', 1)], {
    events: [{ kind: 'observation', subject: 'requested-subject', variable: 'seen' },
      { kind: 'access', subject: 'requested-subject', dependency: 'viewpoint-route' }],
  });
  spec.structure = { mechanism: 'viewpoint', path: path.lengths };
}

function contactOrder(b, draw) {
  const { spec, variable, node, action, move, braid, finish } = b;
  variable('contact', 'contact-state', 0);
  variable('opening', 'latched-opening', 0);
  variable('jammed', 'order-revocation', 0);
  const ingress = braid(0, 2), threshold = node();
  move(ingress.end, threshold, { dependency: 'contact-approach' });
  action('contact', all(eq('traveler', threshold), eq('jammed', 0)), [set('contact', 1)], {
    events: [{ kind: 'support', dependency: 'contact-confirmed' }],
  });
  action('interact', eq('traveler', threshold), [], { branches: [
    { when: all(eq('contact', 1), eq('jammed', 0)), updates: [set('opening', 1)] },
    { when: eq('contact', 0), updates: [set('jammed', 1)] },
  ] });
  const beyond = node();
  move(threshold, beyond, { guard: eq('opening', 1), dependency: 'opening' });
  const after = braid(beyond, 3);
  finish(after.end, { dependency: 'opening' });
  spec.structure = { mechanism: 'contact-order', ingress: ingress.lengths, after: after.lengths };
}

function heldSupport(b, draw) {
  const { spec, variable, node, action, move, chain, braid, finish } = b;
  variable('helper', 'position', -1);
  variable('selected', 'selection', 0);
  variable('released', 'support-revocation', 0);
  const plate = node(), helperStart = node();
  spec.initial[0].helper = helperStart;
  const helperLength = 1 + draw(3);
  action('select', yes(), [set('selected', 1)]);
  action('select', yes(), [set('selected', 0)]);
  chain(helperStart, plate, helperLength, { actor: 'helper', selected: 1 });
  const requiresPlate = eq('helper', plate);
  const before = braid(0, 2, { selected: 0 });
  const exit = node();
  move(before.end, exit, { selected: 0, guard: requiresPlate, dependency: 'held-support' });
  const relay = draw(2) === 1;
  let tail;
  if (relay) {
    variable('relay', 'position', -2);
    const relayStart = node(), relayPlate = node(), finalPlate = node();
    spec.initial[0].relay = relayStart;
    action('select', yes(), [set('selected', 2)]);
    // The third mobile can take over only while the first support still opens its approach.
    chain(relayStart, relayPlate, 1 + draw(3), { actor: 'relay', selected: 2,
      guard: all(requiresPlate, eq('traveler', exit)) });
    const relayRelease = node();
    move(relayPlate, relayRelease, { actor: 'relay', selected: 2, dependency: 'release-relay-support',
      events: [{ kind: 'invalidation', segment: 'relay-support' }] });
    move(relayRelease, relayPlate, { actor: 'relay', selected: 2, dependency: 'restore-relay-support' });
    chain(plate, finalPlate, 1 + draw(3), { actor: 'helper', selected: 1,
      guard: all(eq('relay', relayPlate), eq('traveler', exit)), dependency: 'relay-support' });
    tail = braid(exit, 2, { selected: 0, guard: eq('relay', relayPlate) });
    finish(tail.end, { selected: 0, guard: all(eq('helper', finalPlate), eq('relay', relayPlate)), dependency: 'relay-support' });
  } else {
    tail = braid(exit, 2, { selected: 0, guard: requiresPlate });
    finish(tail.end, { selected: 0, guard: requiresPlate, dependency: 'held-support' });
  }
  const releaseAt = node();
  move(plate, releaseAt, { actor: 'helper', selected: 1,
    updates: [set('released', 1)], dependency: 'release-revokes-access',
    events: [{ kind: 'invalidation', segment: 'held-support' }] });
  move(releaseAt, plate, { actor: 'helper', selected: 1,
    updates: [set('released', 0)], dependency: 'restore-held-support' });
  spec.structure = { mechanism: 'held-support', before: before.lengths, tail: tail.lengths, helperLength, relay };
}

function temporary(b, draw) {
  const { spec, variable, node, action, move, chain, braid, finish } = b;
  variable('window', 'temporary-opening', 0, { timer: true });
  variable('sample', 'retrieved-subject', 0);
  const before = braid(0, 3);
  const outward = 1 + draw(4), returning = 1 + draw(4), margin = 1 + draw(3);
  const trigger = before.end, destination = node(), back = node();
  const window = outward + returning + margin + 2;
  action('interact', eq('traveler', trigger), [set('window', window)]);
  chain(trigger, destination, outward, { guard: min('window', 1), throughout: min('window', 1), dependency: 'window' });
  action('observe', eq('traveler', destination), [set('sample', 1)], {
    events: [{ kind: 'observation', subject: 'requested-subject', variable: 'sample' }],
  });
  chain(destination, back, returning, { guard: min('window', 1), throughout: min('window', 1), dependency: 'window' });
  const after = braid(back, 1);
  finish(after.end, { guard: eq('sample', 1), dependency: 'window' });
  // A costlier exit is real but can run out of time before crossing.
  chain(destination, back, returning + margin + 2, { guard: min('window', 1), throughout: min('window', 1), dependency: 'window' });
  spec.structure = { mechanism: 'temporary-opening', before: before.lengths, after: after.lengths, outward, returning, margin };
}

function construct(b, draw) {
  const { spec, variable, node, action, move, braid, finish } = b;
  variable('routeMade', 'constructed-support', 0);
  // One necessary unit: an unused surplus must not inflate the structural quota.
  variable('material', 'construction-resource', 1);
  const before = braid(0, 2), pit = node(), opposite = node();
  const method = draw(3);
  if (method === 0) {
    // A persistent support is constructed over a gap.
    action('build', all(eq('traveler', before.end), min('material', 1)),
      [add('material', -1), set('routeMade', 1)], {
      events: [{ kind: 'support', dependency: 'constructed-support' }],
    });
    move(before.end, opposite, { guard: eq('routeMade', 1), dependency: 'constructed-support' });
  } else if (method === 1) {
    // Pushing an obstacle to a recess preserves material but changes occupancy.
    const recess = node();
    variable('obstacle', 'position', opposite);
    action('interact', all(eq('traveler', before.end), eq('obstacle', opposite)),
      [set('obstacle', recess), set('routeMade', 1)], {
        events: [{ kind: 'crossing', actor: 'obstacle', from: opposite, to: recess, dependency: 'displaced-obstacle' }],
      });
    move(before.end, opposite, { guard: eq('obstacle', recess), dependency: 'displaced-obstacle' });
  } else {
    // A paid passage grants exactly one crossing and revokes it on consumption.
    action('interact', all(eq('traveler', before.end), min('material', 1)),
      [add('material', -1), set('routeMade', 1)]);
    move(before.end, opposite, { guard: eq('routeMade', 1), updates: [set('routeMade', 0)],
      dependency: 'consumable-opening', events: [{ kind: 'invalidation', segment: 'consumed-opening' }] });
  }
  // This construction succeeds physically but seals its builder in a pit.
  action('build', all(eq('traveler', before.end), min('material', 1)),
    [add('material', -1), set('traveler', pit), set('routeMade', 1)], {
      events: [{ kind: 'crossing', actor: 'traveler', from: before.end, to: pit, dependency: 'trapping-construction' }],
    });
  const after = braid(opposite, 3);
  finish(after.end, { dependency: method === 1 ? 'displaced-obstacle' : method === 2 ? 'consumable-opening' : 'constructed-support' });
  spec.structure = { mechanism: 'construct', before: before.lengths, after: after.lengths, method };
}

function uncertain(b, draw) {
  const { spec, variable, node, action, move, chain, braid } = b;
  variable('where', 'hidden-location', 0, { hidden: true, visibleWhen: eq('located', 1) });
  variable('located', 'location-measurement', 0);
  const common = draw(2) === 1;
  const prefix = common ? braid(0, 2) : { end: 0, lengths: [] };
  // When common=false, the first physical route choice is irreversible; observe at origin first.
  const observeAt = common ? prefix.end : 0;
  action('observe', eq('traveler', observeAt), [set('located', 1)], {
    events: [{ kind: 'observation', subject: 'location-cue', variable: 'located' }],
  });
  const branchLengths = [];
  for (let hypothesis = 0; hypothesis < 2; hypothesis++) {
    const entry = node(), destination = node();
    move(prefix.end, entry, { dependency: 'route-proof' });
    const leg = braid(entry, 2);
    const length = 1 + draw(3);
    chain(leg.end, destination, length);
    action('contact', all(eq('traveler', destination), eq('where', hypothesis)), [set('done', 1)], {
      events: [{ kind: 'access', subject: 'requested-subject', dependency: 'route-proof' }],
    });
    branchLengths.push({ braid: leg.lengths, length });
  }
  spec.initial = [copy(spec.initial[0]), { ...spec.initial[0], where: 1 }];
  spec.structure = { mechanism: 'uncertainty', common, prefix: prefix.lengths, branches: branchLengths };
}

function recovery(b, draw) {
  const { spec, variable, node, action, move, braid, finish } = b;
  variable('change', 'hidden-disturbance', 0, { hidden: true, visibleWhen: eq('feedbackKnown', 1) });
  variable('feedbackKnown', 'contrary-return', 0);
  variable('oldSupport', 'previous-support', 1);
  variable('newSupport', 'replacement-support', 0);
  variable('rejoined', 'recovery-route-validation', 0);
  const mode = draw(3);
  if (mode === 0) variable('targetAt', 'target-location', 0);
  const prefix = braid(0, 2), pivot = node();
  move(prefix.end, pivot, { updates: mode === 1 ? [] : [set('feedbackKnown', 1)], dependency: 'preserved-prefix',
    branches: mode === 1 ? [] : [
      { when: eq('change', 1), updates: [set(mode === 0 ? 'targetAt' : 'oldSupport', mode === 0 ? 1 : 0)],
        events: [{ kind: 'invalidation', segment: mode === 0 ? 'old-target-location' : 'old-support' }] },
    ] });
  const old = node(), alternative = node(), sharedEntry = node();
  if (mode === 1) {
    // The same issued movement has two possible public returns. The blocked return
    // invalidates only the old edge; the already played prefix remains intact.
    action('move', eq('traveler', pivot), [set('feedbackKnown', 1)], { branches: [
      { when: eq('change', 0), updates: [set('traveler', old)],
        events: [{ kind: 'crossing', actor: 'traveler', from: pivot, to: old, dependency: 'old-route' }] },
      { when: eq('change', 1), updates: [set('oldSupport', 0)],
        events: [{ kind: 'invalidation', segment: 'contradicted-edge' }] },
    ] });
  } else {
    move(pivot, old, { guard: mode === 0 ? yes() : eq('oldSupport', 1), dependency: mode === 0 ? 'old-route' : 'old-support' });
  }
  const oldTail = braid(old, 2);
  move(oldTail.end, sharedEntry, {
    guard: mode === 0 ? eq('targetAt', 0) : eq('change', 0), updates: [set('rejoined', 1)],
    dependency: mode === 2 ? 'old-support' : 'old-route',
  });
  if (mode === 2) {
    action('build', all(eq('traveler', pivot), eq('change', 1)), [set('newSupport', 1)], {
      events: [{ kind: 'support', dependency: 'replacement-support' }],
    });
    move(pivot, alternative, { guard: eq('newSupport', 1), dependency: 'replacement-support' });
  } else {
    move(pivot, alternative, { guard: all(eq('change', 1), eq('feedbackKnown', 1)), dependency: 'revised-route-proof' });
  }
  const newTail = braid(alternative, 2);
  move(newTail.end, sharedEntry, {
    guard: mode === 0 ? eq('targetAt', 1) : eq('change', 1), updates: [set('rejoined', 1)],
    dependency: mode === 2 ? 'replacement-support' : 'revised-route-proof',
  });
  // Both repairs rejoin the same previously available suffix. Its edges and guards
  // are untouched by the disturbance and must actually be traversed afterwards.
  const retained = braid(sharedEntry, 1 + draw(2), { guard: eq('rejoined', 1), dependency: 'retained-route' });
  finish(retained.end, { guard: eq('rejoined', 1), dependency: 'retained-route' });
  spec.initial = [copy(spec.initial[0]), { ...spec.initial[0], change: 1 }];
  spec.structure = { mechanism: 'recovery', mode: ['target-moved', 'contrary-return', 'support-lost'][mode],
    prefix: prefix.lengths, oldTail: oldTail.lengths, newTail: newTail.lengths, retained: retained.lengths };
}

const buildFamily = { 'F1-detour': detour, 'F2-viewpoint': viewpoint, 'F3-contact-order': contactOrder,
  'F4-held-support': heldSupport, 'F5-temporary-opening': temporary, 'F6-construct-route': construct,
  'F7-uncertain-location': uncertain, 'F8-recovery': recovery };

function attachAblations(spec) {
  const actionsByDependency = new Map();
  for (const action of spec.actions) {
    const events = [...(action.events ?? []), ...(action.branches ?? []).flatMap(branch => branch.events ?? [])];
    for (const event of events) {
      if (!event.dependency || event.kind !== 'crossing') continue;
      const list = actionsByDependency.get(event.dependency) ?? [];
      if (!list.includes(action.id)) list.push(action.id);
      actionsByDependency.set(event.dependency, list);
    }
  }
  const releasePosition = dependency => spec.actions.flatMap(a => a.events ?? [])
    .find(event => event.kind === 'crossing' && event.dependency === dependency)?.to;
  const removal = {
    // A support is released onto an actual adjacent position with a return edge.
    // The ablation changes only the occupied support, never exiles the mobile.
    'held-support': { kind: 'support', updates: [set('helper', releasePosition('release-revokes-access'))] },
    'relay-support': { kind: 'support', updates: [set('relay', releasePosition('release-relay-support'))] },
    'opening': { kind: 'opening', updates: [set('opening', 0)] },
    'window': { kind: 'opening', updates: [set('window', 0)] },
    'constructed-support': { kind: 'support', updates: [set('routeMade', 0)] },
    'displaced-obstacle': { kind: 'support', updates: [set('obstacle', spec.initial[0].obstacle)] },
    'consumable-opening': { kind: 'opening', updates: [set('routeMade', 0)] },
    'old-support': { kind: 'support', updates: [set('oldSupport', 0)] },
    'replacement-support': { kind: 'support', updates: [set('newSupport', 0)] },
  };
  spec.ablations = [...actionsByDependency].map(([dependency, actions]) => ({
    dependency, ...(removal[dependency] ?? { kind: 'route-proof' }), actions,
  }));
}

export function generateScenario(family, draw, { seed = 0, index = 0 } = {}) {
  if (!buildFamily[family]) throw new Error(`Unknown P07 family ${family}`);
  const b = builder(family, draw, seed, index);
  buildFamily[family](b, draw);
  // Publicly modelled safety/parent-resource shortcut: parent access must not consume its return charge.
  // It is a real edge in the route graph and leaves subsequent mechanics unchanged.
  const shortcut = b.shortcutCandidates[0];
  if (shortcut) {
    b.move(shortcut.from, shortcut.to, { ...shortcut.options,
      guard: all(shortcut.options.guard, min('reserve', 2)), updates: [add('reserve', -2)], dependency: 'return-resource' });
  }
  attachAblations(b.spec);
  return b.spec;
}

/** Mulberry32 with an integer bounded draw; deterministic on every supported Node platform. */
export function seededDraw(seed) {
  let word = seed >>> 0;
  return limit => {
    word = (word + 0x6d2b79f5) | 0;
    let value = Math.imul(word ^ word >>> 15, 1 | word);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) % limit;
  };
}

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

/**
 * Invariant coloured-graph fingerprint. IDs are graph references, never labels.
 * WL collisions conservatively reject an extra candidate; they cannot inflate the quota.
 * Rendering, identifiers, presentation names, action order, family, seed, and
 * explicitly supplied structure are excluded. Fixed semantic role categories remain.
 */
export function structuralSignature(spec) {
  const labels = [], edges = [], variables = new Map(), values = new Map();
  const vertex = label => { labels.push(label); return labels.length - 1; };
  const link = (a, b, relation) => edges.push([a, b, relation]);
  const root = vertex('scenario');
  for (const v of spec.variables) {
    const id = vertex(`variable:${v.role}:${!!v.hidden}:${!!v.timer}`);
    variables.set(v.id, id); link(root, id, 'variable');
  }
  const byId = new Map(spec.variables.map(v => [v.id, v]));
  function value(variable, number) {
    const key = `${variable}\u0000${number}`;
    if (!values.has(key)) {
      const role = byId.get(variable)?.role;
      const topological = role === 'position' || role === 'selection' || role === 'hidden-location' || role === 'hidden-disturbance' || role === 'subject-assignment';
      const id = vertex(topological ? 'value:nominal' : `value:${number}`);
      values.set(key, id); link(variables.get(variable), id, 'value-of');
    }
    return values.get(key);
  }
  function predicate(p) {
    if ('all' in p || 'any' in p) {
      const op = 'all' in p ? 'all' : 'any';
      const id = vertex('predicate:' + op);
      for (const child of p[op]) link(id, predicate(child), 'operand');
      return id;
    }
    if ('not' in p) { const id = vertex('predicate:not'); link(id, predicate(p.not), 'operand'); return id; }
    const op = 'eq' in p ? 'eq' : 'min' in p ? 'min' : 'max';
    const id = vertex('predicate:' + op);
    link(id, variables.get(p.variable), 'variable'); link(id, value(p.variable, p[op]), 'value');
    return id;
  }
  function updates(parent, list) {
    for (const u of list) {
      const op = 'set' in u ? 'set' : 'add';
      const id = vertex('update:' + op); link(parent, id, 'effect');
      link(id, variables.get(u.variable), 'variable');
      if (op === 'set') link(id, value(u.variable, u.set), 'value');
      else link(id, vertex(`delta:${u.add}`), 'value');
    }
  }
  function events(parent, list = []) {
    for (const e of list) {
      if (e.kind === 'official-win') continue;
      // Runtime evidence labels are arbitrary; semantic event kinds and endpoints are retained.
      const id = vertex('event:' + e.kind); link(parent, id, 'event');
      if (e.kind === 'crossing') {
        link(id, variables.get(e.actor), 'actor');
        link(id, value(e.actor, e.from), 'from'); link(id, value(e.actor, e.to), 'to');
      } else if (e.kind === 'observation') link(id, variables.get(e.variable), 'observed');
    }
  }
  for (const a of spec.actions) {
    const id = vertex('action:' + a.kind); link(root, id, 'action');
    link(id, predicate(a.requires), 'requires');
    if (a.throughout) link(id, predicate(a.throughout), 'throughout');
    updates(id, a.updates); events(id, a.events);
    for (const b of a.branches ?? []) {
      const branch = vertex('conditional'); link(id, branch, 'branch');
      link(branch, predicate(b.when), 'when'); updates(branch, b.updates); events(branch, b.events);
    }
  }
  for (const state of spec.initial) {
    const id = vertex('initial-world'); link(root, id, 'initial');
    for (const [v, n] of Object.entries(state)) link(id, value(v, n), 'initial-value');
  }
  for (const v of spec.variables) if (v.visibleWhen) link(variables.get(v.id), predicate(v.visibleWhen), 'visible-when');
  for (const key of ['goal', 'invariant', 'parentInvariant']) link(root, predicate(spec[key]), key);
  if (spec.view) {
    const id = vertex(`view:rigid-calibration:${spec.view.subjectsAfter.length}-subjects:${spec.view.anchorsBefore.length}-anchors`); link(root, id, 'view');
    link(id, predicate(spec.view.revealedWhen), 'visible-when');
    link(id, variables.get(spec.view.assignment), 'assignment');
  }
  const outgoing = Array.from({ length: labels.length }, () => []), incoming = Array.from({ length: labels.length }, () => []);
  for (const [a, b, relation] of edges) {
    if (a === undefined || b === undefined) throw new Error('Malformed structural graph');
    outgoing[a].push([b, relation]); incoming[b].push([a, relation]);
  }
  let colors = labels.map(label => createHash('sha256').update(label).digest('hex'));
  // Fixed round count is invariant even if the graph has symmetric classes.
  for (let iteration = 0; iteration < 12; iteration++) {
    colors = labels.map((label, i) => createHash('sha256').update(stable([
      label, colors[i],
      outgoing[i].map(([j, relation]) => [relation, colors[j]]).sort(),
      incoming[i].map(([j, relation]) => [relation, colors[j]]).sort(),
    ])).digest('hex'));
  }
  return createHash('sha256').update(stable({
    vertices: colors.slice().sort(),
    edges: edges.map(([a, b, relation]) => [colors[a], relation, colors[b]]).sort(),
    commands: spec.budget.commands,
  })).digest('hex');
}

/** Presentation invariants are probes, never new development cases. */
export function transformScenario(spec, variant = 1) {
  const out = copy(spec);
  const r = ((variant % 4) + 4) % 4;
  const delta = [13 * variant, -7 * variant];
  out.presentation = { rotation: r, offset: delta, palette: [11, 8, 5, 2].map(v => (v + variant) % 16) };
  out.id += `-invariant-${variant}`;
  const names = new Map(out.actions.map((a, i) => [a.id, `command-${variant}-${out.actions.length - i}`]));
  out.actions = out.actions.map(a => ({ ...a, id: names.get(a.id) })).reverse();
  for (const ablation of out.ablations ?? []) if (ablation.actions) ablation.actions = ablation.actions.map(id => names.get(id));
  if (out.view) {
    for (const key of ['anchorsBefore', 'anchorsAfter', 'subjectsAfter']) out.view[key] = out.view[key].map(p => offset(rotate(p, r), delta));
    out.view.targetBefore = offset(rotate(out.view.targetBefore, r), delta);
  }
  return out;
}
