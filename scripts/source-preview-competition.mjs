import { offerWitnessedPreview, measureWitnessedArrival } from '../src/sic/witnessed-preview-transfer.ts';

// All forecasts are formed against the current public observation, before reading the next board.
// Credit is computed for every interpretation of the executed command, including an unselected rival.
export function previewCompetition() {
  const evidence = new Map(),
    movement = new Map(),
    seen = new Set(),
    rows = [];
  function statistics(k) {
    if (!evidence.has(k)) evidence.set(k, { hit: 0, miss: 0, otherHit: 0, otherMiss: 0 });
    return evidence.get(k);
  }
  function choices(learned, o, layout, available) {
    const options = [];
    for (const [k, b] of Object.entries(learned.bindings)) {
      const offer = offerWitnessedPreview({ ...learned, bindings: { [k]: b } }, o, layout, available);
      if (!offer) continue;
      const s = statistics(k),
        precision = (s.hit + 1) / (s.hit + s.miss + 2),
        background = (s.otherHit + 1) / (s.otherHit + s.otherMiss + 2);
      const m = movement.get(b.actor) ?? [],
        selfWhenAbsent = m.filter((v) => v.q !== b.gesture.op && !v.visible.has(b.indicator)).length;
      options.push({ offer, precision, selectivity: precision - background, independent: selfWhenAbsent });
    }
    return options;
  }
  function pre(learned, o, layout, q) {
    const available = new Set(o.available_action_refs),
      options = choices(learned, o, layout, available);
    const eligible = options.filter((v) => v.offer.command === q);
    // Obtain the frozen model's order by leaving only the relations that can issue this actual command.
    const allowed = new Set(eligible.map((v) => v.offer.key));
    const base = offerWitnessedPreview(
      {
        ...learned,
        bindings: Object.fromEntries(Object.entries(learned.bindings).filter(([k]) => allowed.has(k))),
      },
      o,
      layout,
      available
    );
    if (base) eligible.sort((a, b) => Number(b.offer.key === base.key) - Number(a.offer.key === base.key));
    function first(cmp) {
      return [...eligible].sort(cmp)[0]?.offer;
    }
    return {
      q,
      options,
      base,
      calibrated: first((a, b) => b.precision - a.precision || b.selectivity - a.selectivity),
      independent: first(
        (a, b) =>
          Number(b.independent > 0) - Number(a.independent > 0) ||
          b.precision - a.precision ||
          b.selectivity - a.selectivity
      ),
    };
  }
  function post(f, o, after, before, next) {
    const score = (r) => (r ? measureWitnessedArrival(r, o, after, before, next).status : null);
    const competing = f.options.filter((x) => x.offer.command === f.q).length;
    if (f.base)
      rows.push({
        level: o.level_epoch,
        rev: o.revision,
        competing,
        base: score(f.base),
        calibrated: score(f.calibrated),
        independent: score(f.independent),
      });
    if (after.level_epoch !== o.level_epoch || o.state !== after.state) return;
    for (const { offer } of f.options) {
      const k = JSON.stringify([o.level_epoch, o.frame_hash, f.q, offer.key, offer.from, offer.indicated]);
      if (seen.has(k)) continue;
      seen.add(k);
      const outcome = score(offer);
      if (outcome !== 'realized' && outcome !== 'contradicted') continue;
      const s = statistics(offer.key),
        match = f.q === offer.command;
      s[
        match ? (outcome === 'realized' ? 'hit' : 'miss') : outcome === 'realized' ? 'otherHit' : 'otherMiss'
      ]++;
    }
    for (const [actor, locations] of Object.entries(before)) {
      const dest = next[actor];
      if (!dest || dest.length !== locations.length) continue;
      const site = (x) => x.at.join(),
        priorSites = new Set(locations.map(site)),
        nextSites = new Set(dest.map(site));
      if (
        locations.filter((x) => !nextSites.has(site(x))).length !== 1 ||
        dest.filter((x) => !priorSites.has(site(x))).length !== 1
      )
        continue;
      const key = JSON.stringify([o.level_epoch, o.frame_hash, f.q, actor]);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!movement.has(actor)) movement.set(actor, []);
      movement.get(actor).push({ q: f.q.split(':')[0], visible: new Set(Object.keys(before)) });
    }
  }
  return { pre, post, rows };
}
