import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { composeSupportPlan, closedSupportRegion } from './compose-support-plan.ts';
import { passengerProject } from './passenger-transport.ts';
import { relayTransportPlan, type RelayPlan, type RelayStep } from './relay-transport-plan.ts';
import type { RelayControlMemory } from './relay-control.ts';
import { transportLandingPlan } from './transport-landing-plan.ts';
import { spatialControls, surfaceFromVisits } from './calibrate-spatial-controls.ts';
import type { XY } from './access-terrain.ts';
import { visualLayout, type PreviewLearning, type VisualLayout } from './witnessed-preview-transfer.ts';
import { previewLaw, transform, type ProbePattern } from './reachable-preview-configurations.ts';
import { contactProject, edgeKey, stepCell, type Board, type Project, type Step } from './contact-frontier-search.ts';

type Ground = { role: string; actor: string; origin: XY; pitch: XY; width: number };
type RelayRun = { ground:Ground; plan:RelayPlan; pivotRole:string; cargoRole:string; transfer:string; witness:string; expected:string };
export type FrontierContact = Ground & {
  controlRole?: string;
  relay?:RelayRun;
  step: Step;
  project: Project;
  parts: number[];
  acquired: boolean;
  ref: string;
  transform: string | null;
  terrain: number | null;
  previousEntry: string | null;
  priorContact: string | null;
  passengerBinding?: string;
};
export type SupportLaw = {
  appearance?: string;
  floor?: number;
  actor: string;
  role: string;
  terrain: number;
  entry: string;
  displacement: string;
};
export type ContactMemory = RelayControlMemory & {
  relayRun?:RelayRun;
  refusedRelay?:string[];
  passengerWitnesses?: Record<string, string>;
  partialSubject?: { actor: string; at: XY; frame: string; pigment: number };
  inheritedPassengers?: Record<string, string>;
  inheritedSupports?: SupportLaw[];
  supportLessons?: SupportLaw[];
  pendingEntries?: Record<number, SupportLaw>;
  deadlock?: { ref: string; previous: string; edge: string; configurations: number; repair?: ContactRepair };
  repair?: ContactRepair;
  recoveredEdges?: string[];
  inheritedContact?: Record<string, string>;
  contactEvidence?: Record<string, { sites: string[]; ref: string }>;
  roles?: string[];
  floor?: number;
  denied: string[];
  displaced: string[];
  supported: number[];
  appearances?: Record<string, string>;
  verify?: { at: number; role: string; terrain: number | null; displacement: string };
  verified?: Record<string, { displacement: string; entry: string }>;
  visited?: number[];
  active?: Project;
  arrival?: boolean;
  explorer?: { actor: string; origin: XY };
};
export type ContactRepair = {
  control?: 'UNDO' | 'RESET';
  frame: string;
  edge: string;
  project: Project;
  passenger?: { role: string; witness: string };
  priorPushes: string[];
  remainingPushes: string[];
};
export const newContactMemory = (): ContactMemory => ({ denied: [], displaced: [], supported: [] });

export function inheritFrontierContacts(
  evidence: ContactMemory['contactEvidence'],
  learning: PreviewLearning | undefined,
  lessons: SupportLaw[] = []
): ContactMemory {
  const next = newContactMemory();
  if (!learning?.terminal?.length) return next;
  const actors = new Set(learning.terminal.map((w) => w.actor));
  const supports = new Map<string, SupportLaw>();
  for (const law of lessons) {
    if (actors.has(law.actor)) supports.set(JSON.stringify([law.actor, law.role, law.terrain]), law);
  }
  next.inheritedSupports = [...supports.values()];
  next.contactEvidence = Object.fromEntries(Object.entries(evidence ?? {}).filter(([actor]) => actors.has(actor)));
  next.inheritedContact = Object.fromEntries(
    Object.entries(next.contactEvidence)
      .filter(([, model]) => model.sites.length >= 2)
      .map(([actor, model]) => [actor, model.ref])
  );
  return next;
}

