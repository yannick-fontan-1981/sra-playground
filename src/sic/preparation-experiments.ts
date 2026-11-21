import { assessLocal, canCompareAnotherPreparation, continuationAt, demonstratedLimit, hasLocalContrast, localCommand, newLocalMemory, observeLocal, proposeLocal, revisitedChoice, stalledLocal, type LocalForecast, type LocalMemory } from './prospective-local-use.ts';
import { hasExperimentOpportunity, recordReturn, type ReturnHistory } from './experiment-arbitration.ts';
import {newCursorMemory,recordCursorTrial,type CursorMemory,type CursorTrial} from './marked-cursor-selection.ts';

import { nextConfiguration, newConfigurationMemory, observeConfiguration, type ConfigurationMemory, type ConfigurationTrial } from './configuration-trials.ts';
import {searchForMissingCue,type CueTest} from './seek-missing-preview.ts';
import {equalPose,readGroup,type RelativeMemory} from './relative-motion-learning.ts';
import {continueRelativePlan,relativeReceipt,type RelativeTrial} from './relative-motion-plan.ts';
import {offerWitnessedPreview,visualLayout,checkWitnessedPreview,type PreviewLearning,type PreviewCarry,type ReadOffer} from './witnessed-preview-transfer.ts';
import {offerTerminalContact,measureTerminalContact,type TerminalTrial} from './terminal-contact.ts';
import {proposeMobilityTest,measureMobility,type MobilityProbe} from './test-mechanism-mobility.ts';
import {newLocalProgress,measureLocalRepeat,observeVacatedSites,knownLocalRepeat,repeatKey,type LocalProgress,type ZoneRepeat} from './local-progress.ts';
import {offerMechanism,finishMechanism,type MechanismTrial} from './reconfigure-local-mechanism.ts';
import {offerUnreadIndicator,measureUnreadIndicator,type IndicatorMemory,type IndicatorTest} from './probe-unread-indicators.ts';
import {newOccupancyMemory,occupancyView,occupancyForms,observePoses,poseRole,offerOccupancy,offerPreparedPreview,finishOccupancy,type OccupancyMemory,type OccupancyTrial} from './occupancy-programs.ts';
import {inTerritory,newTerritorialMemory,offerTerritory,recordTerritory,type TerritorialMemory,type TerritorialTrial} from './pursue-territory.ts';
import {offerActivation,recordActivation,type Activation,type ActivationReceipt} from './latent-response.ts';
import {
  newFrameMemory,
  offerFrame,
  recordFrame,
  rememberDuplicatePoses,
  type FrameMemory,
  type FrameTrial,
} from './inverse-frame-experiment.ts';
import {newRetainedMemory,offerRetained,recordRetained,type RetainedTrial,type RetainedMemory} from './retained-edits.ts';
import { newInstrumentMemory, offerInstrument, recordInstrument, type SiteTrial, type InstrumentMemory } from './instrument-experiment.ts';
import { newContextMemory, offerContext, recordContext, type ContextMemory, type ContextTrial } from './transported-control.ts';
import { witnessManipulation, type Manipulation } from './return-programs.ts';
import {newExchangeMemory,exchangeOffer,observeExchange,recordExchange,type ExchangeMemory,type ExchangeTrial} from './placed-exchange.ts';
import { newDelayedMemory, selectDelayed, recordDelayed, type DelayedTrial, type DelayedMemory } from './distinguishing-suffix.ts';
import type {
  NativeCommand,
  NativeEntity,
  NativeObservation,
  NativeRows,
} from '../logos-engine/v6-native-types.ts';
import { observedCommandKey } from './observed-command-frontier.ts';
import returnPrior from './preparation-return-prior.json' with { type: 'json' };
export const preparationReturns: Readonly<
  Record<string, { probability: number; games: number; reversingGames: number }>
> = returnPrior;
import { selectPlacement, updatePlacement, type Placement } from './position-experiment.ts';
import {
  changedMark,
  witnessAnchors,
  proposeDerivation,
  carryStep,
  derivationReceipt,
  type Anchor,
  type Mark,
  type Derivation,
} from './derive-at-site.ts';

import { observeFloor } from './access-terrain.ts';
import {
  proposeAccess,
  recordAccess,
  newSpatialMemory,
  type SpatialMemory,
  type AccessCard,
} from './spatial-access.ts';

