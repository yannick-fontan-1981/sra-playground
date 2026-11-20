// Audit forecasts from a recorded public prefix. Neither the live agent nor its ranker can fork a game.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { initialMemory, recordExperiment } from '../src/sic/preparation-experiments.ts';
import { proposeCapability } from '../src/sic/derive-capabilities.ts';

const [environment, mode, output, ...files] = process.argv.slice(2),
  rows = (
    await Promise.all(files.map(async (f) => (await readFile(f, 'utf8')).trim().split('\n').map(JSON.parse)))
  ).flat();
const original = new Set(GAME_CATALOG.map((g) => g.code));
if (
  mode === 'corpus' &&
  (rows.length !== 100 ||
    new Set(rows.map((r) => r.code)).size !== 100 ||
    rows.some((r) => !original.has(r.code) || r.start !== 1 || r.finish !== 1))
)
  throw Error('Expected original 100 L1 only');
const src = rows.every((r) => original.has(r.code));
if (!src && rows.some((r) => original.has(r.code))) throw Error('Mixed cohorts');
const engine = src
  ? await sourceBackend(resolve(environment))
  : (
      await import(pathToFileURL(join(resolve(environment), 'src/runtime/native-game-dispatcher.ts')))
    ).createGameDispatcher(() => {
      throw Error('Unexpected legacy backend');
    });
const hash = (f) => createHash('sha256').update(JSON.stringify(f)).digest('hex').slice(0, 16);
const parse = (key) => {
  const [name, pt] = key.split(':'),
    [x, y] = pt?.split(',').map(Number) ?? [];
  return { id: Number(name.slice(6)), ...(pt ? { data: { x, y } } : {}) };
};
const act = (k) => {
  const cmd = parse(k);
  return engine.dispatch({ type: 'action', actionId: cmd.id, ...(cmd.id === 6 ? { data: cmd.data } : {}) });
};
const name = (s) => (s.id === 6 ? 'ACTION6:' + s.data.x + ',' + s.data.y : 'ACTION' + s.id);
const same = (a, b) =>
  a && b && a.length === b.length && a.every((p, i) => p && b[i] && p[0] === b[i][0] && p[1] === b[i][1]);
