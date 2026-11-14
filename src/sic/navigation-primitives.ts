import type { NativePoint } from '../logos-engine/v6-native-types.ts';
import type { ReasoningMode } from './reasoning-mode.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const navigationPrimitives = {
  P02: 'Reuse and verify a known interaction',
  P05: 'Measure the effect of a needed control',
  P07: 'Gain access to the current target',
} as const;

type Primitive = keyof typeof navigationPrimitives;
type Fact = 'unknownEffect' | 'knownRoute' | 'knownInteraction';
type Evidence = readonly [string, ...string[]];
type Offer = { input: string; expected: NativePoint | null; evidence: Evidence };

const dimensions: readonly Fact[] = ['unknownEffect', 'knownRoute', 'knownInteraction'];
const priorities: Record<ReasoningMode, readonly Primitive[]> = {
  exploration: ['P05', 'P07', 'P02'],
  assimilation: ['P02', 'P07', 'P05'],
  solving: ['P07', 'P02', 'P05'],
};

const graphs = Object.fromEntries(Object.entries(priorities).map(([mode, order]) => [mode, compileStrategyGraph<Primitive, Fact>({
  id: 'navigation:' + mode, version: 1, order: 'FALLBACK', priorities: order,
  strategies: {
    P02: [{ fact: 'knownInteraction', expected: true, label: 'A known input can be tested again at a current, compatible target' }],
    P05: [{ fact: 'unknownEffect', expected: true, label: 'A needed effect is still unknown in the current situation' }],
    P07: [{ fact: 'knownRoute', expected: true, label: 'At least the next step of access is supported by an observed displacement' }],
  },
}, dimensions)])) as Record<ReasoningMode, ReturnType<typeof compileStrategyGraph<Primitive, Fact>>>;

export function resolveNavigationPrimitives({
  mode, evidence, probe, access, interaction,
}: { mode: ReasoningMode; evidence: Evidence; probe: Offer | null; access: Offer | null; interaction: Offer | null }) {
  const graph = graphs[mode];
  const fact = (offer: Offer | null) => ({ value: offer !== null, evidence: offer?.evidence ?? evidence });
  return { ...resolveStrategyGraph({
    graph, mode: 'active',
    facts: { unknownEffect: fact(probe), knownRoute: fact(access), knownInteraction: fact(interaction) },
    planners: { P05: () => probe, P07: () => access, P02: () => interaction },
  }), card: graph.id };
}