import {
  freshCapabilities,
  proposeCapability,
  recordCapability,
  type CapabilityMemory,
  type CapabilityTrial,
} from './derive-capabilities.ts';
import { newProjectionMemory, proposeProjection, recordProjection, type Trial, type ProjectionMemory } from './projected-affordances.ts';
import {chooseTransfer,newTransferMemory,recordTransfer,type TransferTrial,type TransferMemory} from './configurable-transfers.ts';
import {witnessedSites} from './site-operations.ts';
import {newFrontierMemory,selectFrontier,recordFrontier,type FrontierMemory,type FrontierTrial} from './experimental-frontier.ts';
import {conditionalPlacements,placementOffer,placementReceipt,type ConditionalTrial,type LearnedPlacement,type ReconsiderPlacement} from './conditional-placements.ts';
export type Move = { actor: string; from: string; to: string; dx: number; dy: number };
export type Effect = { key: string; moves: Move[] };
export type Edge = {
  s: number;
  t: number;
  cmd: string;
  effect: Effect;
  ref: number;
  stable: boolean;
  anchors: Record<string, Anchor>;
  mark?: Mark;
  visibleAfter?: string[];
  manipulation?: Manipulation;
};
export type Pair = {
  origin: number;
  prep: string;
  probe: string;
  prepared: number;
  direct: Edge;
  after: Edge;
  first: Edge;
  id: string;
};
type Rule = {
  id: string;
  evaluations: number;
  refutations: number;
  uses: number;
  last: number;
  verifiedAt?: number;
};
import {observePlacement} from './paired-landmark-placement.ts';
export type Experiment = {
  phase:
    | 'composeObservedTransport'
    | 'testLandmarkPlacement'
    | 'selectMarkedCursor'
    | 'verifyMarkedCursor'
    | 'advanceSelectedCursor'
    | 'repairSelectedCursor'
    | 'testConfiguration'
    | 'localCapacity'
    | 'seekTerminalContact'
    | 'useRelativePlacement'
    | 'seekMissingCue'
    | 'positionForOperation'
    | 'usePositionedOperation'
    | 'testScoringContact'
    | 'testMechanismMobility'
    | 'reconfigureMechanism'
    | 'unreadIndicator'
    | 'witnessedPreview'
    | 'occupancy'
    | 'territorialAccess'
    | 'activateResponse'
    | 'inverseFrame'
    | 'instrumentSite'
    | 'transportControl'
    | 'placedExchange'
    | 'configuredTransfer'
    | 'conditionSetup' | 'conditionTrigger' | 'conditionUse'
    | 'frontierRoute' | 'frontierProbe' | 'frontierUse' | 'frontierConsequence'
    | 'delayedProbe'
    | 'projection'
    | 'prepare'
    | 'probe'
    | 'control'
    | 'confirmControl'
    | 'confirmA'
    | 'confirmB'
    | 'reuseA'
    | 'reuseB'
    | 'route'
    | 'inverse'
    | 'explore'
    | 'position'
    | 'positionB'
    | 'deriveControl'
    | 'deriveA'
    | 'deriveB'
    | 'carry'
    | 'carryB'
    | 'capabilityUse'
    | 'capabilityStep'
    | 'accessContinue'
    | 'accessSetup'
    | 'accessTrigger';
  origin: number;
  a: string;
  b: string;
  rule: string;
  expected?: string;
  predictedGap?: boolean;
  prepEffect?: string;
  purpose?: string;
  refs: number[];
  localCapacity?: LocalForecast;
  configurationTrial?: ConfigurationTrial;
  cooperative?: import('./transport-observations.ts').TransportForecast;
  cursorTrial?: CursorTrial;
  landmark?: import('./paired-landmark-placement.ts').LandmarkTrial;
  cue?: CueTest;
  relative?: RelativeTrial;
  delayed?: DelayedTrial;
  frontier?: FrontierTrial;
  condition?: ConditionalTrial;
  projection?: Trial;
  frame?:FrameTrial;
  activation?:Activation;
  territorial?:TerritorialTrial;
  terminalContact?:TerminalTrial;
  mobilityProbe?:MobilityProbe;
  mechanism?:MechanismTrial;
  unreadIndicator?:IndicatorTest;
  witnessedPreview?:ReadOffer;
  occupancy?:OccupancyTrial;
  instrument?:SiteTrial;
  retained?:RetainedTrial;
  transport?:ContextTrial;
  exchange?: ExchangeTrial;
  transfer?: TransferTrial;
  placement?: Placement;
  derive?: Derivation;
  equation?: CapabilityTrial;
  access?: { card: AccessCard; step: number; alternatives: Record<string, unknown>[] };
};
export type Outcome = {
  localCapacity?: ReturnType<typeof assessLocal>;
  precondition?: string;
  predictedGap?: boolean;
  phase: string;
  hypothesis: string;
  result: string;
  longer: boolean;
  actor: string | null;
  from: string | null;
  to: string | null;
  localPath: boolean | null;
  revision: number;
  refs: number[];
  trainedSite?: string;
  testSite?: string;
  predicted?: string;
  actual?: string;
  bareEffect?: string;
  enabledMotion?: boolean;
  capability?: Derivation['capability'];
  strictMatch?: boolean;
  access?: Record<string, unknown>;
  equation?: Record<string, unknown>;
  delayed?: Record<string, unknown>;
  frontier?: Record<string, unknown>;
  condition?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  frame?:Record<string,unknown>;
  activation?:Record<string,unknown>;
  territorial?:Record<string,unknown>;
  localRepeat?:ZoneRepeat;
  terminalContact?:Record<string,unknown>;
  relativePlacement?:Record<string,unknown>;
  cueSearch?:Pick<CueTest,'binding'|'probe'|'target'|'routing'> & {visible:boolean};
  mobilityProbe?:Record<string,unknown>;
  mechanism?:Record<string,unknown>;
  unreadIndicator?:Record<string,unknown>;
  witnessedPreview?:Record<string,unknown>;
  occupancy?:Record<string,unknown>;
  instrument?:Record<string,unknown>;
  retained?:Record<string,unknown>;
  transport?:Record<string,unknown>;
  exchange?: Record<string, unknown>;
  transfer?: Record<string, unknown>;
};
export type Memory = {
  placementVisits?:import('./recurrent-placement.ts').PlacementVisits;
  transportLearning?: import('./transport-observations.ts').TransportMemory;
  crossing?:import('./sustained-crossing.ts').Crossing;
  pairInquiry?:import('./probe-paired-displacements.ts').PairInquiry;
  pairLesson?:import('./probe-paired-displacements.ts').ReusableEffects;
  priorMotions?:import('./motion-before-selection.ts').PriorMotions;
  coverage?:import('./controlled-coverage.ts').Coverage;
  cursorSelection?: CursorMemory;
  landmarkMemory?: import('./paired-landmark-placement.ts').LandmarkMemory;
  relativeMotion?: RelativeMemory;
  configurations?: ConfigurationMemory;
  configurationOpportunity?: boolean;
  localCapacity?: LocalMemory;
  localCarry?: LocalMemory;
  returnHistory?: ReturnHistory;
  activations?:ActivationReceipt[];
  territory?:TerritorialMemory;
  previewLearning?:PreviewLearning;
  previewCarry?:PreviewCarry|null;
  localProgress?:LocalProgress;
  indicators?:IndicatorMemory;
  occupancy?:OccupancyMemory;
  epoch: number;
  delayed: DelayedMemory;
  frontier:FrontierMemory;
  condition?: ConditionalTrial | null;
  reconsiderPlacement?: ReconsiderPlacement | null;
  conditionLearned?: Record<string,LearnedPlacement>;
  projection: ProjectionMemory;
  frames?:FrameMemory;
  instrument?: InstrumentMemory;
  retained?:RetainedMemory;
  contexts?: ContextMemory;
  exchanges?: ExchangeMemory;
  transfers?: TransferMemory;
  space: SpatialMemory;
  equations: CapabilityMemory;
  scenes: string[];
  revisionScene: Record<number, number>;
  edges: Edge[];
  chains: { first: number; second: number }[];
  rules: Record<string, Rule>;
  previous: number;
  pending: Experiment | null;
  derivationOrigin: Experiment | null;
  placement: Placement | null;
  blocked: Record<string, number>;
  activeMarks: Record<string, { op: string; bare: string; revision: number }>;
  attempts: Record<string, number>;
  turns: number;
  lastTrial: number;
  recurrences: number;
  seenAt: number[];
};
export const initialMemory = (epoch: number): Memory => ({
  epoch,
  delayed: newDelayedMemory(),
  frontier:newFrontierMemory(),
  projection: newProjectionMemory(),
  instrument: newInstrumentMemory(),
  frames:newFrameMemory(),
  territory:newTerritorialMemory(),
  retained:newRetainedMemory(),
  contexts: newContextMemory(),
  exchanges: newExchangeMemory(),
  transfers: newTransferMemory(),
  space: newSpatialMemory(),
  equations: freshCapabilities(),
  scenes: [],
  revisionScene: {},
  edges: [],
  chains: [],
  rules: {},
  previous: -1,
  pending: null,
  derivationOrigin: null,
  placement: null,
  blocked: {},
  activeMarks: {},
  attempts: {},
  turns: 0,
  lastTrial: -1,
  recurrences: 0,
  seenAt: [],
});
export const sceneKey = (o: NativeObservation) =>
  o.frame_hash + '|' + [...o.available_action_refs].sort().join(',');
