/** Exact public JSON shapes consumed by the pinned SelectedRigid family.
 * All lattice coordinates and mask offsets are [x,y], not [row,column]. */
import type { NativeRecord } from './v6-native-types.ts';

export type SelectedRigidCell = readonly [x: number, y: number];
export type SelectedRigidPoses = readonly SelectedRigidCell[];
export interface SelectedRigidCommand { action_ref: string; data?: Readonly<Record<string, number>> }
export interface SelectedRigidGeometry {
  q: number; origin: SelectedRigidCell; size: SelectedRigidCell; frame_color: number;
}
export interface SelectedRigidBody {
  key: string; color: number; position: SelectedRigidCell; mask: SelectedRigidCell[];
}
export interface SelectedRigidReceptacle {
  key: string; position: SelectedRigidCell; mask: SelectedRigidCell[];
}
export interface SelectedRigidScene {
  geometry: SelectedRigidGeometry; bodies: SelectedRigidBody[]; receptacle: SelectedRigidReceptacle;
}
export type SelectedRigidControlModel = Record<string, SelectedRigidCell>;
export interface SelectedRigidState {
  epoch: number; scene: SelectedRigidScene; active: number | null; evidence: string[];
  tried: [pose_digest: string, body_index: number, action_ref: string][];
}
export interface SelectedRigidEvent {
  kind: 'observed_selected_rigid'; state: SelectedRigidState; models: SelectedRigidControlModel[];
  detail: {
    before: string; after: string; command: SelectedRigidCommand; prior_model_count: number;
    role_status: 'selected_receiver_hypothesis' | 'observed_exclusive_receiver' | 'blocked_or_unselected_remains_conditional';
    compatible_model_count: number; selection_pixels_changed?: boolean; moved?: boolean;
  };
}
export interface SelectedRigidSourceState extends NativeRecord {
  format: 'selected_rigid_events.v1'; events: SelectedRigidEvent[];
}
export interface SelectedRigidConfiguration { compose: string; control: string; scope?: string }
export type SelectedRigidRouteStep = readonly [body_index: number, direction: SelectedRigidCell, poses: SelectedRigidPoses];
export type SelectedRigidRouteResult = readonly [path: SelectedRigidRouteStep[] | null, nodes: number];
export interface SelectedRigidPlan {
  scene: SelectedRigidScene; state: SelectedRigidState; models: SelectedRigidControlModel[];
  commands: SelectedRigidCommand[]; expected: (SelectedRigidPoses | null)[];
  before_states: SelectedRigidPoses[]; active: number | null; epoch: number; score: number;
  observation_ref: string; frame_digest: string; mode: 'path' | 'select' | 'probe'; why: string; search_nodes: number;
}
export interface SelectedRigidStep {
  action: SelectedRigidCommand; expected_after: null;
  point_binding?: {
    entity_ref: string; signature: string; bbox: readonly number[]; observation_ref: string;
    level_epoch: number; frame_hash: string; point: [number, number]; palette_value: number;
    source: 'current_observed_occupied_mask_point';
  };
}
export interface SelectedRigidProposal extends NativeRecord {
  status: 'proposed'; kind: 'selected_rigid'; proposal_id: string; selected_rigid_plan: SelectedRigidPlan;
  actions: SelectedRigidCommand[]; steps: SelectedRigidStep[];
  facts: { current_full_masks_measured: true; receptacle_goal_is_library_prior: true;
    collision_domain_is_provisional: true; control_hypotheses_preserved: true };
  compositions: NativeRecord[]; question: { reason: string; hypothesis_refs: string[] }; route_refs: string[];
  binding: { level_epoch: number; observation_ref: string };
  bundle_template: {
    operation_key: 'OP18'; composition_ref: string; objective_ref: 'G_official_completion';
    preserve_refs: string[]; actions: SelectedRigidCommand[]; purpose: string;
    preconditions: SelectedRigidProposal['facts']; evidence: string[];
    outcome_guard: { path: ['value']; contains: string };
  };
}
export interface SelectedRigidBlocked extends NativeRecord {
  status: 'unknown'; block_unrelated_probe: true; reason: string;
  native_incomplete?: { cause: string; examined: number; work: number; frontier: NativeRecord };
}
export interface SelectedRigidReturn extends NativeRecord {
  events: SelectedRigidEvent[];
  scope: 'Canonical public transition; receiver remains hypothetical until discriminating displacement.';
}
/** Read-only diagnostic values; asking for them never reads a clock. */
export interface SelectedRigidCaptureContext extends NativeRecord {
  configuration: SelectedRigidConfiguration | null; requestedStopReason: string | null;
  levelDeadlineMs: number | null; remainingLevelActions: number | null; observedNowMs: number | null;
}
