/** Source JSON contracts for the pinned PreviewPacking family. Coordinates in
 * the packing calculus are [row,column]; observed point payloads are {x,y}. */
import type { NativeRecord } from './v6-native-types.ts';

export type PreviewPackingCell = readonly [row: number, column: number];
export type PreviewPackingMask = readonly PreviewPackingCell[];
export type PreviewPackingTransform = 'rotate_cw' | 'rotate_ccw' | 'reflect_rows' | 'reflect_columns';
export interface PreviewPackingCommand { action_ref: string; data?: Readonly<Record<string, number>> }
export interface PreviewPackingPiece {
  id: string; color: number; mask: PreviewPackingCell[]; anchor: PreviewPackingCell; movable: boolean;
}
export interface PreviewPackingScene {
  q: number; offset: PreviewPackingCell; board: PreviewPackingCell[]; pieces: PreviewPackingPiece[];
  background: number; empty: number; frame_color: number; frame: readonly [number, number, number, number];
  world: PreviewPackingCell[]; selected: string | null; preview_color: number | null; evidence: string[];
}
export interface PreviewPackingPose { anchor: PreviewPackingCell; mask: PreviewPackingCell[] }
export interface PreviewPackingModel extends PreviewPackingScene {
  epoch: number; tried: { action: string; pose: [PreviewPackingCell, PreviewPackingCell[]] }[];
}
export type PreviewPackingControl =
  | { kind: 'translation'; delta: PreviewPackingCell; evidence: string[] }
  | { kind: 'transform'; transform: PreviewPackingTransform; evidence: string[] };
export interface PreviewPackingSourceState extends NativeRecord {
  packing_events: PreviewPackingEvent[]; packing_model: PreviewPackingModel | null;
  packing_controls: Record<string, PreviewPackingControl>; _packing_scene_cache: Record<string, PreviewPackingScene | null>;
}
export interface PreviewPackingEvent {
  kind: 'observed_preview_packing'; model: PreviewPackingModel; controls: Record<string, PreviewPackingControl>;
  detail: { before: string; after: string; command: PreviewPackingCommand; mode: 'select' | 'edit';
    selection_observed?: boolean; observed_pose?: PreviewPackingPose | null };
}
export interface PreviewPackingConfiguration {
  preview_packing_question?: { roles: string[]; selection: string; control: string; transport: string };
}
export interface PreviewPackingAssignedPose extends PreviewPackingPose { piece_ref: string }
export interface PreviewPackingAssignment { poses: PreviewPackingAssignedPose[]; strict_partition: true }
export interface PreviewPackingAssignments {
  packing_assignments: PreviewPackingAssignment[]; area_mismatch: boolean; exhaustive_in_supplied_pose_domains: true;
  packing_does_not_prove_transport?: true; minimum_cost_claimed?: false;
}
export interface PreviewPackingPlan {
  model: PreviewPackingModel; chosen: string; mode: 'select' | 'edit'; commands: PreviewPackingCommand[];
  expected: (PreviewPackingPose | null)[]; before_poses: (PreviewPackingPose | null)[];
  epoch: number; score: number; observation_ref: string; frame_digest: string; why: string;
  calculation: { method: 'V5.preview_piece_packing._residual'; assignments: number; scope: string };
  target: PreviewPackingAssignedPose;
}
export interface PreviewPackingStep {
  action: PreviewPackingCommand; expected_after: null;
  point_binding?: { entity_ref: string; signature: string; bbox: readonly number[]; observation_ref: string;
    level_epoch: number; frame_hash: string; point: [number, number]; palette_value: number;
    source: 'current_observed_piece_hit_point' };
}
export interface PreviewPackingProposal extends NativeRecord {
  status: 'proposed'; kind: 'preview_packing'; proposal_id: string; preview_packing_plan: PreviewPackingPlan;
  actions: PreviewPackingCommand[]; steps: PreviewPackingStep[];
  facts: { current_measured_cell_inventory: true; strict_partition_is_library_hypothesis: true;
    preview_transport_provisional: true; current_point_bound: boolean };
  compositions: NativeRecord[]; question: { reason: string; hypothesis_refs: string[] }; route_refs: string[];
  binding: { level_epoch: number; observation_ref: string };
  bundle_template: { operation_key: 'OP18'; composition_ref: string; objective_ref: 'G_official_completion';
    preserve_refs: string[]; actions: PreviewPackingCommand[]; purpose: string; preconditions: PreviewPackingProposal['facts'];
    evidence: string[]; outcome_guard: { path: ['value']; contains: string } };
  preview_policy_ref: string; preview_policy_hash: string;
}
export interface PreviewPackingBlocked extends NativeRecord {
  status: 'unknown'; block_unrelated_probe: true; reason: string;
  native_incomplete?: { cause: string; examined: number; work: number; frontier: NativeRecord };
}
export interface PreviewPackingReturn extends NativeRecord {
  kind: 'preview_packing_return'; events: PreviewPackingEvent[]; boundary: boolean; evidence: string[];
}
