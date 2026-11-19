import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [engine, solver, previousFile, replayFile, destination] = process.argv.slice(2);
const previous = JSON.parse((await readFile(previousFile, 'utf8')).trim()),
  replay = JSON.parse((await readFile(replayFile, 'utf8')).trim());
if (
  previous.initial !== replay.initial ||
  previous.trajectory !== replay.trajectory ||
  previous.issued !== replay.replayCommands.length
)
  throw Error('The recorded run does not match the frozen trajectory.');
const load = (base, file) => import(pathToFileURL(join(resolve(base), file)).href);
const { createGameDispatcher } = await load(engine, 'src/runtime/native-game-dispatcher.ts');
const { measureNativeObservation } = await load(solver, 'src/logos-engine/v6-native-observer.ts');
const games = createGameDispatcher(() => {
  throw Error('Unexpected legacy backend');
});
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const measure = (b, i) =>
  measureNativeObservation(
    {
      level: b.level,
      levels_completed: b.levelsCompleted,
      frame_hash: hash(b.frame),
      frame_rows: b.frame,
      available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
      state: b.state,
    },
    i
  );
const eligible = previous.preparation.filter(
  (e) =>
    e.longer &&
    e.predictedGap &&
    e.localPath === false &&
    ['reused_as_predicted', 'derived_prediction_verified', 'transport_prediction_verified'].includes(e.result)
);
const ids = new Map(eligible.map((e) => [e.actionIndex, e])),
  models = new Map(),
  receipts = [];
const center = (e) => [(e.bbox[0] + e.bbox[2]) / 2, (e.bbox[1] + e.bbox[3]) / 2];
const pos = (e) => e.position.join(',');
const snapshot = (a, b) => {
  const by = new Map(b.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e]));
  return a.entities
    .filter((e) => !e.identity_ambiguous && by.has(e.signature) && pos(e) !== pos(by.get(e.signature)))
    .map((e) => ({ before: e, after: by.get(e.signature) }));
};
const transforms = {
  quarterTurn: ([x, y]) => [-y, x],
  reverseQuarterTurn: ([x, y]) => [y, -x],
  halfTurn: ([x, y]) => [-x, -y],
  translate: (p) => p,
};
function geometry(ms) {
  if (!ms.length) return null;
  let best = { type: null, count: 0, distinct: 0 };
  for (const [type, apply] of Object.entries(transforms)) {
    const votes = new Map();
    for (const m of ms) {
      const a = apply(center(m.before)),
        b = center(m.after);
      const k = b[0] - a[0] + ',' + (b[1] - a[1]);
      const v = votes.get(k) ?? [];
      v.push(center(m.before).join(','));
      votes.set(k, v);
    }
    for (const group of votes.values()) {
      const d = new Set(group).size;
      if (d > best.distinct) best = { type, count: group.length, distinct: d };
    }
  }
  return best;
}
function surfaces(before, after, old, next) {
  const pairCounts = new Map();
  for (const [dx, dy] of old.mask) {
    const x = old.position[0] + dx,
      y = old.position[1] + dy,
      nx = next.position[0] + dx,
      ny = next.position[1] + dy;
    const left = after[y]?.[x],
      right = before[ny]?.[nx];
    if (left === old.palette_value || right === old.palette_value) continue;
    const k = left + ',' + right,
      group = pairCounts.get(k) ?? { left, right, count: 0, x, y, nx, ny };
    group.count++;
    pairCounts.set(k, group);
  }
  const p = [...pairCounts.values()].sort((a, b) => b.count - a.count)[0];
  if (!p) return null;
  let connected = null;
  if (p.left === p.right) {
    const queue = [[p.x, p.y]],
      visited = new Set([p.x + ',' + p.y]);
    connected = false;
    for (const [x, y] of queue) {
      if (x === p.nx && y === p.ny) {
        connected = true;
        break;
      }
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [-1, 0],
        [0, -1],
      ]) {
        const xx = x + dx,
          yy = y + dy,
          key = xx + ',' + yy;
        if (!visited.has(key) && (before[yy]?.[xx] === p.left || after[yy]?.[xx] === p.left)) {
          queue.push([xx, yy]);
          visited.add(key);
        }
      }
    }
  }
  return { vacatedColor: p.left, coveredColor: p.right, pixels: p.count, samePublicSurface: connected };
}
let board = await games.dispatch({ type: 'load', code: replay.code, level: replay.start });
if (board.level !== replay.start && board.canSelectLevel)
  board = await games.dispatch({ type: 'selectLevel', level: replay.start });
