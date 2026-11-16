import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeEntity, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal,
  NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { findLinkedGoal } from './linked-midpoint.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const linkedGroupRouteId = 'sic_route_by_linked_groups';

type Scene = { readonly side: number; readonly mask: readonly NativePoint[]; readonly activeColor: number; readonly band: number;
  readonly selectorColors: readonly number[]; readonly barriers: readonly number[]; readonly patterned?: true };
type BodyPixel = readonly [x: number, y: number, ink: number];
type Group = { readonly color: number; readonly goal: NativePoint; readonly target: NativeBox; readonly marks: readonly NativePoint[];
  readonly bodyMask?: readonly NativePoint[]; readonly bodyPattern?: readonly BodyPixel[];
  readonly anchors: readonly NativePoint[]; readonly confirmedAt: string | null; readonly contactAt: string | null;
  readonly contactColor: number | null };
type Move = { readonly index: number; readonly point: NativePoint };
type Memory = { readonly epoch: number; readonly scene: Scene; readonly groups: readonly Group[]; readonly focus: number | null;
  readonly route: readonly Move[]; readonly denied: readonly string[]; readonly stopped: boolean };
type Proposal = NativeProposal & { readonly local: Memory; readonly index: number; readonly move: Move; readonly selecting: boolean;
  readonly prediction: NativePoint; readonly needId: string };

const same = (a: NativePoint | undefined, b: NativePoint) => !!a && a[0] === b[0] && a[1] === b[1];
const key = ([x, y]: NativePoint) => `${x},${y}`;
const span = (box: NativeBox, axis: 0 | 1) => box[axis + 2]! - box[axis]! + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const areaBox = ([x, y]: NativePoint, h: number): NativeBox => [x - h, y - h, x + h, y + h];
const square = (part: NativeEntity, side: number) => span(part.bbox, 0) === side && span(part.bbox, 1) === side;
const centroid = (points: readonly NativePoint[]): NativePoint => [
  Math.floor(points.reduce((sum, p) => sum + p[0], 0) / points.length),
  Math.floor(points.reduce((sum, p) => sum + p[1], 0) / points.length),
];
const moveAnchor = (points: readonly NativePoint[], move: Move) => points.map((point, i) => i === move.index ? move.point : point);
const deniedKey = (points: readonly NativePoint[], move: Move) => `${points.map(key).join(';')}|${move.index}|${key(move.point)}`;

function hasAnchor(rows: NativeRows, scene: Scene, [x, y]: NativePoint, colors: readonly number[]): boolean {
  const radius = (scene.side - 1) / 2;
  // Preserve the established anchor position when another sprite covers part of its outline.
  return colors.some(color => scene.mask.filter(([dx, dy]) => rows[y - radius + dy]?.[x - radius + dx] === color).length * 4 >= scene.mask.length * 3);
}

function body(observation: NativeObservation, side: number, color: number): NativePoint | undefined {
  const bodies = observation.entities.filter(part => part.palette_value === color && square(part, side) && part.area >= side * (side - 1));
  if (bodies.length === 1) return center(bodies[0]!.bbox);
  return undefined;
}

type GroupCandidate = Pick<Group, 'color' | 'bodyMask' | 'bodyPattern' | 'goal' | 'target' | 'marks'>
  & { subsets: (readonly NativePoint[])[] };
type PatternTarget = Pick<Group, 'goal' | 'target' | 'marks'> & { quarters: number[] };
const quarter = (x: number, y: number, cx: number, cy: number) => Number(x > cx) + 2 * Number(y > cy);

