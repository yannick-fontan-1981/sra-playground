// Post-freeze diagnostic. The learner only receives rendered public frames and commands.
import { open, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [env, solver, prefix, output, ...autonomousRuns] = process.argv.slice(2);
const mod = (root, p) => import(pathToFileURL(join(resolve(root), p)).href);
const { symbolicDigest } = await mod(solver, 'src/logos-engine/v6-hash.ts');
const { poseFamilyKey } = await mod(solver, 'src/sic/pose-families.ts');
const { measureNativeObservation, geometricComponents } = await mod(
    solver,
    'src/logos-engine/v6-native-observer.ts'
  ),
  { createPreparedEffects } = await mod(solver, 'src/sic/test-prepared-effects.ts');
const {
  compileLevel,
  initialState,
  stepWorld,
  renderWorld,
  reflectionPreviews,
  cellToPixel,
  pixelToCell,
  SinkingStarSession,
} = await mod(env, 'src/games/sinking-star/core.ts');
const { offerWitnessedPreview, visualLayout, checkWitnessedPreview } = await mod(
  solver,
  'src/sic/witnessed-preview-transfer.ts'
);
const { SS01_LEVELS } = await mod(env, 'src/games/sinking-star/levels.ts'),
  { routes } = await mod(env, 'tests/ss01-routes.ts');
const digest = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex'),
  hash = (b) => digest(b.frame).slice(0, 16);
const recorded = JSON.parse((await readFile(prefix, 'utf8')).trim()),
  word = (recorded.publicPrefix ?? recorded.replayCommands).slice(0, 210);
const pair = (p) => (p ? [p.x, p.y] : null),
  same = (a, b) => a && b && a.x === b.x && a.y === b.y;
const local = (p, l) =>
  p
    ? [
        p.x - Math.floor((20 - SS01_LEVELS[l - 1].rows[0].length) / 2) + 1,
        p.y - Math.floor((20 - SS01_LEVELS[l - 1].rows.length) / 2) + 1,
      ]
    : null;
const at = (xy) => pixelToCell(Math.floor(xy[0] / 2), Math.floor(xy[1] / 2));
const command = (q, data) => ({ action_ref: 'ACTION' + q, data: data ?? {} });
const archive = await open(resolve(solver) + '.zip');
let candidate;
try {
  const tail = Buffer.alloc(62);
  const stat = await archive.stat();
  await archive.read(tail, 0, 62, stat.size - 62);
  if (tail.readUInt32LE(0) !== 0x06054b50 || tail.readUInt16LE(20) !== 40)
    throw Error('Expected immutable Git archive');
  candidate = tail.subarray(22).toString('ascii');
  if (!/^[0-9a-f]{40}$/.test(candidate)) throw Error('Missing archive commit');
} finally {
  await archive.close();
}
const result = {
  publicPrefix: word.map(({ id, data, from, to }) => ({ id, ...(id === 6 ? { data } : {}), from, to })),
  at210: null,
  guided: { l1: [], l2: [], distinctBindings: 0 },
  candidate,
};
const read = (b, n, scope) =>
  measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((q) => 'ACTION' + q),
    },
    n,
    scope
  );
