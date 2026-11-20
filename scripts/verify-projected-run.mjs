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
  run.preparation
    .filter((e) => e.projection || e.frontier || e.delayed || e.condition)
    .map((e) => [e.actionIndex, e])
);
const witnessed = new Map();
const states = new Set([run.initial.slice(0, 16)]);
const frontier = { routes: 0, newProbes: 0, arrivals: 0, continuations: 0, subsequentUses: 0 };
const openings = { proposed: 0, placements: 0, transported: 0, matchedControl: 0, subsequentUses: 0 };
const alternatives = { tried: 0, moved: 0, exact: 0, matchedPreparation: 0 };
const conditions = {
  selected: 0,
  completedPlacements: 0,
  observedPreparations: 0,
  tested: 0,
  moved: 0,
  exact: 0,
  fixedOriginExact: 0,
  used: 0,
  official: 0,
  reused: 0,
  reuseUsed: 0,
};
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
const needPositionHistory = run.preparation.some((e) => e.delayed || e.frontier?.place || e.condition);
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
  if (event.condition) {
    const { plan, index, actual, held } = event.condition,
      n = plan.preparation.length,
      first = i - index;
    const start = plan.alreadyPlaced ?? 0,
      decision = first + start;
    if (first < 0 || decision > i || n < 1 || index < start || index > n + 1)
      throw Error('Invalid conditional episode at ' + i);
    const expected = [...plan.preparation, plan.trigger, plan.use][index];
    if (!expected || action !== expected.op) throw Error('Unbound conditional step at ' + i);
    const here = await partsAt(board, cmd.to, i + 2);
    const at = (key, id) => location(cache.get(key), id),
      actor = plan.actor,
      partner = plan.partner,
      origin = plan.origin.join();
    if (actual !== location(here, expected.role)) throw Error('Incorrect conditional position at ' + i);
    const pastAt = (ref) => {
      const at = i + ref - event.revision;
      if (at < 0 || at >= decision) throw Error('Future conditional evidence at ' + i);
      return run.replayCommands[at];
    };
    const bare = pastAt(plan.without),
      initial = run.replayCommands[first].from;
    if (
      bare.from !== initial ||
      commandKey(bare) !== plan.trigger.op ||
      at(bare.from, actor) !== origin ||
      at(bare.to, actor) !== origin
    )
      throw Error('Unmatched inactive control at ' + i);
    const known = pastAt(plan.trigger.ref);
    if (
      commandKey(known) !== plan.trigger.op ||
      !at(known.from, actor) ||
      !at(known.to, actor) ||
      at(known.from, actor) === at(known.to, actor)
    )
      throw Error('No active contrast at ' + i);
    if (index === start) {
      conditions.selected++;
      if (start) conditions.observedPreparations++;
      const count = (a, b) =>
        plan.rules.filter((r) => {
          const value = a[r.axis] - b[r.axis];
          return ((r.signOnly ? Math.sign(value) : value) === r.value) === r.onMatch;
        }).length;
      const initialPeer = at(initial, partner);
      if (
        !initialPeer ||
        !plan.rules.length ||
        count(plan.origin, initialPeer.split(',').map(Number)) !== 0 ||
        count(plan.trigger.from, plan.preparation.at(-1).to) !== plan.agreement[0] ||
        plan.agreement[1] !== plan.rules.length
      )
        throw Error('Invalid spatial separation at ' + i);
      if (plan.reuseRef) {
        const from = i + plan.reuseRef - event.revision;
        const old = events.get(from + 1);
        if (
          from < 0 ||
          from >= decision ||
          old?.result !== 'condition_activated' ||
          old.condition?.plan.actor !== actor ||
          old.condition.plan.partner !== partner ||
          old.condition.plan.trigger.to.join() !== plan.trigger.to.join()
        )
          throw Error('Missing verified conditional recipe at ' + i);
        conditions.reused++;
      }
    }
    for (let j = 0; j < Math.min(index, n); j++) {
      const past = run.replayCommands[first + j],
        setup = plan.preparation[j];
      if (
        commandKey(past) !== setup.op ||
        at(past.from, actor) !== setup.actorFrom.join() ||
        at(past.to, actor) !== setup.actorTo.join() ||
        at(past.from, partner) !== setup.from.join() ||
        at(past.to, partner) !== setup.to.join()
      )
        throw Error('Unreproduced preparation at ' + i);
    }
    const before = at(cmd.from, expected.role),
      match = before === expected.from.join() && actual === expected.to.join();
    const stationary =
      index >= n ||
      (at(cmd.from, actor) === expected.actorFrom.join() &&
        location(here, actor) === expected.actorTo.join());
    if (held !== stationary) throw Error('Incorrect controlled role at ' + i);
    if (index === n) {
      if (at(cmd.from, partner) !== plan.preparation.at(-1).to.join() || before !== plan.trigger.from.join())
        throw Error('Trigger origin differs at ' + i);
      conditions.tested++;
      conditions.moved += Number(
        actual !== null && actual !== before && event.result !== 'official_completion'
      );
    }
    if (index === n + 1) {
      const prior = events.get(i);
      if (prior?.condition?.plan?.key !== plan.key || prior?.result !== 'condition_activated')
        throw Error('Unconfirmed access before use at ' + i);
    }
    if (event.result === 'official_completion') {
      if (board.levelsCompleted === run.initialCompleted && board.state !== 'WIN')
        throw Error('False conditional victory');
      conditions.official++;
      continue;
    }
    if (event.result === 'condition_terminal') {
      if (board.state === 'NOT_FINISHED') throw Error('False terminal condition');
      continue;
    }
    const want =
      match && stationary
        ? index < n
          ? 'condition_placed'
          : index === n
            ? 'condition_activated'
            : 'condition_used'
        : 'condition_refuted';
    if (event.result !== want) throw Error('False conditional receipt at ' + i);
    conditions.completedPlacements += Number(want === 'condition_placed' && index === n - 1);
    conditions.exact += Number(want === 'condition_activated');
    conditions.used += Number(want === 'condition_used');
    conditions.fixedOriginExact += Number(want === 'condition_activated' && before === origin);
    conditions.reuseUsed += Number(want === 'condition_used' && !!plan.reuseRef);
    continue;
  }
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
    const expected =
      event.phase === 'frontierProbe'
        ? f.arrival
        : event.phase === 'frontierUse'
          ? f.use
          : event.phase === 'frontierConsequence'
            ? f.after
            : null;
    if (expected?.alternative) {
      const a = expected.alternative,
        role = expected.role,
        origin = expected.from.join(),
        destination = expected.to.join();
      const prior = (ref) => {
        const at = i + ref - event.revision;
        if (!Number.isInteger(at) || at < 0 || at >= i) throw Error('Invalid alternative evidence at ' + i);
        return run.replayCommands[at];
      };
      const donor = prior(expected.ref),
        inactive = prior(a.inactiveRef);
      if (
        a.observedWith === action ||
        commandKey(donor) !== a.observedWith ||
        commandKey(inactive) !== action ||
        location(cache.get(donor.from), role) !== origin ||
        location(cache.get(donor.to), role) !== destination ||
        location(cache.get(inactive.from), role) !== origin ||
        location(cache.get(inactive.to), role) !== origin
      )
        throw Error('Unreproducible alternative at ' + i);
      alternatives.tried++;
      const actual = location(parts, role);
      if (location(cache.get(cmd.from), role) === origin && actual && actual !== origin) {
        alternatives.moved++;
        if (actual === destination) alternatives.exact++;
      }
      if (a.preparationRef !== null) {
        const setup = prior(a.preparationRef);
        if (
          setup.from !== inactive.from ||
          setup.to !== cmd.from ||
          setup.from === setup.to ||
          location(cache.get(setup.from), role) !== origin ||
          location(cache.get(setup.to), role) !== origin
        )
          throw Error('Unreproducible preparation for alternative at ' + i);
        if (actual === destination) alternatives.matchedPreparation++;
      }
    }
    if (['arrival_verified', 'continuation_verified', 'subsequent_use_verified'].includes(event.result)) {
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
    alternatives,
    conditions,
    delayed,
  })
);