// The subject enters the old position of a different visible part while that
// part moves ahead by the same measured stroke. A follower moving behind the
// subject and a changing indicator do not establish this contact affordance.
export function observeContactDisplacement(
  m: ContactMemory,
  learning: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  before: VisualLayout,
  after: VisualLayout,
  op: string
) {
  for (const actor of new Set(learning.terminal?.map((w) => w.actor) ?? [])) {
    const p = before[actor],
      q = after[actor],
      motion = learning.partMotion?.[actor];
    if (!motion || p?.length !== 1 || q?.length !== 1 || m.contactEvidence?.[actor]?.sites.length === 2) continue;
    const controls = spatialControls(motion, new Set(b.available_action_refs), '', {}, b.frame_hash, actor);
    const motor = controls?.motors.find((s) => s.op === op && s.support > 0);
    if (!controls || !motor) continue;
    const pitch = controls.pitch;
    const offset = (at: XY): XY => [
      Math.round((at[0] - p[0]!.at[0]) / pitch[0]),
      Math.round((at[1] - p[0]!.at[1]) / pitch[1]),
    ];
    const d = offset(q[0]!.at);
    if (d[0] !== Math.round(motor.d[0] / pitch[0]) || d[1] !== Math.round(motor.d[1] / pitch[1])) continue;
    for (const [role, parts] of Object.entries(before)) {
      if (role === actor || after[role]?.length !== parts.length) continue;
      const compact = (v: (typeof parts)[number]) =>
        2 * (v.box[2]! - v.box[0]! + 1) <= pitch[0] && 2 * (v.box[3]! - v.box[1]! + 1) <= pitch[1];
      const at = (v: (typeof parts)[number], k: number) => compact(v) && offset(v.at).every((n, i) => n === k * d[i]!);
      if (
        !parts.some((v) => at(v, 1)) ||
        parts.some((v) => at(v, 2)) ||
        after[role]!.some((v) => at(v, 1)) ||
        !after[role]!.some((v) => at(v, 2))
      )
        continue;
      const evidence = ((m.contactEvidence ??= {})[actor] ??= { sites: [], ref: a.observation_ref });
      const site = [role, ...p[0]!.at].join('/');
      if (!evidence.sites.includes(site)) {
        evidence.sites.push(site);
        evidence.ref = a.observation_ref;
      }
      break;
    }
  }
}
function cell(at: XY, g: Ground) {
  return Math.round((at[0] - g.origin[0]) / g.pitch[0]) + g.width * Math.round((at[1] - g.origin[1]) / g.pitch[1]);
}
function crossesIntoUnseenRegion(b: Board, from: number, to: number, visited: number[]) {
  const seen = new Set([to]),
    queue = [to],
    old = new Set([from, ...visited]);
  for (const p of queue) {
    if (old.has(p)) return false;
    for (const motor of b.motors) {
      const next = p + motor.delta;
      if (Math.abs((p % b.width) - (next % b.width)) > 1 || !b.floor.has(next) || seen.has(next)) continue;
      queue.push(next);
      seen.add(next);
    }
  }
  return true;
}
function cellPixels(rows: NativeRows, at: XY, pitch: XY): number[] {
  const pixels: number[] = [];
  for (let y = Math.ceil((at[1] - pitch[1] / 2) / 2); 2 * y < at[1] + pitch[1] / 2; y++) {
    for (let x = Math.ceil((at[0] - pitch[0] / 2) / 2); 2 * x < at[0] + pitch[0] / 2; x++) {
      const value = rows[y]?.[x];
      if (value !== undefined) pixels.push(value);
    }
  }
  return pixels;
}
function dominantColor(rows: NativeRows, at: XY, pitch: XY) {
  const histogram = new Map<number, number>();
  for (const value of cellPixels(rows, at, pitch)) histogram.set(value, (histogram.get(value) ?? 0) + 1);
  return [...histogram].sort((a, b) => b[1] - a[1])[0]?.[0];
}
function cellAppearance(rows: NativeRows, id: number, g: Ground) {
  return cellPixels(
    rows,
    [g.origin[0] + (id % g.width) * g.pitch[0], g.origin[1] + Math.floor(id / g.width) * g.pitch[1]],
    g.pitch
  ).join(',');
}
// A small change to an otherwise familiar piece motivates a comparison. Only a
// before/after displacement can license the new role in a solving plan.
function appearanceVariant(template: string | undefined, appearance: string) {
  if (!template) return false;
  const previous = template.split(','), current = appearance.split(',');
  if (previous.length !== current.length) return false;
  const changed = previous.filter((value, i) => value !== current[i]).length;
  return changed > 0 && changed * 4 <= current.length;
}
function passengerBinding(b: Board, actor: string, role: string) {
  return JSON.stringify([actor, role, b.roles[b.pivotIndex], b.transport?.op]);
}
function calibratedBoard(
  fit: NonNullable<ReturnType<typeof contactBoard>>, l: PreviewLearning, o: NativeObservation, rows: NativeRows
) {
  const b = fit.board;
  if (!b.transport || b.pivotIndex < 0) return null;
  const local = fittedTransport(l, fit.g.actor, visualLayout(o, rows), fit.g, new Set(b.motors.map(m => m.op)),
    new Set(o.available_action_refs), { epoch: o.level_epoch, pivot: b.roles[b.pivotIndex]! });
  return local ? { ...b, transport: local } : null;
}

function orientedTransport(
  fit: NonNullable<ReturnType<typeof contactBoard>>, learning: PreviewLearning, o: NativeObservation, rows: NativeRows
) {
  const { board, g } = fit, pivot = board.roles[board.pivotIndex];
  if (!pivot) return null;
  const layout = visualLayout(o, rows), form = layout[pivot]?.[0]?.form;
  const mask = o.entities.find(e => e.signature === form && e.area <= 16)?.mask.map(([x,y]): XY => [x,y]);
  if (!mask) return null;
  return fittedTransport(learning, g.actor, layout, g, new Set(board.motors.map(m => m.op)),
    new Set(o.available_action_refs), { pivot, mask });
}

