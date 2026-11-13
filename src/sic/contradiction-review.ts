export interface ContradictionReview {
  readonly sessionId: string;
  readonly sequence: number;
}

/** Only the exact acquired return can trigger the opt-in review. */
export function as66Contradiction(game: string, enabled: boolean, snapshot: {
  readonly sessionId: string | null;
  readonly level: number;
  readonly sequence: number;
  readonly trace: readonly unknown[];
}): ContradictionReview | null {
  const { sessionId, level, sequence, trace } = snapshot;
  if (!enabled || game !== 'AS66' || !sessionId || !sequence) return null;
  const prefix = `${sessionId}:epoch:${level}:revision:${sequence + 1}:frame:`;
  for (const entry of trace.slice(-128).reverse()) {
    if (entry && typeof entry === 'object' && 'kind' in entry && entry.kind === 'actual_outcome'
        && 'observation_ref' in entry && typeof entry.observation_ref === 'string' && entry.observation_ref.startsWith(prefix)) {
      return 'matched' in entry && entry.matched === false ? { sessionId, sequence } : null;
    }
  }
  return null;
}