function truth(world, state, z, board, l, w) {
  const prev = reflectionPreviews(world, state).find(
    (p) => p.kind === 'merchant' && same(p.from, state.hero) && p.valid
  );
  const after = local(z.hero, l),
    target = prev ? local(prev.to, l) : null;
  const bare = renderWorld(world, state, false);
  const geometricMark = w ? (w.indicated ?? w.forecast?.indicated) : null,
    marker = geometricMark ? at(geometricMark) : null;
  const markerInk =
    marker &&
    prev &&
    same(marker, prev.to) &&
    (() => {
      const pieces = geometricComponents(board.frame).filter(
        (e) =>
          e.bbox[0] + e.bbox[2] === geometricMark[0] &&
          e.bbox[1] + e.bbox[3] === geometricMark[1] &&
          e.area <= (board.frame.length * board.frame[0].length) / 12
      );
      const mark = pieces.find(
        (e) => symbolicDigest(poseFamilyKey({ ...e, palette_value: e.color })).slice(0, 24) === w.indicator
      );
      return mark
        ? mark.mask.filter(([dx, dy]) => {
            const x = mark.bbox[0] + dx,
              y = mark.bbox[1] + dy;
            return bare[y][x] !== board.frame[y][x];
          }).length
        : 0;
    })();
  return {
    from: local(state.hero, l),
    to: after,
    stationaryMerchantBefore: state.others.map((p) => local(p, l)),
    stationaryMerchantAfter: z.others.map((p) => local(p, l)),
    indicated: target,
    landedOnValidMark: !!prev && same(prev.to, z.hero) && !same(state.hero, z.hero),
    subjectMatches: w ? !!same(at(w.from), state.hero) : null,
    markMatches: w ? !!markerInk : null,
    indicatorChangedPixels: w ? Number(markerInk || 0) : null,
  };
}
async function campaign(name) {
  const game = new SinkingStarSession(SS01_LEVELS),
    family = createPreparedEffects(),
    history = [],
    scope = 'test-' + name;
  let witnessedRule = null,
    retainedBinding = null;
  let board = game.observe(),
    obs = await read(board, 1, scope),
    state = initialState(compileLevel(SS01_LEVELS[0])),
    rev = 1;
  function fork(q, data) {
    const session = new SinkingStarSession(SS01_LEVELS);
    for (const h of history) session.action(h.q, h.data);
    if (hash(session.observe()) !== hash(board)) throw Error('Divergent fork');
    return session.action(q, data);
  }
  async function closedLoop(label) {
    const session = new SinkingStarSession(SS01_LEVELS),
      learner = createPreparedEffects();
    for (const h of history) session.action(h.q, h.data);
    if (hash(session.observe()) !== hash(board)) throw Error('Divergent warm exposure');
    learner.restore(family.state());
    let b = board,
      o = obs,
      s = state;
    const world = compileLevel(SS01_LEVELS[1]),
      receipt = {
        start: label,
        actions: 0,
        stop: null,
        firstL1Read: null,
        firstCorrectRead: null,
        physicalActivations: [],
        territory: [],
        counts: {},
        won: false,
      };
    const visited = new Set();
    for (let k = 0; k < 160; k++) {
      const available = b.availableActionIds.filter((v) => v !== 6).map((v) => command(v));
      const proposal =
        (await learner.proposeInGroup(
          'test_compositions_after_recurrent_returns',
          o,
          b.frame,
          available,
          160 - k
        )) ??
        (await learner.proposeInGroup(
          'test_compositions_after_existing_strategies',
          o,
          b.frame,
          available,
          160 - k
        ));
      if (!proposal) {
        receipt.stop = 'family_abstained';
        break;
      }
      if (!(await learner.before(proposal, 0, {}, o)).admitted) throw Error('Unbound warm action');
      const act = proposal.actions[0],
        q = Number(act.action_ref.slice(6)),
        f = proposal.experiment.witnessedPreview,
        seal = f ? digest(f) : null,
        z = stepWorld(world, s, q, act.data),
        next = session.action(q, act.data),
        n = await read(next, o.revision + 1, scope);
      await learner.after(proposal, 0, o, n, b.frame, next.frame);
      const acquired = await learner.record(o, n, act, b.frame, next.frame, proposal, 0, []);
      const t = truth(world, s, z, b, 2, f),
        phase = proposal.experiment.phase;
      receipt.counts[phase] = (receipt.counts[phase] ?? 0) + 1;
      receipt.actions++;
      visited.add(local(z.hero, 2).join());
      if (f) {
        const value = {
          step: k + 1,
          op: q,
          seal,
          forecastBasis: f.basis,
          from: local(at(f.from), 2),
          mark: local(at(f.indicated), 2),
          result: acquired.events[0].witnessedPreview.status,
          physical: t,
        };
        if (f.basis === 'observed_in_previous_level') receipt.firstL1Read ??= value;
        if (t.markMatches && t.subjectMatches && t.landedOnValidMark && value.result === 'realized')
          receipt.firstCorrectRead ??= value;
      }
      if (q === 5 && t.landedOnValidMark)
        receipt.physicalActivations.push({ step: k + 1, from: t.from, to: t.to });
      if (next.level !== 2 || next.levelsCompleted > 1) {
        receipt.won = true;
        receipt.stop = 'official_boundary';
        break;
      }
      b = next;
      o = n;
      s = z;
    }
    receipt.stop ??= 'action_cap';
    receipt.territory = [...visited];
    (result.guided.closedLoops ??= []).push(receipt);
  }
  async function step(q, data, expected, look = false) {
    const l = board.level,
      world = compileLevel(SS01_LEVELS[l - 1]),
      z = stepWorld(world, state, q, data);
    if (expected && expected.from !== hash(board)) throw Error('Divergent origin ' + rev);
    if (look && l === 2) {
      const n = history.filter((h) => h.l === 2).length;
      if (n === 0 || n === 3)
        await closedLoop(n === 0 ? 'official_level_entry' : 'after_three_public_demonstration_moves');
    }
    const aliases = [...board.availableActionIds.filter((v) => v !== 6).map((v) => command(v))];
    let picked;
    if (look) picked = await family.proposeInGroup('explore', obs, board.frame, aliases, 1200);
    const forecast = picked?.experiment?.witnessedPreview;
    if (l === 2 && look) {
      const detail = {
        at: rev,
        levelAction: history.filter((h) => h.l === 2).length + 1,
        selected: picked?.experiment?.phase ?? null,
        referenceAction: q,
        forecast: null,
        physical: truth(world, state, z, board, l, null),
      };
      // Isolate the rule identified independently in L1, to separate its survival from its priority.
      if (retainedBinding) {
        const current = family.state().previewLearning,
          slice = { ...current, seen: {}, rejected: {}, bindings: { [witnessedRule]: retainedBinding } },
          beforeView = visualLayout(obs, board.frame);
        const precise = offerWitnessedPreview(slice, obs, beforeView, new Set(obs.available_action_refs));
        if (precise) {
          const op = Number(precise.command.slice(6)),
            frozen = digest(precise),
            fb = fork(op),
            fo = await read(fb, rev + 1, scope),
            m = checkWitnessedPreview(
              slice,
              precise,
              obs,
              fo,
              beforeView,
              visualLayout(fo, fb.frame),
              precise.command
            );
          detail.isolated = {
            op,
            basis: precise.basis,
            seal: frozen,
            subject: local(at(precise.from), l),
            mark: local(at(precise.indicated), l),
            actual: m.actual ? local(at(m.actual), l) : null,
            status: m.status,
            physical: truth(world, state, stepWorld(world, state, op), board, l, precise),
          };
        }
      }
      if (forecast) {
        const trial = picked.actions[0],
          op = Number(trial.action_ref.slice(6)),
          fb = fork(op, trial.data),
          fo = await read(fb, rev + 1, scope),
          sealed = digest(forecast),
          shadow = createPreparedEffects();
        shadow.restore(family.state());
        const receipt = await shadow.record(obs, fo, trial, board.frame, fb.frame, picked, 0, []),
          measured = receipt.events[0].witnessedPreview;
        const situation = truth(world, state, stepWorld(world, state, op, trial.data), board, l, forecast);
        const rivals = board.availableActionIds
          .filter((n) => n !== op && n !== 6)
          .map((n) => {
            const other = fork(n),
              oracle = stepWorld(world, state, n);
            if (!oracle.complete && hash(other) !== digest(renderWorld(world, oracle)).slice(0, 16))
              throw Error('Control diverged');
            return { q: n, to: local(oracle.hero, l) };
          });
        detail.forecast = {
          sealed,
          op,
          basis: forecast.basis,
          from: local(at(forecast.from), l),
          indicated: local(at(forecast.indicated), l),
          witness: forecast.witness.before,
          status: measured.status,
          actual: measured.actual ? local(at(measured.actual), l) : null,
          situation,
          rivals,
        };
      }
      result.guided.l2.push(detail);
    }
    let controls;
    if (name === 'q210' && rev === 210) {
      controls = board.availableActionIds
        .filter((v) => v !== 6)
        .map((n) => {
          const other = fork(n),
            oracle = stepWorld(world, state, n);
          if (!oracle.complete && hash(other) !== digest(renderWorld(world, oracle)).slice(0, 16))
            throw Error('Fork mismatch');
          return { q: n, to: local(oracle.hero, l), other: oracle.others.map((p) => local(p, l)) };
        });
    }
    const next = game.action(q, data),
      after = await read(next, rev + 1, scope);
    if (expected && expected.to !== hash(next)) throw Error('Divergent return ' + rev);
    if (!z.complete && hash(next) !== digest(renderWorld(world, z)).slice(0, 16))
      throw Error('Diagnostic observer mismatch');
    await family.observePublicOutcome(obs, after, command(q, data), board.frame, next.frame);
    const mem = family.state(),
      matches = [];
    for (const b of Object.values(mem.previewLearning?.bindings ?? {}))
      for (const w of b.witnesses) {
        if (w.before !== obs.observation_ref || w.after !== after.observation_ref) continue;
        const physical = truth(world, state, z, board, l, { ...w, indicator: b.indicator });
        if (physical.subjectMatches && physical.markMatches && same(at(w.arrived), z.hero))
          matches.push({
            relation: b.relation,
            actor: b.actor,
            indicator: b.indicator,
            subjectForm: w.subjectForm,
            indicatorForm: w.indicatorForm,
            before: w.before,
            after: w.after,
            command: w.command,
            observedPeerCount: w.peers.length,
            indicatorChangedPixels: physical.indicatorChangedPixels,
            from: local(at(w.from), l),
            indicated: local(at(w.indicated), l),
            arrival: local(at(w.arrived), l),
          });
      }
    if (name === 'q210' && rev === 210)
      result.at210 = { physical: truth(world, state, z, board, l, null), controls, matches };
    if (name === 'guided' && l === 1 && q === 5 && matches.length && !witnessedRule) {
      const hit = matches[0];
      witnessedRule = Object.keys(mem.previewLearning.bindings).find((k) => {
        const b = mem.previewLearning.bindings[k];
        return b.actor === hit.actor && b.indicator === hit.indicator && b.gesture.op === hit.command;
      });
    }
    if (name === 'guided' && l === 1 && q === 5)
      result.guided.l1.push({ action: rev, physical: truth(world, state, z, board, l, null), matches });
    if (name === 'guided' && l === 1 && next.level === 2) {
      result.guided.officialL1 = next.levelsCompleted;
      result.guided.distinctBindings = Object.keys(mem.previewCarry?.bindings ?? {}).length;
      retainedBinding = structuredClone(mem.previewCarry?.bindings[witnessedRule] ?? null);
      result.guided.identifiedRuleRetained = !!retainedBinding;
    }
    history.push({ q, data, l });
    board = next;
    obs = after;
    rev++;
    state = z.complete && board.level !== l ? initialState(compileLevel(SS01_LEVELS[board.level - 1])) : z;
  }
  if (name === 'q210') for (const v of word) await step(v.id, v.data, v);
  else
    for (const [i, route] of routes.slice(0, 2).entries()) {
      for (const c of route.replace(/([A-Z])(\d+)/g, (_, letter, count) => letter.repeat(+count))) {
        const q = { U: 1, D: 2, L: 3, R: 4, X: 5, C: 6 }[c],
          pt = q === 6 ? cellToPixel(state.others[0]) : null;
        await step(q, pt ? { x: pt.x + 1, y: pt.y + 1 } : undefined, null, i === 1);
      }
    }
}
await campaign('q210');
await campaign('guided');
for (const file of autonomousRuns) {
  const run = JSON.parse((await readFile(file, 'utf8')).trim()),
    w = compileLevel(SS01_LEVELS[run.start - 1]),
    game = new SinkingStarSession(SS01_LEVELS);
  if (run.start !== 1) game.selectLevel(run.start);
  const events = new Map(run.preparation.map((e) => [e.actionIndex, e])),
    sites = new Set(),
    facts = {
      level: run.start,
      actions: 0,
      forecastCount: 0,
      validOpportunities: 0,
      firstValid: null,
      byCommandAtValid: {},
      issuedActivations: 0,
      mirrorMoves: [],
      physicalTransfers: 0,
      exactNamedTransfers: 0,
      transfers: [],
      probeChecks: [],
      maxSimultaneousGoals: 0,
      firstGoal: null,
      wrongSubjectCount: 0,
      firstNamed: null,
      uniqueNamedSites: [],
      official: run.levels[0].won,
      visitedCells: 0,
    };
  let s = initialState(w);
  const walked = new Set([local(s.hero, run.start).join()]);
  for (const [i, c] of run.replayCommands.entries()) {
    const b = game.observe();
    if (c.from !== hash(b)) throw Error('Autonomous origin mismatch');
    const z = stepWorld(w, s, c.id, c.data),
      next = game.action(c.id, c.data),
      m = events.get(i + 1)?.witnessedPreview,
      f = m?.forecast;
    if (c.to !== hash(next) || (!z.complete && digest(renderWorld(w, z)).slice(0, 16) !== hash(next)))
      throw Error('Autonomous return mismatch');
    const v = truth(w, s, z, b, run.start, f);
    facts.actions++;
    if (c.id === 5) facts.issuedActivations++;
    if (v.indicated) {
      facts.validOpportunities++;
      facts.byCommandAtValid[c.id] = (facts.byCommandAtValid[c.id] ?? 0) + 1;
      facts.firstValid ??= {
        action: i + 1,
        from: v.from,
        marked: v.indicated,
        issued: c.id,
        phase: events.get(i + 1)?.phase ?? null,
      };
    }
    for (const [j, mirror] of s.mirrors.entries()) {
      if (!same(mirror, z.mirrors[j]))
        facts.mirrorMoves.push({
          action: i + 1,
          from: local(mirror, run.start),
          to: local(z.mirrors[j], run.start),
          issued: c.id,
        });
    }
    const goalCount=w.goals.filter(g=>[z.hero,...z.others].some(p=>same(p,g))).length;
    facts.maxSimultaneousGoals=Math.max(facts.maxSimultaneousGoals,goalCount);
    if(goalCount)facts.firstGoal??=i+1;
    const event=events.get(i+1),probe=event?.unreadIndicator,test=probe?.test;
    if(test){
      if(c.indicatorProbeSeal!==digest(test))throw Error('Missing pre-action indicator commitment');
      const check=truth(w,s,z,b,run.start,{from:test.cue.origin,indicated:test.cue.site,indicator:test.cue.r});
      facts.probeChecks.push({action:i+1,issued:c.id,word:test.word,status:probe.status,from:check.from,marked:check.indicated,arrived:check.to,subjectMatches:check.subjectMatches,markMatches:check.markMatches});
    }
    if(c.id===5&&v.landedOnValidMark){
      facts.physicalTransfers++;
      facts.transfers.push({action:i+1,phase:event?.phase??null,from:v.from,arrived:v.to,other:v.stationaryMerchantAfter,exactRead:!!(f&&m.status==='realized'&&v.subjectMatches&&v.markMatches),exactProbe:!!(probe&&probe.status==='realized'&&facts.probeChecks.at(-1).subjectMatches&&facts.probeChecks.at(-1).markMatches)});
    }
    if (f) {
      facts.forecastCount++;
      if (c.previewReadSeal !== digest(f)) throw Error('Autonomous forecast unavailable before action');
      if (!v.subjectMatches) facts.wrongSubjectCount++;
      if (c.id === 5 && m.status === 'realized' && v.subjectMatches && v.markMatches && v.landedOnValidMark) {
        facts.exactNamedTransfers++;
        sites.add(v.to.join());
        facts.firstNamed ??= {
          action: i + 1,
          from: v.from,
          marked: v.indicated,
          arrived: v.to,
          other: v.stationaryMerchantAfter,
        };
      }
    }
    walked.add(local(z.hero, run.start).join());
    s = z;
    if (z.complete) break;
  }
  facts.uniqueNamedSites = [...sites];
  facts.visitedCells = walked.size;
  (result.autonomous ??= []).push(facts);
}
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    matches210: result.at210.matches.length,
    from: result.at210.physical.from,
    arrival: result.at210.physical.to,
    officialL1: result.guided.officialL1,
    retained: result.guided.distinctBindings,
    reads: result.guided.l2.filter((x) => x.forecast).length,
    inheritedCorrect: result.guided.l2.filter(
      (x) =>
        x.forecast?.basis === 'observed_in_previous_level' &&
        x.forecast.status === 'realized' &&
        x.forecast.situation.markMatches &&
        x.forecast.situation.subjectMatches
    ).length,
  })
);
