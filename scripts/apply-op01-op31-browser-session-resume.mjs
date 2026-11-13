import { readFile, writeFile } from 'node:fs/promises';

async function patchFile(path, patcher) {
  const before = await readFile(path, 'utf8');
  const after = patcher(before);
  if (after === before) throw new Error(`patch made no change: ${path}`);
  await writeFile(path, after);
  console.log(`patched ${path}`);
}

function replaceOnce(source, needle, replacement, label) {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`missing patch anchor: ${label}`);
  if (source.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`ambiguous patch anchor: ${label}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + needle.length);
}

await patchFile('src/runtime/v6-browser-campaign-checkpoint.ts', source => replaceOnce(
  source,
  '  const session = {\n    version: 1 as const,',
  '  const session: BrowserCampaignSessionCheckpointV1 = {\n    version: 1,',
  'typed browser checkpoint session',
));

await patchFile('src/runtime/v6-browser-common-campaign-host.ts', source => {
  source = replaceOnce(
    source,
    "import type { FieldStockDependencies } from '../logos-engine/field-stock.ts';",
    "import type { FieldStockDependencies } from '../logos-engine/field-stock.ts';\nimport {\n  CommonCampaignCheckpointCoordinator,\n  type CommonCampaignCheckpointParticipant,\n} from '../logos-engine/v6-common-campaign-checkpoint.ts';",
    'common checkpoint imports',
  );
  source = replaceOnce(
    source,
    "import { ObservedAddressedMaterialRuntime } from './observed-addressed-material-runtime.ts';",
    "import { ObservedAddressedMaterialRuntime } from './observed-addressed-material-runtime.ts';\nimport {\n  ObservedAddressedMaterialCheckpointParticipant,\n} from './observed-addressed-material-checkpoint.ts';\nimport {\n  browserGameObservationIdentity,\n  parseBrowserCommonCampaignHostCheckpoint,\n  sameBrowserGameObservation,\n  type BrowserCommonCampaignHostCheckpointV1,\n} from './v6-browser-campaign-checkpoint.ts';",
    'browser checkpoint imports',
  );
  source = replaceOnce(
    source,
    "export interface BrowserCampaignHostOptions {\n  campaign: CommonCampaignOwner;\n  ownerTransports: readonly BrowserCampaignOwnerTransport[];\n  eventRef?(input: BrowserCampaignReturnPair): string;\n}",
    "export interface BrowserCampaignHostOptions {\n  campaign: CommonCampaignOwner;\n  ownerTransports: readonly BrowserCampaignOwnerTransport[];\n  checkpointParticipants?: readonly CommonCampaignCheckpointParticipant[];\n  eventRef?(input: BrowserCampaignReturnPair): string;\n}",
    'host checkpoint participants option',
  );
  source = replaceOnce(
    source,
    "export type BrowserCampaignHostStatus =\n  | 'not-started'\n  | 'not-ready'\n  | CampaignPrepareResult['status'];",
    "export type BrowserCampaignHostStatus =\n  | 'not-started'\n  | 'not-ready'\n  | 'resumed'\n  | CampaignPrepareResult['status'];",
    'resumed host status',
  );
  source = replaceOnce(
    source,
    "interface ActiveBrowserCampaignSession {\n  sessionId: string;\n  stream: BrowserAgentObservationStream;\n  gameObservation: GameObservation;\n  agentObservation: AgentObservation;\n}\n\nfunction nonEmpty",
    "interface ActiveBrowserCampaignSession {\n  sessionId: string;\n  stream: BrowserAgentObservationStream;\n  gameObservation: GameObservation;\n  agentObservation: AgentObservation;\n}\n\ninterface PendingBrowserCampaignReturn {\n  preparation: BrowserCampaignActionPreparation;\n  beforeGameObservation: GameObservation;\n  beforeAgentObservation: AgentObservation;\n  dispatched: boolean;\n}\n\nfunction record(value: unknown, label: string): Record<string, unknown> {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) {\n    throw new TypeError(`${label} must be an object`);\n  }\n  return value as Record<string, unknown>;\n}\n\nfunction nonEmpty",
    'pending browser return interface',
  );
  source = replaceOnce(
    source,
    "export class BrowserFieldStockCampaignTransport implements BrowserCampaignOwnerTransport {\n  readonly ownerId = FIELD_STOCK_CALLER_OWNER_ID;",
    "export const BROWSER_FIELD_STOCK_CAMPAIGN_TRANSPORT_CHECKPOINT_ID =\n  'browser_field_stock_campaign_transport_v1';\n\nexport class BrowserFieldStockCampaignTransport\nimplements BrowserCampaignOwnerTransport, CommonCampaignCheckpointParticipant {\n  readonly ownerId = FIELD_STOCK_CALLER_OWNER_ID;\n  readonly checkpointId = BROWSER_FIELD_STOCK_CAMPAIGN_TRANSPORT_CHECKPOINT_ID;",
    'FieldStock transport checkpoint identity',
  );
  source = replaceOnce(
    source,
    "  get lastBoundaryStatus(): ReturnType<ObservedAddressedMaterialRuntime['boundary']> | null {",
    "  snapshot(): unknown {\n    return {\n      version: 1,\n      sessionId: this.#sessionId,\n      current: structuredClone(this.#current),\n    };\n  }\n\n  restore(value: unknown): void {\n    const checkpoint = record(value, 'browser FieldStock transport checkpoint');\n    if (checkpoint.version !== 1) {\n      throw new TypeError('unsupported browser FieldStock transport checkpoint version');\n    }\n    const sessionId = checkpoint.sessionId;\n    if (sessionId !== null && (typeof sessionId !== 'string' || sessionId.length === 0)) {\n      throw new TypeError('browser FieldStock checkpoint sessionId must be null or non-empty');\n    }\n    const current = checkpoint.current === null\n      ? null\n      : structuredClone(record(checkpoint.current, 'browser FieldStock checkpoint current'))\n        as unknown as PublicCampaignObservation;\n    if (current && sessionId === null) {\n      throw new Error('browser FieldStock checkpoint current observation has no session');\n    }\n    if (current && current.agent.sessionId !== sessionId) {\n      throw new Error('browser FieldStock checkpoint current observation belongs to another session');\n    }\n    this.#sessionId = sessionId;\n    this.#current = current;\n    this.#lastBoundaryStatus = null;\n    this.#lastRevalidationStatus = null;\n    this.#lastAddressedLearningStatus = null;\n  }\n\n  get lastBoundaryStatus(): ReturnType<ObservedAddressedMaterialRuntime['boundary']> | null {",
    'FieldStock transport snapshot methods',
  );
  source = replaceOnce(
    source,
    "export class BrowserCommonCampaignHost {\n  readonly #campaign: CommonCampaignOwner;\n  readonly #transports = new Map<string, BrowserCampaignOwnerTransport>();\n  readonly #eventRef: (input: BrowserCampaignReturnPair) => string;\n  #active: ActiveBrowserCampaignSession | null = null;",
    "export class BrowserCommonCampaignHost {\n  readonly #campaign: CommonCampaignOwner;\n  readonly #checkpoint: CommonCampaignCheckpointCoordinator;\n  readonly #transports = new Map<string, BrowserCampaignOwnerTransport>();\n  readonly #eventRef: (input: BrowserCampaignReturnPair) => string;\n  #active: ActiveBrowserCampaignSession | null = null;\n  #pendingReturn: PendingBrowserCampaignReturn | null = null;\n  #activeRuns = 0;",
    'host checkpoint fields',
  );
  source = replaceOnce(
    source,
    "    this.#campaign = options.campaign;\n    this.#eventRef = options.eventRef ?? defaultEventRef;",
    "    this.#campaign = options.campaign;\n    this.#checkpoint = new CommonCampaignCheckpointCoordinator(\n      this.#campaign,\n      options.checkpointParticipants,\n    );\n    this.#eventRef = options.eventRef ?? defaultEventRef;",
    'host checkpoint coordinator construction',
  );
  source = replaceOnce(
    source,
    "    if (this.#active) this.#campaign.cancel(this.#active.sessionId);\n\n    const stream = new BrowserAgentObservationStream({",
    "    if (this.#active) this.#campaign.cancel(this.#active.sessionId);\n    this.#pendingReturn = null;\n\n    const stream = new BrowserAgentObservationStream({",
    'begin clears pending return metadata',
  );
  source = replaceOnce(
    source,
    "    const active = this.#active;\n    if (!active) return this.#emptyResult('not-started');\n    if (!productReady(state)) {",
    "    const active = this.#active;\n    if (!active) return this.#emptyResult('not-started');\n    const resumed = this.#resumePendingReturn(state, ports);\n    if (resumed) return resumed;\n    if (!productReady(state)) {",
    'resume pending return before normal readiness',
  );
  source = replaceOnce(
    source,
    "    let acquisition: CampaignReturnReceipt | null = null;\n    let returnedObservation: AgentObservation | null = null;\n    let returnCommitted = false;\n\n    try {\n      const dispatch = await dispatchProductAction(",
    "    const pendingReturn: PendingBrowserCampaignReturn = {\n      preparation: structuredClone(preparation),\n      beforeGameObservation: structuredClone(active.gameObservation),\n      beforeAgentObservation: cloneAgentObservation(active.agentObservation),\n      dispatched: false,\n    };\n    this.#pendingReturn = pendingReturn;\n\n    let acquisition: CampaignReturnReceipt | null = null;\n    let returnedObservation: AgentObservation | null = null;\n    let returnCommitted = false;\n    this.#activeRuns += 1;\n\n    try {\n      const dispatch = await dispatchProductAction(",
    'track pending browser return',
  );
  source = replaceOnce(
    source,
    "          action: (action, data) => ports.action(action, data),",
    "          action: (action, data) => {\n            if (this.#pendingReturn === pendingReturn) pendingReturn.dispatched = true;\n            return ports.action(action, data);\n          },",
    'mark physical dispatch',
  );
  source = replaceOnce(
    source,
    "            returnedObservation = cloneAgentObservation(converted);\n            returnCommitted = true;\n            for (const observer of this.#transports.values()) {",
    "            returnedObservation = cloneAgentObservation(converted);\n            returnCommitted = true;\n            if (this.#pendingReturn === pendingReturn) this.#pendingReturn = null;\n            for (const observer of this.#transports.values()) {",
    'clear pending metadata after acquisition',
  );
  source = replaceOnce(
    source,
    "      if (!dispatch.accepted && !returnCommitted) {\n        this.#campaign.cancel(active.sessionId);\n      }",
    "      if (!dispatch.accepted && !returnCommitted) {\n        this.#campaign.cancel(active.sessionId);\n        if (this.#pendingReturn === pendingReturn) this.#pendingReturn = null;\n      }",
    'clear rejected pending metadata',
  );
  source = replaceOnce(
    source,
    "    } catch (error) {\n      if (!returnCommitted) this.#campaign.cancel(active.sessionId);\n      throw error;\n    }\n  }\n\n  cancel(): boolean {",
    "    } catch (error) {\n      if (!returnCommitted) this.#campaign.cancel(active.sessionId);\n      if (this.#pendingReturn === pendingReturn) this.#pendingReturn = null;\n      throw error;\n    } finally {\n      this.#activeRuns -= 1;\n    }\n  }\n\n  snapshot(): BrowserCommonCampaignHostCheckpointV1 {\n    const common = this.#checkpoint.snapshot();\n    const active = this.#active;\n    if (!active) {\n      return { version: 1, common, session: null };\n    }\n\n    const pending = this.#campaign.pending(active.sessionId);\n    let pendingReturn: BrowserCommonCampaignHostCheckpointV1['session'] extends infer T\n      ? T extends { pendingReturn: infer P } ? P : never\n      : never = null;\n    if (pending) {\n      const tracked = this.#pendingReturn;\n      if (!tracked?.dispatched) {\n        throw new Error('browser campaign pending need has not reached physical dispatch');\n      }\n      if (\n        pending.needId !== tracked.preparation.needId\n        || pending.ownerId !== tracked.preparation.ownerId\n        || pending.proposalRef !== tracked.preparation.proposalRef\n      ) {\n        throw new Error('browser campaign pending dispatch identity changed');\n      }\n      pendingReturn = {\n        version: 1,\n        stage: 'dispatched',\n        preparation: structuredClone(tracked.preparation),\n        beforeGameObservation: structuredClone(tracked.beforeGameObservation),\n        beforeAgentObservation: cloneAgentObservation(tracked.beforeAgentObservation),\n      };\n    }\n    if (this.#activeRuns > 0 && pendingReturn === null) {\n      throw new Error('browser campaign checkpoint requires a settled or dispatched boundary');\n    }\n\n    return parseBrowserCommonCampaignHostCheckpoint({\n      version: 1,\n      common,\n      session: {\n        version: 1,\n        sessionId: active.sessionId,\n        gameCode: active.gameObservation.gameCode,\n        nextSequence: active.stream.nextSequence,\n        observationIdentity: browserGameObservationIdentity(active.gameObservation),\n        gameObservation: structuredClone(active.gameObservation),\n        agentObservation: cloneAgentObservation(active.agentObservation),\n        pendingReturn,\n      },\n    });\n  }\n\n  restore(value: unknown, liveObservation: GameObservation): AgentObservation {\n    if (this.#active || this.#activeRuns > 0) {\n      throw new Error('browser campaign host restore requires a fresh host');\n    }\n    const checkpoint = parseBrowserCommonCampaignHostCheckpoint(value);\n    const session = checkpoint.session;\n    if (!session) throw new Error('browser campaign checkpoint has no active session');\n    if (liveObservation.gameCode !== session.gameCode) {\n      throw new Error('browser campaign checkpoint belongs to another game');\n    }\n    const sameObservation = sameBrowserGameObservation(\n      liveObservation,\n      session.gameObservation,\n    );\n    if (!sameObservation && !session.pendingReturn) {\n      throw new Error('browser campaign checkpoint observation is stale');\n    }\n\n    const stream = new BrowserAgentObservationStream({\n      sessionId: session.sessionId,\n      gameCode: session.gameCode,\n      initialSequence: session.nextSequence,\n    });\n    this.#checkpoint.restore(checkpoint.common);\n    this.#active = {\n      sessionId: session.sessionId,\n      stream,\n      gameObservation: sameObservation\n        ? liveObservation\n        : structuredClone(session.gameObservation),\n      agentObservation: cloneAgentObservation(session.agentObservation),\n    };\n    this.#pendingReturn = session.pendingReturn\n      ? {\n          preparation: structuredClone(session.pendingReturn.preparation),\n          beforeGameObservation: structuredClone(session.pendingReturn.beforeGameObservation),\n          beforeAgentObservation: cloneAgentObservation(session.pendingReturn.beforeAgentObservation),\n          dispatched: true,\n        }\n      : null;\n    return cloneAgentObservation(session.agentObservation);\n  }\n\n  #resumePendingReturn(\n    state: ProductReadinessState,\n    ports: BrowserCampaignDispatchPorts,\n  ): BrowserCampaignHostResult | null {\n    const active = this.#active;\n    const tracked = this.#pendingReturn;\n    if (!active || !tracked) return null;\n    if (!productReady(state)) {\n      return this.#emptyResult('not-ready', 'product-not-ready');\n    }\n    const live = state.observation as GameObservation | null;\n    if (!live || live.gameCode !== active.gameObservation.gameCode) {\n      return this.#emptyResult('not-ready', 'stale-product-observation');\n    }\n    const pending = this.#campaign.prepare(active.agentObservation);\n    if (pending.status !== 'pending') {\n      throw new Error('browser campaign dispatched return lost its pending need');\n    }\n    if (\n      pending.needId !== tracked.preparation.needId\n      || pending.ownerId !== tracked.preparation.ownerId\n      || pending.proposalRef !== tracked.preparation.proposalRef\n    ) {\n      throw new Error('browser campaign restored pending identity changed');\n    }\n    if (sameBrowserGameObservation(live, tracked.beforeGameObservation)) {\n      return {\n        status: 'pending',\n        preparation: pending,\n        dispatch: null,\n        acquisition: null,\n        returnedObservation: null,\n      };\n    }\n    if (!tracked.dispatched) {\n      throw new Error('browser campaign cannot consume a return for an undispatched action');\n    }\n\n    const transport = this.#transports.get(tracked.preparation.ownerId);\n    if (!transport) {\n      throw new Error(`selected campaign owner ${tracked.preparation.ownerId} has no browser transport`);\n    }\n    const converted = active.stream.next(live);\n    const returnPair: BrowserCampaignReturnPair = {\n      sessionId: active.sessionId,\n      preparation: tracked.preparation,\n      beforeGameObservation: tracked.beforeGameObservation,\n      beforeAgentObservation: tracked.beforeAgentObservation,\n      afterGameObservation: live,\n      afterAgentObservation: converted,\n    };\n    const eventRef = this.#eventRef(returnPair);\n    nonEmpty(eventRef, 'browser campaign resumed return event reference');\n    const acquisition = this.#campaign.acquire({\n      sessionId: active.sessionId,\n      needId: tracked.preparation.needId,\n      eventRef,\n      payload: transport.returnPayload(returnPair),\n    });\n    active.gameObservation = live;\n    active.agentObservation = converted;\n    this.#pendingReturn = null;\n    for (const observer of this.#transports.values()) {\n      observer.observeAcquiredReturn?.(returnPair, acquisition);\n    }\n    const returnedObservation = cloneAgentObservation(converted);\n    ports.onCampaignAcquired?.(acquisition, returnedObservation);\n    return {\n      status: 'resumed',\n      preparation: tracked.preparation,\n      dispatch: null,\n      acquisition,\n      returnedObservation,\n    };\n  }\n\n  cancel(): boolean {",
    'host snapshot restore and pending return resume',
  );
  source = replaceOnce(
    source,
    "  cancel(): boolean {\n    const active = this.#active;\n    if (!active) return false;\n    return this.#campaign.cancel(active.sessionId);\n  }\n\n  dispose(): void {\n    this.cancel();\n    this.#active = null;\n  }",
    "  cancel(): boolean {\n    const active = this.#active;\n    if (!active) return false;\n    const cancelled = this.#campaign.cancel(active.sessionId);\n    if (cancelled) this.#pendingReturn = null;\n    return cancelled;\n  }\n\n  dispose(): void {\n    this.cancel();\n    this.#pendingReturn = null;\n    this.#active = null;\n  }",
    'host cancel and dispose checkpoint state',
  );
  source = replaceOnce(
    source,
    "    ownerTransports: [\n      fieldTransport,",
    "    checkpointParticipants: [\n      new ObservedAddressedMaterialCheckpointParticipant(runtime),\n      fieldTransport,\n    ],\n    ownerTransports: [\n      fieldTransport,",
    'generic FieldStock host checkpoint participants',
  );
  return source;
});

await patchFile('src/runtime/v6-browser-product-campaign-host.ts', source => {
  source = replaceOnce(
    source,
    "import { ObservedAddressedMaterialRuntime } from './observed-addressed-material-runtime.ts';",
    "import { ObservedAddressedMaterialRuntime } from './observed-addressed-material-runtime.ts';\nimport {\n  ObservedAddressedMaterialCheckpointParticipant,\n} from './observed-addressed-material-checkpoint.ts';",
    'product host checkpoint participant import',
  );
  source = replaceOnce(
    source,
    "  return new BrowserCommonCampaignHost({\n    campaign,\n    eventRef: options.eventRef,\n    ownerTransports: [",
    "  return new BrowserCommonCampaignHost({\n    campaign,\n    eventRef: options.eventRef,\n    checkpointParticipants: [\n      new ObservedAddressedMaterialCheckpointParticipant(runtime),\n      fieldTransport,\n    ],\n    ownerTransports: [",
    'product host checkpoint participants',
  );
  return source;
});

const controller = `import type { ProductReadinessState } from '../agent-product-dispatch.ts';
import type { GameObservation } from './browser-games.ts';
import { createFieldStockAndPublicSingleActionBrowserCampaignHost } from './v6-browser-product-campaign-host.ts';
import type {
  BrowserCampaignDispatchPorts,
  BrowserCampaignHostResult,
  BrowserCommonCampaignHost,
} from './v6-browser-common-campaign-host.ts';
import type {
  BrowserCommonCampaignHostCheckpointV1,
} from './v6-browser-campaign-checkpoint.ts';

/**
 * The first product controller deliberately owns exactly one qualified seam.
 * The Worker host remains available for other runtimes but is never instantiated
 * by this browser controller, preventing two campaign owners from acting on the
 * same product session.
 */
export const BROWSER_AGENT_CONTROLLER_STATUS = Object.freeze({
  available: true,
  name: 'SRA',
  status: 'bounded-browser-common-campaign',
  seam: 'browser-common-campaign',
} as const);

export type BrowserAgentControllerPhase =
  | 'idle'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'disposed';

export type BrowserAgentControllerStopReason =
  | 'manual'
  | 'replaced'
  | 'not-started'
  | 'not-ready'
  | 'none'
  | 'ambiguous'
  | 'pending'
  | 'blocked'
  | 'terminal'
  | 'stale'
  | 'action-limit'
  | 'error'
  | 'disposed';

export interface BrowserAgentControllerSnapshot {
  seam: typeof BROWSER_AGENT_CONTROLLER_STATUS.seam;
  phase: BrowserAgentControllerPhase;
  sessionId: string | null;
  stopReason: BrowserAgentControllerStopReason | null;
  campaignStatus: BrowserCampaignHostResult['status'] | null;
  actionsDispatched: number;
}

export interface BrowserAgentControllerCheckpointV1 {
  version: 1;
  host: BrowserCommonCampaignHostCheckpointV1;
  actionsDispatched: number;
  sessionOrdinal: number;
}

export interface BrowserAgentControllerPorts extends BrowserCampaignDispatchPorts {
  /** Return the live product state; copied snapshots are intentionally rejected. */
  readState(): ProductReadinessState;
  /** Give rendering and mode-change events a turn between accepted actions. */
  yieldToBrowser?(): Promise<void>;
}

export type BrowserAgentCampaignHost = Pick<
  BrowserCommonCampaignHost,
  'begin' | 'run' | 'cancel' | 'dispose' | 'currentGameObservation'
> & Partial<Pick<
  BrowserCommonCampaignHost,
  'snapshot' | 'restore' | 'sessionId'
>>;

export interface BrowserAgentControllerOptions {
  createHost?: () => BrowserAgentCampaignHost;
  makeSessionId?: (observation: GameObservation, ordinal: number) => string;
  maxActions?: number;
  onStateChange?(snapshot: BrowserAgentControllerSnapshot): void;
  onError?(error: unknown, snapshot: BrowserAgentControllerSnapshot): void;
  onCheckpointRejected?(error: unknown, checkpoint: BrowserAgentControllerCheckpointV1): void;
}

function terminal(observation: ProductReadinessState['observation']): boolean {
  return Boolean(observation && [
    'WIN',
    'LEVEL_COMPLETE',
    'GAME_OVER',
    'GAMEOVER',
  ].includes(observation.state));
}

function stopReasonFor(result: BrowserCampaignHostResult): BrowserAgentControllerStopReason {
  if (result.status === 'not-ready') {
    return result.reason === 'stale-product-observation' ? 'stale' : 'not-ready';
  }
  if (result.status === 'not-started') return 'not-started';
  if (result.status === 'none') return 'none';
  if (result.status === 'ambiguous') return 'ambiguous';
  if (result.status === 'pending') return 'pending';
  if (result.status === 'blocked') return 'blocked';
  return result.dispatch?.stale ? 'stale' : 'not-ready';
}

function stopPriority(reason: BrowserAgentControllerStopReason): number {
  if (reason === 'disposed') return 3;
  if (reason === 'replaced') return 2;
  if (reason === 'manual') return 1;
  return 0;
}

function checkpointable(reason: BrowserAgentControllerStopReason): boolean {
  return [
    'manual',
    'none',
    'ambiguous',
    'pending',
    'blocked',
    'action-limit',
  ].includes(reason);
}

function parseControllerCheckpoint(value: unknown): BrowserAgentControllerCheckpointV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('browser agent controller checkpoint must be an object');
  }
  const checkpoint = value as Partial<BrowserAgentControllerCheckpointV1>;
  if (checkpoint.version !== 1 || !checkpoint.host) {
    throw new TypeError('unsupported browser agent controller checkpoint');
  }
  if (!Number.isInteger(checkpoint.actionsDispatched) || checkpoint.actionsDispatched! < 0) {
    throw new RangeError('browser agent checkpoint actionsDispatched must be non-negative');
  }
  if (!Number.isInteger(checkpoint.sessionOrdinal) || checkpoint.sessionOrdinal! < 0) {
    throw new RangeError('browser agent checkpoint sessionOrdinal must be non-negative');
  }
  return structuredClone(checkpoint) as BrowserAgentControllerCheckpointV1;
}

