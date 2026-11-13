import type { FieldStockDependencies } from '../logos-engine/field-stock.ts';
import {
  FieldStockCallerOwnerAdapter,
  FIELD_STOCK_CALLER_OWNER_ID,
  type FieldStockCampaignContext,
  type FieldStockCampaignReturnPayload,
} from '../logos-engine/v6-field-stock-caller-adapter.ts';
import {
  CommonCampaignOwner,
  type CampaignReturnReceipt,
  type CommonCampaignOwnerOptions,
} from '../logos-engine/v6-common-campaign-owner.ts';
import {
  PublicSingleActionCallerOwnerAdapter,
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
} from '../logos-engine/v6-public-single-action-caller-adapter.ts';
import type { AddressedKnowledgeStatus } from './observed-addressed-material-runtime.ts';
import { ObservedAddressedMaterialRuntime } from './observed-addressed-material-runtime.ts';
import {
  BrowserCommonCampaignHost,
  type BrowserCampaignObservationPair,
  type BrowserCampaignOwnerTransport,
  type BrowserCampaignReturnPair,
} from './v6-browser-common-campaign-host.ts';
import {
  completePublicCampaignEntities,
  measurePublicCampaignObservation,
  PUBLIC_FIELD_STOCK_DEPENDENCIES,
  type PublicCampaignObservation,
} from './v6-public-observation-measurement.ts';

export interface BrowserFieldStockTransportOptions {
  runtime: ObservedAddressedMaterialRuntime;
  remaining?: number;
  dependencies?: FieldStockDependencies;
}

