/**
 * Observation-only P05 acquisition boundary for controlled public experiments.
 *
 * This module does not know a game, generator, hidden model, solution, seed or
 * family. PREPARE is an experimental action supplied by the caller. An epoch
 * contains either one command followed by waits, or a wait-only countertrial.
 * Acquisitions remain restricted to the contexts actually measured.
 */
export type P05Scalar = string | number | boolean;
export type P05Point = readonly [number, number];

export interface P05Observation {
  readonly ref: string;
  readonly epoch: string;
  readonly tick: number;
  readonly selected: string;
  readonly subjects: readonly { readonly id: string; readonly position: P05Point }[];
  readonly context: Readonly<Record<string, P05Scalar>>;
  readonly reserve: number;
  readonly remote: number;
}

export interface P05PublicReturn {
  readonly id: string;
  readonly kind: 'command' | 'wait' | 'prepare';
  readonly command: string;
  readonly before: P05Observation | null;
  readonly after: P05Observation | null;
  readonly elapsed: number;
  /** Clock and identity remain public when a single observation node is withheld. */
  readonly beforeRef?: string;
  readonly epoch?: string;
  readonly tick?: number;
}

export interface P05Condition {
  readonly field: string;
  readonly equals: P05Scalar;
}

export interface P05AcquiredEffect {
  readonly effectId: string;
  readonly effectKind?: 'translation' | 'resource' | 'remote' | 'combined';
  readonly command: string;
  readonly receiver: 'selected' | string;
  readonly delta: P05Point;
  readonly delay: number;
  readonly resourceCost: number;
  readonly remoteDelta: number;
  readonly conditions: readonly P05Condition[];
  readonly supportingReturnIds: readonly string[];
  readonly limitingReturnIds: readonly string[];
  readonly status: 'confirmed' | 'restricted';
  readonly transferStatus?: 'confirmed' | 'refuted' | 'restricted';
}

export interface P05LearnerOptions {
  readonly maxLatency: number;
  readonly priorClaims?: readonly P05AcquiredEffect[];
}

export interface P05Diagnostics {
  readonly receipts: number;
  readonly stationaryReturnIds: readonly string[];
  readonly missingReturnIds: readonly string[];
  readonly staleProofIds: readonly string[];
  readonly ambiguousEpochs: readonly string[];
  readonly uncontrolledEpochs: readonly string[];
  readonly missingLinkEpochs: readonly string[];
  readonly rejectedReturnIds: readonly string[];
}

type Episode = {
  epoch: string;
  start: P05Observation;
  returns: P05PublicReturn[];
  command: P05PublicReturn | undefined;
  ambiguous: boolean;
};

type RawEffect = Omit<P05AcquiredEffect, 'effectId' | 'receiver' | 'limitingReturnIds' | 'transferStatus'> & {
  subject: string;
  selected: string;
  command: string;
};

const unique = (values: readonly string[]) => [...new Set(values)];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const orderedContext = (context: Readonly<Record<string, P05Scalar>>) =>
  Object.entries(context).sort(([a], [b]) => a.localeCompare(b));
const conditionsKey = (conditions: readonly P05Condition[]) => JSON.stringify([...conditions]
  .sort((a, b) => a.field.localeCompare(b.field)).map(condition => [condition.field, condition.equals]));

/** Context matching deliberately keeps selection, reserve and initial geometry. */
function countertrialKey(observation: P05Observation): string {
  return JSON.stringify([orderedContext(observation.context), observation.selected,
    observation.reserve, observation.remote,
    [...observation.subjects].sort((a, b) => a.id.localeCompare(b.id))]);
}

export function p05Conditions(observation: P05Observation): P05Condition[] {
  return [...orderedContext(observation.context).map(([field, equals]) => ({ field: 'context.' + field, equals })),
    { field: 'reserve', equals: observation.reserve }, { field: 'selected', equals: observation.selected }]
    .sort((a, b) => a.field.localeCompare(b.field));
}

