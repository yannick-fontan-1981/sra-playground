import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import { aligned, type PartMotion } from './controlled-parts.ts';
import { cellMatches, spatialControls, surfaceFromVisits } from './calibrate-spatial-controls.ts';
import { visualLayout, type PreviewLearning, type VisualLayout } from './witnessed-preview-transfer.ts';
import type { Memory, Experiment } from './preparation-experiments.ts';
import type { SituatedWitness } from './situated-preparation.ts';

export type TerminalContact = {
  actor: string;
  marker: string;
  offset: XY;
  pitch: XY;
  before: string;
  after: string;
  at: XY;
  from: XY;
  destination: XY;
  q: string;
  support: number;
  peers: number;
};
type ContactHypothesis = Pick<TerminalContact,'actor'|'marker'|'offset'|'support'|'before'|'after'> & {
  basis: 'unique_contact_hypothesis';
};
export type TerminalTrial = {
  witness: TerminalContact | ContactHypothesis | SituatedWitness;
  blockedGoal?: {before:string;after:string};
  preparationKey?: string;
  from: XY;
  to: XY;
  goal: XY;
  site: XY;
  fixed: XY[];
  peers: XY[];
  pitch: XY;
  op: string;
  distance: number;
  before: string;
  key: string;
  blockedStroke?: string;
  currentMotionWitness?: boolean;
};
const selectBody = (v: VisualLayout, p: string, last?: XY) =>
  v[p]?.length === 1 ? v[p]![0] : v[p]?.find((x) => last && same(x.at, last));

const motionKey = (actor: string, op: string, displacement: XY) => JSON.stringify([actor, op, displacement]);
const motionWitness = (motion: PartMotion | undefined, op: string, displacement: XY) =>
  (motion?.displacements ?? motion?.axes)?.[op]?.[displacement.join()]?.last ?? null;

function strokeContext(rows: NativeRows, actor: string, op: string, from: XY, to: XY, pitch: XY) {
  const [left, top] = to.map((center, axis) => Math.ceil((center - pitch[axis]! / 2) / 2));
  const [right, bottom] = to.map((center, axis) => Math.ceil((center + pitch[axis]! / 2) / 2));
  const landing: number[][] = [];
  for (let y = top!; y < bottom!; y++) landing.push(rows[y]?.slice(Math.max(0, left!), right!) ?? []);
  return JSON.stringify([actor, op, from, to, landing]);
}

