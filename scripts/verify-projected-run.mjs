import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const [environment, file] = process.argv.slice(2);
const run = JSON.parse(readFileSync(file, 'utf8').trim());
if (!run.replayCommands || run.replayCommands.length !== run.issued || run.sic !== run.issued || run.resets)
  throw Error('Expected a complete SIC-only trajectory without external resets');
const { createGameDispatcher } = await import(
  pathToFileURL(join(resolve(environment), 'src/runtime/native-game-dispatcher.ts'))
);
const engine = createGameDispatcher(() => {
  throw Error('Unexpected backend');
});
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
let board = await engine.dispatch({ type: 'load', code: run.code, level: run.start });
if (board.level !== run.start && board.canSelectLevel)
  board = await engine.dispatch({ type: 'selectLevel', level: run.start });
if (
  hash(board.frame) !== run.initial ||
  board.level !== run.start ||
  board.levelsCompleted !== run.initialCompleted
)
  throw Error('Initial observation differs');
const events = new Map(
  run.preparation.filter((e) => e.projection || e.frontier || e.delayed).map((e) => [e.actionIndex, e])
);
const witnessed = new Map();
const states = new Set([run.initial.slice(0, 16)]);
const frontier = { routes: 0, newProbes: 0, arrivals: 0, continuations: 0, subsequentUses: 0 };
const openings = { proposed: 0, placements: 0, transported: 0, matchedControl: 0, subsequentUses: 0 };
const controlled = new Set();
const counts = { issued: 0, observed: 0, verifiedLanding: 0, verifiedContinuation: 0, refuted: 0 };
const cache = new Map();
const delayed = { issued: 0, preparedAccess: 0, exactPredictions: 0, followingMovements: 0 };
const commandKey = (cmd) => 'ACTION' + cmd.id + (cmd.id === 6 ? ':' + cmd.data.x + ',' + cmd.data.y : '');
async function partsAt(board, key, revision) {
  if (!cache.has(key)) {
    const o = await measureNativeObservation(
      {
        frame_rows: board.frame,
        frame_hash: key,
        level: board.level,
        levels_completed: board.levelsCompleted,
        state: board.state,
        available_action_refs: board.availableActionIds.map((v) => 'ACTION' + v),
      },
      revision
    );
    cache.set(key, o.entities);
  }
  return cache.get(key);
}
const needPositionHistory = run.preparation.some((e) => e.delayed || e.frontier?.place);
const location = (parts, role) =>
  parts?.find((e) => !e.identity_ambiguous && e.signature === role)?.position.join() ?? null;
