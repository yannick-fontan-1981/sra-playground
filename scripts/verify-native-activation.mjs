import { position } from './verify-native-inverse-frames.mjs';
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
export function activationAudit(run, hash, partsAt, cache, commandKey) {
  const stats = {
    tested: 0,
    motion: 0,
    unlocked: 0,
    changed: 0,
    reuses: 0,
    exactReuses: 0,
    controlledReuses: 0,
    win: 0,
    necessaryWin: 0,
  };
  const branches = [],
    seen = new Map(),
    examples = [];
  const won = (b) => b.levelsCompleted > run.initialCompleted || b.level > run.start || b.state === 'WIN';
  async function record(e, cmd, i, b) {
    const v = e.activation,
      p = v.plan,
      idx = (ref) => i + ref - e.revision;
    const j = idx(p.write),
      a = run.replayCommands[j],
      role = p.role,
      anchor = { signature: p.anchor, fixed: [] };
    if (
      j < 0 ||
      j >= i ||
      !a ||
      hash(p) !== cmd.activationSeal ||
      commandKey(a) !== p.a ||
      a.to !== cmd.from ||
      commandKey(cmd) !== p.q ||
      p.q === p.a ||
      !eq(position(cache.get(a.from), role), p.from) ||
      !eq(position(cache.get(cmd.from), role), p.from) ||
      !eq(position(cache.get(a.from), anchor), p.before) ||
      !eq(position(cache.get(cmd.from), anchor), p.placed) ||
      eq(p.before, p.placed)
    )
      throw Error('Invalid activation intervention ' + i);
    if (p.bare != null) {
      const k = idx(p.bare),
        z = run.replayCommands[k];
      if (
        k < 0 ||
        k >= i ||
        z.from !== a.from ||
        commandKey(z) !== p.q ||
        !eq(position(cache.get(z.from), role), p.from) ||
        !eq(position(cache.get(z.to), role), p.from)
      )
        throw Error('Unwitnessed inactive control');
    }
    if (p.useRef != null) {
      const prev = seen.get(idx(p.useRef));
      if (
        !prev?.landed ||
        eq(prev.p.from, p.from) ||
        prev.p.q !== p.q ||
        prev.p.anchor !== p.anchor ||
        JSON.stringify(prev.p.role) !== JSON.stringify(role) ||
        !(prev.p.binding === p.binding || eq(prev.p.placed, p.placed)) ||
        !eq(
          p.expected,
          p.from.map((v, j) => v + prev.landed[j] - prev.p.from[j])
        )
      )
        throw Error('Unwitnessed activation transfer');
    } else if (p.expected) throw Error('Unmeasured activation destination');
    const terminal = won(b),
      parts = await partsAt(b, cmd.to, i + 2),
      landed = terminal || b.state === 'GAME_OVER' ? null : position(parts, role);
    const moved = !!landed && !eq(landed, p.from),
      exact = eq(landed, p.expected);
    if (
      v.terminal !== terminal ||
      v.moved !== moved ||
      v.exact !== exact ||
      (landed ? !eq(landed, v.arrived) : v.arrived != null)
    )
      throw Error('Activation outcome mismatch ' + i);
    const branch = { p, j, i, landed, moved, exact, terminal };
    branches.push(branch);
    seen.set(i, branch);
    stats.tested++;
    stats.motion += Number(moved);
    stats.win += Number(terminal);
    stats.reuses += Number(p.expected != null);
    stats.exactReuses += Number(exact);
  }
  async function compare(open, dispatch) {
    for (const v of branches) {
      if (!v.moved && !v.terminal) continue;
      let b = await open();
      for (let k = 0; k < v.j; k++) {
        b = await dispatch(run.replayCommands[k]);
        if (!hash(b.frame).startsWith(run.replayCommands[k].to)) throw Error('Divergent activation control');
      }
      b = await dispatch(run.replayCommands[v.i]);
      const directWin = won(b),
        alone =
          directWin || b.state === 'GAME_OVER'
            ? null
            : position(await partsAt(b, hash(b.frame).slice(0, 16), 0), v.p.role);
      const changed = v.moved && !!alone && !eq(alone, v.landed),
        unlocked = changed && eq(alone, v.p.from),
        necessaryWin = v.terminal && !directWin;
      stats.changed += Number(changed);
      stats.unlocked += Number(unlocked);
      stats.controlledReuses += Number(changed && v.exact);
      stats.necessaryWin += Number(necessaryWin);
      if ((unlocked || necessaryWin || (changed && v.exact)) && examples.length < 5)
        examples.push({
          action: v.i + 1,
          a: v.p.a,
          q: v.p.q,
          initial: v.p.before,
          placed: v.p.placed,
          from: v.p.from,
          alone,
          arrived: v.landed,
          expected: v.p.expected,
          necessaryWin,
        });
    }
  }
  return { record, compare, stats, examples };
}
