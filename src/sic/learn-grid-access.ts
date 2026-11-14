import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const learnGridAccessId = 'sic_learn_grid_access';

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION4', 1, 0], ['ACTION3', -1, 0]] as const;
type Direction = typeof directions[number][0];
type Lattice = { box: NativeBox; pitch: number; columns: number; count: number; surface: number; cover: number;
  mobile: number; landmarks: { at: number; color: number; filled: boolean }[] };
type Terrain = 'open' | 'blocked';
type Reading = { at: number; landmarks: (number | null)[]; cells: Partial<Record<number, Terrain>> };
type DirectionEffect = { vector: NativePoint; evidence: string };
type State = { epoch: number; grid: Lattice; reading: Reading; goal: number; risk: number[]; previousObstacle: number | null;
  terrain: Partial<Record<number, Terrain>>; effects: Partial<Record<Direction, DirectionEffect>>;
  terrainEvidence: Partial<Record<number, string>>; refused: string[]; revealOrigins: number[]; waits: number };
type Choice = { action: NativeCommand; target: number; purpose: 'measure' | 'access' | 'reveal' | 'wait'; effect?: DirectionEffect };
type Proposal = NativeProposal & { local: State; choice: Choice; needId: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const middle = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];

function tile(grid: Lattice, index: number): NativeBox {
  const x = grid.box[0] + index % grid.columns * grid.pitch;
  const y = grid.box[1] + Math.floor(index / grid.columns) * grid.pitch;
  return [x, y, x + grid.pitch - 1, y + grid.pitch - 1];
}

