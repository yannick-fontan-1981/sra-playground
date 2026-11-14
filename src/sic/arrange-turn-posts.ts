import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const arrangeTurnPostsId = 'sic_arrange_turn_posts';

type Part = ReturnType<typeof geometricComponents>[number];
type Post = { color: number; quarters: number; point: NativePoint; mask: NativePoint[] };
type Scene = { pitch: number; start: NativePoint; heading: number; exit: NativeBox; exitHeading: number; wall: number;
  width: number; height: number; posts: Post[]; actorMask: NativePoint[]; marker: number };
type Layout = NativePoint[];
type Choice = { action: NativeCommand; kind: 'observe' | 'select' | 'place' | 'launch'; index?: number; point?: NativePoint; layout?: Layout };
type State = { epoch: number; scene: Scene; refs: string[]; observedLaunch: boolean; selected: number | null; layout: Layout | null; rejected: string[] };
type Proposal = NativeProposal & { local: State; choice: Choice; needId: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const same = ([x, y]: NativePoint, [a, b]: NativePoint) => x === a && y === b;
const distance = ([x, y]: NativePoint, [a, b]: NativePoint) => Math.abs(x - a) + Math.abs(y - b);
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => x >= l && x <= r && y >= t && y <= b;
const directions: readonly NativePoint[] = [[1,0], [0,1], [-1,0], [0,-1]];
const ordered = (q: number) => (q % 4 + 4) % 4;
const rotate = ([x, y]: NativePoint, angle: number): NativePoint =>
  [Math.round(x * Math.cos(angle) - y * Math.sin(angle)), Math.round(x * Math.sin(angle) + y * Math.cos(angle))];

function readPosts(parts: Part[], scene: Scene): Post[] | null {
  const r = scene.pitch / 2;
  const posts = scene.posts.map(post => {
    const sameColor = parts.filter(p => p.color === post.color && p.area === post.mask.length);
    if (sameColor.length !== 1) return null;
    const p = sameColor[0]!, x = p.bbox[0] - Math.min(...post.mask.map(([dx]) => dx)), y = p.bbox[1] - Math.min(...post.mask.map(([, dy]) => dy));
    return x % scene.pitch === r && y % scene.pitch === r ? { ...post, point: [x, y] as NativePoint } : null;
  });
  return posts.every((post): post is Post => post !== null) ? posts : null;
}

function measure(parts: Part[], rows: NativeRows): Scene | null {
  const w = rows[0]!.length;
  const deck = parts.find(p => width(p.bbox) > w * 0.7 && height(p.bbox) > rows.length * 0.65 && p.bbox[0] > 0 && p.bbox[1] > 0);
  const wall = parts.find(p => p.bbox[0] === 0 && p.bbox[1] === 0 && p.bbox[2] === w - 1 && p.bbox[3] < rows.length - 1);
  if (!deck || !wall) return null;
  const pitch = deck.bbox[0], h = wall.bbox[3] + 1;
  if (pitch < 3 || pitch > 7 || deck.bbox[1] !== pitch || w % pitch || h % pitch) return null;
  const open = parts.filter(p => p.rectangular && width(p.bbox) === pitch && height(p.bbox) === pitch
    && (p.bbox[0] === 0 || p.bbox[1] === 0 || p.bbox[2] === w - 1 || p.bbox[3] === h - 1));
  if (open.length !== 1) return null;
  const exit = open[0]!.bbox, actorColor = open[0]!.color, mid = Math.floor(pitch / 2);
  const vehicles = parts.filter(p => p.color === actorColor && width(p.bbox) + height(p.bbox) >= pitch + 2
    && p.bbox[0] >= pitch && p.bbox[1] >= pitch && p.bbox[2] < w - pitch && p.bbox[3] < h - pitch);
  if (vehicles.length !== 1) return null;
  const vehicle = vehicles[0]!;
  const snap = (n: number) => Math.round((n - mid) / pitch) * pitch + mid;
  const start: NativePoint = [snap((vehicle.bbox[0] + vehicle.bbox[2]) / 2), snap((vehicle.bbox[1] + vehicle.bbox[3]) / 2)];
  const actorFace = vehicle.mask.map(([x,y]) => [x + vehicle.bbox[0] - start[0], y + vehicle.bbox[1] - start[1]] as NativePoint);
  const heading = directions.map(([dx,dy], i) => ({ i, value: actorFace.reduce((sum, [x,y]) => sum + x * dx + y * dy, 0) }))
    .sort((a,b) => b.value - a.value);
  if (heading[0]!.value === heading[1]!.value) return null;
  const orientation = heading[0]!.i;
  const actorMask = actorFace.map(p => rotate(p, -orientation * Math.PI / 2));
  const posts = parts.flatMap(p => {
    const args = p.bbox, spanX = width(args), spanY = height(args);
    if (p.color === actorColor || p.color === wall.color || p.color === deck.color || args[0] < pitch || args[1] < pitch
      || args[2] >= w - pitch + 1 || args[3] >= h - pitch || p.area > (pitch + 1) ** 2) return [];
    const quarters = p.rectangular && spanX === mid + 1 && spanY === mid + 1 ? 2
      : spanX === pitch + 1 && spanY === mid + 1 && p.area === (mid + 1) ** 2 ? 1
        : spanX === pitch + 1 && spanY === pitch + 1 && p.area === (pitch + 1) ** 2 - 4 ? 3 : 0;
    const point: NativePoint = [snap((args[0] + args[2]) / 2), snap((args[1] + args[3]) / 2)];
    if (!quarters || parts.some(other => other !== p && other.color === p.color && other.area === p.area)) return [];
    return [{ color: p.color, quarters, point, mask: p.mask.map(([x,y]) => [x + args[0] - point[0], y + args[1] - point[1]] as NativePoint) }];
  }).sort((a,b) => a.quarters - b.quarters);
  if (posts.length < 2 || posts.length > 3 || new Set(posts.map(p => p.color)).size !== posts.length) return null;
  const exitHeading = exit[0] === 0 ? 2 : exit[1] === 0 ? 3 : exit[2] === w - 1 ? 0 : 1;
  return { pitch, start, heading: orientation, exit, exitHeading, wall: wall.color, width: w, height: h,
    posts, actorMask, marker: actorColor };
}

function collides(scene: Scene, rows: NativeRows, x: number, y: number, angle: number): boolean {
  return scene.actorMask.some(offset => {
    const [dx,dy] = rotate(offset, angle), a = Math.round(x + dx), b = Math.round(y + dy);
    return !inside(scene.exit, [a,b]) && (rows[b]?.[a] === scene.wall || a < 0 || b < 0 || a >= scene.width || b >= scene.height);
  });
}

type Aim = { point: NativePoint; heading: number };
function turn(scene: Scene, rows: NativeRows, from: Aim, post: Post, point: NativePoint): Aim | null {
  const radius = scene.pitch, [dx,dy] = directions[from.heading]!;
  const ox = point[0] - from.point[0], oy = point[1] - from.point[1];
  const along = ox * dx + oy * dy, across = dx * oy - dy * ox;
  if (along < 0 || Math.abs(across) !== radius) return null;
  const sign = Math.sign(across), angle = from.heading * Math.PI / 2;
  for (let k = 0; k <= along; k += 0.5) {
    if (collides(scene, rows, from.point[0] + dx * k, from.point[1] + dy * k, angle)) return null;
  }
  const rx = dy * across, ry = -dx * across;
  for (let i = 1; i <= post.quarters * 16; i++) {
    const a = i * sign * Math.PI / 32;
    const x = point[0] + rx * Math.cos(a) - ry * Math.sin(a), y = point[1] + rx * Math.sin(a) + ry * Math.cos(a);
    if (collides(scene, rows, x, y, angle + a)) return null;
  }
  const [x,y] = rotate([rx,ry], post.quarters * sign * Math.PI / 2);
  return { point: [point[0] + x, point[1] + y], heading: ordered(from.heading + post.quarters * sign) };
}

function towardExit(scene: Scene, rows: NativeRows, { point, heading }: Aim): boolean {
  if (heading !== scene.exitHeading) return false;
  const [dx,dy] = directions[heading]!;
  for (let step = 0; step < Math.max(scene.width, scene.height); step += 0.5) {
    const x = point[0] + dx * step, y = point[1] + dy * step;
    if (collides(scene, rows, x, y, heading * Math.PI / 2)) return false;
    if (inside(scene.exit, [x,y])) return true;
  }
  return false;
}

function plan(scene: Scene, rows: NativeRows, posts: Post[], rejected: string[]): Layout | null {
  const { pitch } = scene, mid = Math.floor(pitch / 2);
  const initial = posts.map(post => post.point);
  const valid = (post: Post, [x,y]: NativePoint) => post.mask.every(([dx,dy]) => {
    const point: NativePoint = [x + dx, y + dy];
    return !inside(scene.exit, point) && rows[point[1]]?.[point[0]] !== scene.wall && distance(point, scene.start) > 2;
  });
  const targets = posts.map(post => {
    const positions: NativePoint[] = [];
    for (let y = pitch + mid; y < scene.height - 2 * pitch; y += pitch) {
      for (let x = pitch + mid; x < scene.width - pitch; x += pitch) if (valid(post,[x,y])) positions.push([x,y]);
    }
    return positions.sort((a,b) => distance(a,post.point) - distance(b,post.point));
  });
  let best: Layout | null = null, bestCost = Infinity;
  function visit(aim: Aim, layout: Layout, used: number[]) {
    if (used.length && towardExit(scene, rows, aim)) {
      const overlapping = layout.some((a,i) => layout.some((b,j) => j > i && Math.abs(a[0]-b[0]) < pitch && Math.abs(a[1]-b[1]) < pitch));
      if (overlapping || rejected.includes(JSON.stringify(layout))) return;
      const cost = layout.reduce((sum,p,i) => sum + (same(initial[i]!,p) ? 0 : 2 + distance(initial[i]!,p) / 100), 0);
      if (cost < bestCost) { best = layout; bestCost = cost; }
      return;
    }
    if (used.length >= posts.length) return;
    for (const [i,post] of posts.entries()) {
      if (used.includes(i)) continue;
      for (const point of targets[i]!) {
        const next = turn(scene, rows, aim, post, point);
        if (!next) continue;
        visit(next, layout.map((old,j) => i === j ? point : old), [...used,i]);
      }
    }
  }
  visit({ point: scene.start, heading: scene.heading }, initial, []);
  return best;
}

const activation: NativeCommand = { action_ref: 'ACTION5', data: {} };
function choose(local: State, rows: NativeRows, posts: Post[]): Choice | null {
  if (!local.observedLaunch) return { action: activation, kind: 'observe' };
  const layout = local.layout ?? plan(local.scene, rows, posts, local.rejected);
  if (!layout) return null;
  const index = layout.findIndex((point,i) => !same(point,posts[i]!.point));
  if (index < 0) return { action: activation, kind: 'launch', layout };
  const select = local.selected !== index, point = select ? posts[index]!.point : layout[index]!;
  return { action: { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } }, kind: select ? 'select' : 'place', index, point, layout };
}

