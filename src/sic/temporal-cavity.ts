import { rectangularOpenComplements } from '../logos-engine/v6-cavity-measurements.ts';
import { advanceCavityPatrol, advanceCavitySlide } from '../logos-engine/v6-cavity-kinematics.ts';
import { supportParts, supportSame } from '../logos-engine/v6-support-measurements.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Position = [number, number];
type Opening = { bounds: NativeBox; opening: NativeBox; token: number };
type Motion = { shape: readonly number[]; token: number; direction: Position; acted: string; evidence: string; otherEvidence?: string };
type Direction = { action: string; delta: NativePoint };

function openings(rows: NativeRows) {
  const parts = supportParts(rows);
  const box = ({ left, top, right, bottom }: Record<string, number>): NativeBox => [left!, top!, right!, bottom!];
  return rectangularOpenComplements(parts).flatMap(([id, core]) => {
    const part = parts.find(item => item.component_id === id);
    return part ? [{ bounds: box(part.bbox), opening: box(core), token: part.value }] : [];
  });
}

const size = ([l, t, r, b]: NativeBox) => [r - l + 1, b - t + 1] as const;
const shape = (site: Opening) => [...size(site.bounds), ...size(site.opening)];

export function movingOpeningMask(rows: NativeRows, motion: Motion): NativeBox | null {
  const matches = openings(rows).filter(site => site.token === motion.token && supportSame(shape(site), motion.shape));
  return matches.length === 1 ? matches[0]!.bounds : null;
}

export function intersectsBox(a: NativeBox, b: NativeBox): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

export function acquireTemporalOpening(before: NativeRows, after: NativeRows, command: string, evidence: string, earlier: Motion | null): Motion | null {
  const first = openings(before), second = openings(after);
  const pairs = first.flatMap(site => {
    const matches = second.filter(candidate => candidate.token === site.token && supportSame(shape(site), shape(candidate)));
    return matches.length === 1 && first.filter(candidate => candidate.token === site.token && supportSame(shape(site), shape(candidate))).length === 1
      ? [[site, matches[0]!] as const] : [];
  }).filter(([a, b]) => a.bounds[0] !== b.bounds[0] || a.bounds[1] !== b.bounds[1]);
  if (pairs.length !== 1) return null;
  const [a, b] = pairs[0]!, [w, h] = size(b.opening);
  const dx = b.bounds[0] - a.bounds[0], dy = b.bounds[1] - a.bounds[1];
  if (!((Math.abs(dx) === w && dy === 0) || (dx === 0 && Math.abs(dy) === h))) return null;
  const direction: Position = [dx / w, dy / h];
  const otherEvidence = earlier && earlier.token === b.token && supportSame(earlier.shape, shape(b))
    ? earlier.otherEvidence ?? (earlier.acted !== command && supportSame(earlier.direction, direction) ? earlier.evidence : undefined)
    : undefined;
  return { token: b.token, shape: shape(b), direction, acted: command, evidence, ...(otherEvidence ? { otherEvidence } : {}) };
}