function measureLattice(rows: NativeRows): Lattice | null {
  const parts = geometricComponents(rows), candidates: Lattice[] = [];
  for (const rim of parts) {
    const w = width(rim.bbox) - 2, h = height(rim.bbox) - 2;
    if (w < 16 || h < 16 || rim.area < 2 * (w + h + 2) || rim.area >= w * h / 3) continue;
    const [left, top, right, bottom] = rim.bbox;
    const box: NativeBox = [left + 1, top + 1, right - 1, bottom - 1];
    const [x, y] = box, cover = rows[y]?.[x + 1];
    if (cover === undefined || cover === rim.color) continue;
    const interior = parts.filter(p => p.bbox[0] >= x && p.bbox[1] >= y && p.bbox[2] < right && p.bbox[3] < bottom
      && p.color !== cover && p.color !== rim.color);
    for (let pitch = 4; pitch <= 10; pitch++) {
      if (w % pitch || h % pitch) continue;
      const columns = w / pitch, count = columns * h / pitch;
      let repetitions = 0;
      for (let by = y; by < bottom; by += pitch) for (let bx = x; bx < right; bx += pitch) {
        if (rows[by]?.[bx] === rim.color && rows[by]?.[bx + 1] === cover) repetitions++;
      }
      if (repetitions < count * 0.8) continue;
      const frames = interior.filter(p => !p.rectangular && width(p.bbox) === pitch && height(p.bbox) === pitch
        && (p.bbox[0] - x) % pitch === 0 && (p.bbox[1] - y) % pitch === 0);
      const landmarks = frames.map(frame => {
        const [cx, cy] = middle(frame.bbox);
        return { at: (frame.bbox[0] - x) / pitch + (frame.bbox[1] - y) / pitch * columns,
          color: frame.color, filled: rows[cy]?.[cx] !== cover };
      });
      if (landmarks.filter(mark => !mark.filled).length !== 1 || new Set(landmarks.map(mark => mark.color)).size !== landmarks.length) continue;
      const sprites = interior.filter(p => p.area >= 3 && Math.max(width(p.bbox), height(p.bbox)) <= pitch / 2
        && !frames.some(f => p.bbox[0] >= f.bbox[0] && p.bbox[1] >= f.bbox[1] && p.bbox[2] <= f.bbox[2] && p.bbox[3] <= f.bbox[3]));
      if (sprites.length !== 1) continue;
      candidates.push({ box, pitch, columns, count, surface: rim.color, cover, mobile: sprites[0]!.color, landmarks });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function readGrid(rows: NativeRows, grid: Lattice): Reading | null {
  const mobiles: number[] = [], cells: Reading['cells'] = {};
  const landmarks = grid.landmarks.map<number | null>(() => null);
  for (let i = 0; i < grid.count; i++) {
    const box = tile(grid, i), [x, y] = box;
    const [cx, cy] = middle(box), border = rows[y]?.[x], near = rows[y]?.[x + 1];
    const inset = rows[y + 1]?.[x + 1];
    const landmark = grid.landmarks.findIndex(mark => mark.color === border && near === border);
    if (landmark >= 0) {
      landmarks[landmark] = i;
      continue;
    }
    const centered = rows[cy]?.[cx] === grid.mobile || rows[cy + 1]?.[cx + 1] === grid.mobile;
    if (centered) mobiles.push(i);
    if (centered || (border === grid.surface && border === near && near === inset)) cells[i] = 'open';
    else if (border === near && border !== grid.surface && border !== grid.cover && border !== inset) cells[i] = 'blocked';
  }
  return mobiles.length === 1 ? { at: mobiles[0]!, landmarks, cells } : null;
}

function movingObstacle(reading: Reading, grid: Lattice) {
  return reading.landmarks.find((at, i) => at !== null && grid.landmarks[i]!.filled) ?? null;
}

function advance(grid: Lattice, from: number, [dx, dy]: NativePoint): number | null {
  const x = from % grid.columns + dx, y = Math.floor(from / grid.columns) + dy;
  const index = y * grid.columns + x;
  return x >= 0 && x < grid.columns && y >= 0 && index < grid.count ? index : null;
}

function nextCell(local: State) {
  const { grid, reading, goal, terrain, effects, refused, risk } = local;
  if (reading.at === goal) return null;
  const cost = new Map([[goal, 0]]), queue = [{ at: goal, cost: 0 }];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const { at, cost: spent } = queue.shift()!;
    if (spent !== cost.get(at)) continue;
    for (const [, dx, dy] of directions) {
      const from = advance(grid, at, [-dx, -dy]);
      if (from === null || terrain[from] === 'blocked') continue;
      const nextCost = spent + 1 + (terrain[at] ? 0 : 2) + (risk.includes(at) ? 8 : 0);
      if (nextCost >= (cost.get(from) ?? Infinity)) continue;
      cost.set(from, nextCost);
      queue.push({ at: from, cost: nextCost });
    }
  }
  const measured = Object.values(effects).map(effect => effect.vector.join(','));
  const conventional = directions.every(([input, dx, dy]) => !effects[input] || effects[input].vector.join(',') === `${dx},${dy}`);
  const penalty = cost.get(reading.at) ?? grid.count;
  const hazard = movingObstacle(reading, grid);
  const options = directions.flatMap(([input, dx, dy]) => {
    if (refused.includes(`${reading.at}:${input}`)) return [];
    const effect = effects[input];
    const preferred: NativePoint = [dx, dy];
    const possible = effect ? [effect.vector] : directions.flatMap(([, x, y]) => measured.includes(`${x},${y}`) ? [] : [[x, y] as NativePoint]);
    const trials = possible.map(vector => {
      const target = advance(grid, reading.at, vector);
      const score = target !== null && cost.has(target) ? cost.get(target)! + (terrain[target] ? 0 : 2) + (risk.includes(target) ? 8 : 0) : penalty + 3;
      return { target, score, preferred: vector.join(',') === preferred.join(',') };
    });
    const reachable = trials.filter((trial): trial is typeof trial & { target: number } => trial.target !== null && cost.has(trial.target));
    if (!reachable.length) return [];
    const nominal = conventional && reachable.find(trial => trial.preferred);
    const target = (nominal || reachable.sort((a, b) => a.score - b.score)[0]!).target;
    const average = trials.reduce((sum, trial) => sum + trial.score + (trial.target === hazard && hazard !== null ? 12 : 0), 0) / trials.length;
    const score = nominal ? nominal.score : !effect && (cost.get(target) ?? Infinity) < penalty
      ? Math.min(average, reachable[0]!.score + 1) : average;
    return [{ input, target, effect, score }];
  });
  return options.sort((a, b) => a.score - b.score)[0] ?? null;
}

function choose(local: State, canReveal: boolean): Choice | null {
  const next = nextCell(local);
  if (!next) return null;
  const { target, effect } = next, hazard = movingObstacle(local.reading, local.grid);
  const approaching = hazard !== null && local.previousObstacle !== null && target === 2 * hazard - local.previousObstacle;
  if (canReveal && !local.terrain[target] && !local.revealOrigins.includes(local.reading.at)) {
    return { action: { action_ref: 'ACTION5', data: {} }, target, purpose: 'reveal' };
  }
  if (hazard === target || approaching) {
    return canReveal && local.waits < 2 * Math.max(1, local.risk.length)
      ? { action: { action_ref: 'ACTION5', data: {} }, target, purpose: 'wait' } : null;
  }
  return { action: { action_ref: next.input, data: {} }, target, ...(effect ? { effect } : {}),
    purpose: effect && local.terrain[target] === 'open' ? 'access' : 'measure' };
}

export function createSicLearnGridAccess(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: learnGridAccessId,
    propose(observation, rows, _inputs, remaining, execution) {
      if (!remaining || !directions.every(([input]) => observation.available_action_refs.includes(input))) return null;
      if (state?.epoch !== observation.level_epoch && !observation.available_action_refs.includes('ACTION5')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null, grid = prior?.grid ?? measureLattice(rows);
      if (!grid) return null;
      const reading = readGrid(rows, grid);
      if (!reading) return null;
      const goal = grid.landmarks.find(mark => !mark.filled)!.at;
      const ref = observation.observation_ref;
      const terrain = { ...prior?.terrain, ...reading.cells, [goal]: 'open' as const };
      const risk = [...new Set([...prior?.risk ?? [], ...reading.landmarks.flatMap((at, i) => at !== null && grid.landmarks[i]!.filled ? [at] : [])])];
      const terrainEvidence = { ...prior?.terrainEvidence, [goal]: ref };
      for (const cell of Object.keys(reading.cells).map(Number)) terrainEvidence[cell] = ref;
      const local = { ...prior ?? { effects: {}, refused: [], previousObstacle: null, revealOrigins: [], waits: 0 },
        epoch: observation.level_epoch, grid, reading, goal, terrain, terrainEvidence, risk };
      const choice = choose(local, observation.available_action_refs.includes('ACTION5'));
      if (!choice) return null;
      const support = [choice.effect?.evidence, terrainEvidence[choice.target]].filter((value): value is string => !!value && value !== ref);
      const evidence: [string, ...string[]] = [ref, ...new Set(support)];
      const mode = execution?.reasoningMode ?? 'exploration', target = tile(grid, choice.target);
      const offer = { input: choice.action.action_ref, expected: middle(target), evidence };
      const access = choice.purpose === 'access';
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: access ? null : offer, access: access ? offer : null, interaction: null });
      if (!selected) return null;
      const situation = { access: 'Use a measured direction to enter an observed open cell', measure: 'Measure a directional step toward the target',
        reveal: 'Check whether an input reveals the next part of the route', wait: 'Check whether the observed obstacle clears the next cell' }[choice.purpose];
      const parent = 'G_official_completion';
      const objective = { kind: 'learn_grid_access', scope: ref.split(':revision:', 1)[0]!, subjects: ['mobile', 'terrain', 'target'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_access' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `${learnGridAccessId}:${need.id}`;
      const action = choice.action;
      return { status: 'proposed', kind: learnGridAccessId, local, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action], steps: [{ action, expected_after: access ? target : null }],
        sicSituationCard: { strategy: selected.id, need: 'Reach a target through partially observed terrain', situation, evidence, agenda: entries, mode,
          triggerCard: card, actor: tile(grid, reading.at), target, exit: tile(grid, goal),
          observedTerrain: Object.keys(terrain).length, targetEvidence: terrainEvidence[choice.target] ?? null,
          controlEvidence: choice.effect?.evidence ?? null },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'current_lattice_bound' : 'lattice_observation_changed' };
    },
    after(proposal, _index, before, after, _rows, returned) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local, choice } = proposal, next = readGrid(returned, local.grid);
      const matched = choice.purpose === 'access' ? next?.at === choice.target : null;
      return { matched, seal_prefix: true, reason: matched === false ? 'measured_direction_contradicted' : 'acquire_public_grid_return' };
    },
    record(before, after, _command, _rows, returned, { local, choice }) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { grid, terrain, reading } = local, next = readGrid(returned, grid);
      if (!next) return { events: [] };
      const learned = { ...terrain, ...next.cells }, terrainEvidence = { ...local.terrainEvidence };
      for (const cell of Object.keys(next.cells).map(Number)) terrainEvidence[cell] = after.observation_ref;
      const effects = { ...local.effects }, refused = [...local.refused];
      const currentHazard = movingObstacle(next, grid), oldHazard = movingObstacle(reading, grid);
      if (choice.purpose === 'measure' || choice.purpose === 'access') {
        const input = choice.action.action_ref as Direction;
        if (next.at !== reading.at) {
          const dx = next.at % grid.columns - reading.at % grid.columns;
          const dy = Math.floor(next.at / grid.columns) - Math.floor(reading.at / grid.columns);
          if (Math.abs(dx) + Math.abs(dy) === 1) effects[input] = { vector: [dx, dy], evidence: after.observation_ref };
          else delete effects[input];
        } else if (currentHazard !== choice.target && oldHazard !== choice.target) {
          refused.push(`${reading.at}:${input}`);
          if (effects[input] && !terrain[choice.target]) {
            learned[choice.target] = 'blocked';
            terrainEvidence[choice.target] = after.observation_ref;
          }
        }
      }
      state = { ...local, reading: next, terrain: learned, terrainEvidence, effects, refused: refused.slice(-64),
        revealOrigins: choice.purpose === 'reveal' ? [...local.revealOrigins, reading.at] : local.revealOrigins,
        previousObstacle: oldHazard === currentHazard ? local.previousObstacle : oldHazard,
        waits: choice.purpose === 'wait' ? local.waits + 1 : 0 };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