function patternTargets(entities: readonly NativeEntity[], radius: number): PatternTarget[] {
  const pins = new Map(entities.filter(part => part.area === 1).map(part => [key(center(part.bbox)), part.palette_value]));
  if (pins.size < 16 || pins.size > 192) return [];
  const points = entities.filter(part => part.area === 1).map(part => center(part.bbox));
  const targets = new Map<string, PatternTarget>();
  for (const [x, y] of points) for (const [u, v] of points) {
    if (x === u || y === v || (x + u) % 2 || (y + v) % 2 || Math.abs(x - u) > radius * 2 || Math.abs(y - v) > radius * 2) continue;
    const goal: NativePoint = [(x + u) / 2, (y + v) / 2], [cx, cy] = goal, id = key(goal);
    if (pins.has(id) || targets.has(id)) continue;
    const marks = points.filter(([a, b]) => a !== cx && b !== cy && Math.max(Math.abs(a - cx), Math.abs(b - cy)) <= radius
      && pins.has(key([2 * cx - a, b])) && pins.has(key([a, 2 * cy - b])) && pins.has(key([2 * cx - a, 2 * cy - b])));
    if (marks.length < 8 || !marks.some(([a]) => Math.abs(a - cx) === radius) || !marks.some(([, b]) => Math.abs(b - cy) === radius)) continue;
    const quadrants = Array.from({ length: 4 }, () => new Set<number>());
    for (const [a, b] of marks) quadrants[quarter(a, b, cx, cy)]!.add(pins.get(key([a, b]))!);
    if (quadrants.some(colors => colors.size !== 1)) continue;
    targets.set(id, { goal, target: areaBox(goal, radius), marks, quarters: quadrants.map(colors => [...colors][0]!) });
  }
  return [...targets.values()];
}

function patternedCandidates(entities: readonly NativeEntity[], rows: NativeRows, side: number, anchors: readonly NativePoint[]): GroupCandidate[] {
  const radius = (side - 1) / 2, targets = patternTargets(entities, radius + 1);
  const ground = entities.reduce((best, part) => part.area > best.area ? part : best).palette_value;
  const candidates = new Map<string, GroupCandidate | null>();
  for (let bits = 1; bits < 1 << anchors.length; bits++) {
    const subset = anchors.filter((_, i) => bits & 1 << i);
    if (subset.length < 2 || subset.length > 4) continue;
    const point = centroid(subset), [cx, cy] = point, id = key(point);
    const previous = candidates.get(id);
    if (previous) { previous.subsets.push(subset); continue; }
    if (candidates.has(id)) continue;
    candidates.set(id, null);
    const bodyPattern: BodyPixel[] = [];
    const quadrants = Array.from({ length: 4 }, () => new Set<number>());
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dy) === radius && Math.abs(dx) === radius) continue;
      const ink = rows[cy + dy]?.[cx + dx];
      if (ink === undefined || ink === ground) continue;
      bodyPattern.push([dx + radius, dy + radius, ink]);
      if (dx && dy) quadrants[quarter(dx, dy, 0, 0)]!.add(ink);
    }
    if (bodyPattern.length !== side ** 2 - 4 || quadrants.some(colors => colors.size !== 1)) continue;
    const quarters = quadrants.map(colors => [...colors][0]!);
    if (new Set(quarters).size < 2) continue;
    const matches = targets.filter(target => target.quarters.every((ink, i) => ink === quarters[i]));
    if (matches.length !== 1) continue;
    const { goal, target, marks } = matches[0]!;
    candidates.set(id, { goal, target, marks, bodyPattern, color: rows[cy]![cx]!, subsets: [subset] });
  }
  return [...candidates.values()].filter((candidate): candidate is GroupCandidate => candidate !== null);
}

