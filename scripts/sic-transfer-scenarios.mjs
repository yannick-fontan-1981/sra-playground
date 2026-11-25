import { measureArrivalTiming, planTimedArrival } from '../src/sic/shared-arrival-timing.ts';
import { nextCarriedStep, observeCarriedStep } from '../src/sic/carried-support-route.ts';

function clockedArrival({ period, control, contradiction, insufficient, translate, variant }) {
  const pitch = 3, x = 2 + Number(translate), y = 2 + Number(translate);
  const distance = insufficient ? 5 : 19 + variant;
  const far = distance + period - 1;
  const target = [x + pitch * distance, y];
  const gate = [x + pitch, y];
  const node = p => p.join(',');
  const nodes = new Set();
  for (let i = 0; i <= distance; i++) nodes.add(node([x + pitch * i, y]));
  for (let i = 1; i <= far; i++) nodes.add(node([target[0], y + pitch * i]));
  const scene = { grid: [pitch, x % pitch, y % pitch], actors: [[9, x, y], [10, target[0], y + pitch * far]],
    target, cells: new Map(), base: nodes, candidates: [], background: new Set([0, 4]), floor: 0 };
  const network = { gates: [], pads: new Map(), clocks: new Map([[node(gate), { point: gate, mark: '0/6' }]]), nodes };
  const tracks = [];
  const frames = Array.from({ length: far + 1 }, (_, tick) => {
    const rows = Array.from({ length: y + pitch * far + 2 }, () => Array(target[0] + 2).fill(0));
    const open = tick === 0 ? Boolean(control) : (tick % period === 0) !== Boolean(contradiction && tick === 10);
    const patch = open ? [[0, 6, 0], [0, 12, 0], [0, 6, 0]] : [[6, 4, 6], [6, 6, 6], [6, 4, 6]];
    for (let row = 0; row < 3; row++) rows[y + row - 1].splice(gate[0] - 1, 3, ...patch[row]);
    const first = [x + pitch * Math.max(0, tick - (period - 1)), y];
    const second = [target[0], y + pitch * (far - tick)];
    tracks.push([first, second]);
    const actor = ([cx, cy], ink) => {
      rows[cy][cx] = 0;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) rows[cy + dy][cx + dx] = ink;
    };
    if (tick < far) actor(second, 10);
    actor(first, 9);
    return rows;
  });
  const result = measureArrivalTiming(scene, network, frames);
  const plan = result && planTimedArrival(scene, network, result, 1);
  const terminal = tracks[plan?.ticks[0]];
  const verified = Boolean(plan && plan.edits.length === 0 && terminal?.every(point => node(point) === node(target)));
  return { verified, abstained: plan == null, evidence: result ? {
    period: result.clocks[node(gate)].length, prefix: result.clockPrefixes?.[node(gate)] ?? [],
    launch: plan?.ticks ?? [], cycleProof: result.clockEvidence?.[node(gate)] ?? null,
  } : null };
}

