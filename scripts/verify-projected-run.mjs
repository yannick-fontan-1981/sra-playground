import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay } from './sic-study-source-replay.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import {wordAudit} from './verify-territorial-words.mjs';
import {territoryAudit} from './verify-native-territory.mjs';
import {activationAudit} from './verify-native-activation.mjs';
import { inverseFrameAudit } from './verify-native-inverse-frames.mjs';
import { contextAudit } from './verify-context-events.mjs';
import { siteShape } from '../src/sic/site-operations.ts';

const [environment, file, sourceCode] = process.argv.slice(2);
const recorded = readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
const selected = sourceCode ? recorded.filter((r) => r.code === sourceCode) : recorded;
if (selected.length !== 1 || (sourceCode && !GAME_CATALOG.some((g) => g.code === sourceCode)))
  throw Error('Expected one matching run');
const run = selected[0];
if (!run.replayCommands || run.replayCommands.length !== run.issued || run.sic !== run.issued || run.resets)
  throw Error('Expected a complete SIC-only trajectory without external resets');
const engine = sourceCode
  ? await sourceBackend(resolve(environment))
  : (
      await import(pathToFileURL(join(resolve(environment), 'src/runtime/native-game-dispatcher.ts')))
    ).createGameDispatcher(() => {
      throw Error('Unexpected backend');
    });
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const openBoard = async () => sourceCode
  ? sourceReplay(
      engine,
      JSON.parse(
        readFileSync(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
      ),
      run
    ).restore(0)
  : await engine.dispatch({ type: 'load', code: run.code, level: run.start });
let board=await openBoard();
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
    .filter((e) => e.projection || e.frontier || e.delayed || e.condition || e.transfer || e.exchange || e.instrument || e.transport || e.retained || e.frame || e.activation || e.territorial)
    .map((e) => [e.actionIndex, e])
);
const witnessed = new Map();
const states = new Set([run.initial.slice(0, 16)]);
const frontier = { routes: 0, newProbes: 0, arrivals: 0, continuations: 0, subsequentUses: 0 };
const repertoires = {
  calibrations: 0,
  calibrationChanged: 0,
  probes: 0,
  measurable: 0,
  changed: 0,
  newMotion: 0,
  revised: 0,
  used: 0,
};
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
  boardPrograms: 0,
  boardTested: 0,
  boardExact: 0,
  boardUsed: 0,
  boardNoRelativeExact: 0,
  boardNoRelativeUsed: 0,
  boardSameOffsetExact: 0,
  boardSameOffsetUsed: 0,
  reconsidered: 0,
  reconsideredExact: 0,
  reconsideredUsed: 0,
  reuseUsed: 0,
};
const controlled = new Set();
const counts = { issued: 0, observed: 0, verifiedLanding: 0, verifiedContinuation: 0, refuted: 0 };
const cache = new Map();
const delayed = { issued: 0, preparedAccess: 0, exactPredictions: 0, followingMovements: 0 };
const exchanges = { plans:0, placements:0, triggers:0, arrivals:0, uses:0, exactUses:0, official:0, destinations: new Set(), exclusionUses:0 };
const transfers = { issued:0, preparations:0, verifiedPreparations:0, triggers:0, exact:0, uses:0, exactUses:0, official:0 };
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
const needPositionHistory = run.preparation.some(
  (e) => e.delayed || e.frontier?.place || e.frontier?.calibration || e.frontier?.repertoire || e.condition || e.transfer || e.exchange || e.instrument || e.transport || e.retained || e.frame || e.activation || e.territorial
);
const location = (parts, role) =>
  parts?.find((e) => !e.identity_ambiguous && e.signature === role)?.position.join() ?? null;
