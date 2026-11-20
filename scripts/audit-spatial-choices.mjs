// Evaluate public forecasts on matched forks after a run. No solver code imports this tool.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const [environment, file, output, scope = 'registered'] = process.argv.slice(2);
const r = JSON.parse((await readFile(file, 'utf8')).trim());
if (r.start !== r.finish || r.sic !== r.issued) throw Error('Expected single level and full SIC authority');
const source = GAME_CATALOG.some((g) => g.code === r.code);
const engine = source
  ? await sourceBackend(resolve(environment))
  : (
      await import(pathToFileURL(join(resolve(environment), 'src/runtime/native-game-dispatcher.ts')))
    ).createGameDispatcher(() => {
      throw Error('Unexpected backend');
    });
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const sequence = r.steps?.map((s) => ({ id: s.a, data: s.data, from: s.from, to: s.to })) ?? r.replayCommands;
if (sequence.length !== r.issued) throw Error('Incomplete action sequence');
const opcode = (c) => (c.id === 6 ? 'ACTION6:' + c.data.x + ',' + c.data.y : 'ACTION' + c.id);
async function step(op) {
  const [name, xy] = op.split(':'),
    [x, y] = xy?.split(',').map(Number) ?? [];
  return engine.dispatch({
    type: 'action',
    actionId: Number(name.slice(6)),
    ...(xy ? { data: { x, y } } : {}),
  });
}
const observed = new Map();
async function measure(b) {
  const id = hash(b.frame);
  if (!observed.has(id)) {
    const o = await measureNativeObservation(
      {
        frame_rows: b.frame,
        frame_hash: id,
        level: b.level,
        levels_completed: b.levelsCompleted,
        state: b.state,
        available_action_refs: b.availableActionIds.map((i) => 'ACTION' + i),
      },
      1
    );
    observed.set(
      id,
      Object.fromEntries(
        o.entities
          .filter((e) => !e.identity_ambiguous)
          .map((e) => [
            e.signature,
            {
              p: e.position,
              center: [(e.bbox[2] - e.bbox[0]) >> 1, (e.bbox[3] - e.bbox[1]) >> 1],
              area: e.area,
            },
          ])
      )
    );
  }
  return observed.get(id);
}
async function rewind(n) {
  let b = await engine.dispatch({ type: 'load', code: r.code, level: r.start });
  if (b.level !== r.start && b.canSelectLevel)
    b = await engine.dispatch({ type: 'selectLevel', level: r.start });
  if (hash(b.frame) !== r.initial.slice(0, 16)) throw Error('Initial state mismatch');
  for (let i = 0; i < n; i++) {
    const s = sequence[i];
    if (hash(b.frame) !== s.from) throw Error('Prefix differs ' + i);
    b = await step(opcode(s));
    if (hash(b.frame) !== s.to) throw Error('Return differs ' + i);
  }
  return b;
}
const eq = (a, b) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];
function card(a) {
  return {
    actor: a.actor,
    anchor: a.anchor,
    op: a.trigger,
    launch: a.launch,
    anchorAt: a.placed,
    destination: a.predicted,
    setup: a.setup,
    interest: a.interest,
    score: a.score,
    regionChange: a.regionChange,
  };
}
async function fork(n, c) {
  let b = await rewind(n);
  const initial = await measure(b),
    state = b.state,
    level = b.level,
    baseHash = hash(b.frame);
  const terminal = (v) => v.state !== state || v.level !== level;
  const bareBoard = await step(c.op),
    bare = terminal(bareBoard) ? null : ((await measure(bareBoard))[c.actor]?.p ?? null);
  b = await rewind(n);
  let stayed = !!initial[c.actor];
  for (const op of c.setup) {
    b = await step(op);
    if (terminal(b)) return { setup: false, hit: false, terminal: true };
    stayed &&= !!eq(initial[c.actor]?.p, (await measure(b))[c.actor]?.p);
  }
  const before = await measure(b),
    placed = !!eq(before[c.actor]?.p, c.launch) && (!c.anchor || !!eq(before[c.anchor]?.p, c.anchorAt));
  const triggered = await step(c.op),
    after = terminal(triggered) ? {} : await measure(triggered),
    actual = after[c.actor]?.p ?? null;
  const bareParts = terminal(bareBoard) ? {} : await measure(bareBoard);
  const enabled = [];
  for (const [actor, part] of Object.entries(before)) {
    if (
      initial[actor] &&
      bareParts[actor] &&
      after[actor] &&
      eq(part.p, initial[actor].p) &&
      eq(initial[actor].p, bareParts[actor].p) &&
      !eq(part.p, after[actor].p)
    )
      enabled.push({ actor, from: part.p, to: after[actor].p });
  }
  const contrast = {
    before: initial[c.actor]?.p ?? null,
    atTrigger: before[c.actor]?.p ?? null,
    wantedMarker: c.anchorAt,
    actualMarker: before[c.anchor]?.p ?? null,
    bareChanged: baseHash !== hash(bareBoard.frame),
    preparedChanged: hash(b.frame) !== hash(triggered.frame),
    enabled,
  };
  const hit = placed && !!eq(actual, c.destination),
    next = c.interest?.productiveNext;
  let continuation = null;
  if (hit && next) {
    const end = await step(next.op);
    continuation = !terminal(end) && !!eq((await measure(end))[c.actor]?.p, next.to);
  }
  return {
    setup: placed,
    contrast,
    hit,
    actual,
    bare,
    continuation,
    origin: initial[c.actor]?.p ?? null,
    actorStayed: stayed,
    markerMoved:
      !!c.anchor && !!initial[c.anchor] && !!before[c.anchor] && !eq(initial[c.anchor].p, before[c.anchor].p),
    sameOriginDifferentLanding: hit && stayed && !!bare && !eq(bare, actual),
    center: before[c.actor]?.center ?? null,
    terminal: terminal(triggered),
    won: triggered.levelsCompleted > b.levelsCompleted,
  };
}
const log = r.preparation.filter((e) => e.access),
  trials = [],
  decisions = [];