export function p05ConditionsHold(conditions: readonly P05Condition[], observation: P05Observation): boolean {
  const values: Record<string, P05Scalar> = { ...Object.fromEntries(Object.entries(observation.context)
    .map(([key, value]) => ['context.' + key, value])), reserve: observation.reserve, selected: observation.selected };
  return conditions.every(condition => Object.hasOwn(values, condition.field)
    && values[condition.field] === condition.equals);
}

function validObservation(observation: P05Observation): boolean {
  return Boolean(observation.ref && observation.epoch && observation.selected)
    && Number.isSafeInteger(observation.tick) && observation.tick >= 0
    && Number.isFinite(observation.reserve) && Number.isFinite(observation.remote)
    && observation.subjects.length > 0
    && new Set(observation.subjects.map(subject => subject.id)).size === observation.subjects.length
    && observation.subjects.some(subject => subject.id === observation.selected)
    && observation.subjects.every(subject => Boolean(subject.id) && subject.position.length === 2
      && subject.position.every(Number.isFinite))
    && Object.values(observation.context).every(value => typeof value === 'string' || typeof value === 'boolean'
      || typeof value === 'number' && Number.isFinite(value));
}

function validReceipt(receipt: P05PublicReturn): boolean {
  const epoch = receipt.before?.epoch ?? receipt.epoch, tick = receipt.before?.tick ?? receipt.tick;
  const beforeValid = receipt.before ? validObservation(receipt.before)
    : Boolean(receipt.beforeRef && epoch) && Number.isSafeInteger(tick) && tick! >= 0;
  return Boolean(receipt.id && receipt.command) && beforeValid
    && Number.isSafeInteger(receipt.elapsed) && receipt.elapsed > 0
    && (!receipt.after || validObservation(receipt.after)
      && (receipt.kind === 'prepare' || receipt.after.epoch === epoch
        && receipt.after.tick === tick! + receipt.elapsed));
}

/**
 * Remove exactly one public observation node, including aliases of that same
 * node carried as the next receipt's before-snapshot. Actions, clocks, costs
 * and every other observation remain unchanged. Null is unknown, not zero.
 */
export function ablateP05Return(history: readonly P05PublicReturn[], returnId: string): P05PublicReturn[] {
  const target = history.find(receipt => receipt.id === returnId);
  if (!target?.after) throw new Error('P05 ablation requires an available target return.');
  const removedRef = target.after.ref;
  return history.map(receipt => {
    const copy = structuredClone(receipt);
    const before = copy.before;
    return { ...copy,
      ...(before?.ref === removedRef ? { before: null, beforeRef: before.ref, epoch: before.epoch, tick: before.tick } : {}),
      ...(copy.after?.ref === removedRef ? { after: null } : {}) };
  });
}

const subjectPosition = (observation: P05Observation, id: string) =>
  observation.subjects.find(subject => subject.id === id)?.position;

function relativeDisplacement(start: P05Observation, after: P05Observation, id: string): P05Point | null {
  const from = subjectPosition(start, id), to = subjectPosition(after, id);
  return from && to ? [to[0] - from[0], to[1] - from[1]] : null;
}

function effectIdentity(value: unknown): string {
  // Identifier only. Corpus deduplication and audit hashes belong to evaluation.
  const text = JSON.stringify(value);
  let word = 2166136261;
  for (let i = 0; i < text.length; i++) word = Math.imul(word ^ text.charCodeAt(i), 16777619);
  return 'p05:' + (word >>> 0).toString(16).padStart(8, '0');
}

export class P05AcquisitionLedger {
  readonly maxLatency: number;
  private readonly priorClaims: readonly P05AcquiredEffect[];
  private readonly receipts = new Map<string, P05PublicReturn>();
  private readonly invalid = new Set<string>();
  private cached: { claims: P05AcquiredEffect[]; diagnostics: P05Diagnostics } | undefined;

