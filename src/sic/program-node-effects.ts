import { calculateFixedProgram } from '../logos-engine/v6-fixed-program-calculation.ts';

export type ProgramVisit = { active: number | null; node: number | null };
export type PortSamples = Record<string, [number, number][]>;
export type PortAlternatives = (number | null)[][];
export type NodeEffectPlan = { origin: number; blocked: number[]; repeat: number[] };
type ProgramReturn = { samples: PortSamples; interruption: number | null };
type Port = [string, string, string | null];
const variantLimit = 32;

export function readProgramReturn(word: string[], trace: ProgramVisit[], origin: number, cleared: boolean): ProgramReturn {
  const samples: PortSamples = {};
  let start = origin, last: { index: number; node: number } | null = null;
  for (const [index, symbol] of word.entries()) {
    const visits = trace.flatMap(({ active, node }) => active === index && node !== null ? [node] : []);
    if (!visits.length) break;
    (samples[symbol] ??= []).push([start, visits.find(node => node !== start) ?? start]);
    start = visits.at(-1)!;
    last = { index, node: start };
  }
  return { samples, interruption: cleared && last && last.index < word.length - 1 ? last.node : null };
}

function portVariants(tables: ReadonlyMap<string, PortAlternatives[]>): Port[][] | null {
  let models: Port[][] = [[]];
  for (const [symbol, choices] of tables) {
    const expanded = new Map<string, Port[]>();
    for (const table of choices) {
      let current: Port[][] = [[]];
      for (const [node, options] of table.entries()) {
        if (!options.length || current.length * options.length > variantLimit) return null;
        current = current.flatMap(ports => options.map(next =>
          [...ports, [String(node), symbol, next === null ? null : String(next)] as Port]));
      }
      for (const ports of current) expanded.set(JSON.stringify(ports), ports);
    }
    if (!expanded.size || models.length * expanded.size > variantLimit) return null;
    models = models.flatMap(model => [...expanded.values()].map(ports => [...model, ...ports]));
  }
  return models;
}

export function planNodeEffect(word: string[], fills: (number | null)[], common: number, target: number,
  blockedFills: number[], attempted: number[], tables: ReadonlyMap<string, PortAlternatives[]>): NodeEffectPlan | null {
  const unclassified = new Set(fills.filter(value => value !== null && value !== common && value !== fills[target]
    && !blockedFills.includes(value)));
  if (!blockedFills.length || unclassified.size !== 1) return null;
  const repeatFill = [...unclassified][0]!;
  const blocked = fills.flatMap((value, node) => value !== null && blockedFills.includes(value) ? [node] : []);
  const repeat = fills.flatMap((value, node) => value === repeatFill ? [node] : []);
  const placement = fills.flatMap((value, node) => value === common && !attempted.includes(node) ? [String(node)] : []);
  const variants = portVariants(tables);
  if (!placement.length || !variants) return null;
  const models = variants.map((ports, index) => ({
    model_ref: String(index), nodes: fills.map((_, i) => String(i)), word, ports,
    placement_nodes: placement, placement_hits: placement.map(node => [node, node]), target_nodes: [String(target)],
    hazard_nodes: blocked.map(String), repeat_nodes: repeat.map(String), effect_priority: ['repeat', 'neighbor'],
    arrival_updates_memory: true, cancelled_updates_memory: false, closure_after_cancelled: false, closure_after_self_loop: false,
    neighbor_updates_memory: false, launch_memory_law: 'clear_on_launch',
  }));
  const repeated = calculateFixedProgram(models, word, 'robust_origin_domain');
  const ordinary = calculateFixedProgram(models.map(model => ({ ...model, repeat_nodes: [] })), word, 'robust_origin_domain');
  if (repeated.status !== 'COMPLETE' || ordinary.status !== 'COMPLETE') return null;
  const neutral = new Set<string>(ordinary.values.model_correlated_results.flatMap(
    ({ result }: { result: { safe_observable_hits: string[] } }) => result.safe_observable_hits));
  const support = new Map<number, number>();
  for (const row of repeated.values.model_correlated_results) {
    for (const hit of row.result.safe_observable_hits) {
      if (!neutral.has(hit)) support.set(Number(hit), (support.get(Number(hit)) ?? 0) + 1);
    }
  }
  const candidates = [...support].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return candidates.length ? { origin: candidates[0]![0], blocked, repeat } : null;
}
