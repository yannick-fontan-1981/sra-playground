import type { NativePoint } from '../logos-engine/v6-native-types.ts';

type Refusal = { at: NativePoint; input: string; context: string; evidence: string };
export type RouteRefusals = readonly Refusal[];

export function blockedRouteStep(refusals: RouteRefusals, at: NativePoint, input: string, context = '') {
  return refusals.find(entry => entry.input === input && entry.context === context
    && entry.at[0] === at[0] && entry.at[1] === at[1]);
}

export function rememberRouteRefusal(refusals: RouteRefusals, at: NativePoint, input: string, evidence: string, context = ''): RouteRefusals {
  if (blockedRouteStep(refusals, at, input, context)) return refusals;
  return [...refusals, { at, input, context, evidence }];
}
