import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function replaceRequired(content, before, after, label) {
  if (content.includes(after)) return content;
  if (!content.includes(before)) throw new Error(`Missing ${label}`);
  return content.replace(before, after);
}

function updateFile(filePath, transform) {
  const before = readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No changes produced for ${filePath}`);
  writeFileSync(filePath, after);
  console.log(`patched ${filePath}`);
}

updateFile('src/runtime/v6-browser-common-campaign-host.ts', source => {
  let content = source;
  content = replaceRequired(
    content,
    "import type { FieldStockDependencies } from '../logos-engine/field-stock.ts';\nimport {\n  CommonCampaignOwner,",
    "import type { FieldStockDependencies } from '../logos-engine/field-stock.ts';\nimport {\n  CommonCampaignCheckpointCoordinator,\n  type CommonCampaignCheckpointParticipant,\n  type CommonCampaignCheckpointV1,\n} from '../logos-engine/v6-common-campaign-checkpoint.ts';\nimport {\n  CommonCampaignOwner,",
    'campaign checkpoint import',
  );
  content = replaceRequired(
    content,
    "import { BrowserAgentObservationStream } from './v6-browser-agent-observation.ts';",
    "import {\n  BrowserAgentObservationStream,\n  toAgentObservationFromGame,\n} from './v6-browser-agent-observation.ts';",
    'browser observation import',
  );
  content = replaceRequired(
    content,
    "export interface BrowserCampaignHostOptions {\n  campaign: CommonCampaignOwner;\n  ownerTransports: readonly BrowserCampaignOwnerTransport[];\n  eventRef?(input: BrowserCampaignReturnPair): string;\n}",
    "export interface BrowserCampaignHostOptions {\n  campaign: CommonCampaignOwner;\n  ownerTransports: readonly BrowserCampaignOwnerTransport[];\n  checkpointParticipants?: readonly CommonCampaignCheckpointParticipant[];\n  eventRef?(input: BrowserCampaignReturnPair): string;\n}",
    'host checkpoint options',
  );
  content = replaceRequired(
    content,
    "export interface BrowserCampaignHostResult {\n  status: BrowserCampaignHostStatus;\n  reason?: 'product-not-ready' | 'stale-product-observation';\n  preparation: CampaignPrepareResult | null;\n  dispatch: DispatchResult | null;\n  acquisition: CampaignReturnReceipt | null;\n  returnedObservation: AgentObservation | null;\n}\n\ninterface ActiveBrowserCampaignSession {",
    `export interface BrowserCampaignHostResult {\n  status: BrowserCampaignHostStatus;\n  reason?: 'product-not-ready' | 'stale-product-observation';\n  preparation: CampaignPrepareResult | null;\n  dispatch: DispatchResult | null;\n  acquisition: CampaignReturnReceipt | null;\n  returnedObservation: AgentObservation | null;\n}\n\nexport interface BrowserCampaignPendingPhysicalReturnV1 {\n  preparation: BrowserCampaignActionPreparation;\n  beforeGameObservation: GameObservation;\n  beforeAgentObservation: AgentObservation;\n}\n\nexport interface BrowserCampaignHostCheckpointV1 {\n  version: 1;\n  sessionId: string;\n  gameCode: string;\n  nextSequence: number;\n  currentGameObservation: GameObservation;\n  currentAgentObservation: AgentObservation;\n  campaign: CommonCampaignCheckpointV1;\n  pendingPhysicalReturn: BrowserCampaignPendingPhysicalReturnV1 | null;\n}\n\nexport type BrowserCampaignHostRestoreStatus =\n  | 'restored'\n  | 'pending-return-waiting'\n  | 'pending-return-acquired';\n\nexport interface BrowserCampaignHostRestoreResult {\n  status: BrowserCampaignHostRestoreStatus;\n  sessionId: string;\n  acquisition: CampaignReturnReceipt | null;\n  returnedObservation: AgentObservation;\n}\n\ninterface ActiveBrowserCampaignSession {`,
    'host checkpoint public types',
  );
  content = replaceRequired(
    content,
    "interface ActiveBrowserCampaignSession {\n  sessionId: string;\n  stream: BrowserAgentObservationStream;\n  gameObservation: GameObservation;\n  agentObservation: AgentObservation;\n}\n",
    `interface ActiveBrowserCampaignSession {\n  sessionId: string;\n  stream: BrowserAgentObservationStream;\n  gameObservation: GameObservation;\n  agentObservation: AgentObservation;\n}\n\ninterface ActivePhysicalReturn extends BrowserCampaignPendingPhysicalReturnV1 {\n  sent: boolean;\n}\n`,
    'active physical return type',
  );
  content = replaceRequired(
    content,
    "function cloneAgentObservation(observation: AgentObservation): AgentObservation {\n  return {\n    ...observation,\n    image: {\n      ...observation.image,\n      pixels: observation.image.pixels.slice(),\n    },\n    availableActionIds: [...observation.availableActionIds],\n  };\n}\n",
    `function cloneAgentObservation(observation: AgentObservation): AgentObservation {\n  return {\n    ...observation,\n    image: {\n      ...observation.image,\n      pixels: observation.image.pixels.slice(),\n    },\n    availableActionIds: [...observation.availableActionIds],\n  };\n}\n\nfunction cloneGameObservation(observation: GameObservation): GameObservation {\n  return structuredClone(observation);\n}\n\nfunction objectValue(value: unknown, label: string): Record<string, unknown> {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) {\n    throw new TypeError(\`${'${label}'} must be an object\`);\n  }\n  return value as Record<string, unknown>;\n}\n\nfunction sameNumbers(left: readonly number[], right: readonly number[]): boolean {\n  return left.length === right.length && left.every((value, index) => value === right[index]);\n}\n\nfunction sameAgentObservation(left: AgentObservation, right: AgentObservation): boolean {\n  return left.protocolVersion === right.protocolVersion\n    && left.sessionId === right.sessionId\n    && left.sequence === right.sequence\n    && left.image.width === right.image.width\n    && left.image.height === right.image.height\n    && left.image.pixelFormat === right.image.pixelFormat\n    && sameNumbers(left.image.pixels, right.image.pixels)\n    && sameNumbers(left.availableActionIds, right.availableActionIds)\n    && left.state === right.state\n    && left.level === right.level\n    && left.levelsCompleted === right.levelsCompleted;\n}\n\nfunction sameAction(left: unknown, right: unknown): boolean {\n  return JSON.stringify(left) === JSON.stringify(right);\n}\n\nfunction browserCampaignCheckpoint(value: unknown): BrowserCampaignHostCheckpointV1 {\n  const source = objectValue(value, 'browser campaign checkpoint');\n  if (source.version !== 1) throw new TypeError('unsupported browser campaign checkpoint version');\n  nonEmpty(source.sessionId as string, 'browser campaign checkpoint session id');\n  nonEmpty(source.gameCode as string, 'browser campaign checkpoint game code');\n  if (!Number.isInteger(source.nextSequence) || (source.nextSequence as number) < 0) {\n    throw new RangeError('browser campaign checkpoint next sequence must be non-negative');\n  }\n  objectValue(source.currentGameObservation, 'browser campaign checkpoint game observation');\n  const currentAgent = objectValue(\n    source.currentAgentObservation,\n    'browser campaign checkpoint agent observation',\n  );\n  objectValue(currentAgent.image, 'browser campaign checkpoint agent image');\n  objectValue(source.campaign, 'browser campaign checkpoint campaign state');\n  if (source.pendingPhysicalReturn !== null) {\n    const pending = objectValue(\n      source.pendingPhysicalReturn,\n      'browser campaign checkpoint pending physical return',\n    );\n    const preparation = objectValue(pending.preparation, 'browser pending preparation');\n    if (preparation.status !== 'action') {\n      throw new TypeError('browser pending preparation must be an action');\n    }\n    objectValue(pending.beforeGameObservation, 'browser pending game observation');\n    objectValue(pending.beforeAgentObservation, 'browser pending agent observation');\n  }\n  return structuredClone(source) as unknown as BrowserCampaignHostCheckpointV1;\n}\n`,
    'checkpoint helper functions',
  );
  content = replaceRequired(
    content,
    "export class BrowserCommonCampaignHost {\n  readonly #campaign: CommonCampaignOwner;\n  readonly #transports = new Map<string, BrowserCampaignOwnerTransport>();\n  readonly #eventRef: (input: BrowserCampaignReturnPair) => string;\n  #active: ActiveBrowserCampaignSession | null = null;",
    "export class BrowserCommonCampaignHost {\n  readonly #campaign: CommonCampaignOwner;\n  readonly #checkpoint: CommonCampaignCheckpointCoordinator;\n  readonly #transports = new Map<string, BrowserCampaignOwnerTransport>();\n  readonly #eventRef: (input: BrowserCampaignReturnPair) => string;\n  #active: ActiveBrowserCampaignSession | null = null;\n  #pendingPhysicalReturn: ActivePhysicalReturn | null = null;",
    'host checkpoint fields',
  );
  content = replaceRequired(
    content,
    "    this.#campaign = options.campaign;\n    this.#eventRef = options.eventRef ?? defaultEventRef;",
    "    this.#campaign = options.campaign;\n    this.#checkpoint = new CommonCampaignCheckpointCoordinator(\n      this.#campaign,\n      options.checkpointParticipants ?? [],\n    );\n    this.#eventRef = options.eventRef ?? defaultEventRef;",
    'checkpoint coordinator construction',
  );
  content = replaceRequired(
    content,
    "    nonEmpty(input.sessionId, 'browser campaign session id');\n    if (this.#active) this.#campaign.cancel(this.#active.sessionId);\n\n    const stream = new BrowserAgentObservationStream({",
    "    nonEmpty(input.sessionId, 'browser campaign session id');\n    if (this.#active) this.#campaign.cancel(this.#active.sessionId);\n    this.#pendingPhysicalReturn = null;\n\n    const stream = new BrowserAgentObservationStream({",
    'begin clears pending physical return',
  );
  content = replaceRequired(
    content,
    "    let acquisition: CampaignReturnReceipt | null = null;\n    let returnedObservation: AgentObservation | null = null;\n    let returnCommitted = false;",
    `    const pendingPhysicalReturn: ActivePhysicalReturn = {\n      preparation: structuredClone(preparation),\n      beforeGameObservation: cloneGameObservation(active.gameObservation),\n      beforeAgentObservation: cloneAgentObservation(active.agentObservation),\n      sent: false,\n    };\n    this.#pendingPhysicalReturn = pendingPhysicalReturn;\n\n    let acquisition: CampaignReturnReceipt | null = null;\n    let returnedObservation: AgentObservation | null = null;\n    let returnCommitted = false;`,
    'pending physical return creation',
  );
  content = replaceRequired(
    content,
    "          action: (action, data) => ports.action(action, data),",
    `          action: (action, data) => {\n            if (this.#active !== active || this.#pendingPhysicalReturn !== pendingPhysicalReturn) {\n              throw new Error('browser campaign action lost active ownership before dispatch');\n            }\n            pendingPhysicalReturn.sent = true;\n            return ports.action(action, data);\n          },`,
    'dispatch ownership wrapper',
  );
  content = replaceRequired(
    content,
    "            active.gameObservation = next;\n            active.agentObservation = converted;\n            returnedObservation = cloneAgentObservation(converted);\n            returnCommitted = true;",
    "            active.gameObservation = next;\n            active.agentObservation = converted;\n            returnedObservation = cloneAgentObservation(converted);\n            returnCommitted = true;\n            if (this.#pendingPhysicalReturn === pendingPhysicalReturn) {\n              this.#pendingPhysicalReturn = null;\n            }",
    'clear physical return after acquisition',
  );
  content = replaceRequired(
    content,
    "      if (!dispatch.accepted && !returnCommitted) {\n        this.#campaign.cancel(active.sessionId);\n      }",
    "      if (!dispatch.accepted && !returnCommitted) {\n        this.#campaign.cancel(active.sessionId);\n        if (this.#pendingPhysicalReturn === pendingPhysicalReturn) {\n          this.#pendingPhysicalReturn = null;\n        }\n      }",
    'clear physical return after rejected dispatch',
  );
  content = replaceRequired(
    content,
    "    } catch (error) {\n      if (!returnCommitted) this.#campaign.cancel(active.sessionId);\n      throw error;\n    }\n  }\n\n  cancel(): boolean {",
    `    } catch (error) {\n      if (!returnCommitted) this.#campaign.cancel(active.sessionId);\n      if (this.#pendingPhysicalReturn === pendingPhysicalReturn) {\n        this.#pendingPhysicalReturn = null;\n      }\n      throw error;\n    }\n  }\n\n  snapshot(): BrowserCampaignHostCheckpointV1 {\n    const active = this.#active;\n    if (!active) throw new Error('browser campaign host has no active session to checkpoint');\n\n    const pendingCampaign = this.#campaign.pending(active.sessionId);\n    const pendingPhysical = this.#pendingPhysicalReturn;\n    if (pendingPhysical && !pendingPhysical.sent) {\n      throw new Error('browser campaign cannot checkpoint before the physical action is sent');\n    }\n    if (Boolean(pendingCampaign) !== Boolean(pendingPhysical)) {\n      throw new Error('browser campaign pending decision and physical return are inconsistent');\n    }\n    if (pendingCampaign && pendingPhysical) {\n      if (pendingCampaign.needId !== pendingPhysical.preparation.needId\n        || pendingCampaign.ownerId !== pendingPhysical.preparation.ownerId\n        || pendingCampaign.proposalRef !== pendingPhysical.preparation.proposalRef\n        || !sameAction(pendingCampaign.action, pendingPhysical.preparation.action)) {\n        throw new Error('browser campaign pending physical identity changed');\n      }\n    }\n\n    return {\n      version: 1,\n      sessionId: active.sessionId,\n      gameCode: active.gameObservation.gameCode,\n      nextSequence: active.stream.nextSequence,\n      currentGameObservation: cloneGameObservation(active.gameObservation),\n      currentAgentObservation: cloneAgentObservation(active.agentObservation),\n      campaign: this.#checkpoint.snapshot(),\n      pendingPhysicalReturn: pendingPhysical\n        ? {\n            preparation: structuredClone(pendingPhysical.preparation),\n            beforeGameObservation: cloneGameObservation(pendingPhysical.beforeGameObservation),\n            beforeAgentObservation: cloneAgentObservation(pendingPhysical.beforeAgentObservation),\n          }\n        : null,\n    };\n  }\n\n  restore(\n    value: unknown,\n    observation: GameObservation,\n  ): BrowserCampaignHostRestoreResult {\n    if (this.#active) throw new Error('browser campaign restore requires a fresh host');\n    const checkpoint = browserCampaignCheckpoint(value);\n    if (observation.gameCode !== checkpoint.gameCode) {\n      throw new Error('browser campaign checkpoint belongs to another game');\n    }\n    if (checkpoint.currentAgentObservation.sessionId !== checkpoint.sessionId) {\n      throw new Error('browser campaign checkpoint agent observation belongs to another session');\n    }\n    if (checkpoint.nextSequence !== checkpoint.currentAgentObservation.sequence + 1) {\n      throw new Error('browser campaign checkpoint sequence is not contiguous');\n    }\n\n    const storedFromGame = toAgentObservationFromGame(\n      checkpoint.currentGameObservation,\n      checkpoint.sessionId,\n      checkpoint.currentAgentObservation.sequence,\n    );\n    if (!sameAgentObservation(storedFromGame, checkpoint.currentAgentObservation)) {\n      throw new Error('browser campaign checkpoint observation identity is inconsistent');\n    }\n\n    const pendingPhysical = checkpoint.pendingPhysicalReturn;\n    if (pendingPhysical) {\n      if (!sameAgentObservation(\n        pendingPhysical.beforeAgentObservation,\n        checkpoint.currentAgentObservation,\n      )) {\n        throw new Error('browser pending return does not start from the checkpoint observation');\n      }\n      const pendingFromGame = toAgentObservationFromGame(\n        pendingPhysical.beforeGameObservation,\n        checkpoint.sessionId,\n        checkpoint.currentAgentObservation.sequence,\n      );\n      if (!sameAgentObservation(pendingFromGame, checkpoint.currentAgentObservation)) {\n        throw new Error('browser pending return game observation is inconsistent');\n      }\n    }\n\n    const liveAtStoredSequence = toAgentObservationFromGame(\n      observation,\n      checkpoint.sessionId,\n      checkpoint.currentAgentObservation.sequence,\n    );\n    const unchanged = sameAgentObservation(\n      liveAtStoredSequence,\n      checkpoint.currentAgentObservation,\n    );\n    if (!pendingPhysical && !unchanged) {\n      throw new Error('browser campaign checkpoint does not match the current public observation');\n    }\n\n    const before = this.#checkpoint.snapshot();\n    try {\n      this.#checkpoint.restore(checkpoint.campaign);\n      const stream = new BrowserAgentObservationStream({\n        sessionId: checkpoint.sessionId,\n        gameCode: checkpoint.gameCode,\n        initialSequence: checkpoint.nextSequence,\n      });\n      this.#active = {\n        sessionId: checkpoint.sessionId,\n        stream,\n        gameObservation: unchanged\n          ? observation\n          : cloneGameObservation(pendingPhysical!.beforeGameObservation),\n        agentObservation: cloneAgentObservation(checkpoint.currentAgentObservation),\n      };\n\n      const restoredPending = this.#campaign.pending(checkpoint.sessionId);\n      if (Boolean(restoredPending) !== Boolean(pendingPhysical)) {\n        throw new Error('restored browser campaign pending state is inconsistent');\n      }\n      if (restoredPending && pendingPhysical) {\n        if (restoredPending.needId !== pendingPhysical.preparation.needId\n          || restoredPending.ownerId !== pendingPhysical.preparation.ownerId\n          || restoredPending.proposalRef !== pendingPhysical.preparation.proposalRef\n          || !sameAction(restoredPending.action, pendingPhysical.preparation.action)) {\n          throw new Error('restored browser campaign pending identity changed');\n        }\n      }\n\n      if (!pendingPhysical) {\n        return {\n          status: 'restored',\n          sessionId: checkpoint.sessionId,\n          acquisition: null,\n          returnedObservation: cloneAgentObservation(checkpoint.currentAgentObservation),\n        };\n      }\n\n      if (unchanged) {\n        this.#pendingPhysicalReturn = {\n          preparation: structuredClone(pendingPhysical.preparation),\n          beforeGameObservation: cloneGameObservation(pendingPhysical.beforeGameObservation),\n          beforeAgentObservation: cloneAgentObservation(pendingPhysical.beforeAgentObservation),\n          sent: true,\n        };\n        return {\n          status: 'pending-return-waiting',\n          sessionId: checkpoint.sessionId,\n          acquisition: null,\n          returnedObservation: cloneAgentObservation(checkpoint.currentAgentObservation),\n        };\n      }\n\n      const transport = this.#transports.get(pendingPhysical.preparation.ownerId);\n      if (!transport) {\n        throw new Error(\`selected campaign owner ${'${pendingPhysical.preparation.ownerId}'} has no browser transport\`);\n      }\n      const converted = stream.next(observation);\n      const returnPair: BrowserCampaignReturnPair = {\n        sessionId: checkpoint.sessionId,\n        preparation: pendingPhysical.preparation,\n        beforeGameObservation: pendingPhysical.beforeGameObservation,\n        beforeAgentObservation: pendingPhysical.beforeAgentObservation,\n        afterGameObservation: observation,\n        afterAgentObservation: converted,\n      };\n      const eventRef = this.#eventRef(returnPair);\n      nonEmpty(eventRef, 'browser campaign restored return event reference');\n      const acquisition = this.#campaign.acquire({\n        sessionId: checkpoint.sessionId,\n        needId: pendingPhysical.preparation.needId,\n        eventRef,\n        payload: transport.returnPayload(returnPair),\n      });\n      this.#pendingPhysicalReturn = null;\n      this.#active.gameObservation = observation;\n      this.#active.agentObservation = converted;\n      for (const observer of this.#transports.values()) {\n        observer.observeAcquiredReturn?.(returnPair, acquisition);\n      }\n      return {\n        status: 'pending-return-acquired',\n        sessionId: checkpoint.sessionId,\n        acquisition,\n        returnedObservation: cloneAgentObservation(converted),\n      };\n    } catch (error) {\n      this.#active = null;\n      this.#pendingPhysicalReturn = null;\n      this.#checkpoint.restore(before);\n      throw error;\n    }\n  }\n\n  cancel(): boolean {`,
    'host snapshot and restore methods',
  );
  content = replaceRequired(
    content,
    "  cancel(): boolean {\n    const active = this.#active;\n    if (!active) return false;\n    return this.#campaign.cancel(active.sessionId);\n  }",
    "  cancel(): boolean {\n    const active = this.#active;\n    if (!active) return false;\n    this.#pendingPhysicalReturn = null;\n    return this.#campaign.cancel(active.sessionId);\n  }",
    'cancel clears pending physical state',
  );
  return content;
});

updateFile('src/runtime/v6-browser-product-campaign-host.ts', source => {
  let content = source;
  content = replaceRequired(
    content,
    "import { ObservedAddressedMaterialRuntime } from './observed-addressed-material-runtime.ts';",
    "import { ObservedAddressedMaterialCheckpointParticipant } from './observed-addressed-material-checkpoint.ts';\nimport { ObservedAddressedMaterialRuntime } from './observed-addressed-material-runtime.ts';",
    'FieldStock checkpoint participant import',
  );
  content = replaceRequired(
    content,
    "  return new BrowserCommonCampaignHost({\n    campaign,\n    eventRef: options.eventRef,",
    "  return new BrowserCommonCampaignHost({\n    campaign,\n    checkpointParticipants: [new ObservedAddressedMaterialCheckpointParticipant(runtime)],\n    eventRef: options.eventRef,",
    'product host checkpoint participant wiring',
  );
  return content;
});

updateFile('src/runtime/v6-browser-agent-controller.ts', source => {
  let content = source;
  content = replaceRequired(
    content,
    "  BrowserCampaignDispatchPorts,\n  BrowserCampaignHostResult,\n  BrowserCommonCampaignHost,",
    "  BrowserCampaignDispatchPorts,\n  BrowserCampaignHostCheckpointV1,\n  BrowserCampaignHostRestoreResult,\n  BrowserCampaignHostResult,\n  BrowserCommonCampaignHost,",
    'controller checkpoint type imports',
  );
  content = replaceRequired(
    content,
    "export type BrowserAgentCampaignHost = Pick<\n  BrowserCommonCampaignHost,\n  'begin' | 'run' | 'cancel' | 'dispose' | 'currentGameObservation'\n>;",
    "export type BrowserAgentCampaignHost = Pick<\n  BrowserCommonCampaignHost,\n  | 'begin'\n  | 'run'\n  | 'cancel'\n  | 'dispose'\n  | 'snapshot'\n  | 'restore'\n  | 'currentGameObservation'\n>;\n\ninterface BrowserAgentControllerCheckpointV1 {\n  version: 1;\n  gameCode: string;\n  actionsDispatched: number;\n  host: BrowserCampaignHostCheckpointV1;\n}",
    'controller host checkpoint surface',
  );
  content = replaceRequired(
    content,
    "function stopPriority(reason: BrowserAgentControllerStopReason): number {\n  if (reason === 'disposed') return 3;\n  if (reason === 'replaced') return 2;\n  if (reason === 'manual') return 1;\n  return 0;\n}",
    "function stopPriority(reason: BrowserAgentControllerStopReason): number {\n  if (reason === 'disposed') return 3;\n  if (reason === 'replaced') return 2;\n  if (reason === 'manual') return 1;\n  return 0;\n}\n\nfunction resumableStop(reason: BrowserAgentControllerStopReason): boolean {\n  return ['manual', 'none', 'ambiguous', 'pending', 'blocked'].includes(reason);\n}",
    'resumable stop helper',
  );
  content = replaceRequired(
    content,
    "  #runPromise: Promise<BrowserAgentControllerSnapshot> | null = null;\n  #disposed = false;",
    "  #runPromise: Promise<BrowserAgentControllerSnapshot> | null = null;\n  #checkpoint: BrowserAgentControllerCheckpointV1 | null = null;\n  #disposed = false;",
    'controller checkpoint field',
  );
  content = replaceRequired(
    content,
    "    if (terminal(observation)) {\n      this.#phase = 'stopped';",
    "    if (terminal(observation)) {\n      this.#checkpoint = null;\n      this.#phase = 'stopped';",
    'terminal invalidates checkpoint',
  );
  content = replaceRequired(
    content,
    "    if (liveState.observation !== observation\n      || liveState.selectedGameCode !== observation.gameCode\n      || liveState.busy\n      || liveState.loading\n      || liveState.failed) {\n      this.#phase = 'stopped';",
    "    if (liveState.observation !== observation\n      || liveState.selectedGameCode !== observation.gameCode\n      || liveState.busy\n      || liveState.loading\n      || liveState.failed) {\n      this.#checkpoint = null;\n      this.#phase = 'stopped';",
    'invalid activation clears checkpoint',
  );
  content = replaceRequired(
    content,
    `    const ordinal = ++this.#sessionOrdinal;\n    const sessionId = this.#makeSessionId(observation, ordinal);\n    if (!sessionId) throw new TypeError('browser agent session id must be non-empty');\n\n    const host = this.#createHost();\n    host.begin({ sessionId, observation });\n    this.#host = host;\n    this.#sessionId = sessionId;\n    this.#stopReason = null;\n    this.#requestedStop = null;\n    this.#campaignStatus = null;\n    this.#actionsDispatched = 0;\n    this.#phase = 'running';\n    this.#emit();`,
    `    const host = this.#createHost();\n    let sessionId: string;\n    let actionsDispatched = 0;\n    let restoreResult: BrowserCampaignHostRestoreResult | null = null;\n    const checkpoint = this.#checkpoint;\n    if (checkpoint && checkpoint.gameCode === observation.gameCode) {\n      try {\n        restoreResult = host.restore(checkpoint.host, observation);\n        sessionId = restoreResult.sessionId;\n        actionsDispatched = checkpoint.actionsDispatched;\n      } catch {\n        this.#checkpoint = null;\n        const ordinal = ++this.#sessionOrdinal;\n        sessionId = this.#makeSessionId(observation, ordinal);\n        if (!sessionId) throw new TypeError('browser agent session id must be non-empty');\n        host.begin({ sessionId, observation });\n      }\n    } else {\n      this.#checkpoint = null;\n      const ordinal = ++this.#sessionOrdinal;\n      sessionId = this.#makeSessionId(observation, ordinal);\n      if (!sessionId) throw new TypeError('browser agent session id must be non-empty');\n      host.begin({ sessionId, observation });\n    }\n\n    this.#checkpoint = null;\n    this.#host = host;\n    this.#sessionId = sessionId;\n    this.#stopReason = null;\n    this.#requestedStop = null;\n    this.#campaignStatus = null;\n    this.#actionsDispatched = actionsDispatched;\n    this.#phase = 'running';\n    this.#emit();\n    if (restoreResult?.acquisition) {\n      ports.onCampaignAcquired?.(\n        restoreResult.acquisition,\n        restoreResult.returnedObservation,\n      );\n    }`,
    'controller restore before fresh begin',
  );
  content = replaceRequired(
    content,
    "    if (!this.#runPromise) {\n      this.#disposeHost();\n      this.#phase = 'stopped';\n      this.#stopReason = reason;",
    "    if (!this.#runPromise) {\n      if (reason === 'replaced') this.#checkpoint = null;\n      this.#disposeHost();\n      this.#phase = 'stopped';\n      this.#stopReason = reason;",
    'idle replacement clears checkpoint',
  );
  content = replaceRequired(
    content,
    "    this.#disposed = true;\n    this.#requestedStop = 'disposed';",
    "    this.#disposed = true;\n    this.#checkpoint = null;\n    this.#requestedStop = 'disposed';",
    'dispose clears checkpoint',
  );
  content = replaceRequired(
    content,
    "  #finish(reason: BrowserAgentControllerStopReason): BrowserAgentControllerSnapshot {\n    this.#disposeHost();\n    this.#requestedStop = null;",
    `  #finish(reason: BrowserAgentControllerStopReason): BrowserAgentControllerSnapshot {\n    const host = this.#host;\n    if (host && resumableStop(reason)) {\n      try {\n        const checkpoint = host.snapshot();\n        this.#checkpoint = {\n          version: 1,\n          gameCode: checkpoint.gameCode,\n          actionsDispatched: this.#actionsDispatched,\n          host: checkpoint,\n        };\n      } catch {\n        this.#checkpoint = null;\n      }\n    } else if (!resumableStop(reason)) {\n      this.#checkpoint = null;\n    }\n    this.#disposeHost();\n    this.#requestedStop = null;`,
    'capture controller checkpoint before dispose',
  );
  return content;
});

const testPath = 'tests/v6-browser-session-reactivation.test.ts';
mkdirSync(path.dirname(testPath), { recursive: true });
writeFileSync(testPath, `import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport type { ProductReadinessState } from '../src/agent-product-dispatch.ts';\nimport { OBSERVED_ADDRESSED_MATERIAL_CHECKPOINT_ID } from '../src/runtime/observed-addressed-material-checkpoint.ts';\nimport type { GameObservation } from '../src/runtime/browser-games.ts';\nimport {\n  BrowserAgentController,\n  type BrowserAgentControllerPorts,\n} from '../src/runtime/v6-browser-agent-controller.ts';\nimport {\n  createPublicSingleActionBrowserCampaignHost,\n} from '../src/runtime/v6-browser-common-campaign-host.ts';\nimport {\n  createFieldStockAndPublicSingleActionBrowserCampaignHost,\n} from '../src/runtime/v6-browser-product-campaign-host.ts';\n\nfunction observation(\n  availableActionIds: number[] = [1],\n  fill = 3,\n  overrides: Partial<GameObservation> = {},\n): GameObservation {\n  return {\n    gameCode: 'TEST',\n    frame: Array.from({ length: 64 }, () => Array(64).fill(fill)),\n    frames: [],\n    state: 'NOT_FINISHED',\n    availableActionIds,\n    canUndo: false,\n    canSelectLevel: false,\n    level: 1,\n    levelCount: 3,\n    levelsCompleted: 0,\n    defaultFps: 5,\n    ...overrides,\n  };\n}\n\nfunction productState(current: GameObservation, busy = false): ProductReadinessState {\n  return {\n    observation: current,\n    selectedGameCode: current.gameCode,\n    busy,\n    loading: false,\n    failed: false,\n  };\n}\n\nfunction hostPorts(\n  action: (action: number, data?: { x: number; y: number }) => Promise<GameObservation>,\n  present: (observation: GameObservation) => Promise<void> = async () => {},\n) {\n  let busy = false;\n  let clock = 0;\n  return {\n    action,\n    present: async (next: GameObservation) => present(next),\n    now: () => clock++,\n    generation: () => 1,\n    setBusy: (value: boolean) => { busy = value; },\n    busy: () => busy,\n  };\n}\n\ntest('settled browser checkpoint restores the same session and next observation sequence', async () => {\n  const initial = observation([1], 3);\n  const returned = observation([2], 4);\n  const final = observation([1, 2], 5);\n  const actions: number[] = [];\n  const first = createPublicSingleActionBrowserCampaignHost();\n  first.begin({ sessionId: 'settled-session', observation: initial });\n  await first.run(productState(initial), hostPorts(async action => {\n    actions.push(action);\n    return returned;\n  }));\n\n  const checkpoint = first.snapshot();\n  assert.equal(checkpoint.pendingPhysicalReturn, null);\n  assert.equal(checkpoint.currentAgentObservation.sequence, 1);\n  assert.equal(checkpoint.nextSequence, 2);\n\n  const restored = createPublicSingleActionBrowserCampaignHost();\n  const receipt = restored.restore(checkpoint, returned);\n  assert.equal(receipt.status, 'restored');\n  assert.equal(receipt.sessionId, 'settled-session');\n  const result = await restored.run(productState(returned), hostPorts(async action => {\n    actions.push(action);\n    return final;\n  }));\n\n  assert.equal(result.status, 'action');\n  assert.equal(result.returnedObservation?.sequence, 2);\n  assert.deepEqual(actions, [1, 2]);\n});\n\ntest('sent pending action is acquired from the live return without physical replay', async () => {\n  const initial = observation([1], 3);\n  const returned = observation([2], 4);\n  const final = observation([1, 2], 5);\n  let resolveOld!: (value: GameObservation) => void;\n  const oldReturn = new Promise<GameObservation>(resolve => { resolveOld = resolve; });\n  let oldPresentations = 0;\n  let firstActionCalls = 0;\n\n  const oldHost = createPublicSingleActionBrowserCampaignHost();\n  oldHost.begin({ sessionId: 'pending-session', observation: initial });\n  const oldRun = oldHost.run(productState(initial), hostPorts(async action => {\n    firstActionCalls += 1;\n    assert.equal(action, 1);\n    return oldReturn;\n  }, async () => { oldPresentations += 1; }));\n\n  const checkpoint = oldHost.snapshot();\n  assert.equal(firstActionCalls, 1);\n  assert.equal(checkpoint.pendingPhysicalReturn?.preparation.action.id, 1);\n  oldHost.dispose();\n\n  const freshHost = createPublicSingleActionBrowserCampaignHost();\n  const restored = freshHost.restore(checkpoint, returned);\n  assert.equal(restored.status, 'pending-return-acquired');\n  assert.equal(\n    restored.acquisition?.needId,\n    checkpoint.pendingPhysicalReturn?.preparation.needId,\n  );\n  assert.equal(restored.returnedObservation.sequence, 1);\n\n  const newActions: number[] = [];\n  const next = await freshHost.run(productState(returned), hostPorts(async action => {\n    newActions.push(action);\n    return final;\n  }));\n  assert.equal(next.status, 'action');\n  assert.deepEqual(newActions, [2]);\n\n  resolveOld(returned);\n  const oldResult = await oldRun;\n  assert.equal(oldResult.dispatch?.stale, true);\n  assert.equal(oldResult.acquisition, null);\n  assert.equal(oldPresentations, 0);\n  assert.equal(firstActionCalls, 1);\n});\n\ntest('settled checkpoint rejects a different current public observation', () => {\n  const initial = observation([1], 3);\n  const host = createPublicSingleActionBrowserCampaignHost();\n  host.begin({ sessionId: 'stale-checkpoint', observation: initial });\n  const checkpoint = host.snapshot();\n  const fresh = createPublicSingleActionBrowserCampaignHost();\n  assert.throws(\n    () => fresh.restore(checkpoint, observation([2], 4)),\n    /does not match the current public observation/,\n  );\n});\n\ntest('product host checkpoint contains the explicit FieldStock participant', () => {\n  const initial = observation([1], 3);\n  const host = createFieldStockAndPublicSingleActionBrowserCampaignHost();\n  host.begin({ sessionId: 'product-checkpoint', observation: initial });\n  const checkpoint = host.snapshot();\n  assert.deepEqual(\n    checkpoint.campaign.participants.map(participant => participant.checkpointId),\n    [OBSERVED_ADDRESSED_MATERIAL_CHECKPOINT_ID],\n  );\n  const fresh = createFieldStockAndPublicSingleActionBrowserCampaignHost();\n  assert.equal(fresh.restore(checkpoint, initial).status, 'restored');\n});\n\ntest('controller reactivation restores a fresh host and continues the same bounded session', async () => {\n  const initial = observation([1], 3);\n  const second = observation([2], 4);\n  const final = observation([1, 2], 5);\n  let current = initial;\n  let busy = false;\n  let clock = 0;\n  let hostCreations = 0;\n  const actions: number[] = [];\n  let controller!: BrowserAgentController;\n  let requestedManual = false;\n  const ports: BrowserAgentControllerPorts = {\n    readState: () => productState(current, busy),\n    action: async action => {\n      actions.push(action);\n      return action === 1 ? second : final;\n    },\n    present: async next => { current = next; },\n    now: () => clock++,\n    generation: () => 1,\n    setBusy: value => { busy = value; },\n    yieldToBrowser: async () => {\n      if (!requestedManual) {\n        requestedManual = true;\n        controller.deactivate('manual');\n      }\n    },\n  };\n  controller = new BrowserAgentController({\n    createHost: () => {\n      hostCreations += 1;\n      return createPublicSingleActionBrowserCampaignHost();\n    },\n    makeSessionId: (_observation, ordinal) => \`reactivation:${'${ordinal}'}\`,\n  });\n\n  const first = await controller.activate(initial, ports);\n  assert.equal(first.stopReason, 'manual');\n  assert.equal(first.sessionId, 'reactivation:1');\n  assert.equal(first.actionsDispatched, 1);\n  assert.deepEqual(actions, [1]);\n\n  const resumed = await controller.activate(current, ports);\n  assert.equal(resumed.stopReason, 'none');\n  assert.equal(resumed.sessionId, 'reactivation:1');\n  assert.equal(resumed.actionsDispatched, 2);\n  assert.deepEqual(actions, [1, 2]);\n  assert.equal(hostCreations, 2);\n});\n\ntest('controller discards a stale checkpoint after a Manual action and starts a new session', async () => {\n  const initial = observation([1], 3);\n  const firstReturned = observation([1, 2], 4);\n  const manualObservation = observation([3], 6);\n  const final = observation([1, 2], 7);\n  let current = initial;\n  let busy = false;\n  let clock = 0;\n  const actions: number[] = [];\n  const ports: BrowserAgentControllerPorts = {\n    readState: () => productState(current, busy),\n    action: async action => {\n      actions.push(action);\n      return action === 1 ? firstReturned : final;\n    },\n    present: async next => { current = next; },\n    now: () => clock++,\n    generation: () => 1,\n    setBusy: value => { busy = value; },\n  };\n  const controller = new BrowserAgentController({\n    createHost: () => createPublicSingleActionBrowserCampaignHost(),\n    makeSessionId: (_observation, ordinal) => \`stale:${'${ordinal}'}\`,\n  });\n\n  const first = await controller.activate(initial, ports);\n  assert.equal(first.sessionId, 'stale:1');\n  assert.equal(first.stopReason, 'none');\n  current = manualObservation;\n\n  const restarted = await controller.activate(current, ports);\n  assert.equal(restarted.sessionId, 'stale:2');\n  assert.equal(restarted.stopReason, 'none');\n  assert.equal(restarted.actionsDispatched, 1);\n  assert.deepEqual(actions, [1, 3]);\n});\n`);
console.log(`created ${testPath}`);
