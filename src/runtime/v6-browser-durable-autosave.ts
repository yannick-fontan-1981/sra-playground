import type {
  BrowserDurableSessionCheckpointV1,
  BrowserDurableSessionSaveResult,
} from './v6-browser-durable-session.ts';

export type BrowserDurableAutosaveFlushResult =
  | BrowserDurableSessionSaveResult
  | { status: 'unchanged' }
  | { status: 'unsafe' }
  | { status: 'capture-failed'; error: unknown }
  | { status: 'save-failed'; error: unknown };

export interface BrowserDurableSessionAutosaveOptions {
  capture(): BrowserDurableSessionCheckpointV1 | null;
  save(checkpoint: BrowserDurableSessionCheckpointV1): BrowserDurableSessionSaveResult;
  schedule?(callback: () => void): void;
  onResult?(result: BrowserDurableAutosaveFlushResult): void;
}

function durableIdentityReplacer(_key: string, value: unknown): unknown {
  return value instanceof Uint8Array
    ? { __sra_autosave_uint8_v1__: [...value] }
    : value;
}

/**
 * Identity of the durable state itself, excluding renewal timestamps.
 *
 * A repeated safe-boundary notification must not rewrite localStorage merely
 * because a new TTL window was computed. Every runtime, campaign, pending-return
 * and FieldStock value remains part of the identity.
 */
export function browserDurableSessionContentIdentity(
  checkpoint: BrowserDurableSessionCheckpointV1,
): string {
  const {
    savedAtMs: _savedAtMs,
    expiresAtMs: _expiresAtMs,
    ...state
  } = checkpoint;
  return JSON.stringify(state, durableIdentityReplacer);
}

/**
 * Coalesce browser durability notifications while preserving the last good
 * checkpoint whenever the live runtime is temporarily between safe boundaries.
 *
 * The coordinator never clears storage. Explicit product invalidation remains
 * owned by the caller, so an unsafe or failed autosave cannot destroy a usable
 * crash-recovery point.
 */
export class BrowserDurableSessionAutosave {
  readonly #capture: BrowserDurableSessionAutosaveOptions['capture'];
  readonly #save: BrowserDurableSessionAutosaveOptions['save'];
  readonly #schedule: NonNullable<BrowserDurableSessionAutosaveOptions['schedule']>;
  readonly #onResult?: BrowserDurableSessionAutosaveOptions['onResult'];

  #lastIdentity: string | null = null;
  #scheduled = false;
  #generation = 0;

  constructor(options: BrowserDurableSessionAutosaveOptions) {
    this.#capture = options.capture;
    this.#save = options.save;
    this.#schedule = options.schedule ?? (callback => queueMicrotask(callback));
    this.#onResult = options.onResult;
  }

  /** Schedule at most one autosave for the current browser turn. */
  request(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    const generation = this.#generation;
    this.#schedule(() => {
      if (generation !== this.#generation) return;
      this.#scheduled = false;
      this.flush();
    });
  }

  /** Capture synchronously, which is required at the physical dispatch seam. */
  flush(): BrowserDurableAutosaveFlushResult {
    this.#scheduled = false;
    let checkpoint: BrowserDurableSessionCheckpointV1 | null;
    try {
      checkpoint = this.#capture();
    } catch (error) {
      return this.#emit({ status: 'capture-failed', error });
    }
    if (!checkpoint) return this.#emit({ status: 'unsafe' });

    const identity = browserDurableSessionContentIdentity(checkpoint);
    if (identity === this.#lastIdentity) {
      return this.#emit({ status: 'unchanged' });
    }

    let result: BrowserDurableSessionSaveResult;
    try {
      result = this.#save(checkpoint);
    } catch (error) {
      return this.#emit({ status: 'save-failed', error });
    }
    if (result.status === 'saved') this.#lastIdentity = identity;
    return this.#emit(result);
  }

  /** Seed deduplication from a checkpoint already present in durable storage. */
  prime(checkpoint: BrowserDurableSessionCheckpointV1): void {
    this.#lastIdentity = browserDurableSessionContentIdentity(checkpoint);
  }

  /** Invalidate queued work and the deduplication identity after an explicit clear. */
  reset(): void {
    this.#generation += 1;
    this.#scheduled = false;
    this.#lastIdentity = null;
  }

  #emit(result: BrowserDurableAutosaveFlushResult): BrowserDurableAutosaveFlushResult {
    this.#onResult?.(result);
    return result;
  }
}
