import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { placeCascadePeers, planCascadeSetup, planParallelCascadeSetup } from './cascade-setup.ts';
import type { CascadePeer, CascadePreparation, CascadeTile } from './cascade-setup.ts';

export const gatedCascadeId = 'sic_gated_cascade';
export const learnCascadeId = 'sic_reuse_propagation';
const moves = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
type Domino = { point: NativePoint; dx: number; dy: number; color: number };
type CascadeRoles = { focus: number; source: number; target: number; tip: number };
type CascadeMemory = { roles: CascadeRoles; epoch: number; evidence: string[]; blockerMark?: number; blockerRef?: string };
type Channel = { path: NativePoint[]; covered: NativePoint | null };
type Setup = { preparation: CascadePreparation; tiles: CascadeTile[] };
type Layout = { pitch: number; cells: NativePoint[]; cursorColor: number; gate: NativePoint; junction: NativePoint;
  target: NativePoint; branch: NativePoint[]; roles?: CascadeRoles; channel?: { covered: NativePoint | null; floorColor: number };
  setup?: Setup; targets?: NativePoint[] };
type Scene = { layout: Layout; cursor: NativePoint };
type Memory = { epoch: number; layout: Layout; routeRef: string | null; burstRef: string | null; failed: boolean };
type CursorStep = { ref: string; at: NativePoint };
type Proposal = NativeProposal & { local: Memory; scene: Scene; next: NativePoint; launch: boolean; walk?: CursorStep[]; needId: string };
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const square = ([x, y]: NativePoint): NativeBox => [x, y, x + 2, y + 2];
const patch = (rows: NativeRows, [x, y]: NativePoint) => rows.slice(y, y + 3).flatMap(row => row.slice(x, x + 3));
const isCursor = (c: number[]) => c[0] !== c[4] && [1, 2, 3, 5, 6, 7, 8].every(i => c[i] === c[0]);
const isJunction = (c: number[]) => [1, 3, 5, 7].every(i => c[i] === c[4])
  && c[0] !== c[4] && [2, 6, 8].every(i => c[i] === c[0]);

function domino(point: NativePoint, colors: number[], ink: number): Domino | null {
  const tip = colors.indexOf(ink);
  if (![1, 3, 5, 7].includes(tip) || colors.lastIndexOf(ink) !== tip) return null;
  const color = colors[4]!;
  if (colors.some((v, i) => i !== tip && v !== color)) return null;
  return { point, dx: tip % 3 - 1, dy: Math.floor(tip / 3) - 1, color };
}

function walk(first: Domino, end: NativePoint, pitch: number, pieces: Domino[], cursor: NativePoint): NativePoint[] | null {
  const route: NativePoint[] = [first.point];
  let node = first;
  for (let i = 0; i < pieces.length + 1; i++) {
    const at: NativePoint = [node.point[0] + node.dx * pitch, node.point[1] + node.dy * pitch];
    if (same(at, end)) return route;
    if (route.some(p => same(p, at))) return null;
    const next = pieces.find(p => same(p.point, at));
    if (!next && !same(at, cursor)) return null;
    route.push(at);
    node = next ?? { ...node, point: at };
  }
  return null;
}

function measureCells(rows: NativeRows) {
  const parts = geometricComponents(rows);
  const repeats = new Map<number, NativeBox[]>();
  for (const p of parts) {
    if (width(p.bbox) === 3 && height(p.bbox) === 3 && p.area === 9) {
      repeats.set(p.color, [...repeats.get(p.color) ?? [], p.bbox]);
    }
  }
  const floor = [...repeats].sort((a, b) => b[1].length - a[1].length)[0];
  if (!floor || floor[1].length < 30) return null;
  const [floorColor, boxes] = floor, pitch = 4;
  const origin: NativePoint = [boxes[0]![0] % pitch, boxes[0]![1] % pitch];
  if (boxes.some(box => box[0] % pitch !== origin[0] || box[1] % pitch !== origin[1])) return null;
  const entries: { point: NativePoint; colors: number[] }[] = [];
  const [firstRow, lastRow] = [Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[1]))];
  for (let y = Math.max(origin[1], firstRow - pitch); y <= lastRow; y += pitch) {
    for (let x = origin[0]; x + 2 < rows[y]!.length; x += pitch) entries.push({ point: [x, y], colors: patch(rows, [x, y]) });
  }
  return { floorColor, pitch, entries };
}

