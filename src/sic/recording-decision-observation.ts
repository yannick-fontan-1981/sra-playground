import type { ReasoningMode } from './reasoning-mode.ts';

type Facts = Readonly<{ routeSupported: boolean; eligibleProbe: boolean; knownInteraction: boolean; mode: ReasoningMode }>;
type Entry = Readonly<{ invocation: number; observationRef: string; family: string; facts: Facts; evidence: readonly string[] }>;

/** Session-local diagnostic mailbox. No callbacks, native memory nodes or action authority. */
export class RecordingDecisionObservations {
  #entries: Entry[] = [];
  #invocation = 0;
  #omitted = 0;

  static capture(mailbox: RecordingDecisionObservations, family: string, observationRef: string, facts: Facts, evidence: readonly string[]): void {
    const invocation = ++mailbox.#invocation;
    if (mailbox.#entries.length === 32) {
      mailbox.#omitted++;
      return;
    }
    mailbox.#entries.push(Object.freeze({ invocation, family, observationRef,
      facts: Object.freeze({ ...facts }), evidence: Object.freeze([...evidence]) }));
  }

  drain() {
    const batch = { entries: this.#entries, omitted: this.#omitted };
    this.#entries = [];
    this.#omitted = 0;
    return batch;
  }
}