for (const e of log.filter((e) => e.phase === 'accessTrigger')) {
  const c = card(e.access),
    start = e.actionIndex - 1 - c.setup.length;
  if (start < 0 || c.setup.some((op, i) => opcode(sequence[start + i]) !== op))
    throw Error('Noncontiguous setup');
  const result = await fork(start, c);
  if ((e.result === 'predicted_landing_verified') !== result.hit && e.result !== 'official_completion')
    throw Error('Online outcome differs ' + e.actionIndex);
  trials.push({ action: e.actionIndex, kind: e.access.kind, card: c, result });
}
for (const e of log
  .filter(
    (e) =>
      e.phase !== 'accessContinue' && e.access.step === 0 && (scope === 'all' || e.access.alternatives.length)
  )
  .slice(0, scope === 'all' ? Infinity : 12)) {
  const choices = [card(e.access), ...e.access.alternatives],
    evaluated = [];
  for (const c of choices)
    evaluated.push({
      destination: c.destination,
      ...(scope === 'all' ? { setupCommands: c.setup, trigger: c.op, actor: c.actor, anchor: c.anchor } : {}),
      score: c.score,
      interest: c.interest,
      ...(await fork(e.actionIndex - 1, c)),
    });
  decisions.push({ action: e.actionIndex, choices: evaluated });
}
await writeFile(output, JSON.stringify({ game: r.code, level: r.start, trials, decisions }));
console.log(
  JSON.stringify({
    trials: trials.length,
    hits: trials.filter((t) => t.result.hit).length,
    contrasts: trials.filter((t) => t.result.sameOriginDifferentLanding && t.result.markerMoved).length,
    decisions: decisions.length,
  })
);
