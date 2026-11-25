import { measureArrivalTiming, planTimedArrival } from '../src/sic/shared-arrival-timing.ts';
import { nextCarriedStep, observeCarriedStep } from '../src/sic/carried-support-route.ts';

function openAt(gate, tick, disturbance) {
  const { phases, prefix } = gate;
  const open = tick < prefix.length ? prefix[tick] : phases[(tick - prefix.length) % phases.length];
  return Boolean(open) !== (tick === disturbance);
}

function arrivalTrace(spec) {
  const trace = [0];
  const gates = new Map(spec.gates.map(gate => [gate.at, gate]));
  const delays = new Map(spec.delays.map(pad => [pad.at, pad.ticks]));
  let position = 0, dwell = 0;
  for (let tick = 1; position < spec.distance && tick <= 100; tick++) {
    const gate = gates.get(position + 1);
    if (dwell) dwell--;
    else if (!gate || openAt(gate, tick, gate === spec.gates[0] ? spec.disturbance : null)) {
      position++;
      dwell = delays.get(position) ?? 0;
    }
    trace.push(position);
  }
  if (position !== spec.distance) throw new Error('Generated race has no reachable target');
  return trace;
}

function clockedArrival(spec) {
  const trace = arrivalTrace(spec);
  // The unconstrained second path is the length of the first path with waits.
  const terminal = trace.length - 1;
  const end = spec.distance + terminal;
  const point = index => [2 + index * 3, 2];
  const key = p => p.join(',');
  const target = point(spec.distance);
  const nodes = new Set(Array.from({ length: end + 1 }, (_, index) => key(point(index))));
  const clocks = new Map(spec.gates.map((gate, index) => [key(point(gate.at)),
    { point: point(gate.at), mark: '0/' + (index === 0 ? 6 : 11) }]));
  const scene = { grid: [3, 2, 2], actors: [[9, ...point(0)], [10, ...point(end)]],
    target, cells: new Map(), base: nodes, candidates: [], background: new Set([0, 4]), floor: 0 };
  const network = { gates: [], pads: new Map(spec.delays.map(pad => [key(point(pad.at)), 'delay-' + pad.at])), clocks, nodes };

  const frames = trace.map((position, tick) => {
    const rows = Array.from({ length: 5 }, () => Array(point(end)[0] + 2).fill(0));
    spec.gates.forEach((gate, index) => {
      const ink = index === 0 ? 6 : 11;
      const open = openAt(gate, tick, index === 0 ? spec.disturbance : null);
      const patch = open ? [[0, ink, 0], [0, 12, 0], [0, ink, 0]]
        : [[ink, 4, ink], [ink, ink, ink], [ink, 4, ink]];
      for (let row = 0; row < 3; row++) rows[row + 1].splice(point(gate.at)[0] - 1, 3, ...patch[row]);
    });
    function drawActor(index, ink) {
      const [x, y] = point(index);
      rows[y][x] = 0;
      rows[y - 1][x] = ink;
      rows[y + 1][x] = ink;
      rows[y][x - 1] = ink;
      rows[y][x + 1] = ink;
    }
    if (tick < terminal) drawActor(end - tick, 10);
    drawActor(position, 9);
    return rows;
  });
  const timing = measureArrivalTiming(scene, network, frames);
  if (!timing) return { outcome: 'abstained', frontier: 'phase-measurement' };
  const plan = planTimedArrival(scene, network, timing, 1);
  const proof = Object.values(timing.clockEvidence ?? {});
  if (!plan) return { outcome: 'abstained', frontier: 'synchronization-plan', proof };
  const verified = plan.edits.length === 0 && plan.ticks.length === 1 && plan.ticks[0] === terminal;
  return { outcome: verified ? 'verified' : 'mismatch', frontier: verified ? 'terminal' : 'arrival-time',
    proof, terminal, predicted: plan.ticks };
}