  constructor(options: P05LearnerOptions) {
    if (!Number.isSafeInteger(options.maxLatency) || options.maxLatency < 0 || options.maxLatency > 64)
      throw new Error('P05 requires a public finite latency bound between 0 and 64.');
    this.maxLatency = options.maxLatency;
    this.priorClaims = structuredClone(options.priorClaims ?? []);
  }

  addReturn(receipt: P05PublicReturn): void {
    const previous = this.receipts.get(receipt.id);
    if (previous) {
      if (!same(previous, receipt)) throw new Error('A P05 return identifier cannot change its content.');
      return;
    }
    if (!validReceipt(receipt)) this.invalid.add(receipt.id);
    this.receipts.set(receipt.id, structuredClone(receipt));
    this.cached = undefined;
  }

  /** A missing return retains its action and cost. It is never a stationary return. */
  withoutReturn(returnId: string): P05AcquisitionLedger {
    const copy = new P05AcquisitionLedger({ maxLatency: this.maxLatency, priorClaims: this.priorClaims });
    for (const receipt of ablateP05Return([...this.receipts.values()], returnId)) copy.addReturn(receipt);
    return copy;
  }

  claims(): readonly P05AcquiredEffect[] { return structuredClone(this.evaluate().claims); }
  diagnostics(): P05Diagnostics { return structuredClone(this.evaluate().diagnostics); }