function repairWithPassenger(b: Board, role: string, witness: string, allowed: (at: number) => boolean,
  denied: Set<string>, limits: {maxNodes:number;maxDepth:number}) {
  const i = b.roles.indexOf(role);
  if (i < 0 || i === b.pivotIndex) return null;
  const project = passengerProject(b, i, witness, allowed, denied, limits);
  if (project?.purpose !== 'reach_goal') return null;
  const transfer = project.steps.find(s => s.passenger);
  if (transfer) project.passenger = {
    role, witness, source: transfer.passenger!.source, destination: transfer.placed!, pushes: transfer.passenger!.pushes,
  };
  return project;
}
function matchingOrientations(previous: readonly XY[] | undefined, current: readonly XY[]) {
  if (!previous?.length || previous.length !== current.length) return [];
  const key = (points: readonly XY[]) => {
    const left = Math.min(...points.map(p => p[0])), top = Math.min(...points.map(p => p[1]));
    return points.map(([x,y]) => [x-left,y-top].join(',')).sort().join('/');
  };
  const target = key(current);
  return Array.from({length:8}, (_,i) => i).filter(i => key(previous.map(p => transform(p,i))) === target);
}
function fittedTransport(
  learning: PreviewLearning,
  actor: string,
  layout: VisualLayout,
  g: Ground,
  motors: Set<string>,
  available: Set<string>,
  local?: { epoch?: number; pivot: string; mask?: readonly XY[] }
) {
  for (const binding of Object.values(learning.bindings)) {
    if (
      binding.actor !== actor ||
      binding.gesture.point ||
      !available.has(binding.gesture.op) ||
      motors.has(binding.gesture.op)
    )
      continue;
    const roles = new Set(binding.witnesses.flatMap((w) => w.geometry?.pivots.map((p) => p.role) ?? []));
    for (const role of roles) {
      if (local && role !== local.pivot) continue;
      if (layout[role]?.length !== 1) continue;
      const examples: ProbePattern[] = [];
      for (const w of binding.witnesses) {
        if (local?.epoch !== undefined && w.epoch !== local.epoch) continue;
        const matches = w.geometry?.pivots.filter((p) => p.role === role);
        if (matches?.length !== 1) continue;
        const relative = (p: XY): XY => [
          Math.round((p[0] - matches[0]!.at[0]) / g.pitch[0]),
          Math.round((p[1] - matches[0]!.at[1]) / g.pitch[1]),
        ];
        const orientations = local?.mask ? matchingOrientations(matches[0]!.mask, local.mask) : [0];
        for (const orientation of orientations) examples.push({
          actor: transform(relative(w.from),orientation),
          centre: [0, 0],
          indicator: transform(relative(w.arrived),orientation),
          ref: examples.length,
        });
      }
      if (new Set(examples.map((e) => e.actor.join())).size < 2) continue;
      const predict = previewLaw(examples, true),
        pivot = cell(layout[role]![0]!.at, g);
      const land = (a: number, c: number) => {
        const at: XY = [a % g.width, Math.floor(a / g.width)],
          centre: XY = [c % g.width, Math.floor(c / g.width)];
        const choices = predict(at, centre);
        if (choices.length !== 1) return null;
        const [x, y] = choices[0]!.at;
        return x >= 0 && x < g.width && y >= 0 ? x + y * g.width : null;
      };
      return { pivot, role, op: binding.gesture.op, land };
    }
  }
  return null;
}
function contactBoard(m: ContactMemory, l: PreviewLearning, o: NativeObservation, rows: NativeRows, paired = false) {
  const layout = visualLayout(o, rows),
    available = new Set(o.available_action_refs);
  const targets: { actor: string; marker: string; offset?: XY }[] = [...(l.terminal ?? [])];
  if (m.explorer) targets.push({ actor: m.explorer.actor, marker: '' });
  for (const goal of targets) {
    const partial = m.partialSubject;
    const bodies = layout[goal.actor] ?? (partial?.actor === goal.actor && partial.frame === o.frame_hash ? [partial] : undefined),
      markers = goal.marker ? layout[goal.marker] : [],
      motion = l.partMotion?.[goal.actor];
    if (bodies?.length !== 1 || !markers || (goal.marker && markers.length !== (paired ? 2 : 1)) || !motion) continue;
    const controls = spatialControls(motion, available, '', {}, o.frame_hash, goal.actor);
    if (!controls || controls.motors.length < 2 || controls.motors.some((m) => !m.support)) continue;
    const pitch = controls.pitch;
    if (Math.min(...pitch) < 2) continue;
    const anchor = markers[0]?.at ?? m.explorer!.origin,
      origin: XY = [anchor[0] % pitch[0], anchor[1] % pitch[1]];
    const width = Math.ceil((2 * rows[0]!.length - origin[0]) / pitch[0]),
      height = Math.ceil((2 * rows.length - origin[1]) / pitch[1]);
    const g: Ground = { actor: goal.actor, role: goal.marker, origin, pitch, width };
    const actor = cell(bodies[0]!.at, g),
      goals = markers.map((v) => cell([v.at[0] - (goal.offset?.[0] ?? 0), v.at[1] - (goal.offset?.[1] ?? 0)], g));
    const motors = controls.motors.map((m) => ({
      op: m.op,
      delta: Math.round(m.d[0] / pitch[0]) + width * Math.round(m.d[1] / pitch[1]),
    }));
    const warp = fittedTransport(l, goal.actor, layout, g, new Set(motors.map((m) => m.op)), available);
    const floor =
      m.floor ??
      m.inheritedSupports?.find((law) => law.actor === goal.actor)?.floor ??
      surfaceFromVisits(motion.sites, rows, bodies[0]!.at, pitch, [bodies[0]!.at]) ??
      Number(Object.entries(motion.substrate).sort((a, b) => b[1] - a[1])[0]?.[0]);
    if (!Number.isFinite(floor)) continue;
    const fixed = new Set([actor, ...goals, ...(warp ? [warp.pivot] : [])]);
    if (paired && m.relayControl) for (const v of layout[m.relayControl.peer] ?? []) fixed.add(cell(v.at,g));
    const signals = new Set(
      Object.values(l.bindings)
        .filter((b) => b.actor === goal.actor)
        .map((b) => b.indicator)
    );
    for (const binding of Object.values(l.bindings).filter(
      (b) => b.actor === goal.actor && !motors.some((m) => m.op === b.gesture.op) && !b.gesture.point
    )) {
      for (const pivot of binding.witnesses[0]?.geometry?.pivots ?? [])
        if (binding.witnesses.filter((w) => w.geometry?.pivots.some((p) => p.role === pivot.role)).length >= 2)
          signals.add(pivot.role);
    }
    const visibleRoles = () =>
      Object.keys(layout).filter(
        (role) =>
          (!signals.has(role) || m.inheritedSupports?.some((law) => law.role === role && law.actor === g.actor)) &&
          layout[role]!.every((v) => {
            const w = v.box[2]! - v.box[0]! + 1,
              h = v.box[3]! - v.box[1]! + 1;
            const at = cell(v.at, g);
            if (
              fixed.has(at) ||
              m.supported.includes(at) ||
              m.verify?.at === at ||
              w * 2 > pitch[0] ||
              h * 2 > pitch[1] ||
              w * h * 8 < pitch[0] * pitch[1]
            )
              return false;
            const appearance = cellAppearance(rows, at, g);
            return !appearance.split(',').every((pixel) => Number(pixel) === floor);
          })
      );
    const roles = m.roles && !m.arrival ? m.roles : [...new Set([...(m.roles ?? []), ...visibleRoles()])];
    const appearances = m.appearances ?? {};
    const observed = new Map<string, Set<number>>(
      roles.map((role) => [role, new Set((layout[role] ?? []).map((v) => cell(v.at, g)))])
    );
    if (Object.keys(appearances).length) {
      const lookup = new Map(Object.entries(appearances).map(([role, look]) => [look, role]));
      for (let at = 0; at < width * height; at++) {
        const role = lookup.get(cellAppearance(rows, at, g));
        if (role) observed.get(role)?.add(at);
      }
    }
    const objects = roles
      .flatMap((role) => [...observed.get(role)!].map((at) => ({ at, role })))
      .sort((a, b) => a.role.localeCompare(b.role) || a.at - b.at);
    if (!objects.length && !m.supported.length && !m.verify && !Object.keys(m.pendingEntries ?? {}).length) continue;
    const walkable = new Set([
      ...fixed,
      ...objects.map((v) => v.at),
      ...m.supported,
      ...Object.keys(m.pendingEntries ?? {}).map(Number),
    ]);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const at: XY = [origin[0] + x * pitch[0], origin[1] + y * pitch[1]];
        if (dominantColor(rows, at, pitch) === floor) {
          walkable.add(x + y * width);
          continue;
        }
        if (m.inheritedSupports?.length) {
          const patch = cellPixels(rows, at, pitch),
            span = Math.round(pitch[0] / 2);
          if (
            patch.length === span * Math.round(pitch[1] / 2) &&
            span > 1 &&
            [patch[0], patch[span - 1], patch.at(-span), patch.at(-1)].every((colour) => colour === floor)
          )
            walkable.add(x + y * width);
        }
      }
    const pivotIndex = warp ? objects.length : -1;
    if (warp) objects.push({ at: warp.pivot, role: warp.role });
    const board: Board = {
      width,
      height,
      floor: walkable,
      goals,
      actor,
      parts: objects.map((v) => v.at),
      roles: objects.map((v) => v.role),
      motors,
      pivotIndex,
      ...(warp ? { transport: warp } : {}),
    };
    return { board, g, roles, floor };
  }
  return null;
}
export function proposeRelayContact(m:ContactMemory,l:PreviewLearning,o:NativeObservation,rows:NativeRows,limits:{maxDepth:number;maxNodes:number}):FrontierContact|null {
  const control=m.relayControl;
  if(!control || !o.available_action_refs.includes(control.op))return null;
  let run=m.relayRun;
  if(run && run.expected!==o.frame_hash){delete m.relayRun;run=undefined;}
  if(!run){
    if(m.refusedRelay?.includes(o.frame_hash)||!m.inheritedSupports?.length || !Object.keys(m.inheritedPassengers??{}).length)return null;
    const fit=contactBoard(m,l,o,rows,true);if(!fit)return null;
    const {board:b,g}=fit;
    if(g.actor!==control.actor||!b.transport||b.pivotIndex<0)return null;
    const layout=visualLayout(o,rows),peer=layout[control.peer],pivot=b.roles[b.pivotIndex]!;
    if(peer?.length!==1)return null;
    const cargoes=b.parts.map((_,i)=>i).filter(i=>i!==b.pivotIndex && m.inheritedPassengers?.[passengerBinding(b,g.actor,b.roles[i]!)]);
    if(cargoes.length!==1)return null;
    const cargo=cargoes[0]!,role=b.roles[cargo]!,witness=m.inheritedPassengers?.[passengerBinding(b,g.actor,role)];
    const mask=o.entities.find(e=>e.signature===layout[pivot]?.[0]?.form&&e.area<=16)?.mask.map(([x,y]):XY=>[x,y]);
    if(!witness||!mask)return null;
    const transport=fittedTransport(l,g.actor,layout,g,new Set(b.motors.map(v=>v.op)),new Set(o.available_action_refs),{pivot,mask});
    if(!transport)return null;
    const allows=(at:number)=>m.inheritedSupports!.some(law=>law.actor===g.actor&&law.role===role&&
      law.terrain===dominantColor(rows,[g.origin[0]+at%g.width*g.pitch[0],g.origin[1]+Math.floor(at/g.width)*g.pitch[1]],g.pitch));
    const select=(at:number)=>control.op+':'+Math.round((g.origin[0]+at%g.width*g.pitch[0])/2)+','+Math.round((g.origin[1]+Math.floor(at/g.width)*g.pitch[1])/2);
    const pivotAt=b.parts[b.pivotIndex]!,cargoAt=b.parts[cargo]!;
    // A projected landing can itself be segmented as a separate visible part.
    // Discard only an unbound occurrence at this independently predicted site.
    const preview=transport.land(cargoAt,pivotAt);
    const indicators=new Set(Object.values(l.bindings).filter(binding=>binding.actor===role && binding.gesture.op===transport.op).map(binding=>binding.indicator));
    if(b.parts.some((at,i)=>i!==cargo && i!==b.pivotIndex && (at!==preview || !indicators.has(b.roles[i]!))))return null;
    const scene={...b,parts:[cargoAt,pivotAt],roles:[role,pivot],pivotIndex:1,transport};
    const plan=relayTransportPlan(scene,cell(peer[0]!.at,g),0,allows,select,limits);
    if(!plan)return null;
    run={ground:g,plan,pivotRole:pivot,cargoRole:role,transfer:transport.op,witness,expected:o.frame_hash};
  }
  const step=run.plan.steps[0];if(!step)return null;
  return {...run.ground,step,relay:run,project:{purpose:'reach_goal',steps:run.plan.steps,site:run.plan.design.remote,
    role:run.cargoRole,preparations:[{at:run.plan.design.landing,role:run.cargoRole,enables:['park_subject','reconfigure_with_other_subject']}]},
    parts:[],acquired:false,ref:o.observation_ref,transform:run.transfer,terrain:null,previousEntry:null,priorContact:control.verification};
}