function measure(rows: NativeRows): Scene | null {
  const grid = measureCells(rows);
  if (!grid) return null;
  const { floorColor, pitch, entries } = grid;
  const junctions = entries.filter(({ colors }) => isJunction(colors));
  const cursor = entries.filter(({ colors }) => isCursor(colors));
  if (junctions.length !== 1 || cursor.length !== 1) return null;
  const junction = junctions[0]!, active = cursor[0]!;
  const pieces = entries.flatMap(e => { const p = domino(e.point, e.colors, junction.colors[4]!); return p ? [p] : []; });
  const paths = pieces.flatMap(piece => {
    const path = walk(piece, junction.point, pitch, pieces, active.point);
    return path ? [{ piece, path }] : [];
  });
  const roots = paths.filter(p => !paths.some(q => p !== q && q.path.slice(1).some(t => same(t, p.piece.point))));
  if (roots.length !== 2 || roots[0]!.piece.color !== roots[1]!.piece.color) return null;
  roots.sort((a, b) => a.path.length - b.path.length);
  if (roots[0]!.path.length < 2 || roots[0]!.path.length >= roots[1]!.path.length) return null;
  const incoming = roots[1]!.path;
  const last = incoming.at(-1)!;
  const [jx, jy] = junction.point;
  const targets = pieces.filter(p => p.color !== roots[1]!.piece.color && pieces.filter(other => other.color === p.color).length === 1
    && (jx - last[0]) * (p.point[1] - jy) === (jy - last[1]) * (p.point[0] - jx)
    && (jx - last[0]) * (p.point[0] - jx) + (jy - last[1]) * (p.point[1] - jy) > 0);
  if (targets.length !== 1) return null;
  const cells = entries.filter(e => e.colors.every(c => c === floorColor) || e === junction || e === active
    || pieces.some(p => same(p.point, e.point))).map(e => e.point);
  const roles = { focus: active.colors[0]!, source: roots[1]!.piece.color, target: targets[0]!.color, tip: junction.colors[4]! };
  return { cursor: active.point, layout: { pitch, cells, cursorColor: roles.focus, gate: roots[0]!.path.at(-1)!,
    junction: junction.point, target: targets[0]!.point, branch: incoming, roles } };
}

function targetChannel(pieces: Domino[], peers: NativePoint[], pitch: number, roles: CascadeRoles, target: NativePoint): Channel | null {
  const byCell = new Map(pieces.map(piece => [key(piece.point), piece]));
  const coveredCells = new Set(peers.map(key));
  const queue: Channel[] = pieces.filter(piece => piece.color === roles.source).map(piece => ({ path: [piece.point], covered: null }));
  let hypothetical: Channel | null = null;
  for (const channel of queue) {
    const at = channel.path.at(-1)!;
    if (same(at, target)) {
      if (!channel.covered) return channel;
      hypothetical ??= channel;
      continue;
    }
    const piece = byCell.get(key(at));
    // A peer can hide an oriented link. Confirm its direction after moving the peer.
    const directions: NativePoint[] = piece ? [[piece.dx, piece.dy]]
      : !channel.covered && coveredCells.has(key(at)) ? moves.map(([, dx, dy]) => [dx, dy]) : [];
    for (const [dx, dy] of directions) {
      const next: NativePoint = [at[0] + dx * pitch, at[1] + dy * pitch];
      if (channel.path.some(point => same(point, next))) continue;
      queue.push({ path: [...channel.path, next], covered: piece ? channel.covered : at });
    }
  }
  return hypothetical;
}

