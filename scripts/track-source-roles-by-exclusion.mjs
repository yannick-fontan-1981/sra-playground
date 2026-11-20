// If every other occurrence stays put, the remaining occurrence is the role that moved.
// Discard the assignment when an interchangeable neighbour also moves or visibility changes.
export function observeByExclusion(initial, read) {
  const groups = new Map(),
    keys = new WeakMap();
  for (const e of initial.parts) {
    if (!e.identity_ambiguous) continue;
    const g = groups.get(e.signature) ?? [];
    g.push(e);
    groups.set(e.signature, g);
  }
  const tracks = [...groups].filter(([, g]) => g.length >= 2 && g.length <= 12);
  return async function (board) {
    const s = await read(board);
    if (keys.has(s)) return keys.get(s);
    const ids = new Map(s.ids);
    for (const [sig, home] of tracks) {
      const current = s.parts.filter((e) => e.signature === sig);
      if (current.length !== home.length) continue;
      const old = new Set(home.map((e) => e.position.join())),
        present = new Map(current.map((e) => [e.position.join(), e]));
      const removed = home.filter((e) => !present.has(e.position.join())),
        added = current.filter((e) => !old.has(e.position.join()));
      if (removed.length > 1 || added.length !== removed.length) continue;
      for (const h of home) {
        const here = present.get(h.position.join()) ?? added[0];
        if (!here) continue;
        const signature = sig + '@' + h.position.join();
        ids.set(signature, { ...here, signature });
      }
    }
    const result = { ...s, ids };
    keys.set(s, result);
    return result;
  };
}
