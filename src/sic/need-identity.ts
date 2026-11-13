import { symbolicDigest } from '../logos-engine/v6-hash.ts';

interface NeedIdentity {
  readonly kind: string;
  readonly scope: string;
  readonly subjects: readonly string[];
  readonly parentObjective: string;
  readonly satisfactionContract: string;
}

export function sicNeedId(need: NeedIdentity): string {
  return 'sic-need:' + symbolicDigest([
    need.kind, need.scope, [...new Set(need.subjects)].sort(), need.parentObjective, need.satisfactionContract,
  ]);
}