function box(point: NativePoint, radius: number): NativeBox {
  const [x,y] = point;
  return [x-radius,y-radius,x+radius,y+radius];
}

export function createSicArrangeTurnPosts(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: arrangeTurnPostsId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION5','ACTION6'].every(id => observation.available_action_refs.includes(id))) return null;
      const parts = geometricComponents(rows), prior = state?.epoch === observation.level_epoch ? state : null;
      const scene = prior?.scene ?? measure(parts, rows);
      if (!scene || prior && !prior.observedLaunch) return null;
      const posts = readPosts(parts, scene);
      if (!posts) return null;
      const local = prior ?? { epoch: observation.level_epoch, scene, refs: [], observedLaunch: false, selected: null, layout: null, rejected: [] };
      const choice = choose(local, rows, posts);
      if (!choice) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.refs.filter(v => v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: choice.action.action_ref, expected: choice.point ?? null, evidence };
      const probe = choice.kind === 'observe' || choice.kind === 'select';
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: probe ? offer : null, access: choice.kind === 'place' ? offer : null, interaction: choice.kind === 'launch' ? offer : null });
      if (!selected) return null;
      const situation = choice.kind === 'observe' ? 'Observe the autonomous movement and test the initial arrangement'
        : choice.kind === 'select' ? 'Select the turning post needed by the trajectory'
          : choice.kind === 'place' ? 'Place the turning post where it can redirect the trajectory' : 'Launch and verify the proposed trajectory';
      const witness = choice.point ? await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: situation, evidence }) : null;
      if (choice.point && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'redirect_autonomous_motion_to_exit', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['autonomous_sprite', 'movable_turn_posts', 'exit'], parentObjective: parent, satisfactionContract: 'official_progress_after_arranged_turns' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = arrangeTurnPostsId + ':' + need.id, action = choice.action;
      return {
        status: 'proposed', kind: arrangeTurnPostsId, local, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: choice.point ?? null, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Redirect the moving sprite toward the exit', situation, evidence, agenda: entries, mode,
          triggerCard: card, actor: box(scene.start, scene.pitch / 2), exit: scene.exit,
          target: choice.point ? box(choice.point, scene.pitch / 2) : null, posts: posts.map(post => box(post.point, scene.pitch / 2)) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'turn_post_action_bound' : 'turn_post_layout_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.choice.kind === 'observe') return { matched: null, seal_prefix: true, reason: 'check_autonomous_trajectory_frames' };
      if (proposal.choice.kind === 'launch') return { matched: false, seal_prefix: true, reason: 'trajectory_did_not_reach_exit' };
      const confirmed = checked(proposal, first, second);
      return { matched: confirmed, seal_prefix: true, reason: confirmed ? 'turn_post_return_observed' : 'turn_post_projection_contradicted' };
    },
    record(before, after, _action, first, second, proposal, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, choice } = proposal, confirmed = checked(proposal, first, second);
      const observedLaunch = local.observedLaunch || choice.kind === 'observe' && frames.length > 2
        && frames.some(rows => rows[local.scene.start[1]]?.[local.scene.start[0]] !== first[local.scene.start[1]]?.[local.scene.start[0]]);
      const failed = choice.kind !== 'observe' && !confirmed && choice.layout;
      state = { ...local, observedLaunch, refs: [...local.refs.slice(-4), after.observation_ref],
        selected: confirmed && choice.kind === 'select' ? choice.index! : local.selected,
        layout: failed ? null : choice.layout ?? null,
        rejected: failed ? [...local.rejected, JSON.stringify(failed)] : local.rejected };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function checked({ local, choice }: Proposal, first: NativeRows, second: NativeRows): boolean {
  if (!choice.point || choice.index === undefined) return false;
  if (choice.kind === 'place') {
    const post = readPosts(geometricComponents(second), local.scene)?.[choice.index];
    return !!post && same(post.point, choice.point);
  }
  const [x,y] = choice.point, reach = local.scene.pitch - 1;
  const markers = [-reach,reach].flatMap(dx => [-reach,reach].map(dy => [x+dx,y+dy] as const));
  return markers.every(([a,b]) => second[b]?.[a] === local.scene.marker)
    && markers.some(([a,b]) => first[b]?.[a] !== second[b]?.[a]);
}