function recordRelay(m:ContactMemory,b:NativeObservation,a:NativeObservation,rows:NativeRows,next:NativeRows,run:RelayRun) {
  const s=run.plan.steps[0]!,g=run.ground,control=m.relayControl!;
  const layout=visualLayout(a,next);
  const has=(role:string,at:number)=>layout[role]?.some(v=>cell(v.at,g)===at)??false;
  const ink=(image:NativeRows,at:number)=>cellAppearance(image,at,g).split(',').includes(String(control.ink));
  const fail=()=>{(m.refusedRelay??=[]).push(b.frame_hash);delete m.relayRun;return 'relay_prediction_refuted';};
  if(s.select){
    if(!has(control.actor,s.to)||!has(control.peer,s.peerTo))return fail();
  }else{
    if(!ink(next,s.to)||!ink(next,s.peerTo))return fail();
    if(s.from!==s.to && s.from!==s.peerTo && ink(next,s.from))return fail();
    if(s.peerFrom!==s.peerTo && s.peerFrom!==s.to && ink(next,s.peerFrom))return fail();
    if(s.role && s.placed!==undefined){
      if(s.boundary && s.passenger){
        if(has(s.role,s.passenger.source)||has(s.role,s.placed)||cellAppearance(rows,s.placed,g)===cellAppearance(next,s.placed,g))return fail();
      }else if(!has(s.role,s.placed))return fail();
    }
  }
  const steps=run.plan.steps.slice(1);
  m.relayRun=steps.length?{...run,expected:a.frame_hash,plan:{...run.plan,steps}}:undefined;
  return s.select?'relay_control_exchanged':s.boundary?'relay_deposit_observed':s.peerFrom!==s.peerTo?'parked_subject_transferred':'relay_placement_observed';
}

