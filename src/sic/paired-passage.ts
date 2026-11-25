import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeExecution, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { searchCoverageRoute } from './coverage-route.ts';
import { composePlan } from './effect-composer.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';

export const pairedPassageId = 'sic_paired_passage';
export const learnPairedPassageId = 'sic_follow_paired_passages_after_motion';

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
type Direction = typeof directions[number];
type Part = ReturnType<typeof geometricComponents>[number];
type Frame = { box: NativeBox; point: NativePoint; color: number; area: number };
type Pair = { key: string; frames: [Frame, Frame] };
type Switches = { sites: NativePoint[]; badge: NativeBox; statusInk: number; visitedInk: number };
type Scene = { actor: Part; goal: Frame; pairs: Pair[]; floor: Record<string, NativePoint>; pitch: number; flags: Part[];
  ground: number; neutral?: true; unpaired?: Frame[]; outlets?: Record<string, Direction>; switches?: Switches };
type OutletWitness = { ink: number; at: string; ref: string };
type RewriteMemory = { sites: NativePoint[]; visited: string[]; tests: string[] };
type Memory = { epoch: number; evidence: string[]; traversed: string[]; rejected: string[]; goal: Frame; outlets?: OutletWitness[];
  rewrite?: RewriteMemory };
type KnownPassage = { side: number; actorPaint: number; ground: number; completed: number; ref: string;
  outlet?: { ink: number; refs: string[] }; visitedInk?: number };
type Crossing = { pair: Pair; from: Frame; to: Frame };
type Step = { direction: Direction; point: NativePoint; crossing?: Crossing };
type Route = { steps: Step[]; target: Pick<Frame, 'box' | 'point'>; crossing?: Crossing; switchTest?: NativePoint };
type Proposal = NativeProposal & { scene: Scene; memory: Memory; route: Route; needId: string; attempt: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const origin = ([x, y]: NativeBox): NativePoint => [x, y];
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => key(a) === key(b);
const square = (p: Part) => width(p.bbox) === height(p.bbox);
const solid = (p: Part) => square(p) && p.area === width(p.bbox) ** 2;
const commonAxis = (a: NativePoint, b: NativePoint) => a[0] === b[0] || a[1] === b[1];
const framePattern = (rows: NativeRows, [l, t, r, b]: NativeBox) => rows.slice(t + 1, b).flatMap(row => row.slice(l + 1, r)).join(',');

function readOutlet(rows: NativeRows, frame: Frame) {
  const [l, t, r, b] = frame.box;
  const marks: { ink: number; direction: Direction }[] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const vertical = y === t || y === b, horizontal = x === l || x === r;
    if (!vertical && !horizontal || rows[y]?.[x] === frame.color) continue;
    const ink = rows[y]?.[x];
    if (vertical && horizontal || ink === undefined) return null;
    const direction = y === t ? directions[0] : y === b ? directions[1] : x === l ? directions[2] : directions[3];
    marks.push({ ink, direction });
  }
  return marks.length === 1 ? marks[0]! : null;
}

function frameFor(part: Part, interiorSide: number): Frame | null {
  const size = interiorSide + 2;
  if (width(part.bbox) !== size || height(part.bbox) !== size || part.area < size * 3 - 2 || part.area > size * 4 - 4
    || part.mask.some(([x, y]) => x > 0 && x < size - 1 && y > 0 && y < size - 1)) return null;
  const [x, y] = origin(part.bbox);
  return { box: part.bbox, point: [x + 1, y + 1], color: part.color, area: part.area };
}

