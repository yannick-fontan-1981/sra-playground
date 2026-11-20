import { position } from './verify-native-inverse-frames.mjs';

const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
export function wordAudit(run, partsAt, cache, commandKey, hash) {
  const stats = {
    started: 0,
    bare: 0,
    prepared: 0,
    durationControl: 0,
    reuses: 0,
    complete: 0,
    sameClockTests: 0,
    firstMarkerMotion: 0,
    firstTravellerMotion: 0,
    controlDependentEntries: 0,
    necessaryWins: 0,
    exactReuse: 0,
    selectiveMarkerMotion: 0,
  };
  const trials = new Map(),
    branches = [],
    examples = [];
  const won = (b) => b.levelsCompleted > run.initialCompleted || b.level > run.start || b.state === 'WIN';
  async function record(e, i, cmd, b, previousState) {
    const t = e.territorial.trial,
      v = t.capacity,
      step = t.plan.program[t.cursor],
      q = t.goal;
    if (!v || !['capacity_input', 'capacity_read'].includes(step.stage)) return;
    const insist = (x, msg) => {
      if (!x) throw Error('Invalid capacity word ' + msg + ' at ' + (i + 1));
    };
    const first = i - t.cursor,
      role = { signature: q.actor, fixed: [] },
      site = t.plan.site;
    if (!t.cursor) {
      const program = t.plan.program.map((x) => x.op),
        prefix = v.firstIsPreparation ? [v.arm === 'durationControl' ? v.rival : v.preparation] : [];
      if (v.preparation) {
        insist(v.rival !== v.preparation, 'duration control');
        insist(sameList(program, [...prefix, ...v.word]), 'forecast program');
      }
      const j = v.preceding !== null ? i + v.preceding - e.revision : i;
      insist(run.replayCommands[j]?.from === v.rootFrame, 'root image');
      if (v.preceding !== null)
        insist(
          j === i - 1 && (!v.preparation || commandKey(run.replayCommands[j]) === v.preparation),
          'preceding preparation'
        );
      if (v.arm === 'reuse') {
        insist(
          v.refs?.length >= 3 &&
            v.refs.every(
              (ref) =>
                Number.isInteger(i + ref - e.revision) &&
                i + ref - e.revision >= 0 &&
                i + ref - e.revision < i
            ),
          'prior intervention controls'
        );
      }
      trials.set(first, {
        j,
        first,
        role,
        site,
        v,
        root: t.plan.siteAt,
        foot: q.foothold,
        goal: q,
        arm: v.arm,
        afterFirst: null,
      });
      stats.started++;
      if (v.arm === 'reuse') stats.reuses++;
      else stats[v.arm]++;
    }
    const x = trials.get(first);
    insist(x && x.arm === v.arm, 'continuous word');
    if (step.stage !== 'capacity_read') return;
    stats.complete++;
    const live = !won(b) && b.state === previousState && b.level === run.start;
    const parts = await partsAt(b, cmd.to, i + 2),
      marker = live ? position(parts, site) : null,
      patient = live ? position(parts, x.role) : null;
    if (v.arm === 'reuse') {
      stats.exactReuse += Number(same(marker, t.plan.ideal) && same(patient, v.expectedPatient));
      return;
    }
    if (v.arm !== 'prepared') return;
    const prefix = v.preceding !== null ? 0 : 1,
      word = run.replayCommands.slice(first + prefix, i + 1);
    insist(sameList(word.map(commandKey), v.word), 'completed suffix');
    branches.push({
      ...x,
      i,
      word,
      marker,
      patient,
      won: won(b),
      crossed: e.territorial.crossed,
      rival: v.rival,
    });
  }
  async function compare(open, dispatch) {
    const state = async (b) =>
      !won(b) && b.state !== 'GAME_OVER' ? await partsAt(b, hash(b.frame).slice(0, 16), 0) : null;
    for (const x of branches) {
      const reset = async () => {
        let b = await open();
        for (let j = 0; j < x.j; j++) {
          b = await dispatch(run.replayCommands[j]);
          if (!hash(b.frame).startsWith(run.replayCommands[j].to))
            throw Error('Divergent conditional word origin');
        }
        return b;
      };
      const initial = await reset(),
        base = await state(initial),
        p = position(base, x.role),
        r = position(base, x.site);
      const actualPrep = run.replayCommands[x.j],
        post = cache.get(actualPrep.to);
      const runWord = async (b) => {
        for (const c of x.word) {
          if (won(b) || b.state === 'GAME_OVER') break;
          b = await dispatch(c);
        }
        return b;
      };
      const bare = await runWord(initial),
        alone = await state(bare),
        p0 = position(alone, x.role),
        r0 = position(alone, x.site);
      const newMarker = !!x.marker && same(r, r0) && same(r, position(post, x.site)) && !same(r, x.marker);
      const newPatient = !!x.patient && same(p, p0) && same(p, position(post, x.role)) && !same(p, x.patient);
      const inside = (a) =>
        a &&
        a[0] >= 0 &&
        a[0] < x.goal.width &&
        x.goal.territory.some(([aa, k]) => {
          const d = a[1] * x.goal.width + a[0] - aa;
          return d >= 0 && d % x.goal.stride[0] === 0 && d / x.goal.stride[0] < k;
        });
      const entry = x.crossed && !!p0 && !inside(p0),
        winning = x.won && !won(bare);
      stats.firstMarkerMotion += Number(newMarker);
      stats.firstTravellerMotion += Number(newPatient);
      stats.controlDependentEntries += Number(entry);
      stats.necessaryWins += Number(winning);
      let matchedClock = false,
        selective = false;
      if (x.rival && (newMarker || newPatient || entry || winning)) {
        let z = await reset();
        const key = x.rival.split(':'),
          id = Number(key[0].slice(6)),
          [x0, y0] = key[1]?.split(',').map(Number) ?? [];
        if (z.availableActionIds.includes(id)) {
          z = await dispatch({ id, ...(id === 6 ? { data: { x: x0, y: y0 } } : {}) });
          const mid = await state(z);
          matchedClock =
            same(position(mid, x.role), position(post, x.role)) &&
            same(position(mid, x.site), position(post, x.site));
          const last = await runWord(z),
            v = await state(last),
            alt = position(v, x.site);
          selective = newMarker && matchedClock && !!alt && !same(alt, x.marker);
          stats.sameClockTests += Number(matchedClock);
          stats.selectiveMarkerMotion += Number(selective);
        }
      }
      if ((newMarker || newPatient || entry || winning) && examples.length < 8)
        examples.push({
          i: x.i + 1,
          a: commandKey(actualPrep),
          q: x.word.map(commandKey),
          p,
          r,
          newMarker,
          newPatient,
          selective,
          matchedClock,
          entry,
          winning,
        });
    }
  }
  return { record, compare, stats, examples };
}
