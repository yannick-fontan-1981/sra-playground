export interface CommonCallerProposal {
  ownerId: string;
  proposalRef: string;
  actionRef: string;
  payload?: unknown;
}

export interface CommonCallerAcquisition {
  eventRef: string;
  source: 'selected' | 'passive';
  payload: unknown;
}

export interface CommonCallerOwner {
  readonly id: string;
  propose(context: unknown): CommonCallerProposal | undefined;
  acquire(event: CommonCallerAcquisition): unknown;
}

export interface CollectedProposal {
  ownerId: string;
  proposalRef: string;
  actionRef: string;
  payload?: unknown;
}

export interface CallerSelection {
  status: 'none' | 'selected' | 'ambiguous';
  selected?: CollectedProposal;
  proposals: CollectedProposal[];
}

export interface CallerRouteReceipt {
  ownerId: string;
  eventRef: string;
  source: 'selected' | 'passive';
  routed: boolean;
  duplicate: boolean;
  result?: unknown;
}

export interface CommonCallerSnapshot {
  version: 1;
  ownerIds: string[];
  routedEventKeys: string[];
}

const MAX_OWNERS = 64;
const MAX_PROPOSALS = 128;
const MAX_ROUTED_EVENT_KEYS = 4096;

function nonEmpty(value: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function routeKey(ownerId: string, eventRef: string): string {
  return `${ownerId}\u0000${eventRef}`;
}

function ownedProposal(proposal: CommonCallerProposal): CollectedProposal {
  return {
    ownerId: proposal.ownerId,
    proposalRef: proposal.proposalRef,
    actionRef: proposal.actionRef,
    ...Object.hasOwn(proposal, 'payload') ? { payload: proposal.payload } : {},
  };
}

export class NeutralCommonCaller {
  readonly #owners = new Map<string, CommonCallerOwner>();
  readonly #routedEventKeys = new Set<string>();

  register(owner: CommonCallerOwner): void {
    nonEmpty(owner.id, 'owner id');
    if (this.#owners.has(owner.id)) {
      throw new Error(`duplicate caller owner ${owner.id}`);
    }
    if (this.#owners.size >= MAX_OWNERS) {
      throw new RangeError(`caller owner count exceeds ${MAX_OWNERS}`);
    }
    this.#owners.set(owner.id, owner);
  }

  /**
   * Detached collection for general callers. Proposal payloads are cloned so
   * neither the owner nor the consumer can mutate the other's copy.
   */
  collect(contextByOwner: Readonly<Record<string, unknown>> = {}): CollectedProposal[] {
    return this.#collect(contextByOwner, 'detached');
  }

  /**
   * Ownership-transfer collection for a bounded orchestration layer.
   *
   * Every owner must return a fresh proposal and relinquish its payload until
   * the corresponding return is routed. The caller keeps the payload private;
   * public receipts must expose identity only. This avoids repeatedly cloning a
   * potentially large symbolic state while preserving a single clear owner.
   */
  collectOwned(contextByOwner: Readonly<Record<string, unknown>> = {}): CollectedProposal[] {
    return this.#collect(contextByOwner, 'owned');
  }

  #collect(
    contextByOwner: Readonly<Record<string, unknown>>,
    mode: 'detached' | 'owned',
  ): CollectedProposal[] {
    const proposals: CollectedProposal[] = [];
    const refs = new Set<string>();

    for (const [ownerId, owner] of this.#owners) {
      const proposal = owner.propose(contextByOwner[ownerId]);
      if (!proposal) continue;
      if (proposal.ownerId !== ownerId) {
        throw new Error(`owner ${ownerId} returned proposal for ${proposal.ownerId}`);
      }
      nonEmpty(proposal.proposalRef, 'proposalRef');
      nonEmpty(proposal.actionRef, 'actionRef');
      if (refs.has(proposal.proposalRef)) {
        throw new Error(`duplicate proposalRef ${proposal.proposalRef}`);
      }
      if (proposals.length >= MAX_PROPOSALS) {
        throw new RangeError(`caller proposal count exceeds ${MAX_PROPOSALS}`);
      }
      refs.add(proposal.proposalRef);
      proposals.push(mode === 'detached' ? structuredClone(proposal) : ownedProposal(proposal));
    }

    return proposals;
  }

  select(proposals: readonly CollectedProposal[]): CallerSelection {
    return this.#select(proposals, 'detached');
  }

  /** Select already-owned proposals without cloning their payloads again. */
  selectOwned(proposals: readonly CollectedProposal[]): CallerSelection {
    return this.#select(proposals, 'owned');
  }

  #select(
    proposals: readonly CollectedProposal[],
    mode: 'detached' | 'owned',
  ): CallerSelection {
    if (!Array.isArray(proposals)) throw new TypeError('proposals must be an array');
    if (proposals.length === 0) return { status: 'none', proposals: [] };
    if (proposals.length > MAX_PROPOSALS) {
      throw new RangeError(`caller proposal count exceeds ${MAX_PROPOSALS}`);
    }
    const retained = mode === 'detached'
      ? proposals.map(proposal => structuredClone(proposal))
      : [...proposals];
    if (retained.length === 1) {
      return { status: 'selected', selected: retained[0], proposals: retained };
    }
    return { status: 'ambiguous', proposals: retained };
  }

  routeSelected(
    selection: CallerSelection,
    eventRef: string,
    payload: unknown,
  ): CallerRouteReceipt {
    if (selection.status !== 'selected' || !selection.selected) {
      throw new Error('selected routing requires exactly one selected proposal');
    }
    return this.#route(selection.selected.ownerId, eventRef, 'selected', payload);
  }

  routePassive(
    ownerIds: readonly string[],
    eventRef: string,
    payloadByOwner: Readonly<Record<string, unknown>>,
  ): CallerRouteReceipt[] {
    if (!Array.isArray(ownerIds)) throw new TypeError('ownerIds must be an array');
    const unique = new Set<string>();
    const receipts: CallerRouteReceipt[] = [];
    for (const ownerId of ownerIds) {
      nonEmpty(ownerId, 'owner id');
      if (unique.has(ownerId)) throw new Error(`duplicate passive owner ${ownerId}`);
      unique.add(ownerId);
      if (!Object.hasOwn(payloadByOwner, ownerId)) {
        throw new Error(`missing passive payload for ${ownerId}`);
      }
      receipts.push(this.#route(ownerId, eventRef, 'passive', payloadByOwner[ownerId]));
    }
    return receipts;
  }

  #route(
    ownerId: string,
    eventRef: string,
    source: 'selected' | 'passive',
    payload: unknown,
  ): CallerRouteReceipt {
    nonEmpty(ownerId, 'owner id');
    nonEmpty(eventRef, 'eventRef');
    const owner = this.#owners.get(ownerId);
    if (!owner) throw new Error(`unknown caller owner ${ownerId}`);

    const key = routeKey(ownerId, eventRef);
    if (this.#routedEventKeys.has(key)) {
      return { ownerId, eventRef, source, routed: false, duplicate: true };
    }
    if (this.#routedEventKeys.size >= MAX_ROUTED_EVENT_KEYS) {
      throw new RangeError(`caller routed event count exceeds ${MAX_ROUTED_EVENT_KEYS}`);
    }

    const result = owner.acquire({ eventRef, source, payload });
    this.#routedEventKeys.add(key);
    return {
      ownerId,
      eventRef,
      source,
      routed: true,
      duplicate: false,
      result,
    };
  }

  snapshot(): CommonCallerSnapshot {
    return {
      version: 1,
      ownerIds: [...this.#owners.keys()],
      routedEventKeys: [...this.#routedEventKeys].sort(),
    };
  }

  restore(snapshot: CommonCallerSnapshot): void {
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.ownerIds) || !Array.isArray(snapshot.routedEventKeys)) {
      throw new TypeError('invalid common caller snapshot');
    }
    const currentOwnerIds = [...this.#owners.keys()];
    if (
      snapshot.ownerIds.length !== currentOwnerIds.length
      || snapshot.ownerIds.some((id, index) => id !== currentOwnerIds[index])
    ) {
      throw new Error('caller owner set/order mismatch during restore');
    }
    if (snapshot.routedEventKeys.length > MAX_ROUTED_EVENT_KEYS) {
      throw new RangeError('too many routed event keys');
    }
    const restored = new Set<string>();
    for (const key of snapshot.routedEventKeys) {
      nonEmpty(key, 'routed event key');
      if (restored.has(key)) throw new Error(`duplicate routed event key ${key}`);
      restored.add(key);
    }
    this.#routedEventKeys.clear();
    for (const key of restored) this.#routedEventKeys.add(key);
  }

  get ownerIds(): string[] {
    return [...this.#owners.keys()];
  }
}

export const NEUTRAL_COMMON_CALLER_LIMITS = Object.freeze({
  maxOwners: MAX_OWNERS,
  maxProposals: MAX_PROPOSALS,
  maxRoutedEventKeys: MAX_ROUTED_EVENT_KEYS,
});