/**
 * Own a bounded, single-seam browser Agent session.
 *
 * The controller never chooses an action itself. It repeatedly asks the
 * qualified CommonCampaignOwner host for one already-authorized action and
 * stops immediately when the host reports no proposal, ambiguity, a blocked
 * release, stale product state, a terminal observation, an error or the hard
 * action bound.
 */
export class BrowserAgentController {
  readonly #createHost: () => BrowserAgentCampaignHost;
  readonly #makeSessionId: NonNullable<BrowserAgentControllerOptions['makeSessionId']>;
  readonly #maxActions: number;
  readonly #onStateChange?: BrowserAgentControllerOptions['onStateChange'];
  readonly #onError?: BrowserAgentControllerOptions['onError'];
  readonly #onCheckpointRejected?: BrowserAgentControllerOptions['onCheckpointRejected'];

  #host: BrowserAgentCampaignHost | null = null;
  #phase: BrowserAgentControllerPhase = 'idle';
  #sessionId: string | null = null;
  #stopReason: BrowserAgentControllerStopReason | null = null;
  #requestedStop: BrowserAgentControllerStopReason | null = null;
  #campaignStatus: BrowserCampaignHostResult['status'] | null = null;
  #actionsDispatched = 0;
  #sessionOrdinal = 0;
  #runPromise: Promise<BrowserAgentControllerSnapshot> | null = null;
  #checkpoint: BrowserAgentControllerCheckpointV1 | null = null;
  #disposed = false;

