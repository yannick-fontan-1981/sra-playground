import { isDeepStrictEqual as equal } from 'node:util';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import { poseFamilyKey } from '../src/sic/pose-families.ts';

export function unreadIndicatorAudit(run, hash, partsAt, cache, commandKey) {
  const results = {
    issued: 0,
    started: 0,
    preserved: 0,
    realized: 0,
    contradicted: 0,
    unobserved: 0,
    inapplicable: 0,
    nonordinaryRealized: 0,
  };
  const families = new Map();
  const check = (ok, why) => {
    if (!ok) throw Error('Unread indicator: ' + why);
  };
  const site = (e) => (e ? [e.bbox[0] + e.bbox[2], e.bbox[1] + e.bbox[3]] : null);
  const delta = (a, b) => [a[0] - b[0], a[1] - b[1]];
  let previous = null;
  async function record(event, cmd, i, board, priorState) {
    const out = event.unreadIndicator,
      t = out.test,
      c = t.cue;
    const area = (board.frame.length * board.frame[0].length) / 12;
    const subject = (frame, role) => {
      const found = (cache.get(frame) ?? []).filter((e) => {
        if (e.area > area) return false;
        if (!families.has(e.signature))
          families.set(e.signature, symbolicDigest(poseFamilyKey(e)).slice(0, 24));
        return families.get(e.signature) === role;
      });
      return found.length === 1 ? found[0] : null;
    };
    const at = (frame, role) => site(subject(frame, role));
    check(
      hash(t) === cmd.indicatorProbeSeal &&
        commandKey(cmd) === t.op &&
        t.before.endsWith(':revision:' + (i + 1) + ':frame:' + cmd.from),
      'forecast before action'
    );
    const edge = (ref) => {
      check(ref >= 2 && ref <= i + 1, 'evidence predates probe');
      return run.replayCommands[ref - 2];
    };
    const independent = edge(c.independent),
      onset = edge(c.onset);
    const a = at(independent.from, c.p),
      z = at(independent.to, c.p);
    check(a && z && !equal(a, z) && !at(independent.from, c.r), 'subject moved independently');
    const old = at(onset.from, c.r),
      u = at(onset.from, c.p);
    check(
      equal(at(onset.to, c.p), c.origin) &&
        equal(at(onset.to, c.r), c.site) &&
        u &&
        (!old || (!equal(old, c.site) && !equal(delta(c.site, old), delta(c.origin, u)))) &&
        c.newDisplay === !old,
      'observed onset'
    );
    const actor = subject(cmd.from, c.p),
      mark = subject(cmd.from, c.r);
    check(
      actor && mark && equal(site(actor), c.origin) && equal(site(mark), c.site) && !equal(c.site, c.origin),
      'current visual binding'
    );
    const dims = (e) => [e.bbox[2] - e.bbox[0] + 1, e.bbox[3] - e.bbox[1] + 1].sort((a, b) => a - b);
    check(
      equal(dims(actor), dims(mark)) &&
        Math.abs(actor.area - mark.area) <= Math.max(1, Math.floor(Math.min(actor.area, mark.area) / 4)),
      'comparable footprints'
    );
    if (t.word.length > 1)
      check(
        previous?.i === i - 1 &&
          previous.valid &&
          equal(previous.cue, c) &&
          equal(t.word.slice(0, -1), previous.word),
        'unbroken action sequence'
      );
    check(t.word.at(-1) === t.op, 'last action');
    edge(t.ref);
    await partsAt(board, cmd.to, i + 2);
    const actual = at(cmd.to, c.p),
      indicator = at(cmd.to, c.r);
    const live =
      board.level === event.level &&
      board.state === priorState &&
      board.levelsCompleted === run.initialCompleted + event.level - run.start;
    const status = !live
      ? 'inapplicable'
      : !actual
        ? 'unobserved'
        : equal(actual, c.site)
          ? 'realized'
          : 'contradicted';
    const valid = !!(live && equal(actual, c.origin) && equal(indicator, c.site));
    check(
      out.status === status &&
        equal(actual, out.actual) &&
        equal(indicator, out.indicator) &&
        out.canContinue === valid,
      'physical return'
    );
    previous = { i, valid, cue: c, word: t.word };
    results.issued++;
    results[status]++;
    if (t.word.length === 1) results.started++;
    if (valid) results.preserved++;
    if (status === 'realized' && !c.ordinary) results.nonordinaryRealized++;
  }
  return { results, record };
}
