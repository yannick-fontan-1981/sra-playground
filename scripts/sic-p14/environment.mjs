/** Evaluation-only P14 simulator. Never import this module from a decision policy. */
const clone = value => structuredClone(value);
const mod = (n, d) => ((n % d) + d) % d;

export function createEnvironment(spec, worldIndex = 0) {
  if (!spec.worlds[worldIndex]) throw new Error('Unknown P14 evaluation world');
  const world = clone(spec.worlds[worldIndex]);
  const channels = world.channels;
  const starts = Object.fromEntries(spec.public.channels.map(id => [id, channels[id].kind === 'clock' ? 0 : null]));
  const actions = new Map(spec.public.actions.map(action => [action.id, action]));
  const holds = {}, uses = Object.fromEntries(spec.public.actions.filter(a => a.uses !== undefined).map(a => [a.id, a.uses]));
  let tick = 0, position = spec.public.initial, terminal = null, commands = 0;

  function raw(id, at = tick) {
    const held = holds[id];
    if (held && at <= held.until) return held.value;
    const channel = channels[id], start = starts[id];
    if (start === null) return 0;
    const age = at - start;
    if (channel.kind === 'pulse') return Number(age >= channel.delay && age < channel.delay + channel.width);
    if (age < channel.prefix.length) return channel.prefix[age];
    return channel.cycle[mod(age - channel.prefix.length + channel.phase, channel.cycle.length)];
  }

  function frame(at, inspect, intermediate) {
    const values = {}, reliable = {};
    for (const id of spec.public.channels) {
      const channel = channels[id], age = starts[id] === null ? at : at - starts[id];
      const masked = !inspect && channel.mask?.[mod(age, channel.mask.length)] === 0;
      const noisy = !inspect && channel.noise?.[mod(age, channel.noise.length)] === 1;
      values[id] = masked ? null : noisy ? 1 - raw(id, at) : raw(id, at);
      reliable[id] = !masked && !noisy;
    }
    return { ref: `t:${at}:c:${commands}`, tick: at, values, reliable, intermediate };
  }

  function ready(action) {
    if (terminal || commands >= spec.budget.actions || tick + action.duration > spec.budget.ticks) return false;
    if (action.uses !== undefined && uses[action.id] <= 0) return false;
    if (action.from !== undefined && action.from !== position) return false;
    if (action.kind === 'trigger') return (action.targets ?? []).every(id => {
      const channel = channels[id], start = starts[id];
      return channel.kind === 'pulse' && (start === null || tick - start >= channel.delay + channel.width);
    });
    return true;
  }

  function publicObservation(frames, receipt) {
    return { tick, position, terminal, frames, receipt,
      enabled: spec.public.actions.filter(ready).map(a => a.id),
      holds: Object.fromEntries(Object.entries(holds).filter(([, hold]) => hold.until >= tick).map(([id, hold]) => [id, { ...hold }])),
      uses: { ...uses } };
  }
  let latest = publicObservation([frame(0, false, false)], null);

  function step(actionId) {
    const action = actions.get(actionId);
    if (!action || !ready(action)) {
      terminal = 'failed';
      latest = publicObservation([], { action: actionId, kind: action?.kind ?? 'invalid', start: tick, end: tick, interventions: [] });
      return clone(latest);
    }
    const start = tick, end = tick + action.duration;
    commands++;
    const interventions = [];
    if (action.uses !== undefined) uses[action.id]--;
    if (action.kind === 'trigger') for (const id of action.targets ?? []) { starts[id] = start; interventions.push(id); }
    if (action.kind === 'hold') for (const id of action.targets ?? []) {
      holds[id] = { until: start + action.holdTicks, value: raw(id, start) };
    }
    let unsafe = false;
    const frames = [];
    for (let at = start + 1; at <= end; at++) {
      tick = at;
      if (action.kind === 'move' && (action.gates ?? []).some(id => raw(id, at) !== 1)) unsafe = true;
      if (at === end && action.kind === 'move' && !unsafe) {
        position = action.to;
        for (const id of action.perturbs ?? []) {
          const replacement = world.replacements?.[action.id]?.[id];
          if (!replacement) throw new Error(`Missing declared intervention for ${action.id}/${id}`);
          channels[id] = clone(replacement);
          starts[id] = replacement.kind === 'clock' ? at : null;
          delete holds[id];
          interventions.push(id);
        }
      }
      frames.push(frame(at, action.kind === 'inspect', at !== end));
    }
    if (unsafe) terminal = 'failed';
    else if (position === spec.public.goal) terminal = 'crossed';
    else if (commands >= spec.budget.actions || tick >= spec.budget.ticks) terminal = 'failed';
    latest = publicObservation(frames, { action: actionId, kind: action.kind, start, end, interventions });
    return clone(latest);
  }

  return { observation: () => clone(latest), step };
}