function sceneIndex(m: Memory, o: NativeObservation) {
  const k = sceneKey(o);
  let i = m.scenes.indexOf(k);
  if (i < 0) {
    i = m.scenes.length;
    m.scenes.push(k);
  }
  return i;
}
const pos = (e: NativeEntity) => e.position.join(',');
export function measureEffect(
  before: NativeObservation,
  after: NativeObservation,
  rows: NativeRows,
  next: NativeRows
): Effect {
  if (before.levels_completed < after.levels_completed || after.state === 'WIN')
    return { key: 'completion', moves: [] };
  if (before.state !== after.state) return { key: 'terminal:' + after.state, moves: [] };
  if (before.frame_hash === after.frame_hash) return { key: 'still', moves: [] };
  const entities = new Map(after.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e]));
  const moves: Move[] = [];
  for (const e of before.entities) {
    const d = !e.identity_ambiguous && entities.get(e.signature);
    if (!d || pos(e) === pos(d)) continue;
    moves.push({
      actor: e.signature,
      from: pos(e),
      to: pos(d),
      dx: d.position[0] - e.position[0],
      dy: d.position[1] - e.position[1],
    });
  }
  moves.sort((a, b) => a.actor.localeCompare(b.actor));
  if (moves.length)
    return { key: 'move:' + moves.map((m) => [m.actor, m.dx, m.dy].join('/')).join('|'), moves };
  // Compare the change attributable to B in its own arm. Absolute endpoints include A.
  const replacements = new Map<string, number>();
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y]!.length; x++) {
      const v = rows[y]![x],
        w = next[y]?.[x];
      if (v === w) continue;
      const k = v + '>' + w;
      replacements.set(k, (replacements.get(k) ?? 0) + 1);
    }
  return {
    key:
      'edit:' +
      Array.from(replacements)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, n]) => k + 'x' + n)
        .join(','),
    moves,
  };
}
const idOf = (s: number, a: string, b: string) => [s, a, b].join('|');
function stableIndex(m: Memory) {
  const index = new Map<string, Edge>();
  for (const e of m.edges) if (e.stable) index.set(e.s + '|' + e.cmd, e);
  return index;
}
function pairs(m: Memory): Pair[] {
  const index = stableIndex(m),
    pairs = new Map<string, Pair>();
  for (const c of m.chains) {
    const a = m.edges[c.first]!,
      b = m.edges[c.second]!;
    if (!a.stable || !b.stable || a.s === a.t || a.cmd === b.cmd || a.t !== b.s) continue;
    const d = index.get(a.s + '|' + b.cmd);
    if (!d || d.effect.key === b.effect.key) continue;
    const id = idOf(a.s, a.cmd, b.cmd);
    pairs.set(id, {
      id,
      origin: a.s,
      prepared: a.t,
      prep: a.cmd,
      probe: b.cmd,
      direct: d,
      after: b,
      first: a,
    });
  }
  return [...pairs.values()];
}
function firstRoutes(m: Memory, start: number, limit: number) {
  const outgoing = new Map<number, Edge[]>();
  for (const e of m.edges)
    if (e.stable && e.s !== e.t && e.effect.key!=='completion' && !e.effect.key.startsWith('terminal:')) {
      const g = outgoing.get(e.s) ?? [];
      g.push(e);
      outgoing.set(e.s, g);
    }
  const routes = new Map<number, { first: Edge | null; length: number }>([
      [start, { first: null, length: 0 }],
    ]),
    queue = [start];
  for (const s of queue) {
    const path = routes.get(s)!;
    if (path.length >= limit) continue;
    for (const e of outgoing.get(s) ?? [])
      if (!routes.has(e.t)) {
        routes.set(e.t, { first: path.first ?? e, length: path.length + 1 });
        queue.push(e.t);
      }
  }
  return routes;
}
const length = (m: Move) => Math.abs(m.dx) + Math.abs(m.dy);
function distanceEvidence(m: Memory, edge: Edge) {
  for (const move of edge.effect.moves) {
    const all = m.edges
      .filter((e) => e.stable && e !== edge)
      .flatMap((e) => e.effect.moves.filter((v) => v.actor === move.actor));
    const magnitudes = all
      .map(length)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (magnitudes.length < 3) continue;
    const step = magnitudes[Math.floor((magnitudes.length - 1) / 2)]!;
    if (length(move) < 2 * step) continue;
    const reached = new Set([move.from]),
      q = [move.from];
    for (const point of q)
      for (const v of all)
        if (length(v) <= step) {
          const to = v.from === point ? v.to : v.to === point ? v.from : null;
          if (to && !reached.has(to)) {
            reached.add(to);
            q.push(to);
          }
        }
    return { move, localPath: reached.has(move.to) };
  }
  return null;
}
function similarity(m: Memory, p: Pair, current: number) {
  if (current === p.origin) return 2;
  const edges = m.edges.filter((e) => e.s === current && e.stable);
  const a = edges.find((e) => e.cmd === p.prep),
    b = edges.find((e) => e.cmd === p.probe);
  return a?.effect.key === p.first.effect.key && b?.effect.key === p.direct.effect.key ? 1 : 0;
}
function selectEstablishedExperiment(
  m: Memory,
  o: NativeObservation,
  inputs: readonly NativeCommand[],
  late: boolean,
  rows?: NativeRows
): Experiment | null {
  const retained = Object.keys(m.previewLearning?.bindings ?? {}).length > 0 || !!m.previewLearning?.terminal?.length || !!m.previewLearning?.inheritedPreparations?.length;
  const s = retained ? sceneIndex(m, o) : m.scenes.indexOf(sceneKey(o)),
    available = new Set(inputs.map(observedCommandKey));
  if (s < 0 || !available.size) return null;
  const sought=m.previewLearning?.cueSearch?.seeking;
  if(rows && sought && m.previewLearning){
    const layout=visualLayout(o,rows);
    const read=offerWitnessedPreview(m.previewLearning,o,layout,available,sought);
    if(read)return {phase:'witnessedPreview',origin:s,a:read.command,b:read.command,refs:[],rule:'use_the_rediscovered_cue',witnessedPreview:read};
    // A testable scoring contact is an alternative to recovering the old capacity.
    const contact=m.previewLearning.terminal?.length ? offerTerminalContact(m,s,o,rows,available) : null;
    if(contact?.terminalContact?.distance===1)return contact;
    const probe=searchForMissingCue(m,s,o,layout,available,firstRoutes(m,s,m.scenes.length));
    if(probe)return probe;
  }
  if(rows && m.previewLearning?.blockedGoal && m.previewLearning.inheritedPreparations?.length){
    const situated=offerTerminalContact(m,s,o,rows,available,'positioned');
    if(situated)return situated;
  }
  if(rows&&m.previewLearning?.terminal?.length){const goal=offerTerminalContact(m,s,o,rows,available);if(goal)return goal;}
  const frontier=m.frontier;
  frontier.choices[s]=[...available];
  const free = !m.frames?.active && !m.retained?.active && !m.instrument?.active && !m.contexts?.active &&
    !m.exchanges?.active && !m.transfers?.active && !m.condition && !m.pending && !m.projection.active &&
    !m.equations.active && !m.space.active && !frontier.follow && !frontier.question && !m.delayed.active;
  if(rows && free && m.previewLearning?.inheritedPreparations?.length && !m.previewLearning.terminal?.length && hasExperimentOpportunity(m)){
    const situated=offerTerminalContact(m,s,o,rows,available,'positioned');
    if(situated)return situated;
  }
  const read=rows&&m.previewLearning&&!m.occupancy?.active?offerWitnessedPreview(m.previewLearning,o,visualLayout(o,rows),available):null;
  const priorRepeat=read?knownLocalRepeat(m,s,read.command):null;
  const stagnant=priorRepeat??(m.localProgress?.last?.returnScene===s?m.localProgress.last:null);
  if(rows&&m.occupancy&&!m.occupancy.active&&!m.territory?.active){
    const goal=m.territory?.goal,actor=goal&&o.entities.find(e=>!e.identity_ambiguous&&e.signature===goal.actor);
    const frontier=actor&&goal?{role:poseRole(actor),homeSize:goal.homeSize,outsideSize:goal.outsideSize,contains:(at:[number,number])=>{
      const x=(at[0]-actor.bbox[2]+actor.bbox[0])/2,y=(at[1]-actor.bbox[3]+actor.bbox[1])/2;
      return Number.isInteger(x)&&Number.isInteger(y)&&inTerritory(goal,[x,y]);
    }}:undefined;
    const redirected=(free||!!stagnant)&&!m.localProgress?.active&&offerPreparedPreview(m.occupancy,s,available,rows[0]!.length,rows.length,frontier,m.previewLearning?{epoch:o.level_epoch,memory:m.previewLearning}:undefined);
    if(redirected&&redirected.occupancy?.plan.preparedPreview?.alternatives[0]?.opensMeasuredRegion)return redirected;
    const mechanism=offerMechanism(m,s,o,rows,available,stagnant);
    if(mechanism)return mechanism;
    if(redirected)return redirected;
    const probe=proposeMobilityTest(m,s,o,rows,available,stagnant);if(probe)return probe;
    const unread=read?.basis!=='observed_in_previous_level'&&offerUnreadIndicator(m,s,o,available,(id,site)=>frontier?.role===id&&frontier.contains(site)&&!frontier.contains(m.occupancy!.layouts[s]![id]!));
    if(unread)return unread;
  }
  if(read&&!priorRepeat&&(read.basis==='observed_in_previous_level'||free&&m.recurrences>0)){
      return {phase:'witnessedPreview',origin:s,a:read.command,b:read.command,rule:'subject_reaches_visible_indicator',refs:[],witnessedPreview:read};
  }
  if(rows&&m.occupancy&&(m.occupancy.active||free&&!m.territory?.active&&m.recurrences>0)){
    const plan=offerOccupancy(m.occupancy,s,available,rows[0]!.length,rows.length);if(plan)return plan;
  }
  if(rows&&(m.territory?.active||m.territory?.words?.primed?.ref===o.revision||m.territory?.words?.resume===o.revision||free)){
    const intent=offerTerritory(m,o,rows,s,available);if(intent)return intent;
  }
  if(rows&&free&&returnedToPlacement(m)){
    const experiment=offerFrame(m,o,rows,s,available,'opportunity')??offerActivation(m,o,rows,s,available);
    if(experiment)return experiment;
  }
  if (rows && (m.frames?.active || free)) {
    const offer = offerFrame(m, o, rows, s, available);
    if (offer) return offer;
  }
  if (rows && (m.retained?.active || free)) {
    const offer = offerRetained(m, s, available);
    if (offer) return offer;
  }
  if (rows && (m.contexts?.active || free)) {
    const offer = offerContext(m, o, rows, available, s);
    if (offer) return offer;
  }
  if (rows && (m.instrument?.active || free)) {
    const offer = offerInstrument(m, o, rows, available, s);
    if (offer) return offer;
  }
  const exchange = m.exchanges;
  if (rows && exchange && (exchange.active || (!m.transfers?.active && !m.condition && !m.pending && !m.projection.active && !m.equations.active && !m.space.active && !frontier.follow && !frontier.question && !m.delayed.active))) {
    const proposal = exchangeOffer(exchange,o,rows,available,s);
    if (proposal) return proposal;
  }
  if(rows && (m.transfers?.active || (!m.condition && !m.reconsiderPlacement && !m.pending && !m.projection.active && !m.equations.active && !m.space.active && !frontier.follow && !frontier.question && !m.delayed.active))) {
    const transfer=chooseTransfer(m,o,rows,available,s);
    if(transfer)return transfer;
  }
  if(m.condition?.scene===s) {
    const continuing=placementOffer(m.condition,o,available);
    if(continuing) return continuing;
  }
  const repair=m.reconsiderPlacement;
  if(rows && repair?.scene===s && repair.ref===o.revision) {
    const plan=conditionalPlacements(m,o,rows,s,available,m.attempts,repair);
    if(plan) {
      const offer=placementOffer({plan,index:plan.alreadyPlaced??0,scene:s},o,available);
      if(offer)return offer;
    }
  }
  const pending = m.pending;
  if (pending?.phase === 'explore') {
    const fresh = [...available].find((op) => !m.edges.some((e) => e.s === s && e.cmd === op));
    if (fresh) return { ...pending, b: fresh };
  } else if (pending?.phase === 'carry' && rows) {
    const next = carryStep(m, o, rows, available, pending);
    if (next) return next;
  } else if (pending && available.has(pending.b)) return pending;
  // Finish committed controls and exercise a verified access while its original
  // preparation and a fresh continuation are both available.
  const localRules = new Set(
    Object.values(m.rules)
      .filter(r => r.id.startsWith(s + '|') && r.evaluations > 0 && r.uses < 2 && r.refutations < 2)
      .map(r => r.id)
  );
  const localPairs = localRules.size ? pairs(m) : null;
  const reuseReady = localPairs?.some(p =>
    localRules.has(p.id) && available.has(p.prep) && p.after.effect.key !== 'still' &&
    !p.after.effect.key.startsWith('terminal:') &&
    [...available].some(op => !m.edges.some(e => e.s === p.after.t && e.cmd === op))
  );
  if (!reuseReady) {
    const ongoingPlan = frontier.question || frontier.follow || m.projection.active ||
      m.equations.active || m.space.active || (pending && pending.phase !== 'explore');
    if(rows && !ongoingPlan && !m.delayed.active && m.recurrences>=2) {
      const plan=conditionalPlacements(m,o,rows,s,available,m.attempts);
      if(plan) {
        const proposal=placementOffer({plan,index:plan.alreadyPlaced??0,scene:s},o,available);
        if(proposal) return proposal;
      }
    }
    if (m.delayed.active || !ongoingPlan) {
      const experiment = selectDelayed(m, o, s, available);
      if (experiment) return experiment;
    }
    const stalled = m.turns - frontier.lastEdge >= 4 ||
      m.turns - frontier.lastScene >= Math.max(12, 2 * available.size);
    if (frontier.question || frontier.follow || (!m.projection.active && (frontier.exploring || stalled))) {
      const search = selectFrontier(m, s, available, firstRoutes(m, s, m.scenes.length), o, rows);
      if (search) return search;
    }
    if (rows && (m.projection.active || (!m.pending && !m.equations.active && !m.space.active))) {
      const projection = proposeProjection(m, o, rows, available, s);
      if (projection) return projection;
    }
    if (rows && (m.equations.active || (!m.pending && !m.space.active))) {
      const capability = proposeCapability(m, o, rows, available, s);
      if (capability) return capability;
    }
    if (rows && (!m.pending || m.space.active)) {
      const access = proposeAccess(m, o, rows, available, s);
      if (access) return access;
    }
  }
  if (!reuseReady && !late && !m.placement && (m.recurrences < 3 || (m.turns - m.lastTrial === 1 && m.turns % 4 === 0)))
    return null;
  const outgoing = m.edges.filter((e) => e.s === s && e.stable);
  const prev = m.edges[m.previous],
    options = [...available];
  const mk = (
    phase: Experiment['phase'],
    origin: number,
    a: string,
    b: string,
    refs: number[],
    rule = '',
    purpose?: string
  ): Experiment => ({ phase, origin, a, b, refs, rule, ...(purpose ? { purpose } : {}) });
  const candidates = (localPairs ?? pairs(m)).filter(
    (p) => p.after.effect.key !== 'still' && !p.after.effect.key.startsWith('terminal:')
  );
  const routes = firstRoutes(m, s, 12);
  const outstanding = m.derivationOrigin;
  if (outstanding) {
    const d = outstanding.derive!;
    const bare = m.edges.find(
      (e) =>
        e.s === outstanding.origin && e.cmd === outstanding.b && e.stable && e.effect.key === d.bareEffect
    );
    if (bare && s === outstanding.origin && available.has(outstanding.a)) return outstanding;
    const route = routes.get(outstanding.origin)?.first;
    const id = 'derive-route:' + outstanding.rule + ':' + d.site;
    if (bare && route && available.has(route.cmd) && (m.attempts['route:' + id] ?? 0) < 6)
      return mk(
        'route',
        s,
        route.cmd,
        outstanding.b,
        [bare.ref, route.ref],
        id,
        'return_for_derived_treatment'
      );
    if (bare && s === bare.t && bare.s !== bare.t) {
      const trials = [];
      for (const op of available) {
        const known = m.edges.find((e) => e.s === s && e.cmd === op);
        if (known || m.attempts['inverse:' + id + ':' + op]) continue;
        const source = preparationReturns[bare.cmd.split(':')[0] + '/' + op.split(':')[0]];
        const witnesses = m.chains.filter((c) => {
          const f = m.edges[c.first]!,
            g = m.edges[c.second]!;
          return (
            f.cmd === bare.cmd &&
            g.cmd === op &&
            f.s !== s &&
            f.s !== f.t &&
            g.t === f.s &&
            f.stable &&
            g.stable
          );
        });
        if (witnesses.length || source)
          trials.push({
            op,
            score: (source?.probability ?? 0) + witnesses.length,
            ref: witnesses.length ? m.edges[witnesses[0]!.second]!.ref : bare.ref,
          });
      }
      const guess = trials.sort((p, q) => q.score - p.score)[0];
      if (guess)
        return {
          ...mk('inverse', bare.s, guess.op, bare.cmd, [bare.ref, guess.ref], id),
          expected: m.scenes[bare.s],
        };
    }
  }
  const offerings: { r: Experiment; rank: number; latest: number }[] = [];
  const distances = new Map<Edge, ReturnType<typeof distanceEvidence>>();
  const unusualMove = (e: Edge) => {
    if (!distances.has(e)) distances.set(e, distanceEvidence(m, e));
    return distances.get(e);
  };
  for (const p of candidates) {
    const rule = m.rules[p.id],
      match = similarity(m, p, s);
    if ((rule?.refutations ?? 0) >= 2) continue;
    const confirmed = (rule?.evaluations ?? 0) > 0;
    if (confirmed && rows) {
      const d = proposeDerivation(m, o, rows, s, available, p);
      if (d) {
        const knownJump = unusualMove(p.after);
        d.predictedGap = !!knownJump && !knownJump.localPath;
        offerings.push({ r: d, rank: d.phase === 'carry' ? 0 : 2, latest: rule!.last });
      }
    }
    const freshDestination = options.some((op) => !m.edges.some((e) => e.s === p.after.t && e.cmd === op));
    if (confirmed && ((!freshDestination && match !== 1) || (rule?.uses ?? 0) >= 2)) continue;
    const route = routes.get(p.origin);
    if (!match && (!route?.first || route.length > 6)) continue;
    if (!match && (m.attempts['route:' + p.id] ?? 0) >= 8) continue;
    const local = match === 2;
    if (!local && !route?.first) continue;
    if (local && !available.has(p.prep)) continue;
    if (!local && !available.has(route!.first!.cmd)) continue;
    const refs = [
      p.first.ref,
      p.direct.ref,
      p.after.ref,
      ...(m.attempts['baseline:' + p.id] ? [m.attempts['baseline:' + p.id]!] : []),
      ...(rule?.verifiedAt ? [rule.verifiedAt] : []),
    ];
    const unusual = unusualMove(p.after);
    const priority =
      (confirmed ? (rule!.uses ? 3 : 0) : 1) +
      (local ? 0 : 8 + route!.length) +
      (rule?.last === m.turns ? 10 : 0) -
      (unusual && !unusual.localPath ? 4 : 0);
    const requireControl = !confirmed && !m.attempts['baseline:' + p.id];
    if (local && requireControl && !available.has(p.probe)) continue;
    const x = local
      ? mk(
          confirmed ? 'reuseA' : requireControl ? 'confirmControl' : 'confirmA',
          s,
          p.prep,
          p.probe,
          refs,
          p.id,
          confirmed ? 'reach_untried_continuation' : 'replicate_contrast'
        )
      : mk('route', s, route!.first!.cmd, p.probe, refs, p.id, 'reach_matched_origin');
    x.expected = x.phase === 'confirmControl' ? p.direct.effect.key : p.after.effect.key;
    x.prepEffect = p.first.effect.key;
    x.predictedGap = !!unusual && !unusual.localPath;
    offerings.push({ r: x, rank: priority, latest: rule?.last ?? -1 });
  }
  if (rows && (m.placement || m.turns % 6 === 0) && !offerings.some((o) => o.rank <= 2)) {
    const arrangement = selectPlacement(m, o, inputs, rows, s);
    if (arrangement) return arrangement;
  }
  if (offerings.length) return offerings.sort((a, b) => a.rank - b.rank || a.latest - b.latest)[0]!.r;
  // A measured displacement outside the local movement graph is worth a control
  // even when its origin must first be reached again along witnessed transitions.
  const index = stableIndex(m);
  for (const c of m.chains) {
    const first = m.edges[c.first]!,
      second = m.edges[c.second]!;
    if (
      !first.stable ||
      !second.stable ||
      first.s === first.t ||
      first.cmd === second.cmd ||
      index.has(first.s + '|' + second.cmd)
    )
      continue;
    const travel = routes.get(first.s);
    if (!travel || travel.length > 6) continue;
    const variant = unusualMove(second);
    if (!variant || variant.localPath) continue;
    const id = idOf(first.s, first.cmd, second.cmd),
      refs = [first.ref, second.ref];
    if (!travel.first && available.has(second.cmd)) return mk('control', s, first.cmd, second.cmd, refs, id);
    if (travel.first && available.has(travel.first.cmd) && (m.attempts['route:' + id] ?? 0) < 8)
      return mk('route', s, travel.first.cmd, second.cmd, refs, id, 'compare_access_to_new_region');
  }
  // Repeat B from the original scene when only A followed by B has been seen.
  for (const c of m.chains) {
    const a = m.edges[c.first]!,
      b = m.edges[c.second]!;
    if (
      a.s === s &&
      a.s !== a.t &&
      a.stable &&
      b.stable &&
      a.cmd !== b.cmd &&
      available.has(b.cmd) &&
      !outgoing.some((e) => e.cmd === b.cmd)
    )
      return mk('control', s, a.cmd, b.cmd, [a.ref, b.ref], idOf(s, a.cmd, b.cmd));
  }
  // Real A just ran. Complete the second arm using a previously measured B alone.
  if (prev && prev.t === s && prev.s !== s && prev.stable) {
    const controls = m.edges.filter(
      (e) =>
        e.stable &&
        e.s === prev.s &&
        e.cmd !== prev.cmd &&
        available.has(e.cmd) &&
        !outgoing.some((h) => h.cmd === e.cmd)
    );
    if (controls.length) {
      const d = controls.sort(
        (x, y) => Number(y.effect.key === 'still') - Number(x.effect.key === 'still')
      )[0]!;
      return mk('probe', prev.s, prev.cmd, d.cmd, [prev.ref, d.ref], idOf(prev.s, prev.cmd, d.cmd));
    }
  }
  // Ask a controlled question at an origin whose B baseline is already known.
  const tries: { a: string; b: Edge; score: number }[] = [];
  for (const b of outgoing) {
    for (const a of options) {
      if (a === b.cmd) continue;
      const p = outgoing.find((e) => e.cmd === a);
      if (p && (p.s === p.t || m.edges.some((e) => e.s === p.t && e.cmd === b.cmd))) continue;
      const key = idOf(s, a, b.cmd);
      if (m.attempts[key]) continue;
      tries.push({
        a,
        b,
        score: (p ? 0 : 2) + (b.effect.key === 'still' ? 0 : 1) + (m.attempts['op:' + a] ?? 0) / 4,
      });
    }
  }
  if (tries.length) {
    const x = tries.sort((a, b) => a.score - b.score)[0]!;
    return mk('prepare', s, x.a, x.b.cmd, [x.b.ref], idOf(s, x.a, x.b.cmd));
  }
  return null;
}
const placementVisits = new WeakMap<Memory, {turn: number; revisited: boolean}>();
function returnedToPlacement(m: Memory) {
  const prior = placementVisits.get(m);
  if (prior?.turn === m.turns) return prior.revisited;
  const last = m.edges[m.previous];
  if (!last?.stable || !last.manipulation?.moves.length) return false;
  const returned = new Set(last.manipulation.moves.map(v => JSON.stringify([v.role, v.to])));
  const revisited = m.delayed.history.slice(0, -1).some(j =>
    m.edges[j]?.manipulation?.moves.some(v =>
      returned.has(JSON.stringify([v.role, v.from])) || returned.has(JSON.stringify([v.role, v.to]))
    )
  );
  placementVisits.set(m, {turn: m.turns, revisited});
  return revisited;
}
export function experimentCommand(x: Experiment) {
  const first = ['prepare', 'confirmA', 'reuseA', 'route', 'inverse', 'position', 'deriveA', 'carry'];
  return first.includes(x.phase) ? x.a : x.b;
}
export function selectExperiment(
  m: Memory, o: NativeObservation, inputs: readonly NativeCommand[], late: boolean, rows?: NativeRows, localOpportunity=false, configurationOpportunity=false
): Experiment | null {
  const local=m.localCapacity;
  function bindLocal(plan:LocalForecast):Experiment {
    return {phase:'localCapacity',origin:m.scenes.indexOf(sceneKey(o)),a:plan.a,b:localCommand(plan),
      rule:'translated_public_effect',localCapacity:plan,refs:[]};
  }
  if(local && rows && local.pending && local.expect===o.frame_hash) return bindLocal(local.pending);
  if(local && rows && (late || stalledLocal(local,o.frame_hash))){
    const continuation=continuationAt(local,o,rows);
    if(continuation)return bindLocal(continuation);
  }
  if(local?.retained?.state===o.frame_hash && rows){
    const revision=proposeLocal(local,o,rows,true);
    if(revision?.revised)return bindLocal(revision);
  }
  const established = selectEstablishedExperiment(m, o, inputs, late, rows);
  if (configurationOpportunity && rows && m.configurations && !m.pending && !m.space.active &&
      !m.equations.active && !m.occupancy?.active && !m.territory?.active && !m.frames?.active &&
      !established?.cue && !established?.mechanism && !established?.witnessedPreview && !established?.terminalContact) {
    const plan = nextConfiguration(m.configurations, rows, o.available_action_refs);
    if (plan) return { phase:'testConfiguration', origin:m.scenes.indexOf(sceneKey(o)), a:plan.action, b:plan.action,
      rule:'test_an_unseen_configuration_of_observed_controls', configurationTrial:plan, refs:[] };
  }
  if(local && rows && localOpportunity
      && !established?.cue && !established?.mechanism && !established?.terminalContact && !established?.witnessedPreview
      && !m.frames?.active && !m.occupancy?.active && !m.territory?.active && !m.pending
      && !m.space.active && !m.equations.active && !m.condition && !m.projection.active && !m.delayed.active){
    const repeated=stalledLocal(local,o.frame_hash), revisited=revisitedChoice(local,o.frame_hash);
    const analogous=canCompareAnotherPreparation(local,o.frame_hash);
    const plan=proposeLocal(local,o,rows,true,p =>
      (repeated && demonstratedLimit(local,p)) || (revisited && hasLocalContrast(local,p)) ||
      (analogous && p.stage==='control' && !!p.analogousUseRef));
    if(plan)return bindLocal(plan);
  }
  if (!rows || established?.cue || established?.frame || established?.territorial || established?.occupancy || established?.terminalContact || established?.mobilityProbe || established?.mechanism || established?.unreadIndicator || established?.witnessedPreview) return established;
  const scene=m.scenes.indexOf(sceneKey(o));if(scene<0)return established;
  const available=new Set(inputs.map(observedCommandKey));
  const recent=m.delayed.history.slice(-8);
  const repeated=recent.filter((v,i)=>m.delayed.history.indexOf(v)<m.delayed.history.length-recent.length+i).length;
  const replaceable=!established||['explore','frontierProbe','probe','position','control'].includes(established.phase);
  const cmd=established?experimentCommand( established ):null;
  const knownStep=cmd&&m.edges.some(e=>e.s===scene&&e.cmd===cmd&&e.stable);
  if(replaceable&&(knownStep||(!established&&late)||repeated>=Math.ceil(recent.length/2)&&recent.length>=4)){
    if(local && stalledLocal(local,o.frame_hash)){
      const plan=proposeLocal(local,o,rows,true);
      if(plan&&((late&&!established)||demonstratedLimit(local,plan)))return bindLocal(plan);
    }
    const opportunity=offerFrame(m,o,rows,scene,available,'opportunity');
    if(opportunity)return opportunity;
    const activation=offerActivation(m,o,rows,scene,available);
    if(activation)return activation;
  }
  if(established||!late)return established;
  return offerFrame(m,o,rows,scene,available,'identify');
}
export function recordExperiment(
  m: Memory,
  b: NativeObservation,
  a: NativeObservation,
  cmd: NativeCommand,
  rows: NativeRows,
  next: NativeRows,
  x?: Experiment
): Outcome | null {
  const s = sceneIndex(m, b),
    t = sceneIndex(m, a),
    op = observedCommandKey(cmd),
    effect = measureEffect(b, a, rows, next);
  const local=m.localCapacity??=newLocalMemory();
  const cursorResult=b.available_action_refs.includes('ACTION6')
    ? recordCursorTrial(m.cursorSelection??=newCursorMemory(),b,a,rows,next,op,x?.cursorTrial) : undefined;
  const sameBoard=b.level_epoch===a.level_epoch && a.levels_completed===b.levels_completed && b.state===a.state;
  const placementResult=m.landmarkMemory && sameBoard && (x?.landmark||x?.cursorTrial||m.landmarkMemory.handoff)
    ? observePlacement(m.landmarkMemory,x?.landmark,visualLayout(a,next),cursorResult,x?.cursorTrial,visualLayout(b,rows),m.cursorSelection?.pending,a.observation_ref,next):undefined;
  if (sameBoard) {
    const configurations=m.configurations??=newConfigurationMemory();
    const trial=x?.configurationTrial;
    observeConfiguration(configurations,rows,next,op,a.observation_ref,trial);
    // Start searching after an observed failure to change the board. Continue
    // while successive commands implement the configuration being tested.
    m.configurationOpportunity=trial
      ? !configurations.failures.includes(trial.from+'/'+trial.action)
      : b.frame_hash===a.frame_hash;
  } else m.configurationOpportunity=false;
  if(!x?.localCapacity){delete local.pending;delete local.expect;}
  observeLocal(local,b,a,rows,next,op);
  const previous = m.edges[m.previous];
  m.turns++;
  const progress=m.localProgress??=newLocalProgress();
  if(!x?.mechanism)progress.active=null;
  const preparing=x?.mechanism||x?.occupancy&&x.occupancy.index+1<x.occupancy.plan.steps.length||x?.territorial&&x.territorial.cursor+1<x.territorial.plan.program.length;
  const localRepeat=preparing?null:measureLocalRepeat(m,s,t,b,a,rows,next,op,x?.witnessedPreview?.actor);
  progress.last=localRepeat;
  if(localRepeat)progress.repeats[repeatKey(s,op)]=localRepeat;
  else delete progress.repeats[repeatKey(s,op)];
  const occupancy=m.occupancy??=newOccupancyMemory();
  if(!x?.occupancy)occupancy.active=null;
  if(m.indicators&&!x?.unreadIndicator)m.indicators.pending=null;
  if(b.state===a.state&&b.level_epoch===a.level_epoch&&a.levels_completed===b.levels_completed){
    observeVacatedSites(occupancy,b,a,rows,next);
    observePoses(occupancy,s,t,occupancyView(b,rows),occupancyView(a,next),op,a.revision,occupancyForms(b,rows),occupancyForms(a,next));
  }
  m.instrument ??= newInstrumentMemory();
  if(!x?.instrument)m.instrument.active=null;
  m.frames??=newFrameMemory();
  m.territory??=newTerritorialMemory();
  if(!x?.territorial)m.territory.active=null;
  rememberDuplicatePoses(m.frames, s, b);
  rememberDuplicatePoses(m.frames, t, a);
  if(!x?.frame)m.frames.active=null;
  m.retained??=newRetainedMemory();
  if(!x?.retained)m.retained.active=null;
  m.contexts ??= newContextMemory();
  if(!x?.transport)m.contexts.active=null;
  m.exchanges ??= newExchangeMemory();
  if (!x?.exchange) m.exchanges.active = null;
  observeExchange(m.exchanges,b,a,op);
  m.transfers??=newTransferMemory();
  m.transfers.sites=witnessedSites(m.transfers.sites,b,a,rows,next,op);
  if(!x?.transfer)m.transfers.active=null;
  const frontier=m.frontier;
  if(!x?.condition)m.condition=null;
  if(m.reconsiderPlacement)m.reconsiderPlacement=null;
  const newScene=m.seenAt[t]===undefined && t!==s;
  if(newScene){frontier.lastScene=m.turns;frontier.exploring=false;}
  if(!x?.frontier){frontier.question=null;frontier.follow=null;}
  if (!x?.projection) m.projection.active = null;
  if (!x?.equation) {
    m.equations.active = null;
    m.equations.follow = null;
  }
  if (!x?.access) {
    m.space.active = null;
    m.space.continuation = null;
  }
  observeFloor(m.space.floor, b, a, next, effect.moves);
  for (const move of effect.moves) delete m.blocked[[move.actor, ...move.from.split(','), op].join('/')];
  updatePlacement(m, b, a, op, x);
  m.revisionScene[b.revision] = s;
  m.revisionScene[a.revision] = t;
  const returned = t !== s && m.seenAt[t] !== undefined;
  if (returned) m.recurrences++;
  m.seenAt[s] = m.turns;
  m.seenAt[t] = m.turns;
  const mark = changedMark(b, a, rows);
  for (const id of Object.keys(m.activeMarks)) {
    if (
      !b.entities.some((e) => e.signature === id && !e.identity_ambiguous) ||
      !a.entities.some((e) => e.signature === id && !e.identity_ambiguous)
    )
      delete m.activeMarks[id];
  }
  if (mark) m.activeMarks[mark.prepared] = { op, bare: mark.bare, revision: a.revision };
  const tracked = new Set(effect.moves.map((v) => v.actor)),
    marks = new Set<string>();
  for (const e of m.edges) {
    for (const v of e.effect.moves) tracked.add(v.actor);
    if (e.mark) {
      marks.add(e.mark.bare);
      marks.add(e.mark.prepared);
    }
  }
  if (mark) {
    marks.add(mark.bare);
    marks.add(mark.prepared);
  }
  // Retain initial poses so a component identified as mobile later can be measured in its earlier controls.
  for (const e of b.entities) if (!e.identity_ambiguous) tracked.add(e.signature);
  const anchors = witnessAnchors(b, rows, new Set([...tracked, ...marks]), marks);
  let index = m.edges.findIndex((e) => e.s === s && e.cmd === op);
  const repeated = t !== s && index >= 0 && m.edges[index]!.stable && m.edges[index]!.t === t;
  recordReturn(m.returnHistory ??= { repeatedChanges: 0, recent: [] }, repeated, returned);
  if (index < 0) {
    frontier.lastEdge=m.turns;
    index = m.edges.length;
    m.edges.push({
      s,
      t,
      cmd: op,
      effect,
      ref: a.revision,
      stable: true,
      anchors,
      ...(mark ? { mark } : {}),
    });
  }
  const edge = m.edges[index]!;
  if(!edge.manipulation && edge.stable){const measurement=witnessManipulation(b,a,rows,next);if(measurement)edge.manipulation=measurement;}
  Object.assign(edge.anchors, anchors);
  edge.visibleAfter = a.entities
    .filter((z) => !z.identity_ambiguous && edge.anchors[z.signature])
    .map((z) => z.signature);
  if (edge.t !== t || edge.effect.key !== effect.key) edge.stable = false;
  if (previous?.t === s && !m.chains.some((c) => c.first === m.previous && c.second === index))
    m.chains.push({ first: m.previous, second: index });
  m.delayed.history.push(index);
  if (m.delayed.history.length > 256) m.delayed.history.shift();
  if (!x?.delayed) m.delayed.active = null;
  m.previous = index;
  m.pending = null;
  if (!x) return null;
  m.lastTrial = m.turns;
  const out: Outcome = {
    ...(localRepeat?{localRepeat}:{}),
    predictedGap: x.predictedGap === true,
    phase: x.phase,
    hypothesis: x.rule,
    result: 'observed',
    longer: false,
    actor: null,
    from: null,
    to: null,
    localPath: null,
    revision: a.revision,
    refs: x.refs,
  };
  if(x.cooperative)return out;
  if(x.localCapacity) {
    const receipt=assessLocal(local,x.localCapacity,b,a,rows,next);
    return {...out,result:'local_capacity_'+receipt.stage+(receipt.matches?'_matched':'_refuted'),localCapacity:receipt};
  }
  if(x.configurationTrial) {
    const trial=x.configurationTrial;
    const failed=m.configurations?.failures.includes(trial.from+'/'+trial.action);
    return {...out,result:a.levels_completed>b.levels_completed?'configuration_completed_level':
      failed?'configuration_prediction_refuted':'configuration_observed'};
  }
  if(x.landmark)return {...out,result:a.levels_completed>b.levels_completed?'joint_placement_official':placementResult??'joint_placement_ended_at_boundary'};
  if(x.cursorTrial)return {...out,result:cursorResult??'cursor_trial_ended_at_boundary'};
  if(x.condition) {
    const {result,detail}=placementReceipt(m,x.condition,edge.t,b,a);
    return {...out,result,condition:detail};
  }
  if(x.relative && m.relativeMotion){
    const plan=x.relative, actual=readGroup(m.relativeMotion.models[plan.model]!,visualLayout(a,next));
    const won=a.levels_completed>b.levels_completed||a.state==='WIN';
    const matched=!!actual && equalPose(actual,plan.next);
    continueRelativePlan(m.relativeMotion,plan,a,matched,won);
    return {...out,result:won?'relative_placement_official':matched?'relative_placement_matched':'relative_placement_refuted',relativePlacement:{plan:relativeReceipt(plan),actual:won?null:actual,matched,won}};
  }
  if(x.cue){
    const visible=!!visualLayout(a,next)[x.cue.indicator]?.length;
    const result=a.levels_completed>b.levels_completed||a.state==='WIN'?'cue_search_official':visible?'cue_became_visible':x.cue.routing?'returned_toward_untested_movement':'cue_remains_absent';
    return {...out,result,cueSearch:{binding:x.cue.binding,probe:x.cue.probe,target:x.cue.target,routing:x.cue.routing,visible}};
  }
  if(x.instrument){const {result,detail}=recordInstrument(m,x.instrument,b,a,edge,next,t);return {...out,result,instrument:detail};}
  if(x.terminalContact&&m.previewLearning){
    const detail=measureTerminalContact(m.previewLearning,x.terminalContact,b,a,op,visualLayout(a,next));
    const result=detail.won?'terminal_contact_official':
      x.phase==='usePositionedOperation'?(detail.matched?'positioned_effect_observed':'positioned_effect_refuted'):
      x.phase==='positionForOperation'?(detail.matched?'preparatory_position_approach':'preparatory_position_refuted'):
      detail.matched?'terminal_contact_approach':'terminal_contact_refuted';
    return {...out,result,terminalContact:detail};
  }
  if(x.mobilityProbe){const detail=measureMobility(x.mobilityProbe,b,a,next,op);return {...out,result:detail.won?'mobility_completion':detail.moved?'mobility_observed':'mobility_unconfirmed',mobilityProbe:detail};}
  if(x.mechanism){const detail=finishMechanism(m,x.mechanism,b,a,rows,next,op);return {...out,result:detail.won?'mechanism_completion':detail.matched?'mechanism_step_confirmed':'mechanism_step_refuted',mechanism:detail};}
  if(x.unreadIndicator){
    const detail=measureUnreadIndicator(m,x.unreadIndicator,b,a,occupancyView(b,rows),occupancyView(a,next),op);
    return {...out,result:'indicator_'+detail.status,unreadIndicator:detail};
  }
  if(x.witnessedPreview&&m.previewLearning){
    const detail=checkWitnessedPreview(m.previewLearning,x.witnessedPreview,b,a,visualLayout(b,rows),visualLayout(a,next),op);
    if(m.previewLearning.cueSearch?.seeking===x.witnessedPreview.key && detail.status==='realized')delete m.previewLearning.cueSearch.seeking;
    return {...out,result:'preview_'+detail.status,witnessedPreview:detail};
  }
  if(x.occupancy){
    const won=a.levels_completed>b.levels_completed||a.state==='WIN';
    const detail=finishOccupancy(occupancy,x.occupancy,occupancyView(a,next),!won&&b.state===a.state&&b.level_epoch===a.level_epoch,won,a.revision,occupancyForms(a,next),op);
    return {...out,result:won?'occupancy_completion':detail.matched?'occupancy_confirmed':'occupancy_refuted',occupancy:detail};
  }
  if(x.territorial){const {result,detail}=recordTerritory(m,x.territorial,b,a);return {...out,result,territorial:detail};}
  if(x.activation){const {result,detail}=recordActivation(m,x.activation,b,a);return {...out,result,activation:detail};}
  if(x.frame){const {result,detail}=recordFrame(m,x.frame,b,a);return {...out,result,frame:detail};}
  if(x.retained){const {result,detail}=recordRetained(m,x.retained,b,a,rows,next,t);return {...out,result,retained:detail};}
  if(x.transport){
    const {result,detail}=recordContext(m.contexts,x.transport,b,a,t,next,m.turns);
    return {...out,result,transport:detail};
  }
  if (x.exchange) {
    const {result, detail} = recordExchange(m.exchanges,x.exchange,b,a);
    return {...out,result,exchange:detail};
  }
  if(x.transfer) {
    const {result,detail}=recordTransfer(m,x.transfer,b,a);
    return {...out,result,transfer:detail};
  }
  if (x.delayed) {
    const won = a.levels_completed > b.levels_completed || a.state === 'WIN';
    const { result, detail } = recordDelayed(m, x.delayed, edge, b, a, won);
    return { ...out, result, delayed: detail };
  }
  if(x.frontier){
    if(!newScene)frontier.exploring=true;
    const position = (o: NativeObservation, id: string) =>
      o.entities.find(e => !e.identity_ambiguous && e.signature === id)?.position.join() ?? null;
    const {result,detail}=recordFrontier(m,x.frontier,edge,a.levels_completed>b.levels_completed||a.state==='WIN',
      id => position(a,id), id => position(b,id), {after:a, rows:next});
    return {...out,result,frontier:detail};
  }
  if (x.projection) {
    const { result, detail } = recordProjection(m, x.projection, b, a);
    return { ...out, result, projection: detail };
  }
  if (x.equation) {
    const { result, detail } = recordCapability(m, x, a, b);
    return { ...out, result, equation: detail };
  }
  if (x.access) {
    const { result, detail } = recordAccess(m, x, b, a);
    return { ...out, result, access: detail };
  }
  if (x.derive && x.phase !== 'explore') {
    out.result = derivationReceipt(m, x, edge, effect.key, b, a);
    out.trainedSite = x.derive.trained;
    out.testSite = x.derive.site;
    out.bareEffect = x.derive.bareEffect;
    out.predicted = x.expected;
    out.actual = effect.key;
    if (x.prepEffect) out.precondition = x.prepEffect;
    if (x.derive.capability) out.capability = x.derive.capability;
    if (x.phase === 'deriveB' || x.phase === 'carryB') {
      out.strictMatch = effect.key === x.expected;
      out.enabledMotion =
        out.result.endsWith('_verified') &&
        effect.moves.some(
          (v) =>
            !x
              .derive!.bareEffect.split('|')
              .some((token) =>
                token
                  .replace(/^move:/, '')
                  .startsWith((v.actor === x.derive!.mark?.prepared ? x.derive!.mark.bare : v.actor) + '/')
              )
        );
      const v = distanceEvidence(m, edge);
      if (v) {
        out.longer = true;
        out.actor = v.move.actor;
        out.from = v.move.from;
        out.to = v.move.to;
        out.localPath = v.localPath;
      }
    }
    return out;
  }
  if (x.phase === 'positionB') {
    out.result = effect.key === x.expected ? 'same_effect_at_placement' : 'different_effect_at_placement';
    const observed = distanceEvidence(m, edge);
    if (observed) {
      out.longer = true;
      out.actor = observed.move.actor;
      out.from = observed.move.from;
      out.to = observed.move.to;
      out.localPath = observed.localPath;
    }
    return out;
  }
  if (x.phase === 'route') {
    m.attempts['route:' + x.rule] = (m.attempts['route:' + x.rule] ?? 0) + 1;
    return out;
  }
  if (x.phase === 'inverse') {
    m.attempts['inverse:' + x.rule + ':' + op] = 1;
    out.result = m.scenes[t] === x.expected ? 'matched_origin_restored' : 'inverse_refuted';
    return out;
  }
  if (x.phase === 'confirmControl') {
    if (edge.stable && effect.key === x.expected) {
      m.attempts['baseline:' + x.rule] = a.revision;
      out.result = 'control_replicated';
    } else out.result = 'prediction_refuted';
    return out;
  }
  if (['prepare', 'confirmA', 'reuseA'].includes(x.phase)) {
    m.attempts[idOf(s, x.a, x.b)] = 1;
    m.attempts['op:' + x.a] = (m.attempts['op:' + x.a] ?? 0) + 1;
    if (s !== t && edge.stable && (!x.prepEffect || effect.key === x.prepEffect)) {
      m.pending = {
        ...x,
        phase: x.phase === 'prepare' ? 'probe' : x.phase === 'confirmA' ? 'confirmB' : 'reuseB',
        refs: [...x.refs, a.revision],
      };
    } else out.result = 'precondition_failed';
  } else if (x.phase === 'confirmB' || x.phase === 'reuseB') {
    const r = (m.rules[x.rule] ??= { id: x.rule, evaluations: 0, refutations: 0, uses: 0, last: 0 });
    r.last = m.turns;
    if (edge.stable && effect.key === x.expected) {
      if (x.phase === 'confirmB') {
        r.evaluations++;
        r.verifiedAt = a.revision;
      } else {
        r.uses++;
        m.pending = { ...x, phase: 'explore', refs: [...x.refs, a.revision] };
      }
      out.result = x.phase === 'confirmB' ? 'prediction_confirmed' : 'reused_as_predicted';
      const transfer = distanceEvidence(m, edge);
      if (transfer) {
        out.longer = true;
        out.actor = transfer.move.actor;
        out.from = transfer.move.from;
        out.to = transfer.move.to;
        out.localPath = transfer.localPath;
      }
    } else {
      r.refutations++;
      out.result = 'prediction_refuted';
    }
  } else if (x.phase === 'probe' || x.phase === 'control') {
    const p = pairs(m).find((p) => p.id === x.rule);
    out.result = p ? 'differential' : 'no_differential';
  }
  return out;
}