const audit=contextAudit(run,hash,partsAt,commandKey);
const frames=inverseFrameAudit(run,hash,partsAt,cache,commandKey);
const words=wordAudit(run,partsAt,cache,commandKey,hash);
const territories=territoryAudit(run,hash,partsAt,cache,commandKey);
const activations=activationAudit(run,hash,partsAt,cache,commandKey);
for (const [i, cmd] of run.replayCommands.entries()) {
  if (hash(board.frame).slice(0, 16) !== cmd.from) throw Error('Divergent source at ' + i);
  const action = commandKey(cmd);
  const priorState = board.state;
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
  if ((cmd.territorySeal&&!event?.territorial)||(cmd.activationSeal&&!event?.activation)||(cmd.frameSeal&&!event?.frame)||(cmd.retainedSeal&&!event?.retained)||(cmd.transportSeal&&!event?.transport)||(cmd.siteSeal&&!event?.instrument))throw Error('Missing intervention receipt at '+i);
  if (!event) continue;
  if(event.territorial){await territories.record(event,cmd,i,board,priorState);await words.record(event,i,cmd,board,priorState);continue;}
  if(event.activation){await activations.record(event,cmd,i,board);continue;}
  if (event.frame){await frames.record(event,cmd,i,board);continue;}
  if (event.retained){audit.retainedEvent(event,cmd,i,board);continue;}
  if (event.transport||event.instrument){await audit.check(event,cmd,i,cache.get(cmd.from),board);continue;}
  if (event.exchange) {
    const v = event.exchange, step = v.steps[v.index], first = i-v.index;
    const seal = hash([v.roles,v.refs,v.steps,v.alternatives,...(v.aims ? [v.aims] : [])]);
    const contents = x => JSON.stringify([x.roles.map(r=>[r.signature,r.fixed]),x.refs,
      x.steps.map(s=>[s.kind,s.op,s.before,s.after]),x.alternatives.map(t=>[t.placement,t.arrival,t.next]),(x.aims??[]).map(a=>[a.member,a.feature,a.at,a.gap,a.directGap,a.value])]);
    const start = events.get(first+1)?.exchange;
    if (first<0 || !step || step.op!==action || seal!==cmd.forecastSeal || !start || start.index!==0 ||
        contents(start)!==contents(v) || (v.index && events.get(i)?.exchange?.index!==v.index-1))
      throw Error('Exchange forecast missing before its first action at '+i);
    function layout(parts) {
      const positions = v.roles.map(r => {
        const group = parts.filter(e=>e.signature===r.signature).map(e=>e.position.join());
        const left = group.filter(p=>!r.fixed.includes(p));
        return group.length===r.fixed.length+1 && left.length===1 && r.fixed.every(p=>group.includes(p))
          ? left[0].split(',').map(Number) : null;
      });
      return positions.every(Boolean) ? positions : null;
    }
    const eq = (a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const p = layout(cache.get(cmd.from)), q = layout(await partsAt(board,cmd.to,i+2));
    const boundary = board.levelsCompleted>run.initialCompleted || board.state==='WIN';
    const exact = !boundary && board.state===priorState && eq(step.after,q);
    if (!eq(p,step.before) || !eq(q,v.observed) || v.won!==boundary ||
        v.exact!==exact || event.result!=='placed_'+step.kind+(boundary?'_completion':exact?'_verified':'_refuted'))
      throw Error('Incorrect exchange receipt at '+i);
    const trigger = v.steps.at(-2);
    if (v.steps.length<3 || v.steps[0].kind!=='prepare' || trigger.kind!=='exchange' ||
        v.steps.at(-1).kind!=='use' || !eq(trigger.before,[trigger.after[1],trigger.after[0]]) ||
        v.steps.some((s,j)=>j>0 && !eq(s.before,v.steps[j-1].after)))
      throw Error('Invalid composed exchange at '+i);
    if (!v.index) {
      const witnesses = v.refs.map(ref=>{
        const j=i+ref-event.revision;
        if (j<0 || j>=first) throw Error('Future exchange witness');
        const src=run.replayCommands[j];
        return {before:layout(cache.get(src.from)),after:layout(cache.get(src.to)),cmd:commandKey(src)};
      });
      if (!witnesses.some(s=>s.before && s.after && eq(s.before,[s.after[1],s.after[0]]) &&
          (s.cmd===trigger.op || (s.cmd.startsWith('ACTION6:') && trigger.op.startsWith('ACTION6:')))))
        throw Error('Missing reciprocal evidence at '+i);
      const delta = s => s.after.map((p,j)=>p.map((k,i)=>k-s.before[j][i]));
      if (v.steps.filter(s=>s.kind!=='exchange').some(s=>!witnesses.some(w=>w.cmd===s.op && w.before && w.after && eq(delta(w),delta(s)))))
        throw Error('Missing translation evidence at '+i);
      exchanges.plans++;
    }
    exchanges.placements+=Number(step.kind==='prepare' && exact);
    exchanges.triggers+=Number(step.kind==='exchange');
    exchanges.arrivals+=Number(step.kind==='exchange' && exact);
    exchanges.uses+=Number(step.kind==='use');
    exchanges.exactUses+=Number(step.kind==='use' && exact);
    exchanges.exclusionUses+=Number(step.kind==='use' && exact && v.roles.some(r=>r.fixed.length));
    if(step.kind==='exchange' && exact) exchanges.destinations.add(JSON.stringify([v.roles,step.after]));
    exchanges.official+=Number(boundary);
    continue;
  }
  if(event.transfer){
    const v=event.transfer, before=cache.get(cmd.from), after=await partsAt(board,cmd.to,i+2);
    const present=(es,p)=>es.some(e=>e.position.join()===p.join()&&siteShape(e)===v.shape);
    if(action!==v.op || location(before,v.role)!==v.from.join())throw Error('Unbound transfer prediction at '+i);
    if(v.stage!=='prepare' && !v.sites.every(p=>present(before,p)))throw Error('Missing transfer site at '+i);
    const actual=location(after,v.role),geometry=v.stage!=='prepare'||v.sites.every(p=>present(after,p));
    if((v.actual?.join()??null)!==actual||v.geometry!==geometry||v.matched!==(geometry&&actual===v.to.join()))
      throw Error('Transfer result differs at '+i);
    const boundary=board.levelsCompleted>run.initialCompleted||board.state==='WIN';
    if(v.official!==boundary)throw Error('False transfer completion at '+i);
    transfers.issued++;
    transfers.preparations+=Number(v.stage==='prepare');transfers.verifiedPreparations+=Number(v.stage==='prepare'&&v.matched);
    transfers.triggers+=Number(v.stage==='cross');transfers.exact+=Number(v.stage==='cross'&&v.matched);
    transfers.uses+=Number(v.stage==='use');transfers.exactUses+=Number(v.stage==='use'&&v.matched);transfers.official+=Number(boundary);
    continue;
  }
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
      if (plan.reconsideredRef) {
        const source = i + plan.reconsideredRef - event.revision;
        const rejected = events.get(source + 1);
        if (
          source !== i - 1 ||
          !start ||
          rejected?.result !== 'condition_refuted' ||
          rejected.condition?.plan.actor !== actor ||
          rejected.condition?.plan.partner !== partner ||
          rejected.condition?.plan.trigger.op !== plan.trigger.op ||
          rejected.condition.index >= rejected.condition.plan.preparation.length
        )
          throw Error('Unmatched reconsidered placement at ' + i);
        conditions.reconsidered++;
      }
      if (start) conditions.observedPreparations++;
      const count = (a, b) =>
        plan.rules.filter((r) => {
          const value = a[r.axis] - b[r.axis];
          return ((r.signOnly ? Math.sign(value) : value) === r.value) === r.onMatch;
        }).length;
      const initialPeer = at(initial, partner);
      if (plan.frame) {
        if (!initialPeer || !plan.frame.rules.length || !plan.frame.rules.some((r) => r.to === null))
          throw Error('Unbound board rule');
        const accepts = (a, p) =>
          plan.frame.rules.every((r) => {
            if ((r.from !== null && r.from !== partner) || (r.to !== null && r.to !== partner))
              throw Error('Unknown board reference');
            const value = (r.from === null ? a : p)[r.axis] - (r.to === null ? 0 : p[r.axis]);
            return (r.low === null || value >= r.low) && (r.high === null || value <= r.high);
          });
        if (
          accepts(plan.origin, initialPeer.split(',').map(Number)) ||
          !accepts(plan.trigger.from, plan.preparation.at(-1).to) ||
          plan.agreement.some((n) => n !== plan.frame.rules.length)
        )
          throw Error('Invalid world-coordinate prediction at ' + i);
        conditions.boardPrograms++;
      } else if (
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
      conditions.boardTested += Number(!!plan.frame);
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
    conditions.boardExact += Number(want === 'condition_activated' && !!plan.frame);
    conditions.boardUsed += Number(want === 'condition_used' && !!plan.frame);
    if (plan.frame && (want === 'condition_activated' || want === 'condition_used')) {
      const initialPeer = at(initial, partner).split(',').map(Number);
      const delta = (a, b) => a.map((v, j) => v - b[j]);
      const oldOffset = delta(plan.origin, initialPeer);
      const newOffset = delta(plan.trigger.from, plan.preparation.at(-1).to);
      const votes = (ds) =>
        plan.rules.filter(
          (r) => ((r.signOnly ? Math.sign(ds[r.axis]) : ds[r.axis]) === r.value) === r.onMatch
        ).length;
      const qualified =
        plan.rules.length > 0 && votes(oldOffset) === 0 && votes(newOffset) * 2 > plan.rules.length;
      const continuation = want === 'condition_used';
      if (!qualified) conditions[continuation ? 'boardNoRelativeUsed' : 'boardNoRelativeExact']++;
      if (oldOffset.join() === newOffset.join())
        conditions[continuation ? 'boardSameOffsetUsed' : 'boardSameOffsetExact']++;
    }
    conditions.reconsideredExact += Number(want === 'condition_activated' && !!plan.reconsideredRef);
    conditions.reconsideredUsed += Number(want === 'condition_used' && !!plan.reconsideredRef);
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
    const experiment = f.repertoire ?? f.calibration;
    if (experiment && event.phase === 'frontierProbe') {
      const prior = (ref) => {
        const n = i + ref - event.revision;
        if (!Number.isInteger(n) || n < 0 || n >= i) throw Error('Invalid control reference at ' + i);
        return run.replayCommands[n];
      };
      const positions = (past, role) => [
        location(cache.get(past.from), role),
        location(cache.get(past.to), role),
      ];
      const setup = prior(experiment.setup.ref),
        direct = prior((f.repertoire ? experiment.bare : experiment.direct).ref);
      if (
        setup.from !== direct.from ||
        setup.to !== cmd.from ||
        commandKey(setup) !== experiment.setup.op ||
        commandKey(direct) !== action ||
        positions(setup, experiment.setup.moved).join('/') !==
          [experiment.setup.from, experiment.setup.to].join('/') ||
        experiment.setup.from.join() === experiment.setup.to.join() ||
        positions(setup, experiment.actor).join('/') !== [experiment.origin, experiment.prepared].join('/') ||
        positions(direct, experiment.actor).join('/') !==
          [experiment.origin, (f.repertoire ? experiment.bare : experiment.direct).to].join('/')
      )
        throw Error('Invalid bare or prepared control at ' + i);
      const actual = location(await partsAt(board, cmd.to, i + 2), experiment.actor);
      const relative = (a, b) => a.map((v, i) => v - b[i]).join();
      if (f.calibration) {
        repertoires.calibrations++;
        if (
          actual &&
          relative(actual.split(',').map(Number), experiment.prepared) !==
            relative(experiment.direct.to, experiment.origin)
        )
          repertoires.calibrationChanged++;
      } else {
        const d = experiment.calibration,
          first = prior(d.bareRef),
          second = prior(d.preparedRef);
        if (
          d.op === action ||
          first.from !== setup.from ||
          second.from !== setup.to ||
          commandKey(first) !== d.op ||
          commandKey(second) !== d.op ||
          positions(first, experiment.actor).join('/') !== [experiment.origin, d.before].join('/') ||
          positions(second, experiment.actor).join('/') !== [experiment.prepared, d.after].join('/') ||
          relative(d.before, experiment.origin) !== d.bareEffect.join() ||
          relative(d.after, experiment.prepared) !== d.preparedEffect.join() ||
          d.bareEffect.join() === d.preparedEffect.join()
        )
          throw Error('Invalid calibration witness at ' + i);
        repertoires.probes++;
        if (f.controlled) {
          const moved = actual !== experiment.prepared.join(),
            changed =
              actual &&
              relative(actual.split(',').map(Number), experiment.prepared) !==
                relative(experiment.bare.to, experiment.origin);
          if (
            !actual ||
            actual !== f.controlled.actual.join() ||
            changed !== f.controlled.changed ||
            moved !== f.controlled.moved
          )
            throw Error('Incorrect control response at ' + i);
          repertoires.measurable++;
          repertoires.changed += Number(changed);
          repertoires.newMotion += Number(changed && moved);
          if (
            f.revisedUse &&
            (!changed ||
              !moved ||
              f.revisedUse.from.join() !== actual ||
              f.revisedUse.role !== experiment.actor)
          )
            throw Error('Revision without measured landing at ' + i);
          repertoires.revised += Number(!!f.revisedUse);
        }
      }
    }
    if (f.repertoire && event.phase === 'frontierUse' && event.result === 'continuation_verified')
      repertoires.used++;
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
const reopen=async()=>{
  let b=await openBoard();
  if(b.level!==run.start&&b.canSelectLevel)b=await engine.dispatch({type:'selectLevel',level:run.start});
  return b;
};
const dispatchCommand=cmd=>engine.dispatch({type:'action',actionId:cmd.id,...(cmd.id===6?{data:cmd.data}:{})});
await audit.branches(reopen,dispatchCommand);
await frames.compare(reopen,dispatchCommand);
await territories.compare(reopen,dispatchCommand);
await words.compare(reopen,dispatchCommand);
await activations.compare(reopen,dispatchCommand);
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
    repertoires,
    alternatives,
    conditions,
    delayed,
    transfers,
    instrument:audit.sites,
    transport:audit.transports,
    retained:audit.retained,
    territories:territories.stats,
    capacityWords:words.stats,capacityWordExamples:words.examples,
    territoryExamples:territories.examples,
    activations:activations.stats,
    activationExamples:activations.examples,
    responseFrames:frames.stats,
    responseFrameExamples:frames.examples,
    exchanges: {...exchanges,destinations:exchanges.destinations.size},
  })
);