  constructor(options: BrowserAgentControllerOptions = {}) {
    this.#createHost = options.createHost
      ?? (() => createFieldStockAndPublicSingleActionBrowserCampaignHost());
    this.#makeSessionId = options.makeSessionId
      ?? ((observation, ordinal) => `browser-agent:${observation.gameCode}:${ordinal}`);
    this.#maxActions = options.maxActions ?? 64;
    if (!Number.isInteger(this.#maxActions) || this.#maxActions <= 0) {
      throw new RangeError('browser agent maxActions must be a positive integer');
    }
    this.#onStateChange = options.onStateChange;
    this.#onError = options.onError;
    this.#onCheckpointRejected = options.onCheckpointRejected;
  }

  activate(
    observation: GameObservation,
    ports: BrowserAgentControllerPorts,
  ): Promise<BrowserAgentControllerSnapshot> {
    if (this.#disposed) {
      return Promise.resolve(this.snapshot());
    }

    if (this.#runPromise) {
      if (this.#requestedStop === 'manual') {
        this.#requestedStop = null;
        this.#stopReason = null;
        this.#phase = 'running';
        this.#emit();
      }
      return this.#runPromise;
    }

    if (terminal(observation)) {
      this.#checkpoint = null;
      this.#phase = 'stopped';
      this.#stopReason = 'terminal';
      this.#campaignStatus = null;
      this.#actionsDispatched = 0;
      this.#emit();
      return Promise.resolve(this.snapshot());
    }

    const liveState = ports.readState();
    if (liveState.observation !== observation
      || liveState.selectedGameCode !== observation.gameCode
      || liveState.busy
      || liveState.loading
      || liveState.failed) {
      this.#phase = 'stopped';
      this.#stopReason = liveState.observation === observation ? 'not-ready' : 'stale';
      this.#campaignStatus = null;
      this.#actionsDispatched = 0;
      this.#emit();
      return Promise.resolve(this.snapshot());
    }

    let host = this.#createHost();
    let sessionId: string | null = null;
    const retained = this.#checkpoint;
    if (retained && host.restore) {
      try {
        host.restore(retained.host, observation);
        sessionId = host.sessionId ?? retained.host.session?.sessionId ?? null;
        if (!sessionId) throw new Error('restored browser campaign has no session id');
        this.#actionsDispatched = retained.actionsDispatched;
        this.#sessionOrdinal = Math.max(this.#sessionOrdinal, retained.sessionOrdinal);
        this.#checkpoint = null;
      } catch (error) {
        this.#onCheckpointRejected?.(error, structuredClone(retained));
        this.#checkpoint = null;
        host.dispose();
        host = this.#createHost();
      }
    }

    if (!sessionId) {
      const ordinal = ++this.#sessionOrdinal;
      sessionId = this.#makeSessionId(observation, ordinal);
      if (!sessionId) throw new TypeError('browser agent session id must be non-empty');
      host.begin({ sessionId, observation });
      this.#actionsDispatched = 0;
    }

    this.#host = host;
    this.#sessionId = sessionId;
    this.#stopReason = null;
    this.#requestedStop = null;
    this.#campaignStatus = null;
    this.#phase = 'running';
    this.#emit();

    const run = this.#run(host, ports);
    const tracked = run.finally(() => {
      if (this.#runPromise === tracked) this.#runPromise = null;
    });
    this.#runPromise = tracked;
    return tracked;
  }

  /**
   * Request a graceful mode stop. An action already in flight is allowed to
   * return, be acquired and be presented before ownership returns to Manual.
   */
  deactivate(reason: 'manual' | 'replaced' = 'manual'): BrowserAgentControllerSnapshot {
    if (this.#disposed) return this.snapshot();
    if (reason === 'replaced') this.#checkpoint = null;
    if (!this.#runPromise) {
      this.#disposeHost();
      this.#phase = 'stopped';
      this.#stopReason = reason;
      this.#requestedStop = null;
      this.#emit();
      return this.snapshot();
    }

    if (!this.#requestedStop || stopPriority(reason) > stopPriority(this.#requestedStop)) {
      this.#requestedStop = reason;
    }
    this.#phase = 'stopping';
    this.#stopReason = this.#requestedStop;
    this.#emit();
    return this.snapshot();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#checkpoint = null;
    this.#requestedStop = 'disposed';
    this.#host?.cancel();
    this.#disposeHost();
    this.#phase = 'disposed';
    this.#stopReason = 'disposed';
    this.#emit();
  }

  snapshot(): BrowserAgentControllerSnapshot {
    return {
      seam: BROWSER_AGENT_CONTROLLER_STATUS.seam,
      phase: this.#phase,
      sessionId: this.#sessionId,
      stopReason: this.#stopReason,
      campaignStatus: this.#campaignStatus,
      actionsDispatched: this.#actionsDispatched,
    };
  }

  retainedCheckpoint(): BrowserAgentControllerCheckpointV1 | null {
    return this.#checkpoint ? structuredClone(this.#checkpoint) : null;
  }

  restoreCheckpoint(value: unknown): void {
    if (this.#disposed || this.#runPromise || this.#host) {
      throw new Error('browser agent checkpoint restore requires an idle controller');
    }
    this.#checkpoint = parseControllerCheckpoint(value);
  }

  get running(): boolean {
    return this.#phase === 'running' || this.#phase === 'stopping';
  }

  async #run(
    host: BrowserAgentCampaignHost,
    ports: BrowserAgentControllerPorts,
  ): Promise<BrowserAgentControllerSnapshot> {
    try {
      while (!this.#disposed && this.#host === host) {
        if (this.#requestedStop) return this.#finish(this.#requestedStop);
        if (this.#actionsDispatched >= this.#maxActions) return this.#finish('action-limit');

        const state = ports.readState();
        if (terminal(state.observation)) return this.#finish('terminal');

        const result = await host.run(state, ports);
        this.#campaignStatus = result.status;
        if (result.status === 'action' && result.dispatch && result.dispatch.elapsedMs !== null) {
          this.#actionsDispatched += 1;
        }
        this.#emit();

        if (this.#requestedStop) return this.#finish(this.#requestedStop);
        if (result.status === 'resumed') {
          const resumedCurrent = host.currentGameObservation ?? ports.readState().observation;
          if (terminal(resumedCurrent)) return this.#finish('terminal');
          await ports.yieldToBrowser?.();
          continue;
        }
        if (result.status !== 'action') return this.#finish(stopReasonFor(result));
        if (!result.dispatch?.accepted) return this.#finish(stopReasonFor(result));

        const current = host.currentGameObservation ?? ports.readState().observation;
        if (terminal(current)) return this.#finish('terminal');
        if (this.#actionsDispatched >= this.#maxActions) return this.#finish('action-limit');

        await ports.yieldToBrowser?.();
      }
      return this.#finish(this.#disposed ? 'disposed' : 'replaced');
    } catch (error) {
      if (this.#disposed) return this.#finish('disposed');
      const snapshot = this.#finish('error');
      this.#onError?.(error, snapshot);
      return snapshot;
    }
  }

  #finish(reason: BrowserAgentControllerStopReason): BrowserAgentControllerSnapshot {
    const host = this.#host;
    if (host && checkpointable(reason) && host.snapshot) {
      try {
        const hostCheckpoint = host.snapshot();
        if (hostCheckpoint.session) {
          this.#checkpoint = {
            version: 1,
            host: hostCheckpoint,
            actionsDispatched: this.#actionsDispatched,
            sessionOrdinal: this.#sessionOrdinal,
          };
        }
      } catch (error) {
        this.#checkpoint = null;
        this.#onCheckpointRejected?.(error, {
          version: 1,
          host: { version: 1, common: { version: 1, campaign: { version: 1, ownerIds: [], caller: { version: 1, ownerIds: [], routedEventKeys: [] }, pending: [], settled: [] }, participants: [] }, session: null },
          actionsDispatched: this.#actionsDispatched,
          sessionOrdinal: this.#sessionOrdinal,
        });
      }
    } else if (!checkpointable(reason)) {
      this.#checkpoint = null;
    }
    this.#disposeHost();
    this.#requestedStop = null;
    this.#phase = reason === 'error' ? 'error' : reason === 'disposed' ? 'disposed' : 'stopped';
    this.#stopReason = reason;
    this.#emit();
    return this.snapshot();
  }

  #disposeHost(): void {
    const host = this.#host;
    this.#host = null;
    host?.dispose();
  }

  #emit(): void {
    this.#onStateChange?.(this.snapshot());
  }
}
`;
await writeFile('src/runtime/v6-browser-agent-controller.ts', controller);
console.log('replaced src/runtime/v6-browser-agent-controller.ts');

const tests = `import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductReadinessState } from '../src/agent-product-dispatch.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import {
  BrowserAgentController,
  type BrowserAgentControllerPorts,
} from '../src/runtime/v6-browser-agent-controller.ts';
import {
  createPublicSingleActionBrowserCampaignHost,
} from '../src/runtime/v6-browser-common-campaign-host.ts';