const reports = [];
for (const r of rows) {
  const steps = r.steps?.map((s) => ({ id: s.a, data: s.data, from: s.from, to: s.to })) ?? r.replayCommands;
  const mem = initialMemory(1),
    cache = new Map();
  async function observe(b, revision) {
    const h = hash(b.frame),
      key = h + '/' + b.state + '/' + b.level + '/' + b.levelsCompleted;
    if (!cache.has(key))
      cache.set(
        key,
        await measureNativeObservation(
          {
            frame_rows: b.frame,
            frame_hash: h,
            level: b.level,
            levels_completed: b.levelsCompleted,
            state: b.state,
            available_action_refs: b.availableActionIds.map((i) => 'ACTION' + i),
          },
          0
        )
      );
    return { ...cache.get(key), revision };
  }
  async function rewind(n) {
    let b = await engine.dispatch({ type: 'load', code: r.code, level: r.start });
    if (b.level !== r.start && b.canSelectLevel)
      b = await engine.dispatch({ type: 'selectLevel', level: r.start });
    if (hash(b.frame) !== r.initial.slice(0, 16)) throw Error('Initial hash mismatch');
    for (const s of steps.slice(0, n)) {
      if (hash(b.frame) !== s.from) throw Error('Prefix mismatch');
      b = await act(name(s));
      if (hash(b.frame) !== s.to) throw Error('Return mismatch');
    }
    return b;
  }
  const forecasts = [];
  if (mode === 'corpus') {
    let b = await rewind(0);
    const seen = new Set(),
      counts = {};
    for (const [i, s] of steps.entries()) {
      const before = await observe(b, i);
      const ops = new Set([
        ...before.available_action_refs.filter((op) => op !== 'ACTION6'),
        ...mem.edges
          .map((e) => e.cmd)
          .filter((op) => op.startsWith('ACTION6:') && before.available_action_refs.includes('ACTION6')),
      ]);
      if (mem.revisionScene[i] !== undefined) {
        const x = proposeCapability(mem, before, b.frame, ops, mem.revisionScene[i]);
        const c = x?.equation?.claim,
          key = c && [c.kind, c.basis, c.initial].join('/');
        if (c && !seen.has(key) && (counts[c.kind] ?? 0) < 3) {
          seen.add(key);
          counts[c.kind] = (counts[c.kind] ?? 0) + 1;
          forecasts.push({
            n: i,
            event: {
              kind: c.kind,
              roles: c.roles,
              initial: c.initial,
              effect: c.effect,
              goal: c.goal,
              program: c.program.map((s) => s.op),
              opportunity: c.opportunity,
              control: c.control,
              newPrimitive: c.newPrimitive,
              inverseStatus: c.inverseStatus,
              localBlocked: c.localBlocked,
            },
          });
        }
      }
      const next = await act(name(s));
      if (hash(b.frame) !== s.from || hash(next.frame) !== s.to) throw Error('Divergent original prefix');
      const after = await observe(next, i + 1);
      recordExperiment(
        mem,
        before,
        after,
        { action_ref: 'ACTION' + s.id, data: s.id === 6 ? s.data : {} },
        b.frame,
        next.frame
      );
      b = next;
    }
  } else
    for (const e of r.preparation.filter((e) => e.equation?.index === 0)) {
      const n = e.actionIndex - 1,
        q = e.equation;
      const end = r.preparation.find(
        (v) =>
          v.actionIndex === e.actionIndex + q.program.length - 1 &&
          v.equation?.index === q.program.length - 1 &&
          v.hypothesis === e.hypothesis
      );
      const use = r.preparation.find(
        (v) =>
          v.actionIndex === e.actionIndex + q.program.length &&
          v.phase === 'capabilityUse' &&
          v.hypothesis === e.hypothesis
      );
      forecasts.push({ n, event: q, online: end?.result ?? 'no_verified_end', onlineUse: use?.result });
    }
  const checks = [];
  for (const { n, event: q, online, onlineUse } of forecasts) {
    const pose = async (b) => {
      const o = await observe(b, 0);
      return q.roles.map(
        (id) => o.entities.find((e) => e.signature === id && !e.identity_ambiguous)?.position ?? null
      );
    };
    let b = await rewind(n),
      origin = await pose(b),
      initialLevel = b.level,
      initialState = b.state;
    if (!same(origin, q.initial)) throw Error('Hypothesis bound to a different origin');
    const direct = await act(q.control),
      bare = await pose(direct);
    b = await rewind(n);
    let terminal = false;
    for (const op of q.program) {
      b = await act(op);
      if (b.level !== initialLevel || b.state !== initialState) {
        terminal = true;
        break;
      }
    }
    const actual = await pose(b),
      hit = !terminal && !!same(actual, q.goal);
    const controlResolved =
      direct.level === initialLevel && direct.state === initialState && bare.every(Boolean);
    const distinct = hit && controlResolved && !same(actual, bare);
    if (online === 'derived_capability_verified' && !hit)
      throw Error('Independent replay refuted online receipt');
    let opportunity = null;
    if (hit && q.opportunity) {
      const applied = await act(q.opportunity.op),
        outcome = await pose(applied);
      await rewind(n);
      const unprepared = await act(q.opportunity.op),
        control = await pose(unprepared);
      const hitAccess =
        applied.level === initialLevel &&
        applied.state === initialState &&
        !!same(outcome, q.opportunity.forecast);
      const index = q.opportunity.role,
        distinctAccess =
          hitAccess &&
          unprepared.level === initialLevel &&
          unprepared.state === initialState &&
          !!control[index] &&
          !!outcome[index] &&
          (control[index][0] !== outcome[index][0] || control[index][1] !== outcome[index][1]);
      if (onlineUse === 'derived_access_verified' && !hitAccess) throw Error('Derived access diverged');
      opportunity = {
        predicted: q.opportunity.forecast,
        op: q.opportunity.op,
        role: index,
        outcome,
        control,
        hitAccess,
        distinctAccess,
        onlineUse,
      };
    }
    let orderControl = null,
      oneStep = null;
    if (hit && mode === 'online') {
      let originBoard = await rewind(n);
      const ids = originBoard.availableActionIds;
      const middle = q.kind === 'product' ? 2 : 1;
      const sameCommands = [...q.program.slice(0, middle), ...q.program.slice(middle + 1), q.program[middle]];
      let end = originBoard,
        completed = true;
      for (const cmd of sameCommands) {
        end = await act(cmd);
        if (end.state !== initialState || end.level !== initialLevel) {
          completed = false;
          break;
        }
      }
      const controlledPose = await pose(end);
      orderControl = {
        program: sameCommands,
        actual: controlledPose,
        completed,
        distinct: completed && controlledPose.every(Boolean) && !same(controlledPose, q.goal),
      };
      const ops = new Set(ids.filter((i) => i !== 6).map((i) => 'ACTION' + i));
      if (ids.includes(6)) for (const past of steps.slice(0, n)) if (past.id === 6) ops.add(name(past));
      const matching = [],
        unresolved = [];
      for (const cmd of ops) {
        await rewind(n);
        const stop = await act(cmd),
          p = await pose(stop);
        if (stop.level !== initialLevel || stop.state !== initialState || !p.every(Boolean))
          unresolved.push(cmd);
        else if (same(p, q.goal)) matching.push(cmd);
      }
      oneStep = { examined: [...ops], matching, unresolved, allDiscrete: !ids.includes(6) };
    }
    checks.push({
      action: n + 1,
      orderControl,
      oneStep,
      opportunity,
      kind: q.kind,
      roles: q.roles,
      initial: origin,
      goal: q.goal,
      effect: q.effect,
      program: q.program,
      control: q.control,
      bare,
      actual,
      hit,
      distinct,
      controlResolved,
      terminal,
      inverseStatus: q.inverseStatus,
      localBlocked: q.localBlocked,
      newPrimitive: q.newPrimitive,
      ...(online ? { online } : {}),
    });
  }
  reports.push({ game: r.code, checked: steps.length, checks });
}
await writeFile(output, JSON.stringify(reports));
const cs = reports.flatMap((r) => r.checks);
console.log(
  JSON.stringify({
    games: rows.length,
    prefixActions: rows.reduce((n, r) => n + r.issued, 0),
    forecasts: cs.length,
    reached: cs.filter((c) => c.hit).length,
    controlled: cs.filter((c) => c.distinct).length,
    gamesControlled: reports.filter((r) => r.checks.some((c) => c.distinct)).map((r) => r.game),
  })
);
