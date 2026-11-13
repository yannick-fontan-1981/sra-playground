import type { NativeClickContext, NativeClickReturn } from '../logos-engine/v6-native-click-return.ts';

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

const contextFields = [
  ['Board state', (context: NativeClickContext) => context.state],
  ['Available actions', (context: NativeClickContext) => context.commands.map(action => action.replace(/^ACTION/, '')).join(', ') || 'None'],
  ['Matching regions', (context: NativeClickContext) => String(context.matchingRegions)],
  ...(['above', 'right', 'below', 'left'] as const).map(direction => [
    `Colors ${direction}`,
    (context: NativeClickContext) => context.neighborhood[direction].join(', ') || 'Outside board',
  ] as const),
] as const;

export function describeClickContext(context: NativeClickContext): readonly [string, string][] {
  return contextFields.map(([label, read]) => [label, read(context)]);
}

export function contrastClickContexts(effects: readonly ClickEffectCount[]) {
  const groups = effects.map(effect => effect.returns.flatMap(receipt => receipt.beforeContext ? [receipt.beforeContext] : []));
  const missing = effects.reduce((total, effect, index) => total + effect.count - groups[index]!.length, 0);
  const differences = contextFields.flatMap(([label, read]) => {
    const values = groups.map(group => [...new Set(group.map(read))].sort());
    if (new Set(values.flat()).size < 2) return [];
    const separates = missing === 0 && values.every((group, index) =>
      group.every(value => values.every((other, otherIndex) => index === otherIndex || !other.includes(value))));
    return [{ label, values, separates }];
  });
  return { differences, missing };
}

export interface AboveColorPair {
  readonly left: NativeClickReturn;
  readonly right: NativeClickReturn;
  readonly recolorDiffers: boolean;
}

/** Compare within one target group and hold the other recorded context measurements fixed. */
export function compareAboveColors(effects: readonly ClickEffectCount[]): readonly AboveColorPair[] {
  const samples = effects.flatMap(effect => effect.returns.flatMap(receipt => {
    if (!receipt.beforeContext) return [];
    const { state, commands, matchingRegions, neighborhood } = receipt.beforeContext;
    return [{
      receipt,
      recolored: effect.kind === 'recolor',
      above: neighborhood.above.join(','),
      controls: JSON.stringify([state, commands, matchingRegions, neighborhood.left, neighborhood.right, neighborhood.below]),
    }];
  }));
  const pairs: AboveColorPair[] = [];
  for (const [index, sample] of samples.entries()) {
    for (const other of samples.slice(index + 1)) {
      if (sample.controls !== other.controls || sample.above === other.above) continue;
      pairs.push({ left: sample.receipt, right: other.receipt, recolorDiffers: sample.recolored !== other.recolored });
    }
  }
  return pairs;
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