function measureChannel(rows: NativeRows, roles: CascadeRoles): Scene | null {
  const grid = measureCells(rows);
  if (!grid) return null;
  const { entries, pitch, floorColor } = grid;
  const cursors = entries.filter(({ colors }) => isCursor(colors));
  const focus = cursors.filter(({ colors }) => colors[0] === roles.focus);
  if (focus.length !== 1) return null;
  const pieces = entries.flatMap(entry => {
    const piece = domino(entry.point, entry.colors, roles.tip);
    return piece ? [piece] : [];
  });
  const targets = pieces.filter(piece => piece.color === roles.target);
  if (targets.length !== 1) return null;
  const target = targets[0]!.point;
  const channel = targetChannel(pieces, cursors.map(cursor => cursor.point), pitch, roles, target);
  if (!channel) return null;
  const floor = entries.filter(({ colors }) => colors.every(color => color === floorColor)).map(entry => entry.point);
  const cells = [...floor, ...pieces.map(piece => piece.point), ...cursors.map(cursor => cursor.point)];
  const junction = channel.path.at(-2) ?? target;
  return { cursor: focus[0]!.point, layout: { pitch, cells, cursorColor: roles.focus, roles,
    channel: { covered: channel.covered, floorColor }, gate: channel.covered ?? junction, junction, target, branch: channel.path } };
}

function retained(rows: NativeRows, layout: Layout): Scene | null {
  const cells = layout.cells.map(point => ({ point, c: patch(rows, point) }));
  const cursor = cells.filter(({ c }) => c[4] !== layout.cursorColor && c.every((v, i) => i === 4 || v === layout.cursorColor));
  if (cursor.length !== 1) return null;
  return { layout, cursor: cursor[0]!.point };
}

function measureCascadeSetup(rows: NativeRows, known: CascadeMemory, previous: Setup | undefined, shouldStop: () => boolean) {
  const grid = measureCells(rows), { roles, blockerMark } = known;
  if (!grid || blockerMark === undefined) return null;
  const { pitch, entries, floorColor } = grid;
  const existing = new Map(previous?.tiles.map(tile => [key(tile.at), tile]));
  const peers: CascadePeer[] = [];
  let active = -1;
  const tiles = entries.flatMap(({ point, colors }): CascadeTile[] => {
    if (isCursor(colors)) {
      if (colors[0] === roles.focus) active = peers.length;
      peers.push({ at: point, mark: colors[4]! });
      return [existing.get(key(point)) ?? { at: point, hidden: true }];
    }
    if (isJunction(colors)) return [{ at: point, junction: true }];
    const piece = domino(point, colors, roles.tip);
    if (piece) return [{ at: point, direction: [piece.dx, piece.dy], color: piece.color }];
    return colors.every(color => color === floorColor) ? [{ at: point }] : [];
  });
  const guards = peers.filter(peer => peer.mark === blockerMark), bridges = peers.filter(peer => peer.mark !== blockerMark);
  const junctions = tiles.filter(tile => tile.junction);
  const sources = tiles.filter(tile => tile.color === roles.source).map(tile => tile.at);
  const targets = tiles.filter(tile => tile.color === roles.target);
  if (active < 0 || guards.length < 2 || bridges.length !== 1 || !junctions.length || !targets.length) return null;
  const target = targets[0]!.at;
  const board = { pitch, tiles, sources, target }, destinations = targets.map(tile => tile.at);
  const preparation = previous?.preparation.setup ? previous.preparation : targets.length > 1
    ? planParallelCascadeSetup(board, destinations, peers, shouldStop)
    : junctions.length > 1 ? planCascadeSetup(board, guards, bridges[0]!, shouldStop) : null;
  if (!preparation) return null;
  const movement = placeCascadePeers(peers, active, blockerMark, preparation, pitch, tiles, shouldStop);
  if (!movement) return null;
  const cursor = peers[active]!.at, branch = preparation.setup?.route ?? [];
  const junction = junctions.find(tile => branch.some(at => same(at, tile.at)))?.at ?? junctions[0]!.at;
  const gate = preparation.reveal ?? preparation.setup?.guards[0] ?? junction;
  const layout: Layout = { cursorColor: roles.focus, pitch, target, gate, junction, branch, roles,
    cells: tiles.map(tile => tile.at), setup: { preparation, tiles },
    ...(targets.length > 1 ? { targets: destinations } : {}) };
  const step = movement.step ? { ref: moves[movement.step.index]![0], at: movement.step.at } : null;
  return { scene: { cursor, layout }, step };
}