function switchedSupport({ period, control, contradiction, insufficient, translate }) {
  const actorY = translate ? 5 : 3;
  const bridgeInk = translate ? 8 : 11;
  const cycle = Array.from({ length: period }, (_, phase) => phase === (period === 2 ? 0 : 1) ? bridgeInk : 0);
  const state = {
    layout: {
      field: [0, 0, 13, 9], voids: [0], actorInk: 3, targetInk: 2, pitch: 2,
      toolInk: 5, handleInk: 7, handleArea: 4, railInk: 6, mouth: { axis: 0, high: true },
      supportMask: [[0, 0], [0, 1], [1, 0], [1, 1]], supportSize: [2, 2], priorControlInks: [],
      buttons: [], latch: [14, 3, 15, 4], switches: [{ ink: 9, box: [14, 0, 15, 1] }],
    },
    grip: 'held', graph: {}, vectors: {}, gripTests: [], rail: [], stableActor: true, acquiredControl: true,
    gateTests: [], switchEffects: [], blocked: [], portals: [], usedPortals: [], markerTests: [],
  };
  const scene = (actorX, ink) => {
    const rows = Array.from({ length: 10 }, () => Array(16).fill(0));
    const toolY = actorY === 3 ? 6 : 1;
    for (let y = toolY; y < toolY + 4; y++) rows[y].fill(5, 5, 9);
    rows[toolY + 3][8] = 0;
    rows[toolY + 1].fill(7, 10, 12);
    rows[toolY + 2].fill(7, 10, 12);
    for (let y = actorY; y < actorY + 2; y++) {
      rows[y].fill(ink, 3, 7);
      rows[y].fill(2, 7, 9);
      rows[y].fill(3, actorX, actorX + 2);
    }
    return rows;
  };
  const paint = index => index === 0 ? (control ? cycle.at(-1) : 6)
    : contradiction && index === period + 1 ? 6 : cycle[(index - 1) % period];
  let ix = 0, actor = 1, rows = scene(actor, paint(ix)), observed = state;
  let stopped = false;
  const executed = [];
  const calibrationLimit = insufficient ? period : period * 3;
  for (let effort = 0; effort < calibrationLimit + 8; effort++) {
    const move = nextCarriedStep(observed, rows, 30);
    if (!move || (move.kind === 'switch' && move.measureCycle && ix >= calibrationLimit)) break;
    if (move.kind === 'switch') {
      ix++;
      if (!move.measureCycle) executed.push('operate');
    } else if (move.kind === 'walk') {
      const [nextX, nextY] = move.expectedActor;
      if (nextY !== actorY || ![3, 5, 7].includes(nextX) || (nextX !== 7 && paint(ix) !== bridgeInk)) {
        stopped = true;
        break;
      }
      actor = nextX;
      executed.push('walk');
    } else break;
    const after = scene(actor, paint(ix));
    const accepted = observeCarriedStep(observed, move, rows, after, 'cycle-pilot');
    if (!accepted) {
      stopped = true;
      break;
    }
    observed = accepted;
    rows = after;
    if (actor === 7) break;
  }
  return { verified: actor === 7 && !stopped, abstained: executed.length === 0 && !stopped,
    evidence: { period: observed.switchCycles?.[0]?.period ?? null, calibration: ix, executed,
      cycleProof: observed.switchCycles?.[0]?.transientEvidence ?? null } };
}

export const strategies = {
  'clocked-arrival': clockedArrival,
  'switched-support': switchedSupport,
};

export function casesForCycle(cycle) {
  // Following cycles alternate period, position and ink rather than replaying one training board.
  const translate = Math.floor((cycle - 1) / 2) % 2 === 0;
  const variant = Math.floor((cycle - 1) / 4) % 4;
  const arrivalPeriod = cycle % 2 === 1 ? 3 : 4;
  const supportPeriod = cycle % 2 === 1 ? 2 : 3;
  return Object.keys(strategies).flatMap(strategy => {
    const period = strategy === 'clocked-arrival' ? arrivalPeriod : supportPeriod;
    const crossPeriod = strategy === 'clocked-arrival' ? (period === 3 ? 4 : 3) : (period === 2 ? 3 : 2);
    return [
      { id: 'new-mechanic', expected: 'verified', baselineExpected: 'abstained', period, translate },
      { id: 'crossed-period-and-position', expected: 'verified', baselineExpected: 'abstained', period: crossPeriod, translate: !translate },
      { id: 'stationary-control', expected: 'verified', baselineExpected: 'verified', period, translate, control: true },
      { id: 'contradicted-cycle', expected: 'abstained', baselineExpected: 'abstained', period, translate, contradiction: true },
      { id: 'insufficient-evidence', expected: 'abstained', baselineExpected: 'abstained', period, translate, insufficient: true },
    ].map(spec => ({ strategy, variant, ...spec }));
  });
}