export interface BrowserFieldStockCampaignHostOptions {
  runtime?: ObservedAddressedMaterialRuntime;
  remaining?: number;
  dependencies?: FieldStockDependencies;
  campaign?: CommonCampaignOwnerOptions;
  eventRef?(input: BrowserCampaignReturnPair): string;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer`);
  }
  return value;
}

/**
 * Browser transport for one retained FieldStock owner.
 *
 * The transport never creates addressed knowledge. It remains inert while the
 * runtime is empty. A retained prior is completed only from public 64x64 pixels,
 * then revalidated before a FieldStock context is exposed. An active stock from
 * another browser session is first demoted to a prior so that applicability can
 * never cross sessions without a fresh visible-scene check.
 */
export class BrowserFieldStockOwnerTransport implements BrowserCampaignOwnerTransport {
  readonly ownerId = FIELD_STOCK_CALLER_OWNER_ID;
  readonly runtime: ObservedAddressedMaterialRuntime;
  readonly remaining: number;
  readonly dependencies: FieldStockDependencies;

  #sessionId: string | null = null;
  #current: PublicCampaignObservation | null = null;
  #pendingAfter: PublicCampaignObservation | null = null;
  #lastBoundary: ReturnType<ObservedAddressedMaterialRuntime['boundary']> | null = null;
  #lastRevalidation: AddressedKnowledgeStatus | null = null;

  constructor(options: BrowserFieldStockTransportOptions) {
    this.runtime = options.runtime;
    this.remaining = positiveInteger(options.remaining ?? 16, 'browser FieldStock remaining budget');
    this.dependencies = options.dependencies ?? PUBLIC_FIELD_STOCK_DEPENDENCIES;
  }

  context(input: BrowserCampaignObservationPair): FieldStockCampaignContext | undefined {
    this.#bindSession(input);
    let status = this.runtime.status();

    // Empty or refuted knowledge cannot justify entity measurement or OP18.
    if (status === 'empty' || status === 'refuted') {
      this.#lastRevalidation = status;
      return undefined;
    }

    let measured = this.#measurement(input);

    // A stock supplied before this transport saw the current session is only a
    // prior. It must be reconstructed from the current public scene.
    if (!this.#current && status === 'revalidated_stock') {
      this.runtime.suspendStockForRevalidation(measured.observation.observation_ref);
      status = this.runtime.status();
    }

    if (this.#current && measured.agent.sequence > this.#current.agent.sequence) {
      this.#lastBoundary = this.runtime.boundary(
        this.#current.observation,
        measured.observation,
      );
      status = this.runtime.status();
    } else if (this.#current && measured.agent.sequence < this.#current.agent.sequence) {
      throw new Error('browser FieldStock observation sequence moved backwards');
    }

    if (status === 'retained_pending_revalidation') {
      measured = completePublicCampaignEntities(measured);
      status = this.runtime.revalidate(measured.observation, measured.rows);
    }
    this.#lastRevalidation = status;
    this.#current = measured;

    if (status !== 'revalidated_stock') return undefined;
    return {
      sessionId: input.sessionId,
      observation: measured.observation,
      rows: measured.rows,
      remaining: this.remaining,
      dependencies: this.dependencies,
    };
  }

  returnPayload(input: BrowserCampaignReturnPair): FieldStockCampaignReturnPayload {
    this.#assertSession(input.sessionId);
    const after = measurePublicCampaignObservation(input.afterAgentObservation);
    this.#pendingAfter = after;
    return {
      after: after.observation,
      rows: after.rows,
    };
  }

  /**
   * Run boundary retention only after FieldStock has consumed the selected
   * return. This preserves the required order:
   *
   * physical return -> afterStock/recordStock -> boundary -> optional revalidation.
   */
  afterAcquire(
    input: BrowserCampaignReturnPair,
    _receipt: CampaignReturnReceipt,
  ): void {
    this.#assertSession(input.sessionId);
    if (input.preparation.ownerId !== this.ownerId) {
      throw new Error('browser FieldStock afterAcquire received another owner return');
    }
    const before = this.#current;
    if (!before) {
      throw new Error('browser FieldStock selected return has no prior public observation');
    }
    let after = this.#pendingAfter;
    if (!after || after.agent.sequence !== input.afterAgentObservation.sequence) {
      after = measurePublicCampaignObservation(input.afterAgentObservation);
    }

    this.#lastBoundary = this.runtime.boundary(
      before.observation,
      after.observation,
    );
    let status = this.runtime.status();
    if (after.agent.state !== 'WIN' && status === 'retained_pending_revalidation') {
      after = completePublicCampaignEntities(after);
      status = this.runtime.revalidate(after.observation, after.rows);
    }
    this.#lastRevalidation = status;
    this.#current = after;
    this.#pendingAfter = null;
  }

  get current(): PublicCampaignObservation | null {
    return this.#current ? structuredClone(this.#current) : null;
  }

  get lastBoundary(): ReturnType<ObservedAddressedMaterialRuntime['boundary']> | null {
    return this.#lastBoundary ? structuredClone(this.#lastBoundary) : null;
  }

  get lastRevalidation(): AddressedKnowledgeStatus | null {
    return this.#lastRevalidation;
  }

  #bindSession(input: BrowserCampaignObservationPair): void {
    if (this.#sessionId === input.sessionId) return;
    this.#sessionId = input.sessionId;
    this.#current = null;
    this.#pendingAfter = null;
    this.#lastBoundary = null;
    this.#lastRevalidation = null;
  }

  #measurement(input: BrowserCampaignObservationPair): PublicCampaignObservation {
    if (this.#current?.agent.sequence === input.agentObservation.sequence) {
      return this.#current;
    }
    return measurePublicCampaignObservation(input.agentObservation);
  }

  #assertSession(sessionId: string): void {
    if (!this.#sessionId || this.#sessionId !== sessionId) {
      throw new Error('browser FieldStock return does not belong to the bound session');
    }
  }
}

/**
 * Build the bounded browser campaign with both qualified owners.
 *
 * FieldStock is inert without externally acquired knowledge. The OP28 fallback
 * remains available, and the neutral common campaign preserves ambiguity rather
 * than ranking the two owners.
 */
export function createPublicAndFieldStockBrowserCampaignHost(
  options: BrowserFieldStockCampaignHostOptions = {},
): BrowserCommonCampaignHost {
  const runtime = options.runtime ?? new ObservedAddressedMaterialRuntime();
  const fieldOwner = new FieldStockCallerOwnerAdapter(runtime);
  const publicOwner = new PublicSingleActionCallerOwnerAdapter();
  const campaign = new CommonCampaignOwner(
    [fieldOwner, publicOwner],
    options.campaign,
  );
  const fieldTransport = new BrowserFieldStockOwnerTransport({
    runtime,
    remaining: options.remaining,
    dependencies: options.dependencies,
  });

  return new BrowserCommonCampaignHost({
    campaign,
    eventRef: options.eventRef,
    ownerTransports: [
      fieldTransport,
      {
        ownerId: PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
        context: input => ({ observation: input.agentObservation }),
        returnPayload: input => ({ observation: input.afterAgentObservation }),
      },
    ],
  });
}
