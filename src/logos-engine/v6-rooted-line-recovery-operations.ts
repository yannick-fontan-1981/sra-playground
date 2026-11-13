type Counterexample = {
  readonly before: string;
  readonly after: string;
  readonly cell_push_witness?: boolean;
  readonly layout?: string;
};

export interface RootedRecoveryOperation {
  readonly key: 'OP03' | 'OP12' | 'OP08' | 'OP26';
  readonly finding: string;
}

/** Resolve the missing premise of the interrupted plan in the current layout. */
export function resolveRootedRecovery(refutations: readonly Counterexample[], layout: string) {
  if (!refutations.length) return { status: 'unneeded' } as const;
  const operations: RootedRecoveryOperation[] = [
    { key: 'OP03', finding: 'The next command requires a projection that can account for the observed contact.' },
    { key: 'OP12', finding: 'The contradicted pixel projection leaves displacement through the contact chain unresolved.' },
  ];
  const [observed] = refutations;
  if (refutations.length !== 1 || !observed?.cell_push_witness || observed.layout !== layout) {
    return { status: 'unresolved', operations } as const;
  }
  operations.push({ key: 'OP08', finding: 'The observed contiguous chain moved by one whole cell. Use that witness to test a revised projection.' });
  return { status: 'ready', operations, evidence: [observed.before, observed.after] } as const;
}