function identify(observation: NativeObservation, rows: NativeRows, allowPattern: boolean): { scene: Scene; groups: readonly Group[] } | null {
  const { entities } = observation;
  const bands = entities.filter(part => span(part.bbox, 0) === 1 && span(part.bbox, 1) === rows.length && part.area === rows.length);
  if (bands.length !== 1) return null;
  const activeColor = bands[0]!.palette_value, width = rows[0]!.length, height = rows.length;
  const parts = entities.map(part => ({ ...part, color: part.palette_value }));
  for (const active of entities.filter(part => part.palette_value === activeColor)) {
    const side = span(active.bbox, 0);
    if (side < 3 || side > 7 || side % 2 === 0 || !square(active, side) || active.area !== 4 * (side - 2)) continue;
    const mask = JSON.stringify(active.mask);
    const selectors = entities.filter(part => square(part, side) && JSON.stringify(part.mask) === mask);
    if (selectors.length < 4 || selectors.length > 10 || selectors.filter(part => part.palette_value === activeColor).length !== 1) continue;
    const anchors = selectors.map(part => center(part.bbox));
    let candidates: GroupCandidate[] = parts.flatMap(part => {
      if (!square(part, side) || part.area < side * (side - 1)) return [];
      const goal = findLinkedGoal(parts, part);
      if (!goal) return [];
      const [left, top, right, bottom] = goal.box;
      const marks = parts.filter(item => item.color === part.color && item.area === 1 && item.bbox[0] >= left &&
        item.bbox[0] <= right && item.bbox[1] >= top && item.bbox[1] <= bottom).map(item => center(item.bbox));
      const point = center(part.bbox), subsets: (readonly NativePoint[])[] = [];
      for (let bits = 1; bits < 1 << anchors.length; bits++) {
        const subset = anchors.filter((_, i) => bits & 1 << i);
        if (subset.length >= 2 && subset.length <= 4 && same(centroid(subset), point)) subsets.push(subset);
      }
      return [{ color: part.color, bodyMask: part.mask, goal: goal.point, target: goal.box, marks, subsets }];
    });
    const patterned = candidates.length < 2 || candidates.length > 4 || new Set(candidates.map(group => group.color)).size !== candidates.length;
    if (patterned && allowPattern) candidates = patternedCandidates(entities, rows, side, anchors);
    if (candidates.length < 2 || candidates.length > 4 || patterned && !allowPattern
      || new Set(candidates.map(group => key(group.goal))).size !== candidates.length) continue;
    const partitions: Group[][] = [];
    const assign = (groups: Group[], used: ReadonlySet<NativePoint>) => {
      if (partitions.length > 1) return;
      if (groups.length === candidates.length) {
        if (used.size === anchors.length) partitions.push(groups);
        return;
      }
      const { color, bodyMask, bodyPattern, goal, target, marks, subsets } = candidates[groups.length]!;
      for (const subset of subsets) {
        if (subset.some(point => used.has(point))) continue;
        assign([...groups, { color, ...(bodyMask ? { bodyMask } : {}), ...(bodyPattern ? { bodyPattern } : {}),
          goal, target, marks, anchors: subset, confirmedAt: null, contactAt: null, contactColor: null }],
          new Set([...used, ...subset]));
      }
    };
    assign([], new Set());
    if (partitions.length !== 1) continue;
    const populations = new Map<number, number>();
    for (const part of parts) populations.set(part.color, (populations.get(part.color) ?? 0) + part.area);
    const barriers = [...populations].sort((a, b) => b[1] - a[1]).slice(1)
      .filter(([color, count]) => count >= Math.min(width, height) * 2 && color !== activeColor &&
        !selectors.some(part => part.palette_value === color)
        && !candidates.some(group => group.color === color || group.bodyPattern?.some(([, , ink]) => ink === color)))
      .map(([color]) => color);
    const selectorColors = [...new Set(selectors.map(part => part.palette_value))];
    return { scene: { side, mask: active.mask, activeColor, band: bands[0]!.bbox[0], selectorColors, barriers, ...(patterned ? { patterned: true } : {}) },
      groups: partitions[0]!.sort((a, b) => a.anchors.length - b.anchors.length) };
  }
  return null;
}