for (const [i, cmd] of run.replayCommands.entries()) {
  if (hash(board.frame).slice(0, 16) !== cmd.from) throw Error('Divergent source at ' + i);
  const action = commandKey(cmd);
  if (needPositionHistory) await partsAt(board, cmd.from, i + 1);
  const input = [cmd.from, board.level, board.state, board.availableActionIds.join(','), action].join('/');
  const prior = witnessed.get(input) ?? new Set();
  const wasTried = prior.size > 0;
  const wasSeen = prior.has(cmd.to);
  prior.add(cmd.to);
  witnessed.set(input, prior);
  states.add(cmd.to);
  board = await engine.dispatch({
    type: 'action',
    actionId: cmd.id,
    ...(cmd.id === 6 ? { data: cmd.data } : {}),
  });
  if (hash(board.frame).slice(0, 16) !== cmd.to) throw Error('Divergent return at ' + i);
  const event = events.get(i + 1);
  if (!event) continue;
  const p = event.projection;
  if (p) counts.issued++;
  if (p && p.program[p.index] !== action) throw Error('Unbound experiment command at ' + i);
  if (event.result === 'official_completion') {
    if (board.levelsCompleted === run.initialCompleted && board.state !== 'WIN')
      throw Error('False claimed completion');
    continue;
  }
  const parts = await partsAt(board, cmd.to, i + 2);
  if (event.delayed) {
    const t = event.delayed,
      actual = location(parts, t.role),
      before = location(cache.get(cmd.from), t.role);
    const base = t.baseline[t.step],
      first = i - t.step - (t.follow ? 1 : 0);
    if (action !== (t.follow ?? base.op) || before !== t.before || actual !== t.after)
      throw Error('Delayed observation mismatch at ' + i);
    let lastControl = null;
    for (const step of t.baseline) {
      const at = i + step.ref - event.revision;
      if (at < 0 || at >= first) throw Error('Future control evidence at ' + i);
      const past = run.replayCommands[at];
      if (
        commandKey(past) !== step.op ||
        (lastControl && lastControl.to !== past.from) ||
        location(cache.get(past.from), t.role) !== step.from ||
        location(cache.get(past.to), t.role) !== step.to
      )
        throw Error('Delayed baseline mismatch at ' + i);
      lastControl = past;
    }
    if (t.preparedImmediately) {
      const prep = run.replayCommands[first - 1],
        witness = run.replayCommands[i + t.prepRef - event.revision];
      if (
        !prep ||
        !witness ||
        commandKey(prep) !== t.prep ||
        prep.from !== witness.from ||
        prep.to !== witness.to ||
        prep.from !== run.replayCommands[i + t.baseline[0].ref - event.revision].from
      )
        throw Error('Mismatched preparation at ' + i);
    }
    if (
      event.result === 'delayed_access_observed' &&
      (!t.preparedImmediately || before !== base.from || actual === before || actual === base.to)
    )
      throw Error('False access claim at ' + i);
    if (
      t.predictedMatched === true &&
      (t.follow || t.step !== t.baseline.length - 1 || actual !== t.predicted)
    )
      throw Error('False forecast at ' + i);
    delayed.issued++;
    delayed.preparedAccess += Number(event.result === 'delayed_access_observed');
    delayed.exactPredictions += Number(t.predictedMatched === true);
    delayed.followingMovements += Number(event.result === 'delayed_followup_moved');
    continue;
  }
  if (event.frontier) {
    const f = event.frontier;
    if (event.phase === 'frontierRoute' && event.result === 'route_verified') {
      if (!wasSeen) throw Error('Claimed route lacks an earlier public transition at ' + i);
      frontier.routes++;
    }
    if (event.phase === 'frontierProbe') {
      if (action !== f.probe || wasTried) throw Error('Claimed new probe is not fresh at ' + i);
      frontier.newProbes++;
    }
    const opening = f.place?.opening;
    if (opening && event.phase === 'frontierProbe') openings.proposed++;
    if (['arrival_verified', 'continuation_verified', 'subsequent_use_verified'].includes(event.result)) {
      const expected =
        event.phase === 'frontierConsequence' ? f.after : event.phase === 'frontierUse' ? f.use : f.arrival;
      if (action !== expected.op || location(parts, expected.role) !== expected.to.join())
        throw Error('False spatial prediction at ' + i);
      if (f.place && location(cache.get(cmd.from), expected.role) !== expected.from.join())
        throw Error('False origin of a spatial prediction at ' + i);
      if (event.phase === 'frontierConsequence') {
        frontier.subsequentUses++;
        if (controlled.has(i - 1)) openings.subsequentUses++;
      } else if (event.phase === 'frontierUse') {
        frontier.continuations++;
        if (opening) {
          const prep = run.replayCommands[i - 1],
            prior = events.get(i);
          if (
            prior?.result !== 'arrival_verified' ||
            prior.frontier?.place?.opening?.traveler !== opening.traveler ||
            !prep ||
            commandKey(prep) !== f.probe ||
            location(cache.get(prep.from), expected.role) !== expected.from.join() ||
            location(cache.get(prep.to), opening.mover) !== opening.placement.join()
          )
            throw Error('Unmatched placement for transfer at ' + i);
          openings.transported++;
          if (opening.controlRef !== null) {
            const id = i + opening.controlRef - event.revision,
              bare = run.replayCommands[id];
            if (
              id < 0 ||
              id >= i - 1 ||
              bare.from !== prep.from ||
              commandKey(bare) !== action ||
              location(cache.get(bare.to), expected.role) !== opening.without.join() ||
              opening.without.join() === expected.to.join()
            )
              throw Error('Unreproducible bare control at ' + i);
            controlled.add(i);
            openings.matchedControl++;
          }
        }
      } else {
        frontier.arrivals++;
        if (opening) openings.placements++;
      }
    }
    continue;
  }
  const positions = p.roles.map(
    (id) => parts.find((e) => !e.identity_ambiguous && e.signature === id)?.position
  );
  const observed = positions.every(Boolean) ? positions : null;
  if (JSON.stringify(p.observed) !== JSON.stringify(observed))
    throw Error('Unreproducible pose observation at ' + i);
  const match = JSON.stringify(p.expected) === JSON.stringify(observed);
  if (['placement_verified', 'arrival_verified', 'continuation_verified'].includes(event.result) && !match)
    throw Error('False spatial match at ' + i);
  counts.observed += Number(!!observed);
  counts.verifiedLanding += Number(event.result === 'arrival_verified');
  counts.verifiedContinuation += Number(event.result === 'continuation_verified');
  counts.refuted += Number(event.result === 'projection_refuted');
}
const won = board.levelsCompleted > run.initialCompleted || board.level > run.start || board.state === 'WIN';
if (won !== run.levels[0].won) throw Error('Official replay differs');
console.log(
  JSON.stringify({
    code: run.code,
    start: run.start,
    initial: run.initial,
    actions: run.issued,
    levelsCompleted: board.levelsCompleted,
    finalLevel: board.level,
    state: board.state,
    won,
    distinctImages: states.size,
    projections: counts,
    frontier,
    openings,
    delayed,
  })
);