function observation(
  availableActionIds: number[] = [1],
  overrides: Partial<GameObservation> = {},
): GameObservation {
  return {
    gameCode: 'TEST',
    frame: Array.from({ length: 64 }, () => Array(64).fill(3)),
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds,
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 1,
    levelsCompleted: 0,
    defaultFps: 5,
    ...overrides,
  };
}

function productState(current: GameObservation, busy = false): ProductReadinessState {
  return {
    observation: current,
    selectedGameCode: current.gameCode,
    busy,
    loading: false,
    failed: false,
  };
}

function portsHarness(
  initial: GameObservation,
  action: (id: number, data?: { x: number; y: number }) => Promise<GameObservation>,
  onYield?: () => void,
): { ports: BrowserAgentControllerPorts; current(): GameObservation; actions(): number } {
  let current = initial;
  let busy = false;
  let actions = 0;
  let now = 0;
  return {
    current: () => current,
    actions: () => actions,
    ports: {
      readState: () => productState(current, busy),
      action: async (id, data) => {
        actions += 1;
        return action(id, data);
      },
      present: async next => { current = next; },
      now: () => now++,
      generation: () => 1,
      setBusy: value => { busy = value; },
      yieldToBrowser: async () => { onYield?.(); },
    },
  };
}

test('host resumes a dispatched pending return without replaying the physical action', async () => {
  const initial = observation([1]);
  const returned = observation([1, 2], {
    frame: Array.from({ length: 64 }, (_, y) =>
      Array.from({ length: 64 }, (_, x) => x === 2 && y === 3 ? 8 : 3),
    ),
  });
  const original = createPublicSingleActionBrowserCampaignHost();
  original.begin({ sessionId: 'resume-pending', observation: initial });

  let resolveReturn!: (value: GameObservation) => void;
  let markDispatched!: () => void;
  const dispatched = new Promise<void>(resolve => { markDispatched = resolve; });
  const pendingReturn = new Promise<GameObservation>(resolve => { resolveReturn = resolve; });
  const originalRun = original.run(productState(initial), {
    action: async () => {
      markDispatched();
      return pendingReturn;
    },
    present: async () => {},
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 1,
    setBusy: () => {},
  });
  await dispatched;
  const checkpoint = original.snapshot();
  const needId = checkpoint.session?.pendingReturn?.preparation.needId;
  assert.ok(needId);

  resolveReturn(returned);
  await originalRun;

  const restored = createPublicSingleActionBrowserCampaignHost();
  restored.restore(checkpoint, returned);
  let replayed = 0;
  const resumed = await restored.run(productState(returned), {
    action: async () => {
      replayed += 1;
      return returned;
    },
    present: async () => { throw new Error('already-live return must not be presented again'); },
    now: () => 0,
    generation: () => 1,
    setBusy: () => {},
  });

  assert.equal(resumed.status, 'resumed');
  assert.equal(resumed.acquisition?.needId, needId);
  assert.equal(resumed.acquisition?.routed, true);
  assert.equal(replayed, 0);
  assert.equal(restored.currentAgentObservation?.sequence, 1);
  assert.equal(restored.currentGameObservation, returned);
});