function matchesScene(observation: NativeObservation, rows: NativeRows, local: Memory, points: readonly NativePoint[],
  focus: number, target?: NativePoint, touching = false) {
  const { scene } = local, radius = (scene.side - 1) / 2, width = rows[0]!.length;
  const projected = local.groups.map((group, index) => ({ group, anchors: index === focus ? points : group.anchors }));
  const covered = new Set<number>();
  for (const { group, anchors } of projected) {
    const center = centroid(anchors);
    if (!group.bodyMask?.length && !group.bodyPattern?.length) {
      if (!same(body(observation, scene.side, group.color), center)) return false;
      continue;
    }
    const [x, y] = center;
    const pattern = group.bodyPattern ?? group.bodyMask!.map(([dx, dy]) => [dx, dy, group.color] as const);
    for (const [dx, dy, ink] of pattern) {
      const col = x - radius + dx, row = y - radius + dy;
      if (rows[row]?.[col] !== ink) return false;
      covered.add(row * width + col);
    }
  }
  const visibleAnchor = ([x, y]: NativePoint, colors: readonly number[], active = false) => {
    const left = x - radius, top = y - radius;
    const exposed = scene.mask.filter(([dx, dy]) => !covered.has((top + dy) * width + left + dx));
    if (active && exposed.length * 2 < scene.mask.length) return false;
    if (!exposed.length) return true;
    // Adjacent lines can cover a pixel of an already tracked anchor. Verify the rest against the observed paint.
    const required = Math.min(Math.ceil(exposed.length * 3 / 4), Math.max(1, exposed.length - 1));
    return colors.some(color => exposed.filter(([dx, dy]) => rows[top + dy]?.[left + dx] === color).length >= required);
  };
  if (target && !touching && !visibleAnchor(target, [scene.activeColor], true)) return false;
  return projected.every(({ group, anchors }, index) => {
    if (group.contactColor !== null) return group.marks.every(([x, y]) => rows[y]?.[x] === group.contactColor);
    // Contact recolors the target and may redraw a control that overlaps it.
    return (index === focus && touching) || anchors.every(point => visibleAnchor(point, scene.selectorColors));
  });
}

function verifyMove(proposal: Proposal, observation: NativeObservation, first: NativeRows, second: NativeRows) {
  const { local, index, move, selecting, prediction } = proposal;
  const group = local.groups[index]!;
  const points = selecting ? group.anchors : moveAnchor(group.anchors, move);
  const touching = !selecting && same(prediction, group.goal);
  const geometry = matchesScene(observation, second, local, points, index, points[move.index], touching);
  if (!touching) return { points, matched: geometry, contactColor: null };
  const [x, y] = group.marks[0]!;
  const color = second[y]?.[x];
  const contact = geometry && color !== undefined && group.marks.every(([mx, my]) => second[my]?.[mx] === color) &&
    group.marks.some(([mx, my]) => first[my]?.[mx] !== color);
  return { points, matched: contact, contactColor: contact ? color : null };
}

