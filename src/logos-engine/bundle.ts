import type { CompiledModule } from './ir.ts';

export const V7_SOURCE_COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';

export interface DemonstrationEvent {
  label: string;
  event: { before: unknown; after: unknown; action: unknown };
}

export interface DemonstrationScenario {
  id: string;
  title: string;
  description: string;
  events: DemonstrationEvent[];
}

export interface V7Bundle {
  schema: string;
  provenance: Record<string, unknown>;
  programs: { generators: CompiledModule; activation: CompiledModule };
  knowledge: { logos: unknown; drm: unknown };
  sources: { generators: string; activation: string };
  scenarios: DemonstrationScenario[];
}

export async function loadV7Bundle(): Promise<V7Bundle> {
  const url = new URL('../../reference/v7/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/bundle.json', import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load the V7 reference (${response.status}).`);
  const bundle = await response.json() as V7Bundle;
  if (!bundle.programs?.generators || !bundle.programs.activation || !bundle.knowledge || !Array.isArray(bundle.scenarios)) {
    throw new Error('The V7 reference bundle is incomplete.');
  }
  return bundle;
}