if (hash(board.frame) !== previous.initial) throw Error('Initial observation mismatch');
let observation = await measure(board, 1);
const W = board.frame[0].length,
  H = board.frame.length,
  temporal = Array.from({ length: H * W }, () => new Map());
function census(rows) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const m = temporal[y * W + x],
        v = rows[y][x];
      m.set(v, (m.get(v) ?? 0) + 1);
    }
}
census(board.frame);
const trajectory = createHash('sha256');
for (const [index, raw] of replay.replayCommands.entries()) {
  const action = raw.id === 6 ? { id: raw.id, data: raw.data } : { id: raw.id };
  const old = board,
    oldO = observation;
  board = await games.dispatch({ type: 'action', actionId: raw.id, ...(raw.id === 6 ? { data: raw.data } : {}) });
  census(board.frame);
  trajectory.update(
    JSON.stringify([action, board.frame, board.frames, board.level, board.levelsCompleted, board.state])
  );
  observation = await measure(board, index + 2);
  const ms = snapshot(oldO, observation);
  for (const m of ms) {
    const sig = m.before.signature,
      g = models.get(sig) ?? {
        ops: {},
        positions: new Set(),
        links: [],
        area: m.before.area,
        color: m.before.palette_value,
      };
    g.ops[raw.id] = (g.ops[raw.id] ?? 0) + 1;
    g.positions.add(pos(m.before));
    g.positions.add(pos(m.after));
    g.links.push([raw.id, pos(m.before), pos(m.after)]);
    models.set(sig, g);
  }
  const receipt = ids.get(index + 1);
  if (!receipt) continue;
  const selected = ms.find(
    (m) => m.before.signature === receipt.actor && pos(m.before) === receipt.from && pos(m.after) === receipt.to
  );
  if (!selected) throw Error('Replayed object and positions do not match receipt ' + (index + 1));
  let changed = 0;
  for (let y = 0; y < old.frame.length; y++)
    for (let x = 0; x < old.frame[y].length; x++) changed += Number(old.frame[y][x] !== board.frame[y]?.[x]);
  const oldPoints = new Set(ms.map((m) => center(m.before).join(','))),
    newPoints = new Set(ms.map((m) => center(m.after).join(',')));
  const target = center(selected.after).join(',');
  receipts.push({
    actionIndex: index + 1,
    op: raw.id,
    phase: receipt.phase,
    actor: receipt.actor,
    from: receipt.from,
    to: receipt.to,
    area: selected.before.area,
    color: selected.before.palette_value,
    bbox: selected.before.bbox,
    otherMovers: ms.length - 1,
    changedPixels: changed,
    oldPositionsOccupiedAfter: [...oldPoints].filter((p) => newPoints.has(p)).length,
    distinctMovedOrigins: oldPoints.size,
    destinationWasOtherMovingObject: oldPoints.has(target),
    surface: surfaces(old.frame, board.frame, selected.before, selected.after),
    rigidity: geometry(ms),
    oldCenter: center(selected.before),
    newCenter: center(selected.after),
    movingSignatures: ms.map((x) => x.before.signature),
  });
}
const probeOps = new Set(receipts.map((r) => String(r.op)));
if (trajectory.digest('hex') !== previous.trajectory)
  throw Error('The independent engine replay departed from the published trajectory');
const ordinary = [...models]
  .map(([sig, g]) => ({
    sig,
    count: Object.entries(g.ops).reduce((n, [op, c]) => n + (probeOps.has(op) ? 0 : c), 0),
    ops: g.ops,
    area: g.area,
    color: g.color,
    positions: g.positions.size,
  }))
  .sort((a, b) => b.count - a.count);
const mode = (m) => [...m].sort((a, b) => b[1] - a[1])[0][0];
const typical = temporal.map(mode),
  border = new Map();
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
      const v = typical[y * W + x];
      border.set(v, (border.get(v) ?? 0) + 1);
    }
const voidColor = mode(border),
  labels = new Int32Array(W * H).fill(-1),
  regions = [];
