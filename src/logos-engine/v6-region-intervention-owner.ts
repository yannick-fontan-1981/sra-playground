import {
  RegionInterventionModel,
  type RegionInterventionCandidate,
  type RegionInterventionObservation,
  type RegionInterventionProposal,
  type RegionInterventionSnapshot,
} from './v6-region-intervention.ts';

export type RegionAcquisitionSource = 'selected' | 'passive';

export interface RegionAcquisitionEvent {
  eventRef: string;
  source: RegionAcquisitionSource;
  observation: RegionInterventionObservation;
}

export interface RegionAcquisitionReceipt {
  acquired: boolean;
  duplicate: boolean;
  eventRef: string;
  source: RegionAcquisitionSource;
  status?: 'learned' | 'confirmed' | 'contradicted' | 'stale';
}

export interface RegionOwnerProposal extends RegionInterventionProposal {
  owner: 'public_region_intervention';
}

export interface RegionInterventionOwnerSnapshot {
  version: 1;
  model: RegionInterventionSnapshot;
  acquiredEventRefs: string[];
}

const MAX_ACQUIRED_EVENT_REFS = 512;

function assertEventRef(value: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('eventRef must be a non-empty string');
  }
}

export class RegionInterventionOwner {
  readonly #model: RegionInterventionModel;
  readonly #acquiredEventRefs = new Set<string>();

  constructor(model = new RegionInterventionModel()) {
    this.#model = model;
  }

  propose(candidate: RegionInterventionCandidate): RegionOwnerProposal | undefined {
    const proposal = this.#model.propose(candidate);
    return proposal ? { owner: 'public_region_intervention', ...proposal } : undefined;
  }

  acquire(event: RegionAcquisitionEvent): RegionAcquisitionReceipt {
    assertEventRef(event.eventRef);
    if (event.source !== 'selected' && event.source !== 'passive') {
      throw new TypeError('source must be selected or passive');
    }

    if (this.#acquiredEventRefs.has(event.eventRef)) {
      return {
        acquired: false,
        duplicate: true,
        eventRef: event.eventRef,
        source: event.source,
      };
    }

    if (this.#acquiredEventRefs.size >= MAX_ACQUIRED_EVENT_REFS) {
      throw new RangeError(`Region acquired event count exceeds ${MAX_ACQUIRED_EVENT_REFS}`);
    }

    const result = this.#model.observe(event.observation);
    this.#acquiredEventRefs.add(event.eventRef);
    return {
      acquired: true,
      duplicate: false,
      eventRef: event.eventRef,
      source: event.source,
      status: result.status,
    };
  }

  get model(): RegionInterventionModel {
    return this.#model;
  }

  snapshot(): RegionInterventionOwnerSnapshot {
    return {
      version: 1,
      model: this.#model.snapshot(),
      acquiredEventRefs: [...this.#acquiredEventRefs].sort(),
    };
  }

  restore(snapshot: RegionInterventionOwnerSnapshot): void {
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.acquiredEventRefs)) {
      throw new TypeError('invalid RegionInterventionOwner snapshot');
    }
    if (snapshot.acquiredEventRefs.length > MAX_ACQUIRED_EVENT_REFS) {
      throw new RangeError('too many acquired Region event refs');
    }

    const restoredRefs = new Set<string>();
    for (const ref of snapshot.acquiredEventRefs) {
      assertEventRef(ref);
      if (restoredRefs.has(ref)) {
        throw new Error(`duplicate acquired Region event ref ${ref}`);
      }
      restoredRefs.add(ref);
    }

    const previousModel = this.#model.snapshot();
    try {
      this.#model.restore(snapshot.model);
    } catch (error) {
      this.#model.restore(previousModel);
      throw error;
    }

    this.#acquiredEventRefs.clear();
    for (const ref of restoredRefs) this.#acquiredEventRefs.add(ref);
  }

  hasAcquired(eventRef: string): boolean {
    return this.#acquiredEventRefs.has(eventRef);
  }

  get acquiredCount(): number {
    return this.#acquiredEventRefs.size;
  }
}

export const REGION_INTERVENTION_OWNER_LIMITS = Object.freeze({
  maxAcquiredEventRefs: MAX_ACQUIRED_EVENT_REFS,
});