// A contact is an experiment until an official transition identifies a scoring event.
function untestedContacts(learn:PreviewLearning, layout:VisualLayout, available:Set<string>, ref:string): ContactHypothesis[] {
  const proposals:ContactHypothesis[]=[];
  for(const [actor,motion] of Object.entries(learn.partMotion??{})){
    const group=layout[actor];if(group?.length!==1)continue;
    const body=group[0]!,p=body.at,box=body.box,w=box[2]!-box[0]!+1,h=box[3]!-box[1]!+1;
    const model=spatialControls(motion,available,'',{},'',actor);
    if(!model)continue;
    const measured=model.motors.filter(m=>m.basis==='observed'&&m.support>0&&/^ACTION[1-4]$/.test(m.op));
    if(measured.length<2)continue;
    const goals=new Map<string,typeof measured[number]>();
    for(const last of measured){
      goals.set(add(p,last.d).join(),last);
      for(const first of measured)goals.set(add(add(p,first.d),last.d).join(),last);
    }
    for(const [marker,parts] of Object.entries(layout)){
      if(actor===marker||parts.length!==1)continue;
      const part=parts[0]!,b=part.box,sw=b[2]!-b[0]!+1,sh=b[3]!-b[1]!+1;
      if(Math.max(sw,sh)>model.pitch[0]||sw*sh>4*w*h)continue;
      const goal=aligned(part.at,p,model.pitch),offset=diff(part.at,goal),last=goals.get(goal.join());
      if(!last||same(goal,p)||Math.abs(offset[0])>w||Math.abs(offset[1])>h)continue;
      if(Math.abs(part.at[0]-p[0])<w&&Math.abs(part.at[1]-p[1])<h)continue;
      const observed=(motion.displacements??motion.axes)[last.op]?.[last.d.join()];
      if(observed)proposals.push({basis:'unique_contact_hypothesis',actor,marker,offset,support:last.support,before:observed.first,after:ref});
    }
  }
  return proposals;
}
export function completionContacts(
  learn: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  layout: VisualLayout,
  op: string
) {
  const out: TerminalContact[] = [];
  if (!(a.levels_completed > b.levels_completed || a.state === 'WIN') || op.startsWith('ACTION6:'))
    return out;
  for (const [actor, motion] of Object.entries(learn.partMotion ?? {})) {
    const body = selectBody(layout, actor, learn.lastActor[actor]);
    if (!body) continue;
    const model = spatialControls(motion, new Set(b.available_action_refs), '', {}, b.frame_hash, actor),
      stroke = model?.motors.find((m) => m.op === op && m.support > 0);
    if (!model || !stroke) continue;
    const from = body.at,
      destination = add(from, stroke.d);
    for (const [marker, parts] of Object.entries(layout)) {
      if (marker === actor || parts.length > 12) continue;
      for (const part of parts) {
        if (!cellMatches(part.at, destination, model.pitch) || cellMatches(part.at, from, model.pitch))
          continue;
        out.push({
          actor,
          marker,
          offset: diff(part.at, destination),
          pitch: model.pitch,
          before: b.observation_ref,
          after: a.observation_ref,
          at: part.at,
          from,
          destination,
          q: op,
          support: stroke.support,
          peers: layout[actor]!.length - 1,
        });
      }
    }
  }
  return out.sort((a, b) => b.support - a.support || size(a.offset) - size(b.offset)).slice(0, 24);
}
export function offerTerminalContact(
  m: Memory,
  scene: number,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  mode:boolean|'positioned' = false,
): Experiment | null {
  const learn = m.previewLearning,
    layout = visualLayout(o, rows);
  if (!learn) return null;
  const hypothesize=mode===true,positioned=mode==='positioned';
  const witnesses=positioned?learn.inheritedPreparations:hypothesize?untestedContacts(learn,layout,available,o.observation_ref):learn.terminal;
  if (!witnesses?.length) return null;
  let winner: { trial: TerminalTrial; score: number } | null = null;
  const attempts = (positioned?learn.preparationAttempts:learn.goalAttempts) ?? {};
  for (const w of witnesses) {
    const preparation='operation' in w ? w : undefined;
    if(preparation && !available.has(preparation.operation))continue;
    const body = selectBody(layout, w.actor, learn.lastActor[w.actor]),
      motion = learn.partMotion?.[w.actor],
      markers = layout[w.marker];
    if (!body || !motion || !markers || markers.length > 12) continue;
    const p = body.at,
      peers = layout[w.actor]!.filter((z) => z !== body).map((z) => z.at);
    const model = spatialControls(motion, available, '', attempts, o.frame_hash, w.actor);
    if (!model) continue;
    const pitch = model.pitch,
      ground = surfaceFromVisits(motion.sites, rows, p, pitch, [p, ...peers]);
    const colors = Object.entries(motion.substrate).sort((a, b) => b[1] - a[1]),
      floor = ground ?? (colors[0] ? Number(colors[0][0]) : null);
    const known = new Set(
      Object.keys(motion.sites).map((k) => aligned(k.split(',').map(Number) as XY, p, pitch).join())
    );
    const moves = model.motors.filter((z) => {
      if (learn.terminalMotionRefutations?.[motionKey(w.actor, z.op, z.d)] === motionWitness(motion, z.op, z.d)) return false;
      return hypothesize || positioned ? z.basis === 'observed' && z.support > 0 : z.support > 0;
    });
    for (const part of markers) {
      const goal = aligned(diff(part.at, w.offset), p, pitch);
      const preparationKey=preparation ? JSON.stringify([w.actor,w.marker,part.at,w.offset,preparation.operation,peers]) : undefined;
      if(preparationKey && learn.testedPreparations?.[preparationKey]!==undefined)continue;
      if ((same(goal,p) && !preparation) || peers.some((z) => cellMatches(z, goal, pitch))) continue;
      if (!preparation && learn.visitedContacts?.[JSON.stringify([w.actor, w.marker, part.at, peers])] !== undefined)
        continue;
      const attemptKey=(first:string)=>preparationKey ? JSON.stringify([o.frame_hash,preparationKey,first])
        : JSON.stringify([o.frame_hash,w.actor,w.marker,part.at,first]);
      const queue = [p],
        seen = new Map<string, { first: string; to: XY; n: number; walked: boolean }>([
          [p.join(), { first: '', to: p, n: 0, walked: true }],
        ]);
      for (const u of queue) {
        if (same(u, goal)) break;
        const parent = seen.get(u.join())!;
        if(hypothesize&&parent.n>=2)continue;
        for (const d of moves) {
          const v = add(u, d.d),
            k = v.join();
          if (
            seen.has(k) ||
            v[0] < 0 ||
            v[1] < 0 ||
            v[0] >= 2 * rows[0]!.length ||
            v[1] >= 2 * rows.length ||
            peers.some((z) => cellMatches(z, v, pitch))
          )
            continue;
          const target = same(v, goal);
          if (
            !target &&
            !known.has(k) &&
            (floor === null || rows[Math.floor(v[1] / 2)]![Math.floor(v[0] / 2)] !== floor)
          )
            continue;
          const first = parent.n ? parent.first : d.op;
          if (attempts[attemptKey(first)] !== undefined)
            continue;
          if (!parent.n && learn.terminalBlockedStrokes?.[strokeContext(rows, w.actor, first, p, v, pitch)])
            continue;
          seen.set(k, {
            first,
            to: parent.n ? parent.to : v,
            n: parent.n + 1,
            walked: parent.walked && (target || known.has(k)),
          });
          queue.push(v);
        }
      }
      const route = same(goal,p)&&preparation ? {first:preparation.operation,to:p,n:0,walked:true} : seen.get(goal.join());
      if (!route || (!route.n && !preparation)) continue;
      // A remembered scoring contact locates a candidate destination. A
      // route to it also needs a current witness of the actor's movement.
      if (route.n > 1 && !Object.keys(motion.sites).length) continue;
      if (route.n > 1 && m.localProgress?.active) continue;
      if (route.n > 2 && !route.walked && m.localProgress?.foreignArrival?.actor !== w.actor) continue;
      const key=attemptKey(route.first),terminal=preparation ? route.n===0 : route.n===1;
      const score =
        32 * Number(terminal) +
        8 * Number(m.localProgress?.realizedPlacement?.actor === w.actor) +
        Math.min(6, w.support) -
        2 * route.n -
        size(w.offset) / Math.max(1, pitch[0]);
      if (!winner || score > winner.score)
        winner = {
          score,
          trial: {
            witness: w,
            ...(preparationKey?{preparationKey,blockedGoal:learn.blockedGoal}:{}),
            from: p,
            to: route.to,
            goal,
            site: part.at,
            peers,
            fixed: markers.filter((z) => z !== part).map((z) => z.at),
            pitch,
            op: route.first,
            distance: route.n,
            before: o.observation_ref,
            key,
            ...(route.n ? { blockedStroke: strokeContext(rows, w.actor, route.first, p, route.to, pitch) } : {}),
            currentMotionWitness: motion.sites[p.join()] !== undefined,
          },
        };
    }
  }
  if (!winner) return null;
  const trial = winner.trial;
  return {
    phase: positioned?(trial.distance?'positionForOperation':'usePositionedOperation'):hypothesize?'testScoringContact':'seekTerminalContact',
    origin: scene,
    a: trial.op,
    b: trial.op,
    rule: positioned?'test_if_a_previous_preparatory_effect_depends_on_actor_position':
      hypothesize?'test_if_the_learned_move_into_a_distinct_target_completes_the_level':'approach_the_visible_contact_that_preceded_official_completion',
    refs: [],
    terminalContact: trial,
  };
}
export function measureTerminalContact(
  learn: PreviewLearning,
  trial: TerminalTrial,
  b: NativeObservation,
  a: NativeObservation,
  op: string,
  after: VisualLayout
) {
  const won = a.levels_completed > b.levels_completed || a.state === 'WIN',
    group = after[trial.witness.actor] ?? [];
  const others = group.filter((z) => !trial.peers.some((v) => cellMatches(z.at, v, trial.pitch)));
  const actual =
    others.length === 1 &&
    group.length === trial.peers.length + 1 &&
    trial.peers.every((v) => group.some((z) => cellMatches(z.at, v, trial.pitch)))
      ? others[0]!.at
      : null;
  const live = b.observation_ref === trial.before && trial.op === op;
  const reached=cellMatches(actual,trial.to,trial.pitch);
  const use=!!trial.preparationKey && trial.distance===0;
  const featureChanged=use && !(after[trial.witness.marker]??[]).some(z=>same(z.at,trial.site));
  const matched = live && (won || (reached && (!use || featureChanged)));
  if (live && !won && !reached && actual && !cellMatches(actual, trial.from, trial.pitch)) {
    const displacement = diff(trial.to, trial.from);
    const actor = trial.witness.actor;
    (learn.terminalMotionRefutations ??= {})[motionKey(actor, op, displacement)] =
      motionWitness(learn.partMotion?.[actor], op, displacement);
  }
  if (live && !won && !reached && trial.blockedStroke && cellMatches(actual, trial.from, trial.pitch)) {
    (learn.terminalBlockedStrokes ??= {})[trial.blockedStroke] = true;
  }
  if(trial.preparationKey){
    (learn.preparationAttempts??={})[trial.key]=a.revision;
    if(live && use){
      (learn.testedPreparations??={})[trial.preparationKey]=a.revision;
      delete learn.blockedGoal;
    }
    return {trial,won:won&&live,matched,actual:won?null:actual,featureChanged};
  }
  if(learn.inheritedPreparations?.length && live && !won && !matched && trial.distance===1 &&
      !('basis' in trial.witness) && cellMatches(actual,trial.from,trial.pitch))
    learn.blockedGoal={before:b.observation_ref,after:a.observation_ref};
  (learn.goalAttempts ??= {})[trial.key] = a.revision;
  if (live && matched && !won && trial.distance === 1)
    (learn.visitedContacts ??= {})[
      JSON.stringify([trial.witness.actor, trial.witness.marker, trial.site, trial.peers])
    ] = a.revision;
  return { trial, won: won && live, matched, actual: won ? null : actual };
}
