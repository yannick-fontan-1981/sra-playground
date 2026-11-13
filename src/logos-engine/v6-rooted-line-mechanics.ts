/** Exact V6 bindings to the consumed V5 conditional piercing kernel. */
import { normalizePiercingCommandEffect, normalizePiercingConditionalModel, normalizePiercingConfiguration,
  searchPiercingPlans } from './v5-piercing-plan.ts';
import { rootedLineConfiguration, physicalRootedLine, projectedRootedLine } from './v6-rooted-line-observation.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { PiercingNativeBudget } from './v5-piercing-plan.ts';

type R = Record<string, any>;

export function rootedLineModel(config: R): R {
  return normalizePiercingConditionalModel({ model_ref: 'conditional_rooted_contact', source_model_ref: config.source_rule,
    ...config.conditional_model, evidence_refs: [], falsifier_refs: ['current_root_tip_or_piece_projection_differs'] });
}

export function rootedLineEffect(action: string, first: R, second: R, references: readonly string[]): R | null {
  const dy = second.root[1] - first.root[1], dx = second.root[0] - first.root[0], extent = second.tip - first.tip - dx;
  if (dx || dy && extent || !(dy || extent) || first.layout !== second.layout) return null;
  return normalizePiercingCommandEffect({ effect_ref: 'observed:' + action, action_ref: action, rod_ref: 'current_rod',
    root_translation: [dy, dx], extent_delta: extent, extent_cross_section_offsets: first.line_rows.map((_row: number, index: number) => [index, 0]),
    axis_direction: [0, 1], evidence_refs: [...references], coordinate_scope_ref: 'coordinate.world' });
}

export function planRootedLine(scene: R, observation: R, effects: R, config: R, retained: R | null = null,
  nativeBudget?: PiercingNativeBudget): [R, R] {
  let configuration = rootedLineConfiguration(scene, observation.observation_ref, observation.level_epoch);
  if (retained !== null) {
    const old = normalizePiercingConfiguration(retained);
    if (equal(projectedRootedLine(old), physicalRootedLine(scene))) configuration = { ...old, frame_ref: observation.observation_ref };
  }
  const request = { configuration, effects: Object.values(effects).map(normalizePiercingCommandEffect), models: [rootedLineModel(config)],
    goal_requested_root_ref: 'current_root', goal_requested_type_order: [...scene.order], max_microsteps: config.max_microsteps,
    max_depth: config.max_depth, max_nodes: config.max_nodes, max_plans: 1 };
  return [configuration, searchPiercingPlans(request, nativeBudget)];
}