export function planTemporalCavity(rows: NativeRows, actor: NativeBox, floor: number, motion: Motion,
  directions: readonly Direction[], remaining: number, reference: string) {
  if (!motion.otherEvidence || !directions.length) return null;
  const dims = size(actor);
  const sites = openings(rows).filter(site => supportSame(size(site.opening), dims));
  const movers = sites.filter(site => site.token === motion.token && supportSame(shape(site), motion.shape));
  const targets = sites.filter(site => !movers.includes(site));
  if (movers.length !== 1 || targets.length !== 1) return null;
  const patrol = movers[0]!, target = targets[0]!, [w, h] = dims;
  const surfaces = supportParts(rows).filter(part => part.value === floor && part.bbox.left <= actor[0] && part.bbox.top <= actor[1]
    && part.bbox.right >= Math.max(actor[2], target.opening[2]) && part.bbox.bottom >= Math.max(actor[3], target.opening[3]));
  if (surfaces.length !== 1) return null;
  const { left, top, width, height } = surfaces[0]!.bbox;
  if (width % w || height % h || width * height / (w * h) > 256) return null;
  const columns = width / w, lines = height / h;
  const toCell = (x: number, y: number): Position => [(x - left) / w, (y - top) / h];
  const position = toCell(actor[0], actor[1]), goal = toCell(target.opening[0], target.opening[1]);
  const origin = toCell(patrol.bounds[0], patrol.bounds[1]), [pw, ph] = size(patrol.bounds);
  if (![...position, ...goal, ...origin, pw / w, ph / h].every(Number.isInteger)) return null;
  const inBox = (x: number, y: number, [l, t, r, b]: NativeBox) => l <= x && x <= r && t <= y && y <= b;
  const cells = Array.from({ length: columns * lines }, (_, i) => {
    const x = i % columns, y = Math.floor(i / columns);
    const permitted = Array.from({ length: h }, (_, dy) => Array.from({ length: w }, (_, dx) => {
      const col = left + x * w + dx, row = top + y * h + dy;
      return inBox(col, row, actor) || inBox(col, row, patrol.bounds) || rows[row]?.[col] === floor;
    })).every(line => line.every(Boolean));
    return { x, y, terrain: permitted ? 'SUPPORT' : 'BLOCKED', evidence_ref: reference };
  });
  const steps = Math.min(remaining, 16);
  const offsets = Array.from({ length: pw * ph / (w * h) }, (_, i) => [i % (pw / w), Math.floor(i / (pw / w))]);
  const support = cells.map(cell => ({ ...cell, support: cell.terrain === 'SUPPORT' ? 'SUPPORTED' : 'BLOCKED' }));
  for (let x = 0; x < columns; x++) for (const y of [-1, lines]) {
    support.push({ x, y, terrain: 'BLOCKED', support: 'BLOCKED', evidence_ref: reference });
  }
  for (let y = 0; y < lines; y++) for (const x of [-1, columns]) {
    support.push({ x, y, terrain: 'BLOCKED', support: 'BLOCKED', evidence_ref: reference });
  }
  const forecasts = (['REVERSE_AND_ATTEMPT', 'REVERSE_ONLY'] as const).map(law => {
    let state = { x: origin[0], y: origin[1], offsets, dx: motion.direction[0], dy: motion.direction[1], phase: 0 };
    const seen: Set<string>[] = [];
    for (let tick = 0; tick < steps; tick++) {
      const result = advanceCavityPatrol(state, support, law);
      if (!result.completed) break;
      state = result.body as typeof state;
      seen.push(new Set(offsets.map(([x, y]) => [state.x + x!, state.y + y!].join(','))));
    }
    return seen;
  });
  const candidate: { position: Position; first: { action: string; stop: NativePoint } | null; tick: number }[] =
    [{ position, first: null, tick: 0 }];
  const visited = new Set<string>();
  for (const node of candidate) {
    if (node.first && supportSame(node.position, goal)) return node.first;
    if (forecasts.some(branch => node.tick >= branch.length)) continue;
    if (forecasts.some(branch => branch[node.tick]!.has(node.position.join(',')))) continue;
    const rivals = forecasts.map(branch => cells.map(cell => branch[node.tick]!.has([cell.x, cell.y].join(','))
      ? { ...cell, terrain: 'BLOCKED' } : cell));
    for (const direction of directions) {
      const movement: Position = [direction.delta[1], direction.delta[0]];
      const [result, ...alternatives] = rivals.map(terrain => advanceCavitySlide(terrain, node.position, movement, columns, lines, columns * lines + 1));
      if (!result || result.bound || result.debt.length || alternatives.some(other => other.bound || other.debt.length
        || !supportSame(other.position, result.position))) continue;
      const tick = node.tick + 1, key = [tick, ...result.position as Position].join(',');
      if (visited.has(key)) continue;
      visited.add(key);
      const [x, y] = result.position as Position;
      candidate.push({ position: [x, y], first: node.first ?? { action: direction.action, stop: [left + x * w, top + y * h] }, tick });
    }
  }
  return null;
}
