// Replay evidence for a native placement in a learned moving coordinate frame.
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
export function position(parts, role) {
  if (!parts) return null;
  const g = parts.filter((e) => e.signature === role.signature),
    fixed = role.fixed;
  if (g.length !== fixed.length + 1 || !fixed.every((k) => g.some((e) => e.position.join() === k)))
    return null;
  return g.find((e) => !fixed.includes(e.position.join()))?.position ?? null;
}
export function inverseFrameAudit(run, hash, partsAt, cache, commandKey) {
  const stats = {
    plans: 0,
    actions: 0,
    placed: 0,
    arrivals: 0,
    exact: 0,
    uses: 0,
    exactUses: 0,
    controls: 0,
    dependent: 0,
    sameStart: 0,
    dependentUse: 0,
    official: 0,
    identifications: 0,
    separated: 0,
    alreadyPrepared: 0,
    witnessedRoutes: 0,
    routedArrivals: 0,
    matchedBoth: 0,
    naturalUse: 0,
    reused: 0,
    reusedExact: 0,
  };
  const examples = [];
  const established = new Map();
  const trials = new Map(),
    branches = [];
  const won = (b) => b.levelsCompleted > run.initialCompleted || b.level > run.start || b.state === 'WIN';
  async function record(e, cmd, i, board) {
    const v = e.frame,
      t = v.trial,
      p = t.plan,
      k = t.step,
      patient = p.role,
      anchor = { signature: p.anchor, fixed: [] };
    const start = i - k,
      stage = k < p.length ? 'place' : k === p.length ? 'arrive' : 'use';
    const fail = (msg) => {
      throw Error(msg + ' at ' + (i + 1));
    };
    if (
      hash(t) !== cmd.frameSeal ||
      stage !== v.stage ||
      commandKey(cmd) !==
        (stage === 'place' ? (p.via?.[k]?.op ?? p.a) : stage === 'arrive' ? p.q : p.follow.op)
    )
      fail('Missing frame forecast');
    const norm = (x) =>
      Array.isArray(x)
        ? x.map(norm)
        : x && typeof x === 'object'
          ? Object.fromEntries(
              Object.keys(x)
                .sort()
                .map((k) => [k, norm(x[k])])
            )
          : x;
    const id = hash(norm(p)),
      before = cache.get(cmd.from),
      after = await partsAt(board, cmd.to, i + 2);
    if (!k) {
      if (!eq(position(before, patient), p.from) || !eq(position(before, anchor), p.at))
        fail('Wrong inverse placement origin');
      const edge = (ref) => {
        const j = i + ref - e.revision;
        if (j < 0 || j >= i) fail('Future frame evidence');
        return run.replayCommands[j];
      };
      const natural = p.basis === 'observed_preparation';
      if (
        natural &&
        (p.length !== 0 || !p.beforeReference || !eq(p.placement, p.at) || p.actuatorRefs.length !== 1)
      )
        fail('Bad prepared binding');
      const stride = p.placement.map((v, j) =>
        natural ? v - p.beforeReference[j] : (v - p.at[j]) / p.length
      );
      if (p.via) {
        if (!p.length || p.via.length !== p.length || p.actuatorRefs.length !== p.length)
          fail('Broken arrangement route');
        let head = cmd.from;
        for (const [j, step] of p.via.entries()) {
          const past = edge(step.ref);
          if (
            p.actuatorRefs[j] !== step.ref ||
            past.from !== head ||
            commandKey(past) !== step.op ||
            !eq(position(cache.get(past.to), anchor), step.at) ||
            !eq(position(cache.get(past.to), patient), step.patient)
          )
            fail('Unwitnessed arrangement route');
          head = past.to;
        }
        if (!eq(p.via.at(-1).at, p.placement) || !eq(p.via.at(-1).patient, p.patient))
          fail('Incorrect terminal placement');
        stats.witnessedRoutes++;
      }
      for (const ref of p.via ? [] : p.actuatorRefs) {
        const a = edge(ref),
          left = position(cache.get(a.from), anchor),
          right = position(cache.get(a.to), anchor);
        if (
          commandKey(a) !== p.a ||
          (natural &&
            (a.to !== cmd.from ||
              !eq(left, p.beforeReference) ||
              !eq(right, p.at) ||
              !eq(position(cache.get(a.from), patient), p.from))) ||
          !left ||
          !right ||
          !eq(
            right.map((v, j) => v - left[j]),
            stride
          )
        )
          fail('Ungrounded actuator');
        if (
          p.basis &&
          p.pairedSetup &&
          !eq(position(cache.get(a.from), patient), position(cache.get(a.to), patient))
        )
          fail('Unmatched patient in actuator calibration');
      }
      const supports = [];
      for (const ref of p.refs) {
        const q = edge(ref),
          at = cache.get(q.from),
          out = position(cache.get(q.to), patient),
          s = position(at, patient),
          r = position(at, anchor);
        if (commandKey(q) !== p.q || !out || !s || !r) fail('Missing response witness');
        const axis = (k, j) => (k === 'self' ? s[j] : k === 'world' ? 0 : r[j]);
        if (
          !eq(
            out,
            p.axes.map((k, j) => axis(k, j) + p.offset[j])
          )
        )
          fail('Wrong moving-frame relation');
        supports.push({ s, r, out, image: q.from });
      }
      if (
        p.via &&
        (!eq(
          p.to,
          p.placement.map((v, j) => v + p.offset[j])
        ) ||
          !eq(
            p.direct,
            p.at.map((v, j) => v + p.offset[j])
          ))
      )
        fail('Incorrect projected route arrival');
      if (p.basis === 'single_response' || natural) {
        const first = supports[0];
        if (
          supports.length !== 1 ||
          !p.alternatives ||
          !eq(p.alternatives.world, first.out) ||
          !eq(
            p.alternatives.traveller,
            first.out.map((v, j) => p.from[j] + v - first.s[j])
          ) ||
          eq(p.to, p.alternatives.world) ||
          eq(p.to, p.alternatives.traveller) ||
          p.a === p.q
        )
          fail('Unseparated frame hypotheses');
        stats.identifications++;
        if (natural) {
          if (
            !eq(
              p.direct,
              p.beforeReference.map((v, j) => v + p.offset[j])
            ) ||
            !eq(
              p.to,
              p.placement.map((v, j) => v + p.offset[j])
            )
          )
            fail('Bad destination equation');
          if (p.follow) {
            const f = edge(p.follow.refs[0]);
            if (
              commandKey(f) !== p.follow.op ||
              !eq(position(cache.get(f.from), patient), p.to) ||
              !eq(position(cache.get(f.to), patient), p.follow.to)
            )
              fail('Unwitnessed continuation');
          }
          stats.alreadyPrepared++;
        }
      } else if (
        !supports.some((x) =>
          supports.some(
            (y) =>
              x.image !== y.image &&
              p.axes.some(
                (axis, j) => axis === p.anchor && x.r[j] !== y.r[j] && x.r[j] - y.r[j] !== x.s[j] - y.s[j]
              )
          )
        )
      )
        fail('Unidentified moving reference');
      if (t.identifiedRef) {
        const previous = established.get(i + t.identifiedRef - e.revision);
        if (
          !previous ||
          JSON.stringify(norm([previous.q, previous.role, previous.axes, previous.offset])) !==
            JSON.stringify(norm([p.q, p.role, p.axes, p.offset])) ||
          eq(previous.placement, p.placement)
        )
          fail('Unwitnessed relation reuse');
        stats.reused++;
      }
      trials.set(start, {
        id,
        start,
        p,
        step: -1,
        reused: !!t.identifiedRef,
        controlAt: natural ? i + p.actuatorRefs[0] - e.revision : start,
      });
      stats.plans++;
    }
    const track = trials.get(start);
    if (!track || track.id !== id || track.step !== k - 1) fail('Disconnected inverse placement');
    track.step = k;
    stats.actions++;
    stats.official += Number(won(board));
    const expected =
      stage === 'place'
        ? (p.via?.[k]?.patient ?? p.patient.map((v, j) => p.from[j] + ((v - p.from[j]) * (k + 1)) / p.length))
        : stage === 'arrive'
          ? p.to
          : p.follow.to;
    const reference =
      stage === 'place'
        ? (p.via?.[k]?.at ?? p.placement.map((v, j) => p.at[j] + ((v - p.at[j]) * (k + 1)) / p.length))
        : null;
    const dest = position(after, patient),
      r = position(after, anchor);
    const via = p.via?.[k],
      replayed = !via || run.replayCommands[i + via.ref - e.revision]?.to === cmd.to;
    const exact = replayed && eq(dest, expected) && (!reference || eq(r, reference));
    if (
      !eq(v.expected, expected) ||
      JSON.stringify(dest) !== JSON.stringify(v.patient) ||
      JSON.stringify(r) !== JSON.stringify(v.anchor) ||
      v.exact !== exact ||
      v.won !== won(board)
    )
      fail('Wrong frame outcome');
    stats.placed += Number(stage === 'place' && k === p.length - 1 && exact && !won(board));
    if (stage === 'arrive') {
      stats.arrivals++;
      stats.exact += Number(exact && !won(board));
      stats.routedArrivals += Number(!!p.via && exact && !won(board));
      track.arrived = dest;
      track.staged = position(before, patient);
      track.exact = exact && !won(board);
      if (track.exact && p.basis) established.set(i, p);
      stats.reusedExact += Number(track.exact && track.reused);
      branches.push(track);
    }
    if (stage === 'use') {
      stats.uses++;
      stats.exactUses += Number(exact && !won(board));
      track.continued = exact && !won(board) ? dest : null;
    }
  }
  async function compare(open, dispatch) {
    for (const t of branches) {
      let b = await open();
      for (let j = 0; j < t.controlAt; j++) {
        b = await dispatch(run.replayCommands[j]);
        if (hash(b.frame).slice(0, 16) !== run.replayCommands[j].to)
          throw Error('Divergent native omission prefix');
      }
      const i = t.start + t.p.length,
        direct = await dispatch(run.replayCommands[i]);
      const at = async (b) => position(await partsAt(b, hash(b.frame).slice(0, 16), 0), t.p.role);
      const former = await at(direct),
        dependent =
          t.exact && !won(direct) && former && t.staged && !eq(t.arrived, former) && !eq(t.arrived, t.staged);
      stats.controls++;
      stats.dependent += Number(!!dependent);
      stats.sameStart += Number(!!dependent && eq(t.staged, t.p.from));
      stats.separated += Number(!!dependent && !!t.p.basis && eq(t.staged, t.p.from));
      stats.matchedBoth += Number(
        !!dependent && t.p.basis === 'observed_preparation' && eq(former, t.p.direct)
      );
      if (dependent && examples.length < 4)
        examples.push({
          first: t.start + 1,
          setup: t.p.a,
          length: t.p.length,
          command: t.p.q,
          reference: t.p.beforeReference ?? t.p.at,
          placement: t.p.placement,
          traveller: t.p.from,
          afterSetup: t.staged,
          withoutSetup: former,
          arrival: t.arrived,
          follow: t.continued ?? null,
        });
      if (dependent && t.continued) {
        const later = await dispatch(run.replayCommands[i + 1]),
          v = await at(later);
        if (t.p.basis === 'observed_preparation' && !won(later) && v && !eq(v, t.continued)) {
          let alt = await open();
          for (let j = 0; j < t.start; j++) {
            alt = await dispatch(run.replayCommands[j]);
            if (hash(alt.frame).slice(0, 16) !== run.replayCommands[j].to)
              throw Error('Divergent shortcut control');
          }
          const omit = await dispatch(run.replayCommands[i + 1]),
            coordinate = await at(omit);
          stats.naturalUse += Number(
            !won(omit) && !!coordinate && !eq(coordinate, t.continued) && !eq(t.continued, t.arrived)
          );
        }
        stats.dependentUse += Number(
          !won(later) && !!v && !eq(v, t.continued) && !eq(t.continued, t.arrived)
        );
      }
    }
  }
  return { stats, examples, record, compare };
}