for (let i = 0; i < labels.length; i++) {
  if (labels[i] !== -1 || typical[i] === voidColor) continue;
  const queue = [i],
    id = regions.length;
  labels[i] = id;
  let left = W,
    right = -1,
    top = H,
    bottom = -1;
  for (const j of queue) {
    const x = j % W,
      y = Math.floor(j / W);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const xx = x + dx,
        yy = y + dy,
        k = yy * W + xx;
      if (xx < 0 || xx >= W || yy < 0 || yy >= H || labels[k] !== -1 || typical[k] === voidColor) continue;
      labels[k] = id;
      queue.push(k);
    }
  }
  regions.push({ id, area: queue.length, bbox: [left, top, right, bottom] });
}
function region(p) {
  const i = labels[Math.round(p[1]) * W + Math.round(p[0])];
  return i >= 0 ? regions[i] : null;
}
const panel = [...regions].sort((a, b) => b.area - a.area)[0];
const [left, top, right, bottom] = panel.bbox,
  fillCounts = new Map();
for (let y = top; y <= bottom; y++)
  for (let x = left; x <= right; x++) {
    const v = typical[y * W + x];
    fillCounts.set(v, (fillCounts.get(v) ?? 0) + 1);
  }
const depths = [...fillCounts].sort((a, b) => b[1] - a[1]);
const drawing = [];
for (let y = top; y <= bottom; y++) {
  let start = null;
  for (let x = left; x <= right + 1; x++) {
    const on = x <= right && typical[y * W + x] !== depths[0][0] && typical[y * W + x] !== voidColor;
    if (on && start === null) start = x;
    else if (!on && start !== null) {
      drawing.push([start, y, x - start]);
      start = null;
    }
  }
}
if (process.argv[7])
  await writeFile(process.argv[7], JSON.stringify({ width: W, height: H, panel: panel.bbox, drawing }));
function graphicCluster(p, omit) {
  const i = Math.round(p[1]) * W + Math.round(p[0]),
    excluded = new Set([voidColor, ...omit]);
  if (excluded.has(typical[i])) return null;
  const visited = new Set([i]),
    queue = [i];
  let minX = W,
    maxX = -1,
    minY = H,
    maxY = -1;
  for (const j of queue) {
    const x = j % W,
      y = Math.floor(j / W);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ]) {
      const xx = x + dx,
        yy = y + dy,
        n = yy * W + xx;
      if (xx < left || xx > right || yy < top || yy > bottom || visited.has(n) || excluded.has(typical[n]))
        continue;
      visited.add(n);
      queue.push(n);
    }
  }
  return { id: Math.min(...queue), size: queue.length, box: [minX, minY, maxX, maxY] };
}
for (const r of receipts) {
  r.departureRegion = region(r.oldCenter);
  r.landingRegion = region(r.newCenter);
  r.visibleClusters = [1, 2].map((depth) => {
    const omit = depths.slice(0, depth).map((v) => v[0]);
    return { omit, from: graphicCluster(r.oldCenter, omit), to: graphicCluster(r.newCenter, omit) };
  });
  const links = models.get(r.actor).links.filter(([op]) => !probeOps.has(String(op)));
  function closure(start) {
    const q = [start],
      known = new Set(q);
    for (const point of q)
      for (const [, a, b] of links) {
        const to = a === point ? b : b === point ? a : null;
        if (to && !known.has(to)) {
          known.add(to);
          q.push(to);
        }
      }
    return known;
  }
  const a = closure(r.from),
    b = closure(r.to);
  r.fullOrdinaryPath = a.has(r.to);
  r.ordinaryPositionCounts = [a.size, b.size];
}
for (const r of receipts) {
  const model = models.get(r.actor);
  r.actorMovementByCommand = model.ops;
  r.leadingDirectionalShapeAlsoMoved = ordinary.length && r.movingSignatures.includes(ordinary[0].sig);
  delete r.movingSignatures;
}
const data = {
  initial: replay.initial,
  trajectory: replay.trajectory,
  identicalTrajectory: true,
  actions: replay.issued,
  modalBorderColor: voidColor,
  panelColors: depths,
  modalNonborderRegions: regions.sort((a, b) => b.area - a.area).slice(0, 12),
  leadingMovingShapes: ordinary.slice(0, 4),
  receipts,
};
await writeFile(destination, JSON.stringify(data, null, 2) + '\n');
console.log(
  JSON.stringify(
    receipts.map(
      ({
        actionIndex,
        from,
        to,
        op,
        area,
        otherMovers,
        surface,
        rigidity,
        actorMovementByCommand,
        leadingDirectionalShapeAlsoMoved,
      }) => ({
        actionIndex,
        from,
        to,
        op,
        area,
        otherMovers,
        surface,
        rigidity,
        actorMovementByCommand,
        leadingDirectionalShapeAlsoMoved,
      })
    )
  )
);