function planRoute(rows: NativeRows, local: Memory, groupIndex: number, active: NativePoint | undefined): readonly Move[] {
  const group = local.groups[groupIndex]!;
  const { barriers, side, band } = local.scene, radius = (side - 1) / 2, width = rows[0]!.length, height = rows.length;
  const startX = band === 0 ? radius + 1 : radius;
  const protectedPoints = local.groups.flatMap((item, i) => {
    if (i === groupIndex) return [];
    return item.contactAt ? [centroid(item.anchors)] : [...item.anchors, centroid(item.anchors)];
  });
  const avoid = new Set(barriers);
  const safe = new Uint8Array(width * height);
  for (let y = radius; y < height - radius; y++) for (let x = startX; x < width - radius; x++) {
    if (Math.abs(x - band) <= radius) continue;
    let admissible = true;
    for (let row = y - radius; row <= y + radius && admissible; row++) {
      for (let col = x - radius; col <= x + radius; col++) {
        if (avoid.has(rows[row]![col]!)) { admissible = false; break; }
      }
    }
    if (admissible) safe[y * width + x] = 1;
  }
  const valid = ([x, y]: NativePoint) => x >= 0 && x < width && y >= 0 && y < height && safe[y * width + x] === 1;
  if (!valid(group.goal)) return [];
  const overlaps = ([x, y]: NativePoint, [a, b]: NativePoint) => Math.max(Math.abs(x - a), Math.abs(y - b)) <= 2 * radius;
  const trajectory = ([x, y]: NativePoint, [a, b]: NativePoint) => {
    const length = Math.max(Math.abs(a - x), Math.abs(b - y), 1);
    for (let i = 0; i <= length; i++) {
      if (!valid([Math.round(x + (a - x) * i / length), Math.round(y + (b - y) * i / length)])) return false;
    }
    return true;
  };
  const distance = new Int32Array(width * height).fill(-1);
  const fringe = [group.goal];
  distance[group.goal[1] * width + group.goal[0]] = 0;
  for (let i = 0; i < fringe.length; i++) {
    const [x, y] = fringe[i]!, depth = distance[y * width + x]!;
    for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (!valid([a, b]) || distance[b * width + a] !== -1) continue;
      distance[b * width + a] = depth + 1;
      fringe.push([a, b]);
    }
  }
  const grid: NativePoint[] = [];
  const stride = Math.max(side - 1, Math.ceil(Math.sqrt(width * height / 280)));
  for (let y = radius; y < height - radius; y += stride) {
    for (let x = startX; x < width - radius; x += stride) if (valid([x, y])) grid.push([x, y]);
  }
  const denied = new Set(local.denied);
  const stateKey = (anchors: readonly NativePoint[], activeIndex: number) => anchors.map(key).join('/') + '|' + activeIndex;
  type Node = { anchors: readonly NativePoint[]; active: number; steps: readonly Move[]; cost: number; distance: number };
  const activeIndex = group.anchors.findIndex(point => same(active, point));
  let wave: Node[] = [{ anchors: group.anchors, active: activeIndex, steps: [], cost: 0, distance: 0 }];
  const seen = new Set([stateKey(group.anchors, activeIndex)]);
  for (let depth = 0; depth < 8 && wave.length; depth++) {
    const next: Node[] = [];
    for (const state of wave) for (const index of state.anchors.keys()) {
      const actor = centroid(state.anchors), current = state.anchors[index]!;
      const others = state.anchors.filter((_, i) => i !== index), count = state.anchors.length;
      const exact = group.goal.map((p, axis) => p * count + Math.floor(count / 2) - others.reduce((sum, point) => sum + point[axis]!, 0));
      const inverse: NativePoint = [exact[0]!, exact[1]!];
      for (const point of [inverse, ...grid]) {
        const move = { index, point };
        if (!valid(point) || same(point, current) || denied.has(deniedKey(state.anchors, move)) ||
          others.some(other => overlaps(point, other)) || protectedPoints.some(other => overlaps(point, other))) continue;
        const anchors = moveAnchor(state.anchors, move), landing = centroid(anchors);
        if (!valid(landing) || protectedPoints.some(other => overlaps(landing, other)) || !trajectory(actor, landing)) continue;
        const remaining = distance[landing[1] * width + landing[0]]!;
        if (remaining < 0) continue;
        if (remaining === 0) return [...state.steps, move];
        const keyForState = stateKey(anchors, index);
        if (seen.has(keyForState)) continue;
        seen.add(keyForState);
        next.push({ anchors, active: index, steps: [...state.steps, move], cost: state.cost + (state.active === index ? 1 : 2), distance: remaining });
      }
    }
    next.sort((a, b) => a.cost + 0.30 * a.distance - (b.cost + 0.30 * b.distance));
    wave = next.slice(0, 95);
  }
  return [];
}

