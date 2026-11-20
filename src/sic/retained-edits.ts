import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Memory, Experiment } from './preparation-experiments.ts';
import { imageKey, observedEdit, projectEdit } from './relative-edits.ts';
import { returnPrograms } from './return-programs.ts';

type Way = { cmd: string; ref: number };
type Entry = { origin: number; site: number; a: Way; b: Way; undo: Way[] };
type Prediction = {
  image: string;
  alternate: string | null;
  use: string;
  bareRef: number;
  next: string | null;
  support: number | null;
};
export type RetainedTrial = { entry: Entry; index: number; prediction: Prediction | null };
export type RetainedMemory = {
  active: RetainedTrial | null;
  tried: Record<string, number>;
  facts: Record<string, number>;
  last: number;
};
export const newRetainedMemory = (): RetainedMemory => ({ active: null, tried: {}, facts: {}, last: -100 });
const key = (e: Entry) => [e.origin, e.site, e.b.cmd].join('/');
const family = (e: Entry) => [e.a.cmd, e.b.cmd, ...e.undo.map((u) => u.cmd)].join('/');
function entries(m: Memory, scene: number) {
  const prev = m.edges[m.previous];
  if (!prev?.stable || prev.t !== scene || prev.s === scene || !prev.manipulation?.edit.count) return [];
  const inverses = returnPrograms(m.edges, prev.s).get(scene);
  if (!inverses?.length) return [];
  const direct = m.edges.filter((e) => e.stable && e.s === prev.s && e.t === prev.s);
  return direct
    .filter((e) => e.cmd !== prev.cmd)
    .map((b) => ({
      origin: prev.s,
      site: scene,
      a: { cmd: prev.cmd, ref: prev.ref },
      b: { cmd: b.cmd, ref: b.ref },
      undo: inverses.map((e) => ({ cmd: e.cmd, ref: e.ref })),
    }));
}
export function offerRetained(m: Memory, scene: number, available: Set<string>): Experiment | null {
  const state = m.retained;
  if (!state) return null;
  let t = state.active;
  if (!t) {
    if (m.turns - state.last < 3) return null;
    const list = entries(m, scene).filter(
      (e) =>
        available.has(e.b.cmd) &&
        !state.tried[key(e)] &&
        !m.edges.some((x) => x.stable && x.s === scene && x.t === scene && x.cmd === e.b.cmd)
    );
    list.sort(
      (x, y) =>
        Number(!!state.facts[family(y)]) - Number(!!state.facts[family(x)]) || x.undo.length - y.undo.length
    );
    if (!list[0]) return null;
    t = { entry: list[0], index: 0, prediction: null };
  }
  const { entry: e, index: k, prediction: p } = t,
    cmd = k === 0 ? e.b.cmd : k <= e.undo.length ? e.undo[k - 1]!.cmd : p?.use;
  if (!cmd || !available.has(cmd)) return null;
  const refs = [
    e.a.ref,
    e.b.ref,
    ...e.undo.map((u) => u.ref),
    ...(p ? [p.bareRef] : []),
    ...(p?.support ? [p.support] : []),
  ];
  return {
    phase: 'transportControl',
    origin: e.origin,
    a: e.a.cmd,
    b: cmd,
    rule: 'retain_edit_after_return',
    refs,
    retained: t,
  };
}
function predict(m: Memory, e: Entry, rows: NativeRows, next: NativeRows, actual: number): Prediction | null {
  const setup = m.edges.find((x) => x.ref === e.a.ref)?.manipulation?.edit,
    edit = observedEdit(rows, next, 128);
  if (!setup || !edit?.count) return null;
  const root = projectEdit(rows, setup, { reverse: true, strict: true })?.board;
  if (!root) return null;
  const merged = projectEdit(root, edit);
  if (!merged?.changed) return null;
  const image = imageKey(merged.board);
  if ([root, rows, next].some((b) => imageKey(b) === image)) return null;
  const alternate = projectEdit(next, setup, { reverse: true });
  const uses = m.edges
    .filter((x) => x.stable && x.s === e.origin && x.s === x.t && x.cmd !== e.a.cmd)
    .map((c) => {
      const at = m.edges.find((x) => x.stable && x.s === actual && x.cmd === c.cmd);
      const delta = at?.manipulation?.edit;
      const then = delta?.count ? projectEdit(merged.board, delta) : null;
      return {
        use: c.cmd,
        bareRef: c.ref,
        next: then?.changed ? imageKey(then.board) : null,
        score: (then?.changed ? 8 : 0) + (c.cmd !== e.b.cmd ? 2 : 0),
      };
    })
    .sort((a, b) => b.score - a.score);
  const u = uses[0];
  return u
    ? {
        image,
        alternate: alternate ? imageKey(alternate.board) : null,
        use: u.use,
        bareRef: u.bareRef,
        next: u.next,
        support: m.retained!.facts[family(e)] ?? null,
      }
    : null;
}
export function recordRetained(
  m: Memory,
  t: RetainedTrial,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows,
  actual: number
) {
  const state = m.retained!,
    { entry: e, index: k } = t;
  const won = a.levels_completed > b.levels_completed || a.state === 'WIN',
    live = !won && b.state === a.state && b.level_epoch === a.level_epoch;
  let p = t.prediction,
    keep = false;
  let outcome = '';
  if (!live) outcome = won ? 'completion' : 'boundary';
  else if (k === 0) {
    p = predict(m, e, rows, next, actual);
    keep = !!p;
    outcome = p ? 'forecast_created' : 'no_separable_edit';
  } else if (k < e.undo.length) {
    keep = true;
    outcome = 'returning';
  } else if (k === e.undo.length) {
    keep = imageKey(next) === p!.image;
    outcome = keep ? 'landing_verified' : 'landing_refuted';
    if (keep) state.facts[family(e)] = a.revision;
  } else
    outcome =
      imageKey(next) === imageKey(rows)
        ? 'use_dormant'
        : p?.next === imageKey(next)
          ? 'use_exact'
          : 'use_changed';
  state.last = m.turns;
  state.tried[key(e)] = a.revision;
  state.active = keep ? { entry: e, index: k + 1, prediction: p } : null;
  return { result: 'retained_' + outcome, detail: { trial: t, forecast: p, won, ref: a.revision } };
}