const supportLayout = {
  field: [0, 0, 13, 9], voids: [0], actorInk: 3, targetInk: 2, pitch: 2,
  toolInk: 5, handleInk: 7, handleArea: 4, railInk: 6, mouth: { axis: 0, high: true },
  supportMask: [[0, 0], [0, 1], [1, 0], [1, 1]], supportSize: [2, 2], priorControlInks: [],
  buttons: [], latch: [14, 3, 15, 4], switches: [{ ink: 9, box: [14, 0, 15, 1] }],
};

function supportPainting(spec, index) {
  if (index === spec.disturbance) return { mask: (1 << spec.span) - 1, ink: 13 };
  if (index < spec.startup.length) return { mask: spec.startup[index], ink: 13 };
  return { mask: spec.phases[(index - spec.startup.length) % spec.phases.length], ink: 8 };
}

function supportRows(spec, actor, active) {
  const rows = Array.from({ length: 10 }, () => Array(16).fill(0));
  for (let y = 1; y < 5; y++) rows[y].fill(5, 5, 9);
  rows[4][8] = 0;
  rows[2].fill(7, 10, 12);
  rows[3].fill(7, 10, 12);
  for (const y of [5, 6]) {
    for (let cell = 0; cell < spec.span; cell++) {
      if (active.mask & (1 << cell)) rows[y].fill(active.ink, 3 + cell * 2, 5 + cell * 2);
    }
    rows[y].fill(1, 1, 3);
    rows[y].fill(2, 3 + 2 * spec.span, 5 + 2 * spec.span);
    rows[y].fill(3, actor, actor + 2);
  }
  return rows;
}

function switchedSupport(spec) {
  let state = {
    layout: supportLayout, grip: 'held', graph: {}, vectors: {}, gripTests: [], rail: [], stableActor: true, acquiredControl: true,
    gateTests: [], switchEffects: [], blocked: [], portals: [], usedPortals: [], markerTests: [],
  };
  const target = 3 + 2 * spec.span;
  const period = spec.phases.length;
  const probeCap = spec.intent === 'insufficient' ? spec.startup.length + period : spec.startup.length + 3 * period - 1;
  let count = 0, actor = 1, rejectedCommands = 0;
  let active = supportPainting(spec, count), rows = supportRows(spec, actor, active);
  for (let effort = 0; effort < probeCap + 15; effort++) {
    const move = nextCarriedStep(state, rows, 45 - effort);
    const cycle = state.switchCycles?.[0];
    if (!move || (move.kind === 'switch' && move.measureCycle && count >= probeCap)) {
      return { outcome: 'abstained', frontier: cycle?.period ? 'support-route' : 'phase-measurement', calibration: count };
    }
    if (move.kind === 'switch') {
      const next = supportPainting(spec, count + 1);
      const allowed = actor === 1 || (spec.controlAccess === 'supported' && (next.mask & (1 << ((actor - 3) / 2))));
      if (allowed) {
        count++;
        active = next;
      } else rejectedCommands++;
    } else if (move.kind === 'walk' && move.expectedActor[1] === 5) {
      const next = move.expectedActor[0];
      const cell = (next - 3) / 2;
      if (Math.abs(next - actor) !== 2 || next < 1 || next > target
        || (next !== 1 && next !== target && !(active.mask & (1 << cell)))) {
        return { outcome: 'mismatch', frontier: 'unsupported-footing', calibration: count };
      }
      actor = next;
    } else {
      return { outcome: 'mismatch', frontier: 'illegal-control', calibration: count };
    }
    const after = supportRows(spec, actor, active);
    const confirmed = observeCarriedStep(state, move, rows, after, 'generated-transfer');
    if (!confirmed) return { outcome: 'mismatch', frontier: 'return-contradiction', calibration: count };
    state = confirmed;
    rows = after;
    if (actor === target) {
      const proof = state.switchCycles?.[0]?.transientEvidence;
      return { outcome: 'verified', frontier: 'terminal', proof: proof ? [proof] : [], calibration: count, rejectedCommands };
    }
  }
  return { outcome: 'abstained', frontier: 'command-budget', calibration: count };
}

export const engines = { 'clocked-arrival': clockedArrival, 'switched-support': switchedSupport };