export function createSicLinkedGroupRoute(): NativeFamily<Proposal> {
  let state: Memory | null = null;
  let transfer: { epoch: number; ref: string } | null = null;
  let choose: NativeProgramHandle | undefined;
  return {
    id: linkedGroupRouteId,
    async attachPrograms(registry) {
      choose = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (!choose || remaining < 1 || observation.available_action_refs.length !== 1 || observation.available_action_refs[0] !== 'ACTION6') return null;
      let local = state?.epoch === observation.level_epoch ? state : null;
      const retained = transfer?.epoch === observation.level_epoch - 1 ? transfer : null;
      if (!local) {
        const configuration = identify(observation, rows, !!retained);
        if (!configuration) return null;
        local = { ...configuration, epoch: observation.level_epoch, focus: null, route: [], denied: [], stopped: false };
      }
      if (local.stopped || !matchesScene(observation, rows, local, [], -1)) return null;
      const { scene } = local;
      const activeAnchors = local.groups.flatMap(group => group.contactAt ? [] : group.anchors)
        .filter(anchor => hasAnchor(rows, scene, anchor, [scene.activeColor]));
      if (activeAnchors.length > 1) return null;
      const active = activeAnchors[0];
      const index = local.focus ?? local.groups.findIndex(group => !group.contactAt);
      const group = local.groups[index];
      if (!group) return null;
      if (!local.route.length) local = { ...local, focus: index, route: planRoute(rows, local, index, active) };
      const move = local.route[0];
      if (!move) return null;
      const anchor = group.anchors[move.index]!, selecting = !same(active, anchor);
      const point = selecting ? anchor : move.point;
      const coordinates = selecting ? group.anchors : moveAnchor(group.anchors, move);
      const prediction = centroid(coordinates);
      const mode = execution?.reasoningMode ?? 'exploration', supported = !selecting && !!group.confirmedAt;
      const strategy = supported ? 'P07' : 'P05';
      const facts = { eligibleProbe: !supported, routeSupported: supported, knownInteraction: false, mode };
      const decision = await choose.run({ situation: facts }, { signal: execution?.signal });
      if (decision.result !== strategy) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...(scene.patterned && retained ? [retained.ref] : []),
        ...local.groups.flatMap(other => [other.confirmedAt, other.contactAt])]
        .filter((item): item is string => !!item && item !== ref))];
      const situation = selecting ? 'Select one anchor while preserving the other groups'
        : supported ? 'Move an anchor along a route supported by the observed centroid'
          : scene.patterned ? 'Test the route to the target whose color positions match the carrier'
            : 'Test how the selected anchor changes its group centroid';
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: situation, evidence });
      if (!witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'align_carrier_by_linked_markers', scope: ref.split(':revision:', 1)[0]!, subjects: [key(group.goal)],
        parentObjective: parent, satisfactionContract: 'observed_carrier_contact_preserved_until_official_progress' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const [x, y] = point, radius = (local.scene.side - 1) / 2;
      const id = linkedGroupRouteId + ':' + need.id, action = { action_ref: 'ACTION6', data: { x, y } };
      return {
        status: 'proposed', kind: linkedGroupRouteId, local, index, move, selecting, prediction, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, point_binding: witness, expected_after: prediction }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
          edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
        sicSituationCard: { strategy, need: 'Bring each linked group to its destination and preserve contacts already made',
          situation, evidence, agenda: [], mode, triggerCard: decision.receipt.workflow, goal: group.target,
          actor: areaBox(centroid(group.anchors), radius), active: areaBox(anchor, radius), focus: areaBox(point, radius),
          landing: areaBox(prediction, radius), related: group.anchors.filter(p => !same(p, anchor)).map(p => areaBox(p, radius)),
          preserved: local.groups.filter(p => !!p.contactAt).map(p => p.target) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'linked_group_action_bound' : 'linked_group_scene_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { matched, contactColor } = verifyMove(proposal, after, first, second);
      const contact = contactColor !== null;
      const reason = contact ? 'linked_group_contact_observed' : 'compare_both_linked_groups_after_click';
      return { matched, seal_prefix: true, reason,
        ...(contact ? { sic_need: { id: proposal.needId, status: 'satisfied' as const } } : {}) };
    },
    record(before, after, _command, first, second, proposal) {
      if (after.levels_completed > before.levels_completed && proposal.local.groups.some(group => !!group.contactAt)) {
        transfer = { epoch: before.level_epoch, ref: after.observation_ref };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, index, move, selecting } = proposal;
      const group = local.groups[index]!;
      const { points, matched, contactColor } = verifyMove(proposal, after, first, second);
      const touching = contactColor !== null;
      if (matched && selecting) state = local;
      else if (matched) {
        const ref = after.observation_ref;
        const groups = local.groups.map((item, i) => i === index
          ? { ...item, anchors: points, confirmedAt: ref, contactAt: touching ? ref : null, contactColor } : item);
        state = { ...local, groups, route: touching ? [] : local.route.slice(1), focus: touching ? null : index };
      } else if (!selecting && local.denied.length < 8 && matchesScene(after, second, local, [], -1)) {
        state = { ...local, denied: [...local.denied, deniedKey(group.anchors, move)], route: [] };
      } else state = { ...local, stopped: true };
      return { events: [] };
    },
    state: () => ({ state, transfer }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as Memory | null);
      transfer = structuredClone((value.transfer ?? null) as typeof transfer);
    },
  };
}
