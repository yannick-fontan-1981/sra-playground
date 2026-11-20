import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import {
  initialMemory,
  recordExperiment,
  sceneKey,
  selectExperiment,
} from '../src/sic/preparation-experiments.ts';
import {
  conditionalPlacements,
  placementOffer,
  placementReceipt,
  placementStep,
} from '../src/sic/conditional-placements.ts';
import { selectFrontier } from '../src/sic/experimental-frontier.ts';
const [environment, controlDir, directory, output, condition, upperFile] = process.argv.slice(2);
const conditional = condition === 'conditional-model' || condition === 'conditional-policy';
const control = conditional
  ? null
  : (await import(pathToFileURL(join(resolve(controlDir), 'src/sic/experimental-frontier.ts'))))
      .selectFrontier;
const engine = await sourceBackend(resolve(environment));
const records = upperFile
  ? (await readFile(upperFile, 'utf8')).trim().split('\n').map(JSON.parse)
  : (
      await Promise.all(
        Array.from({ length: 8 }, (_, i) => readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
      )
    ).flatMap((t) => t.trim().split('\n').map(JSON.parse));
if (
  (upperFile ? records.map((r) => r.code + '/' + r.start) : records.map((r) => r.code)).sort().join() !==
  (upperFile
    ? ['CATR/3', 'CWSE/2', 'GARE/3', 'GIGO/5', 'GRAV/5', 'MOTO/2', 'POLA/5']
    : GAME_CATALOG.map((g) => g.code)
  )
    .sort()
    .join()
)
  throw Error('Wrong cohort');
const programs = upperFile
  ? JSON.parse(
      await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
    )
  : null;
const hash = (b) => createHash('sha256').update(JSON.stringify(b.frame)).digest('hex').slice(0, 16);
function action(cmd) {
  const [id, coords] = cmd.split(':');
  const [x, y] = coords ? coords.split(',').map(Number) : [];
  return { action_ref: id, data: coords ? { x, y } : {} };
}
function act(cmd) {
  const c = action(cmd);
  return engine.dispatch({
    type: 'action',
    actionId: +c.action_ref.slice(6),
    ...(c.action_ref === 'ACTION6' ? { data: c.data } : {}),
  });
}
function routes(m, s) {
  const route = new Map([[s, { first: null, length: 0, edges: [] }]]),
    q = [s];
  for (const x of q)
    for (const e of m.edges) {
      if (!e.stable || e.s !== x || route.has(e.t)) continue;
      const path = route.get(x);
      route.set(e.t, { first: path.first ?? e, length: path.length + 1, edges: [...path.edges, e] });
      q.push(e.t);
    }
  return route;
}
const results = [];
for (const g of records) {
  const level = g.start ?? 1;
  function loadEntry() {
    let b = engine.dispatch({ type: 'load', code: g.code, level: g.sourcePrefixActions ? 1 : level });
    if (g.sourcePrefixActions) {
      let count = 0;
      for (let i = 1; i < level; i++) {
        if (b.level !== i) throw Error('Divergent lower level');
        const seq =
          i === 1
            ? programs.niveau_1[g.code].suite_gagnante
            : programs.niveaux_supérieurs.find((r) => r.code === g.code && r.l === i).seq;
        for (const cmd of seq) {
          b = act('ACTION' + cmd.replace('@', ':'));
          count++;
        }
      }
      if (count !== g.sourcePrefixActions) throw Error('Divergent lower-level program');
    } else if (b.level !== level && b.canSelectLevel) {
      b = engine.dispatch({ type: 'selectLevel', level });
    }
    if (b.level !== level || hash(b) !== g.initial.slice(0, 16)) throw Error('Divergent entry');
    return b;
  }
  const win = (b) => b.level > level || b.state === 'WIN';
  const m = initialMemory(1),
    clicks = new Set(),
    knownPos = new Map(),
    occupied = new Map(),
    seenImages = new Set(),
    cache = new Map();
  let chosen = null;
  let board = loadEntry();
  async function obs(b, i) {
    const h = hash(b);
    if (!cache.has(h))
      cache.set(
        h,
        await measureNativeObservation(
          {
            frame_rows: b.frame,
            frame_hash: h,
            level: b.level - level + 1,
            state: b.state,
            levels_completed: b.levelsCompleted - g.initialCompleted,
            available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
          },
          i
        )
      );
    const r = cache.get(h);
    return { ...r, revision: i };
  }
  const choices = (b) =>
    new Set(b.availableActionIds.flatMap((id) => (id === 6 ? [...clicks] : ['ACTION' + id])));
  for (const [i, cmd] of g.steps.entries()) {
    const from = await obs(board, i + 1),
      op = 'ACTION' + cmd.a + (cmd.a === 6 ? ':' + cmd.data.x + ',' + cmd.data.y : '');
    if (hash(board) !== cmd.from) throw Error('Divergent source prefix');
    const allowed = choices(board),
      cur = m.scenes.indexOf(sceneKey(from));
    if (cur >= 0) m.frontier.choices[cur] = [...allowed];
    const next = act(op);
    if (hash(next) !== cmd.to) throw Error('Divergent source return');
    if (win(next) || next.state !== board.state) break;
    const to = await obs(next, i + 2);
    recordExperiment(m, from, to, action(op), board.frame, next.frame);
    if (cmd.a === 6) clicks.add(op);
    for (const e of [...from.entities, ...to.entities])
      if (!e.identity_ambiguous) {
        const pts = occupied.get(e.signature) ?? new Set();
        pts.add(e.position.join());
        occupied.set(e.signature, pts);
      }
    for (const v of m.edges[m.previous].effect.moves) knownPos.set(v.actor, occupied.get(v.actor));
    seenImages.add(cmd.from);
    seenImages.add(cmd.to);
    board = next;
    if (m.turns < 4 || m.recurrences < 2 || !knownPos.size) continue;
    const s = m.scenes.indexOf(sceneKey(to)),
      ops = choices(board);
    if (conditional) {
      const plan =
        condition === 'conditional-model'
          ? conditionalPlacements(m, to, board.frame, s, ops, m.attempts)
          : selectExperiment(m, to, [...ops].map(action), true, board.frame)?.condition?.plan;
      if (plan) {
        chosen = { i: i + 1, plan };
        break;
      }
      continue;
    }
    const paths = routes(m, s);
    const baseline = control(m, s, ops, paths, to, board.frame)?.frontier?.question,
      newer = selectFrontier(m, s, ops, paths, to, board.frame)?.frontier?.question;
    if (!baseline || !newer?.place) continue;
    if (
      condition === 'opening'
        ? !newer.place.opening
        : condition === 'alternative'
          ? !newer.arrival?.alternative && !newer.use?.alternative
          : baseline.target === newer.target && baseline.probe === newer.probe
    )
      continue;
    chosen = { i: i + 1, baseline, newer, paths };
    break;
  }
  if (!chosen) continue;
  if (chosen.plan) {
    const plan = chosen.plan;
    function restore(prefix = chosen.i) {
      let b = loadEntry();
      for (const s of g.steps.slice(0, prefix)) {
        b = engine.dispatch({ type: 'action', actionId: s.a, ...(s.a === 6 ? { data: s.data } : {}) });
        if (hash(b) !== s.to) throw Error('Divergent conditional source prefix');
      }
      return b;
    }
    const pos = (o, role) =>
      o.entities.find((e) => e.signature === role && !e.identity_ambiguous)?.position.join() ?? null;
    const bare = restore(chosen.i - (plan.alreadyPlaced ?? 0)),
      beforeBare = await obs(bare, 1),
      bareReturn = act(plan.trigger.op);
    const inactive =
      !win(bareReturn) &&
      bareReturn.state === bare.state &&
      pos(beforeBare, plan.actor) === plan.origin.join() &&
      pos(await obs(bareReturn, 2), plan.actor) === plan.origin.join();
    if (!inactive) throw Error('Inactive control not reproduced');
    let b = restore(chosen.i - (plan.alreadyPlaced ?? 0));
    const outcomes = [];
    for (let index = 0; index < plan.preparation.length + 1 + Number(!!plan.use); index++) {
      const trial = { plan, index, scene: 0 },
        before = await obs(b, index + 1),
        step = placementStep(trial);
      if (
        !b.availableActionIds.includes(+step.op.split(':')[0].slice(6)) ||
        !placementOffer(trial, before, new Set([step.op]))
      )
        break;
      b = act(step.op);
      const after = await obs(b, index + 2);
      const { result } = placementReceipt(m, trial, 0, before, after);
      outcomes.push({ op: step.op, result, predicted: step.to, observed: pos(after, step.role) });
      if (
        result === 'condition_refuted' ||
        result === 'condition_terminal' ||
        result === 'official_completion'
      )
        break;
    }
    const passed = win(b),
      endpoint = !passed ? pos(await obs(b, 0), plan.actor) : null;
    function physical(commands) {
      let raw = restore(chosen.i - (plan.alreadyPlaced ?? 0));
      for (const op of commands) {
        if (
          win(raw) ||
          raw.state === 'GAME_OVER' ||
          !raw.availableActionIds.includes(+op.split(':')[0].slice(6))
        )
          return null;
        raw = act(op);
      }
      return raw;
    }
    const omissions = {};
    if (plan.use) {
      const suffix = plan.use.op;
      for (const [key, word] of Object.entries({
        useOnly: [suffix],
        withoutPreparation: [plan.trigger.op, suffix],
        withoutTrigger: [...plan.preparation.map((x) => x.op), suffix],
      })) {
        const raw = physical(word);
        omissions[key] = raw
          ? {
              won: win(raw),
              at: win(raw) || raw.state === 'GAME_OVER' ? null : pos(await obs(raw, 0), plan.actor),
            }
          : null;
      }
    }
    const full = outcomes.some((s) => s.result === 'condition_used');
    const differentUse = !!(
      full &&
      endpoint &&
      Object.values(omissions).length === 3 &&
      Object.values(omissions).every((s) => s && !s.won && s.at && s.at !== endpoint)
    );
    let shorter = null;
    if (full && endpoint) {
      const word = [...plan.preparation.map((p) => p.op), plan.trigger.op, plan.use.op],
        tested = new Set();
      let same = 0,
        unmeasured = 0,
        terminal = 0;
      for (let mask = 0; mask < (1 << word.length) - 1; mask++) {
        const sub = word.filter((_, i) => mask & (1 << i)),
          k = sub.join('/');
        if (tested.has(k)) continue;
        tested.add(k);
        const raw = physical(sub);
        if (!raw) {
          unmeasured++;
          continue;
        }
        if (win(raw) || raw.state === 'GAME_OVER') {
          terminal++;
          continue;
        }
        const place = pos(await obs(raw, 0), plan.actor);
        if (!place) unmeasured++;
        else if (place === endpoint) same++;
      }
      shorter = {
        tested: tested.size,
        same,
        unmeasured,
        terminal,
        unique: same === 0 && unmeasured === 0 && terminal === 0,
      };
    }
    results.push({
      game: g.code,
      level,
      prefix: chosen.i,
      inactive,
      alreadyPlaced: plan.alreadyPlaced ?? 0,
      preparation: plan.preparation,
      trigger: plan.trigger,
      use: plan.use,
      hypotheses: plan.rules,
      ...(plan.frame ? { frame: plan.frame } : {}),
      agreement: plan.agreement,
      alternatives: plan.alternatives,
      outcomes,
      won: passed,
      endpoint,
      omissions,
      differentUse,
      shorter,
      novelUse: !!(full && endpoint && !knownPos.get(plan.actor)?.has(endpoint)),
    });
    continue;
  }
  async function arm(q, omit = false) {
    let b = loadEntry();
    for (const s of g.steps.slice(0, chosen.i)) {
      b = engine.dispatch({ type: 'action', actionId: s.a, ...(s.a === 6 ? { data: s.data } : {}) });
      if (hash(b) !== s.to) throw Error('Unreplayable prefix');
    }
    for (const e of chosen.paths.get(q.target).edges) {
      b = act(e.cmd);
      if (hash(b) !== m.scenes[e.t].split('|')[0]) throw Error('Unreplayable route');
    }
    const start = await obs(b, 0);
    const countNew = (o) =>
      o.entities.filter(
        (e) =>
          !e.identity_ambiguous &&
          knownPos.has(e.signature) &&
          !knownPos.get(e.signature).has(e.position.join())
      ).length;
    if (omit) {
      if (!q.use || !b.availableActionIds.includes(+q.use.op.split(':')[0].slice(6))) return null;
      const raw = act(q.use.op),
        o = await obs(raw, 0);
      return {
        won: win(raw),
        from:
          start.entities.find((e) => !e.identity_ambiguous && e.signature === q.use.role)?.position.join() ??
          null,
        to:
          o.entities.find((e) => !e.identity_ambiguous && e.signature === q.use.role)?.position.join() ??
          null,
      };
    }
    let next = act(q.probe),
      end = await obs(next, 0);
    const pos = (o, id) =>
      o.entities.find((e) => !e.identity_ambiguous && e.signature === id)?.position.join();
    const arrived =
      !!q.arrival &&
      pos(start, q.arrival.role) === q.arrival.from.join() &&
      pos(end, q.arrival.role) === q.arrival.to.join();
    const result = {
      target: q.target,
      probe: q.probe,
      route: chosen.paths.get(q.target).length,
      novelImage: !seenImages.has(hash(next)),
      won: win(next),
      newPose: !win(next) && countNew(end) > 0,
      arrived,
      continued: false,
      novelContinuation: false,
      followingWon: false,
    };
    if (
      !result.won &&
      arrived &&
      q.use &&
      pos(end, q.use.role) === q.use.from.join() &&
      next.availableActionIds.includes(+q.use.op.split(':')[0].slice(6))
    ) {
      const later = act(q.use.op),
        o = await obs(later, 0);
      result.followingWon = win(later);
      result.fromAfterPlacement = pos(end, q.use.role) ?? null;
      result.landing = pos(o, q.use.role) ?? null;
      result.continued =
        !win(later) && pos(end, q.use.role) === q.use.from.join() && pos(o, q.use.role) === q.use.to.join();
      result.novelContinuation = result.continued && !knownPos.get(q.use.role)?.has(q.use.to.join());
      if (
        result.continued &&
        q.after &&
        later.availableActionIds.includes(+q.after.op.split(':')[0].slice(6)) &&
        pos(o, q.after.role) === q.after.from.join()
      ) {
        const after = act(q.after.op),
          final = await obs(after, 0);
        result.finalWon = win(after);
        result.finalUsed = !win(after) && pos(final, q.after.role) === q.after.to.join();
      }
    }
    return result;
  }
  const evaluated = await arm(chosen.newer),
    bare = chosen.newer.place.opening ? await arm(chosen.newer, true) : null;
  results.push({
    game: g.code,
    level,
    prefix: chosen.i,
    control: await arm(chosen.baseline),
    candidate: evaluated,
    ...(condition === 'alternative'
      ? { alternativeProgram: [chosen.newer.arrival, chosen.newer.use, chosen.newer.after ?? null] }
      : {}),
    ...(bare
      ? {
          bare,
          program: [chosen.newer.arrival, chosen.newer.use, chosen.newer.after],
          predictedControl: chosen.newer.place.opening.without,
          opened:
            !bare.won &&
            evaluated.arrived &&
            evaluated.continued &&
            evaluated.fromAfterPlacement === bare.from &&
            bare.to !== null &&
            evaluated.landing !== bare.to,
        }
      : {}),
  });
}
await writeFile(output, JSON.stringify(results) + '\n');
if (condition?.startsWith('conditional-')) {
  console.log(
    JSON.stringify({
      games: results.length,
      placed: results.filter(
        (r) => r.outcomes.filter((s) => s.result === 'condition_placed').length === r.preparation.length
      ).length,
      activated: results.filter((r) => r.outcomes.some((s) => s.result === 'condition_activated')).length,
      used: results.filter((r) => r.outcomes.some((s) => s.result === 'condition_used')).length,
      won: results.filter((r) => r.won).length,
    })
  );
} else
  console.log(
    JSON.stringify({
      games: results.length,
      arms: Object.fromEntries(
        ['control', 'candidate'].map((k) => [
          k,
          Object.fromEntries(
            ['novelImage', 'won', 'newPose', 'arrived', 'continued', 'novelContinuation', 'followingWon'].map(
              (metric) => [metric, results.filter((r) => r[k][metric]).length]
            )
          ),
        ])
      ),
    })
  );