function measure(rows: NativeRows, priorGoal: Frame | null, parts = geometricComponents(rows)): Scene | null {
  const result: Scene[] = [];
  for (const actor of parts.filter(p => solid(p) && width(p.bbox) >= 2 && width(p.bbox) <= 4)) {
    const side = width(actor.bbox), pitch = side + 2, point = origin(actor.bbox);
    const aligned = ([x, y]: NativePoint) => (x - point[0]) % pitch === 0 && (y - point[1]) % pitch === 0;
    const allFrames = parts.flatMap(p => { const frame = frameFor(p, side); return frame ? [frame] : []; });
    const frames = allFrames.filter(p => aligned(p.point));
    const marked = frames.filter(p => rows[p.point[1]]?.[p.point[0]] === actor.color);
    const groups = new Map<string, Frame[]>();
    for (const frame of marked) {
      const signature = frame.color + ':' + frame.area;
      groups.set(signature, [...groups.get(signature) ?? [], frame]);
    }
    const pairs: Pair[] = [];
    for (const group of groups.values()) {
      if (group.length !== 2) continue;
      const [a, b] = group as [Frame, Frame];
      if (commonAxis(a.point, b.point) && Math.abs(a.point[0] - b.point[0]) + Math.abs(a.point[1] - b.point[1]) >= pitch * 2) {
        pairs.push({ key: [key(a.point), key(b.point)].sort().join('/'), frames: [a, b] });
      }
    }
    const entrances = pairs.flatMap(p => p.frames);
    if (!pairs.length || pairs.length > 8 || entrances.length !== marked.length) continue;
    const floors = parts.filter(p => solid(p) && width(p.bbox) === pitch - 1 && aligned(origin(p.bbox)));
    const colors = [...new Set(floors.map(p => p.color))].filter(color => floors.filter(p => p.color === color).length >= 8);
    if (colors.length !== 1) continue;
    const ground = colors[0]!;
    const goals = frames.filter(p => !entrances.includes(p) && (priorGoal
      ? same(p.point, priorGoal.point) : rows[p.point[1]]?.[p.point[0]] === ground));
    if (goals.length !== 1) continue;
    const goal = goals[0]!;
    const flags = allFrames.filter(p => !aligned(p.point)).map(frame => parts.find(p => p.bbox === frame.box)!);
    const tiles = [point, goal.point, ...floors.filter(p => p.color === ground).map(p => origin(p.bbox))];
    result.push({ actor, goal, pairs, floor: Object.fromEntries(tiles.map(p => [key(p), p])), pitch, flags, ground });
    if (result.length > 1) return null;
  }
  return result[0] ?? null;
}

function patternedPassages(rows: NativeRows, parts: Part[], known: KnownPassage, priorGoal?: Frame): Scene | null {
  const { side, actorPaint } = known;
  const actors = parts.filter(part => part.color === actorPaint && width(part.bbox) === side && solid(part));
  if (actors.length !== 1 && !known.outlet) return null;
  const scenes = actors.flatMap(actor => {
    const scene = patternedPassageScene(rows, parts, known, actor, priorGoal);
    return scene ? [scene] : [];
  });
  return scenes.length === 1 ? scenes[0]! : null;
}