export function proposeFrontierContact(
  m: ContactMemory,
  l: PreviewLearning,
  o: NativeObservation,
  rows: NativeRows,
  limits: { maxNodes: number; maxDepth: number }
): FrontierContact | null {
  const prior = !!m.inheritedSupports?.length || Object.keys(m.inheritedContact ?? {}).length > 0;
  if (!prior && !m.arrival && !m.active && !m.displaced.length && !m.verify && !m.supported.length) return null;
  const fit = contactBoard(m, l, o, rows);
  if (!fit) return null;
  const { board, g } = fit;
  const deny = new Set([...m.denied, ...(m.recoveredEdges ?? [])]);
  let project: Project | null = null;
  if (m.verify) {
    const at = m.verify.at,
      motor = board.motors.find((v) => board.actor + v.delta === at);
    if (motor && !deny.has(edgeKey(board.actor, motor.op, board.parts)))
      project = {
        purpose: 'test_support',
        site: at,
        role: m.verify.role,
        steps: [{ from: board.actor, to: at, op: motor.op }],
      };
  }
  const verifyEntry = !!project;
  if (!project && m.repair?.frame === o.frame_hash && m.repair.project.steps[0]?.from === board.actor)
    project = m.repair.project;
  const local = m.arrival ? new Set(fit.roles.filter((r) => !m.displaced.includes(r))) : new Set<string>();
  const nextStep = m.active?.steps[0];
  if (!project && (!local.size || m.active?.preparations || m.active?.passenger) && nextStep?.from === board.actor && m.active) {
    // Occlusion elsewhere is not evidence that this stance was lost. Check the
    // participant required by this step, then acquire the actual public return.
    const occupant = board.parts.indexOf(nextStep.to);
    const contradiction = occupant >= 0 && board.roles[occupant] !== nextStep.role;
    if (!contradiction) project = m.active;
  }
  const terrainAt = (id: number) =>
    dominantColor(
      rows,
      [g.origin[0] + (id % g.width) * g.pitch[0], g.origin[1] + Math.floor(id / g.width) * g.pitch[1]],
      g.pitch
    ) ?? null;
  if (!project) {
    if (!board.goals.length && !local.size) return null;
    const canProject = m.displaced.length > 0 || m.supported.length > 0 || !!m.inheritedContact?.[g.actor];
    const inherited = m.inheritedSupports?.filter((v) => v.actor === g.actor);
    if (inherited?.length && board.goals.length) {
      const terrains = new Map<number, number | null>();
      const permits = (role: string, id: number) => {
        if (!terrains.has(id)) terrains.set(id, terrainAt(id));
        return inherited.some((law) => law.role === role && law.terrain === terrains.get(id));
      };
      const passenger = m.repair?.passenger;
      if (passenger) {
        const b = calibratedBoard(fit, l, o, rows);
        if (b) project = repairWithPassenger(b, passenger.role, passenger.witness, at => permits(passenger.role, at), deny, limits);
      }
      if (!project && board.transport && board.pivotIndex >= 0) {
        const witnesses = new Map<string,string>();
        for (const role of board.roles) {
          const key = passengerBinding(board, g.actor, role);
          const witness = m.passengerWitnesses?.[key] ?? m.inheritedPassengers?.[key];
          if (witness) witnesses.set(role,witness);
        }
        if (witnesses.size) {
          const transport = orientedTransport(fit,l,o,rows) ?? calibratedBoard(fit,l,o,rows)?.transport;
          if (transport) {
            project = transportLandingPlan({...board,transport},witnesses,permits,deny,limits);
            for (const site of project?.preparations ?? []) {
              const terrain = terrainAt(site.at);
              if (terrain !== null) Object.assign(site,{terrain,observation:o.observation_ref});
            }
          }
        }
      }
      project ??= composeSupportPlan(board, permits, deny, limits);
      if (!project && board.transport && board.pivotIndex >= 0) {
        for (const [i, part] of board.parts.entries()) {
          if (i === board.pivotIndex) continue;
          const role = board.roles[i]!, binding = passengerBinding(board, g.actor, role);
          const witness = m.passengerWitnesses?.[binding];
          const appearance = m.appearances?.[role] ?? cellAppearance(rows, part, g);
          const related = inherited.filter(law => appearanceVariant(law.appearance, appearance));
          if (!related.length) continue;
          // A novel passive role warrants a discriminating experiment. For a known
          // passenger, reconfirm the local geometry before moving its control.
          const knownPassenger = witness ?? m.inheritedPassengers?.[binding];
          const transform = calibratedBoard(fit,l,o,rows)?.transport ??
            (!knownPassenger ? orientedTransport(fit,l,o,rows) : null);
          if (!transform) continue;
          project = passengerProject({ ...board, transport: transform }, i, witness,
            at => related.some(law => law.terrain === terrainAt(at)), deny, limits);
          if (project) {
            if (witness) {
              const transfer = project.steps.find(s => s.passenger);
              if (transfer) project.passenger = { role, source: transfer.passenger!.source, destination: transfer.placed!,
                pushes: transfer.passenger!.pushes, witness };
            }
            break;
          }
        }
      }
    }
    project ??= contactProject(
      canProject ? board : { ...board, goals: [] },
      deny,
      limits,
      local,
      m.verified ? (role, id) => !!m.verified![JSON.stringify([role, terrainAt(id)])] : undefined
    );
  }
  const step = project?.steps[0];
  if (!step || !project || deny.has(edgeKey(step.from, step.op, board.parts))) return null;
  if (!m.roles && project.purpose === 'reach_goal' && !project.steps.some((s) => s.role)) return null;
  const planned = project.preparations?.find((v) => project.steps.some((s) => s.boundary && s.placed === v.at));
  const terrain = verifyEntry
    ? m.verify!.terrain
    : step.boundary ? (project.preparations?.find(v => v.at === step.placed)?.terrain ?? terrainAt(step.placed!))
    : terrainAt(planned?.at ?? project.site);
  const law = m.verified?.[JSON.stringify([project.role, terrain])];
  return {
    ...g,
    step,
    project,
    parts: board.parts,
    ...(board.pivotIndex >= 0 ? { controlRole: board.roles[board.pivotIndex] } : {}),
    acquired: verifyEntry,
    transform: board.transport?.op ?? null,
    ref: o.observation_ref,
    terrain,
    previousEntry:
      law?.entry ??
      m.inheritedSupports?.find((v) => v.actor === g.actor && v.role === planned?.role && v.terrain === terrain)
        ?.entry ??
      null,
    priorContact: m.inheritedContact?.[g.actor] ?? null,
    ...(step.passenger && step.role ? { passengerBinding: passengerBinding(board, g.actor, step.role) } : {}),
  };
}
// An overlay can hide the silhouette. Use its pigment only if all its public
// pixels belonged to the subject's previous cell and still occupy one cell.
function pigmentSite(rows: NativeRows, pigment: number, g: Ground): XY | null {
  let site = -1;
  for (const [y,row] of rows.entries()) for (const [x,value] of row.entries()) {
    if (value !== pigment) continue;
    const at = cell([2*x,2*y],g);
    if (site !== -1 && at !== site) return null;
    site = at;
  }
  return site < 0 ? null : [g.origin[0]+(site%g.width)*g.pitch[0],g.origin[1]+Math.floor(site/g.width)*g.pitch[1]];
}
export function recordFrontierContact(
  m: ContactMemory,
  l: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows,
  trial: FrontierContact
) {
  if (b.level_epoch !== a.level_epoch || a.levels_completed > b.levels_completed) return 'official_progress';
  if(trial.relay)return recordRelay(m,b,a,rows,next,trial.relay);
  const before = contactBoard(m, l, b, rows),
    after = visualLayout(a, next);
  if (!before) return 'unresolved_subject';
  m.roles = before.roles;
  m.floor ??= before.floor;
  m.appearances ??= {};
  for (const role of before.roles) {
    if (m.appearances[role]) continue;
    const a = before.board.parts.filter((_, i) => before.board.roles[i] === role);
    const looks = new Set(a.map((p) => cellAppearance(rows, p, trial)));
    if (looks.size === 1) m.appearances[role] = [...looks][0]!;
  }
  const s = trial.step,
    body = after[trial.actor],
    oldBody = visualLayout(b,rows)[trial.actor];
  let at = body?.length === 1 ? cell(body[0]!.at,trial) : null;
  if (trial.project.landing && !body?.length) {
    const pigment = oldBody?.length === 1 ? b.entities.find(e => e.signature === oldBody[0]!.form)?.palette_value :
      (m.partialSubject?.frame === b.frame_hash ? m.partialSubject.pigment : undefined);
    if (pigment !== undefined) {
      const first = pigmentSite(rows,pigment,trial), second = pigmentSite(next,pigment,trial);
      if (first && second && cell(first,trial) === s.from) {
        at = cell(second,trial);
        m.partialSubject = {actor:trial.actor,frame:a.frame_hash,pigment,at:second};
      }
    }
  }
  const pending = m.verify;
  const tail = trial.project.steps.slice(1);
  delete m.active;
  delete m.verify;
  if (at !== s.to) {
    m.denied.push(edgeKey(s.from, s.op, trial.parts));
    if (m.pendingEntries) delete m.pendingEntries[s.to];
    m.arrival = false;
    return 'movement_refuted';
  }
  m.arrival = s.op === trial.transform && crossesIntoUnseenRegion(before.board, s.from, s.to, m.visited ?? []);
  const visited = (m.visited ??= []);
  if (!visited.includes(s.from)) visited.push(s.from);
  const entered = m.pendingEntries?.[s.to];
  if (entered) {
    if (!m.supported.includes(s.to)) m.supported.push(s.to);
    (m.verified ??= {})[JSON.stringify([entered.role, entered.terrain])] = {
      displacement: entered.displacement,
      entry: a.observation_ref,
    };
    delete m.pendingEntries![s.to];
  }
  if (s.role && s.placed !== undefined) {
    const parts = after[s.role] ?? [];
    if (s.passenger) {
      const appearance = m.appearances[s.role];
      const present = (p: number) => parts.some(v => cell(v.at, trial) === p) ||
        (!!appearance && cellAppearance(next, p, trial) === appearance);
      const atSource = before.board.parts.some((p, i) => p === s.passenger!.source && before.board.roles[i] === s.role);
      const alreadyAtDestination = before.board.parts.includes(s.placed);
      const arrivalObserved = s.boundary
        ? !present(s.placed) && cellAppearance(rows,s.placed,trial) !== cellAppearance(next,s.placed,trial)
        : present(s.placed);
      if (!trial.passengerBinding || !atSource || alreadyAtDestination || at !== s.from || present(s.passenger.source) || !arrivalObserved) {
        m.denied.push(edgeKey(s.from, s.op, trial.parts));
        return 'passenger_transfer_refuted';
      }
      if (!s.boundary) (m.passengerWitnesses ??= {})[trial.passengerBinding] = a.observation_ref;
    }
    if (
      parts.some((v) => cell(v.at, trial) === s.placed) ||
      m.appearances[s.role] === cellAppearance(next, s.placed, trial)
    ) {
      if (!m.displaced.includes(s.role)) m.displaced.push(s.role);
    } else if (s.boundary && parts.length === before.board.roles.filter((r) => r === s.role).length - 1) {
      const law = m.inheritedSupports?.find(
        (v) => v.actor === trial.actor && v.role === s.role && v.terrain === trial.terrain
      );
      if (trial.project.preparations && law && tail.length) {
        (m.pendingEntries ??= {})[s.placed] = { ...law, displacement: a.observation_ref };
        m.active = { ...trial.project, steps: tail };
        return 'observed_conversion_continue_conditional_plan';
      }
      m.verify = { at: s.placed, role: s.role, terrain: trial.terrain, displacement: a.observation_ref };
      return 'object_changed_at_frontier_test_entry';
    } else {
      m.denied.push(edgeKey(s.from, s.op, trial.parts));
      return 'contact_effect_refuted';
    }
  }
  if (trial.acquired && pending) {
    if (!m.supported.includes(s.to)) m.supported.push(s.to);
    (m.verified ??= {})[JSON.stringify([pending.role, pending.terrain])] = {
      displacement: pending.displacement,
      entry: a.observation_ref,
    };
    if (pending.terrain !== null) {
      const law = {
        floor: before.floor,
        actor: trial.actor,
        role: pending.role,
        terrain: pending.terrain,
        entry: a.observation_ref,
        displacement: pending.displacement,
      };
      m.supportLessons = [
        ...(m.supportLessons ?? []).filter(
          (v) => v.actor !== law.actor || v.role !== law.role || v.terrain !== law.terrain
        ),
        law,
      ];
    }
    m.denied = [];
    return 'new_support_entered';
  }
  if (trial.project.steps.length > 1) {
    m.active = { ...trial.project, steps: trial.project.steps.slice(1) };
  }
  return s.passenger ? 'passenger_transfer_observed' : s.role ? 'object_displaced' : m.arrival ? 'arrived_to_investigate' : 'approach_verified';
}

