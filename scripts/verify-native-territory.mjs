import { isDeepStrictEqual as equal } from 'node:util';
import { position } from './verify-native-inverse-frames.mjs';

const same = (a, b) => a != null && b != null && a[0] === b[0] && a[1] === b[1];

const inside = (g, ranges, p) =>
  p &&
  p[0] >= 0 &&
  p[0] < g.width &&
  p[1] >= 0 &&
  ranges.some(([first, count]) => {
    const n = p[1] * g.width + p[0] - first;
    return n >= 0 && n % g.stride[0] === 0 && n / g.stride[0] < count;
  });
export function territoryAudit(run, hash, partsAt, cache, commandKey) {
  const seenAnalogies = new Set();
  const plans = new Map(),
    branches = [],
    examples = [];
  const stats = {
    plans: 0,
    actions: 0,
    withKnownLimit: 0,
    limitsTested: 0,
    limitsHeld: 0,
    displacementTests: 0,
    placements: 0,
    reopened: 0,
    entries: 0,
    previouslyUnvisitedEntries: 0,
    uses: 0,
    entryNeedsPreparation: 0,
    preparedAtSamePose: 0,
    official: 0,
  };
  const won = (b) => b.levelsCompleted > run.initialCompleted || b.level > run.start || b.state === 'WIN';
  async function record(e, cmd, i, b, previousState) {
    const v = e.territorial,
      t = v.trial,
      g = t.goal,
      plan = t.plan,
      step = plan.program[t.cursor];
    const first = i - t.cursor,
      role = { signature: g.actor, fixed: [] };
    function insist(ok, why) {
      if (!ok) throw Error('Territory ' + why + ' at action ' + (i + 1));
    }
    insist(
      step && commandKey(cmd) === step.op && hash(t) === cmd.territorySeal && v.stage === step.stage,
      'unsealed action'
    );
    const start = plans.get(first);
    const history = (ref) => {
      const at = i + ref - e.revision;
      insist(Number.isInteger(at) && at >= 0 && at < i, 'future evidence');
      return run.replayCommands[at];
    };
    const before = position(cache.get(cmd.from), role);
    if (!t.cursor) {
      insist(
        !start &&
          same(before, g.from) &&
          inside(g, g.home, before) &&
          !inside(g, g.territory, before) &&
          inside(g, g.territory, g.foothold),
        'goal geometry'
      );
      insist(
        g.home.reduce((n, [, k]) => n + k, 0) === g.homeSize &&
          g.territory.reduce((n, [, k]) => n + k, 0) === g.outsideSize &&
          g.outsideSize >= 2,
        'region size'
      );
      insist(
        !g.home.some(([a, n]) =>
          Array.from({ length: n }, (_, j) => a + j * g.stride[0]).some((k) =>
            inside(g, g.territory, [k % g.width, Math.floor(k / g.width)])
          )
        ),
        'overlapping regions'
      );
      if (g.basis === 'translated_orbit') {
        const a = g.analogy,
          id = JSON.stringify([g.actor, a?.landmark, a?.near, a?.far, a?.refs]);
        insist(a && same([a.far[0] - a.near[0], a.far[1] - a.near[1]], a.shift), 'invalid translation');
        if (!seenAnalogies.has(id)) {
          const markers = cache.get(cmd.from).filter((e) => e.signature === a.landmark);
          insist(
            markers.some((e) => same(e.position, a.near)) && markers.some((e) => same(e.position, a.far)),
            'unwitnessed homologous sites'
          );
          const forward = new Map(),
            back = new Map();
          function add(g, k, v) {
            const s = g.get(k) ?? new Set();
            s.add(v);
            g.set(k, s);
          }
          for (const ref of a.refs) {
            const action = history(ref),
              p = position(cache.get(action.from), role),
              z = position(cache.get(action.to), role);
            insist(p && z && !same(p, z), 'unwitnessed orbit segment');
            add(forward, p.join(), z.join());
            add(back, z.join(), p.join());
          }
          function component(g) {
            const s = new Set([before.join()]);
            for (const k of s) for (const n of g.get(k) ?? []) s.add(n);
            return s;
          }
          const backToStart = component(back),
            orbit = [...component(forward)].filter((k) => backToStart.has(k));
          insist(orbit.length >= 3 && orbit.length === g.homeSize, 'insufficient closed orbit');
          const homes = new Set(orbit);
          for (const [start, count] of g.territory)
            for (let j = 0; j < count; j++) {
              const n = start + j * g.stride[0],
                origin = [(n % g.width) - a.shift[0], Math.floor(n / g.width) - a.shift[1]];
              insist(homes.has(origin.join()), 'target outside translated orbit');
            }
          seenAnalogies.add(id);
        }
      }
      for (const stroke of g.ops) {
        const d = history(stroke.ref),
          a = position(cache.get(d.from), role),
          z = position(cache.get(d.to), role);
        insist(
          commandKey(d) === stroke.op && a && z && same([z[0] - a[0], z[1] - a[1]], stroke.d),
          'unwitnessed motion'
        );
      }
      for (const ref of plan.refs) history(ref);
      if (g.failed !== null) {
        const d = history(g.failed);
        insist(
          commandKey(d) === g.ordinary &&
            same(position(cache.get(d.from), role), g.rim) &&
            same(position(cache.get(d.to), role), g.rim),
          'unwitnessed limit'
        );
        stats.withKnownLimit++;
      }
      plans.set(first, {
        goal: g,
        key: plan.key,
        role,
        prev: null,
        firstIntervention: null,
        fresh: !run.replayCommands
          .slice(0, i)
          .some((c) => inside(g, g.territory, position(cache.get(c.from), role))),
        crossed: false,
        placed: false,
      });
      stats.plans++;
    } else {
      insist(
        start && start.key === plan.key && equal(start.goal, g) && start.prev === i - 1,
        'discontinuous experiment'
      );
    }
    const root = plans.get(first);
    if (step.from) insist(same(before, step.from), 'changed origin');
    if (step.stage === 'approach' || step.stage === 'explore') {
      const support = history(step.ref),
        a = position(cache.get(support.from), role),
        z = position(cache.get(support.to), role);
      insist(
        a &&
          z &&
          commandKey(support) === step.op &&
          step.to &&
          step.from &&
          same([z[0] - a[0], z[1] - a[1]], [step.to[0] - step.from[0], step.to[1] - step.from[1]]),
        'unsupported path step'
      );
    }
    root.prev = i;
    if (root.firstIntervention === null && step.stage !== 'approach') root.firstIntervention = i;
    const parts = await partsAt(b, cmd.to, i + 2),
      landed = position(parts, role),
      mark = plan.site ? position(parts, plan.site) : null;
    const prevMark = plan.site ? position(cache.get(cmd.from), plan.site) : null;
    const terminal = won(b),
      live = b.state === previousState && b.level === run.start;
    const inGoal = !!(live && inside(g, g.territory, landed));
    const displaced = !!(
      prevMark &&
      mark &&
      !same(prevMark, mark) &&
      same(prevMark, step.marker) &&
      same(mark, step.expectedMarker)
    );
    insist(
      equal(v.landed, landed) && equal(v.marker, mark) && v.crossed === inGoal && v.won === terminal,
      'incorrect outcome'
    );
    if (g.basis) {
      const exact = same(landed, step.to);
      const contact = live && (!step.to || exact || (prevMark && mark && !same(prevMark, mark)) || inGoal);
      if (step.stage === 'capacity_return') {
        const d = history(step.ref);
        insist(
          commandKey(d) === step.op && cmd.from === d.from && d.to === step.expectedFrame,
          'unwitnessed return to a control'
        );
      }
      const success =
        step.stage === 'capacity_return'
          ? live && cmd.to === step.expectedFrame
          : step.stage === 'capacity_input'
            ? live
            : step.stage === 'capacity_read'
              ? inGoal ||
                (!!mark &&
                  !!plan.ideal &&
                  !!plan.siteAt &&
                  !same(mark, plan.siteAt) &&
                  same(mark, plan.ideal))
              : step.stage === 'displace'
                ? live && displaced
                : step.stage === 'land'
                  ? inGoal
                  : step.stage === 'interact'
                    ? !!contact
                    : exact;
      insist(v.success === success, 'incorrect step verdict');
    }
    stats.actions++;
    stats.official += Number(terminal);
    if (step.stage === 'displace') {
      stats.displacementTests++;
      if (displaced) {
        stats.placements++;
        root.placed = true;
      }
    }
    if (step.stage === 'challenge' && step.op === g.ordinary && same(before, g.rim)) {
      stats.limitsTested++;
      stats.limitsHeld += Number(live && same(before, landed));
      stats.reopened += Number(live && g.failed !== null && same(landed, g.blocked) && root.placed);
    }
    if (inGoal && !inside(g, g.territory, before) && !root.crossed) {
      stats.entries++;
      stats.previouslyUnvisitedEntries += Number(root.fresh);
      root.crossed = true;
      const sample = {
        action: i + 1,
        kind: plan.kind,
        stage: step.stage,
        from: before,
        to: landed,
        home: g.homeSize,
        target: g.outsideSize,
        foothold: g.foothold,
        knownLimit: g.failed !== null,
        previouslyUnvisited: root.fresh,
        placed: root.placed,
      };
      if (examples.length < 12) examples.push(sample);
      if (root.firstIntervention !== null && root.firstIntervention < i)
        branches.push({ i, j: root.firstIntervention, role, g, before, sample });
    }
    if (
      step.stage === 'explore' &&
      root.crossed &&
      inGoal &&
      inside(g, g.territory, before) &&
      !same(before, landed) &&
      same(landed, step.to)
    )
      stats.uses++;
  }
  async function compare(open, dispatch) {
    for (const t of branches) {
      let b = await open();
      for (let k = 0; k < t.j; k++) {
        b = await dispatch(run.replayCommands[k]);
        if (!hash(b.frame).startsWith(run.replayCommands[k].to)) throw Error('Divergent territory control');
      }
      const sameOrigin = same(t.before, position(cache.get(run.replayCommands[t.j].from), t.role));
      b = await dispatch(run.replayCommands[t.i]);
      const p =
        won(b) || b.state === 'GAME_OVER'
          ? null
          : position(await partsAt(b, hash(b.frame).slice(0, 16), 0), t.role);
      const dependent = !!p && !inside(t.g, t.g.territory, p);
      Object.assign(t.sample, { withoutPreparation: p, sameOrigin, dependent });
      stats.entryNeedsPreparation += Number(dependent);
      stats.preparedAtSamePose += Number(dependent && sameOrigin);
    }
  }
  return { stats, examples, record, compare };
}
