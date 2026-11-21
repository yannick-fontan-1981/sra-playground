import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import {
  clickSite,
  localPatch,
  orderEdits,
  publicEdits,
  separateEdits,
  separation,
  shiftSite,
  siteOffset,
  translateCommand,
  type Edit,
  type Picture,
  type Site,
} from './local-response.ts';

type Step = { from: string; to: string; op: string; ref: string };
type Law = {
  first: Edit;
  second: Edit;
  third?: Edit;
  bareB: string;
  a: string;
  b: string;
  c: string;
  origin: string;
  ref: string;
  matchedInTraining: boolean;
  key: string;
};
export type LocalForecast = {
  stage: 'control' | 'prepare' | 'test' | 'use';
  origin: string;
  law: string;
  ref: string;
  training: string;
  trainedSite: Site;
  a: string;
  b: string;
  c: string;
  site: Site;
  siteB: Site;
  siteC?: Site;
  firstBefore: string;
  firstAfter: string;
  beforeB: string;
  afterB: string;
  beforeC?: string;
  afterC?: string;
  revised: boolean;
  controlRef?: string;
  observedPrefix?: { first: string; second: string };
};
type Packed = { width: number; cells: string };
export type LocalMemory = {
  pictures: Record<string, Packed>;
  order: string[];
  steps: Step[];
  laws: Law[];
  seen: string[];
  tried: string[];
  pending?: LocalForecast;
  expect?: string;
  facts?: { origin: string; a: string; site: Site; after: string; ref: string; failed: string[] }[];
  retained?: { plan: LocalForecast; state: string };
  suspended?: LocalForecast;
  continuations?: { frame: string; plan: LocalForecast }[];
};
export const newLocalMemory = (): LocalMemory => ({
  pictures: {},
  order: [],
  steps: [],
  laws: [],
  seen: [],
  tried: [],
});
export function nextLocalLevel(m?: LocalMemory): LocalMemory {
  const reset = newLocalMemory();
  if (m) reset.laws = m.laws.slice();
  return reset;
}
function bounded<T>(arr: T[], entry: T, cap: number) {
  arr.push(entry);
  if (arr.length > cap) arr.shift();
}
function remember(m: LocalMemory, key: string, rows: NativeRows) {
  if (m.pictures[key]) return;
  m.pictures[key] = {
    width: rows[0]!.length,
    cells: rows.map((row) => String.fromCharCode(...row.map((ink) => ink + 65))).join(''),
  };
  m.order.push(key);
  if (m.order.length > 24) delete m.pictures[m.order.shift()!];
}
function read(m: LocalMemory, key: string): Picture | null {
  const data = m.pictures[key];
  if (!data) return null;
  const frame: number[][] = [];
  for (let i = 0; i < data.cells.length; i += data.width) {
    const row: number[] = [];
    for (let x = 0; x < data.width; x++) row.push(data.cells.charCodeAt(i + x) - 65);
    frame.push(row);
  }
  return { frame };
}
function direct(m: LocalMemory, from: string, op: string) {
  const samples = m.steps.filter((s) => s.from === from && s.op === op);
  const last = samples.at(-1);
  return last && samples.every((s) => s.to === last.to) ? last : undefined;
}
function learn(m: LocalMemory) {
  const [sa, sb, sc] = m.steps.slice(-3);
  if (
    !sa ||
    !sb ||
    !sc ||
    sa.to !== sb.from ||
    sb.to !== sc.from ||
    sa.from === sa.to ||
    sb.from === sb.to ||
    [sa, sb, sc].some((s) => s.op === 'ACTION7')
  )
    return;
  const key = JSON.stringify([sa.from, sa.op, sb.op, sc.op]);
  if (m.seen.includes(key)) return;
  bounded(m.seen, key, 64);
  const root = read(m, sa.from),
    va = read(m, sa.to),
    vab = read(m, sb.to),
    vabc = read(m, sc.to);
  if (!root || !va || !vab || !vabc) return;
  const ctrl = direct(m, sa.from, sb.op),
    bare = ctrl && read(m, ctrl.to);
  const ac = direct(m, sa.to, sc.op),
    bc = ctrl && direct(m, ctrl.to, sc.op);
  const rivals = [root, va, bare, ac && read(m, ac.to), bc && read(m, bc.to)].filter((x): x is Picture => !!x);
  const first = separateEdits(orderEdits(publicEdits(root, va, []), clickSite(sa.op)), 2);
  const second = separateEdits(
    orderEdits(publicEdits(va, vab, bare ? [root, bare] : [root]), clickSite(sb.op)),
    3
  );
  if (!first.length || !second.length) return;
  const uses = orderEdits(publicEdits(vab, vabc, rivals), clickSite(sc.op));
  for (const a of first)
    for (const b of second) {
      const c = uses.find((v) => separation(v.p, a.p) >= 3 && separation(v.p, b.p) >= 3);
      const id = JSON.stringify([sa.op, sb.op, sc.op, a.p, a.from, a.to, b.p, b.from, b.to, c?.p, c?.to]);
      if (m.laws.some((l) => l.key === id)) continue;
      bounded(
        m.laws,
        {
          a: sa.op,
          b: sb.op,
          c: sc.op,
          first: a,
          second: b,
          ...(c ? { third: c } : {}),
          bareB: localPatch(root, b.p)!,
          origin: sa.from,
          ref: sc.ref,
          matchedInTraining: !!bare,
          key: id,
        },
        96
      );
    }
}
export function observeLocal(
  m: LocalMemory,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows,
  op: string
) {
  if (a.level_epoch !== b.level_epoch || a.levels_completed !== b.levels_completed || a.state !== b.state)
    return;
  if (m.continuations?.length) {
    m.continuations = m.continuations.filter(item => item.frame !== b.frame_hash || item.plan.c !== op);
  }
  remember(m, b.frame_hash, rows);
  remember(m, a.frame_hash, next);
  bounded(m.steps, { from: b.frame_hash, to: a.frame_hash, op, ref: a.observation_ref }, 128);
  recordObservedPrefix(m, a.frame_hash, { frame: rows }, { frame: next });
  learn(m);
}

