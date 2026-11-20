import { imageKey } from '../src/sic/relative-edits.ts';

const normalize = (v) =>
  Array.isArray(v)
    ? v.map(normalize)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, normalize(v[k])])
        )
      : v;
const eq = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
function rolePositions(parts, roles) {
  return roles.map(({ signature, fixed }) => {
    const all = [...new Set(parts.filter((e) => e.signature === signature).map((e) => e.position.join()))];
    const remaining = all.filter((p) => !fixed.includes(p));
    return all.length === fixed.length + 1 && remaining.length === 1 && fixed.every((p) => all.includes(p))
      ? remaining[0].split(',').map(Number)
      : null;
  });
}
export function contextAudit(run, hash, partsAt, commandKey) {
  const sites = {
    actions: 0,
    plans: 0,
    placements: 0,
    contacts: 0,
    binds: 0,
    exercised: 0,
    exact: 0,
    uses: 0,
    exactUses: 0,
    reuse: 0,
    reuseExact: 0,
    independent: 0,
    newDriver: 0,
    newRecipient: 0,
    independentExact: 0,
    independentUse: 0,
    dependentWins: 0,
    relocatedDriver: 0,
    relocatedRecipient: 0,
    relocatedUse: 0,
    distinctOpenings: 0,
    official: 0,
  };
  const transports = {
    actions: 0,
    plans: 0,
    returned: 0,
    exact: 0,
    uses: 0,
    exactUses: 0,
    imageExact: 0,
    official: 0,
  };
  const trials = new Map(),
    bindings = new Map(),
    checks = [],
    transitions = new Map();
  function fail(s, i) {
    throw Error(s + ' at command ' + (i + 1));
  }
  async function check(e, cmd, i, prior, board) {
    const v = e.instrument ?? e.transport,
      p = v.plan,
      site = !!e.instrument;
    if (hash(p) !== (site ? cmd.siteSeal : cmd.transportSeal)) fail('Missing forecast digest', i);
    const boundary =
      board.levelsCompleted > run.initialCompleted || board.state === 'WIN' || board.level > run.start;
    if (boundary !== v.won) fail('False completion receipt', i);
    const before = rolePositions(prior, p.roles),
      after = rolePositions(await partsAt(board, cmd.to, i + 2), p.roles);
    const same = (a, b) => !!a && !!b && eq(a, b),
      action = commandKey(cmd);
    if (!site) {
      const w = [p.a, p.b, ...p.inverse, p.use],
        last = w.length - 1,
        k = v.index;
      if (w[k] !== action || !eq(v.observed, after.every(Boolean) ? after : null))
        fail('Transport witness diverged', i);
      const want = k === last ? p.afterUse : k === last - 1 ? p.placed : null;
      if (v.matched !== (want ? eq(want, after) : null)) fail('Wrong transported positions', i);
      if (
        v.imageMatched !==
        (k === last - 1 && p.predictedImage ? imageKey(board.frame) === p.predictedImage : null)
      )
        fail('Wrong predicted image', i);
      if (k > v.first && !eq(transitions.get(i - 1), p)) fail('Disconnected transport actions', i);
      transitions.set(i, p);
      transports.actions++;
      transports.plans += Number(k === v.first);
      transports.returned += Number(k === last - 1);
      transports.exact += Number(k === last - 1 && v.matched && !boundary);
      transports.imageExact += Number(v.imageMatched === true);
      transports.uses += Number(k === last);
      transports.exactUses += Number(k === last && v.matched && !boundary);
      transports.official += Number(boundary);
      return;
    }
    if (hash(v.predicted) !== cmd.siteStepSeal) fail('Missing pre-action position digest', i);
    const key = v.chosen + '/' + hash(normalize(p));
    if (!trials.has(key)) {
      trials.set(key, i);
      sites.plans++;
      sites.reuse += Number(p.learnedRef !== null);
    }
    const expected = {
      bare: p.operand,
      walk: p.route[v.index]?.op,
      bind: p.operand,
      back: v.back?.[v.index],
      control: p.control.op,
      exercise: p.control.op,
      continue: p.control.op,
    };
    if (expected[v.stage] !== action || !eq(before, v.from) || !eq(after, v.to))
      fail('Wrong site intervention', i);
    sites.actions++;
    sites.official += Number(boundary);
    if (v.stage === 'walk' && !boundary) {
      const reached = same(after[0], p.route[v.index].to);
      if ((e.result === 'site_placement_verified') !== reached) fail('Wrong navigation forecast', i);
      sites.placements += Number(reached);
      sites.contacts += Number(e.result === 'site_contact_probe');
    }
    if (v.stage === 'bind') {
      bindings.set(key, i);
      sites.binds++;
    }
    if (v.stage === 'exercise') {
      const bind = bindings.get(key);
      if (bind !== i - 1) fail('Unwitnessed binding action', i);
      const physical =
        !boundary &&
        same(after[p.member], v.predicted?.[p.member] ?? p.desired) &&
        !same(before[p.member], after[p.member]);
      if (physical !== e.result.startsWith('site_predicted_')) fail('Wrong site destination forecast', i);
      sites.exercised++;
      sites.exact += Number(physical);
      sites.reuseExact += Number(physical && p.learnedRef !== null);
      checks.push({ p, bind, key, i, boundary, after, before, physical });
    }
    if (v.stage === 'continue') {
      sites.uses++;
      const exact = !boundary && v.predicted?.some((q, j) => same(q, after[j]) && !same(q, before[j]));
      if (Boolean(exact) !== (e.result === 'site_continuation_verified'))
        fail('Wrong subsequent prediction', i);
      sites.exactUses += Number(exact);
      const x = checks.at(-1);
      if (x?.key === key && x.i === i - 1) x.use = { after, exact: !!exact, boundary };
    }
  }
  async function branches(open, dispatch) {
    const openings = new Set();
    for (const c of checks) {
      let b = await open();
      if (hash(b.frame) !== run.initial) fail('Counterfactual initial state diverged', 0);
      for (let j = 0; j < c.bind; j++) {
        const a = run.replayCommands[j];
        b = await dispatch(a);
        if (hash(b.frame).slice(0, 16) !== a.to) fail('Counterfactual prefix diverged', j);
      }
      const read = async (b) => rolePositions(await partsAt(b, hash(b.frame).slice(0, 16), 0), c.p.roles);
      const from = await read(b),
        alone = await dispatch(run.replayCommands[c.i]),
        to = await read(alone);
      const won = (z) => z.level > run.start || z.levelsCompleted > run.initialCompleted || z.state === 'WIN';
      const gained = from.map(
        (p, j) =>
          !c.boundary &&
          !won(alone) &&
          p &&
          c.before[j] &&
          eq(p, c.before[j]) &&
          eq(p, to[j]) &&
          c.after[j] &&
          !eq(p, c.after[j])
      );
      const relocated = from.map(
        (p, j) =>
          !c.boundary &&
          !won(alone) &&
          p &&
          c.before[j] &&
          !eq(p, c.before[j]) &&
          eq(p, to[j]) &&
          c.after[j] &&
          !eq(c.before[j], c.after[j])
      );
      sites.relocatedDriver += Number(!!relocated[0]);
      sites.relocatedRecipient += Number(!!relocated[1]);
      for (let j = 0; j < 2; j++)
        if (gained[j] || relocated[j]) {
          openings.add(
            JSON.stringify([
              c.p.roles[j].signature,
              c.p.operand,
              c.p.control.op,
              from[j],
              c.before[j],
              c.after[j],
            ])
          );
        }
      sites.distinctOpenings = openings.size;
      sites.independent++;
      sites.newDriver += Number(!!gained[0]);
      sites.newRecipient += Number(!!gained[1]);
      sites.independentExact += Number(!!gained[c.p.member] && c.physical);
      sites.dependentWins += Number(c.boundary && !won(alone));
      if (c.use && !won(alone)) {
        const other = await dispatch(run.replayCommands[c.i + 1]),
          continued = await read(other);
        sites.relocatedUse += Number(
          relocated.some(
            (ok, j) =>
              ok &&
              c.use.after[j] &&
              continued[j] &&
              !eq(c.use.after[j], c.after[j]) &&
              !eq(c.use.after[j], continued[j])
          )
        );
        sites.independentUse += Number(
          gained.some(
            (ok, j) =>
              ok &&
              c.use.after[j] &&
              continued[j] &&
              !eq(c.use.after[j], c.after[j]) &&
              !eq(c.use.after[j], continued[j])
          )
        );
      }
    }
  }
  const retained = {
    actions: 0,
    probes: 0,
    forecasts: 0,
    landings: 0,
    exact: 0,
    uses: 0,
    awakened: 0,
    exactUses: 0,
    official: 0,
  };
  const previous = new Map();
  function retainedEvent(e, cmd, i, board) {
    const v = e.retained,
      t = v.trial,
      p = t.prediction,
      k = t.index,
      entry = t.entry,
      last = entry.undo.length;
    if (hash(t) !== cmd.retainedSeal) fail('Missing retained-edit commitment', i);
    const key = hash(normalize(entry)),
      command = k === 0 ? entry.b.cmd : k <= last ? entry.undo[k - 1].cmd : p.use;
    if (commandKey(cmd) !== command) fail('Retained-edit command mismatch', i);
    if (k > 0) {
      const prev = previous.get(key);
      if (!prev || prev.i !== i - 1 || prev.k !== k - 1 || !eq(prev.p, p))
        fail('Disconnected retained-edit forecast', i);
    }
    if (k === 0) {
      const ref = (r) => run.replayCommands[i + r - e.revision];
      const own = ref(entry.b.ref),
        a = ref(entry.a.ref);
      if (
        !a ||
        !own ||
        a.to !== cmd.from ||
        a.from !== own.from ||
        own.to !== own.from ||
        commandKey(own) !== entry.b.cmd ||
        commandKey(a) !== entry.a.cmd
      )
        fail('Unmatched retained-edit controls', i);
      let at = a.to;
      for (const undo of entry.undo) {
        const back = ref(undo.ref);
        if (!back || at !== back.from || commandKey(back) !== undo.cmd) fail('Missing return witness', i);
        at = back.to;
      }
      if (at !== a.from) fail('Return failed to restore source', i);
    }
    const won =
        board.level > run.start || board.levelsCompleted > run.initialCompleted || board.state === 'WIN',
      exact = !!p && imageKey(board.frame) === p.image;
    if (
      won !== v.won ||
      (!won &&
        k === last &&
        k > 0 &&
        e.result !== 'retained_boundary' &&
        exact !== (e.result === 'retained_landing_verified'))
    )
      fail('Incorrect retained-edit outcome', i);
    retained.actions++;
    retained.probes += Number(k === 0);
    retained.forecasts += Number(k === 0 && !!v.forecast);
    retained.landings += Number(k === last);
    retained.exact += Number(k === last && !won && exact);
    retained.uses += Number(k > last);
    retained.awakened += Number(k > last && !won && cmd.to !== cmd.from);
    retained.exactUses += Number(k > last && !won && p.next === imageKey(board.frame));
    retained.official += Number(won);
    previous.set(key, { i, k, p: v.forecast });
  }
  return { sites, transports, retained, retainedEvent, check, branches };
}