test('restored pending return remains pending while the live observation has not advanced', async () => {
  const initial = observation([1]);
  const original = createPublicSingleActionBrowserCampaignHost();
  original.begin({ sessionId: 'resume-wait', observation: initial });

  let resolveReturn!: (value: GameObservation) => void;
  let markDispatched!: () => void;
  const dispatched = new Promise<void>(resolve => { markDispatched = resolve; });
  const pendingReturn = new Promise<GameObservation>(resolve => { resolveReturn = resolve; });
  const originalRun = original.run(productState(initial), {
    action: async () => {
      markDispatched();
      return pendingReturn;
    },
    present: async () => {},
    now: (() => { let value = 0; return () => value++; })(),
    generation: () => 1,
    setBusy: () => {},
  });
  await dispatched;
  const checkpoint = original.snapshot();

  const restored = createPublicSingleActionBrowserCampaignHost();
  restored.restore(checkpoint, initial);
  let replayed = 0;
  const waiting = await restored.run(productState(initial), {
    action: async () => {
      replayed += 1;
      return initial;
    },
    present: async () => {},
    now: () => 0,
    generation: () => 1,
    setBusy: () => {},
  });
  assert.equal(waiting.status, 'pending');
  assert.equal(replayed, 0);

  resolveReturn(observation([1, 2]));
  await originalRun;
});