export function observeRegionArrival(
  m: ContactMemory,
  l: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows
) {
  delete m.active;
  const before = visualLayout(b, rows),
    after = visualLayout(a, next);
  const actors = l.terminal?.length ? [...new Set(l.terminal.map((g) => g.actor))] : Object.keys(l.partMotion ?? {});
  for (const actor of actors) {
    const p = before[actor],
      q = after[actor];
    if (p?.length !== 1 || q?.length !== 1) continue;
    const delta = [Math.abs(p[0]!.at[0] - q[0]!.at[0]), Math.abs(p[0]!.at[1] - q[0]!.at[1])];
    if (!delta.some((v) => v > 2)) continue;
    const model = l.partMotion?.[actor],
      controls = model && spatialControls(model, new Set(b.available_action_refs), '', {}, b.frame_hash, actor);
    if (!controls || controls.motors.filter((s) => s.support).length < 2) continue;
    const d = delta[0]! / controls.pitch[0] + delta[1]! / controls.pitch[1];
    if (d > 2) {
      if (!l.terminal?.length) m.explorer = { actor, origin: p[0]!.at };
      const fit = contactBoard(m, l, b, rows);
      if (fit) {
        const previous = cell(p[0]!.at, fit.g),
          visited = (m.visited ??= []);
        m.arrival = crossesIntoUnseenRegion(fit.board, previous, cell(q[0]!.at, fit.g), visited);
        if (!visited.includes(previous)) visited.push(previous);
      }
      if (!m.arrival && !l.terminal?.length) delete m.explorer;
      break;
    }
  }
}

