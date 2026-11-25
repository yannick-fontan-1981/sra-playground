import { observePhaseStep, planPhasedSupport } from '../src/sic/phased-support-route.ts';
import { collectLightTiming, searchLightTiming } from '../src/sic/lit-route-timing.ts';

function phaseValue(spec, tick) {
  if (tick === spec.disturbance) return { mask: (1 << spec.span) - 1, transient: true };
  if (tick < spec.startup.length) return { mask: spec.startup[tick], transient: true };
  return { mask: spec.phases[(tick - spec.startup.length) % spec.phases.length], transient: false };
}

function relaySupports(spec) {
  const width = spec.span + 2, height = 3, target = width - 1, pitch = 2;
  const padPositions = [width * 2, width * 3 - 1];
  function inksAt(tick, cell = -1) {
    const { mask, transient } = phaseValue(spec, tick);
    const cells = Array(width * height).fill(5);
    cells[0] = 2;
    cells[target] = 2;
    for (let i = 0; i < spec.span; i++) {
      cells[i + 1] = mask & (1 << i) ? (transient ? 11 : 1) : (transient ? 5 : 10);
    }
    if (cell >= 0) cells[cell] = 14;
    return cells;
  }
  function rowsAt(tick, cell) {
    const flat = inksAt(tick, cell);
    const rows = Array.from({ length: height }, (_, y) => flat.slice(y * width, (y + 1) * width).flatMap(value => [value, value]))
      .flatMap(row => [row, row.slice()]);
    for (const pad of padPositions) {
      const x = (pad % width) * 2, y = Math.floor(pad / width) * 2;
      rows[y].splice(x, 2, 6, 7);
      rows[y + 1].splice(x, 2, 7, 6);
    }
    return rows;
  }
  const base = inksAt(0);
  for (const pad of padPositions) base[pad] = -1;
  let state = {
    terrain: { origin: [0, 0], width, height, pitch, base, voids: [5, 10] },
    controls: [[0, 6, 1, 7]], portal: [2, 6, 3, 7],
    pads: padPositions.map(cell => ({ cell, pixels: [6, 7, 7, 6] })),
    actorInk: 14, target, position: { cell: 0, phases: [0] }, cycles: [{ phases: [[]], closed: false }], route: [],
  };
  let tick = 0, cell = 0, blocked = 0;
  const probeCap = spec.startup.length + (spec.intent === 'insufficient' ? 1 : 3) * spec.phases.length - 1;
  for (let effort = 0; effort < probeCap + 13; effort++) {
    const step = planPhasedSupport(state, [3], probeCap + 13 - effort)[0];
    if (!step || ('control' in step && step.probing && tick >= probeCap)) {
      return { outcome: 'abstained', frontier: state.cycles[0].closed ? 'support-route' : 'phase-measurement', calibration: tick };
    }
    if ('control' in step) tick++;
    else if ('direction' in step && step.direction === 3) cell++;
    else return { outcome: 'mismatch', frontier: 'control-scope', calibration: tick };
    if (cell !== 0 && cell !== target && [5, 10].includes(inksAt(tick)[cell])) {
      blocked++;
      return { outcome: 'mismatch', frontier: 'unsupported-footing', calibration: tick, blocked };
    }
    const update = observePhaseStep(state, step, rowsAt(tick, cell), 40);
    if (!update) return { outcome: 'abstained', frontier: 'phase-measurement', calibration: tick };
    state = update;
    if (cell === target) {
      const evidence = state.cycles[0].evidence;
      return { outcome: 'verified', frontier: 'terminal', proof: evidence ? [evidence] : [], calibration: tick };
    }
  }
  return { outcome: 'abstained', frontier: 'command-budget', calibration: tick };
}

function traverseSpotlight(spec) {
  const width = spec.distance + 3, height = 7, pitch = 1, left = 2, y = 4;
  const goal = [spec.distance, y], points = Array.from({ length: goal[0] - left + 1 }, (_, index) => [left + index, y]);
  const view = { actor: [left, y], goal, light: 8, guardInk: 9, walls: 5 };
  const gates = Array.from({ length: spec.span }, (_, i) => spec.offset + i * 3);
  const waitTicks = spec.phases.length === 5 ? 2 : 5;
  function lit(tick, x) {
    const bit = gates.indexOf(x);
    return bit !== -1 && Boolean(phaseValue(spec, tick).mask & (1 << bit));
  }
  function rowsAt(tick) {
    const rows = Array.from({ length: height + 1 }, () => Array(width).fill(0));
    rows[1][1] = 5;
    const visibility = phaseValue(spec, tick);
    if (visibility.transient) rows[2][2] = 8;
    for (const x of gates) if (lit(tick, x)) rows[y][x] = 8;
    return rows;
  }
  function routes([from]) {
    return new Map(points.map(point => {
      const sign = Math.sign(point[0] - from);
      const route = Array.from({ length: Math.abs(point[0] - from) }, (_, index) => [from + sign * (index + 1), y]);
      return [point.join(','), { point, route }];
    }));
  }
  let timing = null, tick = 0;
  const span = spec.startup.length + (spec.intent === 'insufficient' ? spec.phases.length : 4 * spec.phases.length + 2);
  while (!timing?.period && tick + waitTicks < span) {
    const frames = Array.from({ length: waitTicks + 1 }, (_, index) => rowsAt(tick + index));
    frames.push(frames.at(-1));
    timing = collectLightTiming(timing, frames[0], frames.at(-1), frames, view, pitch);
    if (!timing) break;
    tick += waitTicks;
  }
  if (!timing?.period) return { outcome: 'abstained', frontier: 'phase-measurement', calibration: tick };
  for (let effort = 0; effort < 20; effort++) {
    const step = searchLightTiming(timing, view, pitch, width, height, routes, 20 - effort);
    if (!step) return { outcome: 'abstained', frontier: 'exposure-route', proof: timing.evidence ? [timing.evidence] : [] };
    const occupied = step.wait ? Array.from({ length: waitTicks }, () => view.actor) : step.route;
    for (const [x] of occupied) {
      if (lit(++tick, x)) return { outcome: 'mismatch', frontier: 'actual-exposure', tick };
      timing.elapsed++;
    }
    view.actor = step.point;
    if (view.actor[0] === goal[0]) {
      return { outcome: 'verified', frontier: 'terminal', proof: timing.evidence ? [timing.evidence] : [], tick };
    }
  }
  return { outcome: 'abstained', frontier: 'command-budget', tick };
}

export const additionalEngines = { 'relay-supports': relaySupports, 'timed-light-route': traverseSpotlight };
