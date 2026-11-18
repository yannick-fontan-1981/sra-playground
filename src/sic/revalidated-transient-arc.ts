import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { supportParts } from '../logos-engine/v6-support-measurements.ts';
import { acquireTransientCurve, transientSignature } from '../logos-engine/v6-transient-contact-memory.ts';
import { transientCenterTwice, transientDihedralSignature, transientLinearSlope, transientQuadratic, transientRound } from '../logos-engine/v6-transient-measurements.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Model = NonNullable<ReturnType<typeof acquireTransientCurve>>;
type Part = ReturnType<typeof supportParts>[number];
type Arc = { source: NativeBox; peer: NativeBox; portals: NativeBox[]; point: NativePoint | null };
const bounds = ({ bbox: { left, top, right, bottom } }: Part): NativeBox => [left, top, right, bottom];
const center = (part: Part): NativePoint => {
  const [row, column] = transientCenterTwice(part);
  return [column! / 2, row! / 2];
};
const divisor = (a: number, b: number): number => {
  while (b) [a, b] = [b, a % b];
  return a;
};

function perpendicularPairs(parts: readonly Part[], rows: NativeRows, floor: number, limit: number): Part[] {
  const candidates = parts.filter(part => {
    const { width, height, bottom } = part.bbox, [x, y] = center(part);
    return bottom < limit && Math.min(width, height) >= 3 && Math.max(width, height) >= 2 * Math.min(width, height)
      && Number.isInteger(x) && Number.isInteger(y) && part.value !== floor && rows[y]?.[x] !== part.value
      && part.area * 3 < width * height * 2;
  });
  const pairs = new Map<string, Part[]>();
  for (const part of candidates) {
    const signature = symbolicDigest([part.value, transientDihedralSignature(part)]);
    const matched = pairs.get(signature) ?? [];
    matched.push(part);
    pairs.set(signature, matched);
  }
  return [...pairs.values()].flatMap(matched => {
    if (matched.length !== 2) return [];
    const [a, b] = matched.map(part => part.bbox);
    return a!.width === b!.height && a!.height === b!.width ? matched : [];
  });
}

export function revalidatedDirectArc(model: Model, rows: NativeRows, count: number, fillRow: number,
  attempted: readonly string[]): Arc | null {
  const parts = supportParts(rows), width = rows[0]!.length, height = rows.length;
  const sources = parts.filter(part => transientSignature(part) === model.source_signature);
  const peers = parts.filter(part => transientSignature(part) === model.peer_signature);
  if (sources.length !== 1 || peers.length !== 1 || sources[0] === peers[0]) return null;
  const source = sources[0]!, peer = peers[0]!, [sx, sy] = center(source), [px, py] = center(peer);
  const limit = Math.min(fillRow, ...parts.filter(part => part.bbox.width === width && part.bbox.top > height / 2)
    .map(part => part.bbox.top));
  const floor = parts.reduce((a, b) => a.area > b.area ? a : b).value;
  const ports = perpendicularPairs(parts, rows, floor, limit);
  if (ports.length < 2) return null;
  const scene = { source: bounds(source), peer: bounds(peer), portals: ports.map(bounds) };
  const track = (model.track as Part[]).map(center), base = model.fill.scalar_fill_count;
  if (track.length < 4 || base < 1 || count < 1) return { ...scene, point: null };
  const oldDirection = model.aim_delta_twice as NativePoint, heading = oldDirection[1] / Math.hypot(...oldDirection);
  const [vertical, quadratic] = transientQuadratic(track.map(([, y]) => y));
  const horizontal = transientLinearSlope(track.map(([x]) => x)), gravity = 2 * quadratic!;
  const fitted = Math.abs(heading) >= 0.2 && horizontal * heading > 0 ? horizontal / heading : Math.hypot(horizontal, vertical!);
  const [oldY, oldX] = model.source_center_twice as NativePoint;
  const push = Math.hypot(track[0]![0] - oldX / 2, track[0]![1] - oldY / 2);
  const first = (model.track as Part[])[0]!.bbox;
  const radius = (Math.min(peer.bbox.width, peer.bbox.height)
    + Math.min(first.right - first.left + 1, first.bottom - first.top + 1) - 2) / 2;
  if (fitted < 0.5 || gravity < 0.05 || push < 1 || radius <= 0) return { ...scene, point: null };
  const scaled = fitted * count / base;
  // Compare proportional transfer with weaker responses to a change in the
  // meter. A single observed flight does not identify that response.
  const speeds = [0, 1 / 6, 1 / 3, 1 / 2].map(weight => scaled + weight * (fitted - scaled));
  const occupied = new Uint8Array(width * limit);
  for (const part of parts) {
    if (part === source || part === peer || part.value === floor) continue;
    if (ports.includes(part)) {
      const [left, top, right, bottom] = bounds(part);
      for (let y = top; y <= bottom; y++) occupied.fill(1, y * width + left, y * width + right + 1);
    } else for (const [y, x] of part.pixels as NativePoint[]) if (y < limit) occupied[y * width + x] = 1;
  }
  const approach = (dx: number, dy: number, speed: number) => {
    let x = sx + dx * push, y = sy + dy * push, vx = dx * speed, vy = dy * speed, nearest = Infinity;
    for (let tick = 0; tick < 160; tick++) {
      const samples = Math.max(1, Math.ceil(2 * Math.hypot(vx, vy)));
      for (let sample = 1; sample <= samples; sample++) {
        const u = x + vx * sample / samples, v = y + vy * sample / samples;
        const col = transientRound(u), row = transientRound(v);
        if (row < 0 || col < 0 || row >= limit || col >= width || occupied[row * width + col]) return nearest;
        nearest = Math.min(nearest, Math.hypot(u - px, v - py));
      }
      x += vx; y += vy; vy += gravity;
    }
    return nearest;
  };
  let best: { point: NativePoint; score: number } | null = null;
  const directions = new Set<string>(), excluded = new Set(attempted);
  for (let y = 0; y < limit; y++) for (let x = 0; x < width; x++) {
    if ((x - sx) * (px - sx) <= 0 || excluded.has([count, x, y].join(','))) continue;
    const dx = x - sx, dy = y - sy, gcd = divisor(Math.abs(2 * dx), Math.abs(2 * dy));
    const direction = [2 * dx / gcd, 2 * dy / gcd].join(',');
    if (directions.has(direction)) continue;
    directions.add(direction);
    const size = Math.hypot(dx, dy);
    let score = 0;
    for (const speed of speeds) {
      const miss = approach(dx / size, dy / size, speed);
      if (miss > radius) { score = Infinity; break; }
      score += miss;
    }
    if (score < (best?.score ?? Infinity)) best = { point: [x, y], score };
  }
  return { ...scene, point: best?.point ?? null };
}
