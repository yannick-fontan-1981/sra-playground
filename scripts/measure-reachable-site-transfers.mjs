import { hash } from './sic-study-source-replay.mjs';
import { add, diff, length, alternatives } from './source-corresponding-sites.mjs';

// Source laboratory with prefix restoration. A whole menu is predicted before any
// of its missing commands is issued. Keep paths to physically measured scenes only.
export async function measureReachableSites(
  { open, act, active, win, measure, root, buttons, singles, stratified = false },
  limit = 96
) {
  const origin = hash(root),
    seen = new Set([origin]),
    queue = [],
    hist = new Map(),
    visited = new Map(),
    distantSeen = new Set();
  const result = {
    expanded: 0,
    commands: 0,
    proposals: 0,
    measured: 0,
    hits: 0,
    followed: 0,
    certifiedWins: 0,
    ordinaryWins: 0,
    firstWin: null,
    examples: [],
    depths: {},
    mixedDepths: {},
  };
  const commandSeen = new Set();
  const reached = (b, path, parts) => {
    if (!parts) return;
    const key = hash(b);
    for (const [id, e] of parts.ids) {
      const loc = visited.get(id) ?? new Set();
      loc.add(e.position.join());
      visited.set(id, loc);
    }
    if (!seen.has(key)) {
      seen.add(key);
      queue.push({ path, key, parts });
    }
  };
  function record(start, end, cmd) {
    if (!start || !end) return;
    for (const [id, e] of start.ids) {
      const target = end.ids.get(id);
      if (!target) continue;
      const d = diff(target.position, e.position);
      if (!length(d)) continue;
      const k = id + '/' + cmd,
        bucket = hist.get(k) ?? new Map(),
        hit = bucket.get(d.join()) ?? { d, n: 0 };
      hit.n++;
      bucket.set(d.join(), hit);
      hist.set(k, bucket);
    }
  }
  function ordinary(id, cmd) {
    const votes = [...(hist.get(id + '/' + cmd)?.values() ?? [])].sort((a, b) => b.n - a.n);
    return votes.length && votes[0].n !== votes[1]?.n ? votes[0].d : null;
  }
  function restore(node) {
    let b = open();
    for (const op of node.path) b = act(op);
    if (hash(b) !== node.key) throw Error('Divergent measured approach');
    return b;
  }
  const initial = await measure(root);
  reached(root, [], initial);
  for (const cmd of buttons) {
    open();
    const next = act(cmd);
    if (!active(next)) continue;
    const parts = singles.get(cmd);
    record(initial, parts, cmd);
    reached(next, [cmd], parts);
  }
  const classVisits = new Map();
  function programClass(path) {
    const kinds = path.map((k) => (k.includes(':') ? 'at' : 'key'));
    return kinds.filter((k, i) => k !== kinds[i - 1]).join('/');
  }
  for (let i = 0; i < queue.length && i < limit; i++) {
    if (stratified) {
      // Share trials across attained depths and operand kinds. Deep mixed programs
      // therefore compete within their own stratum, even with many clickable loci.
      const desired = (i % 8) + 1;
      let best = i,
        bestWeight = Infinity;
      for (let j = i; j < queue.length; j++) {
        const path = queue[j].path,
          depth = path.length,
          group = depth + ':' + programClass(path);
        const weight = Math.abs(depth - desired) * 1000 + (classVisits.get(group) ?? 0);
        if (weight < bestWeight) {
          best = j;
          bestWeight = weight;
        }
      }
      [queue[i], queue[best]] = [queue[best], queue[i]];
    }
    const node = queue[i];
    const depth = node.path.length,
      kind = programClass(node.path),
      group = depth + ':' + kind;
    classVisits.set(group, (classVisits.get(group) ?? 0) + 1);
    result.depths[depth] = (result.depths[depth] ?? 0) + 1;
    if (kind.includes('/')) result.mixedDepths[depth] = (result.mixedDepths[depth] ?? 0) + 1;
    result.expanded++;
    const forecasts = [];
    for (const cmd of node.parts.buttons ?? buttons) {
      if (commandSeen.has(node.key + '/' + cmd)) continue;
      const terms = [];
      for (const [id, e] of node.parts.ids) {
        const d = ordinary(id, cmd);
        if (!d) continue;
        const plans = alternatives(e, d, node.parts.parts, node.parts.groups, root.frame);
        const remote = plans.find((p) => length(diff(p.landing, e.position)) >= 3 * length(d));
        terms.push({
          id,
          from: e.position,
          d,
          remote,
          following: remote ? add(remote.landing, d) : null,
          first: !distantSeen.has(id),
          fresh: remote && !visited.get(id)?.has(remote.landing.join()),
        });
      }
      forecasts.push({ cmd, terms });
    }
    for (const { cmd, terms } of forecasts) {
      let b = restore(node);
      if (!b.availableActionIds.includes(Number(cmd.split(':')[0].slice(6)))) continue;
      commandSeen.add(node.key + '/' + cmd);
      b = act(cmd);
      result.commands++;
      const parts = await measure(b);
      if (win(b)) {
        result.ordinaryWins++;
        result.firstWin ??= [...node.path, cmd];
      }
      const matches = [];
      for (const f of terms) {
        const to = parts?.ids.get(f.id)?.position;
        if (to) {
          const v = diff(to, f.from);
          if (length(v) >= 3 * length(f.d) && length(diff(v, f.d)) >= 3 * length(f.d)) distantSeen.add(f.id);
        }
        if (!f.remote) continue;
        result.proposals++;
        if (to) result.measured++;
        if (to?.join() === f.remote.landing.join()) matches.push(f);
      }
      record(node.parts, parts, cmd);
      reached(b, [...node.path, cmd], parts);
      if (matches.length) {
        const after = b.availableActionIds.includes(Number(cmd.split(':')[0].slice(6))) ? act(cmd) : null,
          continuation = after ? await measure(after) : null;
        for (const f of matches) {
          const next = continuation?.ids.get(f.id)?.position,
            predicted = f.following;
          const followed = next?.join() === predicted.join();
          result.hits++;
          result.followed += Number(followed);
          result.certifiedWins += Number(!!after && win(after));
          result.examples.push({
            word: node.path,
            cmd,
            from: f.from,
            ordinary: f.d,
            to: f.remote.landing,
            entry: f.remote.entry,
            exit: f.remote.exit,
            firstDistant: f.first,
            newLocation: f.fresh,
            following: next ?? null,
            followed,
            win: !!after && win(after),
          });
        }
      }
    }
  }
  return result;
}
