/** Reproducible connection coverage, deliberately separate from full parity. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
type R = Record<string, any>;
const root = new URL('../', import.meta.url), commit = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const prefix = `reference/v6/${commit}/source/agents/yf_arc3_v6/`;
const commonBytes = await readFile(new URL(prefix + 'laya_proto/common_frontier_policy.drm.json', root));
const strategyBytes = await readFile(new URL(prefix + 'morphology_policy/strategy.drm', root));
const declarations = { common: JSON.parse(commonBytes.toString()), strategy: JSON.parse(strategyBytes.toString()) } as NativeV6Declarations;
const configuration = declarations.strategy.declarations[0]!.configuration;
const runtime = await createNativeV6Runtime(declarations), snapshot = runtime.snapshot(), coverage = snapshot.coverage as R;
const sourceGroups = coverage.sourceGroups as { id: string; families: string[]; entryPoints?: (string | null)[] }[];
const aliases: Record<string, string> = {
  scored_relation_access: 'goal_access', observed_support_access: 'support_navigation',
  coupled_support_composition: 'public_occurrence_recall',
  alternating_graph_composition: 'public_occurrence_recall',
  cell_patch_composition: 'public_occurrence_recall',
  observed_program_composition: 'public_occurrence_recall',
  radial_port_composition: 'public_occurrence_recall',
  field_service_composition: 'public_occurrence_recall',
  observed_framed_transfer: 'public_framed_transfer',
  observed_framed_analogy: 'public_framed_transfer',
  observed_outline_service: 'public_outline_service',
  reactive_contact_continuation: 'public_reactive_contact',
  reactive_contact: 'public_reactive_contact',
  ordered_reaction: 'public_ordered_reaction',
  observed_inventory_composition: 'public_observed_inventory',
  topological_recolor: 'public_topological_recolor',
  rooted_quota_composition: 'public_occurrence_recall',
  occluded_catalogue_composition: 'public_occurrence_recall',
  typed_material_flow: 'public_occurrence_recall',
  queued_field_composition: 'public_occurrence_recall',
  product_panel_composition: 'public_occurrence_recall',
  labeled_sequence_composition: 'public_occurrence_recall',
  trace_field_composition: 'public_occurrence_recall',
  linked_packet_composition: 'public_occurrence_recall',
  observed_occurrence_recall: 'public_occurrence_recall', multiscale_constraints: 'window_constraints',
  surface_rewrite: 'surface_program', learned_code_program: 'code_program', typed_word_interface: 'word_interface',
  rigid_port_assembly: 'port_assembly', controlled_constellation_cover: 'constellation_cover', conserved_band_transfer: 'band_transfer',
  supported_ternary_reduction: 'reduction_transport',
};
const lists: [string, readonly string[]][] = [
  ['goal_access', configuration.goal_access_subquestions],
  ['window_constraints', configuration.window_constraints.ordered_subquestions],
  ['surface', configuration.program_construction.ordered_subquestions],
  ['factored_material_return', configuration.factored_material_return.ordered_subquestions],
];
const groups = lists.map(([id, declared]) => {
  const actual = sourceGroups.find(group => group.id === id)!;
  const registered = new Set(actual.families);
  const entries = declared.map(question => {
    const family = aliases[question] ?? question;
    const explicitSharedEntry = (['goal_access', 'window_constraints'].includes(id) && family === 'public_occurrence_recall')
      || family === 'public_framed_transfer' || family === 'public_reactive_contact' || family === 'public_ordered_reaction' || family === 'public_observed_inventory'
      || family === 'public_topological_recolor';
    const connected = registered.has(family) && (!explicitSharedEntry || actual.entryPoints?.some((entry, index) =>
      entry === question && actual.families[index] === family) === true);
    return { question, family: connected ? family : null, status: connected ? 'connected' : 'pending' };
  });
  return { id, declared: entries.length, connected: entries.filter(entry => entry.status === 'connected').length, entries };
});
const connected = groups.reduce((sum, group) => sum + group.connected, 0), total = groups.reduce((sum, group) => sum + group.declared, 0);
const report = {
  schema: 'logos-engine.v6.declared-entry-coverage.v1', referenceCommit: commit,
  strategySha256: createHash('sha256').update(strategyBytes).digest('hex'), implementation: snapshot.implementation,
  metric: 'Connection of the explicit subquestions in the four ordered source DRM lists',
  connected, declared: total, percent: Math.round(connected * 1000 / total) / 10, groups,
  qualification: 'Each declared entry has equal weight. This counts actual provider registrations, not code volume, game score, expected success, or complete V6 behavioral parity. The common coordinator and direct groups are outside this denominator. Their own differential tests and live campaigns remain separate evidence.',
  commonGroups: sourceGroups, pendingSupportSubcompositions: coverage.supportSubcompositionsPending,
  sharedSeriesMemory: coverage.sharedSeriesMemory, sharedSeriesDigestScope: coverage.sharedSeriesDigestScope, fullV6Parity: false,
};
await writeFile(new URL('docs/migration/v6-entry-point-progress.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ connected, declared: total, percent: report.percent, groups: groups.map(({ id, connected, declared }) => ({ id, connected, declared })), fullV6Parity: false }));