function cursorPath(scene: Scene): CursorStep[] | null {
  const { pitch, cells, gate } = scene.layout;
  const queue: { at: NativePoint; steps: CursorStep[] }[] = [{ at: scene.cursor, steps: [] }];
  const available = new Set(cells.map(key)), seen = new Set([key(scene.cursor)]);
  for (const entry of queue) for (const [ref, dx, dy] of moves) {
    const at: NativePoint = [entry.at[0] + dx * pitch, entry.at[1] + dy * pitch], k = key(at);
    if (!available.has(k) || seen.has(k)) continue;
    const steps = [...entry.steps, { ref, at }];
    if (same(at, gate)) return steps;
    seen.add(k);
    queue.push({ at, steps });
  }
  return null;
}

function parkCursor(scene: Scene, rows: NativeRows) {
  const { pitch, cells, branch, channel } = scene.layout;
  for (const [ref, dx, dy] of moves) {
    const at: NativePoint = [scene.cursor[0] + dx * pitch, scene.cursor[1] + dy * pitch];
    if (cells.some(cell => same(cell, at)) && !branch.some(cell => same(cell, at))
      && patch(rows, at).every(color => color === channel?.floorColor)) return { ref, at };
  }
  return null;
}

export function createSicGatedCascade(family = gatedCascadeId): NativeFamily<Proposal> {
  const learns = family === learnCascadeId;
  let state: Memory | null = null;
  let knowledge: CascadeMemory | null = null;
  let choose: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) choose = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || ![...moves.map(([ref]) => ref), 'ACTION5'].every(ref => observation.available_action_refs.includes(ref))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.failed) return null;
      const preceding = knowledge?.epoch === observation.level_epoch - 1 ? knowledge : null;
      const shouldStop = () => !!execution?.signal?.aborted || (execution?.now?.() ?? performance.now()) >= (execution?.deadlineMs ?? Infinity);
      const prepared = preceding && (!prior || prior.layout.setup && !prior.burstRef)
        ? measureCascadeSetup(rows, preceding, prior?.layout.setup, shouldStop) : null;
      const activeLayout = prior && (prior.burstRef || !prior.layout.setup && !prior.layout.channel);
      const scene = prepared?.scene ?? (activeLayout ? retained(rows, prior.layout)
        : (prior ? null : measure(rows)) ?? (preceding && !prior?.layout.setup ? measureChannel(rows, preceding.roles) : null));
      if (!scene) return null;
      const { layout } = scene;
      const local = { epoch: observation.level_epoch, layout, routeRef: prior?.routeRef ?? null, burstRef: prior?.burstRef ?? null, failed: false };
      const launch = layout.setup ? !prepared?.step : layout.channel ? !layout.channel.covered : same(scene.cursor, layout.gate);
      const clearsChannel = !!layout.channel?.covered && same(scene.cursor, layout.gate);
      const path = launch || prepared?.step || clearsChannel ? null : cursorPath(scene);
      const step = launch ? { ref: 'ACTION5', at: scene.cursor }
        : prepared?.step ?? (clearsChannel ? parkCursor(scene, rows) : path?.[0]);
      if (!step) return null;

      const ref = observation.observation_ref;
      const refs = [local.routeRef, local.burstRef, ...(layout.channel || layout.setup ? preceding?.evidence ?? [] : [])];
      if (layout.setup && preceding?.blockerRef) refs.push(preceding.blockerRef);
      const evidence: [string, ...string[]] = [ref, ...new Set(refs.filter((v): v is string => !!v && v !== ref))];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: step.ref, expected: step.at, evidence };
      const known = launch ? local.burstRef : local.routeRef;
      const facts = { eligibleProbe: !known, routeSupported: !launch && !!known, knownInteraction: launch && !!known, mode };
      const decision = learns ? await choose?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const navigation = learns ? null : resolveNavigationPrimitives({ mode, evidence,
        probe: known ? null : offer, access: !launch && known ? offer : null, interaction: launch && known ? offer : null });
      const strategy = decision?.result ?? navigation?.selected?.id;
      if (strategy !== 'P05' && strategy !== 'P07' && strategy !== 'P02') return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'control_cascade_at_shared_junction', scope: ref.split(':revision:', 1)[0]!,
        subjects: [key(layout.junction), ...(layout.targets ?? [layout.target]).map(key)],
        parentObjective: parent, satisfactionContract: 'official_progress_after_directional_cascade' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = gatedCascadeId + ':' + need.id;
      const setup = layout.setup?.preparation;
      const parallel = setup?.setup?.sharedJunctions;
      const targetStates = layout.targets?.map(at => ({ box: square(at), state: cascadeTargetState(rows, at, layout.roles!) }));
      const situation = parallel ? launch ? 'Advance the cascade and check each target separately'
        : 'Bridge the gap and keep the simultaneous arrivals to the shared junction free'
        : setup ? launch ? 'Test whether the protected route and the relay carry the reaction to the target'
        : setup.reveal ? 'Move a piece to reveal a link on the candidate route'
          : 'Protect the planned route from competing arrivals and place the relay at the gap'
        : layout.channel ? launch ? 'Advance the visible cascade route toward the target and measure which links respond'
        : clearsChannel ? 'Move the focused cursor aside to verify the covered link to the target'
          : 'Approach the cursor covering a possible link and verify where control moves'
        : launch ? 'Test the cascade with the earlier branch blocked and check the target branch'
        : 'Move the cursor to block the shorter path into the shared junction';
      const action = { action_ref: step.ref, data: {} };
      const walk = strategy === 'P07' && !layout.setup && !layout.channel
        ? path?.slice(0, Math.min(remaining, maximumCommittedActions)) : null;
      const actions = walk && walk.length > 1 ? walk.map(leg => ({ action_ref: leg.ref, data: {} })) : [action];
      return {
        status: 'proposed', kind: family, local, scene, next: step.at, launch, needId: need.id,
        ...(walk && walk.length > 1 ? { walk } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        steps: actions.map((action, index) => ({ action, expected_after: launch ? null : walk?.[index]?.at ?? step.at })),
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: 'Keep the cascade going toward the target', situation, evidence, agenda: navigation?.entries ?? [],
          mode, triggerCard: navigation?.card ?? decision?.receipt.workflow,
          actor: square(scene.cursor), gate: layout.channel || setup ? null : square(layout.gate),
          coveredLink: layout.channel?.covered ? square(layout.channel.covered) : null, channel: !!layout.channel,
          guards: setup?.setup?.guards.map(square) ?? [], gap: setup?.setup ? square(setup.setup.gap) : null,
          reveal: setup?.reveal ? square(setup.reveal) : null,
          junction: square(layout.junction), target: square(layout.target),
          ...(layout.targets ? { targets: layout.targets.map(square), targetStates, sharedJunctions: parallel?.map(square) ?? [] } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, observation) {
      const scene = index > 0 ? retained(packet.frame_rows, proposal.local.layout) : null;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!scene && proposal.local.epoch === observation.level_epoch && !!proposal.walk
          && same(scene.cursor, proposal.walk[index - 1]!.at) && scene.layout.cells.some(cell => same(cell, proposal.walk![index]!.at));
      return { admitted, reason: admitted ? 'cascade_step_bound' : 'cascade_observation_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const next = retained(second, proposal.local.layout);
      const at = proposal.walk?.[index]?.at ?? proposal.next;
      const matched = stepConfirmed(first, second, { ...proposal, next: at }, next);
      const transfer = matched && !proposal.launch && !!(proposal.scene.layout.channel || proposal.scene.layout.setup)
        && isCursor(patch(first, proposal.next));
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length, reason: matched ? proposal.launch ? 'cascade_propagation_observed'
        : transfer ? 'cursor_focus_transferred' : 'cursor_landing_confirmed'
        : proposal.launch ? 'cascade_stalled_or_reset' : 'cursor_did_not_reach_predicted_cell' };
    },
    record(before, after, _action, first, second, proposal, index) {
      if (after.levels_completed > before.levels_completed && proposal.local.layout.roles) {
        const { layout } = proposal.local;
        const priorMark = knowledge?.epoch === before.level_epoch - 1 ? knowledge.blockerMark : undefined;
        const standing = patch(first, layout.gate);
        const blockerMark = priorMark ?? (!layout.channel && !layout.setup && isCursor(standing) ? standing[4] : undefined);
        const blockerRef = priorMark === undefined
          ? (blockerMark === undefined ? undefined : before.observation_ref) : knowledge?.blockerRef;
        knowledge = { roles: layout.roles!, epoch: before.level_epoch, blockerMark, blockerRef,
          evidence: [before.observation_ref, after.observation_ref] };
        return { events: [], reviewEvidence: layout.targets
          ? 'The cascade fulfilled the combined target requirement and advanced the level.'
          : 'The observed cascade reached the target and advanced the level.' };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local, { launch } = proposal;
      const next = retained(second, local.layout);
      const matched = stepConfirmed(first, second, { ...proposal, next: proposal.walk?.[index]?.at ?? proposal.next }, next);
      state = { ...local, failed: !matched, routeRef: matched && !launch ? after.observation_ref : local.routeRef,
        burstRef: matched && launch ? after.observation_ref : local.burstRef };
      return { events: [] };
    },
    state: () => ({ state, knowledge }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as Memory | null);
      knowledge = structuredClone(value.knowledge as CascadeMemory | null) ?? null;
    },
  };
}

