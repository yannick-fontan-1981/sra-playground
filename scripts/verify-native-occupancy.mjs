import { isDeepStrictEqual as equal } from 'node:util';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import { poseFamilyKey } from '../src/sic/pose-families.ts';

const delta = (a, b) => [a[0] - b[0], a[1] - b[1]];
const moved = (a, b) => a && b && !equal(a, b);

export function occupancyAudit(run, hash, partsAt, cache, commandKey) {
  const results = {
    programs: 0,
    prepared: 0,
    placements: 0,
    placementsExact: 0,
    arrivals: 0,
    arrivalsExact: 0,
    preparedArrivals: 0,
    newToCommand: 0,
    newToSubject: 0,
    uses: 0,
    usesExact: 0,
    completePrograms: 0,
    official: 0,
    comparedArrivals: 0,
    selective: 0,
    omittedPreparations: 0,
    preparationNeeded: 0,
    matchedPreparations: 0,
    equalLengthPreparationNeeded: 0,
    comparedUses: 0,
    useChanged: 0,
  };
  const examples = [],
    branches = [],
    checked = new Map(),
    keys = new Map();
  let width = 0,
    height = 0,
    last = null;
  const won = (b) => b.levelsCompleted > run.initialCompleted || b.level > run.start || b.state === 'WIN';
  function view(key) {
    if (checked.has(key)) return checked.get(key);
    const parts = cache.get(key);
    if (!parts) throw Error('Missing historical observation ' + key);
    const v = new Map();
    for (const e of parts) {
      if (e.area > (width * height) / 12) continue;
      if (!keys.has(e.signature)) keys.set(e.signature, symbolicDigest(poseFamilyKey(e)).slice(0, 24));
      const id = keys.get(e.signature),
        [x, y, right, bottom] = e.bbox;
      v.set(id, v.has(id) ? null : [x + right, y + bottom]);
    }
    checked.set(key, v);
    return v;
  }
  async function record(e, cmd, i, board, priorState) {
    width = board.frame[0].length;
    height = board.frame.length;
    const out = e.occupancy,
      { plan: p, index } = out.trial,
      step = p.steps[index],
      first = i - index;
    const check = (v, what) => {
      if (!v) throw Error('Occupancy ' + what + ' at command ' + (i + 1));
    };
    check(hash(out.trial) === cmd.occupancySeal && commandKey(cmd) === step.op, 'action seal');
    if (index === 0) {
      results.programs++;
      if (p.steps[0].stage === 'place') results.prepared++;
    } else
      check(
        last?.i === i - 1 && last.matched && last.index + 1 === index && equal(last.plan, p),
        'continued program'
      );
    await partsAt(board, cmd.to, i + 2);
    const orig = view(cmd.from),
      after = view(cmd.to),
      a = orig.get(p.p),
      b = orig.get(p.r);
    check(equal(a, step.p) && (step.stage === 'use' || equal(b, step.r)), 'origin');
    const historical = (ref) => {
      const j = i + ref - e.revision;
      check(j >= 0 && j < first, 'prior evidence');
      const c = run.replayCommands[j],
        v = view(c.from),
        w = view(c.to);
      return { op: commandKey(c), a: v.get(p.p), b: v.get(p.r), z: w.get(p.p), r: w.get(p.r) };
    };
    check(step.refs.length > 0 && step.refs.every((v) => p.refs.includes(v)), 'evidence list');
    for (const ref of step.refs) {
      const h = historical(ref);
      if (step.stage === 'place')
        check(
          h.op === step.op &&
            h.a &&
            h.z &&
            h.b &&
            h.r &&
            equal(delta(h.z, h.a), delta(step.nextP, step.p)) &&
            equal(delta(h.r, h.b), delta(step.nextR, step.r)),
          'joint displacement'
        );
      if (step.stage === 'use')
        check(
          h.op === step.op && h.a && h.z && equal(delta(h.z, h.a), delta(step.nextP, step.p)),
          'use displacement'
        );
      if (step.stage === 'occupy') {
        check(equal(step.nextP, step.r), 'occupancy prediction');
        if (p.basis === 'previous_occupancy')
          check(h.op === step.op && moved(h.a, h.z) && equal(h.z, h.b), 'previous occupancy');
        else
          check(
            moved(h.a, h.z) && moved(h.b, h.r) && !equal(delta(h.z, h.a), delta(h.r, h.b)),
            'previous co-motion'
          );
      }
    }
    const z = after.get(p.p) ?? null,
      mark = after.get(p.r) ?? null,
      official = won(board);
    const matched =
      !official &&
      board.state === priorState &&
      equal(z, step.nextP) &&
      (!step.nextR || equal(mark, step.nextR));
    check(
      equal(out.arrived, z) &&
        equal(out.marker, mark) &&
        matched === out.matched &&
        official === out.won &&
        out.stage === step.stage,
      'physical observation'
    );
    check(
      e.result ===
        (official ? 'occupancy_completion' : matched ? 'occupancy_confirmed' : 'occupancy_refuted'),
      'verdict'
    );
    if (step.stage === 'place') {
      results.placements++;
      results.placementsExact += Number(matched);
    }
    if (step.stage === 'occupy') {
      results.arrivals++;
      results.arrivalsExact += Number(matched);
      if (matched) {
        results.preparedArrivals += Number(index > 0);
        let commandSite = false,
          subjectSite = false;
        for (const c of run.replayCommands.slice(0, first)) {
          const pre = view(c.from),
            post = view(c.to);
          if (equal(pre.get(p.p), z) || equal(post.get(p.p), z)) subjectSite = true;
          if (
            commandKey(c) === step.op &&
            equal(pre.get(p.r), z) &&
            equal(post.get(p.p), z) &&
            moved(pre.get(p.p), z)
          )
            commandSite = true;
        }
        results.newToCommand += Number(!commandSite);
        results.newToSubject += Number(!subjectSite);
        if (examples.length < 10)
          examples.push({
            command: i + 1,
            steps: index,
            origin: p.origin,
            marker: p.marker,
            arrived: z,
            newToCommand: !commandSite,
            newToSubject: !subjectSite,
          });
        branches.push({ first, i, p, kind: 'occupy', z });
      }
    }
    if (step.stage === 'use') {
      results.uses++;
      results.usesExact += Number(matched);
      if (matched) branches.push({ first, i, p, kind: 'use', z });
    }
    results.completePrograms += Number(matched && index === p.steps.length - 1);
    results.official += Number(official);
    last = { i, index, plan: p, matched };
  }
  async function compare(reopen, dispatch) {
    const history = run.replayCommands;
    async function restore(i) {
      let b = await reopen();
      for (const c of history.slice(0, i)) b = await dispatch(c);
      if (hash(b.frame).slice(0, 16) !== history[i].from) throw Error('Occupancy control prefix ' + i);
      return b;
    }
    async function pos(b, id) {
      if (won(b) || b.state === 'GAME_OVER') return null;
      const key = hash(b.frame).slice(0, 16);
      await partsAt(b, key, 0);
      return view(key).get(id) ?? null;
    }
    function available(b, except) {
      return b.availableActionIds.filter((id) => id !== 6 && id !== except).map((id) => ({ id }));
    }
    for (const { first, i, p, kind, z } of branches) {
      if (kind === 'use') {
        await restore(i - 1);
        const control = await dispatch(history[i]);
        results.comparedUses++;
        results.useChanged += Number(Boolean(moved(await pos(control, p.p), z)));
        continue;
      }
      const initial = await restore(i);
      let tried = false,
        selective = false;
      for (const other of available(initial, history[i].id)) {
        if (tried) await restore(i);
        tried = true;
        if (moved(await pos(await dispatch(other), p.p), z)) {
          selective = true;
          break;
        }
      }
      results.comparedArrivals += Number(tried);
      results.selective += Number(selective);
      if (first < i) {
        const start = await restore(first),
          bare = await dispatch(history[i]);
        results.omittedPreparations++;
        results.preparationNeeded += Number(Boolean(moved(await pos(bare, p.p), z)));
        let matched = false,
          different = false;
        for (const other of available(start, history[first].id)) {
          await restore(first);
          let b = await dispatch(other);
          for (let j = first + 1; j < i && b.state === start.state && !won(b); j++)
            b = await dispatch(history[j]);
          if (b.state !== start.state || won(b) || !moved(await pos(b, p.r), p.landing)) continue;
          matched = true;
          different = Boolean(moved(await pos(await dispatch(history[i]), p.p), z));
          if (different) break;
        }
        results.matchedPreparations += Number(matched);
        results.equalLengthPreparationNeeded += Number(different);
      }
    }
  }
  return { record, compare, results, examples };
}
