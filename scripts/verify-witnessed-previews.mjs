import { isDeepStrictEqual as eq } from 'node:util';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import { poseFamilyKey } from '../src/sic/pose-families.ts';

export function witnessedPreviewAudit(run, hash, partsAt, cache, commandKey) {
  const results = { issued: 0, inherited: 0, realized: 0, contradicted: 0, unobserved: 0, inapplicable: 0 };
  const roles = new Map(),
    pos = (e) => [e.bbox[0] + e.bbox[2], e.bbox[1] + e.bbox[3]];
  const role = (e) => {
    if (!roles.has(e.signature)) roles.set(e.signature, symbolicDigest(poseFamilyKey(e)).slice(0, 24));
    return roles.get(e.signature);
  };
  const get = (key, id) => (cache.get(key) ?? []).filter((e) => role(e) === id);
  const has = (g, p) => g.some((e) => eq(pos(e), p));
  const covers = (e, p) =>
    p[0] >= 2 * e.bbox[0] && p[0] <= 2 * e.bbox[2] && p[1] >= 2 * e.bbox[1] && p[1] <= 2 * e.bbox[3];
  function assert(ok, reason) {
    if (!ok) throw Error('Witnessed preview: ' + reason);
  }
  function ref(s) {
    const match = /:epoch:(\d+):revision:(\d+):frame:([0-9a-f]+)$/.exec(s);
    assert(match, 'observation reference');
    return { epoch: +match[1], rev: +match[2], frame: match[3] };
  }
  async function record(event, cmd, i, board, priorState) {
    const out = event.witnessedPreview,
      f = out.forecast,
      w = f.witness,
      prior = ref(w.before),
      later = ref(w.after),
      now = ref(f.before);
    assert(
      hash(f) === cmd.previewReadSeal &&
        commandKey(cmd) === f.command &&
        now.rev === i + 1 &&
        now.frame === cmd.from,
      'pre-action commitment'
    );
    assert(
      later.rev === prior.rev + 1 &&
        later.rev <= now.rev &&
        run.replayCommands[prior.rev - 1]?.from === prior.frame &&
        run.replayCommands[prior.rev - 1]?.to === later.frame &&
        commandKey(run.replayCommands[prior.rev - 1]) === w.command,
      'historical command'
    );
    const starts = get(prior.frame, f.actor),
      ends = get(later.frame, f.actor),
      mark = get(prior.frame, f.indicator);
    assert(
      has(starts, w.from) &&
        has(mark, w.indicated) &&
        !has(ends, w.from) &&
        ends.some((e) => eq(pos(e), w.arrived) && covers(e, w.indicated)) &&
        starts.length === ends.length &&
        starts.length === w.peers.length + 1 &&
        w.peers.every((p) => has(starts, p) && has(ends, p)),
      'observed subject and indicated site'
    );
    assert(
      get(cmd.from, f.indicator).some((e) => eq(pos(e), f.indicated)) && has(get(cmd.from, f.actor), f.from),
      'new binding'
    );
    if (f.basis === 'observed_in_previous_level') {
      assert(prior.epoch < f.epoch, 'inherited scope');
      results.inherited++;
    }
    await partsAt(board, cmd.to, i + 2);
    const start = get(cmd.from, f.actor),
      end = get(cmd.to, f.actor),
      peer = (p) => f.peers.some((other) => eq(p, other));
    let active =
      end.length === start.length && f.peers.every((p) => has(end, p))
        ? end.filter((e) => !peer(pos(e)))
        : [];
    if (
      !active.length &&
      start.length === end.length &&
      has(end, f.from) &&
      start.filter((e) => !has(end, pos(e))).length === 1 &&
      end.filter((e) => !has(start, pos(e))).length === 1
    )
      active = end.filter((e) => eq(pos(e), f.from));
    const actual = active.length === 1 ? active[0] : null,
      same =
        board.level === event.level &&
        board.state === priorState &&
        board.levelsCompleted === run.initialCompleted + event.level - run.start;
    const status = !same
      ? 'inapplicable'
      : !actual
        ? 'unobserved'
        : !eq(pos(actual), f.from) && covers(actual, f.indicated)
          ? 'realized'
          : 'contradicted';
    assert(status === out.status && eq(actual ? pos(actual) : null, out.actual), 'replayed result');
    results.issued++;
    results[status]++;
  }
  return { results, record };
}
