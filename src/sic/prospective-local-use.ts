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
  remember(m, b.frame_hash, rows);
  remember(m, a.frame_hash, next);
  bounded(m.steps, { from: b.frame_hash, to: a.frame_hash, op, ref: a.observation_ref }, 128);
  learn(m);
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
  if (!m.laws.length) return false;
  const recent = m.steps.slice(-3);
  return (
    recent.some((s) => s.from === s.to && s.to === hash) || m.steps.slice(0, -1).some((s) => s.from === hash)
  );
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