// Any family can supply the preparation. Its two actual transitions, a prior
// response to B alone and the translated training example ground the prediction for C.
function recordObservedPrefix(m: LocalMemory, frame: string, prepared: Picture, enabled: Picture) {
  const first = m.steps.at(-2), second = m.steps.at(-1);
  if (!first || !second || first.to !== second.from || first.from === first.to || second.from === frame) return;
  if (!m.laws.length) return;
  const bare = direct(m, first.from, second.op);
  if (!bare || bare.to === frame) return;
  const root = read(m, first.from), control = read(m, bare.to);
  if (!root || !control) return;
  const laws = m.laws.filter(law => law.third && law.origin !== first.from &&
    law.a.split(':')[0] === first.op.split(':')[0] && law.b.split(':')[0] === second.op.split(':')[0]);
  if (!laws.length) return;
  const changed = publicEdits(root, prepared, []);
  for (const law of laws) {
    const use = law.third!;
    for (const edit of changed) {
      if (edit.from !== law.first.from || edit.to !== law.first.to || separation(edit.p, law.first.p) < 3) continue;
      const shift = siteOffset(edit.p, law.first.p);
      if (translateCommand(law.a, shift, root) !== first.op || translateCommand(law.b, shift, root) !== second.op) continue;
      const siteB = shiftSite(law.second.p, shift), siteC = shiftSite(use.p, shift);
      const c = translateCommand(law.c, shift, enabled);
      if (!c || localPatch(root, siteB) !== law.bareB || localPatch(prepared, siteB) !== law.second.from ||
          localPatch(enabled, siteB) !== law.second.to || localPatch(control, siteB) === law.second.to ||
          localPatch(enabled, siteC) !== use.from || m.steps.some(step => step.from === frame && step.op === c)) continue;
      const shortcuts = [direct(m, first.to, c), direct(m, bare.to, c)];
      if (shortcuts.some(step => step && localPatch(read(m, step.to), siteC) === use.to)) continue;
      const saved = m.continuations ??= [];
      if (saved.some(item => item.frame === frame && item.plan.c === c && item.plan.law === law.key)) continue;
      bounded(saved, { frame, plan: {
        stage: 'use', origin: first.from, law: law.key, training: law.origin, trainedSite: law.first.p,
        ref: law.ref, controlRef: bare.ref, observedPrefix: { first: first.ref, second: second.ref },
        a: first.op, b: second.op, c, site: edit.p, siteB, siteC,
        firstBefore: edit.from, firstAfter: edit.to, beforeB: law.second.from, afterB: law.second.to,
        beforeC: use.from, afterC: use.to, revised: false,
      } }, 64);
    }
  }
}