function stepConfirmed(first: NativeRows, second: NativeRows, proposal: Proposal, next: Scene | null) {
  if (!next) return false;
  if (!proposal.launch) return same(next.cursor, proposal.next);
  const { layout } = proposal.local;
  if (layout.setup) {
    const visible = layout.branch.filter(point => !isCursor(patch(first, point)) && !isCursor(patch(second, point)));
    return channelChanged(first, second, visible);
  }
  if (layout.channel) return channelChanged(first, second, layout.branch);
  return same(next.cursor, proposal.next) && burstChanged(first, second, layout);
}

function channelChanged(first: NativeRows, second: NativeRows, points: NativePoint[]) {
  return points.some(point => {
    const before = patch(first, point), after = patch(second, point);
    return before.some((color, index) => color !== after[index]);
  });
}

function cascadeTargetState(rows: NativeRows, at: NativePoint, roles: CascadeRoles) {
  const colors = patch(rows, at);
  if (isCursor(colors)) return 'covered';
  const piece = domino(at, colors, roles.tip);
  if (piece?.color === roles.target) return 'standing';
  return piece?.color === roles.source ? 'activated' : 'changed';
}

function burstChanged(first: NativeRows, second: NativeRows, layout: Layout) {
  return channelChanged(first, second, [...layout.branch, layout.junction, layout.target])
    || layout.cells.some(point => patch(first, point)[4] !== patch(second, point)[4]);
}
