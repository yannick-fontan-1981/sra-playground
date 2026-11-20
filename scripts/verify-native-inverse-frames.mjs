// Replay evidence for a native placement in a learned moving coordinate frame.
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
function position(parts, role) {
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
      commandKey(cmd) !== (stage === 'place' ? p.a : stage === 'arrive' ? p.q : p.follow.op)
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
      const stride = p.placement.map((v, j) => (v - p.at[j]) / p.length);
      for (const ref of p.actuatorRefs) {
        const a = edge(ref),
          left = position(cache.get(a.from), anchor),
          right = position(cache.get(a.to), anchor);
        if (
          commandKey(a) !== p.a ||
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
      if (p.basis === 'single_response') {
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
      trials.set(start, { id, start, p, step: -1, reused: !!t.identifiedRef });
      stats.plans++;
    }
    const track = trials.get(start);
    if (!track || track.id !== id || track.step !== k - 1) fail('Disconnected inverse placement');
    track.step = k;
    stats.actions++;
    stats.official += Number(won(board));
    const expected =
      stage === 'place'
        ? p.patient.map((v, j) => p.from[j] + ((v - p.from[j]) * (k + 1)) / p.length)
        : stage === 'arrive'
          ? p.to
          : p.follow.to;
    const reference =
      stage === 'place' ? p.placement.map((v, j) => p.at[j] + ((v - p.at[j]) * (k + 1)) / p.length) : null;
    const dest = position(after, patient),
      r = position(after, anchor);
    const exact = eq(dest, expected) && (!reference || eq(r, reference));
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
      track.arrived = dest;
      track.staged = position(before, patient);
      track.exact = exact && !won(board);
      if (track.exact && p.basis === 'single_response') established.set(i, p);
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
      for (let j = 0; j < t.start; j++) {
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
      stats.separated += Number(!!dependent && t.p.basis === 'single_response' && eq(t.staged, t.p.from));
      if (dependent && examples.length < 4)
        examples.push({
          first: t.start + 1,
          setup: t.p.a,
          length: t.p.length,
          command: t.p.q,
          reference: t.p.at,
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
        stats.dependentUse += Number(
          !won(later) && !!v && !eq(v, t.continued) && !eq(t.continued, t.arrived)
        );
      }
    }
  }
  return { stats, examples, record, compare };
}
