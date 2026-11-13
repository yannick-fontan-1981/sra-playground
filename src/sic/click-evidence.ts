import type { NativeClickReturn } from '../logos-engine/v6-native-click-return.ts';

export interface ClickEffectCount {
  readonly kind: 'recolor' | 'unchanged' | 'other_change';
  readonly count: number;
  readonly levels: readonly number[];
  readonly afterPalette?: number;
  readonly returns: readonly NativeClickReturn[];
}

export interface ClickComparison {
  readonly example: NativeClickReturn;
  readonly status: 'repeated' | 'varied' | 'single' | 'unresolved';
  readonly effects: readonly ClickEffectCount[];
  readonly count: number;
}

export interface ClickEvidence {
  readonly returns: readonly NativeClickReturn[];
  readonly comparisons: readonly ClickComparison[];
  readonly boundaries: number;
  readonly unidentified: number;
  readonly omitted: number;
}

export function compareClickReturns(returns: readonly NativeClickReturn[], omitted: number): ClickEvidence {
  const groups = new Map<string, NativeClickReturn[]>();
  const seen = new Set<number>();
  const distinctReturns: NativeClickReturn[] = [];
  let boundaries = 0, unidentified = 0;

  for (const receipt of returns) {
    if (seen.has(receipt.sequence)) continue;
    seen.add(receipt.sequence);
    distinctReturns.push(receipt);
    if (receipt.boundary) {
      boundaries++;
      continue;
    }
    const { target, point } = receipt;
    if (!target) {
      unidentified++;
      continue;
    }
    // Signature includes the exact measured shape at its scale and initial palette.
    // The relative address makes different screen locations comparable.
    const key = JSON.stringify([target.signature, target.palette, point[0] - target.box[0], point[1] - target.box[1]]);
    const group = groups.get(key);
    if (group) group.push(receipt);
    else groups.set(key, [receipt]);
  }

  const comparisons = [...groups.values()].map(summarizeGroup).sort((left, right) =>
    Number(right.status === 'varied') - Number(left.status === 'varied')
    || Number(right.count > 1) - Number(left.count > 1) || right.example.sequence - left.example.sequence);
  return { returns: distinctReturns, comparisons, boundaries, unidentified, omitted };
}

function summarizeGroup(group: readonly NativeClickReturn[]): ClickComparison {
  const outcomes = new Map<string, {
    kind: ClickEffectCount['kind']; afterPalette?: number; returns: NativeClickReturn[];
  }>();
  for (const receipt of group) {
    const palette = receipt.sameSupport ? receipt.atPointAfter?.palette : undefined;
    const recolored = palette !== undefined && palette !== receipt.target!.palette;
    const kind = recolored ? 'recolor' : receipt.changedTargetPixels === 0 ? 'unchanged' : 'other_change';
    const key = recolored ? `recolor:${palette}` : kind;
    const outcome = outcomes.get(key) ?? { kind, ...(recolored ? { afterPalette: palette } : {}), returns: [] };
    outcome.returns.push(receipt);
    outcomes.set(key, outcome);
  }
  const effects = [...outcomes.values()].map(effect => ({
    ...effect, count: effect.returns.length, levels: [...new Set(effect.returns.map(receipt => receipt.fromLevel))].sort((a, b) => a - b),
  }));
  const status = effects.length > 1 ? 'varied'
    : effects[0]?.kind === 'other_change' ? 'unresolved'
    : group.length > 1 ? 'repeated' : 'single';
  return { example: group.at(-1)!, status, effects, count: group.length };
}
