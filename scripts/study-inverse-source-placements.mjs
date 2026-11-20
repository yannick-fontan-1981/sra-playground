// Source-only experiment. Learn from zero or one preparation, choose a pair, then replay it.
export async function studyInversePlacements({
  commands,
  replay,
  parts,
  key,
  won,
  legal,
  act,
  transport,
  use,
  compose,
}) {
  const active = (b) => b && !won(b) && b.state !== 'GAME_OVER';
  // Both suffix actions must be executed; an earlier win cannot verify the proposed use.
  function works(b) {
    if (!legal(b, transport)) return false;
    const arrival = act(transport);
    return !!active(arrival) && legal(arrival, use) && won(act(use));
  }
  const controls = [];
  const delta = (from, to, j) => {
    const out = new Map();
    for (const [id, p] of from) {
      if (!to.has(id)) continue;
      const [x, y] = p.split(',').map(Number),
        [u, v] = to.get(id).split(',').map(Number);
      out.set(j + '/' + id, [u - x, v - y].join());
    }
    return out;
  };
  for (const prep of [[], ...commands.map((op) => [op])]) {
    const b = replay(prep);
    if (!active(b)) continue;
    const positions = await parts(b),
      state = key(b),
      effects = new Map();
    let success = false;
    if (legal(b, transport)) {
      const later = act(transport);
      if (active(later)) {
        const landing = await parts(later);
        for (const [k, v] of delta(positions, landing, 1)) effects.set(k, v);
        if (legal(later, use)) {
          const end = act(use);
          success = won(end);
          if (active(end)) for (const [k, v] of delta(landing, await parts(end), 2)) effects.set(k, v);
        }
      }
    }
    controls.push({ prep, state, positions, success, effects });
  }
  const base = controls[0];
  if (!base || base.prep.length || base.success) return { excluded: 'suffix already works or no control' };
  const positive = controls.filter((r) => r.success);
  const negative = controls.filter((r) => !r.success);
  const roles = [...base.positions.keys()]
    .filter(
      (id) =>
        controls.every((r) => r.positions.has(id)) &&
        controls.some((r) => r.positions.get(id) !== base.positions.get(id))
    )
    .sort();
  const vector = (ps) => roles.map((id) => ps.get(id)).join('|');
  const visible = new Set(controls.map((r) => r.state));
  const positiveLayouts = new Set(positive.map((r) => vector(r.positions)));
  const usable = negative.filter((r) => r.prep.length === 1);
  const changes = new Map(
    usable.map((r) => [
      r,
      new Set(
        [...r.effects].filter(([k, v]) => base.effects.has(k) && base.effects.get(k) !== v).map(([k]) => k)
      ),
    ])
  );
  const facts = [];
  const point = (at) => at.split(',').map(Number);
  // An absolute coordinate or an offset between two mobile roles must distinguish all measured
  // successes from all measured failures. Identical public scenes are never counted as extra votes.
  for (const [i, a] of roles.entries()) {
    for (const b of [null, ...roles.slice(i + 1)]) {
      for (const axis of [0, 1]) {
        const value = (ps) => point(ps.get(a))[axis] - (b ? point(ps.get(b))[axis] : 0);
        if (!positive.length) continue;
        const goal = value(positive[0].positions);
        if (
          positive.every((r) => value(r.positions) === goal) &&
          negative.every((r) => value(r.positions) !== goal)
        )
          facts.push({ a, b, axis, goal, value });
      }
    }
  }
  const exclude = {
    controls: controls.length,
    winningControls: positive.length,
    mobileRoles: roles.length,
    facts: facts.length,
  };
  const plans = [];
  for (const a of usable) {
    for (const b of usable) {
      const positions = new Map();
      for (const role of roles) {
        const origin = point(base.positions.get(role)),
          x = point(a.positions.get(role)),
          y = point(b.positions.get(role));
        positions.set(role, [x[0] + y[0] - origin[0], x[1] + y[1] - origin[1]].join());
      }
      const matched = facts.filter((f) => f.value(positions) === f.goal).length;
      const da = changes.get(a),
        db = changes.get(b);
      const complement = Math.min(
        [...da].filter((k) => !db.has(k)).length,
        [...db].filter((k) => !da.has(k)).length
      );
      const score = compose ? complement : matched;
      plans.push({ prep: [a.prep[0], b.prep[0]], positions, score });
    }
  }
  // Keep the forecast fixed even if the physical replay refutes the first proposal.
  plans.sort((a, b) => b.score - a.score || a.prep.join('/').localeCompare(b.prep.join('/'), 'en'));
  const first = plans.find((p) => p.score > 0);
  const unique = new Map();
  const completed = new Map();
  let verified = null,
    freshPairs = 0,
    winningPairs = 0;
  for (const plan of plans) {
    const b = replay(plan.prep);
    if (!active(b)) continue;
    const id = key(b),
      newScene = !visible.has(id);
    let observed = unique.get(id);
    if (!observed) {
      const ps = await parts(b),
        comparable = roles.length > 0 && roles.every((r) => ps.has(r));
      observed = {
        success: works(b),
        newScene,
        novelLayout: comparable && !positiveLayouts.has(vector(ps)),
        actual: comparable ? vector(ps) : null,
      };
      unique.set(id, observed);
    } else if (observed.success !== works(b)) {
      throw Error('Same public configuration produced conflicting uses');
    }
    completed.set(plan.prep.join('/'), observed);
    if (newScene) {
      freshPairs++;
      if (observed.success) winningPairs++;
    }
    if (plan === first) {
      verified = {
        prep: plan.prep,
        score: plan.score,
        predicted: vector(plan.positions),
        exactPose: observed.actual !== null && observed.actual === vector(plan.positions),
        newScene,
        novelLayout: observed.novelLayout,
        won: observed.success,
      };
    }
  }
  const outcomes = [...unique.values()].filter((s) => s.newScene);
  const asymmetric = plans.filter(({ prep }) => {
    const forward = completed.get(prep.join('/')),
      reverse = completed.get([prep[1], prep[0]].join('/'));
    return forward?.newScene && forward.success && reverse && !reverse.success;
  });
  const orderedWitness = asymmetric[0]?.prep ?? null;
  const combinedWitness =
    plans.find((p) => {
      const r = completed.get(p.prep.join('/'));
      return r?.newScene && r.success;
    })?.prep ?? null;
  async function traceWitness([a, b]) {
    const arms = [];
    for (const prep of [[], [a], [b], [a, b], [b, a]]) {
      const ready = replay(prep);
      if (!active(ready) || !legal(ready, transport)) return null;
      const pre = await parts(ready),
        next = act(transport);
      if (!active(next) || !legal(next, use)) return null;
      const post = await parts(next);
      arms.push({ prep, pre, post, won: won(act(use)) });
    }
    const forward = arms[3],
      reverse = arms[4];
    const differences = [];
    for (const [role, origin] of forward.pre) {
      if (!arms.every((s) => s.pre.has(role) && s.post.has(role))) continue;
      if (origin === reverse.pre.get(role) && forward.post.get(role) === reverse.post.get(role)) continue;
      differences.push({
        role,
        before: arms.map((s) => s.pre.get(role)),
        after: arms.map((s) => s.post.get(role)),
      });
    }
    return { arms: arms.map(({ prep, won }) => ({ prep, won })), differences };
  }
  return {
    ...exclude,
    plans: plans.length,
    freshPairs,
    winningPairs,
    distinctNewScenes: outcomes.length,
    newWinningScenes: outcomes.filter((s) => s.success).length,
    newWinningLayouts: new Set(outcomes.filter((s) => s.success && s.novelLayout).map((s) => s.actual)).size,
    orderedWitnessCount: asymmetric.length,
    orderedWitness,
    combinedWitness,
    witness: combinedWitness ? await traceWitness(orderedWitness ?? combinedWitness) : null,
    first: first ? (verified ?? { prep: first.prep, score: first.score, won: false, inactive: true }) : null,
  };
}