export function continuationAt(m: LocalMemory, o: NativeObservation, rows: NativeRows): LocalForecast | null {
  const board = { frame: rows };
  for (const item of m.continuations ?? []) {
    const p = item.plan;
    if (item.frame !== o.frame_hash || !p.siteC || !o.available_action_refs.includes(p.c.split(':')[0]!) ||
        localPatch(board, p.siteC) !== p.beforeC || m.steps.some(step => step.from === item.frame && step.op === p.c)) continue;
    return p;
  }
  return null;
}
function locations(board: Picture) {
  const map = new Map<string, Site[]>();
  for (let y = 1; y < board.frame.length - 1; y++)
    for (let x = 1; x < board.frame[y]!.length - 1; x++) {
      const p: Site = [x, y],
        k = localPatch(board, p)!;
      let sites = map.get(k);
      if (!sites) {
        sites = [];
        map.set(k, sites);
      }
      if (sites.length <= 32) sites.push(p);
    }
  return map;
}
const attemptKey = (p: LocalForecast) => JSON.stringify([p.origin, p.a, p.b, p.site, p.siteB, p.afterB]);
export function stalledLocal(m: LocalMemory, hash: string): boolean {
  if (!m.laws.length || m.steps.length < 4 || m.steps.at(-1)?.to !== hash) return false;
  // Starting A/B/C consumes up to three turns. Yield while any of the last three
  // commands is still opening a new public state. Repeating a witnessed edge or
  // an ineffective command then supplies the concrete limitation to investigate.
  const prefix = m.steps.slice(0, -3);
  const seen = new Set(prefix.flatMap(step => [step.from, step.to]));
  const recent = m.steps.slice(-3);
  if (!recent.every(step => seen.has(step.to))) return false;
  return recent.some(step => step.from === step.to || prefix.some(previous =>
    previous.from === step.from && previous.op === step.op && previous.to === step.to));
}
// An early experiment may displace exploration only for a witnessed blocked control.
// Discard a proposed destination if another known two-step path already produces it.
export function demonstratedLimit(m: LocalMemory, p: LocalForecast): boolean {
  const control = direct(m, p.origin, p.b);
  if (!control || control.to !== p.origin) return false;
  let frontier = [p.origin];
  const seen = new Set(frontier);
  for (let depth = 0; depth < 2; depth++) {
    const next: string[] = [];
    for (const state of frontier) for (const step of m.steps) {
      if (step.from !== state || (depth === 0 && step.op === p.a) || seen.has(step.to)) continue;
      seen.add(step.to);
      const image = read(m, step.to);
      if (image && localPatch(image, p.siteB) === p.afterB) return false;
      next.push(step.to);
    }
    frontier = next;
  }
  return true;
}
export function proposeLocal(
  m: LocalMemory,
  o: NativeObservation,
  rows: NativeRows,
  allowNew: boolean
): LocalForecast | null {
  const here = o.frame_hash,
    board = { frame: rows };
  if (m.pending && m.expect === here) return m.pending;
  if (!allowNew || !m.laws.length) return null;
  if (m.suspended?.origin === here) {
    const old = m.suspended,
      ctrl = direct(m, here, old.b),
      result = ctrl && read(m, ctrl.to);
    if (ctrl && result && localPatch(result, old.siteB) !== old.afterB)
      return { ...old, stage: 'prepare', controlRef: ctrl.ref };
  }
  const kept = m.retained?.state === here ? m.retained.plan : null;
  const sites = locations(board),
    candidates: { p: LocalForecast; score: number }[] = [];
  for (const law of m.laws) {
    if (law.origin === here) continue;
    const points = kept ? [kept.site] : (sites.get(law.first.from) ?? []);
    if (points.length > 32) continue;
    for (const q of points) {
      if (separation(q, law.first.p) < 3) continue;
      const shift = siteOffset(q, law.first.p),
        qb = shiftSite(law.second.p, shift),
        qc = law.third && shiftSite(law.third.p, shift);
      if (localPatch(board, qb) !== (kept ? law.second.from : law.bareB) || (qc && !localPatch(board, qc)))
        continue;
      const [a, b, c] = [law.a, law.b, law.c].map((op) => translateCommand(op, shift, board));
      if (!a || !b || !c || ![a, b, c].every((k) => o.available_action_refs.includes(k.split(':')[0]!)))
        continue;
      if (
        kept &&
        (a !== kept.a ||
          b === kept.b ||
          law.first.to !== kept.firstAfter ||
          localPatch(board, q) !== kept.firstAfter)
      )
        continue;
      const origin = kept?.origin ?? here,
        ctrl = direct(m, origin, b),
        rival = ctrl && read(m, ctrl.to);
      if ((kept && !rival) || (rival && localPatch(rival, qb) === law.second.to)) continue;
      if (!kept && direct(m, here, a)?.to === here) continue;
      const fact = m.facts?.find(
        (f) => f.origin === origin && f.a === a && separation(f.site, q) === 0 && f.after === law.first.to
      );
      if (fact?.failed.includes(b)) continue;
      const revised = !!kept || !!fact?.failed.length;
      const plan: LocalForecast = {
        stage: kept ? 'test' : rival ? 'prepare' : 'control',
        origin,
        law: law.key,
        ref: law.ref,
        training: law.origin,
        trainedSite: law.first.p,
        a,
        b,
        c,
        site: q,
        siteB: qb,
        ...(qc ? { siteC: qc } : {}),
        firstBefore: law.first.from,
        firstAfter: law.first.to,
        beforeB: law.second.from,
        afterB: law.second.to,
        ...(law.third ? { beforeC: law.third.from, afterC: law.third.to } : {}),
        revised,
        ...(rival && ctrl ? { controlRef: ctrl.ref } : {}),
      };
      if (!m.tried.includes(attemptKey(plan)))
        candidates.push({
          p: plan,
          score:
            (revised ? 800 : 0) +
            (rival ? 400 : 0) +
            (qc ? 100 : 0) +
            (law.matchedInTraining ? 50 : 0) -
            points.length +
            law.second.n,
        });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.p ?? null;
}
export const localCommand = (p: LocalForecast) => (p.stage === 'prepare' ? p.a : p.stage === 'use' ? p.c : p.b);
export function assessLocal(
  m: LocalMemory,
  p: LocalForecast,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows
) {
  const before = { frame: rows },
    after = { frame: next };
  const valid =
    b.level_epoch === a.level_epoch && b.state === a.state && b.levels_completed === a.levels_completed;
  delete m.pending;
  delete m.expect;
  delete m.suspended;
  if (!m.tried.includes(attemptKey(p))) bounded(m.tried, attemptKey(p), 192);
  const matches =
    valid &&
    (p.stage === 'prepare'
      ? localPatch(before, p.site) === p.firstBefore && localPatch(after, p.site) === p.firstAfter
      : p.stage === 'control'
        ? localPatch(after, p.siteB) !== p.afterB
        : p.stage === 'test'
          ? !!p.controlRef &&
            localPatch(before, p.siteB) === p.beforeB &&
            localPatch(after, p.siteB) === p.afterB
          : !!p.siteC && localPatch(before, p.siteC) === p.beforeC && localPatch(after, p.siteC) === p.afterC);
  const facts = (m.facts ??= []);
  const fact = facts.find(
    (f) => f.origin === p.origin && f.a === p.a && separation(f.site, p.site) === 0 && f.after === p.firstAfter
  );
  if (matches && p.stage === 'prepare' && !fact)
    bounded(
      facts,
      { origin: p.origin, a: p.a, site: p.site, after: p.firstAfter, ref: a.observation_ref, failed: [] },
      64
    );
  if (valid && p.stage === 'test' && !matches && fact && !fact.failed.includes(p.b)) fact.failed.push(p.b);
  if (matches && p.stage === 'control') {
    if (b.frame_hash === a.frame_hash) m.pending = { ...p, stage: 'prepare', controlRef: a.observation_ref };
    else m.suspended = p;
  }
  if (matches && p.stage === 'prepare' && localPatch(after, p.siteB) === p.beforeB)
    m.pending = { ...p, stage: 'test' };
  if (matches && p.stage === 'test' && p.siteC && localPatch(after, p.siteC) === p.beforeC)
    m.pending = { ...p, stage: 'use' };
  if (m.pending) m.expect = a.frame_hash;
  if (
    valid &&
    ((p.stage === 'test' && !matches) || (p.stage === 'prepare' && matches && !m.pending)) &&
    localPatch(after, p.site) === p.firstAfter
  )
    m.retained = { plan: p, state: a.frame_hash };
  else delete m.retained;
  return {
    stage: p.stage,
    matches,
    retained: !!m.retained,
    revised: p.revised,
    origin: p.origin,
    trainedSite: p.trainedSite,
    site: p.site,
  };
}
