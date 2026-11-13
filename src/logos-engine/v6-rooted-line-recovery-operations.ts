import { selectRootedRecovery } from '../sic/active-recovery.ts';

export interface RootedRecoveryOperation {
  readonly key: 'OP03' | 'OP12' | 'OP08' | 'OP26';
  readonly finding: string;
}

/** Resolve the missing premise of the interrupted plan in the current layout. */
export function resolveRootedRecovery(...input: Parameters<typeof selectRootedRecovery>) {
  const decision = selectRootedRecovery(...input);
  if (decision.status === 'unneeded') return decision;
  const operations: RootedRecoveryOperation[] = [
    { key: 'OP03', finding: 'The next command requires a projection that can account for the observed contact.' },
    { key: 'OP12', finding: 'The contradicted pixel projection leaves displacement through the contact chain unresolved.' },
  ];
  if (decision.status !== 'unresolved') {
    operations.push({ key: 'OP08', finding: 'The observed contiguous chain moved by one whole cell. Use that witness to test a revised projection.' });
  }
  return { ...decision, operations };
}
