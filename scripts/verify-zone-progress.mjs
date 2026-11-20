import { isDeepStrictEqual as eq } from 'node:util';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import { poseFamilyKey } from '../src/sic/pose-families.ts';
export function zoneProgressAudit(run, hash, partsAt, cache, commandKey) {
  const needed = new Map(),
    verified = new Set(),
    roles = new Map(),
    branches = [];
  const results = {
    tagged: 0,
    witnessedWalk: 0,
    modeledSubstrate: 0,
    closedCycles: 0,
    mobilityTests: 0,
    mobilityMoved: 0,
    mobilityRivalCompared: 0,
    mobilitySelective: 0,
    programs: 0,
    listed: 0,
    predictedCrossings: 0,
    attemptedWrites: 0,
    confirmedWrites: 0,
    arrivals: 0,
    uses: 0,
    official: 0,
    comparedWrites: 0,
    changedAgainstRepetition: 0,
  };
  const examples = [];
  const require = (ok, why) => {
    if (!ok) throw Error('Zone experiment: ' + why);
  };
  for (const e of run.preparation)
    for (const proof of [e.localRepeat, e.mechanism?.trial.cause, e.mobilityProbe?.test.cause])
      if (proof) {
        const old = needed.get(proof.revision);
        require(!old || eq(old, proof), 'unique local return');
        needed.set(proof.revision, proof);
      }
  function positions(frame, id, max) {
    const rows = cache.get(frame);
    require(rows, 'public frame missing');
    return rows
      .filter((e) => {
        if (e.area > max) return false;
        if (!roles.has(e.signature)) roles.set(e.signature, symbolicDigest(poseFamilyKey(e)).slice(0, 24));
        return roles.get(e.signature) === id;
      })
      .map((e) => [e.bbox[0] + e.bbox[2], e.bbox[1] + e.bbox[3]]);
  }
  const unique = (g) => (g.length === 1 ? g[0] : null);
  const delta = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const limit = (b) => (b.frame.length * b.frame[0].length) / 12;
  async function checkTag(cmd, i, before, after) {
    const t = needed.get(i + 2);
    if (!t) return;
    const max = limit(before),
      old = run.replayCommands[t.previous - 2];
    require(t.tag ===
      (t.connection === 'closed_public_cycle' ? 'stagnation_repeated_cycle' : 'stagnation_same_zone') &&
      t.previous >= 2 &&
      t.previous < t.revision &&
      old.from === cmd.from &&
      old.to === cmd.to &&
      commandKey(old) === t.op &&
      commandKey(cmd) === t.op, 'prior identical return');
    require(before.state === after.state &&
      before.levelsCompleted === after.levelsCompleted &&
      before.level === after.level &&
      after.availableActionIds.every((op) =>
        before.availableActionIds.includes(op)
      ), 'boundary or new action');
    await partsAt(after, cmd.to, i + 2);
    const get = (frame) => unique(positions(frame, t.actor, max));
    require(eq(get(cmd.from), t.from) && eq(get(cmd.to), t.to), 'named subject');
    const vectors = t.movementRefs.map((ref) => {
      const e = run.replayCommands[ref - 2];
      require(e && ref < t.revision && commandKey(e) !== t.op, 'ordinary evidence');
      const u = get(e.from),
        v = get(e.to);
      require(u && v, 'ordinary displacement');
      return delta(v, u);
    });
    if (t.connection === 'closed_public_cycle') {
      const c = t.cycle;
      require(c &&
        c.word.length > 0 &&
        c.word.length === c.refs.length &&
        t.revision - c.startRevision === c.word.length, 'closed word length');
      const steps = run.replayCommands.slice(c.startRevision - 1, i + 1);
      require(steps.length === c.word.length && steps[0].from === cmd.to, 'same starting and final image');
      steps.forEach((step, j) => {
        const ref = c.refs[j],
          proof = run.replayCommands[ref - 2];
        require(ref <= c.startRevision &&
          proof &&
          step.from === proof.from &&
          step.to === proof.to &&
          commandKey(proof) === c.word[j] &&
          commandKey(step) === c.word[j], 'each cycle edge already witnessed before replay');
      });
      results.closedCycles++;
    } else if (t.connection === 'witnessed_walk') {
      let p = t.from;
      for (const ref of t.walkRefs) {
        const e = run.replayCommands[ref - 2];
        require(e &&
          ref < t.revision &&
          commandKey(e) !== t.op &&
          eq(get(e.from), p), 'alternative route begins');
        const next = get(e.to);
        require(next && vectors.some((d) => eq(d, delta(next, p))), 'alternative route stroke');
        p = next;
      }
      require(eq(p, t.to), 'alternative route ends');
      results.witnessedWalk++;
    } else {
      require(t.connection === 'observed_substrate' &&
        t.floor !== null &&
        eq(t.route[0], t.from) &&
        eq(t.route.at(-1), t.to), 'modeled walk');
      const visited = new Set();
      for (const e of run.replayCommands.slice(0, i)) {
        const u = get(e.from),
          v = get(e.to);
        if (u && v && !eq(u, v)) {
          visited.add(u.join());
          visited.add(v.join());
        }
      }
      for (let j = 1; j < t.route.length; j++) {
        const p = t.route[j];
        require(vectors.some((d) => eq(d, delta(p, t.route[j - 1]))) &&
          (visited.has(p.join()) ||
            before.frame[Math.floor(p[1] / 2)]?.[Math.floor(p[0] / 2)] === t.floor), 'supported route');
      }
      results.modeledSubstrate++;
    }
    results.tagged++;
    verified.add(t.revision);
  }
  const named = (frame, p, max) => {
    const actor = unique(positions(frame, p.p, max)),
      group = positions(frame, p.c, max),
      remaining = group.filter((e) => !p.fixed.some((f) => eq(e, f)));
    const site =
      group.length === p.fixed.length + 1 &&
      p.fixed.every((f) => group.some((e) => eq(f, e))) &&
      remaining.length === 1
        ? remaining[0]
        : null;
    return { actor, site };
  };
  async function mobility(e, cmd, i, board, prior) {
    const out = e.mobilityProbe,
      t = out.test,
      max = limit(prior);
    require(hash(t) === cmd.mobilitySeal &&
      commandKey(cmd) === t.op &&
      t.before.endsWith(':revision:' + (i + 1) + ':frame:' + cmd.from) &&
      verified.has(t.cause.revision) &&
      t.cause.revision <= i + 1, 'untried control commitment');
    require(!run.replayCommands
      .slice(0, i)
      .some((c) => c.from === cmd.from && commandKey(c) === t.op), 'previously tried public control');
    require(eq(unique(positions(cmd.from, t.actor, max)), t.from), 'mobility subject');
    await partsAt(board, cmd.to, i + 2);
    const live =
      board.level === prior.level &&
      board.state === prior.state &&
      board.levelsCompleted === prior.levelsCompleted;
    let moves = 0;
    for (const [j, s] of t.sites.entries()) {
      const binding = { p: t.actor, c: s.role, fixed: s.peers };
      require(eq(named(cmd.from, binding, max).site, s.at), 'mobility precondition');
      const actual = named(cmd.to, binding, limit(board)).site,
        d = out.outcomes[j];
      const status = !live ? 'inapplicable' : !actual ? 'unobserved' : eq(actual, s.at) ? 'still' : 'moved';
      require(d.status === status && eq(d.actual, actual) && d.role === s.role, 'mobility measurement');
      if (status === 'moved') {
        moves++;
        branches.push({ i, length: 1, cause: t.cause.op, plan: binding, at: actual, mobility: true });
      }
    }
    require(moves === out.moved && out.outcomes.length === t.sites.length, 'number of measured effects');
    results.mobilityTests++;
    results.mobilityMoved += moves;
  }
  async function record(e, cmd, i, board, prior) {
    const m = e.mechanism,
      t = m.trial,
      p = t.plan,
      step = p.steps[t.index],
      max = limit(prior);
    require(hash(t) === cmd.mechanismSeal &&
      step &&
      commandKey(cmd) === step.op &&
      t.cause.revision <= i + 1 &&
      verified.has(t.cause.revision), 'prospective experiment and cause');
    const before = named(cmd.from, p, max);
    require(eq(before.actor, step.p) && eq(before.site, step.c), 'preparation origin');
    if (step.stage === 'read' && p.indicator)
      require(positions(cmd.from, p.indicator, max).some((v) =>
        eq(v, step.to)
      ), 'visible predicted indication');
    await partsAt(board, cmd.to, i + 2);
    const actual = named(cmd.to, p, limit(board)),
      live = board.level === prior.level && board.state === prior.state;
    const matched = !!(
      live &&
      eq(actual.actor, step.to) &&
      (step.stage === 'read' || step.stage === 'use' || eq(actual.site, step.placed))
    );
    const won = board.levelsCompleted > prior.levelsCompleted || board.state === 'WIN';
    require(eq(actual, m.actual) &&
      matched === m.matched &&
      won === m.won &&
      m.stage === step.stage, 'physical intervention outcome');
    if (!t.index) {
      results.programs++;
      results.listed += t.options.length;
      if (p.arrival) results.predictedCrossings++;
    }
    if (step.stage === 'write') {
      results.attemptedWrites++;
      if (matched) {
        results.confirmedWrites++;
        branches.push({ i: i - t.index, length: t.index + 1, cause: t.cause.op, plan: p, at: step.placed });
      }
    }
    if (matched && step.stage === 'read') results.arrivals++;
    if (matched && step.stage === 'use') results.uses++;
    if (won) results.official++;
    if (examples.length < 6 && ((matched && step.stage === 'write') || !t.index))
      examples.push({
        action: i + 1,
        repeated: t.cause.op,
        command: step.op,
        stage: step.stage,
        matched,
        at: p.initialC,
        placed: p.placed,
        arrival: p.arrival,
      });
  }
  async function compare(reopen, dispatch) {
    const decode = (q) => {
      const [op, pt] = q.split(':'),
        [x, y] = pt?.split(',').map(Number) ?? [];
      return { id: Number(op.slice(6)), ...(pt ? { data: { x, y } } : {}) };
    };
    for (const v of branches) {
      let b = await reopen();
      for (const c of run.replayCommands.slice(0, v.i)) b = await dispatch(c);
      require(hash(b.frame).slice(0, 16) === run.replayCommands[v.i].from, 'branch origin');
      const input = decode(v.cause),
        initial = b;
      for (let j = 0; j < v.length; j++) {
        if (
          !b.availableActionIds.includes(input.id) ||
          b.state !== initial.state ||
          b.level !== initial.level
        )
          break;
        b = await dispatch(input);
      }
      if (b.state !== initial.state || b.level !== initial.level) continue;
      const frame = hash(b.frame).slice(0, 16);
      await partsAt(b, frame, 1);
      const rival = named(frame, v.plan, limit(b));
      if (!rival.site) continue;
      if (v.mobility) {
        results.mobilityRivalCompared++;
        if (!eq(rival.site, v.at)) results.mobilitySelective++;
        continue;
      }
      results.comparedWrites++;
      if (!eq(rival.site, v.at)) results.changedAgainstRepetition++;
    }
  }
  return { results, examples, checkTag, record, mobility, compare };
}