test('controller recreates a fresh host and restores the same settled campaign session', async () => {
  const initial = observation([1]);
  const returned = observation([1, 2]);
  const hosts: ReturnType<typeof createPublicSingleActionBrowserCampaignHost>[] = [];
  const harness = portsHarness(initial, async () => returned);
  const controller = new BrowserAgentController({
    createHost: () => {
      const host = createPublicSingleActionBrowserCampaignHost();
      hosts.push(host);
      return host;
    },
    makeSessionId: () => 'controller-resume-session',
  });

  const first = await controller.activate(initial, harness.ports);
  assert.equal(first.stopReason, 'none');
  assert.equal(first.actionsDispatched, 1);
  assert.equal(harness.actions(), 1);
  assert.equal(hosts.length, 1);
  const checkpoint = controller.retainedCheckpoint();
  assert.equal(checkpoint?.host.session?.sessionId, 'controller-resume-session');

  const second = await controller.activate(returned, harness.ports);
  assert.equal(second.stopReason, 'none');
  assert.equal(second.sessionId, 'controller-resume-session');
  assert.equal(second.actionsDispatched, 1);
  assert.equal(harness.actions(), 1);
  assert.equal(hosts.length, 2);
});

test('controller rejects a stale checkpoint and starts a new session from the live observation', async () => {
  const initial = observation([1]);
  const returned = observation([1, 2]);
  const changed = observation([2], {
    frame: Array.from({ length: 64 }, (_, y) =>
      Array.from({ length: 64 }, (_, x) => x === 1 && y === 1 ? 9 : 3),
    ),
  });
  const rejected: unknown[] = [];
  let sessionOrdinal = 0;
  const firstHarness = portsHarness(initial, async () => returned);
  const controller = new BrowserAgentController({
    createHost: () => createPublicSingleActionBrowserCampaignHost(),
    makeSessionId: (_observation, ordinal) => {
      sessionOrdinal = ordinal;
      return `fresh-session:${ordinal}`;
    },
    onCheckpointRejected: error => rejected.push(error),
  });

  await controller.activate(initial, firstHarness.ports);
  assert.ok(controller.retainedCheckpoint());

  const secondHarness = portsHarness(changed, async () => observation([2, 3]));
  const result = await controller.activate(changed, secondHarness.ports);
  assert.equal(rejected.length, 1);
  assert.equal(sessionOrdinal, 2);
  assert.equal(result.sessionId, 'fresh-session:2');
  assert.equal(secondHarness.actions(), 1);
});
`;
await writeFile('tests/v6-browser-session-resume.test.ts', tests);
console.log('created tests/v6-browser-session-resume.test.ts');