function patternedPassageScene(rows: NativeRows, parts: Part[], known: KnownPassage, actor: Part, priorGoal?: Frame): Scene | null {
  const { side, ground } = known, pitch = side + 2;
  const [ax, ay] = origin(actor.bbox);
  const onGrid = ([x, y]: NativePoint) => (x - ax) % pitch === 0 && (y - ay) % pitch === 0;
  const pattern = (box: NativeBox) => framePattern(rows, box);
  const allFrames = parts.flatMap(part => {
    const frame = frameFor(part, side);
    return frame ? [{ part, frame }] : [];
  });
  const indicators = allFrames.filter(({ frame }) => !onGrid(frame.point) && frame.box[1] > ay
    && frame.box[1] >= rows.length - pitch * 2 && (known.outlet || new Set(pattern(frame.box).split(',')).size > 1));
  if (indicators.length < 4 || indicators.length > 16 || indicators.some(({ frame }) => frame.box[1] !== indicators[0]!.frame.box[1])) return null;
  const flags = indicators.map(({ part }) => part);
  const zoneBottom = indicators[0]!.frame.box[1];
  const groups = new Map<string, { indicators: number; openings: Frame[] }>();
  for (const { frame } of indicators) {
    const mark = pattern(frame.box);
    const group = groups.get(mark) ?? { indicators: 0, openings: [] };
    group.indicators++;
    groups.set(mark, group);
  }
  if ([...groups.values()].some(group => group.indicators > 2 || (group.indicators === 1 && !known.outlet))) return null;
  for (let y = (ay + pitch - 1) % pitch; y + pitch <= zoneBottom; y += pitch) {
    for (let x = (ax + pitch - 1) % pitch; x + pitch <= rows[0]!.length; x += pitch) {
      // The controlled piece can obscure a switch and make its interior resemble an opening.
      if (x + 1 === ax && y + 1 === ay) continue;
      const box: NativeBox = [x, y, x + pitch - 1, y + pitch - 1];
      const group = groups.get(pattern(box));
      if (!group) continue;
      const paint = rows[y]![x]!;
      const measures = rows.slice(y, y + pitch).flatMap((row, j) => row.slice(x, x + pitch)
        .filter((_, i) => i === 0 || i === pitch - 1 || j === 0 || j === pitch - 1));
      const area = measures.filter(value => value === paint).length;
      if (area >= 3 * pitch - 2) group.openings.push({ box, point: [x + 1, y + 1], color: paint, area });
    }
  }
  const pairs: Pair[] = [];
  const unpaired: Frame[] = [];
  for (const { indicators: count, openings } of groups.values()) {
    if (openings.length !== count) return null;
    const [a, b] = openings as [Frame, Frame?];
    if (!b) {
      unpaired.push(a);
      continue;
    }
    pairs.push({ key: [key(a.point), key(b.point)].sort().join('/'), frames: [a, b] });
  }
  if (!pairs.length) return null;
  const openings = [...pairs.flatMap(pair => pair.frames), ...unpaired];
  const entrances = new Set(openings.map(frame => key(frame.point)));
  const goals = allFrames.map(({ frame }) => frame).filter(frame => onGrid(frame.point) && frame.box[3] < zoneBottom
    && !entrances.has(key(frame.point)) && (priorGoal ? same(frame.point, priorGoal.point) : rows[frame.point[1]]?.[frame.point[0]] === ground));
  if (goals.length !== 1) return null;
  const goal = goals[0]!;
  const tiles = parts.filter(part => part.color === ground && width(part.bbox) === pitch - 1 && solid(part)
    && onGrid(origin(part.bbox))).map(part => origin(part.bbox));
  if (tiles.length < 8) return null;
  tiles.push([ax, ay], goal.point);
  const outlets: Record<string, Direction> = {};
  if (known.outlet) {
    for (const frame of openings) {
      const outlet = readOutlet(rows, frame);
      if (outlet?.ink !== known.outlet.ink) return null;
      outlets[key(frame.point)] = outlet.direction;
    }
  }
  return { actor, goal, pitch, pairs, flags, ground, neutral: true,
    ...(unpaired.length ? { unpaired } : {}),
    ...(known.outlet ? { outlets } : {}), floor: Object.fromEntries(tiles.map(point => [key(point), point])) };
}

function shift(point: NativePoint, [, dx, dy]: Direction, pitch: number): NativePoint {
  return [point[0] + dx * pitch, point[1] + dy * pitch];
}

function switchFootprint([x, y]: NativePoint, pitch: number): NativeBox {
  return [x - 1, y - 1, x + pitch - 2, y + pitch - 2];
}