  private evaluate(): { claims: P05AcquiredEffect[]; diagnostics: P05Diagnostics } {
    if (this.cached) return this.cached;
    const episodes = new Map<string, Episode>();
    const incompleteEpochs = new Set<string>();
    const missing: string[] = [], ambiguous: string[] = [], uncontrolled: string[] = [], missingLinks: string[] = [];
    for (const receipt of this.receipts.values()) {
      if (!receipt.after) missing.push(receipt.id);
      if (this.invalid.has(receipt.id) || receipt.kind === 'prepare') continue;
      const epoch = receipt.before?.epoch ?? receipt.epoch!;
      const tick = receipt.before?.tick ?? receipt.tick!;
      const beforeRef = receipt.before?.ref ?? receipt.beforeRef!;
      if (!receipt.before) { incompleteEpochs.add(epoch); missingLinks.push(epoch); }
      let episode = episodes.get(epoch);
      if (!episode) {
        if (!receipt.before || incompleteEpochs.has(epoch)) continue;
        episode = { epoch, start: receipt.before, returns: [], command: undefined, ambiguous: false };
        episodes.set(episode.epoch, episode);
      }
      const previous = episode.returns.at(-1);
      if (tick !== (previous ? (previous.before?.tick ?? previous.tick!) + previous.elapsed : episode.start.tick)
        || previous?.after && previous.after.ref !== beforeRef) episode.ambiguous = true;
      if (receipt.kind === 'command') {
        if (episode.command || episode.returns.length) episode.ambiguous = true;
        else episode.command = receipt;
      }
      episode.returns.push(receipt);
    }
    const horizon = this.maxLatency + 1;
    const timed = (episode: Episode) => new Map(episode.returns.map(receipt =>
      [(receipt.before?.tick ?? receipt.tick!) + receipt.elapsed - episode.start.tick, receipt]));
    const controls = new Map<string, Episode[]>();
    for (const episode of episodes.values()) {
      if (episode.ambiguous) { ambiguous.push(episode.epoch); continue; }
      if (incompleteEpochs.has(episode.epoch)) continue;
      if (episode.command || episode.returns.some(receipt => receipt.kind !== 'wait')) continue;
      const key = countertrialKey(episode.start);
      controls.set(key, [...controls.get(key) ?? [], episode]);
    }
    const raw: RawEffect[] = [];
    const stationary: { command: string; conditions: P05Condition[]; ids: string[] }[] = [];
    for (const episode of episodes.values()) {
      if (!episode.command || episode.ambiguous) continue;
      if (incompleteEpochs.has(episode.epoch)) continue;
      const candidates = controls.get(countertrialKey(episode.start)) ?? [];
      const control = candidates.find(candidate => {
        const returns = timed(candidate);
        return Array.from({ length: horizon }, (_, i) => i + 1).every(tick => returns.get(tick)?.after);
      });
      if (!control) { uncontrolled.push(episode.epoch); continue; }
      const experimental = timed(episode), counterfactual = timed(control);
      const last = experimental.get(horizon), counterLast = counterfactual.get(horizon);
      if (!last?.after || !counterLast?.after) {
        if (episode.returns.some(receipt => !receipt.after)) missingLinks.push(episode.epoch);
        continue;
      }
      // Missing intermediate after-snapshots cannot be reconstructed from later
      // before-snapshots: they would leave the onset time underdetermined.
      if (Array.from({ length: horizon }, (_, i) => i + 1).some(tick => !experimental.get(tick)?.after)) {
        missingLinks.push(episode.epoch); continue;
      }
      const cost = episode.start.reserve - last.after.reserve - (control.start.reserve - counterLast.after.reserve);
      const remote = last.after.remote - episode.start.remote - (counterLast.after.remote - control.start.remote);
      let moved = false, sawMotion = false, inconsistentMotion = false;
      for (const subject of episode.start.subjects) {
        let onset: number | undefined, delta: P05Point | undefined;
        const evidence: string[] = [];
        let consistent = true;
        for (let tick = 1; tick <= horizon; tick++) {
          const received = experimental.get(tick)!, compared = counterfactual.get(tick)!;
          const actual = relativeDisplacement(episode.start, received.after!, subject.id);
          const ordinary = relativeDisplacement(control.start, compared.after!, subject.id);
          if (!actual || !ordinary) { consistent = false; break; }
          const measured: P05Point = [actual[0] - ordinary[0], actual[1] - ordinary[1]];
          if (measured.some(Boolean)) {
            sawMotion = true;
            if (onset === undefined) { onset = tick; delta = measured; }
            else if (!same(delta, measured)) { consistent = false; break; }
          } else if (onset !== undefined) { consistent = false; break; }
          evidence.push(received.id, compared.id);
        }
        if (!consistent) inconsistentMotion = true;
        if (onset === undefined || !delta || !consistent) continue;
        moved = true;
        const onsetReturn = experimental.get(onset)!, onsetControl = counterfactual.get(onset)!;
        raw.push({ command: episode.command.command, subject: subject.id, selected: episode.start.selected,
          effectKind: cost !== 0 || remote !== 0 ? 'combined' : 'translation',
          delta, delay: onset - 1, resourceCost: cost, remoteDelta: remote,
          conditions: p05Conditions(episode.start),
          // The decisive command-effect return is first for explicit ablation.
          supportingReturnIds: unique([onsetReturn.id, onsetControl.id, ...evidence]), status: 'restricted' });
      }
      if (inconsistentMotion) ambiguous.push(episode.epoch);
      if (!moved && !sawMotion && !inconsistentMotion) {
        stationary.push({ command: episode.command.command, conditions: p05Conditions(episode.start),
          ids: episode.returns.filter(receipt => receipt.after).map(receipt => receipt.id) });
        // Stationarity is about geometry. It does not erase a measured reserve
        // consumption or a causal remote effect.
        if (cost !== 0 || remote !== 0) {
          let onset = 1;
          if (remote !== 0) for (let tick = 1; tick <= horizon; tick++) {
            const actual = experimental.get(tick)!.after!, ordinary = counterfactual.get(tick)!.after!;
            if (actual.remote - episode.start.remote - (ordinary.remote - control.start.remote) !== 0) { onset = tick; break; }
          }
          const evidence = Array.from({ length: horizon }, (_, i) => i + 1)
            .flatMap(tick => [experimental.get(tick)!.id, counterfactual.get(tick)!.id]);
          raw.push({ command: episode.command.command, subject: episode.start.selected, selected: episode.start.selected,
            effectKind: cost !== 0 && remote !== 0 ? 'combined' : remote !== 0 ? 'remote' : 'resource',
            delta: [0, 0], delay: onset - 1, resourceCost: cost, remoteDelta: remote,
            conditions: p05Conditions(episode.start),
            supportingReturnIds: unique([experimental.get(onset)!.id, counterfactual.get(onset)!.id, ...evidence]),
            status: 'restricted' });
        }
      }
    }

    const claims = new Map<string, P05AcquiredEffect>();
    for (const measured of raw) {
      const selectionPeers = raw.filter(peer => peer.command === measured.command && peer.subject === peer.selected
        && measured.subject === measured.selected && same(peer.delta, measured.delta) && peer.delay === measured.delay
        && peer.resourceCost === measured.resourceCost && peer.remoteDelta === measured.remoteDelta
        && conditionsKey(peer.conditions.filter(condition => condition.field !== 'selected'))
          === conditionsKey(measured.conditions.filter(condition => condition.field !== 'selected')));
      const followsSelection = new Set(selectionPeers.map(peer => peer.selected)).size >= 2;
      const receiver = followsSelection ? 'selected' : measured.subject;
      const conditions = measured.conditions; // Keep each tested selector as a scope boundary.
      const supportingReturnIds = unique([...measured.supportingReturnIds,
        ...(followsSelection ? selectionPeers.flatMap(peer => peer.supportingReturnIds) : [])]);
      const limitingReturnIds = unique(stationary.filter(trial => trial.command === measured.command
        && conditionsKey(trial.conditions) !== conditionsKey(measured.conditions)).flatMap(trial => trial.ids));
      const previous = this.priorClaims.filter(prior => prior.command === measured.command
        && (prior.receiver === 'selected' || prior.receiver === measured.subject));
      const matchingPrior = previous.filter(prior => same(prior.delta, measured.delta) && prior.delay === measured.delay
        && prior.resourceCost === measured.resourceCost && prior.remoteDelta === measured.remoteDelta);
      const transferStatus = !previous.length ? undefined : !matchingPrior.length ? 'refuted' as const
        : matchingPrior.some(prior => conditionsKey(prior.conditions) === conditionsKey(conditions)) ? 'confirmed' as const : 'restricted' as const;
      const semantic = { effectKind: measured.effectKind, command: measured.command, receiver, delta: measured.delta, delay: measured.delay,
        resourceCost: measured.resourceCost, remoteDelta: measured.remoteDelta, conditions };
      const key = JSON.stringify(semantic), prior = claims.get(key);
      claims.set(key, { ...semantic, effectId: effectIdentity(semantic),
        supportingReturnIds: unique([...(prior?.supportingReturnIds ?? []), ...supportingReturnIds]),
        limitingReturnIds: unique([...(prior?.limitingReturnIds ?? []), ...limitingReturnIds]),
        status: 'restricted', ...(transferStatus ? { transferStatus } : {}) });
    }
    this.cached = { claims: [...claims.values()], diagnostics: { receipts: this.receipts.size,
      stationaryReturnIds: unique(stationary.flatMap(trial => trial.ids)), missingReturnIds: unique(missing),
      staleProofIds: unique(this.priorClaims.flatMap(prior => prior.supportingReturnIds)),
      ambiguousEpochs: unique(ambiguous), uncontrolledEpochs: unique(uncontrolled), missingLinkEpochs: unique(missingLinks),
      rejectedReturnIds: [...this.invalid] } };
    return this.cached;
  }
}

export const createP05Learner = (options: P05LearnerOptions): P05AcquisitionLedger => new P05AcquisitionLedger(options);
