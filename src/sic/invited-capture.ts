import { measureReductionScene, reductionGeometry, reductionPacked, reductionPoint, retainedReductionScene, type ReductionScene } from '../logos-engine/v6-invited-reduction.ts';
import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { measureRayCaptureDomain } from '../logos-engine/v6-ray-capture-domain.ts';
import type { NativeBox, NativeFamily, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';

export const invitedCaptureId = 'sic_invited_capture';
export const verifyCaptureRouteId = 'sic_verify_capture_route';
export const learnCaptureRouteId = 'sic_learn_capture_route';
export const invitedCaptureStrategies = {
  reveal_capture_choices: 'Select an occurrence and look for available landing cells',
  test_invited_capture: 'Test a visibly offered landing cell',
  preserve_capture_continuation: 'Follow a route that keeps the remaining captures possible',
} as const;

type Cell = [number, number];
type Body = [number, string];
type Population = Map<string, Body>;
export type CaptureJump = { over: Cell; by: Cell };
type Move = { target: Cell; focus: Cell; victim: Cell | null; arrival?: Cell };
type PortalPair = { ends: [Cell, Cell]; marker: Body };
type ColorGoal = { color: number; swatch: NativeBox; cell: Cell; empty: number[][]; rank: string; confirmed?: true };
type State = { epoch: number; geometry: NativeRecord; bases: number[]; focus: Cell | null; jumps: Record<string, CaptureJump[]>;
  tried: string[]; stopped: boolean; evidence: string[]; rayRanks?: string[]; colorGoal?: ColorGoal;
  portals?: PortalPair[]; confirmedEntries?: string[] };
type Transfer = { epoch: number; mask: Cell[]; pitch: number; jumps: Record<string, CaptureJump[]>; evidence: string[] };
type Leg = { move: Move; selection: boolean; before: [number, number, ...Body][]; attempt: string };
type Proposal = NativeProposal & Leg & { local: State; path?: Leg[]; needId: string };
const key = (value: unknown) => JSON.stringify(value);
const equal = (a: unknown, b: unknown) => key(a) === key(b);
const add = ([x, y]: Cell, [dx, dy]: Cell): Cell => [x + dx, y + dy];
const diff = ([x, y]: Cell, [dx, dy]: Cell): Cell => [x - dx, y - dy];
const order = (a: Cell, b: Cell) => a[0] - b[0] || a[1] - b[1];
const cells = (keys: Iterable<string>) => [...keys].map(value => JSON.parse(value) as Cell);
const packed = (bodies: Population) => reductionPacked(bodies) as [number, number, ...Body][];

export function captureCellInk(pixels: number[][]) {
  const counts = new Map<number, number>();
  for (const row of pixels) for (const color of row) counts.set(color, (counts.get(color) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]![0];
}

function measurePortals(scene: ReductionScene): PortalPair[] {
  const side = scene.pitch - 2, groups = new Map<string, { marker: Body; cells: Cell[] }>();
  const inside = scene.mask.filter(([row, col]) => row > 0 && col > 0 && row < side - 1 && col < side - 1);
  if (!inside.length || inside.length === scene.mask.length) return [];
  for (const [address, marker] of scene.bodies) {
    const patch = scene.cells.get(address)!, [color] = marker, floor = patch[0]![0]!;
    if (color === floor || !inside.every(([row, col]) => patch[row + 1]![col + 1] === floor)) continue;
    if (!scene.mask.every(([row, col]) => row > 0 && col > 0 && row < side - 1 && col < side - 1
      || patch[row + 1]![col + 1] === color)) continue;
    const signature = key(marker), group = groups.get(signature) ?? { marker, cells: [] };
    group.cells.push(JSON.parse(address) as Cell);
    groups.set(signature, group);
  }
  return [...groups.values()].flatMap(({ marker, cells }) => {
    const sameColor = [...scene.bodies.values()].filter(([color]) => color === marker[0]).length;
    return cells.length === 2 && sameColor === 2 ? [{ ends: [cells[0]!, cells[1]!] as [Cell, Cell], marker }] : [];
  });
}

function removePortalMarkers(scene: ReductionScene, portals: readonly PortalPair[]) {
  for (const portal of portals) for (const end of portal.ends) {
    const address = key(end);
    if (equal(scene.bodies.get(address), portal.marker)) scene.bodies.delete(address);
  }
  return scene;
}

function portalExit(target: Cell, portals: readonly PortalPair[] = []) {
  for (const { ends: [first, second] } of portals) {
    if (equal(target, first)) return second;
    if (equal(target, second)) return first;
  }
  return undefined;
}

function measureColorGoal(rows: NativeRows, scene: ReductionScene): ColorGoal | null {
  const components = geometricComponents(rows), { pitch, origin: [, top] } = scene;
  const swatches = components.filter(part => {
    const [l, t, r, b] = part.bbox;
    if (!part.rectangular || l < 1 || t < 1 || r + 1 >= rows[0]!.length || b + 1 >= top
      || r - l + 1 <= 2 * pitch || b - t + 1 >= pitch) return false;
    const edge = [...rows[t - 1]!.slice(l - 1, r + 2), ...rows[b + 1]!.slice(l - 1, r + 2),
      ...rows.slice(t, b + 1).flatMap(row => [row[l - 1], row[r + 1]])];
    return new Set(edge).size === 1 && edge[0] !== part.color;
  });
  const ranks = [...new Set([...scene.bodies.values()].map(body => body[1]))];
  if (ranks.length !== 1 || !scene.templates[ranks[0]!]?.every((bit: number) => bit === 0)) return null;
  const rank = ranks[0]!;
  const match = ({ color, bbox: swatch }: (typeof components)[number], requiresTintedCorners: boolean): ColorGoal[] =>
    [...scene.cells].flatMap(([address, empty]) => {
      if (scene.bodies.has(address) || new Set(empty.flat()).size <= 2) return [];
      const marks = scene.mask.map(([r, c]) => empty[r + 1]![c + 1] === color);
      if (!marks.some(Boolean) || marks.every(Boolean)) return [];
      if (requiresTintedCorners && ![1, pitch - 2].every(r => [1, pitch - 2].every(c => empty[r]![c] === color))) return [];
      return [{ color, swatch, cell: JSON.parse(address) as Cell, empty, rank }];
    });
  if (swatches.length > 1) return null;
  if (swatches.length === 1) {
    const goals = match(swatches[0]!, false);
    if (goals.length === 1) return goals[0]!;
  }
  const framed = components.filter(({ rectangular, bbox: [l, t, r, b], color }) => {
    if (!rectangular || l < 1 || t < 1 || r + 1 >= rows[0]!.length || b + 1 >= top
      || r - l + 1 >= pitch || b - t + 1 < 2 || b - t + 1 >= pitch) return false;
    const rails = [...rows[t - 1]!.slice(l - 1, r + 2), ...rows[b + 1]!.slice(l - 1, r + 2)];
    const fill = rows.slice(t, b + 1).flatMap(row => [row[l - 1], row[r + 1]]);
    return new Set(rails).size === 1 && new Set(fill).size === 1
      && rails[0] !== fill[0] && color !== fill[0] && color !== rails[0];
  }).flatMap(part => match(part, true));
  return framed.length === 1 ? framed[0]! : null;
}

async function readCaptureScene(rows: NativeRows, state: State): Promise<ReductionScene | null> {
  const scene = await retainedReductionScene(rows, state.geometry);
  const goal = state.colorGoal;
  if (!scene) return null;
  if (state.portals) removePortalMarkers(scene, state.portals);
  if (!goal) return scene;
  const address = key(goal.cell), patch = scene.cells.get(address);
  if (patch && !scene.bodies.has(address) && !equal(patch, goal.empty)
    && scene.mask.every(([r, c]) => patch[r + 1]![c + 1] === goal.color)) {
    scene.bodies.set(address, [goal.color, goal.rank]);
  }
  return scene;
}

export function captureInvitations(scene: ReductionScene, bases: number[]) {
  return cells([...scene.cells].filter(([cell, pixels]) => !scene.bodies.has(cell) && !bases.includes(captureCellInk(pixels))).map(([cell]) => cell)).sort(order);
}

function symmetricJumps(jumps: CaptureJump[]) {
  const values = jumps.flatMap(({ over, by }) => [false, true].flatMap(swap => [-1, 1].flatMap(x => [-1, 1].map(y => {
    const transform = ([a, b]: Cell): Cell => swap ? [x * b, y * a] : [x * a, y * b];
    return { over: transform(over), by: transform(by) };
  }))));
  return [...new Map(values.map(jump => [key(jump), jump])).values()];
}

function rayOptions(board: Cell[], population: Population, from: Cell, directions: Cell[], state: State): { target: Cell; victim: Cell }[] {
  const ref = state.evidence.at(-1);
  if (!ref || !directions.length) return [];
  const members = cells(population.keys()).map(origin => ({ member_ref: key(origin), origin, occupied_offsets: [[0, 0]], rank: 0 }));
  const scope = { request_ref: ref, caller_ref: verifyCaptureRouteId, parent_consumer_ref: verifyCaptureRouteId,
    parent_goal_ref: 'G_official_completion', parent_contribution_ref: 'preserve_capture_continuation', caller_next_item_ref: key(from),
    epoch: state.epoch, evidence_revision_ref: ref, model_revision_ref: ref, event_owner_ref: 'public_response',
    input_domain_complete: true, assumption_refs: ['distinct_rank_may_extend_verified_jump_axis'] };
  const measured = measureRayCaptureDomain({ scope, operation_ref: 'mechanics.typed_jump_carriers.ray_capture_domain', mode_ref: 'DOMAIN',
    requested_result_type: 'DMechanicalResult', node_bound: 2048, depth_bound: board.length, domain_bound: board.length,
    time_bound_ms: 100, phase_ref: 'CURRENT_CAPTURE_DOMAIN', population: members, native_focus_ref: key(from),
    board_cells: board, ray_passage_cells: board, landing_support_cells: board, range_kind: 'RAY', range_law_rank: 0,
    range_law_evidence_ref: ref, directions, eligible_victim_refs: members.filter(member => member.member_ref !== key(from)).map(member => member.member_ref),
    proposed_landing: null });
  return measured.status === 'COMPLETE' ? measured.values.capture_incidences
    .map(({ landing, victim_ref }: { landing: Cell; victim_ref: string }) => ({ target: landing, victim: JSON.parse(victim_ref) as Cell })) : [];
}

export function deriveCaptureRoute(scene: ReductionScene, state: State, exposed: Cell[], remaining: number) {
  const goal = state.colorGoal;
  const available = new Set(exposed.map(key));
  const templates = new Map(Object.entries(state.jumps).map(([rank, jumps]) => [rank, symmetricJumps(jumps)]));
  const rays = new Set(state.rayRanks), board = cells(scene.cells.keys());
  const directions = [...new Map([...templates.values()].flat().flatMap(({ over, by }) =>
    Math.max(...over.map(Math.abs)) === 1 && equal(by, over.map(value => 2 * value)) ? [[key(over), over] as const] : [])).values()];
  type Entry = { population: Population; focus: Cell | null; from?: { entry: Entry; moves: Move[] }; cost: number };
  const queue: Entry[] =
    [{ population: scene.bodies, focus: state.focus, cost: 0 }];
  const visited = new Set<string>();
  for (let i = 0; i < queue.length && i < 4096; i++) {
    const entry = queue[i]!, { population, focus, from: predecessor, cost } = entry;
    if (predecessor && (goal ? population.size > 0 && [...population.values()].every(body => body[0] === goal.color) : population.size === 1)) {
      const route: Move[][] = [];
      for (let step = entry; step.from; step = step.from.entry) route.push(step.from.moves);
      return route.reverse().flat();
    }
    const signature = key([packed(population), focus]);
    if (cost >= remaining || visited.has(signature)) continue;
    visited.add(signature);
    for (const from of cells(population.keys()).sort(order)) {
      const body = population.get(key(from))!;
      const jumps = templates.get(body[1]) ?? [];
      const options = rays.has(body[1]) ? rayOptions(board, population, from, directions, state)
        : jumps.map(({ over, by }) => ({ target: add(from, by), victim: add(from, over) }));
      options.sort((a, b) => order(a.victim, b.victim) || order(a.target, b.target));
      for (const { target, victim } of options) {
        if (!population.has(key(victim)) || population.has(key(target)) || !scene.cells.has(key(target))) continue;
        const exit = portalExit(target, state.portals), landing = exit ?? target;
        if (exit && population.has(key(exit)) && !equal(exit, from) && !equal(exit, victim)) continue;
        const selected = equal(focus, from);
        if (!predecessor && selected && !available.has(key(target))) continue;
        if (!predecessor && (rays.size || goal || state.portals?.length)
          && state.tried.includes(key([packed(population), focus, selected ? target : from]))) continue;
        const nextCost = cost + (selected ? 1 : 2);
        if (nextCost > remaining) continue;
        const next = new Map(population);
        next.delete(key(from));
        next.delete(key(victim));
        next.set(key(landing), goal && equal(landing, goal.cell) ? [goal.color, body[1]] : body);
        const capture = { target, focus: from, victim, ...(exit ? { arrival: exit } : {}) };
        const moves = selected ? [capture] : [{ target: from, focus: from, victim: null }, capture];
        const successor = { population: next, focus: landing, from: { entry, moves }, cost: nextCost };
        if ((!goal && !state.portals?.length) || nextCost >= queue.at(-1)!.cost) queue.push(successor);
        else {
          // Planning for a survivor color counts selections and captures separately.
          let left = i + 1, right = queue.length;
          while (left < right) {
            const mid = (left + right) >>> 1;
            if (queue[mid]!.cost <= nextCost) left = mid + 1;
            else right = mid;
          }
          queue.splice(left, 0, successor);
        }
      }
    }
  }
  return null;
}

export function measureCaptureEffect(proposal: Pick<Proposal, 'before' | 'move'> & { local: Pick<State, 'colorGoal'> }, after: ReductionScene, selected: Cell) {
  const original: Population = new Map(proposal.before.map(([x, y, color, rank]) => [key([x, y]), [color, rank]]));
  const { move } = proposal, goal = proposal.local.colorGoal;
  const landing = move.arrival ?? move.target, selectedBody = original.get(key(selected));
  const expectedBody: Body | undefined = selectedBody && goal && equal(landing, goal.cell) ? [goal.color, selectedBody[1]] : selectedBody;
  if (!selectedBody || !expectedBody) return null;
  if (move.arrival) {
    const candidates = move.victim ? [move.victim] : cells(original.keys()).filter(cell => !equal(cell, selected));
    const observed = packed(after.bodies);
    const matches = candidates.filter(victim => {
      if (!original.has(key(victim))) return false;
      const expected = new Map(original);
      expected.delete(key(selected));
      expected.delete(key(victim));
      if (expected.has(key(landing))) return false;
      expected.set(key(landing), expectedBody);
      return equal(observed, packed(expected));
    });
    return matches.length === 1 ? { rank: selectedBody[1], jump: { over: diff(matches[0]!, selected), by: diff(move.target, selected) } } : null;
  }
  const removed = cells([...original.keys()].filter(cell => !after.bodies.has(cell)));
  const added = cells([...after.bodies.keys()].filter(cell => !original.has(cell)));
  const victim = removed.find(cell => !equal(cell, selected));
  if (removed.length !== 2 || !removed.some(cell => equal(cell, selected)) || !victim ||
    added.length !== 1 || !equal(added[0], proposal.move.target) ||
    !equal(after.bodies.get(key(added[0]!)), expectedBody) ||
    (proposal.move.victim && !equal(proposal.move.victim, victim))) return null;
  const expected = new Map(original);
  expected.delete(key(selected));
  expected.delete(key(victim));
  expected.set(key(added[0]!), expectedBody);
  return equal(packed(expected), packed(after.bodies)) ? { rank: selectedBody[1], jump: { over: diff(victim, selected), by: diff(added[0]!, selected) } } : null;
}

export function createSicVerifyCaptureRoute(family = verifyCaptureRouteId): NativeFamily<Proposal> {
  const learns = family === learnCaptureRouteId;
  let state: State | null = null, transfer: Transfer | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.tried.length ?? 0) >= 40) return null;
      const adopted = learns && !prior ? await execution?.readPriorClickScene?.(async (first, _before, action) => {
        const origin = await measureReductionScene(first);
        if (!origin) return null;
        const portals = measurePortals(origin);
        removePortalMarkers(origin, portals);
        const bases = [...new Set([...origin.cells].filter(([cell]) => !origin.bodies.has(cell)).map(([, pixels]) => captureCellInk(pixels)))];
        const target = cells(origin.bodies.keys()).find(cell => {
          const [x, y] = reductionPoint(origin, cell), half = Math.floor(origin.pitch / 2);
          return Math.abs(x - action.data.x!) <= half && Math.abs(y - action.data.y!) <= half;
        });
        const current = target && await retainedReductionScene(rows, reductionGeometry(origin));
        if (!target || !current || !equal(packed(origin.bodies), packed(removePortalMarkers(current, portals).bodies))) return null;
        const before = captureInvitations(origin, bases), after = captureInvitations(current, bases);
        return !before.length && after.length ? { current, target, bases, portals } : null;
      }) : null;
      if (learns && !prior && (!adopted || adopted.afterRef !== observation.observation_ref || adopted.levelEpoch !== observation.level_epoch)) return null;
      const scene = prior ? await readCaptureScene(rows, prior) : adopted?.scene.current ?? await measureReductionScene(rows);
      if (!scene) return null;
      const portals = prior?.portals ?? adopted?.scene.portals ?? (!prior ? measurePortals(scene) : []);
      if (!prior && !adopted) removePortalMarkers(scene, portals);
      const populationLimit = portals.length ? 12 : 8;
      if (scene.bodies.size < 2 || scene.bodies.size > populationLimit) return null;
      const previous = transfer?.epoch === observation.level_epoch && transfer.pitch === scene.pitch && equal(transfer.mask, scene.mask) ? transfer : null;
      const ranks = [...new Set([...scene.bodies.values()].map(body => body[1]))];
      const rayRanks = previous && ranks.some(rank => previous.jumps[rank]?.length) ? ranks.filter(rank => !previous.jumps[rank]?.length) : [];
      const colorGoal = !prior && previous && ranks.every(rank => previous.jumps[rank]?.length) ? measureColorGoal(rows, scene) : null;
      const reuse = !!previous && (rayRanks.length > 0 || !!colorGoal || portals.length > 0);
      const local: State = prior ?? { epoch: observation.level_epoch, geometry: reductionGeometry(scene),
        bases: adopted?.scene.bases ?? [...new Set([...scene.cells].filter(([cell]) => !scene.bodies.has(cell)).map(([, pixels]) => captureCellInk(pixels)))],
        focus: adopted?.scene.target ?? null, jumps: reuse ? previous!.jumps : {}, tried: [], stopped: false,
        evidence: adopted ? [adopted.beforeRef, adopted.afterRef] : reuse ? previous!.evidence : [],
        ...(rayRanks.length ? { rayRanks } : {}), ...(colorGoal ? { colorGoal } : {}), ...(portals.length ? { portals } : {}) };
      const exposed = captureInvitations(scene, local.bases);
      const before = packed(scene.bodies);
      const attemptKey = (target: Cell) => key([before, local.focus, target]);
      const route = Object.keys(local.jumps).length ? deriveCaptureRoute(scene, local, exposed, remaining) : null;
      if (scene.bodies.size > 8 && !route) return null;
      const offered = local.focus && exposed.find(target => !local.tried.includes(attemptKey(target)));
      const pending = cells(scene.bodies.keys()).sort((a, b) => a[1] - b[1] || a[0] - b[0])
        .find(target => !equal(target, local.focus) && !local.tried.includes(attemptKey(target)));
      const destination = offered ? portalExit(offered, local.portals) : undefined;
      const test: Move | null = offered && local.focus
        ? { target: offered, focus: local.focus, victim: null, ...(destination ? { arrival: destination } : {}) } : null;
      const select: Move | null = pending ? { target: pending, focus: pending, victim: null } : null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const next = route?.[0];
      const supported = next && !local.tried.includes(attemptKey(next.target)) ? next : null;
      const paintProbe = local.colorGoal && !local.colorGoal.confirmed && supported?.victim && equal(supported.target, local.colorGoal.cell);
      const portalProbe = supported?.arrival && !local.confirmedEntries?.includes(key(supported.target));
      const trial = paintProbe || portalProbe ? supported : test ?? select;
      const mode = execution?.reasoningMode ?? (supported ? 'solving' : 'exploration');
      const facts = { routeSupported: !!supported && !paintProbe && !portalProbe, eligibleProbe: !!trial, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = decision?.result;
      if (!decision || (strategy !== 'P07' && strategy !== 'P05')) return null;
      const move = strategy === 'P07' ? supported : trial;
      if (!move) return null;
      const phase = strategy === 'P07' ? 'preserve_capture_continuation' : test ? 'test_invited_capture' : 'reveal_capture_choices';
      const selection = scene.bodies.has(key(move.target));
      const point = reductionPoint(scene, move.target), [x, y] = point;
      const command = { action_ref: 'ACTION6', data: { x, y } };
      const label = paintProbe ? 'Test the offered landing on the terrain that matches the requested color'
        : move.arrival && strategy === 'P05' ? 'Test the offered landing that could transfer the piece to its paired mark' : invitedCaptureStrategies[phase];
      const parent = 'G_official_completion';
      const goal = { kind: local.colorGoal ? 'match_surviving_pieces_to_visible_color' : 'reduce_visible_population', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['capture_source', 'intermediate_piece', 'offered_landing'], parentObjective: parent,
        satisfactionContract: local.colorGoal ? 'official_progress_after_survivors_match_requested_color' : 'official_progress_after_reducing_the_visible_population' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = `invited-capture:${need.id}`;
      const actions = [command], binding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      const steps = [{ action: command, expected_after: null, point_binding: binding }];
      const path: Leg[] = [{ move, selection, before, attempt: attemptKey(move.target) }];
      const centerColors = new Set(exposed.map(cell => {
        const [x, y] = reductionPoint(scene, cell);
        return rows[y]![x]!;
      }));
      if (strategy === 'P07' && route && !local.colorGoal && !local.rayRanks?.length && centerColors.size === 1) {
        const population = new Map(scene.bodies), offeredColor = [...centerColors][0]!;
        let focus = local.focus;
        for (const [index, step] of route.slice(0, Math.min(maximumCommittedActions, remaining, 40 - local.tried.length)).entries()) {
          const active = population.get(key(step.focus));
          if (!active || index > 0 && step.arrival) break;
          if (index > 0) {
            const isSelection = !step.victim;
            if (isSelection && !equal(scene.bodies.get(key(step.target)), population.get(key(step.target)))) break;
            const point = reductionPoint(scene, step.target);
            const [x, y] = point;
            const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
            const point_binding = isSelection ? witness : await ObservedInputDomain.projectLocusWitness(witness, offeredColor);
            const action = { action_ref: 'ACTION6', data: { x, y } }, before = packed(population);
            path.push({ move: step, selection: isSelection, before, attempt: key([before, focus, step.target]) });
            actions.push(action);
            steps.push({ action, expected_after: null, point_binding });
          }
          if (step.victim) {
            population.delete(key(step.focus));
            population.delete(key(step.victim));
            population.set(key(step.arrival ?? step.target), active);
          }
          focus = step.arrival ?? step.target;
        }
      }
      const box = (cell: Cell): NativeBox => {
        const [cx, cy] = reductionPoint(scene, cell), half = Math.floor(scene.pitch / 2);
        return [cx - half, cy - half, cx - half + scene.pitch - 1, cy - half + scene.pitch - 1];
      };
      const rayPieces = cells(scene.bodies.keys()).filter(cell => local.rayRanks?.includes(scene.bodies.get(key(cell))![1]));
      const rayContext = rayPieces.length ? {
        rayPieces: rayPieces.map(box),
        situation: 'The route uses the distinct rank on a longer ray. The current landing still needs a visible invitation.',
      } : {};
      const paintContext = local.colorGoal ? {
        need: 'Bring all surviving pieces to the requested color', swatch: local.colorGoal.swatch, terrain: box(local.colorGoal.cell),
        situation: paintProbe ? label : move.victim && equal(move.focus, local.colorGoal.cell)
          ? 'Move the recolored piece away and free the terrain for the next arrival.'
          : 'Keep a route to a final population that matches the displayed color.',
      } : {};
      const portalContext = move.arrival ? { portalExit: box(move.arrival), situation: strategy === 'P05' ? label
        : 'Use the offered entry and verify that the piece reaches the paired exit.' } : {};
      return { status: 'proposed', kind: family, actions, local, move, selection, before, needId: need.id, attempt: attemptKey(move.target),
        ...(path.length > 1 ? { path } : {}),
        steps, binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Remove pieces while keeping a capture route open', mode,
          situation: strategy === 'P07' ? 'The measured jump supports a route to one remaining piece. The next landing is checked against the current highlights.' : label,
          agenda: [], evidence, triggerCard: decision.receipt.workflow, focus: box(move.focus), target: box(move.target),
          victim: move.victim ? box(move.victim) : null, ...(strategy === 'P07' ? rayContext : {}), ...paintContext, ...portalContext },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    async before(proposal, index, packet, observation) {
      if (index > 0 && proposal.path) {
        const { local } = proposal, leg = proposal.path[index]!, scene = await readCaptureScene(packet.frame_rows, local);
        const admitted = local.epoch === observation.level_epoch && !!scene && equal(packed(scene.bodies), leg.before)
          && (leg.selection ? scene.bodies.has(key(leg.move.target)) : captureInvitations(scene, local.bases).some(cell => equal(cell, leg.move.target)));
        return { admitted, reason: admitted ? 'capture_board_and_invitation_confirmed' : 'capture_domain_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'capture_locus_bound' : 'capture_domain_changed' };
    },
    async after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const scene = await readCaptureScene(second, proposal.local);
      const leg = proposal.path?.[index] ?? proposal;
      const matched = !!scene && (leg.selection ? equal(packed(scene.bodies), leg.before) && captureInvitations(scene, proposal.local.bases).length > 0
        : !!measureCaptureEffect({ ...leg, local: proposal.local }, scene, leg.move.focus));
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length,
        reason: matched ? 'invitation_or_capture_observed' : 'capture_effect_unconfirmed' };
    },
    async record(before, after, _command, _first: NativeRows, second, proposal, index) {
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local;
      const leg = proposal.path?.[index] ?? proposal, { move, selection } = leg;
      if (after.levels_completed > before.levels_completed && Object.keys(local.jumps).length) {
        transfer = { epoch: after.level_epoch, pitch: local.geometry.pitch as number, mask: local.geometry.mask as Cell[],
          jumps: local.jumps, evidence: [...local.evidence.slice(-4), after.observation_ref] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const scene = await readCaptureScene(second, local);
      const effect = !selection && scene ? measureCaptureEffect({ ...leg, local }, scene, move.focus) : null;
      const selected = selection && !!scene && equal(packed(scene.bodies), leg.before) && captureInvitations(scene, local.bases).length > 0;
      const jumps = { ...local.jumps };
      if (effect) jumps[effect.rank] = [...(jumps[effect.rank] ?? []), effect.jump];
      const landing = move.arrival ?? move.target;
      const colorGoal = local.colorGoal;
      const acquired = effect && colorGoal && equal(landing, colorGoal.cell) && leg.before.some(([x, y, color]) =>
        equal([x, y], move.focus) && color !== colorGoal.color);
      const freed = effect && colorGoal && equal(move.focus, colorGoal.cell) && scene && equal(scene.cells.get(key(colorGoal.cell)), colorGoal.empty);
      state = { ...local, jumps, focus: selected || effect ? landing : selection ? null : local.focus,
        stopped: !scene || (!selection && !effect && !equal(packed(scene.bodies), leg.before)),
        tried: [...local.tried, leg.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref],
        ...(colorGoal && acquired ? { colorGoal: { ...colorGoal, confirmed: true as const } } : {}),
        ...(effect && move.arrival ? { confirmedEntries: [...new Set([...(local.confirmedEntries ?? []), key(move.target)])] } : {}) };
      return { events: [], ...(acquired ? { reviewEvidence: 'The arriving piece acquired the requested color and kept its rank.' }
        : freed ? { reviewEvidence: 'The piece kept the new color and the terrain is free for the next arrival.' }
          : effect && move.arrival ? { reviewEvidence: 'The capture removed the intermediate piece and the selected piece appeared at the paired exit.' } : {}) };
    },
    state: () => ({ state, transfer }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      transfer = structuredClone((value.transfer as Transfer | undefined) ?? null);
    },
  };
}