function readSwitches(rows: NativeRows, parts: Part[], scene: Scene, visitedInk: number | undefined, remembered: NativePoint[] = []): Switches | null {
  if (!scene.outlets || !scene.flags.length || visitedInk === undefined) return null;
  const { pitch, pairs, goal } = scene, at = origin(scene.actor.bbox);
  const bottom = Math.min(...scene.flags.map(flag => flag.bbox[1]));
  const blocked = new Set([...pairs.flatMap(pair => pair.frames.map(frame => key(frame.point))),
    ...(scene.unpaired ?? []).map(frame => key(frame.point)), key(goal.point)]);
  const badges = parts.filter(part => part.rectangular && part.bbox[1] >= bottom && width(part.bbox) > pitch
    && height(part.bbox) < pitch && width(part.bbox) <= 3 * pitch);
  const candidates = badges.flatMap(badge => {
    const sites: NativePoint[] = [];
    for (let y = (at[1] + pitch - 1) % pitch; y + pitch <= bottom; y += pitch) {
      for (let x = (at[0] + pitch - 1) % pitch; x + pitch <= rows[0]!.length; x += pitch) {
        const point: NativePoint = [x + 1, y + 1];
        if (blocked.has(key(point)) || rows[y]![x] !== badge.color) continue;
        const internal = new Set<number>();
        let unlike = 0;
        for (let j = 0; j < pitch; j++) for (let i = 0; i < pitch; i++) {
          const ink = rows[y + j]![x + i]!;
          if (i === 0 || j === 0 || i === pitch - 1 || j === pitch - 1) unlike += Number(ink !== badge.color);
          else internal.add(ink);
        }
        const occupied = same(at, point) && remembered.some(site => same(site, point));
        if ((occupied && unlike <= 1) || (unlike === 0 && internal.size > 1 && !internal.has(badge.color))) sites.push(point);
      }
    }
    return sites.length && remembered.every(point => sites.some(site => same(site, point)))
      ? [{ badge: badge.bbox, statusInk: badge.color, visitedInk, sites }] : [];
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

const topology = (pairs: Pair[]) => pairs.map(pair => pair.key).sort().join(';');
const switchTestKey = (scene: Scene, visits: string[], point: NativePoint) =>
  JSON.stringify([topology(scene.pairs), scene.switches!.statusInk, [...visits].sort(), point]);

function planSwitchRoute(scene: Scene, memory: Memory, switches: Switches, rewrite: RewriteMemory, inputs: readonly string[]): Route | null {
  const start = origin(scene.actor.bbox), endpoints = scene.pairs.flatMap(pair => pair.frames).sort((a, b) => key(a.point).localeCompare(key(b.point)));
  const bits = new Map(endpoints.map((endpoint, index) => [key(endpoint.point), 1 << index]));
  const visited = rewrite.visited.reduce((mask, point) => mask | (bits.get(point) ?? 0), 0);
  const switchesByPoint = new Set(switches.sites.map(key));
  const entrances = new Map(scene.pairs.flatMap(pair => pair.frames.map((from, j) =>
    [key(from.point), { pair, from, to: pair.frames[1 - j]! }] as const)));
  const walk = function* (at: NativePoint, through?: NativePoint) {
    for (const direction of directions) {
      if (!inputs.includes(direction[0]) || memory.rejected.includes(key(at) + '/' + direction[0])) continue;
      const entry = shift(at, direction, scene.pitch), crossing = entrances.get(key(entry));
      const outlet = crossing && scene.outlets?.[key(crossing.to.point)];
      const point = crossing ? shift(crossing.to.point, outlet ?? direction, scene.pitch) : entry, id = key(point);
      if (switchesByPoint.has(id) ? !through || !same(point, through) : !scene.floor[id]) continue;
      if (through && same(point, scene.goal.point)) continue;
      const coverage = crossing ? bits.get(key(crossing.from.point))! | bits.get(key(crossing.to.point))! : 0;
      yield { point, visits: through ? 0 : coverage, step: { direction, point, ...(crossing ? { crossing } : {}) } };
    }
  };
  const steps = scene.unpaired?.length ? null
    : searchCoverageRoute<Step>(start, scene.goal.point, visited, (1 << endpoints.length) - 1, at => walk(at));
  if (steps) {
    const crossing = steps.find(step => step.crossing?.pair.frames.some(frame => !rewrite.visited.includes(key(frame.point))))?.crossing;
    return { steps, target: crossing?.from ?? scene.goal, ...(crossing ? { crossing } : {}) };
  }
  const trials = switches.sites.flatMap(point => {
    if (rewrite.tests.includes(switchTestKey(scene, rewrite.visited, point))) return [];
    const route = searchCoverageRoute<Step>(start, point, 0, 0, at => walk(at, point));
    return route ? [{ point, route }] : [];
  }).sort((a, b) => a.route.length - b.route.length);
  const choice = trials[0];
  if (!choice) return null;
  const crossing = choice.route.find(step => step.crossing)?.crossing;
  const target = { point: choice.point, box: switchFootprint(choice.point, scene.pitch) };
  return { steps: choice.route, target, switchTest: choice.point, ...(crossing ? { crossing } : {}) };
}

/** Search positions together with the pairs already visited. A return through a
 * proven passage can be useful even when it leaves the indicators unchanged. */
function coverPassages(scene: Scene, memory: Memory, inputs: readonly string[]): Route | null {
  const start = origin(scene.actor.bbox), all = (1 << scene.pairs.length) - 1;
  const visited = scene.pairs.reduce((bits, pair, i) => bits | (memory.traversed.includes(pair.key) ? 1 << i : 0), 0);
  const entrances = new Map(scene.pairs.flatMap((pair, i) => pair.frames.map((from, j) =>
    [key(from.point), { pair, from, to: pair.frames[1 - j]!, bit: 1 << i }] as const)));
  const steps = searchCoverageRoute<Step>(start, scene.goal.point, visited, all, function* (at) {
    for (const direction of directions) {
      if (!inputs.includes(direction[0]) || memory.rejected.includes(key(at) + '/' + direction[0])) continue;
      const next = shift(at, direction, scene.pitch), crossing = entrances.get(key(next));
      const outlet = crossing && scene.outlets?.[key(crossing.to.point)];
      const point = crossing ? shift(crossing.to.point, outlet || direction, scene.pitch) : next;
      if (scene.floor[key(point)]) yield { point, visits: crossing?.bit ?? 0, step: { direction, point, ...(crossing ? { crossing } : {}) } };
    }
  });
  if (!steps) return null;
  const pending = steps.find(step => step.crossing && !memory.traversed.includes(step.crossing.pair.key))?.crossing;
  return { steps, target: pending?.from ?? scene.goal, ...(pending ? { crossing: pending } : {}) };
}

function plan(scene: Scene, memory: Memory, inputs: readonly string[]): Route | null {
  type State = { point: NativePoint; target?: Frame; crossing?: Crossing };
  const start = origin(scene.actor.bbox);
  const unfinished = scene.pairs.filter(pair => !memory.traversed.includes(pair.key));
  const crossings = scene.pairs.flatMap(pair => pair.frames.map((from, i) => ({ pair, from, to: pair.frames[1 - i]! })));
  const landings = Object.keys(scene.floor).length + 2;
  const result = composePlan<State, Step>({
    domain: 'paired-passage', initial: { point: start },
    key: state => state.target ? 'target' : key(state.point),
    goal: { relation: 'reach an unverified passage or the fully covered exit', holds: state => !!state.target },
    budget: { commands: landings, states: landings },
    *choices(before) {
      for (const direction of directions) {
        const entry = shift(before.point, direction, scene.pitch);
        const crossing = crossings.find(pair => same(pair.from.point, entry));
        const point = crossing ? shift(crossing.to.point, direction, scene.pitch) : entry;
        const touchesExit = !crossing && same(scene.goal.point, entry);
        const target = crossing && unfinished.includes(crossing.pair) ? crossing.from : touchesExit ? scene.goal : undefined;
        yield { action: { direction, point, ...(crossing ? { crossing } : {}) },
          after: { point, target, ...(target && crossing ? { crossing } : {}) }, evidence: memory.evidence,
          requires: [{ relation: 'available movement with no refused contact', holds: state =>
            inputs.includes(direction[0]) && !memory.rejected.includes(key(state.point) + '/' + direction[0]) }],
          ensures: [{ relation: 'safe landing or exit after remaining passages', holds: state =>
            touchesExit ? !unfinished.length : !!scene.floor[key(state.point)] }] };
      }
    },
  });
  if (!result?.end.target) return null;
  return { steps: result.effects.map(effect => effect.action), target: result.end.target,
    ...(result.end.crossing ? { crossing: result.end.crossing } : {}) };
}

function actorAt(rows: NativeRows, actor: Part, point: NativePoint): boolean {
  const side = width(actor.bbox);
  return geometricComponents(rows).some(p => p.color === actor.color && p.area === side ** 2 && same(origin(p.bbox), point)
    && width(p.bbox) === side && height(p.bbox) === side);
}

function observedStep(proposal: Proposal, index: number, first: NativeRows, second: NativeRows) {
  const step = proposal.route.steps[index]!, crossing = step.crossing;
  const moved = actorAt(second, proposal.scene.actor, step.point);
  const changed = crossing ? proposal.scene.flags.filter(({ bbox: [x, y] }) => first[y]?.[x] !== second[y]?.[x]) : [];
  if (proposal.memory.rewrite && proposal.scene.switches) {
    const { rewrite } = proposal.memory, { switches, pairs } = proposal.scene;
    const expected = crossing?.pair.frames.filter(frame => !rewrite.visited.includes(key(frame.point))).length ?? 0;
    const pattern = crossing && framePattern(first, crossing.from.box);
    const matched = changed.length === expected && changed.every(flag => framePattern(first, flag.bbox) === pattern
      && second[flag.bbox[1]]![flag.bbox[0]] === switches.visitedInk);
    const [badgeX, badgeY] = switches.badge;
    const altered = switches.sites.some(site => same(site, step.point)) && first[badgeY]![badgeX] !== second[badgeY]![badgeX];
    const groups = new Map<string, string[]>();
    if (altered) for (const frame of [...pairs.flatMap(pair => pair.frames), ...(proposal.scene.unpaired ?? [])]) {
      const mark = framePattern(second, frame.box);
      groups.set(mark, [...(groups.get(mark) ?? []), key(frame.point)]);
    }
    const links = [...groups.values()];
    const rewired = links.length > 0 && links.every(link => link.length <= 2)
      && links.filter(link => link.length === 2).map(link => link.sort().join('/')).sort().join(';') !== topology(pairs);
    return { moved: moved && matched, markers: matched && expected > 0, rewired, altered };
  }
  if (!proposal.scene.neutral || !crossing) return { moved, markers: changed.length > 0 };
  const repeated = proposal.memory.traversed.includes(crossing.pair.key);
  const intended = framePattern(first, crossing.from.box);
  const matched = repeated ? changed.length === 0 : changed.length === 2 && changed.every(flag => framePattern(first, flag.bbox) === intended);
  return { moved: moved && matched, markers: matched && !repeated };
}

function acquireMotion(rows: NativeRows, ref: string, epoch: number, execution: NativeExecution | undefined): Memory | null {
  const receipt = execution?.readPriorDirectionalScene?.(first => measure(first, null));
  if (!receipt || receipt.afterRef !== ref || receipt.levelEpoch !== epoch) return null;
  const direction = directions.find(([input]) => input === receipt.command);
  if (!direction) return null;
  const { actor, goal, pitch, pairs } = receipt.scene, start = origin(actor.bbox);
  const entry = shift(start, direction, pitch);
  const pair = pairs.find(candidate => candidate.frames.some(frame => same(frame.point, entry)));
  const exit = pair?.frames.find(frame => !same(frame.point, entry));
  const expected = exit ? shift(exit.point, direction, pitch) : entry;
  if (!actorAt(rows, actor, expected) || actorAt(rows, actor, start)) return null;
  return { epoch, goal, traversed: pair ? [pair.key] : [], rejected: [], evidence: [receipt.beforeRef, ref] };
}

export function createSicPairedPassage(family = pairedPassageId, transferObservedPassage = false): NativeFamily<Proposal> {
  const learns = family === learnPairedPassageId;
  let local: Memory | null = null;
  let previous: KnownPassage | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      if (learns && !transferObservedPassage || previous?.completed !== observation.levels_completed || !previous.outlet) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal?.scene.outlets ? proposal : null;
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !directions.every(([ref]) => observation.available_action_refs.includes(ref))
        || observation.available_action_refs.includes('ACTION6')) return null;
      const ref = observation.observation_ref;
      const prior = local?.epoch === observation.level_epoch ? local
        : learns ? acquireMotion(rows, ref, observation.level_epoch, execution) : null;
      const known = previous?.completed === observation.levels_completed ? previous : null;
      if (learns && !prior && !(transferObservedPassage && known)) return null;
      const parts = geometricComponents(rows);
      const scene = measure(rows, prior?.goal ?? null, parts) ?? (known ? patternedPassages(rows, parts, known, prior?.goal) : null);
      if (!scene) return null;
      const switches = readSwitches(rows, parts, scene, known?.visitedInk, prior?.rewrite?.sites);
      if (scene.unpaired?.length && !switches) return null;
      if (prior?.rewrite && !switches) return null;
      if (switches) scene.switches = switches;
      const base = prior ?? { epoch: observation.level_epoch, evidence: known && (scene.neutral || (transferObservedPassage && scene.actor.color === known.actorPaint && scene.ground === known.ground)) ? [known.ref, ...(known.outlet?.refs ?? [])] : [],
        traversed: [], rejected: [], goal: scene.goal };
      const rewrite = base.rewrite ?? (switches ? { sites: switches.sites, visited: [], tests: [] } : null);
      const memory: Memory = rewrite ? { ...base, rewrite } : base;
      const route = switches && rewrite ? planSwitchRoute(scene, memory, switches, rewrite, observation.available_action_refs)
        : scene.neutral ? coverPassages(scene, memory, observation.available_action_refs)
        : plan(scene, memory, observation.available_action_refs);
      if (!route) return null;
      const step = route.steps[0]!, action = { action_ref: step.direction[0], data: {} };
      const crossing = step.crossing;
      const evidence: [string, ...string[]] = [ref, ...memory.evidence.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: action.action_ref, expected: step.point, evidence };
      const switchContact = !!route.switchTest && same(step.point, route.switchTest);
      const facts = { eligibleProbe: switchContact || !memory.evidence.length || !!crossing && !memory.traversed.length,
        routeSupported: !switchContact && memory.evidence.length > 0 && !crossing,
        knownInteraction: !switchContact && !!crossing && memory.traversed.length > 0, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const primitive = facts.routeSupported ? 'P07' : facts.knownInteraction ? 'P02' : 'P05';
      if (learns && decision?.result !== primitive) return null;
      const navigation = learns ? null : resolveNavigationPrimitives({
        mode, evidence, probe: facts.eligibleProbe ? offer : null,
        access: facts.routeSupported ? offer : null,
        interaction: facts.knownInteraction ? offer : null,
      });
      const strategy = learns ? primitive : navigation?.selected?.id;
      if (!strategy) return null;
      const parent = 'G_official_completion';
      const objective = { kind: route.switchTest ? 'test_passage_reconfiguration' : route.crossing ? 'verify_access_through_paired_passage' : 'reach_exit_after_verified_transfers',
        scope: ref.split(':revision:', 1)[0]!, subjects: [route.switchTest ? key(route.switchTest) : route.crossing?.pair.key ?? key(scene.goal.point)],
        parentObjective: parent, satisfactionContract: route.switchTest ? 'observe_passage_connections_after_contact'
          : route.crossing ? 'piece_at_paired_exit' : 'official_progress_at_framed_exit' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = pairedPassageId + ':' + need.id;
      const revisiting = crossing && scene.neutral && memory.traversed.includes(crossing.pair.key);
      const situation = route.switchTest ? 'Test the marked switch and compare the passage connections and visits'
        : rewrite ? crossing ? 'Follow the visible pairing and verify the endpoint indicators'
          : route.crossing ? 'Approach an endpoint whose visit is still unverified' : 'Reach the exit while preserving the current connections and confirmed visits'
        : revisiting ? 'Return through the verified opening to reach the remaining pair'
        : crossing ? (scene.outlets ? 'Enter the passage and check the landing on the marked side of its partner'
          : 'Verify that entering the opening transfers the piece to its paired landing')
        : route.crossing ? 'Approach a visible pair whose transfer is still unverified'
          : 'Reach the exit after observing a transfer through each pair';
      const [x, y] = step.point, last = width(scene.actor.bbox) - 1;
      const plain = facts.routeSupported && !scene.neutral && !switches;
      const routeStart = plain ? route.steps.findIndex(leg => leg.crossing) : 1;
      const path = route.steps.slice(0, Math.max(1, Math.min(routeStart < 0 ? route.steps.length : routeStart, remaining, maximumCommittedActions)));
      const actions = path.map(leg => ({ action_ref: leg.direction[0], data: {} }));
      return {
        status: 'proposed', kind: family, scene, route, memory, needId: need.id, attempt: key(origin(scene.actor.bbox)) + '/' + action.action_ref,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        steps: actions.map((action, index) => ({ action, expected_after: path[index]!.point })),
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: route.crossing ? 'Verify a paired passage' : 'Exit after using the passages',
          situation, evidence, agenda: navigation?.entries ?? [], mode, triggerCard: navigation?.card ?? decision?.receipt.workflow,
          actor: scene.actor.bbox, focus: crossing?.from.box ?? route.target.box,
          landing: [x, y, x + last, y + last], exit: crossing?.to.box ?? null, flags: scene.flags.map(p => p.bbox),
          ...(switches ? { routingState: switches.badge, switchSites: switches.sites.map(site => switchFootprint(site, scene.pitch)) } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, observation) {
      if (index > 0) {
        const { scene, route, memory } = proposal, previous = route.steps[index - 1]!.point;
        const current = measure(packet.frame_rows, memory.goal);
        const admitted = observation.level_epoch === memory.epoch && !!current && same(origin(current.actor.bbox), previous)
          && current.ground === scene.ground && current.pitch === scene.pitch && current.actor.color === scene.actor.color
          && current.pairs.map(pair => pair.key).join('/') === scene.pairs.map(pair => pair.key).join('/')
          && Object.keys(current.floor).length === Object.keys(scene.floor).length
          && Object.keys(current.floor).every(tile => !!scene.floor[tile])
          && !!current.floor[key(route.steps[index]!.point)];
        return { admitted, reason: admitted ? 'paired_passage_corridor_retained' : 'paired_passage_context_changed' };
      }
      const admitted = proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'paired_passage_step_bound' : 'paired_passage_context_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const step = proposal.route.steps[index]!, crossing = step.crossing;
      const { moved, markers, rewired } = observedStep(proposal, index, first, second);
      const reason = moved ? rewired ? 'passage_connections_rewritten_at_landing'
        : markers ? 'paired_landing_and_remote_markers_observed' : 'expected_position_observed'
        : proposal.scene.neutral && crossing ? 'expected_transfer_or_indicators_unconfirmed' : 'expected_position_missing';
      return { matched: moved, seal_prefix: !moved || index + 1 >= proposal.actions.length, reason,
        ...(moved && (rewired || !proposal.route.switchTest && crossing && crossing.pair.key === proposal.route.crossing?.pair.key)
        ? { sic_need: { id: proposal.needId, status: 'satisfied' as const } } : {}) };
    },
    record(before, after, action, first, second, proposal, index) {
      const { scene, route } = proposal;
      const memory = (index > 0 && local?.epoch === before.level_epoch ? local : null) ?? proposal.memory;
      const coverage = memory.rewrite ? scene.pairs.every(pair => pair.frames.every(frame => memory.rewrite!.visited.includes(key(frame.point))))
        : memory.traversed.length === scene.pairs.length;
      if (after.levels_completed > before.levels_completed && coverage) {
        const sightings = memory.outlets ?? [];
        const inks = new Set(sightings.map(sighting => sighting.ink));
        const outlet = sightings.length >= 2 && inks.size === 1
          ? { ink: sightings[0]!.ink, refs: sightings.map(sighting => sighting.ref) } : null;
        const visitedInks = new Set(scene.flags.map(flag => flag.color));
        previous = { side: width(scene.actor.bbox), actorPaint: scene.actor.color, ground: scene.ground,
          completed: after.levels_completed, ref: after.observation_ref, ...(outlet ? { outlet } : {}),
          ...(scene.neutral && visitedInks.size === 1 ? { visitedInk: scene.flags[0]!.color } : {}) };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const step = route.steps[index]!;
      const { moved, rewired, altered } = observedStep(proposal, index, first, second);
      const crossing = moved ? step.crossing : undefined;
      const at = crossing && key(crossing.to.point), observedOutlet = crossing && proposal.scene.neutral && readOutlet(first, crossing.to);
      const sightings = memory.outlets ?? [];
      const verified = crossing && observedOutlet && at && same(shift(crossing.to.point, observedOutlet.direction, proposal.scene.pitch), step.point);
      const outlets = verified && !sightings.some(witness => witness.at === at)
        ? [...sightings, { ink: observedOutlet.ink, at, ref: after.observation_ref }] : sightings;
      const rewrite = memory.rewrite;
      const contact = rewrite && route.switchTest && same(step.point, route.switchTest);
      const updated = rewrite ? { ...rewrite, visited: crossing ? [...new Set([...rewrite.visited, ...crossing.pair.frames.map(frame => key(frame.point))])] : rewrite.visited,
        tests: contact ? [...rewrite.tests, switchTestKey(scene, rewrite.visited, step.point)] : rewrite.tests } : null;
      local = { ...memory, evidence: moved ? [...memory.evidence.slice(-5), after.observation_ref] : memory.evidence,
        traversed: crossing && !memory.traversed.includes(crossing.pair.key) ? [...memory.traversed, crossing.pair.key] : memory.traversed,
        rejected: moved && altered ? [] : moved ? memory.rejected : [...memory.rejected,
          index === 0 ? proposal.attempt : key(route.steps[index - 1]!.point) + '/' + action.action_ref],
        ...(outlets.length ? { outlets } : {}),
        ...(updated ? { rewrite: updated } : {}) };
      return { events: [], ...(moved && rewired
        ? { reviewEvidence: 'The switch changed the partners of the same openings while retaining previously lit indicators.' } : {}) };
    },
    state: () => ({ local, previous }),
    restore(value: NativeRecord) {
      local = structuredClone(value.local as Memory | null);
      previous = structuredClone((value.previous as KnownPassage | undefined) ?? null);
    },
  };
}