export function observeStrandedTransport(
  m: ContactMemory,
  learning: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows,
  op: string,
  limits: { maxNodes: number; maxDepth: number },
  experiment?: FrontierContact
) {
  if (!m.inheritedSupports?.length || b.level_epoch !== a.level_epoch || b.levels_completed !== a.levels_completed)
    return;
  const fit = contactBoard(m, learning, b, rows);
  if (!fit?.board.transport) return;
  const { board, g } = fit,
    motor = board.motors.find((v) => v.op === op);
  if (
    !motor ||
    b.available_action_refs.some(
      (action) => action !== board.transport?.op && !board.motors.some((v) => v.op === action)
    )
  )
    return;
  const pivot = board.parts[board.pivotIndex]!;
  if (stepCell(board, board.actor, motor.delta) !== pivot) return;
  const dest = stepCell(board, pivot, motor.delta),
    layout = visualLayout(a, next);
  const single = (role: string, p: number) => layout[role]?.length === 1 && cell(layout[role]![0]!.at, g) === p;
  if (!single(g.actor, pivot) || !single(board.roles[board.pivotIndex]!, dest)) return;
  const parts = board.parts.slice();
  parts[board.pivotIndex] = dest;
  if (experiment) {
    // A successful experimental push can still destroy a necessary capability.
    // Evaluate the outcome against the locally witnessed geometry. A useful
    // final placement or a search stopped by its budget is not a reset proof.
    const pushes = (p: number) => board.motors.filter(motor =>
      board.floor.has(stepCell(board, p, motor.delta)) && board.floor.has(stepCell(board, p, -motor.delta))
    ).map(motor => motor.op);
    const priorPushes = pushes(pivot), remainingPushes = pushes(dest);
    if (!priorPushes.length || remainingPushes.length || experiment.project.purpose === 'reach_goal') return;
    const local = calibratedBoard(fit, learning, b, rows);
    if (!local) return;
    const edge = edgeKey(board.actor, op, board.parts);
    const denied = new Set([...m.denied, ...(m.recoveredEdges ?? []), edge]);
    const roles = new Set(board.roles.filter((_,i) => i !== board.pivotIndex));
    const configurations = closedSupportRegion({...local, actor:pivot, parts}, limits.maxNodes, roles);
    if (configurations === null) return;
    const terrains = new Map<number, number | undefined>();
    const allowed = (role: string, id: number) => {
      if (!terrains.has(id)) terrains.set(id, dominantColor(rows,
        [g.origin[0] + (id % g.width) * g.pitch[0], g.origin[1] + Math.floor(id / g.width) * g.pitch[1]], g.pitch));
      return m.inheritedSupports?.some(law => law.actor === g.actor && law.role === role && law.terrain === terrains.get(id)) ?? false;
    };
    let project: Project | null = null;
    let passenger: ContactRepair['passenger'];
    for (const role of roles) {
      const binding = passengerBinding(board, g.actor, role);
      const witness = m.passengerWitnesses?.[binding] ?? m.inheritedPassengers?.[binding];
      if (!witness) continue;
      project = repairWithPassenger(local, role, witness, site => allowed(role, site), denied, limits);
      if (project) {
        passenger = {role, witness};
        break;
      }
    }
    project ??= composeSupportPlan(local, allowed, denied, limits);
    if (project) {
      const repair = {frame:b.frame_hash, edge, project, priorPushes, remainingPushes, ...(passenger ? {passenger} : {})};
      m.deadlock = {ref:a.observation_ref, previous:b.observation_ref, edge, configurations, repair};
    }
    return;
  }
  const states = closedSupportRegion({ ...board, parts, actor: pivot }, limits.maxNodes);
  if (states === null) return;
  const prior = proposeFrontierContact({ ...m, active: undefined, verify: undefined }, learning, b, rows, limits);
  if (!prior?.project.preparations) return;
  m.deadlock = {
    ref: a.observation_ref,
    previous: b.observation_ref,
    edge: edgeKey(board.actor, op, board.parts),
    configurations: states,
  };
}
